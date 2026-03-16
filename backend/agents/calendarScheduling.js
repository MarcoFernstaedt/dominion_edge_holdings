/**
 * CalendarSchedulingAgent
 *
 * Proposes optimal meeting time slots based on meeting type, contact preferences,
 * and business context. Implements the CalendarAdapter interface (mock/stub).
 * In production, swap the stub for a real Google Calendar / Outlook adapter.
 *
 * Returns:
 *   proposedSlots: ProposedSlot[]  (up to 3 options)
 *   rationale: string
 *   suggestedDurationMinutes: number
 *   suggestedLocationType: 'zoom' | 'phone' | 'in_person' | 'google_meet'
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Calendar Scheduling Agent for Dominion Edge Holdings.

Your job is to propose 3 concrete meeting time slots for a given meeting type and contact situation. You understand the typical availability patterns of small business owners (often early morning or late afternoon, avoiding peak business hours).

Meeting type guidelines:
- seller_discovery: 30 min, phone or Zoom, prefer 8-9am or 4-6pm owner's local time
- seller_followup: 45 min, Zoom, weekday mornings
- board_intro: 60 min, Zoom or video, flexible executive hours
- banker_intro: 30 min, phone or Zoom, business hours
- attorney_intro: 30 min, phone, business hours
- cpa_intro: 30 min, phone, business hours
- capital_intro: 60 min, Zoom, flexible
- diligence_review: 90 min, Zoom with screen share
- post_acquisition_transition: 60 min, in person or Zoom
- internal_planning: 30 min, internal Zoom

Always propose slots at least 24 hours from now. Avoid Mondays before 10am and Fridays after 3pm.
Return ONLY valid JSON.`;

// ─── CalendarAdapter stub ─────────────────────────────────────────────────────
// Replace with real adapter (Google Calendar, Outlook) in production.
export const CalendarAdapter = {
  async listAvailableWindows({ startDate, endDate, durationMinutes }) {
    // Stub: return synthetic available windows
    const slots = [];
    const start = new Date(startDate || Date.now() + 86400000); // tomorrow
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue; // skip weekends
      // Morning slot
      const morning = new Date(d);
      morning.setHours(9, 0, 0, 0);
      slots.push({
        startsAt: morning.toISOString(),
        endsAt: new Date(morning.getTime() + durationMinutes * 60000).toISOString(),
        available: true,
      });
      // Afternoon slot
      const afternoon = new Date(d);
      afternoon.setHours(14, 0, 0, 0);
      slots.push({
        startsAt: afternoon.toISOString(),
        endsAt: new Date(afternoon.getTime() + durationMinutes * 60000).toISOString(),
        available: true,
      });
    }
    return slots.slice(0, 6);
  },

  async createEvent({ title, startsAt, endsAt, attendees, locationType, description }) {
    // Stub: return a synthetic event ID
    return {
      eventId: `evt_${Date.now()}`,
      meetingLink: locationType === 'zoom' ? `https://zoom.us/j/${Math.floor(Math.random() * 9000000000 + 1000000000)}` : null,
      calendarLink: null,
    };
  },

  async updateEvent({ eventId, updates }) {
    return { eventId, updated: true };
  },

  async cancelEvent({ eventId, reason }) {
    return { eventId, cancelled: true };
  },

  async generateMeetingLink({ platform = 'zoom' }) {
    return `https://zoom.us/j/${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
  },
};

// ─── Agent ────────────────────────────────────────────────────────────────────
export async function CalendarSchedulingAgent({
  meetingType,
  durationMinutes,
  contactName,
  contactTimezone,
  preferredDays,
  preferredTimes,
  model,
}) {
  const availableWindows = await CalendarAdapter.listAvailableWindows({
    durationMinutes: durationMinutes || 30,
  });

  const userMessage = `Propose 3 meeting time slots for this scheduling request.

Meeting type: ${meetingType}
Duration: ${durationMinutes || 30} minutes
Contact: ${contactName || 'Not specified'}
Contact timezone: ${contactTimezone || 'EST (assumed)'}
Preferred days: ${preferredDays?.join(', ') || 'Any weekday'}
Preferred times: ${preferredTimes?.join(', ') || 'Business hours'}

Available windows from calendar:
${JSON.stringify(availableWindows, null, 2)}

Return ONLY valid JSON matching this schema:
{
  "proposedSlots": [
    {
      "startsAt": "<ISO 8601>",
      "endsAt": "<ISO 8601>",
      "label": "<human readable, e.g. 'Tuesday March 18, 9:00 AM EST'>",
      "confidence": <number 0-1>
    }
  ],
  "rationale": "<one sentence explaining slot selection>",
  "suggestedDurationMinutes": <number>,
  "suggestedLocationType": "<zoom|phone|in_person|google_meet>"
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 768,
    model,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
