/**
 * LeadDiscoveryAgent
 *
 * Generates targeted lead discovery strategies and search parameters
 * for finding acquisition-ready businesses. Provides search criteria,
 * industry analysis, and sourcing channel recommendations.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Lead Discovery Agent for Dominion Edge Holdings.

Your job is to help find acquisition-ready small businesses that match the search fund criteria:
- Revenue $2M-$20M, SDE $500K-$5M
- Owner-operated, 5+ years in business
- B2B focused, recession-resilient
- Owner likely 55+ years old (retirement motivation)
- No broker yet (direct sourcing advantage)

Target industries (high priority):
- Industrial services (HVAC, plumbing, electrical, pest control)
- Business services (staffing, cleaning, security, waste management)
- Specialty distribution (industrial supplies, food service equipment)
- Healthcare adjacent (medical equipment service, dental labs)
- Transportation & logistics (last-mile, freight brokerage)
- Environmental services

Sourcing channels:
- LinkedIn outreach (company founders/owners)
- Industry association directories
- Trade show attendee lists
- Local Chamber of Commerce
- SBA loan origination lists (public records)
- Business broker pre-listing referrals
- Accountant/attorney referral networks

Return structured JSON recommendations only.`;

export async function LeadDiscoveryAgent({ targetIndustry, targetGeography, currentPipelineCount, model }) {
  const userMessage = `Generate a lead discovery strategy and target parameters.

Target industry focus: ${targetIndustry || 'B2B services, industrial services'}
Target geography: ${targetGeography || 'US nationwide, prefer Southeast/Midwest'}
Current pipeline companies: ${currentPipelineCount || 0}

Return ONLY valid JSON:
{
  "searchCriteria": {
    "industries": ["<industry>", ...],
    "geographies": ["<state/region>", ...],
    "revenueRange": { "min": <number>, "max": <number> },
    "employeeRange": { "min": <number>, "max": <number> },
    "businessAgeMinYears": <number>,
    "keywords": ["<keyword>", ...]
  },
  "sourcingChannels": [
    {
      "channel": "<channel name>",
      "priority": "<high|medium|low>",
      "estimatedLeadsPerMonth": <number>,
      "approachNotes": "<how to use this channel effectively>"
    }
  ],
  "targetProfiles": [
    {
      "profileName": "<archetype name>",
      "description": "<description>",
      "qualifyingSignals": ["<signal>", ...],
      "bestOutreachAngle": "<approach>"
    }
  ],
  "weeklyTargetVolume": <number>,
  "conversionBenchmarks": {
    "outreachToResponse": "<percentage>",
    "responseToCall": "<percentage>",
    "callToLOI": "<percentage>"
  },
  "priorityActions": ["<action>", ...]
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
