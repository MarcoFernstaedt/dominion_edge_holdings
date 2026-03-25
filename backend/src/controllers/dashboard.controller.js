import store       from '../store.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { DEH_SYSTEM_PROMPT } from '../config/constants.js';
import { getSafeModel } from '../lib/helpers.js';
import { createAnthropicMessage } from '../lib/aiClient.js';

export function getMetrics(req, res) {
  try {
    const now     = new Date();
    const weekAgo = new Date(now - 7 * 86400000);

    const overdueTasks  = store.tasks.filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now).length;
    const activeDeals   = store.deals.filter((d) => d.status === 'active').length;
    const outboundWeek  = store.interactions.filter((i) => i.direction === 'outbound' && new Date(i.createdAt) > weekAgo).length;
    const confirmedBoard = store.boardCandidates.filter((c) => c.status === 'confirmed').length;
    const allItems      = store.checklistPhases.flatMap((p) => p.items || []);
    const completedItems = allItems.filter((i) => i.isComplete).length;
    const progressPct   = allItems.length > 0 ? Math.round((completedItems / allItems.length) * 100) : 0;
    const needsReply    = store.emailThreads.filter((t) => t.needsReply).length;

    res.json({ overdueTasks, activeDeals, outboundWeek, confirmedBoard, progressPct, completedItems, totalItems: allItems.length, needsReply });
  } catch (err) {
    console.error('[dashboard/metrics]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute metrics');
  }
}

export function getNextActions(req, res) {
  try {
    const now     = new Date();
    const actions = [];

    store.tasks
      .filter((t) => t.status !== 'done' && t.status !== 'archived' && t.dueDate && new Date(t.dueDate) < now)
      .slice(0, 3)
      .forEach((t) => actions.push({ id: `task-${t.id}`, priority: 1, label: `Overdue: ${t.title}`, href: '/tasks', type: 'task' }));

    store.emailThreads
      .filter((t) => t.needsReply)
      .slice(0, 2)
      .forEach((t) => actions.push({ id: `email-${t.id}`, priority: 2, label: `Reply needed: ${t.subject}`, href: '/inbox', type: 'email' }));

    store.deals
      .filter((d) => d.status === 'active' && (now - new Date(d.updatedAt)) > 7 * 86400000)
      .slice(0, 2)
      .forEach((d) => actions.push({ id: `deal-${d.id}`, priority: 3, label: `Stalled deal: ${d.companyName}`, href: `/pipeline/${d.id}`, type: 'deal' }));

    const boardPipeline = store.boardCandidates.filter((c) => ['identified', 'researched', 'outreach_sent'].includes(c.status)).length;
    if (boardPipeline > 0) actions.push({ id: 'board', priority: 4, label: `${boardPipeline} board candidates need follow-up`, href: '/board', type: 'board' });

    const nextItem = store.checklistPhases.flatMap((p) => (p.items || []).filter((i) => !i.isComplete)).find(Boolean);
    if (nextItem) actions.push({ id: `checklist-${nextItem.id}`, priority: 5, label: `Next step: ${nextItem.title}`, href: '/checklist', type: 'checklist' });

    res.json(actions.sort((a, b) => a.priority - b.priority));
  } catch (err) {
    console.error('[dashboard/next-actions]', err);
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to compute next actions');
  }
}

export async function getBriefing(req, res) {
  if (!store.settings.aiBriefingEnabled) return res.json({ briefing: null, reason: 'AI briefing disabled' });
  try {
    const metrics = {
      overdueTasks: store.tasks.filter((t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date()).length,
      activeDeals:  store.deals.filter((d) => d.status === 'active').length,
      needsReply:   store.emailThreads.filter((t) => t.needsReply).length,
    };
    const message = await createAnthropicMessage({
      model:      getSafeModel(store.settings),
      max_tokens: 512,
      system:     DEH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a concise daily briefing for Marco (3-4 sentences max). Metrics: ${JSON.stringify(metrics)}. Date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}. Top priorities only.` }],
    });
    res.json({ briefing: message.content[0]?.text ?? '' });
  } catch (err) {
    console.error('[dashboard/briefing]', err.message);
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI briefing service temporarily unavailable');
  }
}
