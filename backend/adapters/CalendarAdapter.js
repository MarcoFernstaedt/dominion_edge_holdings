/**
 * CalendarAdapter
 *
 * Adapter interface for calendar providers (Google Calendar, Outlook, internal).
 * Checks IntegrationRegistry before any external call.
 * When calendar integration is disabled: meetings are created/tracked internally only.
 */

import IntegrationRegistry from '../services/IntegrationRegistry.js';
import { withRetry } from '../utils/retry.js';

// ─── Degradation response shape ───────────────────────────────────────────────
function internalOnly(message) {
  return {
    source:    'internal',
    eventId:   null,
    meetingLink: null,
    calendarLink: null,
    warning:   message || 'Calendar integration is not configured. This meeting will only exist inside the platform.',
  };
}

// ─── Internal fallback: generate available windows deterministically ──────────
function generateInternalWindows(durationMinutes = 30) {
  const slots = [];
  const base  = new Date();
  base.setDate(base.getDate() + 1);
  base.setHours(0, 0, 0, 0);

  for (let i = 0; slots.length < 6 && i < 14; i++) {
    const d   = new Date(base);
    d.setDate(d.getDate() + i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const hour of [9, 14]) {
      const start = new Date(d);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60000);
      slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString(), available: true, source: 'internal' });
      if (slots.length >= 6) break;
    }
  }
  return slots;
}

// ─── Google Calendar API calls ────────────────────────────────────────────────
async function googleFetch(path, method, body, accessToken) {
  return withRetry(async () => {
    const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401) throw Object.assign(new Error('Calendar auth expired'), { retryable: false });
    if (!res.ok) throw new Error(`Google Calendar returned ${res.status}`);
    return res.json();
  }, {
    maxRetries:  3,
    baseDelayMs: 800,
    shouldRetry: (err) => err.retryable !== false,
    onRetry:     (attempt, err, delay) => console.warn(`[CalendarAdapter] retry ${attempt} in ${delay}ms — ${err.message}`),
  });
}

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * List available time windows.
 * Returns internal synthetic windows when calendar is disabled.
 */
export async function listAvailableWindows({ durationMinutes = 30, startDate, endDate } = {}) {
  const guard = IntegrationRegistry.guard('calendar');

  if (!guard.ok) {
    return {
      slots:   generateInternalWindows(durationMinutes),
      source:  'internal',
      warning: guard.degradedMessage,
    };
  }

  const cfg = IntegrationRegistry.getConfig('calendar');
  try {
    if (cfg.provider === 'google') {
      const now  = new Date(startDate || Date.now());
      const end  = new Date(endDate   || now.getTime() + 7 * 86400000);
      const data = await googleFetch(
        `/freeBusy`,
        'POST',
        { timeMin: now.toISOString(), timeMax: end.toISOString(), items: [{ id: 'primary' }] },
        cfg.credentials?.access_token
      );
      IntegrationRegistry.recordSuccess('calendar');
      // Build available slots around busy times
      const busy  = data.calendars?.primary?.busy || [];
      const slots = _buildSlotsAvoidingBusy(busy, durationMinutes, now, end);
      return { slots, source: 'google' };
    }
    // Unknown provider — fall back to internal
    return { slots: generateInternalWindows(durationMinutes), source: 'internal' };
  } catch (err) {
    IntegrationRegistry.recordError('calendar', err.message);
    return {
      slots:   generateInternalWindows(durationMinutes),
      source:  'internal',
      warning: IntegrationRegistry.getStatus('calendar').lastError,
    };
  }
}

/**
 * Create a calendar event.
 * Returns internal-only result if calendar disabled/unreachable.
 */
export async function createEvent({ title, startsAt, endsAt, attendees = [], locationType, description } = {}) {
  const guard = IntegrationRegistry.guard('calendar');

  if (!guard.ok) {
    return internalOnly(guard.degradedMessage);
  }

  const cfg = IntegrationRegistry.getConfig('calendar');
  try {
    if (cfg.provider === 'google') {
      const event = await googleFetch('/calendars/primary/events', 'POST', {
        summary:     title,
        description: description || '',
        start:       { dateTime: startsAt },
        end:         { dateTime: endsAt   },
        attendees:   attendees.map((email) => ({ email })),
        conferenceData: locationType === 'google_meet' ? { createRequest: { requestId: `deh_${Date.now()}` } } : undefined,
      }, cfg.credentials?.access_token);

      IntegrationRegistry.recordSuccess('calendar');
      return {
        source:      'google',
        eventId:     event.id,
        meetingLink: event.hangoutLink || null,
        calendarLink: event.htmlLink || null,
      };
    }
    return internalOnly();
  } catch (err) {
    IntegrationRegistry.recordError('calendar', err.message);
    return internalOnly(`Calendar provider unreachable. Meeting saved locally.`);
  }
}

/**
 * Update an existing calendar event.
 */
export async function updateEvent({ eventId, updates = {} } = {}) {
  const guard = IntegrationRegistry.guard('calendar');
  if (!guard.ok) return { updated: false, warning: guard.degradedMessage };

  const cfg = IntegrationRegistry.getConfig('calendar');
  try {
    if (cfg.provider === 'google' && eventId) {
      await googleFetch(`/calendars/primary/events/${eventId}`, 'PATCH', updates, cfg.credentials?.access_token);
      IntegrationRegistry.recordSuccess('calendar');
      return { updated: true, eventId };
    }
    return { updated: false };
  } catch (err) {
    IntegrationRegistry.recordError('calendar', err.message);
    return { updated: false, warning: err.message };
  }
}

/**
 * Cancel a calendar event.
 */
export async function cancelEvent({ eventId, reason } = {}) {
  const guard = IntegrationRegistry.guard('calendar');
  if (!guard.ok) return { cancelled: false, warning: guard.degradedMessage };

  const cfg = IntegrationRegistry.getConfig('calendar');
  try {
    if (cfg.provider === 'google' && eventId) {
      await googleFetch(`/calendars/primary/events/${eventId}`, 'DELETE', null, cfg.credentials?.access_token);
      IntegrationRegistry.recordSuccess('calendar');
      return { cancelled: true, eventId };
    }
    return { cancelled: false };
  } catch (err) {
    IntegrationRegistry.recordError('calendar', err.message);
    return { cancelled: false, warning: err.message };
  }
}

/**
 * Generate a meeting link (Zoom/Meet).
 * Returns null gracefully when integration not configured.
 */
export async function generateMeetingLink({ platform = 'zoom' } = {}) {
  const guard = IntegrationRegistry.guard('calendar');
  if (!guard.ok || platform === 'none') return null;
  // In production, call Zoom/Meet API here
  return `https://zoom.us/j/${Math.floor(Math.random() * 9e9 + 1e9)}`;
}

// ─── Busy-slot avoidance (deterministic) ─────────────────────────────────────
function _buildSlotsAvoidingBusy(busyPeriods, durationMinutes, start, end) {
  const slots = [];
  const d     = new Date(start);
  d.setHours(9, 0, 0, 0);

  while (d < end && slots.length < 6) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      for (const hour of [9, 11, 14, 16]) {
        const slotStart = new Date(d);
        slotStart.setHours(hour, 0, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

        const conflict = busyPeriods.some((b) =>
          new Date(b.start) < slotEnd && new Date(b.end) > slotStart
        );
        if (!conflict) {
          slots.push({ startsAt: slotStart.toISOString(), endsAt: slotEnd.toISOString(), available: true, source: 'google' });
          if (slots.length >= 6) break;
        }
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return slots;
}

export const CalendarAdapter = { listAvailableWindows, createEvent, updateEvent, cancelEvent, generateMeetingLink };
export default CalendarAdapter;
