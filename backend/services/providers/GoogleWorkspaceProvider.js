/**
 * GoogleWorkspaceProvider
 *
 * Real Gmail + Google Calendar integration using OAuth2 access tokens.
 * All methods auto-refresh the access token on 401 responses (one retry).
 *
 * Gmail API: https://developers.google.com/gmail/api
 * Calendar API: https://developers.google.com/calendar/api
 *
 * Required env vars (via GoogleOAuthProvider):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 * Optional:
 *   GOOGLE_CALENDAR_ID (default: 'primary')
 *   GMAIL_FROM_EMAIL, GMAIL_FROM_NAME
 */

import env from '../../src/config/env.js';
import { GoogleOAuthProvider, invalidateToken } from './GoogleOAuthProvider.js';
import { withRetry } from '../../utils/retry.js';

const GMAIL_BASE    = 'https://gmail.googleapis.com/gmail/v1/users/me';
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

// ─── Generic fetch wrapper with auto-refresh ──────────────────────────────────

async function googleFetch(url, options = {}, _retrying = false) {
  const token = await GoogleOAuthProvider.getAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
    signal: options.signal || AbortSignal.timeout(15000),
  });

  // On 401, invalidate cache and retry once
  if (res.status === 401 && !_retrying) {
    invalidateToken();
    return googleFetch(url, options, true);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Google API error ${res.status}: ${body.slice(0, 200)}`), {
      status: res.status,
      retryable: res.status >= 500,
    });
  }

  // 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

// ─── Gmail ────────────────────────────────────────────────────────────────────

/**
 * List threads in the inbox (or by query).
 * @param {{ query?: string, maxResults?: number, pageToken?: string }} opts
 * @returns {{ threads: Array, nextPageToken?: string }}
 */
export async function listThreads({ query = '', maxResults = 20, pageToken } = {}) {
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query)     params.set('q', query);
  if (pageToken) params.set('pageToken', pageToken);

  const data = await withRetry(
    () => googleFetch(`${GMAIL_BASE}/threads?${params}`),
    { maxRetries: 2, baseDelayMs: 800, shouldRetry: (e) => e.retryable }
  );

  return {
    threads:       (data?.threads || []).map(_normalizeThreadSummary),
    nextPageToken: data?.nextPageToken || null,
    resultSizeEstimate: data?.resultSizeEstimate || 0,
  };
}

/**
 * Get a single thread with all messages.
 */
export async function getThread(threadId) {
  const data = await withRetry(
    () => googleFetch(`${GMAIL_BASE}/threads/${threadId}?format=full`),
    { maxRetries: 2, baseDelayMs: 800, shouldRetry: (e) => e.retryable }
  );
  return _normalizeThread(data);
}

/**
 * Send an email via Gmail.
 * @param {{ to: string, subject: string, body: string, html?: string, replyToThreadId?: string }} email
 */
export async function sendEmail({ to, subject, body, html, replyToThreadId } = {}) {
  const fromName  = env.GMAIL_FROM_NAME  || 'Dominion Edge';
  const fromEmail = env.GMAIL_FROM_EMAIL || '';

  const headers = [
    `To: ${to}`,
    `From: "${fromName}" <${fromEmail}>`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
  ];

  let messageBody;
  if (html) {
    const boundary = `boundary_${Date.now()}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    messageBody = [
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      body,
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      '',
      html,
      `--${boundary}--`,
    ].join('\r\n');
  } else {
    headers.push('Content-Type: text/plain; charset=UTF-8');
    messageBody = body;
  }

  const raw = Buffer.from(
    headers.join('\r\n') + '\r\n\r\n' + messageBody
  ).toString('base64url');

  const reqBody = { raw };
  if (replyToThreadId) reqBody.threadId = replyToThreadId;

  const data = await withRetry(
    () => googleFetch(`${GMAIL_BASE}/messages/send`, {
      method: 'POST',
      body:   JSON.stringify(reqBody),
    }),
    { maxRetries: 2, baseDelayMs: 1000, shouldRetry: (e) => e.retryable }
  );

  return {
    sent:      true,
    messageId: data?.id,
    threadId:  data?.threadId,
  };
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

const calendarId = () => env.GOOGLE_CALENDAR_ID || 'primary';

/**
 * List calendar events.
 */
export async function listEvents({ timeMin, timeMax, maxResults = 20 } = {}) {
  const params = new URLSearchParams({ maxResults: String(maxResults), singleEvents: 'true', orderBy: 'startTime' });
  if (timeMin) params.set('timeMin', new Date(timeMin).toISOString());
  if (timeMax) params.set('timeMax', new Date(timeMax).toISOString());

  const data = await withRetry(
    () => googleFetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId())}/events?${params}`),
    { maxRetries: 2, baseDelayMs: 800, shouldRetry: (e) => e.retryable }
  );

  return (data?.items || []).map(_normalizeEvent);
}

/**
 * Get free/busy slots for availability.
 */
export async function getFreeBusy({ timeMin, timeMax } = {}) {
  const data = await withRetry(
    () => googleFetch(`${CALENDAR_BASE}/freeBusy`, {
      method: 'POST',
      body:   JSON.stringify({
        timeMin: new Date(timeMin || Date.now()).toISOString(),
        timeMax: new Date(timeMax || Date.now() + 7 * 86400000).toISOString(),
        items:   [{ id: calendarId() }],
      }),
    }),
    { maxRetries: 2, baseDelayMs: 800, shouldRetry: (e) => e.retryable }
  );

  return data?.calendars?.[calendarId()]?.busy || [];
}

/**
 * Create a calendar event.
 */
export async function createCalendarEvent({ title, description, startsAt, endsAt, attendees = [], locationType } = {}) {
  const body = {
    summary:     title,
    description: description || '',
    start:       { dateTime: new Date(startsAt).toISOString() },
    end:         { dateTime: new Date(endsAt).toISOString()   },
    attendees:   attendees.map((email) => ({ email })),
  };

  if (locationType === 'google_meet') {
    body.conferenceData = { createRequest: { requestId: `deh_${Date.now()}` } };
  }

  const params = locationType === 'google_meet' ? '?conferenceDataVersion=1' : '';
  const data = await withRetry(
    () => googleFetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId())}/events${params}`, {
      method: 'POST',
      body:   JSON.stringify(body),
    }),
    { maxRetries: 2, baseDelayMs: 1000, shouldRetry: (e) => e.retryable }
  );

  return {
    eventId:      data?.id,
    htmlLink:     data?.htmlLink,
    meetingLink:  data?.hangoutLink || null,
    calendarId:   calendarId(),
  };
}

/**
 * Update an existing calendar event (PATCH).
 */
export async function updateCalendarEvent(eventId, updates = {}) {
  await withRetry(
    () => googleFetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId())}/events/${eventId}`, {
      method: 'PATCH',
      body:   JSON.stringify(updates),
    }),
    { maxRetries: 2, baseDelayMs: 800, shouldRetry: (e) => e.retryable }
  );
  return { updated: true, eventId };
}

/**
 * Cancel (delete) a calendar event.
 */
export async function cancelCalendarEvent(eventId) {
  await withRetry(
    () => googleFetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId())}/events/${eventId}`, {
      method: 'DELETE',
    }),
    { maxRetries: 2, baseDelayMs: 800, shouldRetry: (e) => e.retryable }
  );
  return { cancelled: true, eventId };
}

/**
 * Health check: verify credentials work with a lightweight calendar list call.
 */
export async function healthCheck() {
  try {
    await googleFetch(`${CALENDAR_BASE}/users/me/calendarList?maxResults=1`);
    return { reachable: true };
  } catch (err) {
    return { reachable: false, reason: err.message };
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

function _normalizeThreadSummary(t) {
  return {
    threadId:  t.id,
    snippet:   t.snippet,
    historyId: t.historyId,
  };
}

function _normalizeThread(t) {
  if (!t) return null;
  return {
    threadId: t.id,
    messages: (t.messages || []).map(_normalizeMessage),
  };
}

function _normalizeMessage(m) {
  if (!m) return null;
  const headers = _headerMap(m.payload?.headers || []);
  return {
    messageId: m.id,
    threadId:  m.threadId,
    subject:   headers['subject'],
    from:      headers['from'],
    to:        headers['to'],
    date:      headers['date'],
    snippet:   m.snippet,
    labelIds:  m.labelIds || [],
    body:      _extractBody(m.payload),
  };
}

function _headerMap(headers) {
  return Object.fromEntries(headers.map((h) => [h.name.toLowerCase(), h.value]));
}

function _extractBody(payload) {
  if (!payload) return '';
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf8');
  }
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64').toString('utf8');
    }
  }
  return payload.snippet || '';
}

function _normalizeEvent(e) {
  return {
    eventId:     e.id,
    title:       e.summary,
    description: e.description,
    startsAt:    e.start?.dateTime || e.start?.date,
    endsAt:      e.end?.dateTime   || e.end?.date,
    htmlLink:    e.htmlLink,
    meetingLink: e.hangoutLink || null,
    attendees:   (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName, status: a.responseStatus })),
    status:      e.status,
  };
}

export const GoogleWorkspaceProvider = {
  // Gmail
  listThreads,
  getThread,
  sendEmail,
  // Calendar
  listEvents,
  getFreeBusy,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  healthCheck,
};
export default GoogleWorkspaceProvider;
