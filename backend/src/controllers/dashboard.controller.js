import os from 'os';
import store       from '../store.js';
import logger from '../lib/logger.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { DEH_SYSTEM_PROMPT } from '../config/constants.js';
import { getSafeModel } from '../lib/helpers.js';
import { createAnthropicMessage } from '../lib/aiClient.js';
import BackgroundJobRunner from '../../services/BackgroundJobRunner.js';
import AgentRunLogger from '../../services/AgentRunLogger.js';
import AgentOrchestrator from '../../services/AgentOrchestrator.js';
import IntegrationHealthService from '../../services/IntegrationHealthService.js';

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
    logger.error({ err: err.message }, '[dashboard/metrics] failed');
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
    logger.error({ err: err.message }, '[dashboard/next-actions] failed');
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
    logger.error({ err: err.message }, '[dashboard/briefing] AI briefing failed');
    errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI briefing service temporarily unavailable');
  }
}

export function getSystemStatus(_req, res) {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
    const fiveMinutesAgo = new Date(now.getTime() - (5 * 60 * 1000));

    const jobs = BackgroundJobRunner.status();
    const failedRuns = BackgroundJobRunner.failedRuns();
    const aiRuns = AgentRunLogger.getRuns({ limit: 25, offset: 0 });
    const recentAIRuns = aiRuns.items || [];
    const aiMetrics = AgentRunLogger.getSystemMetrics();
    const integrationCache = IntegrationHealthService.getLastHealthResult();

    const cpuLoad = os.loadavg?.()[0] ?? null;
    const totalMem = os.totalmem?.() ?? null;
    const freeMem = os.freemem?.() ?? null;
    const usedMem = totalMem !== null && totalMem !== undefined && freeMem !== null && freeMem !== undefined ? totalMem - freeMem : null;

    const activeJobs = jobs.filter((job) => job.running);
    const recentlyTouchedJobs = jobs.filter((job) => job.lastRun && new Date(job.lastRun) > oneHourAgo);
    const recentFailedJobs = failedRuns.filter((run) => run.startedAt && new Date(run.startedAt) > oneHourAgo);
    const recentAgentRuns = recentAIRuns.filter((run) => run.created_at && new Date(run.created_at) > oneHourAgo);
    const liveAgentRuns = recentAIRuns.filter((run) => run.created_at && new Date(run.created_at) > fiveMinutesAgo);
    const agentWorkMap = new Map();

    recentAIRuns.forEach((run) => {
      const key = run.agent_name || 'Unknown Agent';
      if (!agentWorkMap.has(key)) {
        agentWorkMap.set(key, {
          agentName: key,
          latestTask: run.task_type || 'unknown',
          lastRunAt: run.created_at,
          modelUsed: run.model_used || null,
          status: run.error_type ? 'error' : 'ok',
          fallbackUsed: Boolean(run.fallback_used),
          runCount: 1,
        });
        return;
      }

      const existing = agentWorkMap.get(key);
      existing.runCount += 1;
      if (new Date(run.created_at) > new Date(existing.lastRunAt)) {
        existing.latestTask = run.task_type || existing.latestTask;
        existing.lastRunAt = run.created_at;
        existing.modelUsed = run.model_used || existing.modelUsed;
        existing.status = run.error_type ? 'error' : existing.status;
        existing.fallbackUsed = existing.fallbackUsed || Boolean(run.fallback_used);
      }
    });

    const registeredAgents = AgentOrchestrator.listAgents?.() || [];
    const integrationResults = integrationCache?.results || [];
    const integrationsReachable = integrationResults.filter((result) => result.reachable !== false).length;
    const integrationsDegraded = integrationResults.filter((result) => result.reachable === false).length;

    res.json({
      generatedAt: now.toISOString(),
      app: {
        status: recentFailedJobs.length > 0 ? 'watch' : 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || null,
        checks: {
          dataLoaded: {
            companies: store.companies.length,
            deals: store.deals.length,
            tasks: store.tasks.length,
            notifications: store.notifications.length,
          },
          automation: {
            registeredJobs: jobs.length,
            runningJobs: activeJobs.length,
            jobsTouchedLastHour: recentlyTouchedJobs.length,
            failedRunsLastHour: recentFailedJobs.length,
          },
        },
      },
      vps: {
        available: true,
        hostname: os.hostname?.() || null,
        platform: `${os.platform?.() || 'unknown'} ${os.release?.() || ''}`.trim(),
        uptimeSeconds: os.uptime?.() ?? null,
        loadAverage1m: cpuLoad !== null && cpuLoad !== undefined ? Number(cpuLoad.toFixed(2)) : null,
        memory: totalMem !== null && totalMem !== undefined && freeMem !== null && freeMem !== undefined ? {
          usedBytes: usedMem,
          freeBytes: freeMem,
          totalBytes: totalMem,
          usedPercent: totalMem > 0 ? Number(((usedMem / totalMem) * 100).toFixed(1)) : null,
        } : null,
        node: {
          version: process.version,
          pid: process.pid,
          rssBytes: process.memoryUsage().rss,
          heapUsedBytes: process.memoryUsage().heapUsed,
          heapTotalBytes: process.memoryUsage().heapTotal,
        },
      },
      codexSession: {
        available: false,
        status: 'unavailable',
        note: 'Codex/OpenClaw session token usage is not exposed to this app backend yet.',
      },
      workforce: {
        registeredAgents: registeredAgents.length,
        agentsActiveLastHour: Array.from(agentWorkMap.values()).length,
        agentRunsLastHour: recentAgentRuns.length,
        activeWorkNowApprox: liveAgentRuns.length + activeJobs.length,
        subagents: {
          available: false,
          note: 'Subagent/session presence is not represented in the current app runtime data model.',
        },
        agents: Array.from(agentWorkMap.values())
          .sort((a, b) => new Date(b.lastRunAt).getTime() - new Date(a.lastRunAt).getTime())
          .slice(0, 8),
        jobs: jobs.slice(0, 8).map((job) => ({
          id: job.id,
          name: job.name,
          running: job.running,
          enabled: job.enabled,
          lastRun: job.lastRun,
          recentRuns: job.recentRuns,
        })),
      },
      ai: {
        totalRuns: aiMetrics.total_runs,
        failureRate: aiMetrics.failure_rate,
        fallbackRate: aiMetrics.fallback_rate,
        cacheHitRate: aiMetrics.cache_hit_rate,
        recentRuns: recentAIRuns.slice(0, 8).map((run) => ({
          runId: run.run_id,
          agentName: run.agent_name,
          taskType: run.task_type,
          modelUsed: run.model_used,
          createdAt: run.created_at,
          latencyMs: run.latency_ms,
          estimatedCost: run.estimated_cost,
          status: run.error_type ? 'error' : 'ok',
          fallbackUsed: run.fallback_used,
          cached: run.cached,
        })),
      },
      integrations: {
        available: Boolean(integrationCache),
        checkedAt: integrationCache?.checkedAt || null,
        connected: integrationsReachable,
        degraded: integrationsDegraded,
        items: integrationResults.slice(0, 8),
      },
    });
  } catch (err) {
    logger.error({ err: err.message }, '[dashboard/system-status] failed');
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to build system status');
  }
}
