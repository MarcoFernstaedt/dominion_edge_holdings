'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, formatDate, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Send, FileText, Copy, Check } from 'lucide-react';
import type { OutreachTemplate } from '@/lib/types';

function TemplateCard({ template }: { template: OutreachTemplate }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <article className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start justify-between p-5 text-left hover:bg-[#1B1B1D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]"
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-[#E8E6E3]">{template.name}</span>
            {template.isSystemTemplate && <Badge variant="muted" size="sm">System</Badge>}
            <Badge variant="gold" size="sm">{statusLabel(template.templateType)}</Badge>
          </div>
          <div className="text-xs text-[#A7A29A] truncate">{template.subjectTemplate}</div>
        </div>
        <span className="text-xs text-[#A7A29A] ml-3">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-[#2A2A2E] p-5 space-y-4">
          {/* Subject */}
          <div>
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Subject Template</div>
            <div className="bg-[#1B1B1D] rounded px-3 py-2 text-sm text-[#E8E6E3] font-mono flex items-center justify-between gap-2">
              <span className="truncate">{template.subjectTemplate}</span>
              <button
                onClick={() => handleCopy(template.subjectTemplate)}
                className="flex-shrink-0 text-[#A7A29A] hover:text-[#C9A227] transition-colors"
                aria-label="Copy subject"
              >
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              </button>
            </div>
          </div>

          {/* Variables */}
          {template.variables.length > 0 && (
            <div>
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1.5">Variables</div>
              <div className="flex flex-wrap gap-1.5">
                {template.variables.map((v) => (
                  <code key={v} className="text-xs bg-[#C9A22710] text-[#C9A227] border border-[#C9A22730] rounded px-1.5 py-0.5">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Body Template</div>
              <button
                onClick={() => handleCopy(template.bodyTemplate)}
                className="flex items-center gap-1 text-xs text-[#A7A29A] hover:text-[#C9A227] transition-colors"
                aria-label="Copy body template"
              >
                {copied ? <Check size={11} aria-hidden /> : <Copy size={11} aria-hidden />}
                Copy
              </button>
            </div>
            <pre className="bg-[#1B1B1D] rounded p-3 text-xs text-[#E8E6E3] whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
              {template.bodyTemplate}
            </pre>
          </div>

          {template.tone && (
            <div className="text-xs text-[#A7A29A]">Tone: {template.tone.replace(/_/g, ' ')}</div>
          )}
        </div>
      )}
    </article>
  );
}

export default function OutreachPage() {
  const templates = useAppStore((s) => s.outreachTemplates);

  const byType: Record<string, OutreachTemplate[]> = templates.reduce((acc, t) => {
    if (!acc[t.templateType]) acc[t.templateType] = [];
    acc[t.templateType].push(t);
    return acc;
  }, {} as Record<string, OutreachTemplate[]>);

  const typeLabels: Record<string, string> = {
    seller_outreach: 'Seller Outreach',
    board_outreach: 'Board Outreach',
    lender_outreach: 'Lender Outreach',
    networking_outreach: 'Networking',
  };

  return (
    <div className="page-container space-y-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Outreach</h1>
        <p className="text-sm text-[#A7A29A] mt-1">
          {templates.length} templates · Seller, Board, Lender outreach sequences
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Templates</div>
          <div className="text-2xl font-bold font-serif text-[#C9A227]">{templates.length}</div>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">System Templates</div>
          <div className="text-2xl font-bold font-serif text-[#C9A227]">{templates.filter((t) => t.isSystemTemplate).length}</div>
        </div>
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Template Types</div>
          <div className="text-2xl font-bold font-serif text-[#C9A227]">{Object.keys(byType).length}</div>
        </div>
      </div>

      <div className="bg-[#4D7EA815] border border-[#4D7EA840] rounded-md px-4 py-3 text-sm text-[#4D7EA8]">
        Templates below are proven frameworks for acquisition outreach. Personalize the variables before sending.
        Configure email in <a href="/settings" className="underline">Settings</a> to send directly from the platform.
      </div>

      {/* Templates by type */}
      {Object.entries(byType).map(([type, typeTemplates]) => (
        <section key={type} aria-labelledby={`section-${type}`}>
          <h2 id={`section-${type}`} className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">
            {typeLabels[type] ?? type} ({typeTemplates.length})
          </h2>
          <div className="space-y-2">
            {typeTemplates.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
