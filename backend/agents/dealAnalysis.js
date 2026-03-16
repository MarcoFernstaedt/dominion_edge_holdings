/**
 * DealAnalysisAgent
 *
 * Performs structured deal analysis: financial screening, risk scoring,
 * LOI readiness assessment, and investment thesis generation.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Deal Analysis Agent for Dominion Edge Holdings.

You analyze potential acquisition targets for a search fund. The acquisition criteria:
- Revenue: $2M - $20M
- SDE/EBITDA: $500K - $5M
- EBITDA margins: 15%+ preferred
- Business age: 5+ years
- Customer concentration: No single customer > 30% revenue
- Owner dependency: Manageable with clear transition plan
- Industry: B2B services, industrial services, business services, specialty distribution
- Avoid: Consumer-facing retail, restaurants, real estate dependent, highly regulated (healthcare billing-heavy, financial), pure tech

Valuation benchmarks:
- Service businesses: 3-5x SDE
- Industrial/specialty: 4-6x EBITDA
- Software/recurring revenue: 6-10x ARR (premium)

Return structured JSON analysis only.`;

export async function DealAnalysisAgent({ company, financials, notes, model }) {
  const userMessage = `Analyze this acquisition opportunity.

Company: ${company?.name || 'Unknown'}
Industry: ${company?.industry || 'Unknown'}
City/State: ${company?.city || ''}, ${company?.state || ''}
Years in business: ${company?.yearsInBusiness || 'Unknown'}
Notes: ${notes || company?.notes || 'None'}

Financials:
- Estimated Revenue: $${financials?.revenue?.toLocaleString() || 'Unknown'}
- Estimated SDE: $${financials?.sde?.toLocaleString() || 'Unknown'}
- Asking Price: $${financials?.askingPrice?.toLocaleString() || 'Unknown'}
- Implied Multiple: ${financials?.sde && financials?.askingPrice ? (financials.askingPrice / financials.sde).toFixed(1) + 'x SDE' : 'Unknown'}

Return ONLY valid JSON:
{
  "qualificationStatus": "<pass|conditional|fail>",
  "overallScore": <number 0-100>,
  "financialScreen": {
    "revenueInRange": <boolean>,
    "sdeInRange": <boolean>,
    "multipleReasonable": <boolean>,
    "marginAssessment": "<strong|acceptable|weak|unknown>"
  },
  "riskFactors": [
    { "factor": "<risk>", "severity": "<low|medium|high|critical>", "notes": "<detail>" }
  ],
  "strengthFactors": ["<strength>", ...],
  "investmentThesis": "<2-3 sentence thesis if this is a pass/conditional>",
  "recommendedNextStep": "<specific next action>",
  "loiReadiness": "<ready|more_diligence_needed|not_ready>",
  "suggestedAskingPriceRange": { "low": <number>, "high": <number> },
  "keyDiligenceQuestions": ["<question>", ...]
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1500,
    model,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
