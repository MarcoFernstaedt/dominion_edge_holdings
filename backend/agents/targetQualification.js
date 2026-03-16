/**
 * TargetQualificationAgent
 *
 * Quickly qualifies or disqualifies a company as an acquisition target
 * based on available signals. Used during initial research phase before
 * outreach begins.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Target Qualification Agent for Dominion Edge Holdings.

You quickly assess if a company is worth pursuing as an acquisition target. You look for positive signals (retirement-age owner, stable revenue, B2B, no broker yet) and disqualifying signals (consumer retail, franchise, PE-backed, too large, declining industry).

Your output drives whether to invest outreach effort or move on. Be decisive.

Qualification criteria:
PASS signals: Owner 55+, no succession plan visible, stable/growing revenue, B2B customers, essential services, proprietor-style business
FAIL signals: PE/VC backed, franchise, declining industry, consumer retail, highly regulated, revenue <$500K or >$25M, less than 3 years old
CONDITIONAL signals: Some pass criteria but missing key info, needs a call to verify

Return structured JSON only.`;

export async function TargetQualificationAgent({ company, researchNotes, linkedinData, websiteSignals, model }) {
  const userMessage = `Qualify this acquisition target.

Company name: ${company?.name || 'Unknown'}
Industry: ${company?.industry || 'Unknown'}
Location: ${company?.city || ''} ${company?.state || ''}
Years in business: ${company?.yearsInBusiness || 'Unknown'}
Estimated revenue: $${company?.estimatedRevenueLow ? company.estimatedRevenueLow.toLocaleString() : 'Unknown'} - $${company?.estimatedRevenueHigh ? company.estimatedRevenueHigh.toLocaleString() : 'Unknown'}
Owner name: ${company?.ownerName || 'Unknown'}
Website: ${company?.website || 'None'}
No website signal: ${company?.noWebsiteSignal || false}
Retirement signal: ${company?.retirementSignal || false}

Research notes: ${researchNotes || 'None'}
LinkedIn signals: ${linkedinData || 'None'}
Website signals: ${websiteSignals || 'None'}
Company notes: ${company?.notes || 'None'}

Return ONLY valid JSON:
{
  "qualification": "<pass|conditional|fail>",
  "confidenceLevel": <number 0-100>,
  "passSignals": ["<signal>", ...],
  "failSignals": ["<signal>", ...],
  "unknownFactors": ["<factor>", ...],
  "estimatedOwnerAge": "<range or unknown>",
  "successionRisk": "<high|medium|low|unknown>",
  "brokerRisk": "<likely listed|possibly listed|probably not listed|unknown>",
  "outreachRecommendation": "<outreach_now|research_more|skip|monitor>",
  "suggestedOutreachAngle": "<one sentence personalized angle>",
  "disqualifyingFactors": ["<factor>", ...]
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 768,
    model,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
