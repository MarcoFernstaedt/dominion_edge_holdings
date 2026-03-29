import { describe, it, expect } from 'vitest';
import {
  monthlyPayment,
  calcDSCR,
  calcNormalizedSDE,
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  truncate,
  initials,
  statusLabel,
  daysSince,
  isOverdue,
  STAGE_ORDER,
  STAGE_LABELS,
} from '../utils';

// ─── monthlyPayment ───────────────────────────────────────────────────────────
describe('monthlyPayment', () => {
  it('returns 0 for zero principal', () => {
    expect(monthlyPayment(0, 6.5, 120)).toBe(0);
  });

  it('returns 0 for negative principal', () => {
    expect(monthlyPayment(-1000, 6.5, 120)).toBe(0);
  });

  it('returns principal/term when rate is 0', () => {
    expect(monthlyPayment(120000, 0, 120)).toBeCloseTo(1000, 0);
  });

  it('calculates SBA 7a loan correctly (rate as decimal)', () => {
    // $1M at 6.5% (0.065 decimal) over 10 years (120 months)
    // Standard amortization: ~$11,355/month
    const payment = monthlyPayment(1_000_000, 0.065, 120);
    expect(payment).toBeGreaterThan(11_000);
    expect(payment).toBeLessThan(12_000);
  });

  it('higher rate means higher payment', () => {
    const low = monthlyPayment(500_000, 0.05, 120);
    const high = monthlyPayment(500_000, 0.08, 120);
    expect(high).toBeGreaterThan(low);
  });

  it('longer term means lower payment', () => {
    const short = monthlyPayment(500_000, 0.065, 120);
    const long = monthlyPayment(500_000, 0.065, 240);
    expect(long).toBeLessThan(short);
  });
});

// ─── calcDSCR ─────────────────────────────────────────────────────────────────
describe('calcDSCR', () => {
  it('returns 0 when annualDebtService is 0', () => {
    expect(calcDSCR(200_000, 0)).toBe(0);
  });

  it('returns 0 when annualDebtService is negative', () => {
    expect(calcDSCR(200_000, -1)).toBe(0);
  });

  it('correctly calculates DSCR = 1.25x', () => {
    expect(calcDSCR(125_000, 100_000)).toBeCloseTo(1.25, 4);
  });

  it('flags failing DSCR below 1.25', () => {
    const dscr = calcDSCR(100_000, 100_000);
    expect(dscr).toBeLessThan(1.25);
    expect(dscr).toBeCloseTo(1.0, 4);
  });

  it('correctly calculates strong DSCR', () => {
    expect(calcDSCR(250_000, 100_000)).toBeCloseTo(2.5, 4);
  });
});

// ─── calcNormalizedSDE ────────────────────────────────────────────────────────
describe('calcNormalizedSDE', () => {
  it('calculates SDE from revenue components', () => {
    // Revenue: 1M, COGS: 400K, OpEx: 300K → netIncome: 300K
    // Owner salary: 100K, One-time: 50K, Addbacks: 25K
    // SDE = 300K + 100K + 25K + 50K = 475K
    const sde = calcNormalizedSDE(1_000_000, 400_000, 300_000, 100_000, 50_000, 25_000);
    expect(sde).toBe(475_000);
  });

  it('returns negative SDE for unprofitable business', () => {
    const sde = calcNormalizedSDE(100_000, 200_000, 50_000, 0, 0, 0);
    expect(sde).toBe(-150_000);
  });

  it('returns owner salary as addback when no other adjustments', () => {
    const sde = calcNormalizedSDE(500_000, 200_000, 100_000, 80_000, 0, 0);
    // netIncome = 200K, + ownerSalary 80K = 280K
    expect(sde).toBe(280_000);
  });
});

// ─── formatCurrency ───────────────────────────────────────────────────────────
describe('formatCurrency', () => {
  it('formats millions', () => {
    expect(formatCurrency(2_500_000)).toBe('$2.50M');
  });

  it('formats thousands', () => {
    expect(formatCurrency(350_000)).toBe('$350K');
  });

  it('formats small amounts', () => {
    expect(formatCurrency(500)).toMatch(/\$500/);
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toMatch(/\$0/);
  });
});

// ─── formatCurrencyFull ───────────────────────────────────────────────────────
describe('formatCurrencyFull', () => {
  it('formats with commas', () => {
    expect(formatCurrencyFull(1_250_000)).toBe('$1,250,000');
  });

  it('rounds to nearest dollar', () => {
    expect(formatCurrencyFull(1234.78)).toBe('$1,235');
  });
});

// ─── formatPercent ────────────────────────────────────────────────────────────
describe('formatPercent', () => {
  it('defaults to 1 decimal', () => {
    expect(formatPercent(12.5)).toBe('12.5%');
  });

  it('respects custom decimals', () => {
    expect(formatPercent(12.5678, 2)).toBe('12.57%');
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────
describe('truncate', () => {
  it('returns string unchanged if within limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates and adds ellipsis when over limit', () => {
    // truncate(str, 8) → str.slice(0, 5) + '…' = 6 chars
    // The function removes 3 from maxLen for the ellipsis character
    const result = truncate('hello world', 8);
    expect(result.length).toBeLessThan(8);
    expect(result).toMatch(/…$/);
  });

  it('truncates long string correctly', () => {
    const result = truncate('abcdefghij', 7);
    // slice(0, 4) + '…' = 'abcd…' (5 chars)
    expect(result).toBe('abcd…');
    expect(result.length).toBe(5);
  });

  it('handles exact length', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
});

// ─── initials ─────────────────────────────────────────────────────────────────
describe('initials', () => {
  it('returns first two initials', () => {
    expect(initials('Marco Fernstaedt')).toBe('MF');
  });

  it('returns single initial for one name', () => {
    expect(initials('Marco')).toBe('M');
  });

  it('handles multiple words — uses first two only', () => {
    expect(initials('Marco James Fernstaedt')).toBe('MJ');
  });

  it('handles empty string', () => {
    expect(initials('')).toBe('');
  });
});

// ─── statusLabel ─────────────────────────────────────────────────────────────
describe('statusLabel', () => {
  it('converts underscores to spaces and capitalizes', () => {
    expect(statusLabel('under_loi')).toBe('Under Loi');
  });

  it('handles single word', () => {
    expect(statusLabel('draft')).toBe('Draft');
  });

  it('handles already capitalized', () => {
    expect(statusLabel('Closed')).toBe('Closed');
  });
});

// ─── daysSince ────────────────────────────────────────────────────────────────
describe('daysSince', () => {
  it('returns 0 for today', () => {
    expect(daysSince(new Date().toISOString())).toBe(0);
  });

  it('returns 1 for yesterday', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(yesterday)).toBe(1);
  });

  it('returns 7 for a week ago', () => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(daysSince(weekAgo)).toBe(7);
  });
});

// ─── isOverdue ────────────────────────────────────────────────────────────────
describe('isOverdue', () => {
  it('returns true for past dates', () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isOverdue(past)).toBe(true);
  });

  it('returns false for future dates', () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isOverdue(future)).toBe(false);
  });
});

// ─── STAGE_ORDER ──────────────────────────────────────────────────────────────
describe('STAGE_ORDER', () => {
  it('has 11 defined stages', () => {
    expect(STAGE_ORDER).toHaveLength(11);
  });

  it('starts with identified', () => {
    expect(STAGE_ORDER[0]).toBe('identified');
  });

  it('ends with lost', () => {
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe('lost');
  });
});

// ─── STAGE_LABELS ─────────────────────────────────────────────────────────────
describe('STAGE_LABELS', () => {
  it('has a label for every stage in STAGE_ORDER', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage]).toBeDefined();
      expect(typeof STAGE_LABELS[stage]).toBe('string');
    }
  });
});
