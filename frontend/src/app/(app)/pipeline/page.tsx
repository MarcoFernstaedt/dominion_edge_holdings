'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatCurrency, STAGE_ORDER, STAGE_LABELS, daysSince, formatRelativeDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Plus, AlertTriangle, ArrowRight } from 'lucide-react';
import type { Deal, DealStage } from '@/lib/types';
import Link from 'next/link';

const STAGE_COLORS: Record<string, string> = {
  identified: '#A7A29A',
  contacted: '#4D7EA8',
  discovery: '#4D7EA8',
  financial_review: '#D9A441',
  loi_discussion: '#D4AF37',
  loi_signed: '#D4AF37',
  due_diligence: '#D9A441',
  financing: '#D9A441',
  closing: '#3FA66B',
  closed: '#3FA66B',
  lost: '#C35B5B',
};

function AddDealModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addDeal = useAppStore((s) => s.addDeal);
  const companies = useAppStore((s) => s.companies);

  const [form, setForm] = useState({
    companyId: '',
    companyName: '',
    name: '',
    stage: 'identified' as DealStage,
    estimatedRevenue: '',
    estimatedSDE: '',
    askingPrice: '',
    source: '',
    dealThesis: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleCompanyChange(id: string) {
    const company = companies.find((c) => c.id === id);
    setForm((p) => ({
      ...p,
      companyId: id,
      companyName: company?.name ?? '',
      name: company ? `${company.name} Acquisition` : p.name,
      estimatedRevenue: company?.estimatedRevenueLow ? String(company.estimatedRevenueLow) : p.estimatedRevenue,
      estimatedSDE: company?.estimatedSDELow ? String(company.estimatedSDELow) : p.estimatedSDE,
    }));
  }

  function handleSubmit() {
    const e: Record<string, string> = {};
    if (!form.companyName.trim()) e.companyName = 'Company name required';
    if (!form.name.trim()) e.name = 'Deal name required';
    if (Object.keys(e).length) { setErrors(e); return; }

    addDeal({
      id: generateId(),
      companyId: form.companyId || undefined,
      companyName: form.companyName.trim(),
      name: form.name.trim(),
      dealType: 'platform',
      stage: form.stage,
      source: form.source || undefined,
      estimatedRevenue: form.estimatedRevenue ? Number(form.estimatedRevenue) : undefined,
      estimatedSDE: form.estimatedSDE ? Number(form.estimatedSDE) : undefined,
      askingPrice: form.askingPrice ? Number(form.askingPrice) : undefined,
      dealThesis: form.dealThesis || undefined,
      status: 'active',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
    setForm({ companyId: '', companyName: '', name: '', stage: 'identified', estimatedRevenue: '', estimatedSDE: '', askingPrice: '', source: '', dealThesis: '' });
    setErrors({});
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Create Deal" size="lg">
      <div className="space-y-4">
        <Select
          label="Link to Company (optional)"
          value={form.companyId}
          onChange={(e) => handleCompanyChange(e.target.value)}
          options={[{ value: '', label: '— New company —' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company Name *" value={form.companyName} onChange={f('companyName')} error={errors.companyName} placeholder="Acme Pest Control" />
          <Input label="Deal Name *" value={form.name} onChange={f('name')} error={errors.name} placeholder="Acme Acquisition" />
        </div>
        <Select
          label="Stage"
          value={form.stage}
          onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value as DealStage }))}
          options={STAGE_ORDER.filter((s) => s !== 'closed' && s !== 'lost').map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Est. Revenue ($)" value={form.estimatedRevenue} onChange={f('estimatedRevenue')} type="number" placeholder="2000000" />
          <Input label="Est. SDE ($)" value={form.estimatedSDE} onChange={f('estimatedSDE')} type="number" placeholder="350000" />
          <Input label="Asking Price ($)" value={form.askingPrice} onChange={f('askingPrice')} type="number" placeholder="1750000" />
        </div>
        <Input label="Source" value={form.source} onChange={f('source')} placeholder="Off-market, broker intro..." />
        <Textarea label="Deal Thesis" value={form.dealThesis} onChange={f('dealThesis')} placeholder="Why this deal? What makes it attractive?" rows={2} />
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSubmit}>Create Deal</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const updateDeal = useAppStore((s) => s.updateDeal);
  const stageIdx = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number]);
  const daysSinceUpdate = daysSince(deal.updatedAt);
  const isStalled = daysSinceUpdate > 7 && deal.status === 'active';

  function moveStage(dir: 1 | -1) {
    const newIdx = stageIdx + dir;
    if (newIdx < 0 || newIdx >= STAGE_ORDER.length) return;
    updateDeal(deal.id, {
      stage: STAGE_ORDER[newIdx] as DealStage,
      lastStageChangedAt: nowIso(),
      status: STAGE_ORDER[newIdx] === 'closed' ? 'closed' : STAGE_ORDER[newIdx] === 'lost' ? 'lost' : 'active',
    });
  }

  return (
    <article className={cn(
      'bg-[#141414] border rounded-md p-4 space-y-2.5 hover:border-[#3A3A3E] transition-colors',
      isStalled ? 'border-[#D9A44150]' : 'border-[#2A2A2E]'
    )} aria-label={`Deal: ${deal.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Link href={`/pipeline/${deal.id}`} className="text-sm font-semibold text-[#E8E6E3] hover:text-[#D4AF37] transition-colors truncate block">
            {deal.companyName}
          </Link>
          <div className="text-xs text-[#A7A29A] truncate">{deal.name}</div>
        </div>
        {isStalled && (
          <AlertTriangle size={13} className="text-[#D9A441] flex-shrink-0 mt-0.5" aria-label="Stalled deal" />
        )}
      </div>

      {(deal.estimatedSDE || deal.askingPrice) && (
        <div className="text-xs text-[#D4AF37]">
          {deal.estimatedSDE && `SDE: ${formatCurrency(deal.estimatedSDE)}`}
          {deal.estimatedSDE && deal.askingPrice && ' · '}
          {deal.askingPrice && `Ask: ${formatCurrency(deal.askingPrice)}`}
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-[#A7A29A]">{formatRelativeDate(deal.updatedAt)}</span>
        {isStalled && <Badge variant="warning" size="sm">Stalled {daysSinceUpdate}d</Badge>}
      </div>

      {/* Stage navigation */}
      <div className="flex items-center gap-1 pt-1">
        <button
          onClick={() => moveStage(-1)}
          disabled={stageIdx <= 0}
          className="text-xs px-2 py-1 rounded bg-[#1B1B1D] border border-[#2A2A2E] text-[#A7A29A] hover:text-[#E8E6E3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label={`Move to previous stage: ${STAGE_LABELS[STAGE_ORDER[stageIdx - 1]] ?? 'N/A'}`}
        >
          ←
        </button>
        <button
          onClick={() => moveStage(1)}
          disabled={stageIdx >= STAGE_ORDER.length - 1}
          className="text-xs px-2 py-1 rounded bg-[#1B1B1D] border border-[#2A2A2E] text-[#A7A29A] hover:text-[#E8E6E3] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-1"
          aria-label={`Advance to: ${STAGE_LABELS[STAGE_ORDER[stageIdx + 1]] ?? 'N/A'}`}
        >
          Advance → {STAGE_LABELS[STAGE_ORDER[stageIdx + 1]] ?? '—'}
        </button>
      </div>
    </article>
  );
}

function KanbanColumn({ stage, deals }: { stage: typeof STAGE_ORDER[number]; deals: Deal[] }) {
  const color = STAGE_COLORS[stage] ?? '#A7A29A';
  return (
    <div className="flex-shrink-0 w-64" role="group" aria-label={`${STAGE_LABELS[stage]} column, ${deals.length} deals`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-2 h-2 rounded-full" style={{ background: color }} aria-hidden />
        <h3 className="text-xs font-semibold text-[#E8E6E3]">{STAGE_LABELS[stage]}</h3>
        <span className="ml-auto text-xs text-[#A7A29A] bg-[#1B1B1D] px-1.5 py-0.5 rounded" aria-label={`${deals.length} deals`}>
          {deals.length}
        </span>
      </div>
      <div className="space-y-2.5">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        {deals.length === 0 && (
          <div className="bg-[#0D0D0D] border border-dashed border-[#2A2A2E] rounded-md p-4 text-xs text-[#A7A29A] text-center">
            No deals
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const deals = useAppStore((s) => s.deals);
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  const activeStages = STAGE_ORDER.filter((s) => s !== 'lost');
  const dealsByStage = activeStages.reduce<Record<string, Deal[]>>((acc, stage) => {
    acc[stage] = deals.filter((d) => d.stage === stage);
    return acc;
  }, {});

  const totalActive = deals.filter((d) => d.status === 'active').length;
  const totalValue = deals.reduce((sum, d) => sum + (d.estimatedSDE ?? 0), 0);

  return (
    <div className="px-6 py-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Pipeline</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            {totalActive} active deal{totalActive !== 1 ? 's' : ''}
            {totalValue > 0 && ` · ${formatCurrency(totalValue)} total SDE`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-[#2A2A2E] rounded overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                view === 'kanban' ? 'bg-[#D4AF37] text-black font-semibold' : 'text-[#A7A29A] hover:text-[#E8E6E3]'
              )}
              aria-pressed={view === 'kanban'}
            >
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                view === 'list' ? 'bg-[#D4AF37] text-black font-semibold' : 'text-[#A7A29A] hover:text-[#E8E6E3]'
              )}
              aria-pressed={view === 'list'}
            >
              List
            </button>
          </div>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} aria-hidden />
            Add Deal
          </Button>
        </div>
      </header>

      {deals.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-12 text-center">
          <p className="text-sm text-[#A7A29A] mb-3">No deals yet. Create your first acquisition target.</p>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} aria-hidden />
            Create First Deal
          </Button>
        </div>
      ) : view === 'kanban' ? (
        <div
          className="flex gap-4 overflow-x-auto pb-4"
          role="region"
          aria-label="Acquisition pipeline kanban board"
        >
          {activeStages.map((stage) => (
            <KanbanColumn key={stage} stage={stage} deals={dealsByStage[stage]} />
          ))}
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
          <table className="w-full" aria-label="All deals">
            <thead>
              <tr className="border-b border-[#2A2A2E]">
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Company</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Stage</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden md:table-cell">SDE Est.</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden lg:table-cell">Last Activity</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const isStalled = daysSince(deal.updatedAt) > 7 && deal.status === 'active';
                return (
                  <tr key={deal.id} className="border-b border-[#2A2A2E] last:border-0 hover:bg-[#1B1B1D]">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#E8E6E3]">{deal.companyName}</div>
                      <div className="text-xs text-[#A7A29A]">{deal.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: STAGE_COLORS[deal.stage] ?? '#A7A29A' }} aria-hidden />
                        <span className="text-sm text-[#E8E6E3]">{STAGE_LABELS[deal.stage]}</span>
                        {isStalled && <AlertTriangle size={12} className="text-[#D9A441]" aria-label="Stalled" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-[#D4AF37]">
                      {deal.estimatedSDE ? formatCurrency(deal.estimatedSDE) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-[#A7A29A]">
                      {formatRelativeDate(deal.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/pipeline/${deal.id}`} className="text-xs text-[#D4AF37] hover:underline">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddDealModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
