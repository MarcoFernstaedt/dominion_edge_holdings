'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatCurrencyFull, formatPercent, monthlyPayment, calcNormalizedSDE, calcDSCR } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, CheckCircle2, TrendingUp, Calculator, Plus, Trash2 } from 'lucide-react';
import type { UnderwritingScenario } from '@/lib/types';

interface ScenarioInputs {
  scenarioName: string;
  dealId: string;
  revenue: number;
  cogs: number;
  opex: number;
  ownerSalaryAdjustments: number;
  oneTimeAdjustments: number;
  personalExpenseAddBacks: number;
  purchasePrice: number;
  downPaymentPct: number;
  seniorDebtRate: number;
  seniorDebtTermMonths: number;
  sellerNotePct: number;
  sellerNoteRate: number;
  sellerNoteTermMonths: number;
}

function calcScenario(inputs: ScenarioInputs) {
  const normalizedSDE = calcNormalizedSDE(
    inputs.revenue,
    inputs.cogs,
    inputs.opex,
    inputs.ownerSalaryAdjustments,
    inputs.oneTimeAdjustments,
    inputs.personalExpenseAddBacks
  );

  const downPayment = inputs.purchasePrice * (inputs.downPaymentPct / 100);
  const remainingAfterDown = inputs.purchasePrice - downPayment;
  const sellerNoteAmount = inputs.purchasePrice * (inputs.sellerNotePct / 100);
  const seniorDebtAmount = Math.max(0, remainingAfterDown - sellerNoteAmount);

  const seniorDebtMonthly = monthlyPayment(seniorDebtAmount, inputs.seniorDebtRate / 100, inputs.seniorDebtTermMonths);
  const sellerNoteMonthly = monthlyPayment(sellerNoteAmount, inputs.sellerNoteRate / 100, inputs.sellerNoteTermMonths);

  const monthlyDebtService = seniorDebtMonthly + sellerNoteMonthly;
  const annualDebtService = monthlyDebtService * 12;
  const dscr = calcDSCR(normalizedSDE, annualDebtService);
  const postDebtCashFlowAnnual = normalizedSDE - annualDebtService;

  const netIncome = inputs.revenue - inputs.cogs - inputs.opex;
  const sdeMultiple = inputs.purchasePrice > 0 && normalizedSDE > 0 ? inputs.purchasePrice / normalizedSDE : 0;

  return {
    normalizedSDE,
    downPayment,
    seniorDebtAmount,
    sellerNoteAmount,
    seniorDebtMonthly,
    sellerNoteMonthly,
    monthlyDebtService,
    annualDebtService,
    dscr,
    postDebtCashFlowAnnual,
    netIncome,
    sdeMultiple,
    sdePct: inputs.revenue > 0 ? (normalizedSDE / inputs.revenue) * 100 : 0,
  };
}

const DEFAULT_INPUTS: ScenarioInputs = {
  scenarioName: 'Base Case',
  dealId: '',
  revenue: 2000000,
  cogs: 600000,
  opex: 800000,
  ownerSalaryAdjustments: 120000,
  oneTimeAdjustments: 0,
  personalExpenseAddBacks: 15000,
  purchasePrice: 1750000,
  downPaymentPct: 10,
  seniorDebtRate: 7.5,
  seniorDebtTermMonths: 120,
  sellerNotePct: 10,
  sellerNoteRate: 6.0,
  sellerNoteTermMonths: 60,
};

function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">{label}</label>
      <div className="flex items-center">
        {prefix && <span className="px-2.5 py-2 bg-[#1B1B1D] border border-r-0 border-[#2A2A2E] rounded-l text-sm text-[#A7A29A]">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          step={step ?? 1000}
          className={cn(
            'flex-1 bg-[#1B1B1D] border border-[#2A2A2E] text-sm text-[#E8E6E3] px-3 py-2',
            'focus:outline-none focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] transition-colors',
            prefix && 'rounded-none',
            suffix ? 'rounded-none' : !prefix ? 'rounded' : 'rounded-r'
          )}
        />
        {suffix && <span className="px-2.5 py-2 bg-[#1B1B1D] border border-l-0 border-[#2A2A2E] rounded-r text-sm text-[#A7A29A]">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-[#A7A29A]">{hint}</p>}
    </div>
  );
}

function ResultRow({ label, value, highlight, danger }: { label: string; value: string; highlight?: boolean; danger?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-2 border-b border-[#2A2A2E] last:border-0')}>
      <span className="text-sm text-[#A7A29A]">{label}</span>
      <span className={cn('text-sm font-semibold', highlight ? 'text-[#D4AF37]' : danger ? 'text-[#C35B5B]' : 'text-[#E8E6E3]')}>
        {value}
      </span>
    </div>
  );
}

export default function UnderwritingPage() {
  const scenarios = useAppStore((s) => s.underwritingScenarios);
  const addScenario = useAppStore((s) => s.addScenario);
  const deleteScenario = useAppStore((s) => s.deleteScenario);
  const deals = useAppStore((s) => s.deals);

  const [inputs, setInputs] = useState<ScenarioInputs>(DEFAULT_INPUTS);
  const [saved, setSaved] = useState(false);

  const results = useMemo(() => calcScenario(inputs), [inputs]);

  const set = (field: keyof ScenarioInputs) => (v: number | string) =>
    setInputs((p) => ({ ...p, [field]: typeof v === 'number' ? v : v }));

  function handleSave() {
    const scenario: UnderwritingScenario = {
      id: generateId(),
      dealId: inputs.dealId,
      scenarioName: inputs.scenarioName,
      revenue: inputs.revenue,
      cogs: inputs.cogs,
      opex: inputs.opex,
      ownerSalaryAdjustments: inputs.ownerSalaryAdjustments,
      oneTimeAdjustments: inputs.oneTimeAdjustments,
      personalExpenseAddBacks: inputs.personalExpenseAddBacks,
      normalizedSDE: results.normalizedSDE,
      purchasePrice: inputs.purchasePrice,
      downPayment: results.downPayment,
      seniorDebtAmount: results.seniorDebtAmount,
      seniorDebtRate: inputs.seniorDebtRate,
      seniorDebtTermMonths: inputs.seniorDebtTermMonths,
      sellerNoteAmount: results.sellerNoteAmount,
      sellerNoteRate: inputs.sellerNoteRate,
      sellerNoteTermMonths: inputs.sellerNoteTermMonths,
      annualDebtService: results.annualDebtService,
      monthlyDebtService: results.monthlyDebtService,
      dscr: results.dscr,
      postDebtCashFlowAnnual: results.postDebtCashFlowAnnual,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    addScenario(scenario);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    const announcer = document.getElementById('status-announcer');
    if (announcer) announcer.textContent = 'Scenario saved';
  }

  const dscrStatus = results.dscr >= 1.25 ? 'pass' : results.dscr >= 1.0 ? 'marginal' : 'fail';
  const dscrLabel = dscrStatus === 'pass' ? '✓ Passes SBA threshold' : dscrStatus === 'marginal' ? '⚠ Below 1.25x — marginal' : '✗ Below 1.0x — deal fails';

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Underwriting</h1>
        <p className="text-sm text-[#A7A29A] mt-1">DSCR model · SDE normalization · Debt scenario analysis</p>
      </header>

      {/* DSCR result banner */}
      <div className={cn(
        'rounded-md p-4 flex items-center justify-between',
        dscrStatus === 'pass' ? 'bg-[#3FA66B15] border border-[#3FA66B40]' :
        dscrStatus === 'marginal' ? 'bg-[#D9A44115] border border-[#D9A44140]' :
        'bg-[#C35B5B15] border border-[#C35B5B40]'
      )} role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          {dscrStatus === 'pass' ? <CheckCircle2 size={20} className="text-[#3FA66B]" aria-hidden /> :
           dscrStatus === 'marginal' ? <AlertTriangle size={20} className="text-[#D9A441]" aria-hidden /> :
           <AlertTriangle size={20} className="text-[#C35B5B]" aria-hidden />}
          <div>
            <div className="font-bold text-lg text-[#E8E6E3] font-serif">DSCR: {results.dscr > 0 ? results.dscr.toFixed(2) : '—'}x</div>
            <div className={cn('text-sm', dscrStatus === 'pass' ? 'text-[#3FA66B]' : dscrStatus === 'marginal' ? 'text-[#D9A441]' : 'text-[#C35B5B]')}>
              {dscrLabel}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#A7A29A]">Post-Debt Cash Flow</div>
          <div className={cn('text-lg font-bold', results.postDebtCashFlowAnnual > 0 ? 'text-[#3FA66B]' : 'text-[#C35B5B]')}>
            {formatCurrencyFull(results.postDebtCashFlowAnnual)}/yr
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inputs */}
        <div className="space-y-5">
          {/* Scenario setup */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-4">Scenario Setup</h2>
            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">Scenario Name</label>
                <input
                  type="text"
                  value={inputs.scenarioName}
                  onChange={(e) => setInputs((p) => ({ ...p, scenarioName: e.target.value }))}
                  className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  placeholder="Base Case, Conservative, Aggressive..."
                />
              </div>
              {deals.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">Link to Deal</label>
                  <select
                    value={inputs.dealId}
                    onChange={(e) => setInputs((p) => ({ ...p, dealId: e.target.value }))}
                    className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="">— No deal —</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#1B1B1D]">{d.companyName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* SDE Normalization */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-4">SDE Normalization</h2>
            <div className="space-y-3">
              <NumberInput label="Revenue" value={inputs.revenue} onChange={(v) => set('revenue')(v)} prefix="$" />
              <NumberInput label="COGS" value={inputs.cogs} onChange={(v) => set('cogs')(v)} prefix="$" hint="Cost of goods sold / direct service costs" />
              <NumberInput label="Operating Expenses" value={inputs.opex} onChange={(v) => set('opex')(v)} prefix="$" hint="Rent, wages, insurance, overhead" />
              <div className="pt-2 border-t border-[#2A2A2E]">
                <div className="text-xs text-[#A7A29A] mb-2">Add-backs (increase SDE)</div>
                <div className="space-y-2.5">
                  <NumberInput label="Owner Salary Add-back" value={inputs.ownerSalaryAdjustments} onChange={(v) => set('ownerSalaryAdjustments')(v)} prefix="$" hint="Market-rate salary replacement" />
                  <NumberInput label="Personal Expense Add-backs" value={inputs.personalExpenseAddBacks} onChange={(v) => set('personalExpenseAddBacks')(v)} prefix="$" hint="Personal expenses run through business" />
                  <NumberInput label="One-Time Adjustments" value={inputs.oneTimeAdjustments} onChange={(v) => set('oneTimeAdjustments')(v)} prefix="$" hint="Non-recurring expenses to add back" />
                </div>
              </div>
            </div>
          </div>

          {/* Debt structure */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-4">Debt Structure</h2>
            <div className="space-y-3">
              <NumberInput label="Purchase Price" value={inputs.purchasePrice} onChange={(v) => set('purchasePrice')(v)} prefix="$" />
              <NumberInput label="Down Payment" value={inputs.downPaymentPct} onChange={(v) => set('downPaymentPct')(v)} suffix="%" hint="Equity injection required" step={0.5} />
              <div className="pt-2 border-t border-[#2A2A2E]">
                <div className="text-xs text-[#A7A29A] mb-2">Senior Debt (SBA 7a)</div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberInput label="Rate" value={inputs.seniorDebtRate} onChange={(v) => set('seniorDebtRate')(v)} suffix="%" step={0.25} />
                  <div className="col-span-2">
                    <NumberInput label="Term (months)" value={inputs.seniorDebtTermMonths} onChange={(v) => set('seniorDebtTermMonths')(v)} step={12} hint="120=10yr, 84=7yr" />
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-[#2A2A2E]">
                <div className="text-xs text-[#A7A29A] mb-2">Seller Note</div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberInput label="% of Price" value={inputs.sellerNotePct} onChange={(v) => set('sellerNotePct')(v)} suffix="%" step={0.5} />
                  <NumberInput label="Rate" value={inputs.sellerNoteRate} onChange={(v) => set('sellerNoteRate')(v)} suffix="%" step={0.25} />
                  <NumberInput label="Term (mo)" value={inputs.sellerNoteTermMonths} onChange={(v) => set('sellerNoteTermMonths')(v)} step={12} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Results */}
        <div className="space-y-5">
          {/* SDE Summary */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">SDE Calculation</h2>
            <div className="font-mono text-xs text-[#A7A29A] space-y-1.5 mb-3">
              <div className="flex justify-between">
                <span>Revenue</span>
                <span className="text-[#E8E6E3]">{formatCurrencyFull(inputs.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>- COGS</span>
                <span className="text-[#C35B5B]">({formatCurrencyFull(inputs.cogs)})</span>
              </div>
              <div className="flex justify-between">
                <span>- OpEx</span>
                <span className="text-[#C35B5B]">({formatCurrencyFull(inputs.opex)})</span>
              </div>
              <div className="flex justify-between border-t border-[#2A2A2E] pt-1">
                <span>Net Income</span>
                <span className={results.netIncome >= 0 ? 'text-[#E8E6E3]' : 'text-[#C35B5B]'}>{formatCurrencyFull(results.netIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Owner Salary</span>
                <span className="text-[#3FA66B]">+{formatCurrencyFull(inputs.ownerSalaryAdjustments)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ Personal Addbacks</span>
                <span className="text-[#3FA66B]">+{formatCurrencyFull(inputs.personalExpenseAddBacks)}</span>
              </div>
              <div className="flex justify-between">
                <span>+ One-Time Adj.</span>
                <span className="text-[#3FA66B]">+{formatCurrencyFull(inputs.oneTimeAdjustments)}</span>
              </div>
              <div className="flex justify-between border-t border-[#D4AF3730] pt-1.5">
                <span className="font-bold text-[#D4AF37]">= Normalized SDE</span>
                <span className="font-bold text-[#D4AF37] text-sm">{formatCurrencyFull(results.normalizedSDE)}</span>
              </div>
            </div>
            <div className="text-xs text-[#A7A29A]">
              SDE Margin: {formatPercent(results.sdePct)} · {results.sdeMultiple.toFixed(1)}x multiple
            </div>
          </div>

          {/* Debt summary */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Debt Structure</h2>
            <ResultRow label="Purchase Price" value={formatCurrencyFull(inputs.purchasePrice)} />
            <ResultRow label={`Down Payment (${inputs.downPaymentPct}%)`} value={formatCurrencyFull(results.downPayment)} />
            <ResultRow label={`Senior Debt (SBA @ ${inputs.seniorDebtRate}%)`} value={formatCurrencyFull(results.seniorDebtAmount)} />
            <ResultRow label={`Seller Note (${inputs.sellerNotePct}% @ ${inputs.sellerNoteRate}%)`} value={formatCurrencyFull(results.sellerNoteAmount)} />
            <div className="border-t border-[#2A2A2E] mt-1 pt-1">
              <ResultRow label="Monthly Debt Service" value={formatCurrencyFull(results.monthlyDebtService)} highlight />
              <ResultRow label="Annual Debt Service" value={formatCurrencyFull(results.annualDebtService)} highlight />
            </div>
          </div>

          {/* DSCR */}
          <div className={cn(
            'rounded-md p-5 border',
            dscrStatus === 'pass' ? 'bg-[#141414] border-[#3FA66B40]' :
            dscrStatus === 'marginal' ? 'bg-[#141414] border-[#D9A44140]' :
            'bg-[#141414] border-[#C35B5B40]'
          )}>
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">DSCR Analysis</h2>
            <div className="font-mono text-xs text-[#A7A29A] space-y-1.5 mb-3">
              <div className="flex justify-between">
                <span>Normalized SDE</span>
                <span className="text-[#E8E6E3]">{formatCurrencyFull(results.normalizedSDE)}</span>
              </div>
              <div className="flex justify-between">
                <span>÷ Annual Debt Service</span>
                <span className="text-[#E8E6E3]">{formatCurrencyFull(results.annualDebtService)}</span>
              </div>
              <div className={cn('flex justify-between border-t border-[#2A2A2E] pt-1.5 text-sm font-bold')}>
                <span className={dscrStatus === 'pass' ? 'text-[#3FA66B]' : dscrStatus === 'marginal' ? 'text-[#D9A441]' : 'text-[#C35B5B]'}>
                  = DSCR
                </span>
                <span className={dscrStatus === 'pass' ? 'text-[#3FA66B]' : dscrStatus === 'marginal' ? 'text-[#D9A441]' : 'text-[#C35B5B]'}>
                  {results.dscr.toFixed(3)}x
                </span>
              </div>
            </div>
            <div className="text-xs text-[#A7A29A] mb-2">SBA minimum threshold: 1.25x</div>
            <div className={cn('text-xs font-semibold', dscrStatus === 'pass' ? 'text-[#3FA66B]' : dscrStatus === 'marginal' ? 'text-[#D9A441]' : 'text-[#C35B5B]')}>
              {dscrLabel}
            </div>
            <div className="mt-3 pt-3 border-t border-[#2A2A2E]">
              <ResultRow
                label="Post-Debt Annual Cash Flow"
                value={formatCurrencyFull(results.postDebtCashFlowAnnual)}
                highlight={results.postDebtCashFlowAnnual > 0}
                danger={results.postDebtCashFlowAnnual < 0}
              />
            </div>
          </div>

          {/* Risk flags */}
          {(results.dscr < 1.25 || results.sdeMultiple > 5.5 || inputs.downPaymentPct < 10 || results.sdePct < 15) && (
            <div className="bg-[#C35B5B10] border border-[#C35B5B30] rounded-md p-4">
              <h3 className="text-[10px] tracking-widest uppercase font-medium text-[#C35B5B] mb-2">Risk Flags</h3>
              <ul className="space-y-1.5" role="list">
                {results.dscr < 1.25 && (
                  <li className="flex items-start gap-2 text-xs text-[#E8E6E3]">
                    <AlertTriangle size={12} className="text-[#C35B5B] flex-shrink-0 mt-0.5" aria-hidden />
                    DSCR below 1.25x — SBA approval at risk
                  </li>
                )}
                {results.sdeMultiple > 5.5 && (
                  <li className="flex items-start gap-2 text-xs text-[#E8E6E3]">
                    <AlertTriangle size={12} className="text-[#C35B5B] flex-shrink-0 mt-0.5" aria-hidden />
                    Purchase multiple {results.sdeMultiple.toFixed(1)}x — above typical 4–5x range
                  </li>
                )}
                {inputs.downPaymentPct < 10 && (
                  <li className="flex items-start gap-2 text-xs text-[#E8E6E3]">
                    <AlertTriangle size={12} className="text-[#C35B5B] flex-shrink-0 mt-0.5" aria-hidden />
                    Down payment below 10% — below SBA minimum
                  </li>
                )}
                {results.sdePct < 15 && inputs.revenue > 0 && (
                  <li className="flex items-start gap-2 text-xs text-[#E8E6E3]">
                    <AlertTriangle size={12} className="text-[#D9A441] flex-shrink-0 mt-0.5" aria-hidden />
                    SDE margin {formatPercent(results.sdePct)} — below 15% is tight
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSave} loading={saved}>
              {saved ? 'Saved!' : 'Save Scenario'}
            </Button>
            <Button variant="ghost" onClick={() => setInputs(DEFAULT_INPUTS)}>Reset</Button>
          </div>
        </div>
      </div>

      {/* Saved scenarios */}
      {scenarios.length > 0 && (
        <section aria-labelledby="saved-scenarios">
          <h2 id="saved-scenarios" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">
            Saved Scenarios ({scenarios.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {scenarios.map((s) => (
              <div key={s.id} className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4 relative group">
                <button
                  onClick={() => deleteScenario(s.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[#A7A29A] hover:text-[#C35B5B] transition-all focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                  aria-label={`Delete ${s.scenarioName} scenario`}
                >
                  <Trash2 size={13} aria-hidden />
                </button>
                <div className="text-sm font-semibold text-[#E8E6E3] mb-1">{s.scenarioName}</div>
                {s.dealId && deals.find((d) => d.id === s.dealId) && (
                  <div className="text-xs text-[#A7A29A] mb-2">{deals.find((d) => d.id === s.dealId)?.companyName}</div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#A7A29A]">DSCR</span>
                    <Badge variant={s.dscr >= 1.25 ? 'success' : 'danger'} size="sm">{s.dscr.toFixed(2)}x</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#A7A29A]">Norm. SDE</span>
                    <span className="text-xs text-[#D4AF37]">{formatCurrencyFull(s.normalizedSDE)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#A7A29A]">Post-debt CF</span>
                    <span className={cn('text-xs', s.postDebtCashFlowAnnual >= 0 ? 'text-[#3FA66B]' : 'text-[#C35B5B]')}>
                      {formatCurrencyFull(s.postDebtCashFlowAnnual)}/yr
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setInputs({
                    scenarioName: s.scenarioName,
                    dealId: s.dealId,
                    revenue: s.revenue,
                    cogs: s.cogs,
                    opex: s.opex,
                    ownerSalaryAdjustments: s.ownerSalaryAdjustments,
                    oneTimeAdjustments: s.oneTimeAdjustments,
                    personalExpenseAddBacks: s.personalExpenseAddBacks,
                    purchasePrice: s.purchasePrice,
                    downPaymentPct: s.downPayment > 0 ? (s.downPayment / s.purchasePrice) * 100 : 10,
                    seniorDebtRate: s.seniorDebtRate,
                    seniorDebtTermMonths: s.seniorDebtTermMonths,
                    sellerNotePct: s.sellerNoteAmount > 0 ? (s.sellerNoteAmount / s.purchasePrice) * 100 : 10,
                    sellerNoteRate: s.sellerNoteRate,
                    sellerNoteTermMonths: s.sellerNoteTermMonths,
                  })}
                  className="mt-2 text-xs text-[#D4AF37] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                >
                  Load →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
