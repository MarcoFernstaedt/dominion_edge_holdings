'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/lib/store';

const DiligenceTab = dynamic(() => import('./DiligenceTab'), { ssr: false });
import { formatDate, formatRelativeDate, formatCurrency, STAGE_LABELS, STAGE_ORDER, nowIso, generateId, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ArrowLeft, KanbanSquare, Plus, Calculator } from 'lucide-react';
import Link from 'next/link';
import type { DealStage } from '@/lib/types';

export default function DealDetailPage({ params }: { params: { dealId: string } }) {
  const deals = useAppStore((s) => s.deals);
  const updateDeal = useAppStore((s) => s.updateDeal);
  const interactions = useAppStore((s) => s.interactions);
  const addInteraction = useAppStore((s) => s.addInteraction);
  const underwritingScenarios = useAppStore((s) => s.underwritingScenarios);

  const deal = deals.find((d) => d.id === params.dealId);
  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({ subject: '', notes: '', outcome: '' });
  const [rightTab, setRightTab] = useState<'activity' | 'diligence'>('activity');

  if (!deal) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6 text-center">
        <KanbanSquare size={40} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
        <p className="text-sm text-[#A7A29A]">Deal not found.</p>
        <Link href="/pipeline" className="text-[#C9A227] hover:underline text-sm mt-2 inline-block">← Pipeline</Link>
      </div>
    );
  }

  const dealInteractions = interactions.filter((i) => i.entityId === deal.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const dealScenarios = underwritingScenarios.filter((s) => s.dealId === deal.id);
  const stageIdx = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number]);

  function handleStageChange(stage: string) {
    updateDeal(deal!.id, {
      stage: stage as DealStage,
      lastStageChangedAt: nowIso(),
      status: stage === 'closed' ? 'closed' : stage === 'lost' ? 'lost' : 'active',
    });
  }

  function handleLogNote() {
    if (!logForm.notes.trim()) return;
    addInteraction({
      id: generateId(),
      entityType: 'deal',
      entityId: deal!.id,
      interactionType: 'note',
      direction: 'outbound',
      subject: logForm.subject || undefined,
      bodyPreview: logForm.notes,
      outcome: logForm.outcome || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    updateDeal(deal!.id, { updatedAt: nowIso() });
    setLogOpen(false);
    setLogForm({ subject: '', notes: '', outcome: '' });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <Link href="/pipeline" className="inline-flex items-center gap-1.5 text-sm text-[#A7A29A] hover:text-[#E8E6E3] transition-colors">
        <ArrowLeft size={14} aria-hidden />
        Pipeline
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">{deal.companyName}</h1>
          <div className="text-sm text-[#A7A29A] mt-0.5">{deal.name}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setLogOpen(true)}>
            <Plus size={13} aria-hidden />
            Log Note
          </Button>
          <Link href={`/underwriting?dealId=${deal.id}`}>
            <Button variant="outline" size="sm">
              <Calculator size={13} aria-hidden />
              Underwriting
            </Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-4">Stage</h2>
            <select
              value={deal.stage}
              onChange={(e) => handleStageChange(e.target.value)}
              className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#C9A227] mb-3"
              aria-label="Change deal stage"
            >
              {STAGE_ORDER.map((s) => (
                <option key={s} value={s} className="bg-[#1B1B1D]">{STAGE_LABELS[s]}</option>
              ))}
            </select>
            {/* Stage progress */}
            <div className="space-y-1">
              {STAGE_ORDER.filter(s => s !== 'lost').map((s, i) => {
                const current = STAGE_ORDER.indexOf(deal.stage as typeof STAGE_ORDER[number]);
                const isPast = i < current;
                const isCurrent = i === current;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCurrent ? 'bg-[#C9A227]' : isPast ? 'bg-[#3FA66B]' : 'bg-[#2A2A2E]'}`} aria-hidden />
                    <span className={`text-xs ${isCurrent ? 'text-[#C9A227] font-semibold' : isPast ? 'text-[#3FA66B]' : 'text-[#A7A29A]'}`}>
                      {STAGE_LABELS[s]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Deal Info</h2>
            <dl className="space-y-2.5">
              <div>
                <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Status</dt>
                <dd className="mt-0.5"><StatusBadge status={deal.status} /></dd>
              </div>
              {deal.estimatedRevenue && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Revenue Est.</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{formatCurrency(deal.estimatedRevenue)}</dd>
                </div>
              )}
              {deal.estimatedSDE && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">SDE Est.</dt>
                  <dd className="text-sm text-[#C9A227] mt-0.5">{formatCurrency(deal.estimatedSDE)}</dd>
                </div>
              )}
              {deal.askingPrice && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Asking Price</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{formatCurrency(deal.askingPrice)}</dd>
                </div>
              )}
              {deal.estimatedSDE && deal.askingPrice && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Multiple</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{(deal.askingPrice / deal.estimatedSDE).toFixed(1)}x SDE</dd>
                </div>
              )}
              {deal.source && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Source</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{deal.source}</dd>
                </div>
              )}
              {deal.lastStageChangedAt && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Stage Changed</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{formatRelativeDate(deal.lastStageChangedAt)}</dd>
                </div>
              )}
            </dl>
          </div>

          {deal.dealThesis && (
            <div className="bg-[#141414] border border-[#C9A22720] rounded-md p-4">
              <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#C9A227] mb-2">Deal Thesis</h2>
              <p className="text-sm text-[#E8E6E3]">{deal.dealThesis}</p>
            </div>
          )}

          {dealScenarios.length > 0 && (
            <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
              <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-2">Underwriting</h2>
              {dealScenarios.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-[#E8E6E3]">{s.scenarioName}</span>
                  <Badge variant={s.dscr >= 1.25 ? 'success' : 'danger'} size="sm">DSCR {s.dscr.toFixed(2)}x</Badge>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs text-[#A7A29A]">Created {formatDate(deal.createdAt)}</div>
        </div>

        {/* Right: Activity / Diligence tabs */}
        <div className="lg:col-span-2">
          {/* Tab strip */}
          <div className="flex gap-1 border-b border-[#2A2A2E] mb-4">
            <button
              onClick={() => setRightTab('activity')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                rightTab === 'activity'
                  ? 'border-b-2 border-[#C9A227] text-[#C9A227] -mb-px'
                  : 'text-[#A7A29A] hover:text-[#E8E6E3]'
              }`}
            >
              Activity ({dealInteractions.length})
            </button>
            <button
              onClick={() => setRightTab('diligence')}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                rightTab === 'diligence'
                  ? 'border-b-2 border-[#C9A227] text-[#C9A227] -mb-px'
                  : 'text-[#A7A29A] hover:text-[#E8E6E3]'
              }`}
            >
              Diligence
            </button>
          </div>

          {rightTab === 'activity' && (
            <>
              {dealInteractions.length === 0 ? (
                <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-8 text-center">
                  <p className="text-sm text-[#A7A29A]">No notes yet. Log your first deal note.</p>
                </div>
              ) : (
                <ol className="relative border-l border-[#2A2A2E] ml-3">
                  {dealInteractions.map((i) => (
                    <li key={i.id} className="mb-3 ml-4">
                      <div className="absolute -left-2 w-3 h-3 rounded-full bg-[#141414] border-2 border-[#2A2A2E]" aria-hidden />
                      <div className="bg-[#141414] border border-[#2A2A2E] rounded p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="muted" size="sm">{statusLabel(i.interactionType)}</Badge>
                          <span className="text-xs text-[#A7A29A]">{formatRelativeDate(i.createdAt)}</span>
                        </div>
                        {i.subject && <div className="text-sm font-medium text-[#E8E6E3]">{i.subject}</div>}
                        {i.bodyPreview && <p className="text-xs text-[#A7A29A] mt-0.5">{i.bodyPreview}</p>}
                        {i.outcome && <div className="text-xs mt-1 text-[#E8E6E3]">Outcome: {i.outcome}</div>}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          {rightTab === 'diligence' && (
            <DiligenceTab dealId={deal.id} />
          )}
        </div>
      </div>

      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Deal Note">
        <div className="space-y-4">
          <Input label="Subject" value={logForm.subject} onChange={(e) => setLogForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Call outcome, meeting notes..." autoFocus />
          <Textarea label="Notes *" value={logForm.notes} onChange={(e) => setLogForm((p) => ({ ...p, notes: e.target.value }))} rows={4} placeholder="What happened? Key takeaways..." />
          <Input label="Outcome" value={logForm.outcome} onChange={(e) => setLogForm((p) => ({ ...p, outcome: e.target.value }))} placeholder="Next steps..." />
          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={handleLogNote}>Save Note</Button>
            <Button variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
