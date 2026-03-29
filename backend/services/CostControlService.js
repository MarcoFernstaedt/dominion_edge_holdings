/**
 * CostControlService — tracks AI token usage, cost estimates, and enforces budget controls.
 *
 * Rules:
 * - Every AIService.run() call reports usage here.
 * - No module should call this directly — only AIService.
 * - Costs are estimates based on public Anthropic pricing (update as pricing changes).
 * - Provides usage reports for the admin UI.
 * - Does not block calls by default — warns when thresholds exceeded.
 */

// ─── Pricing (per 1M tokens, USD) — update as pricing changes ────────────────
// Input / output split estimates. We use blended rates for simplicity.
const COST_PER_1M_TOKENS = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60  },
  // fallback estimate for unknown models
  unknown:                     { input: 3.00,  output: 15.00 },
};

// ─── Budget warning thresholds (USD) ─────────────────────────────────────────
const THRESHOLDS = {
  daily_warning:    5.00,
  weekly_warning:  20.00,
  single_run_warn:  0.10, // warn if a single run costs > $0.10
};

// ─── In-memory store (survives server restart via export) ─────────────────────
// In production, persist to DB.
const _store = {
  runs:         [],  // AgentRun cost records
  totalByAgent: {},  // { agentName: { tokens: n, cost: n, runs: n } }
  totalByTask:  {},  // { taskType: { tokens: n, cost: n, runs: n } }
  daily:        {},  // { 'YYYY-MM-DD': { tokens: n, cost: n, runs: n, cacheHits: n } }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function estimateCost(model, inputTokens, outputTokens) {
  const pricing = COST_PER_1M_TOKENS[model] ?? COST_PER_1M_TOKENS.unknown;
  return (
    (inputTokens  / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

function ensureDayBucket(date) {
  if (!_store.daily[date]) {
    _store.daily[date] = { tokens: 0, cost: 0, runs: 0, cacheHits: 0 };
  }
}

function ensureAgentBucket(agentName) {
  if (!_store.totalByAgent[agentName]) {
    _store.totalByAgent[agentName] = { tokens: 0, cost: 0, runs: 0, failures: 0 };
  }
}

function ensureTaskBucket(taskType) {
  if (!_store.totalByTask[taskType]) {
    _store.totalByTask[taskType] = { tokens: 0, cost: 0, runs: 0, cacheHits: 0 };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a completed AI run.
 * Called by AIService after every model call.
 *
 * @param {object} params
 * @param {string} params.agentName
 * @param {string} params.taskType
 * @param {string} params.model
 * @param {number} params.inputTokens
 * @param {number} params.outputTokens
 * @param {boolean} params.cached
 * @param {boolean} params.fallbackUsed
 * @param {boolean} params.success
 * @param {number}  params.latencyMs
 */
export function recordRun({
  agentName = 'unknown',
  taskType  = 'unknown',
  model     = 'unknown',
  inputTokens  = 0,
  outputTokens = 0,
  cached       = false,
  fallbackUsed = false,
  success      = true,
  latencyMs    = 0,
}) {
  const totalTokens = inputTokens + outputTokens;
  const cost        = cached ? 0 : estimateCost(model, inputTokens, outputTokens);
  const date        = today();

  // Day bucket
  ensureDayBucket(date);
  _store.daily[date].tokens += totalTokens;
  _store.daily[date].cost   += cost;
  _store.daily[date].runs   += 1;
  if (cached) _store.daily[date].cacheHits += 1;

  // Agent bucket
  ensureAgentBucket(agentName);
  _store.totalByAgent[agentName].tokens += totalTokens;
  _store.totalByAgent[agentName].cost   += cost;
  _store.totalByAgent[agentName].runs   += 1;
  if (!success) _store.totalByAgent[agentName].failures += 1;

  // Task bucket
  ensureTaskBucket(taskType);
  _store.totalByTask[taskType].tokens += totalTokens;
  _store.totalByTask[taskType].cost   += cost;
  _store.totalByTask[taskType].runs   += 1;
  if (cached) _store.totalByTask[taskType].cacheHits += 1;

  // Append run record (keep last 1000)
  _store.runs.push({
    ts: new Date().toISOString(),
    agentName,
    taskType,
    model,
    inputTokens,
    outputTokens,
    totalTokens,
    cost,
    cached,
    fallbackUsed,
    success,
    latencyMs,
  });
  if (_store.runs.length > 1000) _store.runs.shift();

  // Budget warnings (non-blocking — just log)
  if (cost > THRESHOLDS.single_run_warn) {
    console.warn(`[CostControl] High-cost run: ${agentName}/${taskType} = $${cost.toFixed(4)} (${model})`);
  }
  const dayTotal = _store.daily[date].cost;
  if (dayTotal > THRESHOLDS.daily_warning) {
    console.warn(`[CostControl] Daily AI spend threshold exceeded: $${dayTotal.toFixed(2)} today`);
  }
}

/**
 * Get usage summary for admin/UI display.
 */
export function getUsageSummary() {
  const date = today();
  ensureDayBucket(date);

  const todayStats = _store.daily[date];

  // Weekly total (last 7 days)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  const weeklyStats = weekDates.reduce(
    (acc, d) => {
      const day = _store.daily[d] ?? { tokens: 0, cost: 0, runs: 0, cacheHits: 0 };
      acc.tokens   += day.tokens;
      acc.cost     += day.cost;
      acc.runs     += day.runs;
      acc.cacheHits += day.cacheHits;
      return acc;
    },
    { tokens: 0, cost: 0, runs: 0, cacheHits: 0 }
  );

  // Top cost drivers
  const topAgents = Object.entries(_store.totalByAgent)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const topTasks = Object.entries(_store.totalByTask)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10);

  const totalCacheHits  = _store.runs.filter((r) => r.cached).length;
  const totalRuns       = _store.runs.length;
  const cacheHitRate    = totalRuns > 0 ? (totalCacheHits / totalRuns) : 0;

  const estimatedSavings = _store.runs
    .filter((r) => r.cached)
    .reduce((acc, r) => acc + estimateCost(r.model, r.inputTokens, r.outputTokens), 0);

  return {
    today: {
      cost:       parseFloat(todayStats.cost.toFixed(4)),
      tokens:     todayStats.tokens,
      runs:       todayStats.runs,
      cacheHits:  todayStats.cacheHits,
    },
    weekly: {
      cost:       parseFloat(weeklyStats.cost.toFixed(4)),
      tokens:     weeklyStats.tokens,
      runs:       weeklyStats.runs,
      cacheHits:  weeklyStats.cacheHits,
    },
    cacheHitRate:      parseFloat((cacheHitRate * 100).toFixed(1)),
    estimatedSavings:  parseFloat(estimatedSavings.toFixed(4)),
    topAgents,
    topTasks,
    thresholds: THRESHOLDS,
    dailyHistory: Object.entries(_store.daily)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30)
      .map(([date, stats]) => ({ date, ...stats })),
  };
}

/**
 * Get recent runs (for debug/audit display).
 */
export function getRecentRuns(limit = 50) {
  return _store.runs.slice(-limit).reverse();
}

/**
 * Reset all stats (testing only).
 */
export function resetStats() {
  _store.runs.length = 0;
  Object.keys(_store.totalByAgent).forEach((k) => delete _store.totalByAgent[k]);
  Object.keys(_store.totalByTask).forEach((k) => delete _store.totalByTask[k]);
  Object.keys(_store.daily).forEach((k) => delete _store.daily[k]);
}

export default {
  recordRun,
  getUsageSummary,
  getRecentRuns,
  resetStats,
  estimateCost,
};
