'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatDate, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Plus, Briefcase, Users, PieChart, ArrowRight } from 'lucide-react';
import type { BoardCandidate, CandidateStatus, CapTableEntry, StakeholderType } from '@/lib/types';

const CANDIDATE_STATUSES: { value: CandidateStatus; label: string }[] = [
  { value: 'identified', label: 'Identified' },
  { value: 'researched', label: 'Researched' },
  { value: 'outreach_sent', label: 'Outreach Sent' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'interested', label: 'Interested' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'passed', label: 'Passed' },
];

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

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

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
              className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
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
            <div className={cn('text-2xl font-bold font-serif', totalAllocated > 100 ? 'text-[#C35B5B]' : 'text-[#D4AF37]')}>
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
                  <td className="py-2 text-right text-sm text-[#D4AF37] font-semibold">{e.equityPercent.toFixed(2)}%</td>
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
                className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
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

export default function BoardPage() {
  const boardSeats = useAppStore((s) => s.boardSeats);
  const boardCandidates = useAppStore((s) => s.boardCandidates);
  const updateCandidate = useAppStore((s) => s.updateCandidate);
  const deleteCandidate = useAppStore((s) => s.deleteCandidate);
  const capTable = useAppStore((s) => s.capTable);

  const [showAdd, setShowAdd] = useState(false);
  const [selectedSeatId, setSelectedSeatId] = useState<string | undefined>(undefined);
  const [showCapTable, setShowCapTable] = useState(false);
  const [expandedSeat, setExpandedSeat] = useState<string | null>(null);

  const filledSeats = boardSeats.filter((s) => boardCandidates.some((c) => c.seatId === s.id && c.status === 'confirmed'));
  const totalEquity = capTable.reduce((sum, e) => sum + e.equityPercent, 0);

  const candidatesForSeat = (seatId: string) => boardCandidates.filter((c) => c.seatId === seatId);

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
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
          <Button variant="primary" onClick={() => { setSelectedSeatId(undefined); setShowAdd(true); }}>
            <Plus size={14} aria-hidden />
            Add Candidate
          </Button>
        </div>
      </header>

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
                    <div className="text-[9px] tracking-widest uppercase text-[#D4AF37] mb-1">Where to find</div>
                    <div className="text-xs text-[#E8E6E3]">{seat.whereTo}</div>
                  </div>
                  <div>
                    <div className="text-[9px] tracking-widest uppercase text-[#D4AF37] mb-1">Pitch script</div>
                    <div className="text-xs text-[#E8E6E3] italic">"{seat.pitch}"</div>
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
                        className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-xs text-[#E8E6E3] px-2 py-1 focus:outline-none focus:border-[#D4AF37]"
                        aria-label={`Status for ${candidate.name}`}
                      >
                        {CANDIDATE_STATUSES.map((s) => (
                          <option key={s.value} value={s.value} className="bg-[#1B1B1D]">{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm text-[#D4AF37]">
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
