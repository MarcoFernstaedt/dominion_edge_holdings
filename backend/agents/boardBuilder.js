/**
 * BoardBuilderAgent
 *
 * Analyzes board candidate profiles and recommends composition strategy,
 * gap analysis, and prioritized outreach order for board recruitment.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Board Builder Agent for Dominion Edge Holdings.

You help a search fund entrepreneur build an effective advisory board and board of directors for a small business acquisition. The ideal board for a search fund acquisition includes:

- Operating Executives (1-2): CEOs or COOs with SMB operating experience
- Industry Experts (1-2): Deep domain knowledge in the target industry
- Financial Sponsors (1-2): Search fund investors, private equity, or family office partners
- Functional Experts (1-2): CFO, Legal, or Sales expertise as needed
- Independent Directors (1-2): Governance, credibility, and network value

Key evaluation criteria:
- Relevant industry experience
- Search fund / SMB acquisition familiarity
- Network in the acquisition target's industry
- Time availability and engagement commitment
- Compensation expectations (equity vs cash)

Return structured JSON analysis only.`;

export async function BoardBuilderAgent({ candidates, currentSeats, targetIndustry, dealContext, model }) {
  const userMessage = `Analyze these board candidates and provide recommendations.

Target acquisition industry: ${targetIndustry || 'General SMB'}
Deal context: ${dealContext || 'Search fund acquisition of profitable SMB'}

Current board seats filled:
${JSON.stringify(currentSeats || [], null, 2)}

Candidates under consideration:
${JSON.stringify(candidates || [], null, 2)}

Return ONLY valid JSON:
{
  "gapAnalysis": {
    "missingRoles": ["<role 1>", ...],
    "coveredRoles": ["<role 1>", ...],
    "strengthAreas": ["<strength>", ...],
    "weaknessAreas": ["<weakness>", ...]
  },
  "candidateRankings": [
    {
      "candidateId": "<id>",
      "candidateName": "<name>",
      "recommendedRole": "<role>",
      "fitScore": <number 0-100>,
      "strengths": ["<strength>", ...],
      "concerns": ["<concern>", ...],
      "outreachPriority": <number 1-10>,
      "suggestedAngle": "<one sentence pitch for initial outreach>"
    }
  ],
  "boardCompositionRecommendation": "<paragraph on ideal final board composition>",
  "nextOutreachTargets": ["<candidateId1>", "<candidateId2>", "<candidateId3>"]
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
