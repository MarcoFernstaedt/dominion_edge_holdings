/**
 * PlaybookService
 * Guides the operator step-by-step through the 17-stage acquisition lifecycle.
 *
 * Stage completion is evaluated from:
 *   - Manual task completion (playbookProgress)
 *   - Platform metrics (companies, deals, investors, board, meetings)
 *
 * All methods are synchronous and deterministic.
 */

import crypto from 'crypto';
import { PLAYBOOK_STAGES, PLAYBOOK_TASKS } from '../data/playbookSeed.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }

function taskProgress(store, taskId) {
  return (store.playbookProgress || []).find((p) => p.taskId === taskId) || null;
}

function taskStatus(store, taskId) {
  return taskProgress(store, taskId)?.status || 'not_started';
}

/**
 * Auto-complete check for 'automatic' tasks.
 * Returns true if the platform data satisfies the task's auto-completion condition.
 */
function isAutoComplete(task, store) {
  switch (task.id) {
    // Board seats defined
    case 'task-06-01':
      return (store.boardSeats || []).length >= 3;
    // 10+ board candidates identified
    case 'task-06-02':
      return (store.boardCandidates || []).length >= 10;
    // Board meeting scheduled
    case 'task-06-04':
      return (store.boardCandidates || []).filter((c) =>
        ['meeting_scheduled', 'interested', 'negotiating', 'confirmed'].includes(c.status)
      ).length >= 3;
    // Board member confirmed
    case 'task-06-05':
      return (store.boardCandidates || []).some((c) => c.status === 'confirmed') ||
             (store.boardSeats || []).some((s) => s.status === 'filled');
    // 25 investors in CRM
    case 'task-07-01':
      return (store.investors || []).length >= 25;
    // 5 investor meetings
    case 'task-07-03':
      return (store.investors || []).filter((i) =>
        ['relationship', 'active_investor'].includes(i.relationshipStage)
      ).length >= 5;
    // Capital stack built
    case 'task-07-04':
      return (store.capitalStacks || []).length >= 1;
    // Pitch deck generated
    case 'task-07-05':
      return (store.pitchDecks || []).length >= 1;
    // 100 companies in CRM
    case 'task-08-01':
      return (store.companies || []).length >= 100;
    // Outreach templates set up
    case 'task-08-02':
      return (store.outreachTemplates || []).length >= 2;
    // 20 owners contacted
    case 'task-08-03':
      return (store.companies || []).filter((c) =>
        c.sellerConversationStatus !== 'not_contacted' && c.lastInteractionAt
      ).length >= 20;
    // 5 meetings
    case 'task-09-01':
      return (store.meetings || []).length >= 5;
    // CRM interactions logged
    case 'task-09-02':
      return (store.interactions || []).filter((i) => i.conversationSummary).length >= 5;
    // 3 serious deal opportunities
    case 'task-09-03':
    case 'task-10-05':
      return (store.deals || []).filter((d) =>
        !['identified', 'contacted'].includes(d.stage)
      ).length >= 1;
    // Underwriting scenarios
    case 'task-10-01':
      return (store.underwritingScenarios || []).length >= 1;
    // Multiple underwriting scenarios (bear/base/bull)
    case 'task-10-02':
      return (store.underwritingScenarios || []).length >= 2;
    // LOI document sent
    case 'task-11-02':
      return (store.documents || []).some((d) =>
        d.documentType === 'loi' || d.title?.toLowerCase().includes('loi')
      ) || (store.interactions || []).some((i) => i.interactionType === 'loi');
    // LOI signed = deal in loi_signed stage or beyond
    case 'task-11-04':
      return (store.deals || []).some((d) =>
        ['loi_signed', 'due_diligence', 'financing', 'closing', 'closed'].includes(d.stage)
      );
    // Deal closed
    case 'task-14-05':
      return (store.deals || []).some((d) => d.stage === 'closed');
    // Repeat: second deal
    case 'task-17-04':
      return (store.deals || []).filter((d) => d.stage === 'closed').length >= 2;
    // Mission statement written
    case 'task-02-03':
      return (store.firmMessaging || []).some((f) => f.missionStatement);
    // Pitch deck (branding)
    case 'task-05-03':
      return (store.pitchDecks || []).length >= 1;

    default:
      return false;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class PlaybookService {
  init(store) {
    this._store = store;

    // Initialize collections
    if (!Array.isArray(store.playbookStages))   store.playbookStages   = [];
    if (!Array.isArray(store.playbookTasks))    store.playbookTasks    = [];
    if (!Array.isArray(store.playbookProgress)) store.playbookProgress = [];

    // Seed stages and tasks if empty
    if (store.playbookStages.length === 0) {
      const ts = nowIso();
      store.playbookStages = PLAYBOOK_STAGES.map((s) => ({ ...s, createdAt: ts, updatedAt: ts }));
    }
    if (store.playbookTasks.length === 0) {
      const ts = nowIso();
      store.playbookTasks = PLAYBOOK_TASKS.map((t) => ({ ...t, createdAt: ts, updatedAt: ts }));
    }
  }

  // ─── Stage queries ─────────────────────────────────────────────────────────

  getStages() {
    return [...(this._store.playbookStages || [])].sort((a, b) => a.stageOrder - b.stageOrder);
  }

  getStage(stageId) {
    return (this._store.playbookStages || []).find((s) => s.id === stageId) || null;
  }

  getTasksForStage(stageId) {
    return (this._store.playbookTasks || [])
      .filter((t) => t.stageId === stageId)
      .sort((a, b) => a.taskOrder - b.taskOrder);
  }

  // ─── Progress queries ──────────────────────────────────────────────────────

  getProgressForTask(taskId) {
    return taskProgress(this._store, taskId);
  }

  getProgressForStage(stageId) {
    const tasks = this.getTasksForStage(stageId);
    const store = this._store;

    return tasks.map((task) => {
      const p       = taskProgress(store, task.id);
      const autoOk  = task.completionType === 'automatic' && isAutoComplete(task, store);
      const status  = p?.status || (autoOk ? 'completed' : 'not_started');
      return { task, status, completedAt: p?.completedAt || null, notes: p?.notes || null };
    });
  }

  /**
   * Evaluate whether a stage is complete using both task completion and metric requirements.
   */
  evaluateStageCompletion(stageId) {
    const stage = this.getStage(stageId);
    if (!stage) return { complete: false, reason: 'Stage not found' };

    const progress  = this.getProgressForStage(stageId);
    const tasks     = progress.length;
    const completed = progress.filter((p) => p.status === 'completed' || p.status === 'skipped').length;
    const taskPct   = tasks > 0 ? completed / tasks : 0;

    // Check metric requirements
    const metricsMet = this._checkMetricRequirements(stage);

    if (stage.completionMode === 'tasks') {
      const complete = taskPct >= 0.8; // 80% of tasks complete
      return { complete, taskPct, completed, tasks, metricsMet };
    }

    if (stage.completionMode === 'metrics') {
      return { complete: metricsMet.allMet, taskPct, completed, tasks, metricsMet };
    }

    // hybrid: tasks AND metrics
    const taskOk   = taskPct >= 0.6;
    const complete = taskOk && metricsMet.allMet;
    return { complete, taskPct, completed, tasks, metricsMet };
  }

  _checkMetricRequirements(stage) {
    const req = stage.metricRequirements;
    if (!req) return { allMet: true, requirements: [] };

    const store = this._store;
    const checks = [];

    if (req.boardCandidatesIdentified !== undefined) {
      const actual = (store.boardCandidates || []).length;
      checks.push({ label: 'Board candidates identified', actual, required: req.boardCandidatesIdentified, met: actual >= req.boardCandidatesIdentified });
    }
    if (req.boardConversationsLogged !== undefined) {
      const actual = (store.boardCandidates || []).filter((c) =>
        ['meeting_scheduled', 'interested', 'negotiating', 'confirmed'].includes(c.status)
      ).length;
      checks.push({ label: 'Board conversations', actual, required: req.boardConversationsLogged, met: actual >= req.boardConversationsLogged });
    }
    if (req.investorsIdentified !== undefined) {
      const actual = (store.investors || []).length;
      checks.push({ label: 'Investors identified', actual, required: req.investorsIdentified, met: actual >= req.investorsIdentified });
    }
    if (req.companiesAdded !== undefined) {
      const actual = (store.companies || []).length;
      checks.push({ label: 'Companies added', actual, required: req.companiesAdded, met: actual >= req.companiesAdded });
    }
    if (req.ownersContacted !== undefined) {
      const actual = (store.companies || []).filter((c) =>
        c.sellerConversationStatus !== 'not_contacted' && c.lastInteractionAt
      ).length;
      checks.push({ label: 'Owners contacted', actual, required: req.ownersContacted, met: actual >= req.ownersContacted });
    }
    if (req.ownerConversations !== undefined) {
      const actual = (store.interactions || []).filter((i) => i.conversationSummary).length;
      checks.push({ label: 'Owner conversations', actual, required: req.ownerConversations, met: actual >= req.ownerConversations });
    }
    if (req.meetingsScheduled !== undefined) {
      const actual = (store.meetings || []).length;
      checks.push({ label: 'Meetings scheduled', actual, required: req.meetingsScheduled, met: actual >= req.meetingsScheduled });
    }
    if (req.seriousOpportunities !== undefined) {
      const actual = (store.deals || []).filter((d) =>
        ['financial_review', 'loi_discussion', 'loi_signed', 'due_diligence', 'financing', 'closing', 'closed'].includes(d.stage)
      ).length;
      checks.push({ label: 'Serious opportunities', actual, required: req.seriousOpportunities, met: actual >= req.seriousOpportunities });
    }
    if (req.loisSent !== undefined) {
      const actual = (store.deals || []).filter((d) =>
        ['loi_signed', 'due_diligence', 'financing', 'closing', 'closed'].includes(d.stage)
      ).length;
      checks.push({ label: 'LOIs sent', actual, required: req.loisSent, met: actual >= req.loisSent });
    }

    return { allMet: checks.every((c) => c.met), requirements: checks };
  }

  // ─── Current stage ─────────────────────────────────────────────────────────

  /**
   * The current stage is the earliest stage that is not yet complete.
   * Returns { stage, stageProgress, completion } or the last stage if all complete.
   */
  getCurrentStage() {
    const stages = this.getStages();
    for (const stage of stages) {
      const completion = this.evaluateStageCompletion(stage.id);
      if (!completion.complete) {
        const stageProgress = this.getProgressForStage(stage.id);
        return { stage, stageProgress, completion };
      }
    }
    // All stages complete — return last stage
    const last = stages[stages.length - 1];
    return {
      stage:         last,
      stageProgress: this.getProgressForStage(last.id),
      completion:    this.evaluateStageCompletion(last.id),
      allComplete:   true,
    };
  }

  // ─── Next tasks ────────────────────────────────────────────────────────────

  /**
   * Returns the next N incomplete tasks from the current and upcoming stages.
   */
  getNextTasks(limit = 5) {
    const stages = this.getStages();
    const results = [];

    for (const stage of stages) {
      if (results.length >= limit) break;
      const progress = this.getProgressForStage(stage.id);
      const incomplete = progress.filter((p) => !['completed', 'skipped'].includes(p.status));
      for (const item of incomplete) {
        if (results.length >= limit) break;
        results.push({ ...item, stage });
      }
    }

    return results;
  }

  // ─── Task mutation ─────────────────────────────────────────────────────────

  markTaskComplete(taskId, notes = '') {
    const ts = nowIso();
    const existing = (this._store.playbookProgress || []).find((p) => p.taskId === taskId);
    if (existing) {
      existing.status      = 'completed';
      existing.completedAt = ts;
      existing.notes       = notes || existing.notes;
      existing.updatedAt   = ts;
      return existing;
    }
    const record = {
      id:          crypto.randomUUID(),
      taskId,
      status:      'completed',
      completedAt: ts,
      notes,
      createdAt:   ts,
      updatedAt:   ts,
    };
    this._store.playbookProgress = [record, ...(this._store.playbookProgress || [])];
    return record;
  }

  updateTaskStatus(taskId, status, notes = '') {
    const VALID = ['not_started', 'in_progress', 'completed', 'skipped'];
    if (!VALID.includes(status)) throw new Error(`Invalid status: ${status}`);

    const ts = nowIso();
    const existing = (this._store.playbookProgress || []).find((p) => p.taskId === taskId);
    if (existing) {
      existing.status      = status;
      existing.notes       = notes || existing.notes;
      existing.updatedAt   = ts;
      if (status === 'completed') existing.completedAt = ts;
      return existing;
    }
    const record = {
      id:          crypto.randomUUID(),
      taskId,
      status,
      completedAt: status === 'completed' ? ts : null,
      notes,
      createdAt:   ts,
      updatedAt:   ts,
    };
    this._store.playbookProgress = [record, ...(this._store.playbookProgress || [])];
    return record;
  }

  // ─── Stage advancement ─────────────────────────────────────────────────────

  advanceStage() {
    const { stage, completion } = this.getCurrentStage();
    if (!completion.complete) {
      return { advanced: false, reason: 'Current stage not complete', stage };
    }
    const stages   = this.getStages();
    const idx      = stages.findIndex((s) => s.id === stage.id);
    const nextStage = stages[idx + 1] || null;
    if (!nextStage) return { advanced: false, reason: 'Already at final stage', stage };
    return { advanced: true, previousStage: stage, currentStage: nextStage };
  }

  // ─── Daily actions ─────────────────────────────────────────────────────────

  /**
   * Generate today's recommended actions from:
   * 1. Next incomplete playbook tasks
   * 2. Platform metric signals (stalled deals, low outreach, etc.)
   */
  generateDailyActions(executionSummary = null) {
    const { stage } = this.getCurrentStage();
    const nextTasks = this.getNextTasks(5);
    const actions   = [];

    // From playbook tasks
    for (const item of nextTasks) {
      actions.push({
        source:      'playbook',
        priority:    item.status === 'in_progress' ? 'high' : 'medium',
        title:       item.task.taskTitle,
        description: item.task.taskDescription,
        taskId:      item.task.id,
        stageId:     item.stage.id,
        stageName:   item.stage.stageName,
        effortMin:   item.task.estimatedEffortMinutes,
      });
    }

    // From execution alerts
    if (executionSummary?.alerts) {
      for (const alert of executionSummary.alerts.slice(0, 3)) {
        actions.push({
          source:      'execution',
          priority:    alert.level === 'critical' ? 'high' : 'medium',
          title:       alert.message,
          description: 'Review execution metrics and take corrective action.',
          taskId:      null,
          stageId:     null,
          stageName:   null,
        });
      }
    }

    // From deal momentum — stalled / cooling
    if (executionSummary?.momentum) {
      const urgent = executionSummary.momentum.filter((m) =>
        m.riskLevel === 'stalled' || m.riskLevel === 'cooling'
      ).slice(0, 2);
      for (const m of urgent) {
        actions.push({
          source:      'momentum',
          priority:    m.riskLevel === 'stalled' ? 'critical' : 'high',
          title:       m.nextActionRequired,
          description: `${m.companyName} — ${m.daysSinceLastContact ?? '?'} days since last contact. Momentum score: ${m.momentumScore}/100.`,
          taskId:      null,
          stageId:     null,
          stageName:   null,
          dealId:      m.dealId,
        });
      }
    }

    // Stage-specific quick actions
    const stageActions = this._getStageQuickActions(stage);
    for (const a of stageActions) {
      if (!actions.some((x) => x.title === a.title)) {
        actions.push(a);
      }
    }

    // Sort: critical → high → medium
    const ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
    return {
      stageName:      stage.stageName,
      stageId:        stage.id,
      actions:        actions.sort((a, b) => (ORDER[a.priority] || 2) - (ORDER[b.priority] || 2)).slice(0, 10),
      generatedAt:    nowIso(),
    };
  }

  _getStageQuickActions(stage) {
    const stageActions = {
      'stage-06': [
        { source: 'stage', priority: 'medium', title: 'Review board candidate list', description: 'Check your board candidate pipeline and identify the next person to contact.', taskId: null, stageId: stage.id, stageName: stage.stageName },
      ],
      'stage-07': [
        { source: 'stage', priority: 'medium', title: 'Follow up with an investor', description: 'Review your investor CRM and send a follow-up to a warm contact.', taskId: null, stageId: stage.id, stageName: stage.stageName },
      ],
      'stage-08': [
        { source: 'stage', priority: 'high', title: 'Contact 10 new owners today', description: 'Hit your daily outreach target. Call, email, or LinkedIn message 10 owners.', taskId: null, stageId: stage.id, stageName: stage.stageName },
        { source: 'stage', priority: 'medium', title: 'Add 10 companies to pipeline', description: 'Identify and add 10 new companies to the CRM target list.', taskId: null, stageId: stage.id, stageName: stage.stageName },
      ],
      'stage-09': [
        { source: 'stage', priority: 'high', title: 'Follow up with 3 sellers', description: 'Review your pipeline and follow up with sellers you haven\'t contacted this week.', taskId: null, stageId: stage.id, stageName: stage.stageName },
      ],
      'stage-10': [
        { source: 'stage', priority: 'high', title: 'Review deal underwriting', description: 'Open the top deal and run updated underwriting scenarios.', taskId: null, stageId: stage.id, stageName: stage.stageName },
      ],
      'stage-11': [
        { source: 'stage', priority: 'critical', title: 'Advance LOI process', description: 'Check LOI status and take the next action to move it forward.', taskId: null, stageId: stage.id, stageName: stage.stageName },
      ],
    };
    return stageActions[stage.id] || [];
  }

  // ─── Summary for dashboard widget ─────────────────────────────────────────

  getPlaybookSummary() {
    const { stage, completion, allComplete } = this.getCurrentStage();
    const stages  = this.getStages();
    const nextTasks = this.getNextTasks(3);

    const stagesCompleted = stages.filter((s) => {
      const c = this.evaluateStageCompletion(s.id);
      return c.complete;
    }).length;

    return {
      currentStage:   stage,
      stagesCompleted,
      totalStages:    stages.length,
      completion,
      allComplete:    !!allComplete,
      nextTasks,
      overallProgress: Math.round((stagesCompleted / stages.length) * 100),
    };
  }

  // ─── Auto-update task progress from platform events ────────────────────────

  /**
   * Called after platform events to refresh automatic task completions.
   * Marks auto-completable tasks as complete if conditions are now met.
   */
  syncAutomaticTasks() {
    const tasks = this._store.playbookTasks || [];
    const autoTasks = tasks.filter((t) => t.completionType === 'automatic' || t.completionType === 'hybrid');
    let synced = 0;

    for (const task of autoTasks) {
      if (isAutoComplete(task, this._store)) {
        const existing = (this._store.playbookProgress || []).find((p) => p.taskId === task.id);
        if (!existing || existing.status !== 'completed') {
          this.markTaskComplete(task.id, 'Auto-completed by platform');
          synced++;
        }
      }
    }

    return synced;
  }
}

export default new PlaybookService();
