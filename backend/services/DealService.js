/**
 * DealService — Deterministic deal and financial logic. No AI calls.
 *
 * Handles: DSCR calculation, deal stage transitions, validation rules,
 * SBA loan eligibility checks, underwriting math.
 */

// ─── DSCR ─────────────────────────────────────────────────────────────────────
/**
 * Debt Service Coverage Ratio
 * DSCR = netOperatingIncome / annualDebtService
 * Target: >= 1.25 for SBA approval
 */
export function calculateDSCR(netOperatingIncome, annualDebtService) {
  if (!annualDebtService || annualDebtService === 0) return null;
  return +(netOperatingIncome / annualDebtService).toFixed(4);
}

/**
 * Monthly SBA 7(a) payment (standard amortization)
 * @param {number} principal   Loan amount
 * @param {number} annualRate  Decimal (e.g. 0.075 for 7.5%)
 * @param {number} termYears   Loan term in years
 */
export function monthlyLoanPayment(principal, annualRate, termYears) {
  if (annualRate === 0) return +(principal / (termYears * 12)).toFixed(2);
  const r = annualRate / 12;
  const n = termYears * 12;
  return +(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)).toFixed(2);
}

export function annualDebtService(principal, annualRate, termYears) {
  return +(monthlyLoanPayment(principal, annualRate, termYears) * 12).toFixed(2);
}

// ─── Deal stage machine ───────────────────────────────────────────────────────
export const DEAL_STAGES = [
  'prospect',
  'initial_contact',
  'conversation',
  'interested',
  'nda_signed',
  'financials_received',
  'loi_submitted',
  'loi_accepted',
  'due_diligence',
  'purchase_agreement',
  'financing',
  'closed_won',
  'closed_lost',
];

/**
 * Deterministic stage transition rules.
 * Returns { allowed: boolean, reason?: string }
 */
export function canTransition(fromStage, toStage, deal = {}) {
  const fromIdx = DEAL_STAGES.indexOf(fromStage);
  const toIdx   = DEAL_STAGES.indexOf(toStage);

  if (fromIdx === -1) return { allowed: false, reason: `Unknown stage: ${fromStage}` };
  if (toIdx   === -1) return { allowed: false, reason: `Unknown stage: ${toStage}` };

  // Always allow moving to closed_lost from any stage
  if (toStage === 'closed_lost') return { allowed: true };

  // Cannot skip more than 2 stages forward
  if (toIdx > fromIdx + 2) {
    return { allowed: false, reason: `Cannot skip from ${fromStage} to ${toStage}` };
  }

  // Cannot go backward past initial_contact
  if (toIdx < 1 && fromIdx > 2) {
    return { allowed: false, reason: 'Cannot revert to prospect from active stage' };
  }

  // LOI requires NDA
  if (toStage === 'loi_submitted' && !deal.ndaSigned) {
    return { allowed: false, reason: 'NDA must be signed before submitting LOI' };
  }

  // Due diligence requires accepted LOI
  if (toStage === 'due_diligence' && fromStage !== 'loi_accepted') {
    return { allowed: false, reason: 'LOI must be accepted before starting due diligence' };
  }

  return { allowed: true };
}

/**
 * Determine stage from deal flags (deterministic).
 */
export function inferStageFromFlags({ loiSigned, loiAccepted, ndaSigned, dueDiligenceStarted, purchaseAgreementSigned, closed }) {
  if (closed === 'won')                    return 'closed_won';
  if (closed === 'lost')                   return 'closed_lost';
  if (purchaseAgreementSigned)             return 'purchase_agreement';
  if (dueDiligenceStarted)                 return 'due_diligence';
  if (loiAccepted)                         return 'loi_accepted';
  if (loiSigned)                           return 'loi_submitted';
  if (ndaSigned)                           return 'nda_signed';
  return null;
}

// ─── SBA 7(a) eligibility (deterministic rules) ───────────────────────────────
/**
 * Basic SBA 7(a) eligibility check.
 * Returns { eligible: boolean, flags: string[] }
 */
export function checkSBAEligibility({ revenue, askingPrice, industry, yearsInBusiness, ownerCitizen }) {
  const flags = [];

  if (revenue > 10_000_000) flags.push('Revenue may exceed SBA size standard for some industries');
  if (askingPrice > 5_000_000) flags.push('Loan amount exceeds $5M SBA 7(a) maximum — consider SBA 504 or conventional');
  if (yearsInBusiness < 2)    flags.push('Business under 2 years — lender may require additional documentation');
  if (ownerCitizen === false)  flags.push('Non-citizen borrowers require additional documentation');

  const INELIGIBLE_INDUSTRIES = ['financial', 'real_estate_investment', 'gambling', 'lobbying'];
  if (INELIGIBLE_INDUSTRIES.includes(industry?.toLowerCase())) {
    flags.push(`Industry "${industry}" may be ineligible for SBA financing`);
  }

  return { eligible: flags.filter((f) => f.includes('exceeds') || f.includes('ineligible')).length === 0, flags };
}

// ─── Valuation range (deterministic benchmarks) ───────────────────────────────
export function estimateValuationRange(sde, ebitda, industryType = 'service') {
  const multipliers = {
    service:      { low: 3.0, mid: 4.0, high: 5.0 },
    industrial:   { low: 4.0, mid: 5.0, high: 6.0 },
    distribution: { low: 3.5, mid: 4.5, high: 5.5 },
    software:     { low: 6.0, mid: 8.0, high: 10.0 },
    default:      { low: 3.0, mid: 4.0, high: 5.0 },
  };
  const m = multipliers[industryType] || multipliers.default;
  const base = sde || ebitda || 0;
  return {
    low:  +(base * m.low).toFixed(0),
    mid:  +(base * m.mid).toFixed(0),
    high: +(base * m.high).toFixed(0),
    multipliersUsed: m,
  };
}

export const DealService = {
  calculateDSCR,
  monthlyLoanPayment,
  annualDebtService,
  canTransition,
  inferStageFromFlags,
  checkSBAEligibility,
  estimateValuationRange,
  DEAL_STAGES,
};
export default DealService;
