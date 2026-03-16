/**
 * CRMStewardAgent
 *
 * Analyzes CRM data quality, flags stale contacts, identifies data gaps,
 * suggests enrichment, and recommends re-engagement actions.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the CRM Steward Agent for Dominion Edge Holdings.

You maintain data quality and relationship hygiene in the CRM system. Your job is to:
1. Identify stale contacts (no interaction in 30/60/90 days)
2. Flag missing critical data (no email, no phone, unknown status)
3. Identify companies stuck in a stage too long
4. Suggest re-engagement strategies for warm leads
5. Recommend contacts to archive or remove

Context: This is a search fund CRM. Active pipeline contacts should be touched at least every 2 weeks. Warm leads every 4-6 weeks. Targets every 8-12 weeks.

Return structured JSON recommendations only.`;

export async function CRMStewardAgent({ companies, contacts, interactions, model }) {
  const now = new Date();

  // Pre-compute staleness client-side to keep Claude prompt concise
  const staleContacts = (contacts || []).filter((c) => {
    const lastInteraction = (interactions || [])
      .filter((i) => i.contactId === c.id || i.companyId === c.companyId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    if (!lastInteraction) return true;
    const daysSince = (now - new Date(lastInteraction.createdAt)) / 86400000;
    return daysSince > 30;
  });

  const missingData = (companies || []).filter(
    (c) => !c.email && !c.phone && c.status !== 'archived' && c.status !== 'lost'
  );

  const userMessage = `Analyze this CRM data and provide stewardship recommendations.

Total companies: ${(companies || []).length}
Total contacts: ${(contacts || []).length}
Total interactions: ${(interactions || []).length}

Stale contacts (30+ days no activity): ${staleContacts.length}
Sample stale contacts:
${JSON.stringify(staleContacts.slice(0, 5).map((c) => ({ name: `${c.firstName} ${c.lastName}`, company: c.companyId, type: c.contactType })), null, 2)}

Companies missing contact info: ${missingData.length}

Companies by status:
${JSON.stringify(
  (companies || []).reduce((acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; }, {}),
  null, 2
)}

Return ONLY valid JSON:
{
  "healthScore": <number 0-100>,
  "criticalActions": ["<action>", ...],
  "staleReEngagementList": [
    { "contactId": "<id>", "name": "<name>", "daysSinceContact": <number>, "suggestedAction": "<action>" }
  ],
  "dataQualityIssues": [
    { "entityId": "<id>", "entityType": "<company|contact>", "issue": "<description>", "severity": "<low|medium|high>" }
  ],
  "pipelineHealthInsights": ["<insight>", ...],
  "recommendedArchives": ["<entityId>", ...],
  "weeklyFocusAreas": ["<area>", ...]
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
