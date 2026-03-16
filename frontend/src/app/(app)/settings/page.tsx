'use client';

import { useAppStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Settings, Eye, Zap, Mail, Brain } from 'lucide-react';

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const s = settings;
  const u = (updates: Partial<typeof settings>) => updateSettings(updates);

  return (
    <div className="max-w-3xl mx-auto px-6 py-6 space-y-8">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Settings</h1>
        <p className="text-sm text-[#A7A29A] mt-1">Platform configuration · AI, email, accessibility, appearance</p>
      </header>

      {/* Accessibility */}
      <section aria-labelledby="accessibility-settings">
        <div className="flex items-center gap-2 mb-4">
          <Eye size={16} className="text-[#D4AF37]" aria-hidden />
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
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${s.reducedMotion ? 'bg-[#D4AF37]' : 'bg-[#2A2A2E]'}`}
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
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${s.highContrast ? 'bg-[#D4AF37]' : 'bg-[#2A2A2E]'}`}
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
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${s.keyboardShortcutsEnabled ? 'bg-[#D4AF37]' : 'bg-[#2A2A2E]'}`}
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
          <Brain size={16} className="text-[#D4AF37]" aria-hidden />
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
                className={`relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${s[item.key as keyof typeof s] ? 'bg-[#D4AF37]' : 'bg-[#2A2A2E]'}`}
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
          <Mail size={16} className="text-[#D4AF37]" aria-hidden />
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

      {/* Data management */}
      <section aria-labelledby="data-settings">
        <div className="flex items-center gap-2 mb-4">
          <Settings size={16} className="text-[#D4AF37]" aria-hidden />
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
          <Zap size={16} className="text-[#D4AF37]" aria-hidden />
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
