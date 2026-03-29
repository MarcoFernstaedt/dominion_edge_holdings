/**
 * UnderwritingEngine — deterministic acquisition underwriting.
 *
 * Rules:
 *  - All math is deterministic. No approximations.
 *  - AI may only add commentary on top of these outputs.
 *  - Fatal flags and verdicts are rule-based, never AI-derived.
 *  - DSCR thresholds are hard floors — not suggestions.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const DSCR_THRESHOLD    = 1.20; // hard minimum
const DSCR_TARGET       = 1.35; // comfortable target
const MAX_CUSTOMER_CONC = 0.30; // 30% = fatal concentration threshold
const SBA_RATE_DEFAULT  = 0.075;
const SBA_TERM_MONTHS   = 300;  // 25 years
const SELLER_NOTE_RATE_DEFAULT = 0.06;

// ─── SDE / EBITDA normalization ───────────────────────────────────────────────

/**
 * Normalize SDE from reported financials.
 * Adjustments are addbacks (positive) or deductions (negative).
 */
export function normalizeSDE(financials = {}) {
  const {
    reported_net_income     = 0,
    owner_salary_addback    = 0,
    owner_benefits_addback  = 0,
    depreciation_addback    = 0,
    amortization_addback    = 0,
    interest_expense_addback= 0,
    one_time_expense_addbacks = [],
    one_time_income_deductions = [],
    personal_expense_addbacks = [],
  } = financials;

  const totalOneTimeAddbacks    = one_time_expense_addbacks.reduce((s, a) => s + (a.amount ?? 0), 0);
  const totalOneTimeDeductions  = one_time_income_deductions.reduce((s, d) => s + (d.amount ?? 0), 0);
  const totalPersonalAddbacks   = personal_expense_addbacks.reduce((s, a) => s + (a.amount ?? 0), 0);

  const sde = reported_net_income
    + owner_salary_addback
    + owner_benefits_addback
    + depreciation_addback
    + amortization_addback
    + interest_expense_addback
    + totalOneTimeAddbacks
    + totalPersonalAddbacks
    - totalOneTimeDeductions;

  return {
    sde,
    components: {
      reported_net_income,
      owner_salary_addback,
      owner_benefits_addback,
      depreciation_addback,
      amortization_addback,
      interest_expense_addback,
      one_time_addbacks: totalOneTimeAddbacks,
      personal_addbacks: totalPersonalAddbacks,
      one_time_deductions: totalOneTimeDeductions,
    },
    notes: [
      ...one_time_expense_addbacks.map((a) => `Addback: ${a.description} (+$${a.amount.toLocaleString()})`),
      ...one_time_income_deductions.map((d) => `Deduction: ${d.description} (-$${d.amount.toLocaleString()})`),
    ],
  };
}

/**
 * Normalize EBITDA (for lender presentation).
 */
export function normalizeEBITDA(financials = {}) {
  const { reported_net_income = 0, interest_expense = 0, taxes = 0, depreciation = 0, amortization = 0, one_time_expense_addbacks = [] } = financials;
  const addbacks = one_time_expense_addbacks.reduce((s, a) => s + (a.amount ?? 0), 0);
  const ebitda = reported_net_income + interest_expense + taxes + depreciation + amortization + addbacks;
  return { ebitda, components: { reported_net_income, interest_expense, taxes, depreciation, amortization, addbacks } };
}

// ─── Debt service ─────────────────────────────────────────────────────────────

/**
 * Monthly payment for an amortizing loan (standard formula).
 */
export function monthlyPayment(principal, annualRate, termMonths) {
  if (principal <= 0) return 0;
  if (annualRate === 0) return principal / termMonths;
  const r = annualRate / 12;
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

export function annualDebtService(principal, annualRate, termMonths) {
  return monthlyPayment(principal, annualRate, termMonths) * 12;
}

// ─── DSCR ─────────────────────────────────────────────────────────────────────

export function calculateDSCR(sde, totalAnnualDebtService) {
  if (totalAnnualDebtService <= 0) return null;
  return Math.round((sde / totalAnnualDebtService) * 100) / 100;
}

// ─── Max purchase price (SBA-constrained) ─────────────────────────────────────

export function maxPurchasePrice({ sde, sbaRate = SBA_RATE_DEFAULT, sbaTermMonths = SBA_TERM_MONTHS, equityPct = 0.10, dscrTarget = DSCR_TARGET }) {
  // Max annual debt service = sde / dscrTarget
  const maxADS = sde / dscrTarget;
  // Assuming all debt is SBA: find principal that yields maxADS
  const r = sbaRate / 12;
  const n = sbaTermMonths;
  const factor = (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  if (factor <= 0) return null;
  const maxLoan = (maxADS / 12) / factor;
  const maxPrice = maxLoan / (1 - equityPct);
  return Math.round(maxPrice);
}

// ─── Scenario builder ─────────────────────────────────────────────────────────

/**
 * Build a single underwriting scenario.
 */
export function buildScenario({
  scenario_name,
  purchase_price,
  sde,
  ebitda            = null,
  sba_amount        = null,
  seller_note_amount = 0,
  equity_amount     = null,
  sba_rate          = SBA_RATE_DEFAULT,
  seller_note_rate  = SELLER_NOTE_RATE_DEFAULT,
  sba_term_months   = SBA_TERM_MONTHS,
  seller_note_term_months = 60,
}) {
  // Derive equity if not provided
  const computedSba    = sba_amount ?? Math.max(0, purchase_price - seller_note_amount - (equity_amount ?? purchase_price * 0.10));
  const computedEquity = equity_amount ?? Math.max(0, purchase_price - computedSba - seller_note_amount);

  const sbaADS          = annualDebtService(computedSba, sba_rate, sba_term_months);
  const sellerNoteADS   = annualDebtService(seller_note_amount, seller_note_rate, seller_note_term_months);
  const totalADS        = sbaADS + sellerNoteADS;
  const monthlyDS       = totalADS / 12;
  const dscr            = calculateDSCR(sde, totalADS);
  const passesThreshold = dscr !== null && dscr >= DSCR_THRESHOLD;

  // Risk flags for this scenario
  const risk_flags = _scenarioFlags({ dscr, seller_note_amount, purchase_price, sde, equity_pct: computedEquity / purchase_price });

  return {
    scenario_name,
    purchase_price,
    sba_amount:               computedSba,
    seller_note_amount,
    equity_amount:            computedEquity,
    sba_rate,
    seller_note_rate,
    sba_term_months,
    seller_note_term_months,
    monthly_debt_service:     Math.round(monthlyDS),
    annual_debt_service:      Math.round(totalADS),
    sde,
    ebitda,
    dscr,
    passes_threshold:         passesThreshold,
    risk_flags,
    fix_options:              passesThreshold ? [] : _fixOptions({ dscr, purchase_price, sde, sba_amount: computedSba, seller_note_amount }),
  };
}

/**
 * Build all required scenarios from a single set of financial inputs.
 */
export function buildAllScenarios(params = {}) {
  const {
    purchase_price,
    sde,
    ebitda = null,
    sba_rate            = SBA_RATE_DEFAULT,
    seller_note_rate    = SELLER_NOTE_RATE_DEFAULT,
    sba_term_months     = SBA_TERM_MONTHS,
    seller_note_term_months = 60,
  } = params;

  const base = buildScenario({ scenario_name: 'base', purchase_price, sde, ebitda, sba_amount: purchase_price * 0.80, seller_note_amount: purchase_price * 0.10, equity_amount: purchase_price * 0.10, sba_rate, seller_note_rate, sba_term_months, seller_note_term_months });
  const downside = buildScenario({ scenario_name: 'downside', purchase_price, sde: sde * 0.80, ebitda: ebitda ? ebitda * 0.80 : null, sba_amount: purchase_price * 0.80, seller_note_amount: purchase_price * 0.10, equity_amount: purchase_price * 0.10, sba_rate, seller_note_rate, sba_term_months, seller_note_term_months });
  const upside = buildScenario({ scenario_name: 'upside', purchase_price, sde: sde * 1.15, ebitda: ebitda ? ebitda * 1.15 : null, sba_amount: purchase_price * 0.80, seller_note_amount: purchase_price * 0.10, equity_amount: purchase_price * 0.10, sba_rate, seller_note_rate, sba_term_months, seller_note_term_months });
  const sellerConcession = buildScenario({ scenario_name: 'seller_concession', purchase_price: purchase_price * 0.90, sde, ebitda, sba_amount: (purchase_price * 0.90) * 0.75, seller_note_amount: (purchase_price * 0.90) * 0.15, equity_amount: (purchase_price * 0.90) * 0.10, sba_rate, seller_note_rate, sba_term_months, seller_note_term_months });
  const stretch = buildScenario({ scenario_name: 'stretch', purchase_price: purchase_price * 1.10, sde, ebitda, sba_amount: (purchase_price * 1.10) * 0.80, seller_note_amount: 0, equity_amount: (purchase_price * 1.10) * 0.20, sba_rate, seller_note_rate, sba_term_months, seller_note_term_months });

  return { base, downside, upside, seller_concession: sellerConcession, stretch };
}

// ─── Sensitivity table ────────────────────────────────────────────────────────

export function sensitivityTable({ sde, sba_rate = SBA_RATE_DEFAULT, sba_term_months = SBA_TERM_MONTHS, seller_note_amount = 0, seller_note_rate = SELLER_NOTE_RATE_DEFAULT, seller_note_term_months = 60 }) {
  const priceMultiples = [2.5, 3.0, 3.5, 4.0, 4.5, 5.0];
  const sdeAdjustments = [0.80, 0.90, 1.00, 1.10, 1.15];

  return priceMultiples.map((mult) => {
    const pp = sde * mult;
    return {
      multiple: mult,
      purchase_price: Math.round(pp),
      sde_scenarios: sdeAdjustments.map((adj) => {
        const adjSde = sde * adj;
        const sba    = pp * 0.80;
        const equity = pp * 0.10;
        const sbaADS = annualDebtService(sba, sba_rate, sba_term_months);
        const sellerADS = annualDebtService(seller_note_amount ?? pp * 0.10, seller_note_rate, seller_note_term_months);
        const dscr   = calculateDSCR(adjSde, sbaADS + sellerADS);
        return { sde_adj: adj, adjusted_sde: Math.round(adjSde), dscr, passes: dscr !== null && dscr >= DSCR_THRESHOLD };
      }),
    };
  });
}

// ─── Fatal flags ──────────────────────────────────────────────────────────────

export const FATAL_FLAG_RULES = {
  dscr_below_threshold: {
    key:          'dscr_below_threshold',
    label:        'DSCR Below Fatal Threshold',
    description:  `DSCR is below ${DSCR_THRESHOLD}x even after reasonable structure attempts`,
    is_fatal:     (ctx) => {
      const best = ctx.best_dscr ?? ctx.dscr ?? 0;
      return best < DSCR_THRESHOLD;
    },
    remedies: ['Reduce purchase price', 'Increase seller note', 'Negotiate seller rent-back', 'Find additional equity'],
  },
  customer_concentration: {
    key:          'customer_concentration',
    label:        'Fatal Customer Concentration',
    description:  `Single customer > ${MAX_CUSTOMER_CONC * 100}% of revenue with no remediation path`,
    is_fatal:     (ctx) => (ctx.top_customer_revenue_pct ?? 0) > MAX_CUSTOMER_CONC && !ctx.concentration_remediation_path,
    remedies: ['Negotiate revenue rep/warranty', 'Require holdback contingent on retention', 'Walk away if non-negotiable'],
  },
  owner_dependence: {
    key:          'owner_dependence',
    label:        'Critical Owner Dependence',
    description:  'No viable replacement path for owner-dependent operations',
    is_fatal:     (ctx) => Boolean(ctx.critical_owner_dependence) && !ctx.owner_replacement_path,
    remedies: ['Require extended transition period', 'Hire GM pre-close', 'Structural earnout tied to transition'],
  },
  license_compliance_failure: {
    key:          'license_compliance_failure',
    label:        'License or Compliance Failure',
    description:  'License or compliance violation with no remedy path identified',
    is_fatal:     (ctx) => Boolean(ctx.license_compliance_failure) && !ctx.compliance_remedy_path,
    remedies: ['Consult specialized counsel', 'Negotiate representation and indemnification', 'Walk if material and non-remediable'],
  },
  seller_refuses_transition: {
    key:          'seller_refuses_transition',
    label:        'Seller Refuses Transition Support',
    description:  'Seller refuses required transition support period',
    is_fatal:     (ctx) => Boolean(ctx.seller_refuses_transition),
    remedies: ['Renegotiate as deal-breaker term', 'Structural protections (holdback, escrow)', 'Walk if non-negotiable'],
  },
  hidden_liabilities: {
    key:          'hidden_liabilities',
    label:        'Material Undisclosed Liabilities',
    description:  'Hidden or undisclosed material liabilities found in diligence',
    is_fatal:     (ctx) => Boolean(ctx.material_hidden_liabilities),
    remedies: ['Require full disclosure and price adjustment', 'Renegotiate with rep/warranty insurance', 'Walk if seller is not forthcoming'],
  },
  missing_financials: {
    key:          'missing_financials',
    label:        'Missing Required Financials',
    description:  'Required financial records unavailable beyond defined diligence checkpoint',
    is_fatal:     (ctx) => Boolean(ctx.financials_missing_at_diligence_checkpoint),
    remedies: ['Set hard deadline for delivery', 'Escrow contingent on delivery', 'Walk if seller cannot produce'],
  },
};

/**
 * Evaluate all fatal flag rules against a context object.
 * Returns list of triggered fatal flags with remedies.
 */
export function evaluateFatalFlags(ctx = {}) {
  const triggered = [];
  for (const [, rule] of Object.entries(FATAL_FLAG_RULES)) {
    if (rule.is_fatal(ctx)) {
      triggered.push({
        flag_key:    rule.key,
        label:       rule.label,
        description: rule.description,
        remedies:    rule.remedies,
        is_fatal:    true,
      });
    }
  }
  return triggered;
}

// ─── Underwriting flags (non-fatal) ──────────────────────────────────────────

export function evaluateRiskFlags(ctx = {}) {
  const flags = [];
  if ((ctx.top_customer_revenue_pct ?? 0) > 0.20) flags.push({ key: 'customer_concentration_flag', label: 'Customer concentration > 20%', severity: (ctx.top_customer_revenue_pct ?? 0) > MAX_CUSTOMER_CONC ? 'critical' : 'high' });
  if (ctx.owner_dependence)                        flags.push({ key: 'owner_dependence_flag', label: 'Owner-dependent operations', severity: 'high' });
  if (ctx.license_risk)                            flags.push({ key: 'license_risk_flag', label: 'License or regulatory risk identified', severity: 'high' });
  if (ctx.working_capital_deficiency)              flags.push({ key: 'working_capital_flag', label: 'Working capital deficiency', severity: 'medium' });
  if ((ctx.margin_trend ?? 0) < -0.05)             flags.push({ key: 'margin_decline_flag', label: 'Margin declining > 5% YoY', severity: 'medium' });
  if ((ctx.revenue_trend ?? 0) < -0.05)            flags.push({ key: 'revenue_decline_flag', label: 'Revenue declining > 5% YoY', severity: 'high' });
  if (ctx.documentation_gaps)                      flags.push({ key: 'documentation_gap_flag', label: 'Documentation gaps in financials', severity: 'medium' });
  if (ctx.transition_risk)                         flags.push({ key: 'transition_risk_flag', label: 'Elevated transition risk', severity: 'medium' });
  return flags;
}

// ─── Verdict ──────────────────────────────────────────────────────────────────

/**
 * Deterministic GO/CONDITIONAL_GO/NO_GO verdict.
 */
export function deriveVerdict({ scenarios, fatalFlags, riskFlags, financialsComplete, documentsMinimumMet, structureViable }) {
  if (fatalFlags.length > 0) {
    return {
      verdict:  'NO_GO',
      reason:   `Fatal flag(s) present: ${fatalFlags.map((f) => f.label).join(', ')}`,
      flags:    fatalFlags,
    };
  }

  const baseScenario = scenarios?.base;
  const basePasses   = baseScenario?.passes_threshold;
  const anyscenarioPasses = scenarios && Object.values(scenarios).some((s) => s.passes_threshold);

  if (!financialsComplete) {
    return { verdict: 'CONDITIONAL_GO', reason: 'Financials incomplete — cannot confirm underwriting', flags: riskFlags };
  }

  if (!basePasses && !anyscenarioPasses) {
    return { verdict: 'NO_GO', reason: `DSCR below ${DSCR_THRESHOLD}x in all scenarios; structure not viable`, flags: riskFlags };
  }

  if (!basePasses && anyscenarioPasses) {
    return { verdict: 'CONDITIONAL_GO', reason: `Base case DSCR insufficient but alternative scenarios viable — structure negotiation required`, flags: riskFlags };
  }

  if (!documentsMinimumMet) {
    return { verdict: 'CONDITIONAL_GO', reason: 'Document minimum not met — advance with caution', flags: riskFlags };
  }

  const highRisk = riskFlags.filter((f) => f.severity === 'critical' || f.severity === 'high');
  if (highRisk.length > 2) {
    return { verdict: 'CONDITIONAL_GO', reason: `${highRisk.length} high/critical risk flags — proceed with structural protections`, flags: riskFlags };
  }

  return { verdict: 'GO', reason: 'Passes core threshold, no fatal flags, document minimum met, structure viable', flags: riskFlags };
}

// ─── Full underwriting run ────────────────────────────────────────────────────

/**
 * Run a full underwriting analysis on a deal.
 * @param {object} deal — deal record with financials, flags, documents
 * @returns Full underwriting result
 */
export function runUnderwriting(deal = {}) {
  const { financials = {}, financial_years = [] } = deal;

  // Use most recent year or provided aggregate
  const sdeResult   = normalizeSDE(financials);
  const ebitdaResult= normalizeEBITDA(financials);
  const sde         = sdeResult.sde;
  const ebitda      = ebitdaResult.ebitda;

  const purchasePrice = deal.asking_price ?? deal.purchase_price ?? sde * 3.5;

  const scenarios    = buildAllScenarios({ purchase_price: purchasePrice, sde, ebitda });
  const sensitivity  = sensitivityTable({ sde });
  const fatalFlags   = evaluateFatalFlags({ ...deal, best_dscr: Math.max(...Object.values(scenarios).map((s) => s.dscr ?? 0)) });
  const riskFlags    = evaluateRiskFlags(deal);
  const maxPrice     = maxPurchasePrice({ sde });
  const verdict      = deriveVerdict({
    scenarios,
    fatalFlags,
    riskFlags,
    financialsComplete:  Boolean(deal.financials_complete),
    documentsMinimumMet: Boolean(deal.documents_minimum_met),
    structureViable:     Object.values(scenarios).some((s) => s.passes_threshold),
  });

  return {
    deal_id:          deal.id,
    sde:              sde,
    ebitda:           ebitda,
    sde_components:   sdeResult.components,
    sde_notes:        sdeResult.notes,
    ebitda_components: ebitdaResult.components,
    purchase_price:   purchasePrice,
    max_purchase_price: maxPrice,
    scenarios,
    sensitivity_table: sensitivity,
    fatal_flags:      fatalFlags,
    risk_flags:       riskFlags,
    verdict,
    calculated_at:    new Date().toISOString(),
    ai_commentary_available: false, // set true after AI commentary generated
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _scenarioFlags({ dscr, seller_note_amount, purchase_price, sde, equity_pct }) {
  const flags = [];
  if (dscr !== null && dscr < DSCR_THRESHOLD) flags.push({ key: 'dscr_below_threshold', label: `DSCR ${dscr}x below ${DSCR_THRESHOLD}x`, severity: 'critical' });
  if (equity_pct < 0.10) flags.push({ key: 'low_equity', label: 'Equity injection below 10%', severity: 'high' });
  if (seller_note_amount / purchase_price > 0.30) flags.push({ key: 'high_seller_note', label: 'Seller note > 30% of purchase price — lender may restrict', severity: 'medium' });
  return flags;
}

function _fixOptions({ dscr, purchase_price, sde, sba_amount, seller_note_amount }) {
  const options = [];
  if (dscr < DSCR_THRESHOLD) {
    const priceForTarget = maxPurchasePrice({ sde, dscrTarget: DSCR_THRESHOLD });
    options.push(`Reduce purchase price to ~$${priceForTarget?.toLocaleString()} to meet DSCR threshold`);
    options.push('Negotiate a larger seller note at lower interest rate to reduce annual debt service');
    options.push('Increase SDE addbacks if defensible (requires documentation)');
    options.push('Extend seller note term to reduce annual debt service');
  }
  return options;
}

export default {
  normalizeSDE, normalizeEBITDA, monthlyPayment, annualDebtService,
  calculateDSCR, maxPurchasePrice, buildScenario, buildAllScenarios, sensitivityTable,
  evaluateFatalFlags, evaluateRiskFlags, deriveVerdict, runUnderwriting,
  FATAL_FLAG_RULES, DSCR_THRESHOLD, DSCR_TARGET, MAX_CUSTOMER_CONC,
};
