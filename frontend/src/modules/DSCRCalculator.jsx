import { useState } from 'react';

const fmt = (n) =>
  '$' + Math.round(n).toLocaleString('en-US');

const fmtDSCR = (n) => n.toFixed(2) + 'x';

function monthlyPayment(principal, annualRate, termMonths) {
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1);
}

const styles = {
  page: {
    backgroundColor: '#0D0D0D',
    color: '#E8E0D0',
    minHeight: '100vh',
    fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
    padding: '32px 20px',
    boxSizing: 'border-box',
  },
  container: {
    maxWidth: 820,
    margin: '0 auto',
  },
  heading: {
    fontSize: 26,
    fontWeight: 700,
    color: '#C9A84C',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 0,
  },
  subHeading: {
    fontSize: 13,
    color: '#888',
    marginBottom: 32,
    letterSpacing: '0.05em',
  },
  card: {
    backgroundColor: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '24px 28px',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#C9A84C',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 20,
    marginTop: 0,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: 18,
    gap: 16,
    flexWrap: 'wrap',
  },
  label: {
    fontSize: 13,
    color: '#E8E0D0',
    minWidth: 180,
    flexShrink: 0,
  },
  inputNumber: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 4,
    color: '#E8E0D0',
    fontSize: 14,
    padding: '6px 10px',
    width: 140,
    outline: 'none',
  },
  sliderWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 200,
  },
  slider: {
    flex: 1,
    accentColor: '#C9A84C',
    cursor: 'pointer',
  },
  sliderVal: {
    fontSize: 14,
    fontWeight: 700,
    color: '#C9A84C',
    minWidth: 56,
    textAlign: 'right',
  },
  resultsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 14,
    marginTop: 4,
  },
  resultItem: {
    backgroundColor: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    padding: '12px 16px',
  },
  resultLabel: {
    fontSize: 11,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  },
  resultValue: {
    fontSize: 18,
    fontWeight: 700,
    color: '#E8E0D0',
  },
  dscrBox: (pass) => ({
    border: `2px solid ${pass ? '#4CAF50' : '#e53935'}`,
    borderRadius: 8,
    padding: '20px 24px',
    backgroundColor: pass ? 'rgba(76,175,80,0.06)' : 'rgba(229,57,53,0.06)',
    marginTop: 8,
  }),
  dscrNumber: (pass) => ({
    fontSize: 48,
    fontWeight: 800,
    color: pass ? '#4CAF50' : '#e53935',
    lineHeight: 1,
    marginBottom: 8,
  }),
  dscrStatus: (pass) => ({
    fontSize: 14,
    fontWeight: 700,
    color: pass ? '#4CAF50' : '#e53935',
    marginBottom: 8,
  }),
  dscrDetail: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  formula: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 16,
    padding: '10px 14px',
    borderLeft: '3px solid #2a2a2a',
    backgroundColor: '#111',
    borderRadius: 4,
  },
  loiCard: {
    backgroundColor: '#161616',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    padding: '24px 28px',
    marginBottom: 20,
  },
  loiTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#C9A84C',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 16,
    marginTop: 0,
  },
  loiList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  loiItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '9px 0',
    borderBottom: '1px solid #1e1e1e',
    fontSize: 13,
    color: '#E8E0D0',
    lineHeight: 1.5,
  },
  loiBullet: {
    color: '#C9A84C',
    flexShrink: 0,
    marginTop: 1,
    fontSize: 10,
  },
  loiTerm: {
    color: '#C9A84C',
    fontWeight: 600,
    marginRight: 4,
  },
  sbaFormula: {
    marginTop: 16,
    padding: '14px 18px',
    backgroundColor: '#111',
    border: '1px solid #222',
    borderRadius: 6,
    fontSize: 12,
    color: '#888',
    lineHeight: 1.8,
  },
};

export default function DSCRCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(1500000);
  const [annualNOI, setAnnualNOI] = useState(280000);
  const [sbaPercent, setSbaPercent] = useState(75);
  const [sellerNoteRate, setSellerNoteRate] = useState(6);
  const [sellerNoteTerm, setSellerNoteTerm] = useState(5);

  const sbaLoanAmount = purchasePrice * (sbaPercent / 100);
  const sellerNoteAmount = purchasePrice - sbaLoanAmount;

  const sbaMonthly = monthlyPayment(sbaLoanAmount, 0.1125, 120);
  const sellerMonthly = monthlyPayment(sellerNoteAmount, sellerNoteRate / 100, sellerNoteTerm * 12);

  const totalMonthlyDebtService = sbaMonthly + sellerMonthly;
  const totalAnnualDebtService = totalMonthlyDebtService * 12;
  const dscr = annualNOI / totalAnnualDebtService;
  const dscrPass = dscr >= 1.25;

  const noiNeeded = Math.ceil(1.25 * totalAnnualDebtService - annualNOI);
  const maxPrice = Math.floor((annualNOI / 1.25) / (totalAnnualDebtService / purchasePrice));

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>DSCR Calculator</h1>
        <p style={styles.subHeading}>SBA 7(a) Acquisition Debt Coverage — Live Model</p>

        {/* Inputs */}
        <div style={styles.card}>
          <p style={styles.cardTitle}>Deal Inputs</p>

          <div style={styles.row}>
            <span style={styles.label}>Purchase Price</span>
            <input
              type="number"
              style={styles.inputNumber}
              value={purchasePrice}
              min={0}
              step={50000}
              onChange={(e) => setPurchasePrice(Number(e.target.value))}
            />
            <span style={{ fontSize: 13, color: '#666' }}>{fmt(purchasePrice)}</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Annual NOI / SDE</span>
            <input
              type="number"
              style={styles.inputNumber}
              value={annualNOI}
              min={0}
              step={10000}
              onChange={(e) => setAnnualNOI(Number(e.target.value))}
            />
            <span style={{ fontSize: 13, color: '#666' }}>{fmt(annualNOI)}</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>SBA Loan %</span>
            <div style={styles.sliderWrapper}>
              <input
                type="range"
                style={styles.slider}
                min={60}
                max={85}
                step={1}
                value={sbaPercent}
                onChange={(e) => setSbaPercent(Number(e.target.value))}
              />
              <span style={styles.sliderVal}>{sbaPercent}%</span>
            </div>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Seller Note Rate %</span>
            <input
              type="number"
              style={styles.inputNumber}
              value={sellerNoteRate}
              min={1}
              max={15}
              step={0.5}
              onChange={(e) => setSellerNoteRate(Number(e.target.value))}
            />
            <span style={{ fontSize: 13, color: '#666' }}>{sellerNoteRate}%</span>
          </div>

          <div style={styles.row}>
            <span style={styles.label}>Seller Note Term (years)</span>
            <div style={styles.sliderWrapper}>
              <input
                type="range"
                style={styles.slider}
                min={3}
                max={7}
                step={1}
                value={sellerNoteTerm}
                onChange={(e) => setSellerNoteTerm(Number(e.target.value))}
              />
              <span style={styles.sliderVal}>{sellerNoteTerm} yr</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div style={styles.card}>
          <p style={styles.cardTitle}>Calculated Results</p>
          <div style={styles.resultsGrid}>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>SBA Loan Amount</div>
              <div style={styles.resultValue}>{fmt(sbaLoanAmount)}</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Seller Note Amount</div>
              <div style={styles.resultValue}>{fmt(sellerNoteAmount)}</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>SBA Monthly Payment</div>
              <div style={styles.resultValue}>{fmt(sbaMonthly)}</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Seller Note Monthly</div>
              <div style={styles.resultValue}>{fmt(sellerMonthly)}</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Total Monthly Debt Service</div>
              <div style={styles.resultValue}>{fmt(totalMonthlyDebtService)}</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultLabel}>Total Annual Debt Service</div>
              <div style={styles.resultValue}>{fmt(totalAnnualDebtService)}</div>
            </div>
          </div>
        </div>

        {/* DSCR Output */}
        <div style={styles.card}>
          <p style={styles.cardTitle}>DSCR Result</p>
          <div style={styles.dscrBox(dscrPass)}>
            <div style={styles.dscrNumber(dscrPass)}>{fmtDSCR(dscr)}</div>
            <div style={styles.dscrStatus(dscrPass)}>
              {dscrPass ? '✓ DSCR PASSES — SBA Eligible' : '✗ DSCR FAILS — Below 1.25x Threshold'}
            </div>

            {dscrPass ? (
              <div style={styles.dscrDetail}>
                Coverage ratio is above the 1.25x SBA minimum. This deal structure is eligible for underwriting.
              </div>
            ) : (
              <>
                <div style={{ ...styles.dscrDetail, color: '#e07070', marginBottom: 6 }}>
                  Need {fmt(noiNeeded)} more annual NOI to qualify
                </div>
                <div style={{ ...styles.dscrDetail, color: '#e07070' }}>
                  Or reduce purchase price to approximately {fmt(maxPrice)}
                </div>
              </>
            )}
          </div>

          <div style={styles.formula}>
            <strong style={{ color: '#C9A84C' }}>DSCR Formula:</strong>&nbsp;
            Annual NOI ÷ Annual Debt Service = DSCR&nbsp;&nbsp;|&nbsp;&nbsp;
            {fmt(annualNOI)} ÷ {fmt(totalAnnualDebtService)} = {fmtDSCR(dscr)}&nbsp;&nbsp;
            (minimum required: 1.25x)
          </div>
        </div>

        {/* SBA Payment Formula */}
        <div style={styles.sbaFormula}>
          <div style={{ color: '#C9A84C', fontWeight: 700, marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>SBA Payment Formula</div>
          <div>Monthly Payment = P × [r(1+r)^n] / [(1+r)^n − 1]</div>
          <div style={{ marginTop: 4 }}>
            P = loan principal &nbsp;|&nbsp; r = annual rate ÷ 12 (SBA fixed: 11.25% / 12 = 0.9375%/mo) &nbsp;|&nbsp; n = 120 months (10 years)
          </div>
          <div style={{ marginTop: 4 }}>
            Seller note uses same formula with r = {sellerNoteRate}% ÷ 12, n = {sellerNoteTerm * 12} months
          </div>
        </div>

        {/* LOI Framework */}
        <div style={styles.loiCard}>
          <p style={styles.loiTitle}>LOI Framework Reference</p>

          <div style={{ marginBottom: 12, fontSize: 12, color: '#666' }}>
            Standard terms for a pest control acquisition Letter of Intent — always visible for deal structuring reference.
          </div>

          <ul style={styles.loiList}>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Purchase Price & Structure:</span>
                {fmt(purchasePrice)} total — SBA 7(a) {fmt(sbaLoanAmount)} ({sbaPercent}%) + Seller Note {fmt(sellerNoteAmount)} ({100 - sbaPercent}%)
              </span>
            </li>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Exclusivity Period:</span>
                30–60 days standard, commencing upon execution of LOI
              </span>
            </li>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Due Diligence:</span>
                3 years P&L, tax returns, customer contracts, licenses, employee roster, and AZ OPM compliance documentation
              </span>
            </li>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Transition Assistance:</span>
                90 days from seller — non-negotiable. Includes customer introductions, route handoff, and operational knowledge transfer
              </span>
            </li>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Non-Compete:</span>
                2–3 years, Phoenix metro, pest control industry. Reasonable geographic and scope limitation
              </span>
            </li>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Working Capital Adjustment:</span>
                Agree on normalized working capital target at close. Seller responsible for shortfalls at time of transfer
              </span>
            </li>
            <li style={styles.loiItem}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>Representations & Warranties:</span>
                Standard seller reps covering financial accuracy, title to assets, no undisclosed liabilities, and licensing status
              </span>
            </li>
            <li style={{ ...styles.loiItem, borderBottom: 'none' }}>
              <span style={styles.loiBullet}>◆</span>
              <span>
                <span style={styles.loiTerm}>SBA Loan Approval Contingency:</span>
                Transaction contingent upon SBA 7(a) loan approval. Buyer commits to submitting application within 10 business days of executed LOI
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
