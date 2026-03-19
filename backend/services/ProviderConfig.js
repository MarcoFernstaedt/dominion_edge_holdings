/**
 * ProviderConfig — single source of truth for all AI provider model IDs,
 * token limits, timeouts, and task-type routing.
 *
 * Rules:
 *  - No raw vendor model SKU names outside this file.
 *  - Business logic requests provider + tier, never model names.
 *  - Tier routing: LOW | MID | HIGH
 *  - Provider bias guidance embedded here, not in callers.
 */

// ─── Provider model registry ──────────────────────────────────────────────────

export const PROVIDERS = {
  anthropic: {
    name: 'anthropic',
    bias: [
      'structured reasoning',
      'operator coaching',
      'succinct quality writing',
      'strategy synthesis',
      'diligence synthesis',
      'board and investor communication',
    ],
    models: {
      LOW:  'claude-haiku-4-5-20251001',
      MID:  'claude-haiku-4-5-20251001',
      HIGH: 'claude-sonnet-4-6',
    },
    maxTokens: {
      LOW:  1024,
      MID:  1536,
      HIGH: 2048,
    },
    timeoutMs: {
      LOW:  15_000,
      MID:  30_000,
      HIGH: 60_000,
    },
  },
  openai: {
    name: 'openai',
    bias: [
      'fallback resilience',
      'future multimodal or speech features',
      'alternate drafting or summarization path',
      'provider redundancy',
    ],
    models: {
      LOW:  'gpt-4o-mini',
      MID:  'gpt-4o-mini',
      HIGH: 'gpt-4o',
    },
    maxTokens: {
      LOW:  1024,
      MID:  1536,
      HIGH: 2048,
    },
    timeoutMs: {
      LOW:  15_000,
      MID:  30_000,
      HIGH: 60_000,
    },
  },
};

// ─── Tier constants ───────────────────────────────────────────────────────────

export const TIER = { LOW: 'LOW', MID: 'MID', HIGH: 'HIGH' };

// ─── Task → tier routing ──────────────────────────────────────────────────────

export const TASK_TIERS = {
  // LOW — classification, tagging, field extraction, short summaries
  classification:              'LOW',
  document_classification:     'LOW',
  field_extraction:             'LOW',
  short_summary:                'LOW',
  crm_hygiene:                  'LOW',
  seller_signal_commentary:     'LOW',
  activity_categorization:      'LOW',
  subject_line_generation:      'LOW',
  lead_normalization:           'LOW',
  tag_suggestion:               'LOW',

  // MID — drafting, deal snapshots, meeting prep, multi-record synthesis
  outreach_drafting:            'MID',
  meeting_prep:                 'MID',
  deal_snapshot:                'MID',
  board_candidate_ranking:      'MID',
  seller_likelihood_commentary: 'MID',
  execution_briefing:           'MID',
  investor_memo_draft:          'MID',
  diligence_summary:            'MID',
  deal_summary:                 'MID',
  seller_questions:             'MID',

  // HIGH — complex tradeoffs, capital stack, strategy synthesis, cross-doc synthesis
  capital_stack_analysis:       'HIGH',
  underwriting_commentary:      'HIGH',
  empire_coach_strategy:        'HIGH',
  thesis_validation:            'HIGH',
  cross_deal_strategy:          'HIGH',
  diligence_synthesis:          'HIGH',
  investor_readiness:           'HIGH',
};

// ─── Routing helpers ──────────────────────────────────────────────────────────

/**
 * Resolve model config for a given provider + tier.
 * Returns { model, maxTokens, timeoutMs }
 */
export function resolveModel(provider, tier) {
  const pCfg = PROVIDERS[provider];
  if (!pCfg) throw new Error(`Unknown provider: ${provider}`);
  const t = (tier ?? 'LOW').toUpperCase();
  if (!pCfg.models[t]) throw new Error(`Unknown tier '${t}' for provider '${provider}'`);
  return {
    model:     pCfg.models[t],
    maxTokens: pCfg.maxTokens[t],
    timeoutMs: pCfg.timeoutMs[t],
  };
}

/**
 * Get the recommended tier for a task type.
 */
export function getTierForTask(taskType) {
  return TASK_TIERS[taskType] ?? 'LOW';
}

/**
 * Get a human-readable config summary (for debugging/logging).
 */
export function getConfigSummary() {
  return Object.entries(PROVIDERS).map(([providerKey, cfg]) => ({
    provider: providerKey,
    tiers: Object.entries(cfg.models).map(([tier, model]) => ({
      tier,
      model,
      maxTokens: cfg.maxTokens[tier],
      timeoutMs: cfg.timeoutMs[tier],
    })),
  }));
}

export default { PROVIDERS, TIER, TASK_TIERS, resolveModel, getTierForTask, getConfigSummary };
