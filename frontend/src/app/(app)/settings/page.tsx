'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { executionApi } from '@/lib/api';
import { Settings, Eye, Zap, Mail, Brain, Plug, ChevronRight, Target } from 'lucide-react';

const EXECUTION_TARGET_FIELDS = [
  { key: 'daily_owner_calls', label: 'Daily Owner Calls', hint: 'Base outbound call floor for each execution day.' },
  { key: 'weekly_owner_contacts', label: 'Weekly Owner Contacts', hint: 'Total owners touched across calls, email, and LinkedIn.' },
  { key: 'weekly_investor_calls', label: 'Weekly Investor Calls', hint: 'Capital conversations to keep financing warm.' },
  { key: 'monthly_lois', label: 'Monthly LOIs', hint: 'Monthly offer volume target.' },
  { key: 'pipeline_companies', label: 'Pipeline Companies', hint: 'Top-of-funnel company universe.' },
  { key: 'pipeline_owners_contacted', label: 'Pipeline Owners Contacted', hint: 'Owners reached inside the 500-company funnel.' },
  { key: 'pipeline_conversations', label: 'Pipeline Conversations', hint: 'Live owner conversations target.' },
  { key: 'pipeline_opportunities', label: 'Pipeline Opportunities', hint: 'Serious qualified opportunities target.' },
  { key: 'pipeline_lois', label: 'Pipeline LOIs', hint: 'Expected LOIs in the active funnel.' },
  { key: 'pipeline_closed', label: 'Pipeline Closed Deals', hint: 'Closed transactions target.' },
  { key: 'board_target_min', label: 'Board Target Min', hint: 'Minimum board members required before closing.' },
  { key: 'board_target_max', label: 'Board Target Max', hint: 'Upper end of desired board strength.' },
] as const;

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const s = settings;
  const u = (updates: Partial<typeof settings>) => updateSettings(updates);
  const [executionTargets, setExecutionTargets] = useState<Record<string, number>>({});
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsSaving, setTargetsSaving] = useState(false);
  const [targetsSaved, setTargetsSaved] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadTargets() {
      setTargetsLoading(true);
      try {
        const res = await executionApi.getTargets();
        const nextTargets = (res as { targets?: Record<string, number> }).targets || {};
        if (mounted) setExecutionTargets(nextTargets);
      } catch {
        if (mounted) setExecutionTargets({});
      } finally {
        if (mounted) setTargetsLoading(false);
      }
    }
    loadTargets();
    return () => { mounted = false; };
  }, []);

  const targetRows = useMemo(() => {
    return EXECUTION_TARGET_FIELDS.map((field) => ({
      ...field,
      value: executionTargets[field.key] ?? 0,
    }));
  }, [executionTargets]);

  async function saveExecutionTargets() {
    setTargetsSaving(true);
    try {
      await Promise.all(
        EXECUTION_TARGET_FIELDS.map((field) =>
          executionApi.updateTarget(field.key, Number(executionTargets[field.key] ?? 0), 'ongoing')
        )
      );
      setTargetsSaved(true);
      setTimeout(() => setTargetsSaved(false), 3000);
    } catch {
      // silent for now; page stays editable
    } finally {
      setTargetsSaving(false);
    }
  }

  return (
    <div className="page-container-narrow space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Settings</h1>
        <p className="text-sm text-[#A7A29A] mt-1">Platform configuration · AI, email, accessibility, appearance</p>
      </header>

      {/* Integrations shortcut */}
      <Link
        href="/settings/integrations"
        className="flex items-center justify-between gap-4 px-5 py-4 bg-[#141414] border border-[#2A2A2E] rounded-lg hover:border-[#C9A227] transition-colors group"
      >
        <div className="flex items-center gap-3">
          <Plug size={16} className="text-[#C9A227]" aria-hidden />
          <div>
            <div className="text-sm font-medium text-[#E8E6E3] group-hover:text-[#C9A227] transition-colors">Integrations</div>
            <div className="text-xs text-[#A7A29A]">Configure Apollo, AI provider, email, and calendar</div>
          </div>
        </div>
        <ChevronRight size={14} className="text-[#A7A29A] group-hover:text-[#C9A227] transition-colors" aria-hidden />
      </Link>

      {/* Accessibility */}
      <section aria-labelledby="accessibility-settings">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="accessibility-settings" className="text-sm font-semibold text-[#E8E6E3]">Accessibility</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm text-[#E8E6E3]">Reduce Motion</div>
              <div className="text-xs text-[#A7A29A]">Disable animations and transitions</div>
            </div>
            <button
              role="switch"
              aria-checked={s.reducedMotion}
              onClick={() => u({ reducedMotion: !s.reducedMotion })}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${s.reducedMotion ? 'bg-[#C9A227]' : 'bg-[#2A2A2E]'}`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white transition-transform ${s.reducedMotion ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm text-[#E8E6E3]">High Contrast</div>
              <div className="text-xs text-[#A7A29A]">Increase contrast for low-vision users</div>
            </div>
            <button
              role="switch"
              aria-checked={s.highContrast}
              onClick={() => u({ highContrast: !s.highContrast })}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${s.highContrast ? 'bg-[#C9A227]' : 'bg-[#2A2A2E]'}`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white transition-transform ${s.highContrast ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm text-[#E8E6E3]">Keyboard Shortcuts</div>
              <div className="text-xs text-[#A7A29A]">Enable global keyboard shortcuts (⌘K, etc.)</div>
            </div>
            <button
              role="switch"
              aria-checked={s.keyboardShortcutsEnabled}
              onClick={() => u({ keyboardShortcutsEnabled: !s.keyboardShortcutsEnabled })}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${s.keyboardShortcutsEnabled ? 'bg-[#C9A227]' : 'bg-[#2A2A2E]'}`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white transition-transform ${s.keyboardShortcutsEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>

          <Select
            label="UI Density"
            value={s.density}
            onChange={(e) => u({ density: e.target.value as typeof s.density })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'standard', label: 'Standard' },
              { value: 'spacious', label: 'Spacious' },
            ]}
          />
        </div>
      </section>

      {/* AI */}
      <section aria-labelledby="ai-settings">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="ai-settings" className="text-sm font-semibold text-[#E8E6E3]">AI Features</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-4">
          {[
            { key: 'aiDraftingEnabled', label: 'AI Outreach Drafting', desc: 'Generate personalized outreach drafts' },
            { key: 'aiReplyEnabled', label: 'AI Reply Suggestions', desc: 'Suggest replies to incoming emails' },
            { key: 'aiBriefingEnabled', label: 'AI Daily Briefing', desc: 'Generate daily priority summary' },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="text-sm text-[#E8E6E3]">{item.label}</div>
                <div className="text-xs text-[#A7A29A]">{item.desc}</div>
              </div>
              <button
                role="switch"
                aria-checked={s[item.key as keyof typeof s] as boolean}
                onClick={() => u({ [item.key]: !s[item.key as keyof typeof s] } as Partial<typeof s>)}
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] ${s[item.key as keyof typeof s] ? 'bg-[#C9A227]' : 'bg-[#2A2A2E]'}`}
              >
                <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white transition-transform ${s[item.key as keyof typeof s] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          ))}

          <div className="pt-2 border-t border-[#2A2A2E]">
            <Input
              label="Primary Model"
              value={s.primaryModel}
              onChange={(e) => u({ primaryModel: e.target.value })}
              hint="e.g. claude-sonnet-4-20250514"
            />
          </div>
          <Input
            label="Backend API URL"
            value={s.apiUrl}
            onChange={(e) => u({ apiUrl: e.target.value })}
            hint="Your backend server URL"
          />
        </div>
      </section>

      {/* Email */}
      <section aria-labelledby="email-settings">
        <div className="flex items-center gap-2 mb-4">
          <Mail size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="email-settings" className="text-sm font-semibold text-[#E8E6E3]">Email Configuration</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-4">
          <Select
            label="Email Mode"
            value={s.emailMode}
            onChange={(e) => u({ emailMode: e.target.value as typeof s.emailMode })}
            options={[
              { value: 'smtp_only', label: 'SMTP Send Only' },
              { value: 'imap_smtp', label: 'IMAP + SMTP (Full Sync)' },
              { value: 'gmail_api', label: 'Gmail API (Coming Soon)' },
            ]}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="From Name" value={s.fromName} onChange={(e) => u({ fromName: e.target.value })} placeholder="Marco Fernstaedt" />
            <Input label="From Email" value={s.fromEmail} onChange={(e) => u({ fromEmail: e.target.value })} placeholder="marco@dominionedge.com" type="email" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Input label="SMTP Host" value={s.smtpHost} onChange={(e) => u({ smtpHost: e.target.value })} placeholder="smtp.gmail.com" />
            </div>
            <Input label="SMTP Port" value={String(s.smtpPort)} onChange={(e) => u({ smtpPort: Number(e.target.value) })} type="number" />
          </div>
          <Input label="SMTP Username" value={s.smtpUser} onChange={(e) => u({ smtpUser: e.target.value })} placeholder="your@email.com" type="email" />
          <div className="bg-[#D9A44115] border border-[#D9A44130] rounded px-3 py-2 text-xs text-[#D9A441]">
            ⚠ SMTP password and sensitive credentials must be configured in the backend .env file, not here.
            Never enter credentials directly in this form. Contact your system administrator.
          </div>
        </div>
      </section>

      {/* Sentinel operator settings */}
      <section aria-labelledby="operator-settings">
        <div className="flex items-center gap-2 mb-4">
          <Brain size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="operator-settings" className="text-sm font-semibold text-[#E8E6E3]">Sentinel Operator</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Wake Time"
              value={s.operatorWakeTime || ''}
              onChange={(e) => u({ operatorWakeTime: e.target.value })}
              placeholder="05:00"
            />
            <Input
              label="Evening Mode Start"
              value={s.qlaEveningModeStartTime || ''}
              onChange={(e) => u({ qlaEveningModeStartTime: e.target.value })}
              placeholder="16:00"
            />
            <Input
              label="QLA Work Start"
              value={s.qlaWorkStartTime || ''}
              onChange={(e) => u({ qlaWorkStartTime: e.target.value })}
              placeholder="17:00"
            />
          </div>
          <Input
            label="Primary Industry"
            value={s.qlaPrimaryIndustry || ''}
            onChange={(e) => u({ qlaPrimaryIndustry: e.target.value })}
            placeholder="Pest control"
          />
          <Input
            label="Primary Goal"
            value={s.qlaPrimaryGoal || ''}
            onChange={(e) => u({ qlaPrimaryGoal: e.target.value })}
            placeholder="First acquisition in ~12 months. Three acquisitions in 2 years."
          />
          <Input
            label="Morning Stack"
            value={(s.qlaMorningStack || []).join(', ')}
            onChange={(e) => u({ qlaMorningStack: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
            hint="Comma-separated. Example: Wake, Train, Affirmations, Read/Study"
          />
          <Input
            label="2-Hour Sprint Template"
            value={(s.qlaSprintTemplate || []).join(' | ')}
            onChange={(e) => u({ qlaSprintTemplate: e.target.value.split('|').map((x) => x.trim()).filter(Boolean) })}
            hint="Separate sprint steps with |"
          />
          <div className="bg-[#111111] border border-[#2A2A2E] rounded-md px-3 py-3 text-xs text-[#A7A29A] leading-relaxed">
            Affirmation builder status: morning/evening targeting is active, focus targeting is active, and affirmations remain editable from the Command Center manager. Next content pass can focus on writing your final custom QLA affirmation sets.
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input
              label="Board Outreach / Week"
              type="number"
              value={String(s.qlaBoardOutreachWeeklyTarget || 10)}
              onChange={(e) => u({ qlaBoardOutreachWeeklyTarget: Number(e.target.value) || 0 })}
            />
            <Input
              label="Seller Outreach / Week"
              type="number"
              value={String(s.qlaSellerOutreachWeeklyTarget || 25)}
              onChange={(e) => u({ qlaSellerOutreachWeeklyTarget: Number(e.target.value) || 0 })}
            />
            <Input
              label="Target Count Goal"
              type="number"
              value={String(s.qlaTargetCountGoal || 100)}
              onChange={(e) => u({ qlaTargetCountGoal: Number(e.target.value) || 0 })}
            />
            <Select
              label="Affirmation Focus"
              value={s.qlaAffirmationFocus || 'auto'}
              onChange={(e) => u({ qlaAffirmationFocus: e.target.value as typeof s.qlaAffirmationFocus })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'identity', label: 'Identity' },
                { value: 'board', label: 'Board' },
                { value: 'sourcing', label: 'Sourcing' },
                { value: 'finance', label: 'Finance' },
                { value: 'execution', label: 'Execution' },
                { value: 'resilience', label: 'Resilience' },
                { value: 'vision', label: 'Vision' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* QLA execution targets */}
      <section aria-labelledby="execution-target-settings">
        <div className="flex items-center gap-2 mb-4">
          <Target size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="execution-target-settings" className="text-sm font-semibold text-[#E8E6E3]">QLA Execution Targets</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm text-[#A7A29A] max-w-2xl">
              These targets drive the execution dashboards and give the Command Center a real operating standard instead of a static aspiration.
            </p>
            {targetsSaved && <span className="text-xs text-emerald-400">Saved ✓</span>}
          </div>

          {targetsLoading ? (
            <p className="text-sm text-[#A7A29A]">Loading execution targets…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {targetRows.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    type="number"
                    min="0"
                    value={String(field.value)}
                    onChange={(e) => setExecutionTargets((prev) => ({ ...prev, [field.key]: Number(e.target.value) || 0 }))}
                    hint={field.hint}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={saveExecutionTargets} disabled={targetsSaving}>
                  {targetsSaving ? 'Saving…' : 'Save Execution Targets'}
                </Button>
                <span className="text-xs text-[#A7A29A]">Writes through to the backend execution tracker.</span>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Data management */}
      <section aria-labelledby="data-settings">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="data-settings" className="text-sm font-semibold text-[#E8E6E3]">Data & Storage</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5 space-y-3">
          <p className="text-sm text-[#A7A29A]">
            All data is currently stored locally in your browser. Export and cloud sync features are on the roadmap.
          </p>
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (window.confirm('This will clear ALL local data. Are you absolutely sure?')) {
                  localStorage.removeItem('deh-aos-store');
                  window.location.reload();
                }
              }}
            >
              Clear All Local Data
            </Button>
          </div>
        </div>
      </section>

      {/* Keyboard shortcuts reference */}
      <section aria-labelledby="shortcuts-ref">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-[#C9A227]" aria-hidden />
          <h2 id="shortcuts-ref" className="text-sm font-semibold text-[#E8E6E3]">Keyboard Shortcuts</h2>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[
              ['⌘ K', 'Open command palette'],
              ['Tab', 'Navigate between elements'],
              ['Enter / Space', 'Activate focused element'],
              ['Escape', 'Close dialog / cancel'],
              ['Arrow keys', 'Navigate lists and menus'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-[#2A2A2E] last:border-0 col-span-1">
                <dt>
                  <kbd className="bg-[#1B1B1D] border border-[#2A2A2E] rounded px-2 py-0.5 text-xs text-[#E8E6E3] font-mono">{key}</kbd>
                </dt>
                <dd className="text-xs text-[#A7A29A]">{desc}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
