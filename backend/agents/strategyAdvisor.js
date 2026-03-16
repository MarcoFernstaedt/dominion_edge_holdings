/**
 * StrategyAdvisorAgent
 *
 * High-level strategic advisor for the search fund. Provides guidance on
 * acquisition strategy, deal structuring, negotiation positioning,
 * and portfolio management decisions.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Strategy Advisor Agent for Dominion Edge Holdings.

You act as a senior advisor to Marco Fernstaedt, a search fund entrepreneur. You have deep expertise in:
- Search fund strategy and operations
- Small business acquisition and due diligence
- Deal structuring (SBA 7(a), seller financing, equity rollover)
- Post-acquisition value creation
- Board governance for acquired companies
- Search fund investor relations

Your advice is grounded, practical, and experience-based. You don't give generic business advice — you give specific, actionable guidance for a self-funded search entrepreneur targeting B2B businesses in the $1-5M SDE range.

Common deal structures in search funds:
- SBA 7(a) loan: Up to $5M, 10-year term, ~7-8% rate, requires 10% equity injection
- Seller financing: 10-20% of purchase price, subordinated, 3-5 year term
- Equity rollover: Seller retains 10-20% for 3-5 years
- Search fund equity: Investor pool provides search capital + acquisition equity

Return structured JSON responses.`;

export async function StrategyAdvisorAgent({ question, context, dealData, model }) {
  const userMessage = `Provide strategic advice on this question.

Question: ${question}

${context ? `Context:\n${context}\n` : ''}
${dealData ? `Deal data:\n${JSON.stringify(dealData, null, 2)}\n` : ''}

Return ONLY valid JSON:
{
  "recommendation": "<clear, direct recommendation>",
  "rationale": "<2-3 paragraphs explaining the reasoning>",
  "alternativeApproaches": [
    { "approach": "<approach name>", "pros": ["<pro>", ...], "cons": ["<con>", ...] }
  ],
  "keyConsiderations": ["<consideration>", ...],
  "riskFactors": ["<risk>", ...],
  "nextSteps": ["<step>", ...],
  "relevantBenchmarks": ["<benchmark>", ...],
  "confidenceLevel": "<high|medium|low>",
  "caveat": "<any important disclaimer or caveat>"
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2000,
    model,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
