'use client';

import { useState, useEffect, useCallback } from 'react';
import { capitalRaisingApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Plus, FileText, Wand2 } from 'lucide-react';
import type { InvestorMemo } from '@/lib/types';

function fmt(n: number) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const BLANK = {
  dealId: '',
  title: '',
  companyName: '',
  purchasePrice: '',
  revenue: '',
  ebitda: '',
  dealStructure: '',
  operatorBackground: '',
  summary: '',
  expectedReturns: '',
  riskFactors: '',
};

function MemoForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<typeof BLANK>;
  onSave: (data: typeof BLANK, useAI: boolean) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [generating, setGenerating] = useState(false);
  const set = (k: keyof typeof BLANK, v: string) => setForm((p) => ({ ...p, [k]: v }));

  async function generateNarrative() {
    setGenerating(true);
    try {
      const res = await capitalRaisingApi.generateMemo({
        companyName:        form.companyName,
        purchasePrice:      Number(form.purchasePrice) || 0,
        revenue:            Number(form.revenue) || 0,
        ebitda:             Number(form.ebitda) || 0,
        dealStructure:      form.dealStructure,
        operatorBackground: form.operatorBackground,
        useAI: true,
      }) as Partial<typeof BLANK>;
      setForm((p) => ({
        ...p,
        title:              res.title              || p.title,
        summary:            res.summary            || p.summary,
        dealStructure:      res.dealStructure      || p.dealStructure,
        expectedReturns:    res.expectedReturns    || p.expectedReturns,
        riskFactors:        res.riskFactors        || p.riskFactors,
      }));
    } catch { /* silent */ }
    finally { setGenerating(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Company Name" value={form.companyName} onChange={(e) => set('companyName', e.target.value)} />
        <Input label="Memo Title" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Deal Memo — Acme HVAC" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Input label="Purchase Price ($)" type="number" value={form.purchasePrice} onChange={(e) => set('purchasePrice', e.target.value)} />
        <Input label="Revenue (TTM) ($)" type="number" value={form.revenue} onChange={(e) => set('revenue', e.target.value)} />
        <Input label="EBITDA (TTM) ($)" type="number" value={form.ebitda} onChange={(e) => set('ebitda', e.target.value)} />
      </div>
      <Textarea label="Deal Structure" value={form.dealStructure} onChange={(e) => set('dealStructure', e.target.value)} rows={2} placeholder="e.g. SBA 7(a) + seller note + operator equity" />
      <Textarea label="Operator Background" value={form.operatorBackground} onChange={(e) => set('operatorBackground', e.target.value)} rows={2} />

      <Button
        variant="ghost"
        onClick={generateNarrative}
        disabled={generating}
        className="flex items-center gap-2 text-[var(--color-accent)]"
      >
        <Wand2 className="w-4 h-4" />
        {generating ? 'Generating narrative…' : 'AI: Generate narrative sections'}
      </Button>

      <Textarea label="Executive Summary" value={form.summary} onChange={(e) => set('summary', e.target.value)} rows={3} />
      <Textarea label="Expected Returns" value={form.expectedReturns} onChange={(e) => set('expectedReturns', e.target.value)} rows={2} />
      <Textarea label="Risk Factors" value={form.riskFactors} onChange={(e) => set('riskFactors', e.target.value)} rows={2} />

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form, false)} disabled={!form.companyName.trim() && !form.title.trim()}>
          Save Memo
        </Button>
      </div>
    </div>
  );
}

function MemoCard({ memo, onEdit, onDelete }: { memo: InvestorMemo; onEdit: () => void; onDelete: () => void }) {
  const multiple = memo.ebitda > 0 ? (memo.purchasePrice / memo.ebitda).toFixed(1) : null;
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="font-medium text-[var(--color-text-primary)]">{memo.title || 'Untitled Memo'}</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400">Delete</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          ['Price',   fmt(memo.purchasePrice)],
          ['Revenue', fmt(memo.revenue)],
          ['EBITDA',  fmt(memo.ebitda)],
        ].map(([l, v]) => (
          <div key={l} className="bg-[var(--color-bg)] rounded-lg p-3 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{l}</p>
            <p className="font-semibold text-[var(--color-text-primary)]">{v}</p>
          </div>
        ))}
      </div>
      {multiple && (
        <p className="text-sm text-[var(--color-text-muted)] mb-3">{multiple}x EBITDA multiple</p>
      )}

      {memo.summary && (
        <div className="mb-3">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Summary</p>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-3">{memo.summary}</p>
        </div>
      )}
      {memo.dealStructure && (
        <div className="mb-2">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Deal Structure</p>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{memo.dealStructure}</p>
        </div>
      )}
    </div>
  );
}

export default function MemosPage() {
  const [memos, setMemos] = useState<InvestorMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<InvestorMemo | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capitalRaisingApi.listMemos();
      setMemos((res as { memos: InvestorMemo[] }).memos);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: typeof BLANK) {
    await capitalRaisingApi.createMemo({
      dealId:             form.dealId || null,
      title:              form.title || `Deal Memo — ${form.companyName}`,
      summary:            form.summary,
      purchasePrice:      Number(form.purchasePrice) || 0,
      revenue:            Number(form.revenue) || 0,
      ebitda:             Number(form.ebitda) || 0,
      dealStructure:      form.dealStructure,
      expectedReturns:    form.expectedReturns,
      riskFactors:        form.riskFactors,
      operatorBackground: form.operatorBackground,
    });
    setShowAdd(false);
    load();
  }

  async function handleUpdate(form: typeof BLANK) {
    if (!editing) return;
    await capitalRaisingApi.updateMemo(editing.id, {
      title:              form.title,
      summary:            form.summary,
      purchasePrice:      Number(form.purchasePrice) || 0,
      revenue:            Number(form.revenue) || 0,
      ebitda:             Number(form.ebitda) || 0,
      dealStructure:      form.dealStructure,
      expectedReturns:    form.expectedReturns,
      riskFactors:        form.riskFactors,
      operatorBackground: form.operatorBackground,
    });
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this memo?')) return;
    await capitalRaisingApi.deleteMemo(id);
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Investor Memos</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Generate structured deal summaries for investors</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Memo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : memos.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No memos yet. Create your first deal memo.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {memos.map((m) => (
            <MemoCard
              key={m.id}
              memo={m}
              onEdit={() => setEditing(m)}
              onDelete={() => handleDelete(m.id)}
            />
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Investor Memo">
        <MemoForm onSave={handleSave} onCancel={() => setShowAdd(false)} />
      </Modal>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Memo">
          <MemoForm
            initial={{
              title:              editing.title,
              purchasePrice:      String(editing.purchasePrice),
              revenue:            String(editing.revenue),
              ebitda:             String(editing.ebitda),
              dealStructure:      editing.dealStructure,
              operatorBackground: editing.operatorBackground,
              summary:            editing.summary,
              expectedReturns:    editing.expectedReturns,
              riskFactors:        editing.riskFactors,
            }}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
