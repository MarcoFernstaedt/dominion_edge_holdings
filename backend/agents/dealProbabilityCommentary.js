/**
 * DealProbabilityCommentaryAgent
 *
 * Explains why a deal received its probability score and what must happen to improve it.
 * The SCORE itself is always deterministic (DealProbabilityService).
 * This agent provides optional AI commentary — never modifies the score.
 *
 * Model: Fast model (haiku). Can be disabled.
 */

import AIService from '../services/AIService.js';
import DealProbabilityService from '../services/DealProbabilityService.js';

export async function DealProbabilityCommentaryAgent({
  deal,
  interactions = [],
  scenarios = [],
  company = null,
  costFlags = {},
}) {
  if (!deal) {
    return {
      agentName:       'DealProbabilityCommentaryAgent',
      analysisSummary: 'No deal provided.',
      actionsProposed: [],
      confidenceScore: 0,
      explanation:     null,
    };
  }

  // Deterministic score explanation — always run
  const explanation = DealProbabilityService.explainProbabilityScore(deal);
  const score       = deal.probabilityScore ?? null;
  const band        = deal.probabilityBand  ?? null;

  // If AI disabled or score not yet computed, return deterministic explanation only
  const aiEnabled = costFlags?.enableDealProbabilityCommentary !== false &&
                    costFlags?.enableStrategyInsights !== false;

  if (!aiEnabled || score === null) {
    return {
      agentName:       'DealProbabilityCommentaryAgent',
      timestamp:       new Date().toISOString(),
      analysisSummary: `Deal "${deal.companyName}" probability: ${score ?? 'not computed'} (${band ?? 'unknown'}). Deterministic explanation provided.`,
      probabilityScore: score,
      probabilityBand:  band,
      explanation:      score !== null ? `Score: ${score}/100 (${band}). ${deal.probabilityNotes || ''}` : 'Score not yet computed. Run probability refresh.',
      topScoreDrivers:  explanation?.topDrivers || [],
      biggestRisks:     explanation?.mainRisks  || [],
      actionsToImproveProbability: explanation?.actionsToImproveProbability || [],
      actionsProposed:  ['review_score_factors'],
      confidenceScore:  0.8,
      fallbackUsed:     false,
    };
  }

  const summaryLines = [
    `Deal: ${deal.companyName} | Stage: ${deal.stage || 'unknown'}`,
    `Probability Score: ${score}/100 (${band})`,
    `Notes: ${deal.probabilityNotes || 'none'}`,
    `Top drivers: ${(explanation?.topDrivers || []).join('; ')}`,
    `Risks: ${(explanation?.mainRisks || []).join('; ')}`,
  ];

  if (company) {
    summaryLines.push(`Company: ${company.industry || ''}, ${company.city || ''} ${company.state || ''}, ${company.yearsInBusiness || '?'} years`);
  }

  const prompt = `You are the Deal Probability Commentary Agent for Dominion Edge Holdings.

A deal has received a deterministic probability score. Your job is to explain why and what would move it.

${summaryLines.join('\n')}

Factor breakdown:
${JSON.stringify(deal.probabilityFactors || {}, null, 2)}

Write a concise, direct explanation (2-3 sentences max per section).
Do NOT invent seller facts. Do NOT modify the score.
Reference the score and factors directly.

Return JSON:
{
  "explanation": "string — 2-4 sentence plain summary",
  "topScoreDrivers": ["string"],
  "biggestRisks": ["string"],
  "actionsToImproveProbability": ["string — specific, actionable steps"],
  "confidenceScore": number 0-100
}`;

  let aiResult = null;
  let fallbackUsed = false;

  try {
    const raw = await AIService.run('reply_classification', prompt, {
      maxTokens: 512,
      costFlags,
    });

    const text = raw?.text || raw?.content || (typeof raw === 'string' ? raw : '');
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      aiResult = JSON.parse(jsonMatch[0]);
    }
  } catch {
    fallbackUsed = true;
  }

  return {
    agentName:       'DealProbabilityCommentaryAgent',
    timestamp:       new Date().toISOString(),
    analysisSummary: `Deal "${deal.companyName}": probability ${score}/100 (${band}).`,
    probabilityScore: score,
    probabilityBand:  band,
    explanation:      aiResult?.explanation || `Score: ${score}/100 (${band}). ${deal.probabilityNotes || ''}`,
    topScoreDrivers:  aiResult?.topScoreDrivers  || explanation?.topDrivers || [],
    biggestRisks:     aiResult?.biggestRisks      || explanation?.mainRisks  || [],
    actionsToImproveProbability: aiResult?.actionsToImproveProbability || explanation?.actionsToImproveProbability || [],
    actionsProposed:  ['review_probability_factors', 'plan_next_action'],
    confidenceScore:  typeof aiResult?.confidenceScore === 'number'
      ? aiResult.confidenceScore / 100
      : 0.7,
    fallbackUsed,
  };
}

export default DealProbabilityCommentaryAgent;
