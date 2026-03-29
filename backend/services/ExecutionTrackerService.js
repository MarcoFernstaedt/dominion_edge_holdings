/**
 * ExecutionTrackerService
 * Converts QLA execution checklist into measurable operational data.
 *
 * Aggregates from: companies, contacts, interactions, deals, meetings,
 * boardCandidates, investors (capital raising module).
 *
 * All computation is deterministic — no AI dependency.
 */

import crypto from 'crypto';

// ─── QLA Default Targets ──────────────────────────────────────────────────────

const DEFAULT_TARGETS = {
  daily_owner_calls:        20,
  weekly_owner_contacts:   100,
  weekly_investor_calls:     3,
  monthly_lois:              3,
  pipeline_companies:      500,
  // Pipeline funnel targets
  pipeline_owners_contacted: 200,
  pipeline_conversations:    50,
  pipeline_opportunities:    10,
  pipeline_lois:              3,
  pipeline_closed:            1,
  // Board
  board_target_min:           5,
  board_target_max:           7,
  // Investors
  investor_identified_min:   50,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayDate() {
  return new Date().toISOString().split('T')[0];
}

function weekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7); // 'YYYY-MM'
}

function daysBetween(isoA, isoB = new Date().toISOString()) {
  if (!isoA) return null;
  return Math.floor((new Date(isoB) - new Date(isoA)) / (1000 * 60 * 60 * 24));
}

function isToday(isoStr) {
  if (!isoStr) return false;
  return isoStr.slice(0, 10) === todayDate();
}

function isThisWeek(isoStr) {
  if (!isoStr) return false;
  return isoStr.slice(0, 10) >= weekStartDate();
}

function isThisMonth(isoStr) {
  if (!isoStr) return false;
  return isoStr.slice(0, 7) === monthKey();
}

function momentumScore(daysSinceContact, daysSinceMeeting, interactionCount) {
  let score = 100;
  const dc = daysSinceContact ?? 999;
  const dm = daysSinceMeeting ?? 999;

  // Penalise by days since contact
  if (dc <= 3)       score -= 0;
  else if (dc <= 7)  score -= 10;
  else if (dc <= 14) score -= 25;
  else if (dc <= 30) score -= 45;
  else               score -= 70;

  // Penalise by days since meeting
  if (dm <= 7)        score -= 0;
  else if (dm <= 21)  score -= 5;
  else if (dm <= 60)  score -= 10;
  else                score -= 20;

  // Boost by interaction count
  if (interactionCount >= 10) score += 10;
  else if (interactionCount >= 5) score += 5;

  return Math.max(0, Math.min(100, score));
}

function riskLevel(daysSinceContact) {
  const d = daysSinceContact ?? 999;
  if (d <= 7)  return 'healthy';
  if (d <= 14) return 'warming';
  if (d <= 30) return 'cooling';
  return 'stalled';
}

function nextAction(risk, deal) {
  if (risk === 'stalled')  return `Urgent: Re-engage owner for ${deal.companyName}`;
  if (risk === 'cooling')  return `Follow up with ${deal.companyName} owner this week`;
  if (risk === 'warming')  return `Schedule next touchpoint with ${deal.companyName}`;
  return `Continue momentum with ${deal.companyName}`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class ExecutionTrackerService {
  init(store) {
    this._store = store;
    // Ensure collections exist
    if (!Array.isArray(store.executionDailyStats))   store.executionDailyStats   = [];
    if (!Array.isArray(store.executionWeeklyStats))  store.executionWeeklyStats  = [];
    if (!Array.isArray(store.executionMonthlyStats)) store.executionMonthlyStats = [];
    if (!Array.isArray(store.qlaTargets))            store.qlaTargets            = [];
    if (!Array.isArray(store.dealMomentumStats))     store.dealMomentumStats     = [];
  }

  // ─── Targets ────────────────────────────────────────────────────────────────

  getTargets() {
    const overrides = {};
    (this._store.qlaTargets || []).forEach((t) => { overrides[t.targetType] = t.targetValue; });
    return { ...DEFAULT_TARGETS, ...overrides };
  }

  setTarget(targetType, targetValue, period = 'ongoing') {
    const existing = (this._store.qlaTargets || []).find((t) => t.targetType === targetType);
    if (existing) {
      existing.targetValue = targetValue;
      existing.period = period;
    } else {
      this._store.qlaTargets.push({
        id: crypto.randomUUID(),
        targetType,
        targetValue,
        period,
      });
    }
    return this.getTargets();
  }

  // ─── Daily Stats ────────────────────────────────────────────────────────────

  /**
   * Get or create today's daily stat record.
   */
  getTodayStats() {
    const today = todayDate();
    let stat = (this._store.executionDailyStats || []).find((s) => s.date === today);
    if (!stat) {
      stat = this._buildComputedDailyStat(today);
      this._store.executionDailyStats = [stat, ...this._store.executionDailyStats];
    } else {
      // Re-compute live fields (computed ones) and merge with manual overrides
      const fresh = this._buildComputedDailyStat(today);
      // Only overwrite computed fields; preserve manually entered fields
      stat = { ...fresh, ...this._pickManualFields(stat) };
      const idx = this._store.executionDailyStats.findIndex((s) => s.date === today);
      this._store.executionDailyStats[idx] = stat;
    }
    return stat;
  }

  _pickManualFields(stat) {
    // Manual fields that override computed values when user has entered them
    const manual = {};
    if (stat._manualOwnersCalled      !== undefined) manual.ownersCalled      = stat.ownersCalled;
    if (stat._manualOwnersLinkedIn    !== undefined) manual.ownersLinkedIn    = stat.ownersLinkedIn;
    if (stat._manualInvestorConversations !== undefined) manual.investorConversations = stat.investorConversations;
    manual._manualOwnersCalled         = stat._manualOwnersCalled;
    manual._manualOwnersLinkedIn       = stat._manualOwnersLinkedIn;
    manual._manualInvestorConversations= stat._manualInvestorConversations;
    return manual;
  }

  _buildComputedDailyStat(date) {
    const now   = new Date().toISOString();
    const interactions = this._store.interactions || [];
    const meetings     = this._store.meetings     || [];

    const todayInteractions = interactions.filter((i) => i.createdAt?.slice(0, 10) === date);
    const todayMeetings     = meetings.filter((m) => m.startsAt?.slice(0, 10) === date);

    const ownerInteractions = todayInteractions.filter((i) =>
      ['email', 'call', 'follow_up'].includes(i.interactionType) && i.direction === 'outbound'
    );

    return {
      id:                   crypto.randomUUID(),
      date,
      ownersCalled:         ownerInteractions.filter((i) => i.interactionType === 'call').length,
      ownersEmailed:        ownerInteractions.filter((i) => i.interactionType === 'email').length,
      ownersLinkedIn:       0, // manual only
      ownersTotalContacted: ownerInteractions.length,
      ownerConversations:   todayInteractions.filter((i) => i.conversationSummary).length,
      meetingsScheduled:    todayMeetings.length,
      loisSent:             todayInteractions.filter((i) => i.interactionType === 'loi').length,
      investorConversations: 0, // manual only
      boardOutreach:        todayInteractions.filter((i) => {
        const c = (this._store.contacts || []).find((ct) => ct.id === i.contactId);
        return c?.contactType === 'board_candidate';
      }).length,
      boardMeetings:        todayMeetings.filter((m) => m.type === 'board').length,
      createdAt:            now,
      updatedAt:            now,
    };
  }

  /**
   * Manual activity entry — merges user-entered values with computed.
   */
  recordDailyActivity(data, nowIso = new Date().toISOString()) {
    const today = todayDate();
    let stat = (this._store.executionDailyStats || []).find((s) => s.date === today);
    if (!stat) stat = this._buildComputedDailyStat(today);

    const allowedManual = [
      'ownersCalled', 'ownersEmailed', 'ownersLinkedIn', 'ownersTotalContacted',
      'ownerConversations', 'meetingsScheduled', 'loisSent',
      'investorConversations', 'boardOutreach', 'boardMeetings',
    ];

    for (const key of allowedManual) {
      if (data[key] !== undefined) {
        stat[key] = Number(data[key]) || 0;
        stat[`_manual${key.charAt(0).toUpperCase() + key.slice(1)}`] = true;
      }
    }
    stat.updatedAt = nowIso;

    const idx = this._store.executionDailyStats.findIndex((s) => s.date === today);
    if (idx >= 0) this._store.executionDailyStats[idx] = stat;
    else          this._store.executionDailyStats = [stat, ...this._store.executionDailyStats];

    return stat;
  }

  getDailyStats(date = todayDate()) {
    return (this._store.executionDailyStats || []).find((s) => s.date === date)
      || this._buildComputedDailyStat(date);
  }

  getDailyStatsList(limit = 30) {
    return (this._store.executionDailyStats || [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  // ─── Weekly Stats ───────────────────────────────────────────────────────────

  getWeeklyStats(weekStart = weekStartDate()) {
    const existing = (this._store.executionWeeklyStats || []).find((s) => s.weekStartDate === weekStart);
    if (existing) return existing;
    return this._buildComputedWeeklyStat(weekStart);
  }

  _buildComputedWeeklyStat(weekStart) {
    const weekEnd   = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const interactions = (this._store.interactions || []).filter((i) => {
      const d = i.createdAt?.slice(0, 10);
      return d >= weekStart && d < weekEndStr;
    });
    const meetings = (this._store.meetings || []).filter((m) => {
      const d = m.startsAt?.slice(0, 10);
      return d >= weekStart && d < weekEndStr;
    });

    const outbound = interactions.filter((i) =>
      ['email', 'call', 'follow_up'].includes(i.interactionType) && i.direction === 'outbound'
    );

    const now = new Date().toISOString();
    return {
      id:                    crypto.randomUUID(),
      weekStartDate:         weekStart,
      ownersContacted:       outbound.length,
      ownerConversations:    interactions.filter((i) => i.conversationSummary).length,
      meetingsScheduled:     meetings.length,
      investorConversations: 0,
      boardMeetings:         meetings.filter((m) => m.type === 'board').length,
      loisSent:              interactions.filter((i) => i.interactionType === 'loi').length,
      companiesAdded:        (this._store.companies || []).filter((c) => {
        const d = c.createdAt?.slice(0, 10);
        return d >= weekStart && d < weekEndStr;
      }).length,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateWeeklyStats(patch, weekStart = weekStartDate(), nowIso = new Date().toISOString()) {
    const computed = this._buildComputedWeeklyStat(weekStart);
    const merged   = { ...computed, ...patch, weekStartDate: weekStart, updatedAt: nowIso };
    const idx = (this._store.executionWeeklyStats || []).findIndex((s) => s.weekStartDate === weekStart);
    if (idx >= 0) this._store.executionWeeklyStats[idx] = merged;
    else          this._store.executionWeeklyStats = [merged, ...(this._store.executionWeeklyStats || [])];
    return merged;
  }

  // ─── Monthly Stats ──────────────────────────────────────────────────────────

  getMonthlyStats(month = monthKey()) {
    const existing = (this._store.executionMonthlyStats || []).find((s) => s.month === month);
    if (existing) return existing;
    return this._buildComputedMonthlyStat(month);
  }

  _buildComputedMonthlyStat(month) {
    const interactions = (this._store.interactions || []).filter((i) =>
      i.createdAt?.slice(0, 7) === month
    );
    const meetings = (this._store.meetings || []).filter((m) =>
      m.startsAt?.slice(0, 7) === month
    );

    const outbound = interactions.filter((i) =>
      ['email', 'call', 'follow_up'].includes(i.interactionType) && i.direction === 'outbound'
    );

    const now = new Date().toISOString();
    return {
      id:                    crypto.randomUUID(),
      month,
      ownersContacted:       outbound.length,
      ownerConversations:    interactions.filter((i) => i.conversationSummary).length,
      meetingsScheduled:     meetings.length,
      investorConversations: 0,
      boardMeetings:         meetings.filter((m) => m.type === 'board').length,
      loisSent:              interactions.filter((i) => i.interactionType === 'loi').length,
      dealsOpened:           (this._store.deals || []).filter((d) =>
        d.createdAt?.slice(0, 7) === month && d.stage !== 'identified'
      ).length,
      dealsClosed:           (this._store.deals || []).filter((d) =>
        d.stage === 'closed' && d.updatedAt?.slice(0, 7) === month
      ).length,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateMonthlyStats(patch, month = monthKey(), nowIso = new Date().toISOString()) {
    const computed = this._buildComputedMonthlyStat(month);
    const merged   = { ...computed, ...patch, month, updatedAt: nowIso };
    const idx = (this._store.executionMonthlyStats || []).findIndex((s) => s.month === month);
    if (idx >= 0) this._store.executionMonthlyStats[idx] = merged;
    else          this._store.executionMonthlyStats = [merged, ...(this._store.executionMonthlyStats || [])];
    return merged;
  }

  // ─── Pipeline Stats ─────────────────────────────────────────────────────────

  calculatePipelineStats() {
    const companies = this._store.companies || [];
    const deals     = this._store.deals     || [];
    const interactions = this._store.interactions || [];

    const ownersContacted = companies.filter((c) =>
      c.sellerConversationStatus !== 'not_contacted' && c.lastInteractionAt
    ).length;

    const ownerConversations = companies.filter((c) =>
      ['conversation_started', 'meeting_scheduled', 'negotiation'].includes(c.sellerConversationStatus)
    ).length;

    const seriousOpportunities = deals.filter((d) =>
      ['financial_review', 'loi_discussion', 'loi_signed', 'due_diligence', 'financing', 'closing', 'closed'].includes(d.stage)
    ).length;

    const loisSent = deals.filter((d) =>
      ['loi_signed', 'due_diligence', 'financing', 'closing', 'closed'].includes(d.stage)
    ).length + interactions.filter((i) => i.interactionType === 'loi').length;

    const loisAccepted = deals.filter((d) =>
      ['loi_signed', 'due_diligence', 'financing', 'closing', 'closed'].includes(d.stage)
    ).length;

    const dealsClosed = deals.filter((d) => d.stage === 'closed').length;

    const now = new Date().toISOString();
    return {
      id:                   crypto.randomUUID(),
      totalCompanies:       companies.length,
      ownersContacted,
      ownerConversations,
      seriousOpportunities,
      loisSent: Math.max(loisSent, loisAccepted),
      loisAccepted,
      dealsClosed,
      createdAt:            now,
      updatedAt:            now,
    };
  }

  // ─── Board Stats ────────────────────────────────────────────────────────────

  calculateBoardStats() {
    const candidates = this._store.boardCandidates || [];
    const meetings   = this._store.meetings        || [];
    const seats      = this._store.boardSeats      || [];

    const now = new Date().toISOString();
    return {
      id:                    crypto.randomUUID(),
      candidatesIdentified:  candidates.length,
      candidatesContacted:   candidates.filter((c) =>
        ['outreach_sent', 'meeting_scheduled', 'interested', 'negotiating', 'confirmed'].includes(c.status)
      ).length,
      callsScheduled:        candidates.filter((c) =>
        ['meeting_scheduled', 'interested', 'negotiating', 'confirmed'].includes(c.status)
      ).length,
      boardMembersSecured:   candidates.filter((c) => c.status === 'confirmed').length ||
                             seats.filter((s) => s.status === 'filled').length,
      createdAt: now,
      updatedAt: now,
    };
  }

  // ─── Investor Stats ─────────────────────────────────────────────────────────

  calculateInvestorStats() {
    const investors = this._store.investors || [];
    const now = new Date().toISOString();
    return {
      id:                    crypto.randomUUID(),
      investorsIdentified:   investors.length,
      investorsContacted:    investors.filter((i) => i.lastInteractionAt).length,
      investorMeetings:      investors.filter((i) =>
        ['relationship', 'active_investor'].includes(i.relationshipStage)
      ).length,
      softCommitments:       investors.filter((i) => i.relationshipStage === 'active_investor').length,
      hardCommitments:       0, // manual entry only
      createdAt: now,
      updatedAt: now,
    };
  }

  // ─── Deal Momentum ──────────────────────────────────────────────────────────

  calculateMomentumStats() {
    const deals        = this._store.deals        || [];
    const interactions = this._store.interactions || [];
    const meetings     = this._store.meetings     || [];
    const now = new Date().toISOString();

    const activeDeals = deals.filter((d) =>
      !['closed', 'lost'].includes(d.stage) && d.status === 'active'
    );

    const stats = activeDeals.map((deal) => {
      const dealInteractions = interactions.filter((i) =>
        i.entityType === 'deal'   ? i.entityId === deal.id :
        i.entityType === 'company'? i.entityId === deal.companyId : false
      ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      const dealMeetings = meetings.filter((m) =>
        m.dealId === deal.id || m.companyId === deal.companyId
      ).sort((a, b) => b.startsAt.localeCompare(a.startsAt));

      const lastContact  = deal.lastInteractionAt || dealInteractions[0]?.createdAt || null;
      const lastMeeting  = dealMeetings[0]?.startsAt || null;
      const lastFinancial = dealInteractions.find((i) =>
        i.interactionType === 'document_sent' || i.interactionType === 'proposal'
      )?.createdAt || null;
      const lastFollowUp = dealInteractions.find((i) => i.interactionType === 'follow_up')?.createdAt || null;

      const daysContact  = daysBetween(lastContact);
      const daysMeeting  = daysBetween(lastMeeting);
      const score        = momentumScore(daysContact, daysMeeting, dealInteractions.length);
      const risk         = riskLevel(daysContact);

      return {
        id:                       crypto.randomUUID(),
        dealId:                   deal.id,
        dealName:                 deal.name,
        companyName:              deal.companyName,
        stage:                    deal.stage,
        lastOwnerContactDate:     lastContact,
        lastMeetingDate:          lastMeeting,
        lastFinancialReviewDate:  lastFinancial,
        lastFollowUpDate:         lastFollowUp,
        daysSinceLastContact:     daysContact,
        daysSinceLastMeeting:     daysMeeting,
        momentumScore:            score,
        riskLevel:                risk,
        nextActionRequired:       nextAction(risk, deal),
        interactionCount:         dealInteractions.length,
        createdAt:                now,
        updatedAt:                now,
      };
    });

    // Sort: stalled first, then cooling, warming, healthy; within each group by score asc
    const ORDER = { stalled: 0, cooling: 1, warming: 2, healthy: 3 };
    return stats.sort((a, b) =>
      ORDER[a.riskLevel] - ORDER[b.riskLevel] || a.momentumScore - b.momentumScore
    );
  }

  // ─── Execution Summary ──────────────────────────────────────────────────────

  getExecutionSummary() {
    const targets  = this.getTargets();
    const today    = this.getDailyStats();
    const week     = this.getWeeklyStats();
    const month    = this.getMonthlyStats();
    const pipeline = this.calculatePipelineStats();
    const board    = this.calculateBoardStats();
    const investors= this.calculateInvestorStats();
    const momentum = this.calculateMomentumStats();

    return {
      targets,
      today,
      week,
      month,
      pipeline,
      board,
      investors,
      momentum,
      alerts: this._generateAlerts(today, week, month, momentum, targets),
    };
  }

  getPipelineHealth() {
    const pipeline = this.calculatePipelineStats();
    const targets  = this.getTargets();
    const momentum = this.calculateMomentumStats();

    return {
      pipeline,
      targets,
      momentum,
      stalledDeals: momentum.filter((m) => m.riskLevel === 'stalled'),
      coolingDeals: momentum.filter((m) => m.riskLevel === 'cooling'),
    };
  }

  checkTargetCompletion() {
    const targets = this.getTargets();
    const today   = this.getDailyStats();
    const week    = this.getWeeklyStats();
    const month   = this.getMonthlyStats();
    const pipeline= this.calculatePipelineStats();

    return {
      daily_owner_calls:      { actual: today.ownersCalled, target: targets.daily_owner_calls, met: today.ownersCalled >= targets.daily_owner_calls },
      weekly_owner_contacts:  { actual: week.ownersContacted, target: targets.weekly_owner_contacts, met: week.ownersContacted >= targets.weekly_owner_contacts },
      weekly_investor_calls:  { actual: week.investorConversations, target: targets.weekly_investor_calls, met: week.investorConversations >= targets.weekly_investor_calls },
      monthly_lois:           { actual: month.loisSent, target: targets.monthly_lois, met: month.loisSent >= targets.monthly_lois },
      pipeline_companies:     { actual: pipeline.totalCompanies, target: targets.pipeline_companies, met: pipeline.totalCompanies >= targets.pipeline_companies },
    };
  }

  // ─── Alerts ─────────────────────────────────────────────────────────────────

  _generateAlerts(today, week, month, momentum, targets) {
    const alerts = [];

    if (today.ownersCalled < 10) {
      alerts.push({ level: 'warning', message: `Only ${today.ownersCalled} calls made today — target is ${targets.daily_owner_calls}` });
    }
    if (week.ownersContacted < 50) {
      alerts.push({ level: 'warning', message: `Only ${week.ownersContacted} owners contacted this week — target is ${targets.weekly_owner_contacts}` });
    }
    if (month.loisSent < 1) {
      alerts.push({ level: 'critical', message: `No LOIs sent this month — target is ${targets.monthly_lois}` });
    }
    const stalled = momentum.filter((m) => m.riskLevel === 'stalled');
    if (stalled.length > 0) {
      alerts.push({ level: 'critical', message: `${stalled.length} deal${stalled.length > 1 ? 's' : ''} stalled — immediate re-engagement required` });
    }
    const cooling = momentum.filter((m) => m.riskLevel === 'cooling');
    if (cooling.length > 0) {
      alerts.push({ level: 'warning', message: `${cooling.length} deal${cooling.length > 1 ? 's' : ''} cooling — follow up this week` });
    }

    return alerts;
  }

  // ─── Increment helpers (called by automation rules) ───────────────────────

  /** Called when a company is created */
  onCompanyCreated() {
    // Pipeline stats are computed live — no-op here
  }

  /** Called when an outbound owner interaction is logged */
  onOwnerInteraction() {
    // Daily stats re-compute on next fetch — no-op here
  }

  /** Called when a meeting is scheduled */
  onMeetingScheduled() {
    // Computed live — no-op here
  }
}

export default new ExecutionTrackerService();
