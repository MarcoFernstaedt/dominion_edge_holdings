/**
 * CRMStewardAgent
 *
 * Detect duplicates, stale leads, suggest follow-ups.
 * Model: Claude Haiku (crm_health task)
 */

import AIService from '../services/AIService.js';

const SYSTEM_PROMPT = `You are the CRM Steward Agent for Dominion Edge Holdings.

Maintain data quality and relationship hygiene. Stale contact thresholds:
- Active pipeline: touch every 2 weeks
- Warm leads: every 4-6 weeks
- Targets: every 8-12 weeks

Return structured JSON only.`;

export async function CRMStewardAgent({ companies = [], contacts = [], interactions = [], entityId, costFlags }) {
  // Deterministic pre-processing
  const now = Date.now();

  const staleContacts = contacts
    .filter((c) => {
      const last = interactions
        .filter((i) => i.contactId === c.id || i.companyId === c.companyId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const days = last ? (now - new Date(last.createdAt).getTime()) / 86400000 : 999;
      return days > 30;
    })
    .slice(0, 10);

  const missingContactInfo = companies
    .filter((c) => !c.email && !c.phone && c.status !== 'archived' && c.status !== 'lost')
    .length;

  const statusCounts = companies.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  const userMessage = `Analyze CRM data and provide stewardship recommendations.

Companies: ${companies.length} total, ${missingContactInfo} missing contact info
Contacts: ${contacts.length} total, ${staleContacts.length} stale (30+ days)
Interactions: ${interactions.length} total

Status distribution:
${JSON.stringify(statusCounts, null, 2)}

Stale contacts sample:
${JSON.stringify(staleContacts.map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, type: c.contactType })), null, 2)}

Return ONLY this JSON:
{
  "agentName": "CRMStewardAgent",
  "analysisSummary": "<one sentence on CRM health>",
  "actionsProposed": ["<action>", ...],
  "confidenceScore": <number 0-1>,
  "healthScore": <number 0-100>,
  "criticalActions": ["<action>", ...],
  "staleReEngagementList": [
    { "contactId": "<id>", "name": "<name>", "daysSinceContact": <number>, "suggestedAction": "<action>" }
  ],
  "dataQualityIssues": [
    { "entityId": "<id>", "entityType": "<company|contact>", "issue": "<description>", "severity": "<low|medium|high>" }
  ],
  "pipelineHealthInsights": ["<insight>", ...],
  "weeklyFocusAreas": ["<area>", ...]
}`;

  const result = await AIService.run('crm_health', { companyCount: companies.length, staleCount: staleContacts.length }, {
    entityId: entityId || `crm_health_${new Date().toISOString().slice(0, 10)}`,
    entityType: 'crm',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    costFlags,
  });

  return result.content;
}
