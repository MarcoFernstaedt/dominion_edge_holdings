'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useScrollTarget } from '@/hooks/useScrollTarget';
import { cn, generateId, nowIso, formatDate, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Plus, Briefcase, Users, PieChart, ArrowRight, AlertCircle, AlertTriangle, RefreshCw, Network } from 'lucide-react';
import type { BoardCandidate, CandidateStatus, CapTableEntry, StakeholderType } from '@/lib/types';
import { boardIntelApi } from '@/lib/api';
import { useFormField } from '@/hooks/useFormField';
import { CANDIDATE_STATUS_OPTIONS } from '@/lib/constants';

const CANDIDATE_STATUSES = [...CANDIDATE_STATUS_OPTIONS];

function AddCandidateModal({ open, onClose, seatId }: { open: boolean; onClose: () => void; seatId?: string }) {
  const boardSeats = useAppStore((s) => s.boardSeats);
  const addCandidate = useAppStore((s) => s.addCandidate);

  const [form, setForm] = useState({
    seatId: seatId ?? (boardSeats[0]?.id ?? ''),
    name: '',
    company: '',
    email: '',
    phone: '',
    linkedin: '',
    source: '',
    status: 'identified' as CandidateStatus,
    notes: '',
    equityOffered: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name required';
    if (!form.seatId) e.seatId = 'Seat required';
    if (Object.keys(e).length) { setErrors(e); return; }

    const seat = boardSeats.find((s) => s.id === form.seatId);
    addCandidate({
      id: generateId(),
      seatId: form.seatId,
      seatName: seat?.roleName ?? '',
      name: form.name.trim(),
      company: form.company || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
      linkedin: form.linkedin || undefined,
      source: form.source || undefined,
      status: form.status,
      equityOffered: form.equityOffered ? Number(form.equityOffered) : undefined,
      notes: form.notes || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
    setForm({ seatId: seatId ?? boardSeats[0]?.id ?? '', name: '', company: '', email: '', phone: '', linkedin: '', source: '', status: 'identified', notes: '', equityOffered: '' });
    setErrors({});
  }

  const f = useFormField(setForm);

  return (
    <Modal open={open} onClose={onClose} title="Add Board Candidate" size="lg">
      <div className="space-y-4">
        <Select
          label="Board Seat *"
          value={form.seatId}
          onChange={(e) => setForm((p) => ({ ...p, seatId: e.target.value }))}
          options={boardSeats.map((s) => ({ value: s.id, label: s.roleName }))}
          error={errors.seatId}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full Name *" value={form.name} onChange={f('name')} error={errors.name} autoFocus />
          <Input label="Company / Affiliation" value={form.company} onChange={f('company')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" value={form.email} onChange={f('email')} type="email" />
          <Input label="Phone" value={form.phone} onChange={f('phone')} type="tel" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="LinkedIn URL" value={form.linkedin} onChange={f('linkedin')} />
          <Input label="Source" value={form.source} onChange={f('source')} placeholder="LinkedIn, ACG, referral..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Status" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CandidateStatus }))} options={CANDIDATE_STATUSES} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">Equity Offered (%)</label>
            <input
              type="number"
              step="0.25"
              value={form.equityOffered}
              onChange={f('equityOffered')}
              placeholder="1.0"
              className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#C9A227]"
            />
          </div>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={f('notes')} rows={2} placeholder="Background, intro notes, pitch delivered..." />
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSubmit}>Add Candidate</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function CapTableModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCapTableEntry = useAppStore((s) => s.addCapTableEntry);
  const deleteCapTableEntry = useAppStore((s) => s.deleteCapTableEntry);
  const capTable = useAppStore((s) => s.capTable);

  const [form, setForm] = useState({ name: '', stakeholderType: 'advisor' as StakeholderType, equityPercent: '', vestingType: '', notes: '' });

  const totalAllocated = capTable.reduce((sum, e) => sum + e.equityPercent, 0);

  function handleAdd() {
    if (!form.name.trim() || !form.equityPercent) return;
    addCapTableEntry({
      id: generateId(),
      name: form.name.trim(),
      stakeholderType: form.stakeholderType,
      equityPercent: Number(form.equityPercent),
      vestingType: form.vestingType || undefined,
      notes: form.notes || undefined,
      createdAt: nowIso(),
    });
    setForm({ name: '', stakeholderType: 'advisor', equityPercent: '', vestingType: '', notes: '' });
  }

  return (
    <Modal open={open} onClose={onClose} title="Cap Table" size="lg">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-[#A7A29A]">Total allocated</div>
            <div className={cn('text-2xl font-bold font-serif', totalAllocated > 100 ? 'text-[#C35B5B]' : 'text-[#C9A227]')}>
              {totalAllocated.toFixed(2)}%
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[#A7A29A]">Remaining</div>
            <div className="text-lg font-semibold text-[#3FA66B]">{Math.max(0, 100 - totalAllocated).toFixed(2)}%</div>
          </div>
        </div>

        {capTable.length > 0 && (
          <table className="w-full" aria-label="Cap table">
            <thead>
              <tr className="border-b border-[#2A2A2E]">
                <th className="text-left text-[9px] uppercase tracking-widest text-[#A7A29A] py-2">Name</th>
                <th className="text-left text-[9px] uppercase tracking-widest text-[#A7A29A] py-2">Type</th>
                <th className="text-right text-[9px] uppercase tracking-widest text-[#A7A29A] py-2">Equity %</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {capTable.map((e) => (
                <tr key={e.id} className="border-b border-[#2A2A2E]">
                  <td className="py-2 text-sm text-[#E8E6E3]">{e.name}</td>
                  <td className="py-2 text-xs text-[#A7A29A]">{statusLabel(e.stakeholderType)}</td>
                  <td className="py-2 text-right text-sm text-[#C9A227] font-semibold">{e.equityPercent.toFixed(2)}%</td>
                  <td className="py-2 text-right">
                    <button onClick={() => deleteCapTableEntry(e.id)} className="text-xs text-[#A7A29A] hover:text-[#C35B5B]" aria-label={`Remove ${e.name}`}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="border-t border-[#2A2A2E] pt-4">
          <div className="text-xs text-[#A7A29A] mb-3 font-medium tracking-widest uppercase">Add Entry</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Marco Fernstaedt" />
            <Select
              label="Type"
              value={form.stakeholderType}
              onChange={(e) => setForm((p) => ({ ...p, stakeholderType: e.target.value as StakeholderType }))}
              options={[
                { value: 'founder', label: 'Founder' },
                { value: 'advisor', label: 'Advisor' },
                { value: 'operator', label: 'Operator' },
                { value: 'future_pool', label: 'Future Pool' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium tracking-widest uppercase text-[#A7A29A]">Equity %</label>
              <input
                type="number"
                step="0.25"
                value={form.equityPercent}
                onChange={(e) => setForm((p) => ({ ...p, equityPercent: e.target.value }))}
                placeholder="1.0"
                className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#C9A227]"
              />
            </div>
            <Input label="Vesting" value={form.vestingType} onChange={(e) => setForm((p) => ({ ...p, vestingType: e.target.value }))} placeholder="4yr/1yr cliff" />
          </div>
          <Button variant="primary" size="sm" className="mt-3" onClick={handleAdd}>Add to Cap Table</Button>
        </div>
      </div>
    </Modal>
  );
}

interface SeatHealth {
  score: number;
  label: string;
  analyzed_seats: Array<{
    seat_type: string;
    health_state: string;
    risk_level: string;
    candidate_count: number;
    confirmed_count: number;
  }>;
  alerts: Array<{ severity: string; message: string }>;
  components: Record<string, number>;
}

function healthColor(state: string) {
  if (state === 'secured')    return 'text-green-400';
  if (state === 'active')     return 'text-blue-400';
  if (state === 'developing') return 'text-[#C9A227]';
  if (state === 'weak')       return 'text-orange-400';
  return 'text-red-400';
}

function healthDot(state: string) {
  if (state === 'secured')    return 'bg-green-500';
  if (state === 'active')     return 'bg-blue-500';
  if (state === 'developing') return 'bg-[#C9A227]';
  if (state === 'weak')       return 'bg-orange-500';
  return 'bg-red-500';
}

export default function BoardPage() {
  useScrollTarget();
  const boardSeats = useAppStore((s) => s.boardSeats);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const updateCandidate = useAppStore((s) => s.updateCandidate);
  const deleteCandidate = useAppStore((s) => s.deleteCandidate);
  const capTable = useAppStore((s) => s.capTable);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedSeatId, setSelectedSeatId] = useState<string | undefined>(undefined);
  const [showCapTable, setShowCapTable] = useState(false);
  const [expandedSeat, setExpandedSeat] = useState<string | null>(null);
  const [seatHealth, setSeatHealth] = useState<SeatHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const filledSeats = boardSeats.filter((s) => boardCandidates.some((c) => c.seatId === s.id && c.status === 'confirmed'));
  const totalEquity = capTable.reduce((sum, e) => sum + e.equityPercent, 0);
  const candidatesForSeat = (seatId: string) => boardCandidates.filter((c) => c.seatId === seatId);

  async function loadSeatHealth() {
    setHealthLoading(true);
    try {
      const data = await boardIntelApi.getSeatHealth();
      setSeatHealth(data as SeatHealth);
    } catch { /* silent — health panel is optional enrichment */ }
    finally { setHealthLoading(false); }
  }

  useEffect(() => { loadSeatHealth(); }, []);

  return (
    <div className="page-container space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Board</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            {filledSeats.length}/6 seats confirmed · {boardCandidates.length} total candidates
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setShowCapTable(true)}>
            <PieChart size={13} aria-hidden />
            Cap Table ({totalEquity.toFixed(1)}%)
          </Button>
          <Button variant="ghost" size="sm" onClick={loadSeatHealth} disabled={healthLoading} title="Refresh health scores">
            <RefreshCw size={12} aria-hidden />
          </Button>
          <Button variant="primary" onClick={() => { setSelectedSeatId(undefined); setShowAdd(true); }}>
            <Plus size={14} aria-hidden />
            Add Candidate
          </Button>
        </div>
      </header>

      {/* Board readiness health panel */}
      {seatHealth && (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2E]">
            <div className="flex items-center gap-2">
              <Network size={13} className="text-[#737373]" aria-hidden />
              <span className="text-xs font-medium text-[#E8E6E3]">Board Readiness Score</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn('text-lg font-bold tabular-nums',
                seatHealth.score >= 70 ? 'text-green-400' : seatHealth.score >= 50 ? 'text-[#C9A227]' : 'text-red-400'
              )}>{seatHealth.score}</span>
              <span className="text-xs text-[#737373] capitalize">{seatHealth.label}</span>
              <a href="/network" className="text-[10px] text-[#C9A227] hover:underline">Full intel →</a>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 divide-x divide-[#1A1A1A] divide-y sm:divide-y-0">
            {seatHealth.analyzed_seats.map((seat) => (
              <div key={seat.seat_type} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', healthDot(seat.health_state))} aria-hidden />
                  <span className="text-[11px] text-[#A7A29A] capitalize truncate">{seat.seat_type.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs font-medium capitalize', healthColor(seat.health_state))}>{seat.health_state}</span>
                  {seat.risk_level === 'critical' && (
                    <AlertCircle size={10} className="text-red-400" aria-label="Critical risk" />
                  )}
                  {seat.risk_level === 'high' && seat.health_state !== 'secured' && (
                    <AlertTriangle size={10} className="text-[#C9A227]" aria-label="High risk" />
                  )}
                </div>
              </div>
            ))}
          </div>
          {seatHealth.alerts.length > 0 && (
            <div className="border-t border-[#2A2A2E] px-4 py-2">
              {seatHealth.alerts.slice(0, 2).map((alert, i) => (
                <div key={i} className={cn('flex items-start gap-2 text-[11px] py-0.5', alert.severity === 'critical' ? 'text-red-400' : 'text-[#C9A227]')}>
                  {alert.severity === 'critical' ? <AlertCircle size={10} className="flex-shrink-0 mt-0.5" aria-hidden /> : <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" aria-hidden />}
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Seat overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" role="list" aria-label="Board seats">
        {boardSeats.map((seat) => {
          const confirmed = boardCandidates.find((c) => c.seatId === seat.id && c.status === 'confirmed');
          const candidates = candidatesForSeat(seat.id);
          const isExpanded = expandedSeat === seat.id;

          return (
            <div key={seat.id} role="listitem" className="space-y-2">
              <button
                onClick={() => setExpandedSeat(isExpanded ? null : seat.id)}
                className={cn(
                  'w-full bg-[#141414] border rounded-md p-4 text-left transition-colors hover:border-[#3A3A3E]',
                  confirmed ? 'border-[#3FA66B40]' : 'border-[#2A2A2E]'
                )}
                aria-expanded={isExpanded}
              >
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: confirmed ? '#3FA66B' : seat.color }}
                    aria-hidden
                  />
                  {confirmed
                    ? <Badge variant="success" size="sm">Confirmed</Badge>
                    : <Badge variant="muted" size="sm">Open</Badge>
                  }
                </div>
                <div className="text-sm font-semibold text-[#E8E6E3] mb-1">{seat.roleName}</div>
                <div className="text-xs text-[#A7A29A]">
                  {seat.equityRangeLow}–{seat.equityRangeHigh}% equity
                </div>
                {confirmed && (
                  <div className="text-xs text-[#3FA66B] mt-1">✓ {confirmed.name}</div>
                )}
                {!confirmed && candidates.length > 0 && (
                  <div className="text-xs text-[#A7A29A] mt-1">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</div>
                )}
              </button>

              {/* Expanded seat detail */}
              {isExpanded && (
                <div className="bg-[#0D0D0D] border border-[#2A2A2E] rounded-md p-4 space-y-3">
                  <div className="text-xs text-[#A7A29A]">{seat.description}</div>
                  <div>
                    <div className="text-[9px] tracking-widest uppercase text-[#C9A227] mb-1">Where to find</div>
                    <div className="text-xs text-[#E8E6E3]">{seat.whereTo}</div>
                  </div>
                  <div>
                    <div className="text-[9px] tracking-widest uppercase text-[#C9A227] mb-1">Pitch script</div>
                    <div className="text-xs text-[#E8E6E3] italic">&ldquo;{seat.pitch}&rdquo;</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSelectedSeatId(seat.id); setShowAdd(true); }}
                  >
                    <Plus size={12} aria-hidden />
                    Add Candidate for this Seat
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* All candidates */}
      <section aria-labelledby="candidates-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="candidates-heading" className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A]">
            All Candidates ({boardCandidates.length})
          </h2>
        </div>

        {boardCandidates.length === 0 ? (
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-8 text-center">
            <Users size={28} className="mx-auto text-[#A7A29A] mb-2" aria-hidden />
            <p className="text-sm text-[#A7A29A]">No candidates yet. Add your first board candidate above.</p>
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
            <table className="w-full" aria-label="Board candidates">
              <thead>
                <tr className="border-b border-[#2A2A2E]">
                  <th className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Candidate</th>
                  <th className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden sm:table-cell">Seat</th>
                  <th className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Status</th>
                  <th className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden md:table-cell">Equity</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {boardCandidates.map((candidate) => (
                  <tr key={candidate.id} className="border-b border-[#2A2A2E] last:border-0 hover:bg-[#1B1B1D]">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#E8E6E3]">{candidate.name}</div>
                      {candidate.company && <div className="text-xs text-[#A7A29A]">{candidate.company}</div>}
                      {candidate.email && <div className="text-xs text-[#A7A29A]">{candidate.email}</div>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-sm text-[#A7A29A]">
                      {candidate.seatName}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={candidate.status}
                        onChange={(e) => updateCandidate(candidate.id, { status: e.target.value as CandidateStatus })}
                        className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-xs text-[#E8E6E3] px-2 py-1 focus:outline-none focus:border-[#C9A227]"
                        aria-label={`Status for ${candidate.name}`}
                      >
                        {CANDIDATE_STATUSES.map((s) => (
                          <option key={s.value} value={s.value} className="bg-[#1B1B1D]">{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-[#C9A227]">
                      {candidate.equityOffered ? `${candidate.equityOffered}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => deleteCandidate(candidate.id)}
                        className="text-xs text-[#A7A29A] hover:text-[#C35B5B] transition-colors"
                        aria-label={`Remove ${candidate.name}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AddCandidateModal open={showAdd} onClose={() => setShowAdd(false)} seatId={selectedSeatId} />
      <CapTableModal open={showCapTable} onClose={() => setShowCapTable(false)} />
    </div>
  );
}
