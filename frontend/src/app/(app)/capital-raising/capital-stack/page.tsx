'use client';

import { useState, useEffect, useCallback } from 'react';
import { capitalRaisingApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { Plus, Layers } from 'lucide-react';
import type { CapitalStack } from '@/lib/types';

function fmt(n: number) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(part: number, total: number) {
  if (!total) return '—';
  return `${((part / total) * 100).toFixed(1)}%`;
}

const BLANK = {
  dealId: '',
  purchasePrice: '',
  seniorDebtAmount: '',
  sellerNoteAmount: '',
  operatorEquity: '',
  investorEquity: '',
  debtInterestRate: '',
  debtTermMonths: '',
  sellerNoteRate: '',
  sellerNoteTermMonths: '',
};

function StackForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<typeof BLANK>;
  onSave: (data: typeof BLANK) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const set = (k: keyof typeof BLANK, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const pp   = Number(form.purchasePrice)    || 0;
  const sd   = Number(form.seniorDebtAmount) || 0;
  const sn   = Number(form.sellerNoteAmount) || 0;
  const oe   = Number(form.operatorEquity)   || 0;
  const ie   = Number(form.investorEquity)   || 0;
  const eqReq = Math.max(0, pp - sd - sn);
  const committed = oe + ie;
  const remaining = Math.max(0, eqReq - committed);

  return (
    <div className="space-y-5">
      <Input label="Deal ID (optional)" value={form.dealId} onChange={(e) => set('dealId', e.target.value)} placeholder="Link to a deal" />
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Purchase</h3>
      <Input label="Purchase Price ($) *" type="number" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Debt</h3>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Senior Debt ($)" type="number" value={form.seniorDebtAmount} onChange={(e) => set('seniorDebtAmount', e.target.value)} />
        <Input label="Interest Rate (%)" type="number" value={form.debtInterestRate} onChange={(e) => set('debtInterestRate', e.target.value)} />
      </div>
      <Input label="Debt Term (months)" type="number" value={form.debtTermMonths} onChange={(e) => set('debtTermMonths', e.target.value)} />
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Seller Note</h3>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Seller Note ($)" type="number" value={form.sellerNoteAmount} onChange={(e) => set('sellerNoteAmount', e.target.value)} />
        <Input label="Note Rate (%)" type="number" value={form.sellerNoteRate} onChange={(e) => set('sellerNoteRate', e.target.value)} />
      </div>
      <Input label="Note Term (months)" type="number" value={form.sellerNoteTermMonths} onChange={(e) => set('sellerNoteTermMonths', e.target.value)} />
      <h3 className="text-sm font-medium text-[var(--color-text-muted)] uppercase tracking-wide">Equity</h3>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Operator Equity ($)" type="number" value={form.operatorEquity} onChange={(e) => set('operatorEquity', e.target.value)} />
        <Input label="Investor Equity ($)" type="number" value={form.investorEquity} onChange={(e) => set('investorEquity', e.target.value)} />
      </div>

      {/* Live preview */}
      {pp > 0 && (
        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 space-y-2">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2">Preview</p>
          {[
            ['Purchase Price', fmt(pp), '100%'],
            ['Senior Debt',    fmt(sd),   pct(sd, pp)],
            ['Seller Note',    fmt(sn),   pct(sn, pp)],
            ['Equity Required',fmt(eqReq),pct(eqReq, pp)],
            ['Operator Equity',fmt(oe),   pct(oe, pp)],
            ['Investor Equity',fmt(ie),   pct(ie, pp)],
            ['Still Needed',   fmt(remaining), pct(remaining, pp)],
          ].map(([label, value, p]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[var(--color-text-muted)]">{label}</span>
              <span className="font-medium text-[var(--color-text-primary)]">{value} <span className="text-[var(--color-text-muted)] text-xs">({p})</span></span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.purchasePrice}>Save Stack</Button>
      </div>
    </div>
  );
}

function StackCard({ stack, onEdit, onDelete }: { stack: CapitalStack; onEdit: () => void; onDelete: () => void }) {
  const pp = stack.purchasePrice;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="font-medium text-[var(--color-text-primary)]">
            {stack.dealId ? `Deal Stack` : 'Capital Stack'} — {fmt(pp)}
          </h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400">Delete</Button>
        </div>
      </div>
      <div className="space-y-2">
        {[
          { label: 'Purchase Price',   value: fmt(pp),                     width: 100 },
          { label: 'Senior Debt',      value: fmt(stack.seniorDebtAmount),  width: pp ? (stack.seniorDebtAmount / pp) * 100 : 0 },
          { label: 'Seller Note',      value: fmt(stack.sellerNoteAmount),  width: pp ? (stack.sellerNoteAmount / pp) * 100 : 0 },
          { label: 'Equity Required',  value: fmt(stack.equityRequired),    width: pp ? (stack.equityRequired / pp) * 100 : 0 },
          { label: 'Committed',        value: fmt(stack.committedInvestorEquity), width: pp ? (stack.committedInvestorEquity / pp) * 100 : 0 },
          { label: 'Still Needed',     value: fmt(stack.equityStillNeeded), width: pp ? (stack.equityStillNeeded / pp) * 100 : 0 },
        ].map(({ label, value, width }) => (
          <div key={label}>
            <div className="flex justify-between text-sm mb-0.5">
              <span className="text-[var(--color-text-muted)]">{label}</span>
              <span className="font-medium text-[var(--color-text-primary)]">{value}</span>
            </div>
            <div className="h-1.5 bg-[var(--color-bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all"
                style={{ width: `${Math.min(width, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {stack.debtInterestRate > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] grid grid-cols-2 gap-2 text-sm">
          <div className="text-[var(--color-text-muted)]">Debt Rate: <span className="text-[var(--color-text-primary)] font-medium">{stack.debtInterestRate}%</span></div>
          <div className="text-[var(--color-text-muted)]">Debt Term: <span className="text-[var(--color-text-primary)] font-medium">{stack.debtTermMonths}mo</span></div>
          {stack.sellerNoteRate > 0 && <>
            <div className="text-[var(--color-text-muted)]">Note Rate: <span className="text-[var(--color-text-primary)] font-medium">{stack.sellerNoteRate}%</span></div>
            <div className="text-[var(--color-text-muted)]">Note Term: <span className="text-[var(--color-text-primary)] font-medium">{stack.sellerNoteTermMonths}mo</span></div>
          </>}
        </div>
      )}
    </div>
  );
}

export default function CapitalStackPage() {
  const [stacks, setStacks] = useState<CapitalStack[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<CapitalStack | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capitalRaisingApi.listStacks();
      setStacks((res as { capitalStacks: CapitalStack[] }).capitalStacks);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toPayload(form: typeof BLANK) {
    return {
      dealId: form.dealId || null,
      purchasePrice:        Number(form.purchasePrice)        || 0,
      seniorDebtAmount:     Number(form.seniorDebtAmount)     || 0,
      sellerNoteAmount:     Number(form.sellerNoteAmount)     || 0,
      operatorEquity:       Number(form.operatorEquity)       || 0,
      investorEquity:       Number(form.investorEquity)       || 0,
      debtInterestRate:     Number(form.debtInterestRate)     || 0,
      debtTermMonths:       Number(form.debtTermMonths)       || 0,
      sellerNoteRate:       Number(form.sellerNoteRate)       || 0,
      sellerNoteTermMonths: Number(form.sellerNoteTermMonths) || 0,
    };
  }

  async function handleCreate(form: typeof BLANK) {
    await capitalRaisingApi.createStack(toPayload(form));
    setShowAdd(false);
    load();
  }

  async function handleUpdate(form: typeof BLANK) {
    if (!editing) return;
    await capitalRaisingApi.updateStack(editing.id, toPayload(form));
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this capital stack?')) return;
    await capitalRaisingApi.deleteStack(id);
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Capital Stack Builder</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Model acquisition financing structures</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Stack
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : stacks.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No capital stacks yet. Build your first financing structure.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {stacks.map((s) => (
            <StackCard
              key={s.id}
              stack={s}
              onEdit={() => setEditing(s)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Capital Stack">
        <StackForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />
      </Modal>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Capital Stack">
          <StackForm
            initial={{
              dealId:               editing.dealId || '',
              purchasePrice:        String(editing.purchasePrice),
              seniorDebtAmount:     String(editing.seniorDebtAmount),
              sellerNoteAmount:     String(editing.sellerNoteAmount),
              operatorEquity:       String(editing.operatorEquity),
              investorEquity:       String(editing.investorEquity),
              debtInterestRate:     String(editing.debtInterestRate),
              debtTermMonths:       String(editing.debtTermMonths),
              sellerNoteRate:       String(editing.sellerNoteRate),
              sellerNoteTermMonths: String(editing.sellerNoteTermMonths),
            }}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
