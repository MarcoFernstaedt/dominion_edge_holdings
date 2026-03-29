/**
 * OutreachGenerationAgent
 *
 * Draft cold emails, follow-ups, and call scripts.
 * Model: Claude Haiku (outreach_draft task)
 *
 * Falls back to deterministic templates if AI is disabled.
 */

import ModelGateway, { GatewayError } from '../services/ModelGateway.js';

// ─── Deterministic fallback templates ────────────────────────────────────────
const FALLBACK_TEMPLATES = {
  seller: {
    subject: 'Acquisition Inquiry — {companyName}',
    body: `Hi {contactName},

My name is Marco Fernstaedt and I'm an entrepreneur actively searching to acquire one excellent business.

I came across {companyName} and was impressed by what you've built. If you've ever considered transitioning the business — whether in the near term or years down the road — I'd love a brief conversation.

I offer a straightforward, respectful process with no obligation.

Would you be open to a 20-minute call?

Best regards,
Marco Fernstaedt
Dominion Edge Holdings`,
  },
  board_candidate: {
    subject: 'Advisory Board Opportunity — Dominion Edge Holdings',
    body: `Hi {contactName},

I'm Marco Fernstaedt, a search fund entrepreneur in the process of acquiring a profitable B2B business. I'm building a small advisory board of experienced operators and industry experts.

Given your background, I believe you'd provide exceptional strategic value. I'd love to explore whether there's mutual interest.

Could we find 30 minutes to connect?

Best,
Marco`,
  },
  banker: {
    subject: 'Acquisition Buyer Introduction — Dominion Edge Holdings',
    body: `Hi {contactName},

I'm Marco Fernstaedt with Dominion Edge Holdings. I'm actively seeking to acquire a B2B business in the $2M-$20M revenue range.

I close quickly, work transparently, and have capital committed. If you represent or know of sellers fitting this profile, I'd welcome an introduction.

Available for a brief call anytime.

Best,
Marco`,
  },
};

function applyTemplate(template, vars) {
  return {
    subject: template.subject.replace(/\{(\w+)\}/g, (_, k) => vars[k] || k),
    body: template.body.replace(/\{(\w+)\}/g, (_, k) => vars[k] || k),
  };
}

const SYSTEM_PROMPT = `You are the Outreach Generation Agent for Dominion Edge Holdings.

Write authentic, non-salesy outreach emails for Marco Fernstaedt, a search fund entrepreneur acquiring B2B businesses.

Principles:
- Lead with relevance, not flattery
- Specific to the company (shows research)
- Clear intent — not hiding the acquisition angle
- Under 150 words for cold outreach
- One clear call to action
- Human, warm tone

Return ONLY valid JSON.`;

export async function OutreachGenerationAgent({ contactType = 'seller', contactName, companyName, industry, context, templateType, customInstructions, entityId, costFlags }) {
  // Try AI draft first; fall back to deterministic template if disabled
  try {
    const userMessage = `Generate a personalized outreach email.

Contact type: ${contactType}
Contact: ${contactName || 'Business Owner'}
Company: ${companyName || 'their company'}
Industry: ${industry || 'Not specified'}
Template: ${templateType || 'initial_outreach'}
Context: ${context || 'Cold outreach'}
${customInstructions ? `Instructions: ${customInstructions}` : ''}

Return ONLY this JSON:
{
  "agentName": "OutreachGenerationAgent",
  "analysisSummary": "<one sentence about the outreach strategy>",
  "actionsProposed": ["send_email", "schedule_followup"],
  "confidenceScore": <number 0-1>,
  "subject": "<subject line>",
  "body": "<plain text email body>",
  "followUpSubject": "<follow-up subject>",
  "followUpBody": "<follow-up body>",
  "tone": "<professional|warm|direct|consultative>",
  "callToAction": "<the specific ask>"
}`;

    const result = await ModelGateway.run({
      taskType: 'outreach_draft',
      agentName: 'OutreachGenerationAgent',
      entityIds: [entityId || `outreach_${contactType}_${Date.now()}`],
      systemPrompt: SYSTEM_PROMPT,
      userMessage,
      outputSchema: null,
    });

    return result.content;
  } catch (err) {
    if (err instanceof GatewayError && err.code === 'FEATURE_DISABLED') {
      // Deterministic fallback
      const tpl = FALLBACK_TEMPLATES[contactType] || FALLBACK_TEMPLATES.seller;
      const rendered = applyTemplate(tpl, { contactName: contactName || 'there', companyName: companyName || 'your company' });
      return {
        agentName: 'OutreachGenerationAgent',
        analysisSummary: 'Used deterministic template (AI drafting disabled)',
        actionsProposed: ['send_email'],
        confidenceScore: 0.7,
        ...rendered,
        followUpSubject: `Following up — ${rendered.subject}`,
        followUpBody: `Hi ${contactName || 'there'},\n\nJust following up on my note from last week. Would you have a few minutes to connect?\n\nBest,\nMarco`,
        tone: 'professional',
        callToAction: 'Schedule a 20-minute call',
      };
    }
    throw err;
  }
}
