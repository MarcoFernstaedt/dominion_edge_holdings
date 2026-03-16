'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, formatDate, formatRelativeDate, formatCurrency, nowIso, generateId, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ArrowLeft, Phone, Mail, Globe, Calendar, Plus, Edit2, Building2 } from 'lucide-react';
import Link from 'next/link';
import type { Interaction, InteractionType, CompanyStatus } from '@/lib/types';

const INTERACTION_TYPES: { value: InteractionType; label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
  { value: 'document_sent', label: 'Document Sent' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'research', label: 'Research' },
];

const STATUS_OPTIONS: { value: CompanyStatus; label: string }[] = [
  { value: 'target', label: 'Target' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'interested', label: 'Interested' },
  { value: 'diligence', label: 'Diligence' },
  { value: 'under_loi', label: 'Under LOI' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
  { value: 'archived', label: 'Archived' },
];

export default function CompanyDetailPage({ params }: { params: { id: string } }) {
  const companies = useAppStore((s) => s.companies);
  const updateCompany = useAppStore((s) => s.updateCompany);
  const interactions = useAppStore((s) => s.interactions);
  const addInteraction = useAppStore((s) => s.addInteraction);
  const deals = useAppStore((s) => s.deals);

  const company = companies.find((c) => c.id === params.id);

  const [logOpen, setLogOpen] = useState(false);
  const [logForm, setLogForm] = useState({
    interactionType: 'call' as InteractionType,
    direction: 'outbound' as 'inbound' | 'outbound',
    subject: '',
    bodyPreview: '',
    outcome: '',
    requiresFollowUp: false,
    followUpDate: '',
  });

  const companyInteractions = interactions.filter(
    (i) => i.entityType === 'company' && i.entityId === params.id
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const companyDeals = deals.filter((d) => d.companyId === params.id);

  if (!company) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6 text-center">
        <Building2 size={40} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
        <p className="text-sm text-[#A7A29A]">Company not found.</p>
        <Link href="/crm/companies" className="text-[#D4AF37] hover:underline text-sm mt-2 inline-block">
          ← Back to Companies
        </Link>
      </div>
    );
  }

  function handleLogInteraction() {
    const interaction: Interaction = {
      id: generateId(),
      entityType: 'company',
      entityId: company!.id,
      interactionType: logForm.interactionType,
      direction: logForm.direction,
      subject: logForm.subject || undefined,
      bodyPreview: logForm.bodyPreview || undefined,
      outcome: logForm.outcome || undefined,
      requiresFollowUp: logForm.requiresFollowUp,
      followUpDate: logForm.followUpDate || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    addInteraction(interaction);
    updateCompany(company!.id, { lastInteractionAt: nowIso() });
    setLogOpen(false);
    setLogForm({ interactionType: 'call', direction: 'outbound', subject: '', bodyPreview: '', outcome: '', requiresFollowUp: false, followUpDate: '' });
  }

  const interactionIcon: Record<string, string> = {
    call: '📞',
    email: '✉️',
    meeting: '🤝',
    note: '📝',
    document_sent: '📄',
    follow_up: '🔔',
    research: '🔍',
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      {/* Back nav */}
      <Link
        href="/crm/companies"
        className="inline-flex items-center gap-1.5 text-sm text-[#A7A29A] hover:text-[#E8E6E3] transition-colors"
      >
        <ArrowLeft size={14} aria-hidden />
        Companies
      </Link>

      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <StatusBadge status={company.status} />
            {company.priority && <StatusBadge status={company.priority} />}
            {company.industry && <span className="text-xs text-[#A7A29A]">{company.industry}</span>}
            {company.city && <span className="text-xs text-[#A7A29A]">{company.city}, {company.state}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <select
            value={company.status}
            onChange={(e) => updateCompany(company.id, { status: e.target.value as CompanyStatus })}
            className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
            aria-label="Change company status"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-[#1B1B1D]">{o.label}</option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={() => setLogOpen(true)}>
            <Plus size={13} aria-hidden />
            Log Interaction
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Overview + Contact */}
        <div className="lg:col-span-1 space-y-4">
          {/* Company info */}
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Company Info</h2>
            <dl className="space-y-2.5">
              {company.phone && (
                <div className="flex items-center gap-2">
                  <dt><Phone size={13} className="text-[#A7A29A]" aria-label="Phone" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    <a href={`tel:${company.phone}`} className="hover:text-[#D4AF37] transition-colors">{company.phone}</a>
                  </dd>
                </div>
              )}
              {company.email && (
                <div className="flex items-center gap-2">
                  <dt><Mail size={13} className="text-[#A7A29A]" aria-label="Email" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    <a href={`mailto:${company.email}`} className="hover:text-[#D4AF37] transition-colors">{company.email}</a>
                  </dd>
                </div>
              )}
              {company.website && (
                <div className="flex items-center gap-2">
                  <dt><Globe size={13} className="text-[#A7A29A]" aria-label="Website" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37] transition-colors">{company.website}</a>
                  </dd>
                </div>
              )}
              {company.ownerName && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Owner</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{company.ownerName}</dd>
                </div>
              )}
              {company.yearsInBusiness && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Years in Business</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{company.yearsInBusiness} years</dd>
                </div>
              )}
              {(company.estimatedRevenueLow || company.estimatedRevenueHigh) && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Revenue Est.</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">
                    {company.estimatedRevenueLow && formatCurrency(company.estimatedRevenueLow)}
                    {company.estimatedRevenueLow && company.estimatedRevenueHigh && ' – '}
                    {company.estimatedRevenueHigh && formatCurrency(company.estimatedRevenueHigh)}
                  </dd>
                </div>
              )}
              {(company.estimatedSDELow || company.estimatedSDEHigh) && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">SDE Est.</dt>
                  <dd className="text-sm text-[#D4AF37] mt-0.5">
                    {company.estimatedSDELow && formatCurrency(company.estimatedSDELow)}
                    {company.estimatedSDELow && company.estimatedSDEHigh && ' – '}
                    {company.estimatedSDEHigh && formatCurrency(company.estimatedSDEHigh)}
                  </dd>
                </div>
              )}
              {company.source && (
                <div>
                  <dt className="text-[9px] tracking-widest uppercase text-[#A7A29A]">Source</dt>
                  <dd className="text-sm text-[#E8E6E3] mt-0.5">{company.source}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Signal flags */}
          {(company.retirementSignal || company.noWebsiteSignal || company.ownerAgeSignal) && (
            <div className="bg-[#141414] border border-[#D4AF3720] rounded-md p-4">
              <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#D4AF37] mb-2">Acquisition Signals</h2>
              <div className="space-y-1.5">
                {company.retirementSignal && <Badge variant="gold" size="sm">Retirement signal</Badge>}
                {company.noWebsiteSignal && <Badge variant="warning" size="sm">No website</Badge>}
                {company.ownerAgeSignal && <div className="text-xs text-[#A7A29A]">Owner age: {company.ownerAgeSignal}</div>}
              </div>
            </div>
          )}

          {/* Notes */}
          {company.notes && (
            <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
              <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-2">Notes</h2>
              <p className="text-sm text-[#E8E6E3] whitespace-pre-line">{company.notes}</p>
            </div>
          )}

          {/* Linked deals */}
          {companyDeals.length > 0 && (
            <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
              <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-2">Deals</h2>
              {companyDeals.map((d) => (
                <Link
                  key={d.id}
                  href={`/pipeline/${d.id}`}
                  className="block text-sm text-[#D4AF37] hover:underline py-0.5"
                >
                  {d.name} — {statusLabel(d.stage)}
                </Link>
              ))}
            </div>
          )}

          <div className="text-xs text-[#A7A29A]">
            Added {formatDate(company.createdAt)}
          </div>
        </div>

        {/* Right: Interaction timeline */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A]">
              Interaction History ({companyInteractions.length})
            </h2>
          </div>

          {companyInteractions.length === 0 ? (
            <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-8 text-center">
              <Calendar size={24} className="mx-auto text-[#A7A29A] mb-2" aria-hidden />
              <p className="text-sm text-[#A7A29A]">No interactions logged. Log your first touchpoint.</p>
            </div>
          ) : (
            <ol className="relative border-l border-[#2A2A2E] ml-3" aria-label="Interaction timeline">
              {companyInteractions.map((interaction) => (
                <li key={interaction.id} className="mb-4 ml-4">
                  <div className="absolute -left-2 w-4 h-4 rounded-full bg-[#141414] border-2 border-[#2A2A2E] flex items-center justify-center" aria-hidden="true">
                    <span className="text-[8px]">{interactionIcon[interaction.interactionType] ?? '·'}</span>
                  </div>
                  <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={interaction.direction === 'inbound' ? 'info' : 'gold'} size="sm">
                          {interaction.direction === 'inbound' ? '↓ Inbound' : '↑ Outbound'}
                        </Badge>
                        <span className="text-xs font-medium text-[#E8E6E3] capitalize">{interaction.interactionType.replace('_', ' ')}</span>
                      </div>
                      <span className="text-xs text-[#A7A29A]">{formatRelativeDate(interaction.createdAt)}</span>
                    </div>
                    {interaction.subject && <div className="text-sm font-medium text-[#E8E6E3]">{interaction.subject}</div>}
                    {interaction.bodyPreview && <p className="text-xs text-[#A7A29A] mt-0.5">{interaction.bodyPreview}</p>}
                    {interaction.outcome && (
                      <div className="mt-1.5 text-xs">
                        <span className="text-[#A7A29A]">Outcome: </span>
                        <span className="text-[#E8E6E3]">{interaction.outcome}</span>
                      </div>
                    )}
                    {interaction.requiresFollowUp && interaction.followUpDate && (
                      <div className="mt-1.5">
                        <Badge variant="warning" size="sm">Follow-up: {formatDate(interaction.followUpDate)}</Badge>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Log Interaction Modal */}
      <Modal open={logOpen} onClose={() => setLogOpen(false)} title="Log Interaction">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={logForm.interactionType}
              onChange={(e) => setLogForm((p) => ({ ...p, interactionType: e.target.value as InteractionType }))}
              options={INTERACTION_TYPES}
            />
            <Select
              label="Direction"
              value={logForm.direction}
              onChange={(e) => setLogForm((p) => ({ ...p, direction: e.target.value as 'inbound' | 'outbound' }))}
              options={[
                { value: 'outbound', label: 'Outbound (I initiated)' },
                { value: 'inbound', label: 'Inbound (They initiated)' },
              ]}
            />
          </div>
          <Input
            label="Subject"
            value={logForm.subject}
            onChange={(e) => setLogForm((p) => ({ ...p, subject: e.target.value }))}
            placeholder="Call about valuation, Email re: interest..."
          />
          <Textarea
            label="Notes / Body Preview"
            value={logForm.bodyPreview}
            onChange={(e) => setLogForm((p) => ({ ...p, bodyPreview: e.target.value }))}
            placeholder="What happened? Key points..."
            rows={3}
          />
          <Input
            label="Outcome"
            value={logForm.outcome}
            onChange={(e) => setLogForm((p) => ({ ...p, outcome: e.target.value }))}
            placeholder="Interested, no answer, call back in 2 weeks..."
          />
          <label className="flex items-center gap-2 text-sm text-[#E8E6E3] cursor-pointer">
            <input
              type="checkbox"
              checked={logForm.requiresFollowUp}
              onChange={(e) => setLogForm((p) => ({ ...p, requiresFollowUp: e.target.checked }))}
              className="accent-[#D4AF37]"
            />
            Schedule follow-up
          </label>
          {logForm.requiresFollowUp && (
            <Input
              label="Follow-up Date"
              type="date"
              value={logForm.followUpDate}
              onChange={(e) => setLogForm((p) => ({ ...p, followUpDate: e.target.value }))}
            />
          )}
          <div className="flex gap-2 pt-2">
            <Button variant="primary" onClick={handleLogInteraction}>Log Interaction</Button>
            <Button variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
