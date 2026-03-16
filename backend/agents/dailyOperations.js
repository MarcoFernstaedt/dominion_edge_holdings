/**
 * DailyOperationsAgent
 *
 * Generates a personalized daily briefing covering: pipeline status,
 * urgent tasks, today's meetings, and recommended actions.
 * Used by the Command Center dashboard.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Daily Operations Agent for Dominion Edge Holdings AOS, a search fund platform.

Marco Fernstaedt is a search fund entrepreneur acquiring small-to-medium B2B businesses ($1-5M SDE range, EBITDA positive, owner-operated, recession-resilient industries).

Your role is to generate a concise, actionable daily briefing that helps Marco prioritize his day. Focus on:
1. Critical items requiring immediate attention
2. Upcoming meetings and prep needed
3. Pipeline deals requiring action
4. Recommended top 3 priorities for the day

Write in a direct, professional tone. Use bullet points. Keep it under 300 words.
Return structured JSON only.`;

export async function DailyOperationsAgent({ pipeline, tasks, meetings, date, model }) {
  const todayMeetings = (meetings || []).filter((m) => {
    if (!m.startsAt) return false;
    const meetingDate = new Date(m.startsAt).toDateString();
    const today = new Date(date || Date.now()).toDateString();
    return meetingDate === today && m.status !== 'cancelled';
  });

  const urgentTasks = (tasks || []).filter(
    (t) => t.status !== 'done' && (t.priority === 'critical' || t.priority === 'high')
  );

  const activeDeals = (pipeline || []).filter((d) => d.status === 'active');

  const userMessage = `Generate today's operational briefing.

Date: ${new Date(date || Date.now()).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}

Today's meetings (${todayMeetings.length}):
${todayMeetings.length ? JSON.stringify(todayMeetings.map((m) => ({ title: m.title, startsAt: m.startsAt, type: m.meetingType, status: m.status })), null, 2) : 'None scheduled'}

Active pipeline deals (${activeDeals.length}):
${activeDeals.length ? JSON.stringify(activeDeals.map((d) => ({ name: d.companyName, stage: d.stage, lastActivity: d.updatedAt })), null, 2) : 'None'}

Urgent/High priority tasks (${urgentTasks.length}):
${urgentTasks.length ? JSON.stringify(urgentTasks.map((t) => ({ title: t.title, dueDate: t.dueDate, priority: t.priority })), null, 2) : 'None'}

Return ONLY valid JSON:
{
  "greeting": "<personalized morning greeting>",
  "topPriorities": ["<priority 1>", "<priority 2>", "<priority 3>"],
  "meetingSummary": "<brief description of today's meetings>",
  "pipelineAlerts": ["<alert 1>", ...],
  "taskAlerts": ["<alert 1>", ...],
  "recommendedFocus": "<one paragraph on what to focus on today>",
  "motivationalNote": "<brief motivational note tailored to acquisition search>"
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1024,
    model,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
