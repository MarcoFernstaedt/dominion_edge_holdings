'use client';

import { useState, useEffect, useCallback } from 'react';
import { capitalRaisingApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { Wand2, MessageSquare, Plus } from 'lucide-react';
import type { FirmMessaging } from '@/lib/types';

const BLANK_WIZARD = {
  targetIndustries: '',
  targetDealSize: '',
  whyThese: '',
  operationalImprovements: '',
  geographicFocus: '',
  valueCreationStrategy: '',
};

const BLANK_MESSAGING = {
  missionStatement: '',
  investmentThesis: '',
  targetIndustries: '',
  targetDealSize: '',
  geographicFocus: '',
  valueCreationStrategy: '',
};

function MessagingForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<typeof BLANK_MESSAGING>;
  onSave: (data: typeof BLANK_MESSAGING) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...BLANK_MESSAGING, ...initial });
  const [wizard, setWizard] = useState(BLANK_WIZARD);
  const [generating, setGenerating] = useState(false);

  const set = (k: keyof typeof BLANK_MESSAGING, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const setW = (k: keyof typeof BLANK_WIZARD, v: string) => setWizard((p) => ({ ...p, [k]: v }));

  async function generateFromWizard() {
    setGenerating(true);
    try {
      const res = await capitalRaisingApi.generateMission({
        targetIndustries: wizard.targetIndustries.split(',').map((s) => s.trim()).filter(Boolean),
        targetDealSize:   wizard.targetDealSize,
        whyThese:         wizard.whyThese,
        operationalImprovements: wizard.operationalImprovements,
        geographicFocus:  wizard.geographicFocus,
        valueCreationStrategy: wizard.valueCreationStrategy,
        useAI: true,
      });
      setForm((p) => ({
        ...p,
        missionStatement:      res.missionStatement || p.missionStatement,
        investmentThesis:      res.investmentThesis || p.investmentThesis,
        targetIndustries:      wizard.targetIndustries,
        targetDealSize:        wizard.targetDealSize,
        geographicFocus:       wizard.geographicFocus,
        valueCreationStrategy: wizard.valueCreationStrategy,
      }));
    } catch { /* silent */ }
    finally { setGenerating(false); }
  }

  return (
    <div className="space-y-5">
      {/* Wizard inputs */}
      <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg p-4 space-y-3">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Wizard Inputs (for AI generation)</p>
        <Input
          label="Target Industries (comma-separated)"
          value={wizard.targetIndustries}
          onChange={(e) => setW('targetIndustries', e.target.value)}
          placeholder="e.g. HVAC, Plumbing, Landscaping"
        />
        <Input
          label="Target Deal Size"
          value={wizard.targetDealSize}
          onChange={(e) => setW('targetDealSize', e.target.value)}
          placeholder="e.g. $1M–$5M revenue"
        />
        <Textarea
          label="Why these industries?"
          value={wizard.whyThese}
          onChange={(e) => setW('whyThese', e.target.value)}
          rows={2}
          placeholder="e.g. Recurring revenue, essential services, owner-operator transition opportunity"
        />
        <Textarea
          label="What operational improvements will you bring?"
          value={wizard.operationalImprovements}
          onChange={(e) => setW('operationalImprovements', e.target.value)}
          rows={2}
          placeholder="e.g. CRM systems, pricing discipline, team development"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Geographic Focus"
            value={wizard.geographicFocus}
            onChange={(e) => setW('geographicFocus', e.target.value)}
            placeholder="e.g. Southeast US"
          />
          <Input
            label="Value Creation Strategy"
            value={wizard.valueCreationStrategy}
            onChange={(e) => setW('valueCreationStrategy', e.target.value)}
            placeholder="e.g. Organic + add-on acquisitions"
          />
        </div>
        <Button
          variant="ghost"
          onClick={generateFromWizard}
          disabled={generating}
          className="flex items-center gap-2 text-[var(--color-accent)] w-full justify-center"
        >
          <Wand2 className="w-4 h-4" />
          {generating ? 'Generating…' : 'AI: Generate Mission & Thesis'}
        </Button>
      </div>

      {/* Editable results */}
      <Textarea
        label="Mission Statement"
        value={form.missionStatement}
        onChange={(e) => set('missionStatement', e.target.value)}
        rows={4}
        placeholder="We acquire and operate…"
      />
      <Textarea
        label="Investment Thesis"
        value={form.investmentThesis}
        onChange={(e) => set('investmentThesis', e.target.value)}
        rows={4}
        placeholder="We focus on…"
      />
      <div className="grid grid-cols-2 gap-3">
        <Input label="Target Deal Size" value={form.targetDealSize} onChange={(e) => set('targetDealSize', e.target.value)} />
        <Input label="Geographic Focus" value={form.geographicFocus} onChange={(e) => set('geographicFocus', e.target.value)} />
      </div>
      <Input
        label="Target Industries (comma-separated)"
        value={form.targetIndustries}
        onChange={(e) => set('targetIndustries', e.target.value)}
      />
      <Textarea
        label="Value Creation Strategy"
        value={form.valueCreationStrategy}
        onChange={(e) => set('valueCreationStrategy', e.target.value)}
        rows={2}
      />

      <div className="flex gap-3 justify-end pt-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => onSave(form)}
          disabled={!form.missionStatement.trim() && !form.investmentThesis.trim()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function MessagingCard({
  record,
  onEdit,
  isLatest,
}: {
  record: FirmMessaging;
  onEdit: () => void;
  isLatest: boolean;
}) {
  return (
    <div className={`bg-[var(--color-surface)] border rounded-xl p-5 ${isLatest ? 'border-[var(--color-accent)]' : 'border-[var(--color-border)]'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--color-accent)]" />
          {isLatest && (
            <span className="text-xs bg-[var(--color-accent)] text-white px-2 py-0.5 rounded-full">Active</span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onEdit}>Edit</Button>
      </div>

      {record.missionStatement && (
        <div className="mb-3">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Mission</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{record.missionStatement}</p>
        </div>
      )}
      {record.investmentThesis && (
        <div className="mb-3">
          <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-1">Investment Thesis</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{record.investmentThesis}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3 text-sm text-[var(--color-text-muted)]">
        {record.targetDealSize && <span>Deal size: <strong>{record.targetDealSize}</strong></span>}
        {record.geographicFocus && <span>Geography: <strong>{record.geographicFocus}</strong></span>}
        {record.targetIndustries.length > 0 && (
          <span>Industries: <strong>{record.targetIndustries.join(', ')}</strong></span>
        )}
      </div>
    </div>
  );
}

export default function MessagingPage() {
  const [records, setRecords] = useState<FirmMessaging[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FirmMessaging | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capitalRaisingApi.listMessaging();
      setRecords((res as { firmMessaging: FirmMessaging[] }).firmMessaging);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(form: typeof BLANK_MESSAGING) {
    await capitalRaisingApi.createMessaging({
      missionStatement:      form.missionStatement,
      investmentThesis:      form.investmentThesis,
      targetIndustries:      form.targetIndustries.split(',').map((s) => s.trim()).filter(Boolean),
      targetDealSize:        form.targetDealSize,
      geographicFocus:       form.geographicFocus,
      valueCreationStrategy: form.valueCreationStrategy,
    });
    setShowAdd(false);
    load();
  }

  async function handleUpdate(form: typeof BLANK_MESSAGING) {
    if (!editing) return;
    await capitalRaisingApi.updateMessaging(editing.id, {
      missionStatement:      form.missionStatement,
      investmentThesis:      form.investmentThesis,
      targetIndustries:      form.targetIndustries.split(',').map((s) => s.trim()).filter(Boolean),
      targetDealSize:        form.targetDealSize,
      geographicFocus:       form.geographicFocus,
      valueCreationStrategy: form.valueCreationStrategy,
    });
    setEditing(null);
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Mission & Thesis Builder</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Define your firm mission and investment thesis</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Messaging
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : records.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)] mb-4">No messaging defined yet.</p>
          <Button onClick={() => setShowAdd(true)}>Define Your Mission</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((r, idx) => (
            <MessagingCard
              key={r.id}
              record={r}
              isLatest={idx === 0}
              onEdit={() => setEditing(r)}
            />
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Define Firm Messaging">
        <MessagingForm onSave={handleCreate} onCancel={() => setShowAdd(false)} />
      </Modal>

      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Firm Messaging">
          <MessagingForm
            initial={{
              missionStatement:      editing.missionStatement,
              investmentThesis:      editing.investmentThesis,
              targetIndustries:      editing.targetIndustries.join(', '),
              targetDealSize:        editing.targetDealSize,
              geographicFocus:       editing.geographicFocus,
              valueCreationStrategy: editing.valueCreationStrategy,
            }}
            onSave={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}
