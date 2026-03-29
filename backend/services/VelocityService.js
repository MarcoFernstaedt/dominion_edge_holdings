/**
 * VelocityService — Pipeline Velocity & Conversion Intelligence
 *
 * Tracks how fast deals move through the acquisition funnel and surfaces
 * the metrics that matter for a QLA-style operator:
 *   - Average days per stage
 *   - Stage conversion rates
 *   - Time-to-LOI (from identified → loi_signed)
 *   - Stalled deals (no activity beyond threshold)
 *   - Weekly deal flow velocity score (0–100)
 */

import db from '../db/client.js';

const HAS_DB = !!process.env.DATABASE_URL;

// Days-in-stage thresholds before a deal is flagged as stalled
const STALL_THRESHOLDS = {
  identified:       14,
  contacted:        21,
  discovery:        30,
  financial_review: 21,
  loi_discussion:   14,
  loi_signed:       45,
  due_diligence:    60,
  financing:        45,
  closing:          30,
};

// Stage ordering for funnel analysis
const STAGE_ORDER = [
  'identified', 'contacted', 'discovery', 'financial_review',
  'loi_discussion', 'loi_signed', 'due_diligence', 'financing', 'closing', 'closed',
];

function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round(Math.abs(new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

/**
 * Compute velocity metrics for all active deals belonging to a user.
 * Falls back to in-memory store analysis when DB is unavailable.
 */
export async function computeVelocityMetrics(userId, storeDeals = []) {
  const deals = HAS_DB
    ? await db.deal.findMany({
        where: { userId, stage: { notIn: ['closed', 'lost'] } },
        select: {
          id: true, name: true, stage: true, createdAt: true,
          stageChangedAt: true, lastActivityAt: true, loiSentAt: true,
          loiSignedAt: true, closedAt: true, riskLevel: true,
          askingPrice: true, industry: true,
        },
        orderBy: { createdAt: 'asc' },
      })
    : storeDeals.filter((d) => d.stage !== 'closed' && d.stage !== 'lost');

  const now = new Date();

  // ── Per-deal stall analysis ──────────────────────────────────────────────
  const stalledDeals = [];
  const activeDealDetails = deals.map((deal) => {
    const lastActivity = deal.lastActivityAt || deal.stageChangedAt || deal.createdAt;
    const daysInStage = daysBetween(deal.stageChangedAt || deal.createdAt, now);
    const daysSinceActivity = daysBetween(lastActivity, now);
    const stallThreshold = STALL_THRESHOLDS[deal.stage] ?? 21;
    const isStalled = daysInStage > stallThreshold;

    if (isStalled) {
      stalledDeals.push({
        id: deal.id,
        name: deal.name,
        stage: deal.stage,
        daysInStage,
        daysSinceActivity,
        stallThreshold,
        overdueDays: daysInStage - stallThreshold,
        askingPrice: deal.askingPrice ?? null,
      });
    }

    return {
      id: deal.id,
      name: deal.name,
      stage: deal.stage,
      daysInStage,
      daysSinceActivity,
      isStalled,
    };
  });

  // Sort stalled by most overdue first
  stalledDeals.sort((a, b) => b.overdueDays - a.overdueDays);

  // ── Funnel stage distribution ────────────────────────────────────────────
  const stageCounts = {};
  for (const stage of STAGE_ORDER) stageCounts[stage] = 0;
  for (const deal of deals) {
    if (stageCounts[deal.stage] !== undefined) stageCounts[deal.stage]++;
  }

  // ── Time-to-LOI (for closed deals with LOI data) ─────────────────────────
  let timeToLoiDays = null;
  if (HAS_DB) {
    const loiDeals = await db.deal.findMany({
      where: { userId, loiSentAt: { not: null } },
      select: { createdAt: true, loiSentAt: true },
      take: 20,
      orderBy: { loiSentAt: 'desc' },
    });
    if (loiDeals.length > 0) {
      const ttls = loiDeals.map((d) => daysBetween(d.createdAt, d.loiSentAt)).filter(Boolean);
      timeToLoiDays = Math.round(ttls.reduce((s, v) => s + v, 0) / ttls.length);
    }
  }

  // ── Average days per stage (from historical closed deals) ────────────────
  let avgDaysToClose = null;
  if (HAS_DB) {
    const closedDeals = await db.deal.findMany({
      where: { userId, stage: 'closed', closedAt: { not: null } },
      select: { createdAt: true, closedAt: true },
      take: 10,
      orderBy: { closedAt: 'desc' },
    });
    if (closedDeals.length > 0) {
      const durations = closedDeals.map((d) => daysBetween(d.createdAt, d.closedAt)).filter(Boolean);
      avgDaysToClose = Math.round(durations.reduce((s, v) => s + v, 0) / durations.length);
    }
  }

  // ── Velocity score (0–100) ───────────────────────────────────────────────
  // Formula: penalise for stalls, reward for deep-funnel deals
  const totalDeals = deals.length;
  const stalledRatio = totalDeals > 0 ? stalledDeals.length / totalDeals : 0;
  const deepFunnelCount = deals.filter((d) =>
    ['loi_discussion', 'loi_signed', 'due_diligence', 'financing', 'closing'].includes(d.stage)
  ).length;
  const deepFunnelBonus = Math.min(deepFunnelCount * 8, 30);
  const rawScore = Math.max(0, 100 - stalledRatio * 60 + deepFunnelBonus - (stalledDeals.length * 3));
  const velocityScore = Math.min(100, Math.round(rawScore));

  // ── Recommendations ──────────────────────────────────────────────────────
  const recommendations = [];
  if (stalledDeals.length > 0) {
    recommendations.push({
      priority: 'high',
      action: `${stalledDeals.length} deal${stalledDeals.length > 1 ? 's are' : ' is'} stalled — schedule follow-up calls this week`,
      deals: stalledDeals.slice(0, 3).map((d) => d.name),
    });
  }
  if (stageCounts.contacted > 3 && stageCounts.discovery < 1) {
    recommendations.push({
      priority: 'medium',
      action: 'Bottleneck at "contacted" stage — push for discovery conversations to qualify faster',
    });
  }
  if (stageCounts.loi_discussion > 0 && stageCounts.loi_signed === 0) {
    recommendations.push({
      priority: 'high',
      action: `${stageCounts.loi_discussion} deal(s) in LOI discussion — close them to LOI this week to maintain momentum`,
    });
  }
  if (totalDeals === 0) {
    recommendations.push({
      priority: 'critical',
      action: 'Pipeline is empty — source and add 5+ new acquisition targets immediately',
    });
  }

  return {
    velocityScore,
    totalActiveDeals: totalDeals,
    stalledCount: stalledDeals.length,
    stalledDeals,
    stageCounts,
    deepFunnelCount,
    timeToLoiDays,
    avgDaysToClose,
    activeDealDetails,
    recommendations,
    generatedAt: now.toISOString(),
  };
}

/**
 * Weekly velocity trend — compares this week's activity to last week.
 */
export async function getWeeklyVelocityTrend(userId) {
  if (!HAS_DB) return null;

  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const [thisWeek, lastWeek] = await Promise.all([
    db.interaction.count({ where: { userId, createdAt: { gte: oneWeekAgo } } }),
    db.interaction.count({ where: { userId, createdAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
  ]);

  const [thisWeekLois, lastWeekLois] = await Promise.all([
    db.deal.count({ where: { userId, loiSentAt: { gte: oneWeekAgo } } }),
    db.deal.count({ where: { userId, loiSentAt: { gte: twoWeeksAgo, lt: oneWeekAgo } } }),
  ]);

  const activityDelta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

  return {
    thisWeek: { interactions: thisWeek, loisSent: thisWeekLois },
    lastWeek: { interactions: lastWeek, loisSent: lastWeekLois },
    activityDeltaPct: activityDelta,
    trend: activityDelta === null ? 'no_baseline'
      : activityDelta > 10 ? 'accelerating'
      : activityDelta < -10 ? 'decelerating'
      : 'steady',
  };
}

export default { computeVelocityMetrics, getWeeklyVelocityTrend };
