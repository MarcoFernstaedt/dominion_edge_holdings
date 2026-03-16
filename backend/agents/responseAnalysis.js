/**
 * ResponseAnalysisAgent
 *
 * Classify inbound email replies and extract structured signals.
 * Model: Claude Haiku (reply_classification task)
 *
 * Standard output shape:
 * {
 *   agentName, analysisSummary, actionsProposed, confidenceScore,
 *   classification, sentiment, suggestedNextAction, followUpDate, extractedInfo
 * }
 */

import AIService from '../services/AIService.js';

const SYSTEM_PROMPT = `You are the Response Analysis Agent for Dominion Edge Holdings, a search fund acquiring B2B businesses.

Analyze inbound email replies from business owners. Return structured JSON only — never plain prose.

Classification values: interested | not_interested | request_info | already_listed | needs_followup | unsubscribe | other
Sentiment values: positive | neutral | negative
SuggestedNextAction values: schedule_meeting | send_info | followup_later | remove_from_list | close_lead | none

Mapping rules:
- interested → schedule_meeting
- request_info → send_info
- needs_followup → followup_later
- unsubscribe → remove_from_list
- not_interested | already_listed → close_lead
- other → none`;

export async function ResponseAnalysisAgent({ emailBody, senderName, senderEmail, companyName, threadContext = '', entityId, costFlags }) {
  const userMessage = `Analyze this inbound email and return valid JSON only.

Sender: ${senderName || 'Unknown'} <${senderEmail || ''}>
Company: ${companyName || 'Unknown'}
${threadContext ? `Thread context:\n${threadContext}\n\n` : ''}Email:
"""
${emailBody}
"""

Return ONLY this JSON shape (no other text):
{
  "agentName": "ResponseAnalysisAgent",
  "analysisSummary": "<one sentence>",
  "actionsProposed": ["<action>"],
  "confidenceScore": <number 0-1>,
  "classification": "<interested|not_interested|request_info|already_listed|needs_followup|unsubscribe|other>",
  "sentiment": "<positive|neutral|negative>",
  "suggestedNextAction": "<schedule_meeting|send_info|followup_later|remove_from_list|close_lead|none>",
  "followUpDate": "<ISO 8601 date or null>",
  "extractedInfo": {
    "name": "<string or null>",
    "phone": "<string or null>",
    "bestTime": "<string or null>",
    "preferredMethod": "<string or null>"
  }
}`;

  const result = await AIService.run('reply_classification', { emailBody, senderName, companyName }, {
    entityId: entityId || `reply_${Date.now()}`,
    entityType: 'email',
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    costFlags,
  });

  return result.content;
}
