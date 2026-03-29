/**
 * BoardBuilderAgent
 *
 * Identify and rank board candidates; draft outreach.
 * Model: Claude Haiku (board_analysis task)
 */

import ModelGateway from '../services/ModelGateway.js';

const SYSTEM_PROMPT = `You are the Board Builder Agent for Dominion Edge Holdings.

Build an advisory board for a search fund acquisition. Ideal composition:
- Operating Executives (1-2): SMB operating experience
- Industry Experts (1-2): Deep domain knowledge
- Financial Sponsors (1-2): Search fund investors or family office
- Functional Experts (1-2): CFO, Legal, or Sales
- Independent Directors (1-2): Governance and credibility

Evaluation criteria: industry fit, search fund familiarity, network, availability, compensation expectations.

Return structured JSON only.`;

export async function BoardBuilderAgent({ candidates = [], currentSeats = [], targetIndustry, dealContext, entityId, costFlags }) {
  const userMessage = `Analyze board candidates and provide recommendations.

Target industry: ${targetIndustry || 'General SMB'}
Deal context: ${dealContext || 'Search fund acquisition of profitable SMB'}
Current seats filled: ${currentSeats.length}
Candidates: ${candidates.length}

Current seats:
${JSON.stringify(currentSeats.slice(0, 10), null, 2)}

Candidates:
${JSON.stringify(candidates.slice(0, 20), null, 2)}

Return ONLY this JSON:
{
  "agentName": "BoardBuilderAgent",
  "analysisSummary": "<one sentence on board status>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "gapAnalysis": {
    "missingRoles": ["<role>", ...],
    "coveredRoles": ["<role>", ...],
    "strengthAreas": ["<strength>", ...],
    "weaknessAreas": ["<weakness>", ...]
  },
  "candidateRankings": [
    {
      "candidateId": "<id>",
      "candidateName": "<name>",
      "recommendedRole": "<role>",
      "fitScore": <number 0-100>,
      "outreachPriority": <number 1-10>,
      "suggestedAngle": "<one sentence pitch>"
    }
  ],
  "boardCompositionRecommendation": "<paragraph>",
  "nextOutreachTargets": ["<candidateId>", ...]
}`;

  const result = await ModelGateway.run({
    taskType: 'board_analysis',
    agentName: 'BoardBuilderAgent',
    entityIds: [entityId || `board_${Date.now()}`],
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    outputSchema: null,
  });

  return result.content;
}
