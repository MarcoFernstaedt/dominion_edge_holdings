/**
 * CalendarAdapter
 *
 * Adapter interface for calendar providers (Google Calendar, Outlook, internal).
 * Checks IntegrationRegistry before any external call.
 * When calendar integration is disabled: meetings are created/tracked internally only.
 */

import IntegrationRegistry from '../services/IntegrationRegistry.js';

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

// ─── Google Calendar via GoogleWorkspaceProvider ──────────────────────────────
async function getGoogleProvider() {
  const { GoogleWorkspaceProvider } = await import('../services/providers/GoogleWorkspaceProvider.js');
  return GoogleWorkspaceProvider;
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
      const gp   = await getGoogleProvider();
      const busy = await gp.getFreeBusy({ timeMin: now.toISOString(), timeMax: end.toISOString() });
      IntegrationRegistry.recordSuccess('calendar');
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
      const gp    = await getGoogleProvider();
      const event = await gp.createCalendarEvent({ title, description, startsAt, endsAt, attendees, locationType });

      IntegrationRegistry.recordSuccess('calendar');
      return {
        source:      'google',
        eventId:     event.eventId,
        meetingLink: event.meetingLink,
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
      const gp = await getGoogleProvider();
      await gp.updateCalendarEvent(eventId, updates);
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
      const gp = await getGoogleProvider();
      await gp.cancelCalendarEvent(eventId);
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
 * Returns null when no video conferencing integration is configured.
 * To enable: wire a Zoom or Google Meet OAuth provider and call their
 * meeting-creation API here, then return the generated join URL.
 */
export async function generateMeetingLink({ platform = 'zoom' } = {}) {
  const guard = IntegrationRegistry.guard('calendar');
  if (!guard.ok || platform === 'none') return null;
  // No video conferencing integration configured — return null so
  // callers can decide whether to show a "no link" state in the UI.
  return null;
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
