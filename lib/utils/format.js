/** Format a dollar number as $X.XM / $XXXk / $X */
export function fmtMoney(n) {
  if (!n) return '—';
  const num = Number(n);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${Math.round(num / 1_000)}k`;
  return `$${num}`;
}

/** Format a dollar number with full commas, e.g. $1,234,567 */
export function fmtDollars(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

/** Format a DSCR ratio as "1.32x" */
export function fmtDSCR(n) {
  return n.toFixed(2) + 'x';
}
