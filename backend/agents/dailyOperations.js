/**
 * DailyOperationsAgent
 *
 * Generate daily execution plan: top priorities, urgent follow-ups, stalled deals.
 * Model: Claude Haiku (daily_briefing task)
 */

import ModelGateway            from '../services/ModelGateway.js';
import TaskService             from '../services/TaskService.js';
import PipelinePressureService from '../services/PipelinePressureService.js';

// ─── Rule-based fallback briefing (deterministic, no AI) ─────────────────────
function ruleBriefing({ pipeline, tasks, meetings, contacts, date, store }) {
  const today        = new Date(date || Date.now()).toDateString();
  const overdue      = TaskService.detectOverdue(tasks || []);
  const todayMtgs    = (meetings || []).filter((m) => new Date(m.startsAt).toDateString() === today && m.status !== 'cancelled');
  const urgentTasks  = (tasks || []).filter((t) => t.status !== 'done' && (t.priority === 'critical' || t.priority === 'high'));
  const now          = Date.now();
  const stalled      = (pipeline || []).filter((d) => d.status === 'active' && (now - new Date(d.updatedAt || d.createdAt).getTime()) / 86400000 > 14);

  // System 2: high-influence cooling contacts
  const coolingHighInfluence = (contacts || []).filter((c) => {
    const isHighInfluence = (c.influenceScore ?? 0) >= 7;
    const isCooling       = c.pipelinePressureLevel === 'cooling' || c.pipelinePressureLevel === 'stalled';
    return isHighInfluence && isCooling;
  });

  // System 4: short seller timelines
  const shortTimelines = (contacts || []).filter((c) => c.sellerTimeline === 'immediate' || c.sellerTimeline === '6_months');

  // System 6: contact frequency progress
  const freqProgress = store ? PipelinePressureService.computeFrequencyProgress(store) : null;

  const priorities = [];
  if (overdue.length)               priorities.push(`Review ${overdue.length} overdue task(s)`);
  if (todayMtgs.length)             priorities.push(`Prepare for ${todayMtgs.length} meeting(s) today`);
  if (stalled.length)               priorities.push(`Re-engage ${stalled.length} stalled deal(s)`);
  if (coolingHighInfluence.length)  priorities.push(`Reconnect with ${coolingHighInfluence.length} high-influence contact(s) going cold`);
  if (shortTimelines.length)        priorities.push(`Follow up with ${shortTimelines.length} seller(s) with short timeline`);
  if (urgentTasks.length)           priorities.push(`Complete ${urgentTasks.length} urgent task(s)`);
  if (priorities.length === 0)      priorities.push('No critical items — maintain outreach cadence');

  const freqSummary = freqProgress ? [
    freqProgress.ownersContactedPerWeek.label,
    freqProgress.followUpsPerDay.label,
    freqProgress.boardOutreachPerWeek.label,
  ] : [];

  // Catch-up tasks for missed targets
  const catchUpTasks = [];
  if (freqProgress) {
    const ownerTarget = freqProgress.ownersContactedPerWeek;
    if (ownerTarget.current < ownerTarget.target) {
      catchUpTasks.push(`Send ${ownerTarget.target - ownerTarget.current} more owner outreach emails this week`);
    }
    const followTarget = freqProgress.followUpsPerDay;
    if (followTarget.current < followTarget.target) {
      catchUpTasks.push(`Complete ${followTarget.target - followTarget.current} more follow-up tasks today`);
    }
    const boardTarget = freqProgress.boardOutreachPerWeek;
    if (boardTarget.current < boardTarget.target) {
      catchUpTasks.push(`Reach out to ${boardTarget.target - boardTarget.current} more board contacts this week`);
    }
  }

  return {
    agentName:        'DailyOperationsAgent',
    analysisSummary:  'Rule-based briefing (AI unavailable)',
    actionsProposed:  [...priorities, ...catchUpTasks],
    confidenceScore:  0.8,
    fallbackUsed:     true,
    fallbackMethod:   'rule_based',
    message:          'AI features are disabled. Showing rule-based task list.',
    topPriorities:    priorities.slice(0, 3),
    supportingTasks:  urgentTasks.slice(0, 5).map((t) => t.title),
    stalledDeals:     stalled.map((d) => d.companyName),
    meetingSummary:   todayMtgs.length ? `${todayMtgs.length} meeting(s) scheduled today` : 'No meetings today',
    motivationalNote: 'Every call is a step closer to the acquisition.',
    contactFrequency: freqSummary,
    catchUpTasks,
    coolingHighInfluenceCount: coolingHighInfluence.length,
    shortTimelineCount:        shortTimelines.length,
  };
}

const SYSTEM_PROMPT = `You are the Daily Operations Agent for Dominion Edge Holdings AOS.

Generate a concise, actionable daily briefing for Marco Fernstaedt, a search fund entrepreneur acquiring B2B businesses ($1-5M SDE). Focus:
1. Top 3 priorities for the day
2. Urgent follow-ups (deals with no activity > 7 days)
3. Stalled deal detection (no stage change in 14+ days)
4. Today's meetings with prep notes
5. Stalled relationship alerts — high-influence contacts going cold (System 2)
6. Short seller timeline follow-ups — sellers with immediate/6-month timelines (System 4)
7. Contact frequency progress vs weekly targets (System 6)

Return structured JSON only. Under 300 words total.`;

export async function DailyOperationsAgent({ pipeline = [], tasks = [], meetings = [], contacts = [], date, entityId, costFlags, store }) {
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

  // System 2: cooling high-influence contacts
  const coolingHighInfluence = contacts.filter((c) => {
    return (c.influenceScore ?? 0) >= 7 && (c.pipelinePressureLevel === 'cooling' || c.pipelinePressureLevel === 'stalled');
  });

  // System 4: short seller timelines
  const shortTimelines = contacts.filter((c) => c.sellerTimeline === 'immediate' || c.sellerTimeline === '6_months');

  // System 6: frequency progress
  const freqProgress = store ? PipelinePressureService.computeFrequencyProgress(store) : null;
  const freqSummary  = freqProgress
    ? `Owners: ${freqProgress.ownersContactedPerWeek.current}/${freqProgress.ownersContactedPerWeek.target} | Follow-ups: ${freqProgress.followUpsPerDay.current}/${freqProgress.followUpsPerDay.target} | Board: ${freqProgress.boardOutreachPerWeek.current}/${freqProgress.boardOutreachPerWeek.target}`
    : 'N/A';

  const userMessage = `Generate today's operational briefing.

Date: ${new Date(date || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
Today's meetings: ${todayMeetings.length} — ${todayMeetings.map((m) => m.title).join(', ') || 'none'}
Urgent/high tasks: ${urgentTasks.length} — ${urgentTasks.slice(0, 3).map((t) => t.title).join(', ') || 'none'}
Stalled deals (14+ days no change): ${stalledDeals.length} — ${stalledDeals.slice(0, 3).map((d) => d.companyName).join(', ') || 'none'}
Active pipeline: ${pipeline.filter((d) => d.status === 'active').length} deals
High-influence cooling contacts: ${coolingHighInfluence.length}
Short seller timelines (immediate/6mo): ${shortTimelines.length}
Contact frequency progress: ${freqSummary}

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
  "motivationalNote": "<one sentence>",
  "contactFrequency": ["<freq line>", ...],
  "coolingHighInfluenceCount": ${coolingHighInfluence.length},
  "shortTimelineCount": ${shortTimelines.length}
}`;

  try {
    const result = await ModelGateway.run({
      taskType: 'daily_briefing',
      agentName: 'DailyOperationsAgent',
      entityIds: [entityId || `briefing_${new Date(date || Date.now()).toISOString().slice(0, 10)}`],
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      outputSchema: null,
    });
    return result.content;
  } catch (err) {
    return ruleBriefing({ pipeline, tasks, meetings, contacts, date, store });
  }
}
