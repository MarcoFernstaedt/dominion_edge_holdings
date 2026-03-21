/**
 * ConversationMetricsService
 *
 * Tracks and aggregates the three critical acquisition conversation KPIs:
 *   1. Seller Conversations
 *   2. Board Conversations
 *   3. Investor Conversations
 *
 * Integrates with:
 *  - ExecutionTrackerService (updates dailyStats + weeklyStats conversation counts)
 *  - AutomationRuleEngine    (fires pipeline-risk alerts when thresholds breached)
 *  - AuditLogService         (immutable change log)
 *
 * All computation is deterministic — no AI calls.
 */

import crypto from 'crypto';
import AuditLogService from './AuditLogService.js';

// ─── Enumerations ─────────────────────────────────────────────────────────────

export const ENTITY_TYPES      = ['seller', 'board_member', 'investor'];
export const CONVERSATION_TYPES = ['phone', 'zoom', 'meeting', 'email_thread'];

// ─── Default weekly targets ───────────────────────────────────────────────────
// These can be overridden via the configurable targets API.

export const DEFAULT_WEEKLY_TARGETS = {
  seller:       5,
  board_member: 1,
  investor:     2,
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekStartIso(date = new Date()) {
  const d   = new Date(date);
  const day = d.getDay();                            // 0=Sun … 6=Sat
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function weekEndIso(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return new Date(date).toISOString().slice(0, 7); // 'YYYY-MM'
}

function sanitizeStr(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  return val.replace(/<[^>]*>/g, '').slice(0, maxLen).trim();
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ConversationMetricsService {
  init(store) {
    this._store = store;
    if (!Array.isArray(store.relationshipConversations)) store.relationshipConversations = [];
    if (!Array.isArray(store.conversationTargets))       store.conversationTargets       = [];
  }

  // ─── Targets ──────────────────────────────────────────────────────────────

  getTargets() {
    const overrides = {};
    for (const t of (this._store.conversationTargets || [])) {
      overrides[t.entityType] = t.weeklyTarget;
    }
    return {
      seller:       overrides.seller       ?? DEFAULT_WEEKLY_TARGETS.seller,
      board_member: overrides.board_member ?? DEFAULT_WEEKLY_TARGETS.board_member,
      investor:     overrides.investor     ?? DEFAULT_WEEKLY_TARGETS.investor,
    };
  }

  setTarget(entityType, weeklyTarget) {
    if (!ENTITY_TYPES.includes(entityType)) return null;
    const target = Math.max(0, Math.round(weeklyTarget));
    const existing = (this._store.conversationTargets || []).find(
      (t) => t.entityType === entityType
    );
    if (existing) {
      existing.weeklyTarget = target;
      existing.updatedAt    = new Date().toISOString();
    } else {
      this._store.conversationTargets = [
        ...(this._store.conversationTargets || []),
        { id: crypto.randomUUID(), entityType, weeklyTarget: target, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      ];
    }
    return this.getTargets();
  }

  // ─── Record ──────────────────────────────────────────────────────────────

  /**
   * Record a single conversation. Automatically updates Execution Tracker
   * daily + weekly stats after recording.
   */
  recordConversation(data, nowIso = new Date().toISOString()) {
    const entityType       = ENTITY_TYPES.includes(data.entityType) ? data.entityType : 'seller';
    const conversationType = CONVERSATION_TYPES.includes(data.conversationType) ? data.conversationType : 'phone';

    const conv = {
      id:                  crypto.randomUUID(),
      entityType,
      entityId:            sanitizeStr(data.entityId, 36),
      entityName:          sanitizeStr(data.entityName, 200),
      company:             sanitizeStr(data.company, 200),
      conversationType,
      conversationSummary: sanitizeStr(data.conversationSummary, 2000),
      date:                data.date ? data.date.slice(0, 10) : nowIso.slice(0, 10),
      createdAt:           nowIso,
      updatedAt:           nowIso,
    };

    this._store.relationshipConversations = [
      conv,
      ...(this._store.relationshipConversations || []),
    ];

    // Keep collection bounded to prevent memory bloat
    if (this._store.relationshipConversations.length > 5000) {
      this._store.relationshipConversations = this._store.relationshipConversations.slice(0, 5000);
    }

    // Update Execution Tracker stats
    this._syncToExecutionTracker(conv.date, nowIso);

    AuditLogService.log('conversation.recorded', 'conversation', conv.id, {
      entityType, entityName: conv.entityName, conversationType,
    });

    return conv;
  }

  updateConversation(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.relationshipConversations || []).findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = this._store.relationshipConversations[idx];
    const allowed  = ['conversationType', 'conversationSummary', 'date', 'entityName', 'company'];
    const cleaned  = { ...existing };
    for (const key of allowed) {
      if (patch[key] === undefined) continue;
      if (key === 'conversationType' && !CONVERSATION_TYPES.includes(patch[key])) continue;
      cleaned[key] = key === 'date' ? patch[key].slice(0, 10) : sanitizeStr(patch[key]);
    }
    cleaned.updatedAt = nowIso;
    this._store.relationshipConversations[idx] = cleaned;
    return cleaned;
  }

  deleteConversation(id) {
    const before = (this._store.relationshipConversations || []).length;
    this._store.relationshipConversations = (this._store.relationshipConversations || [])
      .filter((c) => c.id !== id);
    return (this._store.relationshipConversations || []).length < before;
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  /**
   * List conversations with optional filters.
   */
  listConversations({
    entityType,
    conversationType,
    search,
    dateFrom,
    dateTo,
    sortDir = 'desc',
    page    = 1,
    pageSize = 50,
  } = {}) {
    let items = [...(this._store.relationshipConversations || [])];

    if (entityType       && ENTITY_TYPES.includes(entityType))
      items = items.filter((c) => c.entityType === entityType);
    if (conversationType && CONVERSATION_TYPES.includes(conversationType))
      items = items.filter((c) => c.conversationType === conversationType);
    if (dateFrom) items = items.filter((c) => c.date >= dateFrom.slice(0, 10));
    if (dateTo)   items = items.filter((c) => c.date <= dateTo.slice(0, 10));
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((c) =>
        (c.entityName || '').toLowerCase().includes(q) ||
        (c.company    || '').toLowerCase().includes(q) ||
        (c.conversationSummary || '').toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => {
      const cmp = (a.date || '').localeCompare(b.date || '');
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const total = items.length;
    const ps    = Math.min(Math.max(1, pageSize), 100);
    const pg    = Math.max(1, page);
    return {
      conversations: items.slice((pg - 1) * ps, pg * ps),
      total,
      page: pg,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  // ─── Weekly aggregates ────────────────────────────────────────────────────

  getWeeklySellerConversations(weekStart = weekStartIso()) {
    return this._countByWeekAndType(weekStart, 'seller');
  }

  getWeeklyBoardConversations(weekStart = weekStartIso()) {
    return this._countByWeekAndType(weekStart, 'board_member');
  }

  getWeeklyInvestorConversations(weekStart = weekStartIso()) {
    return this._countByWeekAndType(weekStart, 'investor');
  }

  _countByWeekAndType(weekStart, entityType) {
    const end = weekEndIso(weekStart);
    return (this._store.relationshipConversations || []).filter((c) =>
      c.entityType === entityType &&
      c.date >= weekStart &&
      c.date <  end
    ).length;
  }

  // ─── Monthly aggregates ───────────────────────────────────────────────────

  getMonthlyConversationCounts(month = monthKey()) {
    const items = (this._store.relationshipConversations || []).filter((c) =>
      c.date.slice(0, 7) === month
    );
    return {
      month,
      seller:       items.filter((c) => c.entityType === 'seller').length,
      board_member: items.filter((c) => c.entityType === 'board_member').length,
      investor:     items.filter((c) => c.entityType === 'investor').length,
      total:        items.length,
    };
  }

  // ─── KPI status (current week vs targets) ─────────────────────────────────

  /**
   * Returns current week KPI status with progress, target, and status flag.
   * Used by the dashboard widget and agent context.
   */
  getKPIStatus(weekStart = weekStartIso()) {
    const targets = this.getTargets();
    const seller       = this.getWeeklySellerConversations(weekStart);
    const boardMember  = this.getWeeklyBoardConversations(weekStart);
    const investor     = this.getWeeklyInvestorConversations(weekStart);

    const kpi = (type, count, target) => ({
      entityType: type,
      count,
      target,
      pct:     target > 0 ? Math.min(100, Math.round((count / target) * 100)) : 100,
      status:  count >= target ? 'on_target' : count >= Math.ceil(target / 2) ? 'at_risk' : 'below_target',
    });

    const items = [
      kpi('seller',       seller,      targets.seller),
      kpi('board_member', boardMember, targets.board_member),
      kpi('investor',     investor,    targets.investor),
    ];

    return {
      weekStart,
      items,
      overallStatus: items.every((k) => k.status === 'on_target')
        ? 'on_target'
        : items.some((k) => k.status === 'below_target')
        ? 'below_target'
        : 'at_risk',
    };
  }

  // ─── Trend calculation ─────────────────────────────────────────────────────

  /**
   * Returns conversation counts for the last N weeks, used for trend charts.
   * @param {number} weeksBack
   */
  calculateConversationTrends(weeksBack = 8) {
    const weeks = [];
    for (let i = weeksBack - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const ws = weekStartIso(d);
      weeks.push({
        weekStart:    ws,
        seller:       this.getWeeklySellerConversations(ws),
        board_member: this.getWeeklyBoardConversations(ws),
        investor:     this.getWeeklyInvestorConversations(ws),
      });
    }
    return weeks;
  }

  // ─── Pipeline health alerts ───────────────────────────────────────────────

  /**
   * Returns active pipeline health alerts based on threshold rules:
   *   - seller < 3/week  → deal pipeline risk
   *   - board = 0/30d    → board engagement risk
   *   - investor < 1/30d → capital pipeline risk
   */
  getPipelineHealthAlerts() {
    const alerts   = [];
    const weekStart = weekStartIso();
    const targets   = this.getTargets();

    // Rule 1: seller conversations < 3 this week
    const weekSeller = this.getWeeklySellerConversations(weekStart);
    if (weekSeller < 3) {
      alerts.push({
        id:       'deal_pipeline_risk',
        severity: weekSeller === 0 ? 'critical' : 'warning',
        title:    'Deal Pipeline Risk',
        message:  `Only ${weekSeller} seller conversation${weekSeller === 1 ? '' : 's'} logged this week (minimum 3). Deal pipeline is at risk.`,
        type:     'seller',
        action:   'Schedule owner calls immediately.',
      });
    }

    // Rule 2: board = 0 for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);
    const boardLast30 = (this._store.relationshipConversations || []).filter((c) =>
      c.entityType === 'board_member' && c.date >= thirtyAgoStr
    ).length;
    if (boardLast30 === 0) {
      alerts.push({
        id:       'board_engagement_risk',
        severity: 'warning',
        title:    'Board Engagement Risk',
        message:  'No board member conversations logged in the last 30 days. Board engagement has stalled.',
        type:     'board_member',
        action:   'Reach out to board candidates this week.',
      });
    }

    // Rule 3: investor < 1 for last 30 days
    const investorLast30 = (this._store.relationshipConversations || []).filter((c) =>
      c.entityType === 'investor' && c.date >= thirtyAgoStr
    ).length;
    if (investorLast30 < 1) {
      alerts.push({
        id:       'capital_pipeline_risk',
        severity: 'warning',
        title:    'Capital Pipeline Risk',
        message:  'No investor conversations logged in the last 30 days. Capital pipeline may stall.',
        type:     'investor',
        action:   'Schedule investor introductions this week.',
      });
    }

    return alerts;
  }

  // ─── Weekly report ────────────────────────────────────────────────────────

  /**
   * Full weekly report for display + agent context.
   */
  getWeeklyReport(weekStart = weekStartIso()) {
    const kpi     = this.getKPIStatus(weekStart);
    const monthly = this.getMonthlyConversationCounts();
    const alerts  = this.getPipelineHealthAlerts();

    // Conversion to opportunities: deals with stage > 'identified' created this week
    const weekEnd = weekEndIso(weekStart);
    const newOpportunities = (this._store.deals || []).filter((d) => {
      const created = d.createdAt?.slice(0, 10) || '';
      return created >= weekStart && created < weekEnd &&
             d.stage && !['identified'].includes(d.stage);
    }).length;

    const dealsClosed = (this._store.deals || []).filter((d) => {
      const updated = d.updatedAt?.slice(0, 10) || '';
      return updated >= weekStart && updated < weekEnd && d.stage === 'closed';
    }).length;

    return {
      weekStart,
      kpi,
      monthly,
      alerts,
      conversions: {
        toOpportunities: newOpportunities,
        toDeals:         dealsClosed,
      },
    };
  }

  // ─── Agent context ────────────────────────────────────────────────────────

  /**
   * Returns a structured context object for the DailyOperationsAgent.
   * Summarises KPI progress, gap to target, and recommended actions.
   */
  getAgentContext() {
    const kpi    = this.getKPIStatus();
    const alerts = this.getPipelineHealthAlerts();
    const targets = this.getTargets();

    const actions = [];
    for (const item of kpi.items) {
      if (item.status !== 'on_target') {
        const gap = item.target - item.count;
        if (item.entityType === 'seller')       actions.push(`Schedule ${gap} more owner call${gap > 1 ? 's' : ''} this week.`);
        if (item.entityType === 'board_member') actions.push(`Reach out to ${gap} more board candidate${gap > 1 ? 's' : ''} this week.`);
        if (item.entityType === 'investor')     actions.push(`Log ${gap} more investor conversation${gap > 1 ? 's' : ''} this week.`);
      }
    }

    return {
      kpi,
      alerts: alerts.map((a) => ({ severity: a.severity, title: a.title, message: a.message })),
      recommendedActions: actions,
      targets,
    };
  }

  // ─── Execution Tracker sync ───────────────────────────────────────────────

  /**
   * After recording a conversation, sync counts into ExecutionTracker
   * dailyStats and weeklyStats fields.
   */
  _syncToExecutionTracker(date, nowIso) {
    const wStart  = weekStartIso(new Date(date));
    const wEnd    = weekEndIso(wStart);
    const convAll = this._store.relationshipConversations || [];

    // Daily counts
    const daySeller  = convAll.filter((c) => c.date === date && c.entityType === 'seller').length;
    const dayBoard   = convAll.filter((c) => c.date === date && c.entityType === 'board_member').length;
    const dayInvest  = convAll.filter((c) => c.date === date && c.entityType === 'investor').length;

    const daily = this._store.executionDailyStats || [];
    const dayStat = daily.find((s) => s.date === date);
    if (dayStat) {
      dayStat.sellerConversations    = daySeller;
      dayStat.boardConversations     = dayBoard;
      dayStat.investorConversations  = dayInvest;
      dayStat.updatedAt              = nowIso;
    }

    // Weekly counts
    const weekSeller  = convAll.filter((c) => c.date >= wStart && c.date < wEnd && c.entityType === 'seller').length;
    const weekBoard   = convAll.filter((c) => c.date >= wStart && c.date < wEnd && c.entityType === 'board_member').length;
    const weekInvest  = convAll.filter((c) => c.date >= wStart && c.date < wEnd && c.entityType === 'investor').length;

    const weekly = this._store.executionWeeklyStats || [];
    const weekStat = weekly.find((s) => s.weekStartDate === wStart);
    if (weekStat) {
      weekStat.sellerConversations   = weekSeller;
      weekStat.boardConversations    = weekBoard;
      weekStat.investorConversations = weekInvest;
      weekStat.updatedAt             = nowIso;
    } else {
      this._store.executionWeeklyStats = [
        {
          id: crypto.randomUUID(),
          weekStartDate:         wStart,
          sellerConversations:   weekSeller,
          boardConversations:    weekBoard,
          investorConversations: weekInvest,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...weekly,
      ];
    }
  }

  // ─── Constants for external use ──────────────────────────────────────────
  static get ENTITY_TYPES()       { return ENTITY_TYPES; }
  static get CONVERSATION_TYPES() { return CONVERSATION_TYPES; }
  static get DEFAULT_TARGETS()    { return DEFAULT_WEEKLY_TARGETS; }
}

export default new ConversationMetricsService();
