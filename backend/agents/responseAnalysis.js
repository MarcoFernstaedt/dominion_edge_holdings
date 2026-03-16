/**
 * ResponseAnalysisAgent
 *
 * Classifies inbound email replies from sellers/contacts and extracts
 * structured signals to drive workflow automation.
 *
 * Returns:
 *   classification: 'interested' | 'not_interested' | 'request_info' |
 *                   'already_listed' | 'needs_followup' | 'unsubscribe' | 'other'
 *   sentiment: 'positive' | 'neutral' | 'negative'
 *   suggestedNextAction: 'schedule_meeting' | 'send_info' | 'followup_later' |
 *                        'remove_from_list' | 'close_lead' | 'none'
 *   followUpDate: ISO string or null
 *   extractedInfo: { name?, phone?, bestTime?, preferredMethod? }
 *   summary: one-sentence summary
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Response Analysis Agent for Dominion Edge Holdings, a search fund specializing in acquiring small-to-medium B2B businesses.

Your job is to analyze inbound email replies from business owners/sellers and classify them precisely. You output structured JSON only — never plain prose.

Classification rules:
- "interested": Owner expresses any level of openness to a conversation, wants more info, asks questions, or agrees to a call
- "not_interested": Owner explicitly declines, says not for sale, or is definitively negative
- "request_info": Owner wants information before committing (NDA, presentation, prospectus, etc.)
- "already_listed": Business is already listed with a broker or banker
- "needs_followup": Owner is busy, traveling, or asks to reconnect at a future time
- "unsubscribe": Owner asks to be removed from contact list
- "other": Cannot be classified into above categories

SuggestedNextAction mapping:
- interested → schedule_meeting
- request_info → send_info
- needs_followup → followup_later
- unsubscribe → remove_from_list
- not_interested → close_lead
- already_listed → close_lead (with note about broker)
- other → none`;

export async function ResponseAnalysisAgent({ emailBody, senderName, senderEmail, companyName, threadContext = '' }) {
  const userMessage = `Analyze this inbound email reply and return a JSON object matching the schema exactly.

Sender: ${senderName || 'Unknown'} <${senderEmail || ''}>
Company: ${companyName || 'Unknown'}
${threadContext ? `Thread context:\n${threadContext}\n\n` : ''}Email body:
"""
${emailBody}
"""

Return ONLY valid JSON matching this exact schema (no other text):
{
  "classification": "<one of: interested|not_interested|request_info|already_listed|needs_followup|unsubscribe|other>",
  "sentiment": "<one of: positive|neutral|negative>",
  "suggestedNextAction": "<one of: schedule_meeting|send_info|followup_later|remove_from_list|close_lead|none>",
  "followUpDate": "<ISO 8601 date string or null>",
  "extractedInfo": {
    "name": "<string or null>",
    "phone": "<string or null>",
    "bestTime": "<string or null>",
    "preferredMethod": "<string or null>"
  },
  "summary": "<one sentence summary of the reply>"
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 512,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
