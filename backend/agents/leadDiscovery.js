/**
 * LeadDiscoveryAgent
 *
 * Analyze company data, extract attributes, score acquisition potential.
 * Model: Claude Haiku (lead_discovery task)
 */

import ModelGateway from '../services/ModelGateway.js';

const SYSTEM_PROMPT = `You are the Lead Discovery Agent for Dominion Edge Holdings.

Find acquisition-ready businesses: B2B, $2M-$20M revenue, owner 55+, no broker yet.

High-priority industries: industrial services (HVAC, plumbing, pest control), business services (staffing, cleaning), specialty distribution, healthcare adjacent, transportation.

Sourcing channels: LinkedIn, industry associations, trade shows, Chamber of Commerce, SBA loan records, broker pre-listing referrals, accountant/attorney networks.

Return structured JSON only.`;

export async function LeadDiscoveryAgent({ targetIndustry, targetGeography, currentPipelineCount = 0, entityId, costFlags }) {
  const userMessage = `Generate a lead discovery strategy.

Target industry: ${targetIndustry || 'B2B services, industrial services'}
Target geography: ${targetGeography || 'US nationwide, prefer Southeast/Midwest'}
Current pipeline count: ${currentPipelineCount}

Return ONLY this JSON:
{
  "agentName": "LeadDiscoveryAgent",
  "analysisSummary": "<one sentence on the strategy>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "searchCriteria": {
    "industries": ["<industry>", ...],
    "geographies": ["<state/region>", ...],
    "revenueRange": { "min": <number>, "max": <number> },
    "employeeRange": { "min": <number>, "max": <number> },
    "keywords": ["<keyword>", ...]
  },
  "sourcingChannels": [
    { "channel": "<name>", "priority": "<high|medium|low>", "estimatedLeadsPerMonth": <number>, "approachNotes": "<note>" }
  ],
  "targetProfiles": [
    { "profileName": "<archetype>", "description": "<desc>", "qualifyingSignals": ["<signal>", ...], "bestOutreachAngle": "<angle>" }
  ],
  "weeklyTargetVolume": <number>,
  "priorityActions": ["<action>", ...]
}`;

  const result = await ModelGateway.run({
    taskType: 'lead_discovery',
    agentName: 'LeadDiscoveryAgent',
    entityIds: [entityId || `lead_discovery_${Date.now()}`],
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    outputSchema: null,
  });

  return result.content;
}
