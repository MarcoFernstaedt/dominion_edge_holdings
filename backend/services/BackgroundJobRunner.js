/**
 * BackgroundJobRunner
 *
 * In-process async job queue with run history, structured logging, and
 * graceful shutdown. For production-scale async processing, replace the
 * interval-based scheduler with BullMQ + Redis, keeping this interface.
 *
 * Each job execution is recorded with status/duration/error for observability.
 * Failed runs are collected in a global ring buffer (last 200 failures).
 */

import logger               from '../src/lib/logger.js';
import CacheService            from './CacheService.js';
import AuditLogService         from './AuditLogService.js';
import NotificationService     from './NotificationService.js';
import AutomationRuleEngine    from './AutomationRuleEngine.js';
import TaskService             from './TaskService.js';
import PipelinePressureService from './PipelinePressureService.js';
import crypto                  from 'crypto';

const MAX_RUN_HISTORY   = 20;   // per job
const MAX_FAILED_BUFFER = 200;  // global ring buffer

// ─── Job registry ─────────────────────────────────────────────────────────────
class BackgroundJobRunnerClass {
  constructor() {
    this._jobs    = new Map();  // jobId → { name, fn, intervalMs, lastRun, running, enabled, history }
    this._timers  = new Map();  // jobId → NodeJS timer
    this._store   = null;       // injected via init()
    this._orchestrator = null;  // injected via init()
    this._failedRuns = [];      // global ring buffer of recent failures
  }

  /**
   * Inject the in-memory store and orchestrator at startup.
   */
  init(store, orchestrator) {
    this._store        = store;
    this._orchestrator = orchestrator;
    this._registerBuiltInJobs();
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.SYSTEM_STARTUP, 'system', 'background_jobs', { jobCount: this._jobs.size });
    logger.info({ jobCount: this._jobs.size }, '[BackgroundJobRunner] Initialized');
  }

  /** Register and schedule a job. */
  register({ id, name, fn, intervalMs, enabled = true }) {
    this._jobs.set(id, { id, name, fn, intervalMs, lastRun: null, running: false, enabled, history: [] });
    if (enabled) this._schedule(id);
  }

  _schedule(jobId) {
    if (this._timers.has(jobId)) clearInterval(this._timers.get(jobId));
    const job = this._jobs.get(jobId);
    if (!job || !job.enabled) return;
    const timer = setInterval(() => this._execute(jobId), job.intervalMs);
    // Allow process to exit even if timer is pending
    if (timer.unref) timer.unref();
    this._timers.set(jobId, timer);
  }

  async _execute(jobId) {
    const job = this._jobs.get(jobId);
    if (!job || job.running) return;
    job.running = true;
    const start = Date.now();
    const runId = crypto.randomUUID();
    logger.info({ jobId, jobName: job.name, runId }, '[BackgroundJobRunner] Job started');
    try {
      await job.fn({ store: this._store, orchestrator: this._orchestrator });
      const durationMs = Date.now() - start;
      job.lastRun   = new Date().toISOString();
      job.durationMs = durationMs;
      const record = { runId, status: 'ok', startedAt: new Date(start).toISOString(), durationMs };
      this._appendHistory(job, record);
      logger.info({ jobId, jobName: job.name, runId, durationMs }, '[BackgroundJobRunner] Job completed');
    } catch (err) {
      const durationMs = Date.now() - start;
      job.durationMs = durationMs;
      const record = {
        runId,
        status:    'failed',
        startedAt: new Date(start).toISOString(),
        durationMs,
        error:     err.message,
      };
      this._appendHistory(job, record);
      this._recordFailure({ jobId, jobName: job.name, ...record });
      logger.error({ jobId, jobName: job.name, runId, durationMs, err }, '[BackgroundJobRunner] Job failed');
    } finally {
      job.running = false;
    }
  }

  _appendHistory(job, record) {
    job.history.push(record);
    if (job.history.length > MAX_RUN_HISTORY) {
      job.history.shift();
    }
  }

  _recordFailure(entry) {
    this._failedRuns.push(entry);
    if (this._failedRuns.length > MAX_FAILED_BUFFER) {
      this._failedRuns.shift();
    }
  }

  /** Manually trigger a job by id (useful for testing / on-demand). */
  async trigger(jobId) {
    return this._execute(jobId);
  }

  setEnabled(jobId, enabled) {
    const job = this._jobs.get(jobId);
    if (!job) return;
    job.enabled = enabled;
    if (enabled) {
      this._schedule(jobId);
    } else {
      if (this._timers.has(jobId)) clearInterval(this._timers.get(jobId));
    }
  }

  status() {
    return [...this._jobs.values()].map(({ id, name, intervalMs, lastRun, running, enabled, durationMs, history }) => ({
      id, name, intervalMs, lastRun, running, enabled,
      durationMs:  durationMs ?? null,
      recentRuns:  history.slice(-5),
    }));
  }

  /** Returns the global failed-run ring buffer (up to last 200). */
  failedRuns() {
    return [...this._failedRuns];
  }

  /** Graceful shutdown: clear all timers and wait for running jobs to finish. */
  async shutdown(timeoutMs = 10_000) {
    logger.info('[BackgroundJobRunner] Shutting down — clearing timers');
    for (const [, timer] of this._timers) clearInterval(timer);
    this._timers.clear();

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const anyRunning = [...this._jobs.values()].some((j) => j.running);
      if (!anyRunning) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    logger.info('[BackgroundJobRunner] Shutdown complete');
  }

  // ─── Built-in jobs ─────────────────────────────────────────────────────────
  _registerBuiltInJobs() {
    const store        = this._store;
    const orchestrator = this._orchestrator;

    // detectStalledDeals — every 4 hours
    this.register({
      id: 'detectStalledDeals',
      name: 'Detect Stalled Deals',
      intervalMs: 4 * 60 * 60 * 1000,
      fn: async () => {
        const now = Date.now();
        for (const deal of (store.deals || [])) {
          if (deal.status !== 'active') continue;
          const daysSince = (now - new Date(deal.updatedAt || deal.createdAt).getTime()) / 86400000;
          if (daysSince >= 14) {
            await AutomationRuleEngine.fire('deal_stalled', { deal, daysSince: Math.round(daysSince) }, {
              notificationService: NotificationService,
              store,
              orchestrator,
              taskService: TaskService,
              uid: () => crypto.randomUUID(),
              nowIso: () => new Date().toISOString(),
            });
          }
        }
      },
    });

    // refreshDashboardMetrics — every 15 minutes
    this.register({
      id: 'refreshDashboardMetrics',
      name: 'Refresh Dashboard Metrics',
      intervalMs: 15 * 60 * 1000,
      fn: async () => {
        // Deterministic metric calculation — no AI
        const deals     = store.deals || [];
        const tasks     = store.tasks || [];
        const companies = store.companies || [];

        store._metrics = {
          activeDeals:       deals.filter((d) => d.status === 'active').length,
          totalCompanies:    companies.length,
          openTasks:         tasks.filter((t) => t.status !== 'done').length,
          overdueTasks:      TaskService.detectOverdue(tasks).length,
          updatedAt:         new Date().toISOString(),
        };
      },
    });

    // sweepCache — every hour
    this.register({
      id: 'sweepCache',
      name: 'Sweep Expired Cache',
      intervalMs: 60 * 60 * 1000,
      fn: async () => {
        const removed = CacheService.sweep();
        if (removed > 0) logger.info({ removed }, '[CacheService] Swept expired entries');
      },
    });

    // meetingReminders — every 5 minutes
    this.register({
      id: 'meetingReminders',
      name: 'Meeting Reminders',
      intervalMs: 5 * 60 * 1000,
      fn: async () => {
        const upcoming = (store.meetings || []).filter((m) => {
          if (m.status === 'cancelled' || m.status === 'completed') return false;
          const minsUntil = (new Date(m.startsAt) - Date.now()) / 60000;
          return minsUntil > 0 && minsUntil <= 60;
        });
        if (upcoming.length > 0) {
          await AutomationRuleEngine.fire('daily_tick', { upcomingMeetings: upcoming }, {
            notificationService: NotificationService,
            store,
            orchestrator,
            taskService: TaskService,
            uid: () => crypto.randomUUID(),
            nowIso: () => new Date().toISOString(),
          });
        }
      },
    });

    // dailyPipelineScan — every 6 hours (System 1)
    this.register({
      id: 'dailyPipelineScan',
      name: 'Daily Pipeline Pressure Scan',
      intervalMs: 6 * 60 * 60 * 1000,
      fn: async () => {
        PipelinePressureService.updatePressureLevels(store);
        const stalled = PipelinePressureService.scanForStalledEntities(store);
        const created = PipelinePressureService.createFollowUpTasks(
          stalled,
          store,
          () => crypto.randomUUID(),
          () => new Date().toISOString(),
        );
        if (created.length > 0) {
          logger.info({ count: created.length }, '[PipelinePressure] Created follow-up tasks for stalled entities');
        }
        // Notify if significant stall count
        const metrics = PipelinePressureService.getDashboardMetrics(store);
        if (metrics.stalledDealsCount > 0) {
          store.notifications = store.notifications || [];
          store.notifications.push(
            NotificationService.dealStalledNotification(
              { id: 'pipeline-scan', companyName: `${metrics.stalledDealsCount} deals` },
              Math.round(21)
            )
          );
        }
      },
    });

    // generateDailyBriefing — once per day at startup + 24h interval
    this.register({
      id: 'generateDailyBriefing',
      name: 'Generate Daily Briefing',
      intervalMs: 24 * 60 * 60 * 1000,
      fn: async () => {
        if (!store.settings?.aiBriefingEnabled) return;
        await orchestrator.run('DailyOperationsAgent', {
          pipeline: store.deals   || [],
          tasks:    store.tasks   || [],
          meetings: store.meetings || [],
          costFlags: store.settings,
        });
      },
    });
  }
}

export const BackgroundJobRunner = new BackgroundJobRunnerClass();
export default BackgroundJobRunner;
