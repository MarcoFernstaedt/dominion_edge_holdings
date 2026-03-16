/**
 * Agent Orchestration System for Dominion Edge Holdings AOS
 *
 * Implements the agent specs from the Meeting Scheduling & Agent Execution Spec.
 * All agents share a common base pattern: receive context, call Claude with
 * structured tool-use, return typed results.
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Validated Anthropic model IDs (same whitelist as server.js)
const MODEL_WHITELIST = /^claude-(opus|sonnet|haiku|instant)-[0-9][-\w]*$/;

export function getSafeModel(requested) {
  const m = requested || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  if (!MODEL_WHITELIST.test(m)) return 'claude-sonnet-4-20250514';
  return m;
}

// ─── Base agent runner ────────────────────────────────────────────────────────
/**
 * Run a single-turn agent call with optional tool-use.
 * Returns the first text block from the response.
 */
export async function runAgent({ systemPrompt, userMessage, tools = [], model, maxTokens = 1024 }) {
  const params = {
    model: getSafeModel(model),
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  };
  if (tools.length > 0) params.tools = tools;

  const response = await anthropic.messages.create(params);
  return response;
}

/**
 * Extract JSON from Claude's response text (handles markdown code fences).
 */
export function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}

export { ResponseAnalysisAgent } from './responseAnalysis.js';
export { CalendarSchedulingAgent } from './calendarScheduling.js';
export { DailyOperationsAgent } from './dailyOperations.js';
export { BoardBuilderAgent } from './boardBuilder.js';
export { OutreachGenerationAgent } from './outreachGeneration.js';
export { DealAnalysisAgent } from './dealAnalysis.js';
export { CRMStewardAgent } from './crmSteward.js';
export { LeadDiscoveryAgent } from './leadDiscovery.js';
export { TargetQualificationAgent } from './targetQualification.js';
export { StrategyAdvisorAgent } from './strategyAdvisor.js';
