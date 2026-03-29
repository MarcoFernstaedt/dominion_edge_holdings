/**
 * AgentRunLogger — immutable structured log of every agent execution.
 *
 * Every agent run must be logged here (via AIService).
 * Logs are used for:
 * - Quality control (confidence, acceptance rate)
 * - Cost attribution
 * - Fallback tracking
 * - Audit trail for AI-generated content
 * - Debugging failed or unexpected outputs
 */

// ─── In-memory store (replace with DB in production) ─────────────────────────

const _runs = [];
let _runCounter = 0;

// ─── Run log entry schema ─────────────────────────────────────────────────────

/**
 * @typedef {object} AgentRunLog
 * @property {string}  run_id
 * @property {string}  agent_name
 * @property {string}  prompt_key
 * @property {string}  prompt_version
 * @property {string}  task_type
 * @property {string}  model_used
 * @property {boolean} fallback_used
 * @property {string}  fallback_reason     — set if fallback_used
 * @property {string}  input_hash
 * @property {string[]} source_entities    — entity IDs included in context
 * @property {number}  latency_ms
 * @property {object}  token_usage         — { input, output, total }
 * @property {number}  estimated_cost
 * @property {string}  confidence          — 'low' | 'medium' | 'high'
 * @property {boolean} approval_required
 * @property {string}  approval_status     — 'pending' | 'approved' | 'rejected' | 'not_required'
 * @property {boolean} cached
 * @property {boolean} parse_success
 * @property {string}  error_type          — set if run failed
 * @property {string}  error_message
 * @property {string}  created_at
 * @property {object}  output_preview      — truncated output for display
 */

// ─── Logger API ───────────────────────────────────────────────────────────────

/**
 * Log a completed agent run.
 * Returns the run_id for reference.
 */
export function logRun({
  agent_name        = 'unknown',
  prompt_key        = 'unknown',
  prompt_version    = '0.0',
  task_type         = 'unknown',
  model_used        = 'unknown',
  fallback_used     = false,
  fallback_reason   = null,
  input_hash        = null,
  source_entities   = [],
  latency_ms        = 0,
  token_usage       = { input: 0, output: 0, total: 0 },
  estimated_cost    = 0,
  confidence        = 'low',
  approval_required = false,
  cached            = false,
  parse_success     = true,
  error_type        = null,
  error_message     = null,
  output_preview    = null,
}) {
  _runCounter += 1;
  const run_id = `run_${Date.now()}_${_runCounter}`;

  const entry = {
    run_id,
    agent_name,
    prompt_key,
    prompt_version,
    task_type,
    model_used,
    fallback_used,
    fallback_reason,
    input_hash,
    source_entities,
    latency_ms,
    token_usage,
    estimated_cost: parseFloat(estimated_cost.toFixed(6)),
    confidence,
    approval_required,
    approval_status:  approval_required ? 'pending' : 'not_required',
    cached,
    parse_success,
    error_type,
    error_message,
    created_at:   new Date().toISOString(),
    output_preview: output_preview
      ? JSON.stringify(output_preview).slice(0, 500)
      : null,
  };

  _runs.push(entry);

  // Keep last 2000 runs in memory
  if (_runs.length > 2000) _runs.shift();

  // Log failures loudly
  if (error_type) {
    console.error(
      `[AgentRunLogger] FAILED run: ${agent_name}/${task_type} — ${error_type}: ${error_message}`
    );
  }

  return run_id;
}

/**
 * Update approval status on a logged run.
 */
export function updateApproval(run_id, status, notes = null) {
  const run = _runs.find((r) => r.run_id === run_id);
  if (run) {
    run.approval_status = status;
    if (notes) run.approval_notes = notes;
    run.approved_at = new Date().toISOString();
  }
}

/**
 * Get all runs (with optional filters).
 */
export function getRuns({
  agent_name    = null,
  task_type     = null,
  fallback_only = false,
  errors_only   = false,
  limit         = 100,
  offset        = 0,
} = {}) {
  let results = [..._runs].reverse(); // most recent first

  if (agent_name)    results = results.filter((r) => r.agent_name === agent_name);
  if (task_type)     results = results.filter((r) => r.task_type === task_type);
  if (fallback_only) results = results.filter((r) => r.fallback_used);
  if (errors_only)   results = results.filter((r) => r.error_type !== null);

  return {
    total:  results.length,
    offset,
    limit,
    items:  results.slice(offset, offset + limit),
  };
}

/**
 * Get a single run by ID.
 */
export function getRun(run_id) {
  return _runs.find((r) => r.run_id === run_id) ?? null;
}

/**
 * Get quality metrics for a given agent.
 */
export function getAgentMetrics(agent_name) {
  const agentRuns = _runs.filter((r) => r.agent_name === agent_name);
  if (agentRuns.length === 0) return null;

  const total        = agentRuns.length;
  const successes    = agentRuns.filter((r) => !r.error_type).length;
  const failures     = agentRuns.filter((r) => r.error_type).length;
  const fallbacks    = agentRuns.filter((r) => r.fallback_used).length;
  const cacheHits    = agentRuns.filter((r) => r.cached).length;
  const parseFailures= agentRuns.filter((r) => !r.parse_success).length;

  const avgLatency = agentRuns.reduce((a, r) => a + r.latency_ms, 0) / total;
  const totalCost  = agentRuns.reduce((a, r) => a + r.estimated_cost, 0);

  const approvalRuns      = agentRuns.filter((r) => r.approval_required);
  const approvedRuns      = approvalRuns.filter((r) => r.approval_status === 'approved');
  const approvalAcceptRate= approvalRuns.length > 0
    ? approvedRuns.length / approvalRuns.length
    : null;

  const confidenceBreakdown = agentRuns.reduce((acc, r) => {
    acc[r.confidence] = (acc[r.confidence] ?? 0) + 1;
    return acc;
  }, {});

  return {
    agent_name,
    total_runs:           total,
    success_rate:         parseFloat((successes / total).toFixed(3)),
    failure_rate:         parseFloat((failures / total).toFixed(3)),
    fallback_rate:        parseFloat((fallbacks / total).toFixed(3)),
    cache_hit_rate:       parseFloat((cacheHits / total).toFixed(3)),
    parse_failure_rate:   parseFloat((parseFailures / total).toFixed(3)),
    avg_latency_ms:       Math.round(avgLatency),
    total_cost_usd:       parseFloat(totalCost.toFixed(4)),
    avg_cost_per_run:     parseFloat((totalCost / total).toFixed(6)),
    approval_accept_rate: approvalAcceptRate !== null
      ? parseFloat(approvalAcceptRate.toFixed(3))
      : null,
    confidence_breakdown: confidenceBreakdown,
  };
}

/**
 * Get system-wide quality overview.
 */
export function getSystemMetrics() {
  const total       = _runs.length;
  const failures    = _runs.filter((r) => r.error_type).length;
  const fallbacks   = _runs.filter((r) => r.fallback_used).length;
  const cacheHits   = _runs.filter((r) => r.cached).length;

  const agentNames  = [...new Set(_runs.map((r) => r.agent_name))];
  const agentMetrics = agentNames.map((name) => getAgentMetrics(name));

  return {
    total_runs:     total,
    failure_rate:   total > 0 ? parseFloat((failures / total).toFixed(3)) : 0,
    fallback_rate:  total > 0 ? parseFloat((fallbacks / total).toFixed(3)) : 0,
    cache_hit_rate: total > 0 ? parseFloat((cacheHits / total).toFixed(3)) : 0,
    agents:         agentMetrics,
  };
}

export default {
  logRun,
  updateApproval,
  getRuns,
  getRun,
  getAgentMetrics,
  getSystemMetrics,
};
