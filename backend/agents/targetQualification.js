/**
 * TargetQualificationAgent
 *
 * Score acquisition attractiveness; identify risks and signals.
 * Model: Claude Haiku (target_qualification task)
 */

import AIService from '../services/AIService.js';

const SYSTEM_PROMPT = `You are the Target Qualification Agent for Dominion Edge Holdings.

Pass signals: Owner 55+, no succession plan, stable/growing revenue, B2B customers, essential services
Fail signals: PE/VC backed, franchise, declining industry, consumer retail, revenue <$500K or >$25M, <3 years old
Conditional: some pass criteria but missing key info

Be decisive. Return structured JSON only.`;

export async function TargetQualificationAgent({ company, researchNotes, linkedinData, websiteSignals, entityId, costFlags }) {
  const userMessage = `Qualify this acquisition target.

Company: ${company?.name || 'Unknown'}, ${company?.industry || 'Unknown industry'}
Location: ${company?.city || ''} ${company?.state || ''}
Years in business: ${company?.yearsInBusiness || 'Unknown'}
Revenue range: $${company?.estimatedRevenueLow?.toLocaleString() || '?'} - $${company?.estimatedRevenueHigh?.toLocaleString() || '?'}
Owner: ${company?.ownerName || 'Unknown'}
Retirement signal: ${company?.retirementSignal || false}
No website signal: ${company?.noWebsiteSignal || false}
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
  "passSignals": ["<signal>", ...],
  "failSignals": ["<signal>", ...],
  "unknownFactors": ["<factor>", ...],
  "estimatedOwnerAge": "<range or unknown>",
  "successionRisk": "<high|medium|low|unknown>",
  "brokerRisk": "<likely listed|possibly listed|probably not listed|unknown>",
  "outreachRecommendation": "<outreach_now|research_more|skip|monitor>",
  "suggestedOutreachAngle": "<one sentence>"
}`;

  const result = await AIService.run('target_qualification', { companyId: company?.id, industry: company?.industry }, {
    entityId: entityId || company?.id || `qual_${Date.now()}`,
    entityType: 'company',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    costFlags,
  });

  return result.content;
}
