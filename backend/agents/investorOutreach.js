/**
 * InvestorOutreachAgent
 * Generates investor introduction emails, follow-ups, and deal highlight summaries.
 * Model: Claude Haiku (fast, cost-efficient)
 * Fallback: deterministic templates
 */

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
  model: 'claude-haiku-4-5-20251001',

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
  async run({ mode = 'introduction', investor, dealSummary, firmMessaging }, aiService = null) {
    if (!aiService) {
      return mode === 'follow_up'
        ? deterministicFollowUp(investor, dealSummary, firmMessaging)
        : deterministicIntroEmail(investor, dealSummary, firmMessaging);
    }

    const name       = investor?.name || 'the investor';
    const org        = investor?.organization || '';
    const industries = (firmMessaging?.targetIndustries || []).join(', ') || 'small businesses';
    const size       = firmMessaging?.targetDealSize || '$1M–$10M revenue';
    const company    = dealSummary?.companyName || 'the target company';
    const pp         = dealSummary?.purchasePrice
      ? `$${Number(dealSummary.purchasePrice).toLocaleString()}`
      : 'competitive pricing';
    const mission    = firmMessaging?.missionStatement || '';

    let prompt;

    if (mode === 'deal_highlights') {
      prompt = `Summarize the key highlights of this acquisition deal in 4-5 bullet points.

Deal: ${company}
Purchase Price: ${pp}
Industry: ${industries}
Deal Size: ${size}
Mission: ${mission}

Return JSON: { "keyHighlights": ["highlight 1", "highlight 2", ...] }`;
    } else if (mode === 'follow_up') {
      prompt = `Write a brief, professional follow-up email to an investor.

Investor: ${name}${org ? ` at ${org}` : ''}
Deal: ${company}
Prior context: We previously introduced this deal opportunity to this investor.

Write a warm, concise follow-up. Return JSON:
{
  "subjectDraft": "email subject",
  "emailDraft": "full email body",
  "keyHighlights": ["1-2 key points to reinforce"]
}`;
    } else {
      prompt = `Write a professional investor introduction email for an acquisition deal.

Investor: ${name}${org ? ` at ${org}` : ''}
Investor type: ${investor?.investorType || 'general investor'}
Deal: ${company}
Purchase Price: ${pp}
Industry: ${industries}
Target size: ${size}
Firm mission: ${mission}

Write a warm, professional email that introduces the deal and requests a brief call.
Return JSON:
{
  "subjectDraft": "email subject line",
  "emailDraft": "full email body (use plain text, no HTML)",
  "keyHighlights": ["3-4 key deal highlights"]
}`;
    }

    try {
      const response = await aiService.complete(prompt, {
        model: this.model,
        maxTokens: 600,
      });
      const text = response?.content?.[0]?.text || response?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (mode === 'deal_highlights') {
          return {
            subjectDraft: '',
            emailDraft: '',
            keyHighlights: parsed.keyHighlights || [],
          };
        }
        return {
          subjectDraft:  parsed.subjectDraft  || '',
          emailDraft:    parsed.emailDraft    || '',
          keyHighlights: parsed.keyHighlights || [],
        };
      }
    } catch { /* fall through */ }

    // Deterministic fallback
    return mode === 'follow_up'
      ? deterministicFollowUp(investor, dealSummary, firmMessaging)
      : deterministicIntroEmail(investor, dealSummary, firmMessaging);
  },
};

export default InvestorOutreachAgent;
