/**
 * StrategyAdvisorAgent
 *
 * Identify bottlenecks, summarize pipeline health, recommend focus areas.
 * Model: Claude Sonnet (strategy_summary task — advanced reasoning tier)
 */

import AIService from '../services/AIService.js';

const SYSTEM_PROMPT = `You are the Strategy Advisor Agent for Dominion Edge Holdings.

Senior advisor to a search fund entrepreneur (Marco Fernstaedt). Expertise:
- Search fund strategy and operations
- SMB acquisition and due diligence
- Deal structuring: SBA 7(a) ($5M max, 10yr, ~7-8%), seller financing (10-20%, subordinated), equity rollover (10-20% for 3-5 yrs)
- Post-acquisition value creation
- Board governance

Advice is specific, actionable, and grounded in search fund best practices. Return structured JSON only.`;

export async function StrategyAdvisorAgent({ question, context, dealData, entityId, costFlags }) {
  const userMessage = `Provide strategic advice.

Question: ${question}
${context ? `\nContext:\n${context}` : ''}
${dealData ? `\nDeal data:\n${JSON.stringify(dealData, null, 2)}` : ''}

Return ONLY this JSON:
{
  "agentName": "StrategyAdvisorAgent",
  "analysisSummary": "<one sentence recommendation>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "recommendation": "<clear, direct recommendation>",
  "rationale": "<2-3 paragraphs>",
  "alternativeApproaches": [
    { "approach": "<name>", "pros": ["<pro>", ...], "cons": ["<con>", ...] }
  ],
  "keyConsiderations": ["<consideration>", ...],
  "riskFactors": ["<risk>", ...],
  "nextSteps": ["<step>", ...],
  "confidenceLevel": "<high|medium|low>"
}`;

  const result = await AIService.run('strategy_summary', { question: question.slice(0, 100) }, {
    entityId: entityId || `strategy_${Date.now()}`,
    entityType: 'strategy',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
    costFlags,
  });

  return result.content;
}
