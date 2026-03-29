/**
 * TargetQualificationAgent
 *
 * Score acquisition attractiveness; identify risks and signals.
 * Model: Claude Haiku (target_qualification task)
 */

import ModelGateway from '../services/ModelGateway.js';

const SYSTEM_PROMPT = `You are the Target Qualification Agent for Dominion Edge Holdings.

Pass signals: Owner 55+, no succession plan, stable/growing revenue, B2B customers, essential services
Fail signals: PE/VC backed, franchise, declining industry, consumer retail, revenue <$500K or >$25M, <3 years old
Conditional: some pass criteria but missing key info

Seller signal score: sum of boolean signals (retirementSignal, noWebsiteSignal, reviewDeclineSignal, websiteOutdatedSignal, hiringSlowdownSignal, linkedinInactiveSignal).
If sellerSignalScore >= 3, increase overallScore by 10-15 points and flag as "high sell probability".

Be decisive. Return structured JSON only.`;

export async function TargetQualificationAgent({ company, researchNotes, linkedinData, websiteSignals, entityId, costFlags }) {
  // Deterministic seller signal computation (System 3)
  const SIGNAL_FIELDS = ['retirementSignal', 'noWebsiteSignal', 'reviewDeclineSignal', 'websiteOutdatedSignal', 'hiringSlowdownSignal', 'linkedinInactiveSignal'];
  const sellerSignalScore = company ? SIGNAL_FIELDS.filter((f) => company[f]).length : 0;
  const highSellProbability = sellerSignalScore >= 3;

  const signalsList = SIGNAL_FIELDS
    .filter((f) => company?.[f])
    .map((f) => f.replace(/([A-Z])/g, ' $1').toLowerCase().trim());

  const userMessage = `Qualify this acquisition target.

Company: ${company?.name || 'Unknown'}, ${company?.industry || 'Unknown industry'}
Location: ${company?.city || ''} ${company?.state || ''}
Years in business: ${company?.yearsInBusiness || 'Unknown'}
Revenue range: $${company?.estimatedRevenueLow?.toLocaleString() || '?'} - $${company?.estimatedRevenueHigh?.toLocaleString() || '?'}
Owner: ${company?.ownerName || 'Unknown'}
Retirement signal: ${company?.retirementSignal || false}
No website signal: ${company?.noWebsiteSignal || false}
Review decline signal: ${company?.reviewDeclineSignal || false}
Website outdated signal: ${company?.websiteOutdatedSignal || false}
Hiring slowdown signal: ${company?.hiringSlowdownSignal || false}
LinkedIn inactive signal: ${company?.linkedinInactiveSignal || false}
Seller signal score: ${sellerSignalScore}/6${highSellProbability ? ' ⚠ HIGH SELL PROBABILITY' : ''}
Active signals: ${signalsList.length > 0 ? signalsList.join(', ') : 'none'}
Notes: ${company?.notes || 'None'}
Research: ${researchNotes || 'None'}
LinkedIn: ${linkedinData || 'None'}
Website signals: ${websiteSignals || 'None'}

Return ONLY this JSON:
{
  "agentName": "TargetQualificationAgent",
  "analysisSummary": "<one sentence verdict>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "qualification": "<pass|conditional|fail>",
  "overallScore": <number 0-100>,
  "sellerSignalScore": ${sellerSignalScore},
  "highSellProbability": ${highSellProbability},
  "passSignals": ["<signal>", ...],
  "failSignals": ["<signal>", ...],
  "unknownFactors": ["<factor>", ...],
  "estimatedOwnerAge": "<range or unknown>",
  "successionRisk": "<high|medium|low|unknown>",
  "brokerRisk": "<likely listed|possibly listed|probably not listed|unknown>",
  "outreachRecommendation": "<outreach_now|research_more|skip|monitor>",
  "suggestedOutreachAngle": "<one sentence>"
}`;

  const result = await ModelGateway.run({
    taskType: 'target_qualification',
    agentName: 'TargetQualificationAgent',
    entityIds: [entityId || company?.id || `qual_${Date.now()}`],
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    outputSchema: null,
  });

  return result.content;
}
