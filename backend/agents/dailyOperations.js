/**
 * DailyOperationsAgent
 *
 * Generate daily execution plan: top priorities, urgent follow-ups, stalled deals.
 * Model: Claude Haiku (daily_briefing task)
 */

import AIService from '../services/AIService.js';
import TaskService from '../services/TaskService.js';

// ─── Rule-based fallback briefing (deterministic, no AI) ─────────────────────
function ruleBriefing({ pipeline, tasks, meetings, date }) {
  const today        = new Date(date || Date.now()).toDateString();
  const overdue      = TaskService.detectOverdue(tasks || []);
  const todayMtgs    = (meetings || []).filter((m) => new Date(m.startsAt).toDateString() === today && m.status !== 'cancelled');
  const urgentTasks  = (tasks || []).filter((t) => t.status !== 'done' && (t.priority === 'critical' || t.priority === 'high'));
  const now          = Date.now();
  const stalled      = (pipeline || []).filter((d) => d.status === 'active' && (now - new Date(d.updatedAt || d.createdAt).getTime()) / 86400000 > 14);

  const priorities = [];
  if (overdue.length)     priorities.push(`Review ${overdue.length} overdue task(s)`);
  if (todayMtgs.length)   priorities.push(`Prepare for ${todayMtgs.length} meeting(s) today`);
  if (stalled.length)     priorities.push(`Re-engage ${stalled.length} stalled deal(s)`);
  if (urgentTasks.length) priorities.push(`Complete ${urgentTasks.length} urgent task(s)`);
  if (priorities.length === 0) priorities.push('No critical items — maintain outreach cadence');

  return {
    agentName:        'DailyOperationsAgent',
    analysisSummary:  'Rule-based briefing (AI unavailable)',
    actionsProposed:  priorities,
    confidenceScore:  0.8,
    fallbackUsed:     true,
    fallbackMethod:   'rule_based',
    message:          'AI features are disabled. Showing rule-based task list.',
    topPriorities:    priorities.slice(0, 3),
    supportingTasks:  urgentTasks.slice(0, 5).map((t) => t.title),
    stalledDeals:     stalled.map((d) => d.companyName),
    meetingSummary:   todayMtgs.length ? `${todayMtgs.length} meeting(s) scheduled today` : 'No meetings today',
    motivationalNote: 'Every call is a step closer to the acquisition.',
  };
}

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

  try {
    const result = await AIService.run('daily_briefing', { date, urgentCount: urgentTasks.length, stalledCount: stalledDeals.length }, {
      entityId:  entityId || `briefing_${new Date(date || Date.now()).toISOString().slice(0, 10)}`,
      entityType: 'briefing',
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      costFlags,
    });
    return result.content;
  } catch (err) {
    return ruleBriefing({ pipeline, tasks, meetings, date });
  }
}
