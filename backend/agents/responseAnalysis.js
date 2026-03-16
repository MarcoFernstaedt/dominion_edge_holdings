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

import AIService, { AIServiceError } from '../services/AIService.js';

// ─── Seller motivation heuristic (System 4 — Conversation Intelligence) ──────
function extractMotivationSignals(text) {
  const lower = text.toLowerCase();

  const RETIREMENT       = ['retire', 'retirement', 'stepping down', 'age', 'too old', 'slow down', 'pass it on'];
  const BURNOUT          = ['burned out', 'exhausted', 'tired of', 'overwhelmed', 'stressed', 'done with it', 'worn out'];
  const EXPANSION        = ['grow', 'expansion', 'capital', 'scale', 'invest', 'opportunity', 'next level'];
  const FAMILY           = ['family', 'kids', 'children', 'son', 'daughter', 'health', 'illness', 'divorce'];
  const IMMEDIATE        = ['asap', 'immediately', 'right away', 'this year', 'soon as possible', 'urgent'];
  const SIX_MONTHS       = ['6 months', 'six months', 'this summer', 'by end of year', 'next few months'];
  const ONE_YEAR         = ['next year', '12 months', 'a year', 'year or two', 'eventually'];

  let sellerMotivation = 'unknown';
  if      (RETIREMENT.some((k) => lower.includes(k)))  sellerMotivation = 'retirement';
  else if (BURNOUT.some((k) => lower.includes(k)))     sellerMotivation = 'burnout';
  else if (EXPANSION.some((k) => lower.includes(k)))   sellerMotivation = 'expansion_capital';
  else if (FAMILY.some((k) => lower.includes(k)))      sellerMotivation = 'family_transition';

  let sellerTimeline = 'unknown';
  if      (IMMEDIATE.some((k) => lower.includes(k)))   sellerTimeline = 'immediate';
  else if (SIX_MONTHS.some((k) => lower.includes(k)))  sellerTimeline = '6_months';
  else if (ONE_YEAR.some((k) => lower.includes(k)))    sellerTimeline = '1_year';

  return { sellerMotivation, sellerTimeline };
}

// ─── Keyword heuristic classifier (deterministic fallback) ────────────────────
function classifyByKeywords(text) {
  const lower = text.toLowerCase();

  const INTEREST    = ['interested', 'open to', 'tell me more', 'would love', 'sounds good', 'yes', 'sure', 'absolutely', 'let\'s talk', 'call me', 'available'];
  const NOT_INTEREST = ['not interested', 'no thank', 'please remove', 'unsubscribe', 'stop emailing', 'not for sale', 'never selling', 'don\'t contact'];
  const LISTED      = ['broker', 'listed', 'banker', 'intermediary', 'already working with'];
  const LATER       = ['busy', 'traveling', 'reach out later', 'follow up', 'next month', 'next quarter', 'not right now'];
  const INFO        = ['send me', 'more information', 'learn more', 'details', 'what is your'];
  const UNSUB       = ['unsubscribe', 'remove me', 'opt out', 'stop emailing', 'do not contact'];

  if (UNSUB.some((k) => lower.includes(k)))       return { classification: 'unsubscribe',     suggestedNextAction: 'remove_from_list', sentiment: 'negative', confidenceScore: 0.9 };
  if (NOT_INTEREST.some((k) => lower.includes(k))) return { classification: 'not_interested',  suggestedNextAction: 'close_lead',        sentiment: 'negative', confidenceScore: 0.8 };
  if (LISTED.some((k) => lower.includes(k)))       return { classification: 'already_listed',  suggestedNextAction: 'close_lead',        sentiment: 'neutral',  confidenceScore: 0.75 };
  if (LATER.some((k) => lower.includes(k)))        return { classification: 'needs_followup',  suggestedNextAction: 'followup_later',    sentiment: 'neutral',  confidenceScore: 0.7 };
  if (INFO.some((k) => lower.includes(k)))         return { classification: 'request_info',    suggestedNextAction: 'send_info',         sentiment: 'positive', confidenceScore: 0.7 };
  if (INTEREST.some((k) => lower.includes(k)))     return { classification: 'interested',      suggestedNextAction: 'schedule_meeting',  sentiment: 'positive', confidenceScore: 0.75 };

  return { classification: 'other', suggestedNextAction: 'none', sentiment: 'neutral', confidenceScore: 0.4 };
}

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
- other → none

Also extract Conversation Intelligence (System 4):
- sellerMotivation: retirement | burnout | expansion_capital | family_transition | unknown
- sellerTimeline: immediate | 6_months | 1_year | unknown
- sellerConcerns: brief text of any concerns mentioned, or null
- nextConversationGoal: what the next conversation should accomplish, or null`;

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
  },
  "conversationIntelligence": {
    "sellerMotivation": "<retirement|burnout|expansion_capital|family_transition|unknown>",
    "sellerTimeline": "<immediate|6_months|1_year|unknown>",
    "sellerConcerns": "<string or null>",
    "nextConversationGoal": "<string or null>"
  }
}`;

  try {
    const result = await AIService.run('reply_classification', { emailBody, senderName, companyName }, {
      entityId: entityId || `reply_${Date.now()}`,
      entityType: 'email',
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      costFlags,
    });
    return result.content;
  } catch (err) {
    // Keyword heuristic fallback — always works, no AI needed
    const heuristic   = classifyByKeywords(emailBody);
    const motivation  = extractMotivationSignals(emailBody);
    return {
      agentName:          'ResponseAnalysisAgent',
      analysisSummary:    'AI unavailable. Classified using keyword heuristics.',
      actionsProposed:    [heuristic.suggestedNextAction],
      fallbackUsed:       true,
      fallbackMethod:     'keyword_heuristic',
      message:            'AI provider unavailable. Manual review recommended.',
      ...heuristic,
      followUpDate:       null,
      extractedInfo:      { name: senderName || null, phone: null, bestTime: null, preferredMethod: null },
      conversationIntelligence: {
        sellerMotivation:     motivation.sellerMotivation,
        sellerTimeline:       motivation.sellerTimeline,
        sellerConcerns:       null,
        nextConversationGoal: null,
      },
    };
  }
}
