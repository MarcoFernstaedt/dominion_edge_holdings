'use client';

import { useState, useEffect, useCallback } from 'react';
import { capitalRaisingApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Plus, Mail, Phone, MapPin, Send } from 'lucide-react';
import type { Investor, InvestorType, RelationshipStage } from '@/lib/types';

const INVESTOR_TYPE_LABELS: Record<InvestorType, string> = {
  angel:               'Angel',
  family_office:       'Family Office',
  private_equity:      'Private Equity',
  operator_investor:   'Operator Investor',
  private_lender:      'Private Lender',
  bank:                'Bank',
  search_fund_investor:'Search Fund Investor',
};

const STAGE_COLORS: Record<RelationshipStage, string> = {
  cold:           'bg-zinc-700 text-zinc-300',
  aware:          'bg-blue-900 text-blue-300',
  engaged:        'bg-amber-900 text-amber-300',
  relationship:   'bg-emerald-900 text-emerald-300',
  active_investor:'bg-violet-900 text-violet-300',
};

const STAGE_LABELS: Record<RelationshipStage, string> = {
  cold:           'Cold',
  aware:          'Aware',
  engaged:        'Engaged',
  relationship:   'Relationship',
  active_investor:'Active Investor',
};

const BLANK_FORM = {
  name: '',
  organization: '',
  investorType: 'angel' as InvestorType,
  email: '',
  phone: '',
  location: '',
  checkSizeMin: '',
  checkSizeMax: '',
  industriesPreferred: '',
  dealStagePreference: '',
  riskTolerance: 'moderate',
  priorDeals: '',
  relationshipStage: 'cold' as RelationshipStage,
  notes: '',
};

function InvestorForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<typeof BLANK_FORM>;
  onSave: (data: typeof BLANK_FORM) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK_FORM, ...initial });
  const set = (k: keyof typeof BLANK_FORM, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Name *" value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Organization" value={form.organization} onChange={(e) => set('organization', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Investor Type"
          value={form.investorType}
          onChange={(e) => set('investorType', e.target.value as InvestorType)}
        >
          {Object.entries(INVESTOR_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
        <Select
          label="Relationship Stage"
          value={form.relationshipStage}
          onChange={(e) => set('relationshipStage', e.target.value as RelationshipStage)}
        >
          {Object.entries(STAGE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
        <Input label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>
      <Input label="Location" value={form.location} onChange={(e) => set('location', e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Check Size Min ($)" type="number" value={form.checkSizeMin} onChange={(e) => set('checkSizeMin', e.target.value)} />
        <Input label="Check Size Max ($)" type="number" value={form.checkSizeMax} onChange={(e) => set('checkSizeMax', e.target.value)} />
      </div>
      <Input
        label="Preferred Industries (comma-separated)"
        value={form.industriesPreferred}
        onChange={(e) => set('industriesPreferred', e.target.value)}
        placeholder="e.g. HVAC, Landscaping, Manufacturing"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Deal Stage Preference" value={form.dealStagePreference} onChange={(e) => set('dealStagePreference', e.target.value)} />
        <Select label="Risk Tolerance" value={form.riskTolerance} onChange={(e) => set('riskTolerance', e.target.value)}>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="high">High</option>
        </Select>
      </div>
      <Textarea label="Prior Deals" value={form.priorDeals} onChange={(e) => set('priorDeals', e.target.value)} rows={2} />
      <Textarea label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.name.trim()}>Save Investor</Button>
      </div>
    </div>
  );
}

function OutreachModal({
  investor,
  onClose,
}: {
  investor: Investor;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'introduction' | 'follow_up'>('introduction');
  const [dealSummary, setDealSummary] = useState({ companyName: '', purchasePrice: '' });
  const [result, setResult] = useState<{ subjectDraft: string; emailDraft: string; keyHighlights: string[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await capitalRaisingApi.generateOutreach({
        mode,
        investorId: investor.id,
        dealSummary: {
          companyName: dealSummary.companyName,
          purchasePrice: dealSummary.purchasePrice ? Number(dealSummary.purchasePrice) : undefined,
        },
        useAI: true,
      });
      setResult(res);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {(['introduction', 'follow_up'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${mode === m ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'}`}
          >
            {m === 'introduction' ? 'Introduction' : 'Follow-up'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Company Name" value={dealSummary.companyName} onChange={(e) => setDealSummary((p) => ({ ...p, companyName: e.target.value }))} />
        <Input label="Purchase Price ($)" type="number" value={dealSummary.purchasePrice} onChange={(e) => setDealSummary((p) => ({ ...p, purchasePrice: e.target.value }))} />
      </div>
      <Button onClick={generate} disabled={loading} className="w-full">
        {loading ? 'Generating…' : 'Generate Draft'}
      </Button>
      {result && (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Subject</p>
            <p className="text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-2">
              {result.subjectDraft}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Email</p>
            <pre className="text-sm text-[var(--color-text-primary)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded p-3 whitespace-pre-wrap font-sans">
              {result.emailDraft}
            </pre>
          </div>
          {result.keyHighlights.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Key Highlights</p>
              <ul className="list-disc list-inside space-y-1">
                {result.keyHighlights.map((h, i) => (
                  <li key={i} className="text-sm text-[var(--color-text-secondary)]">{h}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [editing, setEditing]   = useState<Investor | null>(null);
  const [outreachTarget, setOutreachTarget] = useState<Investor | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capitalRaisingApi.listInvestors();
      setInvestors((res as { investors: Investor[] }).investors);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form: typeof BLANK_FORM) {
    const payload = {
      ...form,
      checkSizeMin: form.checkSizeMin ? Number(form.checkSizeMin) : null,
      checkSizeMax: form.checkSizeMax ? Number(form.checkSizeMax) : null,
      industriesPreferred: form.industriesPreferred
        ? form.industriesPreferred.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    await capitalRaisingApi.createInvestor(payload);
    setShowAdd(false);
    load();
  }

  async function handleUpdate(form: typeof BLANK_FORM) {
    if (!editing) return;
    const payload = {
      ...form,
      checkSizeMin: form.checkSizeMin ? Number(form.checkSizeMin) : null,
      checkSizeMax: form.checkSizeMax ? Number(form.checkSizeMax) : null,
      industriesPreferred: form.industriesPreferred
        ? form.industriesPreferred.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
    };
    await capitalRaisingApi.updateInvestor(editing.id, payload);
    setEditing(null);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this investor?')) return;
    await capitalRaisingApi.deleteInvestor(id);
    load();
  }

  async function handleMarkInterested(id: string) {
    await capitalRaisingApi.markInterested(id);
    load();
  }

  const filtered = investors.filter((inv) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      inv.name.toLowerCase().includes(q) ||
      inv.organization.toLowerCase().includes(q) ||
      inv.location.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Investor CRM</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{investors.length} investor{investors.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Investor
        </Button>
      </div>

      <Input
        placeholder="Search by name, organization, or location…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading investors…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">No investors yet. Add your first investor to get started.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => (
            <div
              key={inv.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-[var(--color-text-primary)]">{inv.name}</h3>
                    {inv.organization && (
                      <span className="text-sm text-[var(--color-text-muted)]">· {inv.organization}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STAGE_COLORS[inv.relationshipStage]}`}>
                      {STAGE_LABELS[inv.relationshipStage]}
                    </span>
                    <Badge variant="default" size="sm">{INVESTOR_TYPE_LABELS[inv.investorType]}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-2 text-sm text-[var(--color-text-muted)]">
                    {inv.email && (
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{inv.email}</span>
                    )}
                    {inv.phone && (
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{inv.phone}</span>
                    )}
                    {inv.location && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{inv.location}</span>
                    )}
                    {(inv.checkSizeMin || inv.checkSizeMax) && (
                      <span>
                        Check: ${(inv.checkSizeMin ?? 0).toLocaleString()}–${(inv.checkSizeMax ?? 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {inv.industriesPreferred.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {inv.industriesPreferred.map((ind) => (
                        <span key={ind} className="text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-0.5 text-[var(--color-text-muted)]">
                          {ind}
                        </span>
                      ))}
                    </div>
                  )}
                  {inv.notes && (
                    <p className="text-sm text-[var(--color-text-muted)] mt-2 line-clamp-2">{inv.notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 items-end shrink-0">
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOutreachTarget(inv)}>
                      <Send className="w-3 h-3 mr-1" />Outreach
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(inv)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)} className="text-red-400 hover:text-red-300">Delete</Button>
                  </div>
                  {inv.relationshipStage === 'cold' || inv.relationshipStage === 'aware' ? (
                    <Button variant="ghost" size="sm" onClick={() => handleMarkInterested(inv.id)} className="text-emerald-400 hover:text-emerald-300">
                      Mark Interested
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Investor">
        <InvestorForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />
      </Modal>

      {/* Edit Modal */}
      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Investor">
          <InvestorForm
            initial={{
              ...editing,
              checkSizeMin: editing.checkSizeMin != null ? String(editing.checkSizeMin) : '',
              checkSizeMax: editing.checkSizeMax != null ? String(editing.checkSizeMax) : '',
              industriesPreferred: (editing.industriesPreferred || []).join(', '),
            }}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}

      {/* Outreach Modal */}
      {outreachTarget && (
        <Modal open={!!outreachTarget} onClose={() => setOutreachTarget(null)} title={`Outreach — ${outreachTarget.name}`}>
          <OutreachModal investor={outreachTarget} onClose={() => setOutreachTarget(null)} />
        </Modal>
      )}
    </div>
  );
}
