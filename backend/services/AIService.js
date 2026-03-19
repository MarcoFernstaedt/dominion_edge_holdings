/**
 * AIService — Centralized AI execution layer (ModelGateway)
 *
 * ALL model calls in the platform must go through AIService.run().
 * No module, agent, or route handler should call model SDKs directly.
 *
 * Execution priority:
 *   1. Deterministic code  → handled upstream by Core Services
 *   2. Cache hit           → return cached artifact
 *   3. Primary model       → tier-appropriate model via MODEL_ROUTES
 *   4. Fallback model      → gpt-4o-mini if Anthropic unavailable
 *   5. Non-AI fallback     → caller's fallback_behavior (not handled here)
 *
 * Model tiers (from PromptRegistry.MODEL_TIER):
 *   LOW  → classification, short summaries, field extraction   → claude-haiku
 *   MID  → drafting, meeting prep, deal summaries              → claude-haiku (upgraded to sonnet when justified)
 *   HIGH → complex tradeoff, capital stack, strategy           → claude-sonnet
 *
 * Routing rule: always use the cheapest model that can do the job reliably.
 * Never default to the strongest model. Escalate only when justified.
 *
 * Every run is logged to AgentRunLogger and cost-tracked by CostControlService.
 */

import Anthropic from '@anthropic-ai/sdk';
import CacheService from './CacheService.js';
import IntegrationRegistry from './IntegrationRegistry.js';
import CostControlService from './CostControlService.js';
import AgentRunLogger from './AgentRunLogger.js';
import { withRetry } from '../utils/retry.js';

// ─── Model routing table ──────────────────────────────────────────────────────
// Rule: map task_type → cheapest model that reliably handles it.
// LOW tier tasks → haiku. MID tier → haiku (most) or sonnet for complex.
// HIGH tier → sonnet. Never default to opus.

const MODELS = {
  LOW:  'claude-haiku-4-5-20251001',
  MID:  'claude-haiku-4-5-20251001', // upgrade to sonnet for complex mid tasks
  HIGH: 'claude-sonnet-4-6',
};

const MODEL_ROUTES = {
  // ── LOW tier ────────────────────────────────────────────────────────────────
  reply_classification:      MODELS.LOW,
  document_classification:   MODELS.LOW,
  short_summary:             MODELS.LOW,
  field_extraction:          MODELS.LOW,
  crm_health:                MODELS.LOW,
  execution_diagnostic:      MODELS.LOW,
  outreach_small_rewrite:    MODELS.LOW,
  seller_signal_tagging:     MODELS.LOW,
  activity_categorization:   MODELS.LOW,
  subject_line_generation:   MODELS.LOW,

  // ── MID tier ────────────────────────────────────────────────────────────────
  outreach_draft:             MODELS.MID,
  daily_briefing:             MODELS.MID,
  meeting_summary:            MODELS.MID,
  meeting_prep:               MODELS.MID,
  board_analysis:             MODELS.MID,
  board_candidate_ranking:    MODELS.MID,
  lead_discovery:             MODELS.MID,
  target_qualification:       MODELS.MID,
  deal_scout_screening:       MODELS.LOW,  // short screening = low
  deal_scout_rich:            MODELS.MID,
  investor_fit_summary:       MODELS.MID,
  execution_recovery:         MODELS.MID,
  empire_coach_daily:         MODELS.MID,
  investor_outreach_draft:    MODELS.MID,
  execution_brief:            MODELS.MID,
  memo_section_draft:         MODELS.MID,

  // ── HIGH tier ───────────────────────────────────────────────────────────────
  deal_analysis:              MODELS.HIGH,
  strategy_summary:           MODELS.HIGH,
  empire_coach_strategy:      MODELS.HIGH,
  document_generation:        MODELS.HIGH,
  multi_document_analysis:    MODELS.HIGH,
  underwriter_commentary:     MODELS.HIGH,
  diligence_synthesis_large:  MODELS.HIGH,
  capital_stack_commentary:   MODELS.HIGH,
  board_outreach_draft:       MODELS.HIGH,  // high-stakes personalized invite
  investor_memo_draft:        MODELS.HIGH,
  outreach_high_stakes:       MODELS.HIGH,
};

const FALLBACK_MODEL = 'gpt-4o-mini';

// Max tokens per model
const MAX_TOKENS = {
  'claude-haiku-4-5-20251001': 1024,
  'claude-sonnet-4-6':         2048,
  'claude-opus-4-6':           4096,
  'gpt-4o-mini':               1024,
};

// Timeouts per tier (ms)
const TIMEOUTS = {
  'claude-haiku-4-5-20251001': 15_000,
  'claude-sonnet-4-6':         45_000,
  'gpt-4o-mini':               20_000,
};

function tierOf(model) {
  if (model.includes('haiku'))  return 'LOW';
  if (model.includes('sonnet')) return 'HIGH';
  if (model.includes('opus'))   return 'HIGH';
  return 'LOW';
}

// ─── Cost-control flags (read from store.settings, injected at call time) ─────
// Callers pass costFlags to let AIService enforce feature gates.
function checkCostFlag(taskType, costFlags = {}) {
  const gates = {
    reply_classification:    costFlags.enableAIReplySuggestions,
    outreach_draft:          costFlags.enableAIOutreachDrafts,
    deal_analysis:           costFlags.enableDealAnalysis,
    strategy_summary:        costFlags.enableStrategyInsights,
    multi_document_analysis: costFlags.enableDealAnalysis,
    document_generation:     costFlags.enableDealAnalysis,
  };
  // If the gate is explicitly defined and false, block the call
  if (taskType in gates && gates[taskType] === false) {
    throw new AIServiceError(`AI feature disabled for task type: ${taskType}`, 'FEATURE_DISABLED');
  }
}

// ─── Validated model selection ────────────────────────────────────────────────
const MODEL_WHITELIST = /^claude-(opus|sonnet|haiku|instant)-[0-9][-\w]*$|^gpt-/;

function resolveModel(taskType, overrideModel) {
  if (overrideModel && MODEL_WHITELIST.test(overrideModel)) return overrideModel;
  return MODEL_ROUTES[taskType] ?? MODEL_ROUTES.daily_briefing; // haiku as safe default
}

// ─── Error type ───────────────────────────────────────────────────────────────
export class AIServiceError extends Error {
  constructor(message, code = 'AI_ERROR') {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
  }
}

// ─── Anthropic client (lazy — only created if API key present) ────────────────
let _client = null;
function getClient() {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AIServiceError('ANTHROPIC_API_KEY not set', 'NO_API_KEY');
    }
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// ─── Helper: extract JSON from model response ─────────────────────────────────
function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

// ─── Core run function ────────────────────────────────────────────────────────
/**
 * Execute an AI task.
 *
 * @param {string} taskType     One of the MODEL_ROUTES keys
 * @param {object} input        Task-specific payload
 * @param {object} [options]
 * @param {string}  [options.entityId]    For cache keying
 * @param {string}  [options.entityType]  For cache metadata
 * @param {string}  [options.model]       Override model (validated)
 * @param {number}  [options.maxTokens]   Override max tokens
 * @param {boolean} [options.skipCache]   Force fresh call
 * @param {object}  [options.costFlags]   Feature gate flags from settings
 * @param {string}  [options.systemPrompt]
 * @param {string}  [options.userMessage]
 * @returns {Promise<{ content: *, model: string, cached: boolean, cacheKey: string|null }>}
 */
export async function run(taskType, input, options = {}) {
  const {
    entityId      = 'global',
    entityType    = null,
    agentName     = 'unknown',
    promptKey     = taskType,
    promptVersion = '1.0',
    sourceEntities= [],
    model: overrideModel = null,
    skipCache     = false,
    costFlags     = {},
    systemPrompt,
    userMessage,
  } = options;

  const startMs = Date.now();
  let modelUsed     = null;
  let fallbackUsed  = false;
  let fallbackReason= null;
  let inputTokens   = 0;
  let outputTokens  = 0;
  let parseSuccess  = true;
  let errorType     = null;
  let errorMessage  = null;

  // 1a. Integration guard
  const integrationGuard = IntegrationRegistry.guard('ai');
  if (!integrationGuard.ok) {
    throw new AIServiceError(integrationGuard.degradedMessage, 'AI_INTEGRATION_UNAVAILABLE');
  }

  // 1b. Cost-control feature gate
  checkCostFlag(taskType, costFlags);

  const model     = resolveModel(taskType, overrideModel);
  modelUsed       = model;
  const maxTokens = options.maxTokens ?? (MAX_TOKENS[model] ?? 1024);

  // 2. Cache check
  const inputHash = CacheService.buildKey(taskType, entityId, input);
  if (!skipCache) {
    const cached = CacheService.get(inputHash);
    if (cached) {
      IntegrationRegistry.recordSuccess('ai');

      // Log cache hit
      AgentRunLogger.logRun({
        agent_name:     agentName,
        prompt_key:     promptKey,
        prompt_version: promptVersion,
        task_type:      taskType,
        model_used:     model,
        fallback_used:  false,
        input_hash:     inputHash,
        source_entities: sourceEntities,
        latency_ms:     Date.now() - startMs,
        token_usage:    { input: 0, output: 0, total: 0 },
        estimated_cost: 0,
        confidence:     'high',
        cached:         true,
        parse_success:  true,
      });

      CostControlService.recordRun({
        agentName, taskType, model, inputTokens: 0, outputTokens: 0,
        cached: true, fallbackUsed: false, success: true,
        latencyMs: Date.now() - startMs,
      });

      return { content: cached.content, model: cached.model, cached: true, cacheKey: inputHash };
    }
  }

  // 3. Call the model with retry
  let rawText;
  let anthropicResponse;

  try {
    const client = getClient();
    rawText = await withRetry(async () => {
      anthropicResponse = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      inputTokens  = anthropicResponse.usage?.input_tokens  ?? 0;
      outputTokens = anthropicResponse.usage?.output_tokens ?? 0;
      return anthropicResponse.content.find((b) => b.type === 'text')?.text ?? '';
    }, {
      maxRetries:  2, // 3 total attempts
      baseDelayMs: 1500,
      shouldRetry: (err) => !err.message?.includes('401') && !err.message?.includes('403'),
      onRetry:     (attempt, err, delay) =>
        console.warn(`[AIService] retry ${attempt}/${2} in ${delay}ms — ${err.message}`),
    });
    IntegrationRegistry.recordSuccess('ai');

  } catch (err) {
    IntegrationRegistry.recordError('ai', err.message);
    errorType    = 'MODEL_ERROR';
    errorMessage = err.message;

    // Attempt fallback to GPT-4o-mini
    if (process.env.OPENAI_API_KEY) {
      try {
        rawText       = await _callOpenAIFallback(taskType, userMessage, systemPrompt);
        modelUsed     = FALLBACK_MODEL;
        fallbackUsed  = true;
        fallbackReason= `Primary model failed: ${err.message}`;
        errorType     = null;
        errorMessage  = null;
      } catch (fbErr) {
        // Both models failed — log and throw
        const latency = Date.now() - startMs;
        AgentRunLogger.logRun({
          agent_name: agentName, prompt_key: promptKey, prompt_version: promptVersion,
          task_type: taskType, model_used: model, fallback_used: true,
          fallback_reason: `Both primary and fallback failed: ${fbErr.message}`,
          input_hash: inputHash, source_entities: sourceEntities, latency_ms: latency,
          token_usage: { input: 0, output: 0, total: 0 }, estimated_cost: 0,
          confidence: 'low', cached: false, parse_success: false,
          error_type: 'FALLBACK_FAILED', error_message: fbErr.message,
        });
        CostControlService.recordRun({
          agentName, taskType, model, inputTokens: 0, outputTokens: 0,
          cached: false, fallbackUsed: true, success: false, latencyMs: latency,
        });
        throw new AIServiceError(`Model call failed: ${err.message}`, 'MODEL_ERROR');
      }
    } else {
      const latency = Date.now() - startMs;
      AgentRunLogger.logRun({
        agent_name: agentName, prompt_key: promptKey, prompt_version: promptVersion,
        task_type: taskType, model_used: model, fallback_used: false,
        input_hash: inputHash, source_entities: sourceEntities, latency_ms: latency,
        token_usage: { input: 0, output: 0, total: 0 }, estimated_cost: 0,
        confidence: 'low', cached: false, parse_success: false,
        error_type: 'MODEL_ERROR', error_message: err.message,
      });
      CostControlService.recordRun({
        agentName, taskType, model, inputTokens: 0, outputTokens: 0,
        cached: false, fallbackUsed: false, success: false, latencyMs: Date.now() - startMs,
      });
      throw new AIServiceError(`Model call failed: ${err.message}`, 'MODEL_ERROR');
    }
  }

  // 4. Parse result
  let content;
  try {
    content      = extractJSON(rawText);
    parseSuccess = true;
  } catch {
    content      = rawText;
    parseSuccess = false;
  }

  // 5. Cache result
  CacheService.set(inputHash, { feature: taskType, entityType, entityId, model: modelUsed }, content);

  // 6. Estimate cost
  const estimatedCost = CostControlService.estimateCost(modelUsed, inputTokens, outputTokens);
  const latencyMs     = Date.now() - startMs;

  // 7. Log run
  AgentRunLogger.logRun({
    agent_name:     agentName,
    prompt_key:     promptKey,
    prompt_version: promptVersion,
    task_type:      taskType,
    model_used:     modelUsed,
    fallback_used:  fallbackUsed,
    fallback_reason: fallbackReason,
    input_hash:     inputHash,
    source_entities: sourceEntities,
    latency_ms:     latencyMs,
    token_usage:    { input: inputTokens, output: outputTokens, total: inputTokens + outputTokens },
    estimated_cost: estimatedCost,
    confidence:     parseSuccess ? 'medium' : 'low',
    cached:         false,
    parse_success:  parseSuccess,
    error_type:     errorType,
    error_message:  errorMessage,
    output_preview: content,
  });

  // 8. Record cost
  CostControlService.recordRun({
    agentName, taskType, model: modelUsed,
    inputTokens, outputTokens,
    cached: false, fallbackUsed, success: true, latencyMs,
  });

  return {
    content,
    model:    modelUsed,
    cached:   false,
    cacheKey: inputHash,
    fallbackUsed,
    tokenUsage:    { input: inputTokens, output: outputTokens },
    estimatedCost,
    latencyMs,
  };
}

// ─── OpenAI fallback ──────────────────────────────────────────────────────────
async function _callOpenAIFallback(taskType, userMessage, systemPrompt) {
  // Dynamic import so OpenAI SDK is optional
  const { default: OpenAI } = await import('openai').catch(() => {
    throw new AIServiceError('OpenAI SDK not installed; cannot use fallback', 'FALLBACK_UNAVAILABLE');
  });
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userMessage });
  const res = await openai.chat.completions.create({
    model: FALLBACK_MODEL,
    messages,
    max_tokens: 1024,
  });
  return res.choices[0]?.message?.content ?? '';
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────
export function getModelForTask(taskType) {
  return MODEL_ROUTES[taskType] ?? null;
}

export function listRoutes() {
  return Object.entries(MODEL_ROUTES).map(([task, model]) => ({ task, model }));
}

export const AIService = { run, getModelForTask, listRoutes };
export default AIService;
