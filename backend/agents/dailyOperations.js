/**
 * DailyOperationsAgent
 *
 * Generate daily execution plan: top priorities, urgent follow-ups, stalled deals.
 * Model: Claude Haiku (daily_briefing task)
 */

import AIService from '../services/AIService.js';

const SYSTEM_PROMPT = `You are the Daily Operations Agent for Dominion Edge Holdings AOS.

Generate a concise, actionable daily briefing for Marco Fernstaedt, a search fund entrepreneur acquiring B2B businesses ($1-5M SDE). Focus:
1. Top 3 priorities for the day
2. Urgent follow-ups (deals with no activity > 7 days)
3. Stalled deal detection (no stage change in 14+ days)
4. Today's meetings with prep notes

Return structured JSON only. Under 300 words total.`;

export async function DailyOperationsAgent({ pipeline = [], tasks = [], meetings = [], date, entityId, costFlags }) {
  // Deterministic pre-processing (no AI)
  const today = new Date(date || Date.now()).toDateString();

  const todayMeetings = meetings.filter((m) => {
    if (!m.startsAt || m.status === 'cancelled') return false;
    return new Date(m.startsAt).toDateString() === today;
  });

  const urgentTasks = tasks.filter(
    (t) => t.status !== 'done' && (t.priority === 'critical' || t.priority === 'high')
  );

  const now = Date.now();
  const stalledDeals = pipeline.filter((d) => {
    if (d.status !== 'active') return false;
    const daysSince = (now - new Date(d.updatedAt || d.createdAt).getTime()) / 86400000;
    return daysSince > 14;
  });

  const userMessage = `Generate today's operational briefing.

Date: ${new Date(date || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Today's meetings: ${todayMeetings.length} — ${todayMeetings.map((m) => m.title).join(', ') || 'none'}
Urgent/high tasks: ${urgentTasks.length} — ${urgentTasks.slice(0, 3).map((t) => t.title).join(', ') || 'none'}
Stalled deals (14+ days no change): ${stalledDeals.length} — ${stalledDeals.slice(0, 3).map((d) => d.companyName).join(', ') || 'none'}
Active pipeline: ${pipeline.filter((d) => d.status === 'active').length} deals

Return ONLY this JSON:
{
  "agentName": "DailyOperationsAgent",
  "analysisSummary": "<one sentence summary of the day>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "topPriorities": ["<priority>", "<priority>", "<priority>"],
  "supportingTasks": ["<task>", ...],
  "stalledDeals": ["<deal name>", ...],
  "meetingSummary": "<brief meeting overview>",
  "motivationalNote": "<one sentence>"
}`;

  const result = await AIService.run('daily_briefing', { date, urgentCount: urgentTasks.length, stalledCount: stalledDeals.length }, {
    entityId: entityId || `briefing_${new Date(date || Date.now()).toISOString().slice(0, 10)}`,
    entityType: 'briefing',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    costFlags,
  });

  return result.content;
}
