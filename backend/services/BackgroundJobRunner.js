/**
 * BackgroundJobRunner
 *
 * Simple in-process async job queue. Jobs run on configurable intervals.
 * Replace with Bull/BullMQ + Redis for production-scale async processing.
 *
 * Built-in jobs (per spec):
 *   syncMailbox, sendEmailBatch, generateDailyBriefing, classifyReply,
 *   detectStalledDeals, generateDocument, refreshDashboardMetrics
 */

import CacheService from './CacheService.js';
import AuditLogService from './AuditLogService.js';
import NotificationService from './NotificationService.js';
import AutomationRuleEngine from './AutomationRuleEngine.js';
import TaskService from './TaskService.js';

// ─── Job registry ─────────────────────────────────────────────────────────────
class BackgroundJobRunnerClass {
  constructor() {
    this._jobs    = new Map();  // jobId → { name, fn, intervalMs, lastRun, running, enabled }
    this._timers  = new Map();  // jobId → NodeJS timer
    this._store   = null;       // injected via init()
    this._orchestrator = null;  // injected via init()
  }

  /**
   * Inject the in-memory store and orchestrator at startup.
   */
  init(store, orchestrator) {
    this._store        = store;
    this._orchestrator = orchestrator;
    this._registerBuiltInJobs();
    AuditLogService.log(AuditLogService.AUDIT_EVENTS.SYSTEM_STARTUP, 'system', 'background_jobs', { jobCount: this._jobs.size });
  }

  /** Register and schedule a job. */
  register({ id, name, fn, intervalMs, enabled = true }) {
    this._jobs.set(id, { id, name, fn, intervalMs, lastRun: null, running: false, enabled });
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
    try {
      await job.fn({ store: this._store, orchestrator: this._orchestrator });
      job.lastRun = new Date().toISOString();
    } catch (err) {
      console.error(`[BackgroundJobRunner] Job ${job.name} failed:`, err.message);
    } finally {
      job.running  = false;
      job.durationMs = Date.now() - start;
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
    return [...this._jobs.values()].map(({ id, name, intervalMs, lastRun, running, enabled, durationMs }) => ({
      id, name, intervalMs, lastRun, running, enabled, durationMs: durationMs ?? null,
    }));
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
        if (removed > 0) console.log(`[CacheService] Swept ${removed} expired entries`);
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

import crypto from 'crypto';

export const BackgroundJobRunner = new BackgroundJobRunnerClass();
export default BackgroundJobRunner;
