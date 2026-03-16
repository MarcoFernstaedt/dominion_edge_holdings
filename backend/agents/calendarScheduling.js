/**
 * CalendarSchedulingAgent
 *
 * Propose optimal meeting slots and generate scheduling email draft.
 * Model: Claude Haiku (daily_briefing task route — lightweight scheduling)
 *
 * CalendarAdapter is a deterministic stub. Swap for Google Calendar adapter in production.
 *
 * Standard output shape includes: agentName, analysisSummary, actionsProposed, confidenceScore
 */

import AIService from '../services/AIService.js';

// ─── CalendarAdapter (deterministic — no AI) ──────────────────────────────────
export const CalendarAdapter = {
  listAvailableWindows({ durationMinutes = 30 } = {}) {
    const slots = [];
    const base = new Date();
    base.setDate(base.getDate() + 1); // start tomorrow
    base.setHours(0, 0, 0, 0);

    for (let i = 0; slots.length < 6 && i < 14; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue; // skip weekends

      for (const hour of [9, 14]) {
        const start = new Date(d);
        start.setHours(hour, 0, 0, 0);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString(), available: true });
        if (slots.length >= 6) break;
      }
    }
    return slots;
  },

  createEvent({ title, startsAt, endsAt, locationType }) {
    return {
      eventId: `evt_${Date.now()}`,
      meetingLink: locationType === 'zoom' || locationType === 'google_meet'
        ? `https://zoom.us/j/${Math.floor(Math.random() * 9e9 + 1e9)}`
        : null,
    };
  },

  updateEvent({ eventId }) { return { eventId, updated: true }; },
  cancelEvent({ eventId })  { return { eventId, cancelled: true }; },
  generateMeetingLink()     { return `https://zoom.us/j/${Math.floor(Math.random() * 9e9 + 1e9)}`; },
};

// ─── Default durations per meeting type (deterministic) ───────────────────────
const DEFAULT_DURATIONS = {
  seller_discovery:           30,
  seller_followup:            45,
  board_intro:                60,
  banker_intro:               30,
  attorney_intro:             30,
  cpa_intro:                  30,
  capital_intro:              60,
  diligence_review:           90,
  post_acquisition_transition: 60,
  internal_planning:          30,
};

const SYSTEM_PROMPT = `You are the Calendar Scheduling Agent for Dominion Edge Holdings.

Propose 3 concrete meeting time slots from the available windows. Factor in meeting type best practices:
- seller_discovery/followup: prefer 8-9am or 4-6pm owner's local time
- board/capital_intro: flexible executive hours
- diligence_review: mornings with screen-share setup time
- internal_planning: any business hour slot

Return ONLY valid JSON. No prose.`;

export async function CalendarSchedulingAgent({ meetingType, durationMinutes, contactName, contactTimezone, preferredDays, preferredTimes, entityId, costFlags }) {
  // Deterministic: resolve duration before any AI call
  const duration = durationMinutes ?? DEFAULT_DURATIONS[meetingType] ?? 30;
  const windows  = CalendarAdapter.listAvailableWindows({ durationMinutes: duration });

  const userMessage = `Propose 3 slots from these available windows.

Meeting type: ${meetingType}
Duration: ${duration} minutes
Contact: ${contactName || 'Not specified'}
Timezone: ${contactTimezone || 'EST (assumed)'}
Preferred days: ${preferredDays?.join(', ') || 'Any weekday'}
Preferred times: ${preferredTimes?.join(', ') || 'Business hours'}

Available windows:
${JSON.stringify(windows, null, 2)}

Return ONLY this JSON:
{
  "agentName": "CalendarSchedulingAgent",
  "analysisSummary": "<one sentence rationale>",
  "actionsProposed": ["send_scheduling_email", "create_calendar_hold"],
  "confidenceScore": <number 0-1>,
  "suggestedSlots": [
    { "startsAt": "<ISO>", "endsAt": "<ISO>", "label": "<human readable>", "confidence": <0-1> }
  ],
  "recommendedDuration": <number>,
  "suggestedLocationType": "<zoom|phone|in_person|google_meet>",
  "draftProposalMessage": "<short scheduling email body>"
}`;

  const result = await AIService.run('daily_briefing', { meetingType, duration, contactName }, {
    entityId: entityId || `sched_${meetingType}_${Date.now()}`,
    entityType: 'meeting',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    costFlags,
  });

  return result.content;
}
