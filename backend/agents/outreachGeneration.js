/**
 * OutreachGenerationAgent
 *
 * Generates personalized outreach emails for sellers, board candidates,
 * bankers, capital partners, and other contacts. Adapts tone and content
 * to the contact type and relationship stage.
 */

import { runAgent, extractJSON } from './index.js';

const SYSTEM_PROMPT = `You are the Outreach Generation Agent for Dominion Edge Holdings AOS.

Marco Fernstaedt is a search fund entrepreneur seeking to acquire one excellent small-to-medium B2B business ($1-5M SDE, EBITDA positive, 5+ year track record, recession-resilient).

You write professional, authentic, non-salesy outreach emails that respect the recipient's intelligence. Key principles:
- Lead with value and relevance, not flattery
- Be specific about the business (shows research)
- Be clear about intent (not hiding the acquisition angle)
- Keep emails short (under 150 words for cold outreach)
- One clear call to action only
- Human, warm tone — not corporate

Contact types and their specific angles:
- seller: Focus on legacy preservation, business continuity, fair/fast process
- board_candidate: Focus on the opportunity to shape a platform company's early strategy
- banker/intermediary: Focus on reliability, speed to close, clear criteria
- attorney/cpa: Focus on professionalism, deal-readiness, referral relationship
- capital_partner: Focus on deal quality, operator background, aligned interests

Return structured JSON only.`;

export async function OutreachGenerationAgent({
  contactType,
  contactName,
  companyName,
  industry,
  context,
  templateType,
  customInstructions,
  model,
}) {
  const userMessage = `Generate a personalized outreach email.

Contact type: ${contactType || 'seller'}
Contact name: ${contactName || 'Business Owner'}
Company: ${companyName || 'their company'}
Industry: ${industry || 'Not specified'}
Template type: ${templateType || 'initial_outreach'}
Context: ${context || 'Cold outreach to potential acquisition target'}
${customInstructions ? `Custom instructions: ${customInstructions}` : ''}

Return ONLY valid JSON:
{
  "subject": "<email subject line>",
  "body": "<full email body — plain text, no HTML>",
  "followUpSubject": "<subject for 2-week follow-up if no response>",
  "followUpBody": "<follow-up email body>",
  "tone": "<professional|warm|direct|consultative>",
  "estimatedReadTime": "<e.g. '30 seconds'>",
  "callToAction": "<the specific ask in this email>",
  "notes": "<any personalization notes or flags>"
}`;

  const response = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1024,
    model,
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '{}';
  return extractJSON(text);
}
