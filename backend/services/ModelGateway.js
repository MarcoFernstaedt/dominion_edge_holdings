/**
 * ModelGateway — provider-agnostic central model routing layer.
 *
 * Business logic requests TASK TYPES, never model names.
 * All provider selection, fallback, caching, logging, and cost tracking
 * happens here. No module outside this file may select a model directly.
 *
 * Provider priority:
 *   1. Anthropic (primary for all structured reasoning)
 *   2. OpenAI   (fallback / cost-effective alternatives)
 *
 * Tier routing:
 *   LOW  → cheapest reliable model (classification, tagging, short summaries)
 *   MID  → capable model (drafting, meeting prep, deal snapshots)
 *   HIGH → strongest available (complex tradeoffs, strategy, synthesis)
 */

import Anthropic from '@anthropic-ai/sdk';
import CacheService        from './CacheService.js';
import * as AIArtifactCache from './AIArtifactCache.js';
import * as AIFallbackService from './AIFallbackService.js';
import CostControlService  from './CostControlService.js';
import AgentRunLogger      from './AgentRunLogger.js';
import OutputValidator     from './OutputValidator.js';
import { withRetry }       from '../utils/retry.js';
import ProviderConfig      from './ProviderConfig.js';
import {
  validateBaseSchema,
  buildRepairPrompt,
  buildEmptyFallback,
  repairOutput,
} from './AgentOutputSchema.js';

// ─── Provider model map — delegated to ProviderConfig ────────────────────────
// Raw model IDs live ONLY in ProviderConfig. Do not add them here.

const PROVIDERS   = ProviderConfig.PROVIDERS;

// ─── Task → tier routing — merged from ProviderConfig + local extensions ──────
// Rule: default to LOW. Escalate only when quality materially matters.

const TASK_TIERS = {
  ...ProviderConfig.TASK_TIERS,

  // Additional local routing (not yet in ProviderConfig)
  outreach_small_rewrite:       'LOW',
  reply_classification:         'LOW',
  contact_classification:       'LOW',
  status_inference:             'LOW',
  metadata_normalization:       'LOW',
  execution_diagnostic:         'LOW',
  deal_scout_screening:         'LOW',
  outreach_draft:               'MID',
  board_outreach_draft:         'MID',
  daily_briefing:               'MID',
  meeting_summary:              'MID',
  deal_scout_rich:              'MID',
  relationship_summary:         'MID',
  execution_brief:              'MID',
  execution_recovery:           'MID',
  empire_coach_daily:           'MID',
  memo_section_draft:           'MID',
  investor_update_draft:        'MID',
  investor_fit_summary:         'MID',
  diligence_question_generation:'MID',
  investor_outreach_draft:      'MID',
  lead_discovery:               'MID',
  target_qualification:         'MID',
  board_analysis:               'MID',
  crm_health:                   'MID',
  deal_structure_commentary:    'HIGH',
  capital_stack_commentary:     'HIGH',
  complex_diligence_synthesis:  'HIGH',
  strategy_summary:             'HIGH',
  board_strategy_synthesis:     'HIGH',
  cross_deal_synthesis:         'HIGH',
  high_stakes_external_draft:   'HIGH',
  deal_analysis:                'HIGH',
  document_generation:          'HIGH',
  multi_document_analysis:      'HIGH',
  underwriter_commentary:       'HIGH',
  outreach_high_stakes:         'HIGH',
};

// ─── Lazy clients ─────────────────────────────────────────────────────────────

let _anthropicClient = null;
function getAnthropicClient() {
  if (!_anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) throw new GatewayError('ANTHROPIC_API_KEY not set', 'NO_API_KEY');
    _anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropicClient;
}

async function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) throw new GatewayError('OPENAI_API_KEY not set', 'NO_OPENAI_KEY');
  const { default: OpenAI } = await import('openai').catch(() => {
    throw new GatewayError('openai package not installed', 'MISSING_DEPENDENCY');
  });
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class GatewayError extends Error {
  constructor(message, code = 'GATEWAY_ERROR') {
    super(message);
    this.name  = 'GatewayError';
    this.code  = code;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveTier(taskType, overrideTier) {
  if (overrideTier && ['LOW', 'MID', 'HIGH'].includes(overrideTier)) return overrideTier;
  return TASK_TIERS[taskType] ?? 'LOW'; // default to cheapest
}

function buildInputHash(taskType, entityIds, context) {
  const payload = JSON.stringify({ taskType, entityIds, context });
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash) + payload.charCodeAt(i);
    hash |= 0;
  }
  return `${taskType}_${Math.abs(hash).toString(36)}`;
}

function staleAfter(taskType) {
  // Short-lived: command center / meeting near-time
  if (['daily_briefing', 'empire_coach_daily', 'execution_brief'].includes(taskType)) {
    return new Date(Date.now() + 6 * 3600_000).toISOString();
  }
  // Medium: summaries, drafts
  if (['deal_snapshot', 'relationship_summary', 'investor_fit_summary', 'board_candidate_ranking', 'meeting_prep'].includes(taskType)) {
    return new Date(Date.now() + 24 * 3600_000).toISOString();
  }
  // Long: classifications, field extractions
  return new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
}

// ─── Anthropic call ───────────────────────────────────────────────────────────

async function callAnthropic({ model, maxTokens, timeoutMs, systemPrompt, userMessage }) {
  const client = getAnthropicClient();
  let inputTokens = 0, outputTokens = 0, rawText = '';

  await withRetry(async () => {
    const resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    inputTokens  = resp.usage?.input_tokens  ?? 0;
    outputTokens = resp.usage?.output_tokens ?? 0;
    rawText      = resp.content.find((b) => b.type === 'text')?.text ?? '';
  }, {
    maxRetries:  2,
    baseDelayMs: 1500,
    shouldRetry: (e) => !e.message?.includes('401') && !e.message?.includes('403'),
    onRetry: (n, e, d) => console.warn(`[ModelGateway/anthropic] retry ${n} in ${d}ms: ${e.message}`),
  });

  return { rawText, inputTokens, outputTokens, provider: 'anthropic', model };
}

// ─── OpenAI call ─────────────────────────────────────────────────────────────

async function callOpenAI({ model, maxTokens, systemPrompt, userMessage }) {
  const client = await getOpenAIClient();
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });

  const resp = await client.chat.completions.create({ model, messages, max_tokens: maxTokens });
  const rawText     = resp.choices[0]?.message?.content ?? '';
  const inputTokens = resp.usage?.prompt_tokens     ?? 0;
  const outputTokens= resp.usage?.completion_tokens ?? 0;

  return { rawText, inputTokens, outputTokens, provider: 'openai', model };
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced ? fenced[1] : text).trim());
}

// ─── Main gateway run ─────────────────────────────────────────────────────────

/**
 * Run an AI task through the gateway.
 *
 * @param {object} params
 * @param {string}  params.taskType         — from TASK_TIERS table
 * @param {string}  [params.agentName]      — for logging
 * @param {string}  [params.promptKey]      — from PromptRegistry
 * @param {string}  [params.promptVersion]  — '1.0'
 * @param {string[]}[params.entityIds]      — source entities for cache/log
 * @param {string}  [params.entityType]
 * @param {string}  params.systemPrompt
 * @param {string}  params.userMessage
 * @param {object}  [params.outputSchema]   — expected JSON shape for validation
 * @param {string}  [params.tierOverride]   — 'LOW'|'MID'|'HIGH'
 * @param {boolean} [params.skipCache]
 * @param {boolean} [params.forceRefresh]
 * @param {boolean} [params.approvalRequired]
 * @param {object}  [params.costFlags]      — feature gates
 * @returns {Promise<GatewayResult>}
 */
export async function run({
  taskType,
  agentName       = 'unknown',
  promptKey       = taskType,
  promptVersion   = '1.0',
  entityIds       = [],
  entityType      = null,
  systemPrompt    = '',
  userMessage     = '',
  outputSchema    = null,
  tierOverride    = null,
  skipCache       = false,
  forceRefresh    = false,
  approvalRequired= false,
  costFlags       = {},
}) {
  const startMs    = Date.now();
  const tier       = resolveTier(taskType, tierOverride);
  const inputHash  = buildInputHash(taskType, entityIds, { systemPrompt, userMessage });
  const staleAt    = staleAfter(taskType);

  // ── 1. Cost feature gate ──────────────────────────────────────────────────
  if (costFlags.deterministicOnly) {
    throw new GatewayError(`AI disabled (deterministicOnly mode): ${taskType}`, 'FEATURE_DISABLED');
  }
  if (costFlags.draftingOnly && tier === 'HIGH') {
    throw new GatewayError(`HIGH tier blocked (draftingOnly mode): ${taskType}`, 'TIER_BLOCKED');
  }
  if (costFlags.midTierOnly   && tier === 'HIGH') {
    throw new GatewayError(`HIGH tier blocked (midTierOnly mode): ${taskType}`, 'TIER_BLOCKED');
  }

  // ── 2. Cache check (AIArtifactCache) ──────────────────────────────────────
  const cacheKeyParams = { taskType, promptVersion, modelRoute: tier, entityIds, inputPayload: { systemPrompt, userMessage } };

  if (!skipCache && !forceRefresh) {
    const cached = AIArtifactCache.get(cacheKeyParams);
    if (cached) {
      _logAndTrack({ agentName, promptKey, promptVersion, taskType, tier,
        provider: 'cache', model: 'cache', inputTokens: 0, outputTokens: 0,
        cached: true, fallbackUsed: false, parseSuccess: true, approvalRequired,
        latencyMs: Date.now() - startMs, inputHash, entityIds });

      return {
        content:         cached.content,
        provider_used:   'cache',
        model_used:      'cache',
        tier_used:       tier,
        fallback_used:   false,
        cached:          true,
        input_hash:      inputHash,
        generated_at:    cached.meta?.createdAt ?? new Date().toISOString(),
        stale_after:     staleAt,
        token_usage:     { input: 0, output: 0, total: 0 },
        estimated_cost:  0,
        confidence:      'high',
        parse_success:   true,
        approval_required: approvalRequired,
      };
    }
  }

  // ── 3. Primary: Anthropic ─────────────────────────────────────────────────
  const anthropicCfg = PROVIDERS.anthropic;
  const anthropicModel    = anthropicCfg.models[tier];
  const anthropicMaxTok   = anthropicCfg.maxTokens[tier];

  let callResult = null;
  let fallbackUsed  = false;
  let errorInfo     = null;

  try {
    callResult = await callAnthropic({
      model:      anthropicModel,
      maxTokens:  anthropicMaxTok,
      timeoutMs:  anthropicCfg.timeoutMs[tier],
      systemPrompt,
      userMessage,
    });
  } catch (primaryErr) {
    console.warn(`[ModelGateway] Anthropic failed for ${taskType}: ${primaryErr.message}. Trying OpenAI fallback.`);
    errorInfo = primaryErr.message;

    // ── 4. Fallback: OpenAI ─────────────────────────────────────────────────
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiCfg = PROVIDERS.openai;
        callResult    = await callOpenAI({
          model:     openaiCfg.models[tier],
          maxTokens: openaiCfg.maxTokens[tier],
          systemPrompt,
          userMessage,
        });
        fallbackUsed = true;
      } catch (fbErr) {
        const latencyMs = Date.now() - startMs;
        const detFallback = AIFallbackService.buildFallback(taskType, { systemPrompt, userMessage, entityIds });

        _logAndTrack({ agentName, promptKey, promptVersion, taskType, tier,
          provider: 'deterministic', model: 'none', inputTokens: 0, outputTokens: 0,
          cached: false, fallbackUsed: true, parseSuccess: true, approvalRequired,
          latencyMs, inputHash, entityIds, errorType: 'BOTH_PROVIDERS_FAILED',
          errorMessage: `Primary: ${errorInfo}. OpenAI: ${fbErr.message}` });

        return {
          content:          detFallback.content,
          provider_used:    'deterministic_fallback',
          model_used:       'none',
          tier_used:        tier,
          fallback_used:    true,
          fallback_type:    'deterministic',
          fallback_reason:  detFallback.fallback_reason,
          cached:           false,
          input_hash:       inputHash,
          generated_at:     new Date().toISOString(),
          stale_after:      staleAt,
          token_usage:      { input: 0, output: 0, total: 0 },
          estimated_cost:   0,
          confidence:       'low',
          parse_success:    true,
          approval_required: approvalRequired,
        };
      }
    } else {
      const latencyMs = Date.now() - startMs;
      const detFallback = AIFallbackService.buildFallback(taskType, { systemPrompt, userMessage, entityIds });

      _logAndTrack({ agentName, promptKey, promptVersion, taskType, tier,
        provider: 'deterministic', model: anthropicModel, inputTokens: 0, outputTokens: 0,
        cached: false, fallbackUsed: true, parseSuccess: true, approvalRequired,
        latencyMs, inputHash, entityIds, errorType: 'MODEL_ERROR', errorMessage: primaryErr.message });

      return {
        content:          detFallback.content,
        provider_used:    'deterministic_fallback',
        model_used:       'none',
        tier_used:        tier,
        fallback_used:    true,
        fallback_type:    'deterministic',
        fallback_reason:  detFallback.fallback_reason,
        cached:           false,
        input_hash:       inputHash,
        generated_at:     new Date().toISOString(),
        stale_after:      staleAt,
        token_usage:      { input: 0, output: 0, total: 0 },
        estimated_cost:   0,
        confidence:       'low',
        parse_success:    true,
        approval_required: approvalRequired,
      };
    }
  }

  // ── 5. Parse output ───────────────────────────────────────────────────────
  let content, parseSuccess;
  try {
    content      = extractJSON(callResult.rawText);
    parseSuccess = true;
  } catch {
    content      = callResult.rawText;
    parseSuccess = false;
  }

  // ── 6. Validate against schema — retry once on failure, then fallback ────
  let validationWarning  = null;
  let schemaRetried      = false;

  if (parseSuccess && agentName) {
    const baseCheck = validateBaseSchema(content);
    if (!baseCheck.valid) {
      console.warn(`[ModelGateway] Base schema invalid for ${taskType} (${agentName}). Errors: ${baseCheck.errors.join('; ')}. Retrying once.`);
      schemaRetried = true;

      const repairMsg = buildRepairPrompt(callResult.rawText, baseCheck.errors);
      let repairRaw   = null;
      try {
        const repairResult = await callAnthropic({
          model:       PROVIDERS.anthropic.models[tier],
          maxTokens:   PROVIDERS.anthropic.maxTokens[tier],
          timeoutMs:   PROVIDERS.anthropic.timeoutMs[tier],
          systemPrompt: 'You are a JSON repair assistant. Return only valid JSON.',
          userMessage:  repairMsg,
        });
        repairRaw = repairResult.rawText;
        const repaired = extractJSON(repairRaw);
        const recheck  = validateBaseSchema(repaired);
        if (recheck.valid) {
          content      = repaired;
          parseSuccess = true;
          validationWarning = null;
        } else {
          // Repair still failed — use local coercion
          content      = repairOutput(repaired ?? content, agentName);
          validationWarning = `Schema repair used coercion. Remaining errors: ${recheck.errors.join('; ')}`;
        }
      } catch (repairErr) {
        console.warn(`[ModelGateway] Schema repair call failed for ${taskType}: ${repairErr.message}. Using coercion fallback.`);
        content      = repairOutput(content, agentName) ?? buildEmptyFallback(agentName, 'schema repair failed');
        validationWarning = 'Schema repair failed — coercion fallback applied';
      }
    }
  }

  if (outputSchema && parseSuccess && !schemaRetried) {
    const vResult = OutputValidator.validate(content, outputSchema);
    if (!vResult.valid) {
      validationWarning = `Schema mismatch: ${vResult.errors.join(', ')}`;
      console.warn(`[ModelGateway] Output schema validation warning for ${taskType}: ${validationWarning}`);
    }
  }

  // ── 7. Cache result (AIArtifactCache) ─────────────────────────────────────
  AIArtifactCache.set(
    cacheKeyParams,
    { provider: callResult.provider, model: callResult.model, entityType, agentName, generatedAt: new Date().toISOString() },
    content
  );

  // ── 8. Cost + log ─────────────────────────────────────────────────────────
  const latencyMs      = Date.now() - startMs;
  const estimatedCost  = CostControlService.estimateCost(callResult.model, callResult.inputTokens, callResult.outputTokens);

  _logAndTrack({
    agentName, promptKey, promptVersion, taskType, tier,
    provider: callResult.provider, model: callResult.model,
    inputTokens: callResult.inputTokens, outputTokens: callResult.outputTokens,
    cached: false, fallbackUsed, parseSuccess, approvalRequired,
    latencyMs, inputHash, entityIds, estimatedCost,
    outputPreview: content,
  });

  return {
    content,
    provider_used:    callResult.provider,
    model_used:       callResult.model,
    tier_used:        tier,
    fallback_used:    fallbackUsed,
    cached:           false,
    input_hash:       inputHash,
    generated_at:     new Date().toISOString(),
    stale_after:      staleAt,
    source_snapshot_hash: inputHash,
    token_usage:      { input: callResult.inputTokens, output: callResult.outputTokens, total: callResult.inputTokens + callResult.outputTokens },
    estimated_cost:   estimatedCost,
    confidence:       parseSuccess ? 'medium' : 'low',
    parse_success:    parseSuccess,
    validation_warning: validationWarning,
    approval_required: approvalRequired,
  };
}

// ─── Internal logging helper ──────────────────────────────────────────────────

function _logAndTrack({ agentName, promptKey, promptVersion, taskType, tier,
  provider, model, inputTokens, outputTokens, cached, fallbackUsed, parseSuccess,
  approvalRequired, latencyMs, inputHash, entityIds, estimatedCost = 0,
  errorType = null, errorMessage = null, outputPreview = null }) {

  AgentRunLogger.logRun({
    agent_name:     agentName,
    prompt_key:     promptKey,
    prompt_version: promptVersion,
    task_type:      taskType,
    model_used:     model,
    fallback_used:  fallbackUsed,
    fallback_reason: fallbackUsed ? `Primary provider failed; used ${provider}` : null,
    input_hash:     inputHash,
    source_entities: entityIds,
    latency_ms:     latencyMs,
    token_usage:    { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    estimated_cost: estimatedCost || CostControlService.estimateCost(model, inputTokens, outputTokens),
    confidence:     parseSuccess ? 'medium' : 'low',
    approval_required: approvalRequired,
    cached,
    parse_success:  parseSuccess,
    error_type:     errorType,
    error_message:  errorMessage,
    output_preview: outputPreview,
  });

  CostControlService.recordRun({
    agentName, taskType, model, inputTokens, outputTokens,
    cached, fallbackUsed, success: !errorType, latencyMs,
  });
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export function getTaskTier(taskType)    { return TASK_TIERS[taskType] ?? 'LOW'; }
export function listTaskRoutes()          { return Object.entries(TASK_TIERS).map(([task, tier]) => ({ task, tier, model: PROVIDERS.anthropic.models[tier] })); }
export function getProviderModels()       { return PROVIDERS; }
export function getConfigSummary()        { return ProviderConfig.getConfigSummary(); }

export default { run, getTaskTier, listTaskRoutes, getProviderModels, getConfigSummary, GatewayError };
