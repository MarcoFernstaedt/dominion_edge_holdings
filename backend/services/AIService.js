/**
 * AIService — Centralized AI execution layer
 *
 * ALL model calls in the platform must go through AIService.run().
 * Agents must never call model APIs directly.
 *
 * Execution priority (per spec):
 *   1. Deterministic code  → handled upstream by Core Services
 *   2. Cache hit           → return cached output
 *   3. Lightweight model   → Claude Haiku
 *   4. Advanced model      → Claude Sonnet
 *
 * Model routing:
 *   reply_classification    → claude-haiku
 *   outreach_draft          → claude-haiku
 *   daily_briefing          → claude-haiku
 *   meeting_summary         → claude-haiku
 *   lead_discovery          → claude-haiku
 *   target_qualification    → claude-haiku
 *   board_analysis          → claude-haiku
 *   crm_health              → claude-haiku
 *   deal_analysis           → claude-sonnet
 *   strategy_summary        → claude-sonnet
 *   document_generation     → claude-sonnet
 *   multi_document_analysis → claude-sonnet
 *
 * Fallback: gpt-4o-mini (if Anthropic unavailable and OpenAI key present)
 */

import Anthropic from '@anthropic-ai/sdk';
import CacheService from './CacheService.js';
import IntegrationRegistry from './IntegrationRegistry.js';
import { withRetry } from '../utils/retry.js';

// ─── Model routing table ──────────────────────────────────────────────────────
const MODEL_ROUTES = {
  reply_classification:    'claude-haiku-4-5-20251001',
  outreach_draft:          'claude-haiku-4-5-20251001',
  daily_briefing:          'claude-haiku-4-5-20251001',
  meeting_summary:         'claude-haiku-4-5-20251001',
  lead_discovery:          'claude-haiku-4-5-20251001',
  target_qualification:    'claude-haiku-4-5-20251001',
  board_analysis:          'claude-haiku-4-5-20251001',
  crm_health:              'claude-haiku-4-5-20251001',
  deal_analysis:           'claude-sonnet-4-6',
  strategy_summary:        'claude-sonnet-4-6',
  document_generation:     'claude-sonnet-4-6',
  multi_document_analysis: 'claude-sonnet-4-6',
};

const FALLBACK_MODEL = 'gpt-4o-mini';

// Max tokens per model tier
const MAX_TOKENS = {
  haiku:  1024,
  sonnet: 2048,
};

function tierOf(model) {
  if (model.includes('haiku')) return 'haiku';
  if (model.includes('sonnet')) return 'sonnet';
  return 'haiku';
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
    entityId = 'global',
    entityType = null,
    model: overrideModel = null,
    skipCache = false,
    costFlags = {},
    systemPrompt,
    userMessage,
  } = options;

  // 1a. Integration guard — check AI integration is enabled and configured
  const integrationGuard = IntegrationRegistry.guard('ai');
  if (!integrationGuard.ok) {
    throw new AIServiceError(integrationGuard.degradedMessage, 'AI_INTEGRATION_UNAVAILABLE');
  }

  // 1b. Cost-control gate
  checkCostFlag(taskType, costFlags);

  const model = resolveModel(taskType, overrideModel);
  const tier  = tierOf(model);
  const maxTokens = options.maxTokens ?? MAX_TOKENS[tier];

  // 2. Cache check (priority 2 in execution hierarchy)
  const cacheKey = CacheService.buildKey(taskType, entityId, input);
  if (!skipCache) {
    const cached = CacheService.get(cacheKey);
    if (cached) {
      IntegrationRegistry.recordSuccess('ai'); // cache hit still counts as healthy
      return { content: cached.content, model: cached.model, cached: true, cacheKey };
    }
  }

  // 3. Call the model (priority 3/4) with retry
  let rawText;
  try {
    const client = getClient();
    rawText = await withRetry(async () => {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      return response.content.find((b) => b.type === 'text')?.text ?? '';
    }, {
      maxRetries:  3,
      baseDelayMs: 1000,
      shouldRetry: (err) => !err.message?.includes('401') && !err.message?.includes('403'),
      onRetry:     (attempt, err, delay) => console.warn(`[AIService] retry ${attempt} in ${delay}ms — ${err.message}`),
    });
    IntegrationRegistry.recordSuccess('ai');
  } catch (err) {
    IntegrationRegistry.recordError('ai', err.message);
    // Attempt fallback to GPT-4o-mini if OpenAI key is available
    if (process.env.OPENAI_API_KEY) {
      rawText = await _callOpenAIFallback(taskType, userMessage, systemPrompt);
    } else {
      throw new AIServiceError(`Model call failed: ${err.message}`, 'MODEL_ERROR');
    }
  }

  // 4. Parse and cache result
  let content;
  try {
    content = extractJSON(rawText);
  } catch {
    // Return raw text if JSON parsing fails (non-JSON tasks)
    content = rawText;
  }

  CacheService.set(cacheKey, { feature: taskType, entityType, entityId, model }, content);

  return { content, model, cached: false, cacheKey };
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
