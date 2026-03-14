/**
 * SBA monthly payment formula:
 * P × [r(1+r)^n] / [(1+r)^n − 1]
 */
export function monthlyPayment(principal, annualRate, termMonths) {
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

export const SBA_ANNUAL_RATE = 0.1125; // prime + 2.75%, current
export const SBA_TERM_MONTHS = 120;    // 10 years
export const MIN_DSCR = 1.25;          // SBA minimum
