/**
 * DealAnalysisAgent
 *
 * Evaluate DSCR, compare underwriting scenarios, generate deal memo.
 * Model: Claude Sonnet (deal_analysis task — advanced reasoning tier)
 */

import AIService from '../services/AIService.js';

const SYSTEM_PROMPT = `You are the Deal Analysis Agent for Dominion Edge Holdings.

Analyze acquisition opportunities for a search fund. Criteria:
- Revenue $2M-$20M, SDE $500K-$5M, EBITDA margins 15%+
- Business age 5+ years, no customer > 30% revenue
- B2B services, industrial services, specialty distribution
- Avoid: consumer retail, franchises, PE-backed, declining industries

Valuation benchmarks: service 3-5x SDE, industrial 4-6x EBITDA

Return structured JSON only.`;

export async function DealAnalysisAgent({ company, financials = {}, notes, entityId, costFlags }) {
  const { revenue, sde, askingPrice, ebitda, ebitdaMargin } = financials;

  // Deterministic pre-calculation before AI call
  const impliedMultiple = sde && askingPrice ? (askingPrice / sde).toFixed(2) : null;
  const calcEbitdaMargin = revenue && ebitda ? ((ebitda / revenue) * 100).toFixed(1) : ebitdaMargin ?? null;

  const userMessage = `Analyze this acquisition opportunity.

Company: ${company?.name || 'Unknown'}, ${company?.industry || 'Unknown industry'}
Location: ${company?.city || ''} ${company?.state || ''}
Years in business: ${company?.yearsInBusiness || 'Unknown'}
Retirement signal: ${company?.retirementSignal || false}

Financials:
- Revenue: $${revenue?.toLocaleString() || 'Unknown'}
- SDE: $${sde?.toLocaleString() || 'Unknown'}
- EBITDA: $${ebitda?.toLocaleString() || 'Unknown'}
- EBITDA margin: ${calcEbitdaMargin ? calcEbitdaMargin + '%' : 'Unknown'}
- Asking price: $${askingPrice?.toLocaleString() || 'Unknown'}
- Implied SDE multiple: ${impliedMultiple ? impliedMultiple + 'x' : 'Unknown'}

Notes: ${notes || company?.notes || 'None'}

Return ONLY this JSON:
{
  "agentName": "DealAnalysisAgent",
  "analysisSummary": "<2-3 sentence deal summary>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "qualificationStatus": "<pass|conditional|fail>",
  "overallScore": <number 0-100>,
  "financialScreen": {
    "revenueInRange": <boolean>,
    "sdeInRange": <boolean>,
    "multipleReasonable": <boolean>,
    "marginAssessment": "<strong|acceptable|weak|unknown>"
  },
  "riskFactors": [{ "factor": "<risk>", "severity": "<low|medium|high|critical>", "notes": "<detail>" }],
  "strengthFactors": ["<strength>", ...],
  "investmentThesis": "<2-3 sentence thesis>",
  "recommendedNextStep": "<specific next action>",
  "loiReadiness": "<ready|more_diligence_needed|not_ready>",
  "suggestedPriceRange": { "low": <number>, "high": <number> },
  "keyDiligenceQuestions": ["<question>", ...]
}`;

  const result = await AIService.run('deal_analysis', { companyId: company?.id, revenue, sde, askingPrice }, {
    entityId: entityId || company?.id || `deal_${Date.now()}`,
    entityType: 'deal',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 2048,
    costFlags,
  });

  return result.content;
}
