import { fmtDollars, fmtDSCR } from '@/lib/utils/format';
import { MIN_DSCR } from '@/lib/utils/dscr';

export default function ResultPanel({ result }) {
  if (!result) return null;
  const { purchasePrice, downPayment, loanAmount, monthlyPmt, annualDebtService, dscr, feasible } = result;
  const color = feasible ? '#4CAF50' : '#B44040';

  const rows = [
    { label: 'Purchase Price', value: fmtDollars(purchasePrice) },
    { label: 'Down Payment (equity / OPM)', value: fmtDollars(downPayment) },
    { label: 'SBA Loan Amount', value: fmtDollars(loanAmount) },
    { label: 'Monthly Payment', value: fmtDollars(monthlyPmt) },
    { label: 'Annual Debt Service', value: fmtDollars(annualDebtService) },
  ];

  return (
    <div style={{ background: '#111', border: `1px solid ${color}44`, borderRadius: 8, padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E0D0' }}>DSCR Analysis</div>
        <div style={{ fontSize: 28, fontWeight: 700, color }}>{fmtDSCR(dscr)}</div>
      </div>
      <div style={{
        fontSize: 12, padding: '6px 12px', borderRadius: 4, marginBottom: 16,
        background: color + '15', color, display: 'inline-block',
      }}>
        {feasible ? `✓ Passes SBA minimum (≥${MIN_DSCR}x)` : `✗ Below SBA minimum (${MIN_DSCR}x required)`}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: '#555' }}>{label}</span>
            <span style={{ color: '#C0B89A', fontWeight: 500 }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
