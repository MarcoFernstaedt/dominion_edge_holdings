/**
 * AIArtifactCache — normalized cache layer for AI-generated artifacts.
 *
 * Wraps CacheService with a structured key composition that encodes:
 *   task_type + entity_ids + source_snapshot_hash + prompt_version + model_route + input_hash
 *
 * This ensures cache invalidation is precise:
 * - Changing the prompt version busts the cache automatically
 * - Changing source entities busts the cache automatically
 * - Changing the model route busts the cache automatically
 * - Identical inputs with the same prompt version always hit cache
 *
 * Cache windows by category:
 *   LONG   (7d)  — document classification, field extraction, historical summaries
 *   MEDIUM (24h) — deal summaries, relationship summaries, board candidate summaries
 *   SHORT  (6h)  — command center brief, today summary, meeting prep near meeting time
 *
 * Invalidation triggers:
 *   - source entity record changes    → caller invalidates by entityIds
 *   - prompt version change           → new key automatically (version in key)
 *   - workflow stage material change  → caller invalidates by entityIds
 *   - user force refresh              → skipCache: true in gateway call
 *   - freshness window expired        → TTL handled by CacheService
 */

import * as CacheService from './CacheService.js';
import crypto from 'crypto';

// ─── TTL windows (ms) ─────────────────────────────────────────────────────────

const TTL = {
  LONG:   7  * 24 * 3600_000,   // 7 days
  MEDIUM: 24 * 3600_000,        // 24 hours
  SHORT:  6  * 3600_000,        // 6 hours
};

// Task type → cache window
const TASK_TTL_MAP = {
  // LONG — stable, rarely changes
  document_classification:     TTL.LONG,
  field_extraction:            TTL.LONG,
  short_summary:               TTL.LONG,
  contact_classification:      TTL.LONG,
  metadata_normalization:      TTL.LONG,
  seller_signal_commentary:    TTL.LONG,

  // MEDIUM — changes when source data changes
  deal_snapshot:               TTL.MEDIUM,
  deal_structure_commentary:   TTL.MEDIUM,
  relationship_summary:        TTL.MEDIUM,
  board_candidate_ranking:     TTL.MEDIUM,
  board_outreach_draft:        TTL.MEDIUM,
  investor_fit_summary:        TTL.MEDIUM,
  investor_update_draft:       TTL.MEDIUM,
  memo_section_draft:          TTL.MEDIUM,
  diligence_question_generation: TTL.MEDIUM,
  capital_stack_commentary:    TTL.MEDIUM,
  complex_diligence_synthesis: TTL.MEDIUM,
  outreach_draft:              TTL.MEDIUM,
  crm_hygiene:                 TTL.MEDIUM,

  // SHORT — time-sensitive
  daily_briefing:              TTL.SHORT,
  empire_coach_daily:          TTL.SHORT,
  execution_brief:             TTL.SHORT,
  execution_recovery:          TTL.SHORT,
  meeting_prep:                TTL.SHORT,
  strategy_summary:            TTL.SHORT,

  // Default (anything not listed)
  _default:                    TTL.MEDIUM,
};

// ─── Key composition ──────────────────────────────────────────────────────────

/**
 * Build a fully normalized cache key.
 *
 * Key encodes all dimensions that affect output:
 *   {taskType}:{promptVersion}:{modelRoute}:{entityHash}:{inputHash}
 *
 * Any change to any dimension = new key = cache miss.
 */
export function buildKey({
  taskType,
  promptVersion   = '1.0',
  modelRoute      = 'default',
  entityIds       = [],
  sourceSnapshotHash = null,
  inputPayload    = {},
}) {
  const entityHash  = _hash([...entityIds].sort().join(','));
  const inputHash   = _hash(JSON.stringify(inputPayload));
  const snapshotSeg = sourceSnapshotHash ? `:${sourceSnapshotHash.slice(0, 8)}` : '';

  return `ai:${taskType}:v${promptVersion}:${modelRoute}:${entityHash}:${inputHash}${snapshotSeg}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get a cached AI artifact.
 * Returns null if not found or expired.
 *
 * @param {object} keyParams — same params as buildKey()
 * @returns {object|null} { content, meta } or null
 */
export function get(keyParams) {
  const key   = buildKey(keyParams);
  const entry = CacheService.get(key);
  if (!entry) return null;
  return { content: entry.content, meta: entry };
}

/**
 * Store an AI artifact.
 *
 * @param {object} keyParams   — same params as buildKey()
 * @param {object} meta        — { provider, model, agentName, generatedAt }
 * @param {*}      content     — the artifact to cache
 */
export function set(keyParams, meta, content) {
  const key = buildKey(keyParams);
  const ttl = TASK_TTL_MAP[keyParams.taskType] ?? TASK_TTL_MAP._default;

  CacheService.set(
    key,
    {
      feature:    keyParams.taskType,
      entityType: meta.entityType ?? null,
      entityId:   (keyParams.entityIds ?? []).join(','),
      model:      meta.model ?? 'unknown',
      ...meta,
    },
    content,
    ttl
  );

  return key;
}

/**
 * Invalidate all cached artifacts for given entity IDs.
 * Call this whenever a source record changes.
 *
 * Note: CacheService.invalidate() works by prefix match.
 * We can't easily do entity-based invalidation without iterating,
 * so we expose this for callers that know the task types to bust.
 *
 * @param {string[]} entityIds
 * @param {string[]} [taskTypes] — if provided, only bust these task types
 */
export function invalidateForEntities(entityIds, taskTypes = null) {
  const entityHash = _hash([...entityIds].sort().join(','));

  if (taskTypes) {
    taskTypes.forEach((taskType) => {
      CacheService.invalidate(`ai:${taskType}:`);
    });
  } else {
    // Bust all AI cache entries containing this entity hash
    // (scan is acceptable since cache is in-memory and bounded)
    CacheService.invalidateWhere((key) => key.includes(entityHash));
  }
}

/**
 * Invalidate all cached artifacts for a given task type.
 * Use after prompt version change.
 */
export function invalidateTaskType(taskType) {
  CacheService.invalidate(`ai:${taskType}:`);
}

/**
 * Get cache statistics.
 */
export function getStats() {
  return {
    totalEntries: CacheService.size(),
    ttlWindows:   {
      long:   `${TTL.LONG   / 3600_000}h`,
      medium: `${TTL.MEDIUM / 3600_000}h`,
      short:  `${TTL.SHORT  / 3600_000}h`,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _hash(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8);
}

export default { buildKey, get, set, invalidateForEntities, invalidateTaskType, getStats, TTL, TASK_TTL_MAP };
