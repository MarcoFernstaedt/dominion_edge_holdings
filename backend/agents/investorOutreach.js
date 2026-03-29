/**
 * InvestorOutreachAgent
 * Generates investor introduction emails, follow-ups, and deal highlight summaries.
 * Routes through ModelGateway — provider-agnostic, cost-controlled, with fallback.
 */

import ModelGateway from '../services/ModelGateway.js';

// ─── Deterministic templates ──────────────────────────────────────────────────

function deterministicIntroEmail(investor, dealSummary, firmMessaging) {
  const name       = investor?.name || 'Investor';
  const industries = (firmMessaging?.targetIndustries || []).join(', ') || 'small businesses';
  const size       = firmMessaging?.targetDealSize || '$1M–$10M revenue';
  const company    = dealSummary?.companyName || 'an acquisition target';
  const pp         = dealSummary?.purchasePrice
    ? `$${Number(dealSummary.purchasePrice).toLocaleString()}`
    : 'a competitive purchase price';

  const subject = `Acquisition Opportunity — ${company}`;

  const email = [
    `Hi ${name},`,
    '',
    `I wanted to reach out about an acquisition opportunity I'm pursuing in ${industries}.`,
    '',
    `I'm acquiring ${company} at ${pp}. The business has a strong track record and represents the type of ${size} cash-flowing opportunity I focus on.`,
    '',
    `I'm putting together a small investor group and thought you might be a fit given your background. I'd love to share the deal memo and walk through the numbers on a quick call.`,
    '',
    `Would you have 20 minutes this week or next?`,
    '',
    `Best,`,
  ].join('\n');

  return {
    subjectDraft: subject,
    emailDraft: email,
    keyHighlights: [
      `Company: ${company}`,
      `Purchase price: ${pp}`,
      `Industry: ${industries}`,
      `Deal size target: ${size}`,
    ],
  };
}

function deterministicFollowUp(investor, dealSummary, _firmMessaging) {
  const name    = investor?.name    || 'there';
  const company = dealSummary?.companyName || 'the opportunity';

  const subject = `Following up — ${company}`;

  const email = [
    `Hi ${name},`,
    '',
    `I wanted to follow up on my note about ${company}. We're making progress on diligence and I'd love to get your thoughts.`,
    '',
    `Happy to send over the deal memo if you'd like a closer look. A 20-minute call would be enough to cover the key points.`,
    '',
    `Let me know what works for you.`,
    '',
    `Best,`,
  ].join('\n');

  return {
    subjectDraft: subject,
    emailDraft: email,
    keyHighlights: [`Follow-up on ${company}`],
  };
}

// ─── Agent ────────────────────────────────────────────────────────────────────

const InvestorOutreachAgent = {
  name: 'InvestorOutreachAgent',

  /**
   * Generate an investor introduction or follow-up email.
   *
   * @param {'introduction'|'follow_up'|'deal_highlights'} mode
   * @param {object} investor  - Investor profile
   * @param {object} dealSummary - Basic deal facts
   * @param {object} firmMessaging - Firm mission / thesis
   * @param {object} aiService - Shared AIService instance (may be null)
   * @returns {Promise<{subjectDraft, emailDraft, keyHighlights}>}
   */
  async run({ mode = 'introduction', investor, dealSummary, firmMessaging }) {
    const name       = investor?.name || 'the investor';
    const org        = investor?.organization || '';
    const industries = (firmMessaging?.targetIndustries || []).join(', ') || 'small businesses';
    const size       = firmMessaging?.targetDealSize || '$1M–$10M revenue';
    const company    = dealSummary?.companyName || 'the target company';
    const pp         = dealSummary?.purchasePrice
      ? `$${Number(dealSummary.purchasePrice).toLocaleString()}`
      : 'competitive pricing';
    const mission    = firmMessaging?.missionStatement || '';

    const taskType = mode === 'deal_highlights' ? 'deal_snapshot' : 'investor_outreach_draft';

    const systemPrompt = mode === 'deal_highlights'
      ? 'Summarize the key highlights of this acquisition deal in 4-5 bullet points. Return JSON: { "keyHighlights": ["..."] }'
      : mode === 'follow_up'
        ? 'Write a brief, professional follow-up email to an investor. Return JSON: { "subjectDraft": "...", "emailDraft": "...", "keyHighlights": ["..."] }'
        : 'Write a professional investor introduction email for an acquisition deal. Return JSON: { "subjectDraft": "...", "emailDraft": "...", "keyHighlights": ["..."] }';

    const userMessage = JSON.stringify({ name, org, company, purchase_price: pp, industries, size, mission, investor_type: investor?.investorType, mode });

    try {
      const result = await ModelGateway.run({
        taskType,
        agentName:    'InvestorOutreachAgent',
        entityIds:    investor?.id ? [investor.id] : [],
        systemPrompt,
        userMessage,
        approvalRequired: true,
      });

      const parsed = typeof result.content === 'object' ? result.content : {};
      if (mode === 'deal_highlights') {
        return { subjectDraft: '', emailDraft: '', keyHighlights: parsed.keyHighlights || [] };
      }
      return {
        subjectDraft:  parsed.subjectDraft  || '',
        emailDraft:    parsed.emailDraft    || '',
        keyHighlights: parsed.keyHighlights || [],
        provider_used: result.provider_used,
        fallback_used: result.fallback_used,
      };
    } catch {
      // Deterministic fallback
      return mode === 'follow_up'
        ? deterministicFollowUp(investor, dealSummary, firmMessaging)
        : deterministicIntroEmail(investor, dealSummary, firmMessaging);
    }
  },
};

export default InvestorOutreachAgent;
