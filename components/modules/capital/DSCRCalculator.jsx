'use client';

import { useState, useMemo } from 'react';
import { monthlyPayment, SBA_ANNUAL_RATE, SBA_TERM_MONTHS, MIN_DSCR } from '@/lib/utils/dscr';
import InputPanel from './InputPanel';
import ResultPanel from './ResultPanel';
import LOIRef from './LOIRef';
import SectionHeader from '@/components/ui/SectionHeader';

const DEFAULTS = {
  ebitda: '300000',
  multiple: '3.5',
  downPct: '10',
  ratePct: String((SBA_ANNUAL_RATE * 100).toFixed(2)),
  termMonths: String(SBA_TERM_MONTHS),
  noi: '300000',
};

export default function DSCRCalculator() {
  const [vals, setVals] = useState(DEFAULTS);

  const result = useMemo(() => {
    const ebitda = Number(vals.ebitda);
    const multiple = Number(vals.multiple);
    const downPct = Number(vals.downPct) / 100;
    const rate = Number(vals.ratePct) / 100;
    const term = Number(vals.termMonths);
    const noi = Number(vals.noi) || ebitda;

    if (!ebitda || !multiple || !term) return null;

    const purchasePrice = ebitda * multiple;
    const downPayment = purchasePrice * downPct;
    const loanAmount = purchasePrice - downPayment;
    const monthlyPmt = monthlyPayment(loanAmount, rate, term);
    const annualDebtService = monthlyPmt * 12;
    const dscr = noi / annualDebtService;

    return { purchasePrice, downPayment, loanAmount, monthlyPmt, annualDebtService, dscr, feasible: dscr >= MIN_DSCR };
  }, [vals]);

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>Capital & DSCR</h1>
        <div style={{ fontSize: 13, color: '#555' }}>SBA 7(a) deal structuring calculator</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div>
          <SectionHeader>Deal Inputs</SectionHeader>
          <InputPanel vals={vals} onChange={setVals} />
        </div>
        <div>
          <SectionHeader>Results</SectionHeader>
          {result ? <ResultPanel result={result} /> : (
            <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '40px', textAlign: 'center', color: '#444', fontSize: 13 }}>
              Enter EBITDA and multiple to calculate
            </div>
          )}
        </div>
      </div>

      <LOIRef />
    </div>
  );
}
