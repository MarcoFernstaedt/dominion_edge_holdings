/**
 * constants.js — Domain constants used across the application.
 * Never hard-code these inline in route or service files.
 */

/** Boolean fields on Company that collectively produce sellerSignalScore. */
export const SELLER_SIGNAL_FIELDS = Object.freeze([
  'retirementSignal', 'noWebsiteSignal', 'reviewDeclineSignal',
  'websiteOutdatedSignal', 'hiringSlowdownSignal', 'linkedinInactiveSignal',
]);

/** Rate-limit windows and caps — single source of truth. */
export const RATE_LIMITS = Object.freeze({
  GENERAL_WINDOW_MS: 15 * 60 * 1000,
  GENERAL_MAX:       500,
  AI_WINDOW_MS:      60 * 1000,
  AI_MAX:            20,
});

/** Financial thresholds used across underwriting routes. */
export const FINANCIAL_RULES = Object.freeze({
  DSCR_MINIMUM:             1.25,
  SBA_MIN_DOWN_PAYMENT_PCT: 10,
  DEFAULT_SENIOR_RATE_PCT:  6.5,
  DEFAULT_SELLER_NOTE_RATE: 6,
});

/** Default AI model — used when stored setting is absent or fails whitelist. */
export const DEFAULT_AI_MODEL = 'claude-sonnet-4-20250514';

/** Whitelist pattern for Anthropic model IDs. Prevents prompt-injection via settings. */
export const VALID_MODEL_PATTERN = /^claude-(opus|sonnet|haiku)-[\w.-]+$/;

/** DEH system prompt injected into every AI request. */
export const DEH_SYSTEM_PROMPT = `You are an expert M&A advisor and acquisition strategist for Dominion Edge Holdings, a search fund focused on acquiring small-to-medium owner-operated businesses in the United States via SBA 7(a) financing.

The principal is Marco Fernstaedt. You assist with:
- Business valuation and underwriting (DSCR, SDE normalization, deal structuring)
- Outreach drafting for sellers, board members, and lenders
- Due diligence checklists and LOI structuring
- Board assembly and advisory pitch scripts
- 90-day post-acquisition integration planning

Key financial rules:
- Minimum acceptable DSCR: 1.25x (SBA 7(a) requirement)
- SDE = Net Income + Owner Salary + Personal Addbacks + One-Time Adjustments
- Normalized SDE = SDE adjusted for market-rate management
- Target acquisition multiple: 3–5x SDE for Main Street businesses
- SBA 7(a) maximum: $5M, 10-year term for acquisitions

Always be direct, data-driven, and focused on execution. Do not hedge excessively.`;
