'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatRelativeDate, formatCurrency, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Plus, Search, Building2, Phone, Mail, Globe, Star, Filter } from 'lucide-react';
import type { Company, CompanyStatus } from '@/lib/types';
import Link from 'next/link';
import { COMPANY_STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/constants';
import { DEFAULT_COMPANY_FORM } from '@/lib/defaults';
import { useFormField } from '@/hooks/useFormField';

// Alias for backwards-compat within this file
const STATUS_OPTIONS = COMPANY_STATUS_OPTIONS;

function AddCompanyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCompany = useAppStore((s) => s.addCompany);

  const [form, setForm] = useState(DEFAULT_COMPANY_FORM);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Company name is required';
    if (!form.industry.trim()) e.industry = 'Industry is required';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    addCompany({
      id: generateId(),
      name: form.name.trim(),
      industry: form.industry,
      website: form.website || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      ownerName: form.ownerName || undefined,
      ownerAgeSignal: form.ownerAgeSignal || undefined,
      estimatedRevenueLow: form.estimatedRevenueLow ? Number(form.estimatedRevenueLow) : undefined,
      estimatedRevenueHigh: form.estimatedRevenueHigh ? Number(form.estimatedRevenueHigh) : undefined,
      estimatedSDELow: form.estimatedSDELow ? Number(form.estimatedSDELow) : undefined,
      estimatedSDEHigh: form.estimatedSDEHigh ? Number(form.estimatedSDEHigh) : undefined,
      yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : undefined,
      status: form.status,
      priority: form.priority,
      source: form.source || undefined,
      notes: form.notes || undefined,
      retirementSignal: form.retirementSignal,
      noWebsiteSignal: form.noWebsiteSignal,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
    setForm(DEFAULT_COMPANY_FORM);
    setErrors({});
  }

  const f = useFormField(setForm);

  return (
    <Modal open={open} onClose={onClose} title="Add Company" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Company Name *" value={form.name} onChange={f('name')} error={errors.name} placeholder="Acme Pest Control" autoFocus />
          <Input label="Industry *" value={form.industry} onChange={f('industry')} error={errors.industry} placeholder="Pest Control" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Phone" value={form.phone} onChange={f('phone')} placeholder="(602) 555-0100" type="tel" />
          <Input label="Email" value={form.email} onChange={f('email')} placeholder="owner@example.com" type="email" />
          <Input label="Website" value={form.website} onChange={f('website')} placeholder="acmepest.com" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="City" value={form.city} onChange={f('city')} />
          <Input label="State" value={form.state} onChange={f('state')} />
          <Input label="Source" value={form.source} onChange={f('source')} placeholder="AZ OPM Registry" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Owner Name" value={form.ownerName} onChange={f('ownerName')} placeholder="John Smith" />
          <Input label="Owner Age Signal" value={form.ownerAgeSignal} onChange={f('ownerAgeSignal')} placeholder="60s" />
        </div>
        <div className="grid grid-cols-4 gap-3">
          <Input label="Revenue Low ($)" value={form.estimatedRevenueLow} onChange={f('estimatedRevenueLow')} type="number" placeholder="1500000" />
          <Input label="Revenue High ($)" value={form.estimatedRevenueHigh} onChange={f('estimatedRevenueHigh')} type="number" placeholder="3000000" />
          <Input label="SDE Low ($)" value={form.estimatedSDELow} onChange={f('estimatedSDELow')} type="number" placeholder="200000" />
          <Input label="SDE High ($)" value={form.estimatedSDEHigh} onChange={f('estimatedSDEHigh')} type="number" placeholder="500000" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Years in Business" value={form.yearsInBusiness} onChange={f('yearsInBusiness')} type="number" placeholder="20" />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as CompanyStatus }))}
            options={STATUS_OPTIONS.filter((o) => o.value !== '').map((o) => ({ value: o.value as string, label: o.label }))}
          />
          <Select
            label="Priority"
            value={form.priority ?? 'medium'}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as Company['priority'] }))}
            options={[
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-[#E8E6E3] cursor-pointer">
            <input
              type="checkbox"
              checked={form.retirementSignal}
              onChange={(e) => setForm((p) => ({ ...p, retirementSignal: e.target.checked }))}
              className="accent-[#C9A227]"
            />
            Retirement signal
          </label>
          <label className="flex items-center gap-2 text-sm text-[#E8E6E3] cursor-pointer">
            <input
              type="checkbox"
              checked={form.noWebsiteSignal}
              onChange={(e) => setForm((p) => ({ ...p, noWebsiteSignal: e.target.checked }))}
              className="accent-[#C9A227]"
            />
            No website (signal)
          </label>
        </div>
        <Textarea label="Notes" value={form.notes} onChange={f('notes')} placeholder="Notes about this company..." rows={2} />

        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSubmit}>Add Company</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function CompaniesPage() {
  const companies = useAppStore((s) => s.companies);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    return companies.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || c.name.toLowerCase().includes(q) || (c.ownerName || '').toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q);
      const matchesStatus = !statusFilter || c.status === statusFilter;
      const matchesPriority = !priorityFilter || c.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [companies, search, statusFilter, priorityFilter]);

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...filtered].sort((a, b) =>
    (priorityOrder[a.priority ?? 'low'] ?? 3) - (priorityOrder[b.priority ?? 'low'] ?? 3)
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Companies</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            {companies.length} total · {companies.filter((c) => c.status === 'interested').length} interested
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} aria-hidden />
          Add Company
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A7A29A]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] pl-8 pr-3 py-2 focus:outline-none focus:border-[#C9A227] placeholder:text-[#A7A29A60]"
            aria-label="Search companies"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#C9A227]"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1B1B1D]">{o.label}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#C9A227]"
          aria-label="Filter by priority"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1B1B1D]">{o.label}</option>
          ))}
        </select>
      </div>

      {/* Companies table */}
      {sorted.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-12 text-center">
          <Building2 size={32} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
          <p className="text-sm text-[#A7A29A] mb-3">
            {search || statusFilter || priorityFilter ? 'No companies match your filters.' : 'No companies yet.'}
          </p>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} aria-hidden />
            Add First Company
          </Button>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
          <table className="w-full" role="table" aria-label={`${sorted.length} companies`}>
            <thead>
              <tr className="border-b border-[#2A2A2E]">
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Company</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden sm:table-cell">Owner</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden md:table-cell">Revenue Est.</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Status</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden lg:table-cell">Priority</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden lg:table-cell">Last Touch</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((company) => (
                <tr
                  key={company.id}
                  className="border-b border-[#2A2A2E] last:border-0 hover:bg-[#1B1B1D] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {company.priority === 'critical' && <Star size={12} className="text-[#C35B5B] flex-shrink-0" aria-label="Critical priority" />}
                      {company.priority === 'high' && <Star size={12} className="text-[#D9A441] flex-shrink-0" aria-label="High priority" />}
                      <div>
                        <div className="text-sm font-medium text-[#E8E6E3]">{company.name}</div>
                        <div className="text-xs text-[#A7A29A]">
                          {company.city}{company.state ? `, ${company.state}` : ''}{company.yearsInBusiness ? ` · ${company.yearsInBusiness}yr` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="text-sm text-[#E8E6E3]">{company.ownerName || '—'}</div>
                    {company.retirementSignal && <Badge variant="gold" size="sm">Retirement signal</Badge>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {company.estimatedRevenueLow ? (
                      <div className="text-sm text-[#E8E6E3]">
                        {formatCurrency(company.estimatedRevenueLow)}
                        {company.estimatedRevenueHigh ? ` – ${formatCurrency(company.estimatedRevenueHigh)}` : ''}
                      </div>
                    ) : <span className="text-[#A7A29A]">—</span>}
                    {company.estimatedSDELow && (
                      <div className="text-xs text-[#A7A29A]">SDE: {formatCurrency(company.estimatedSDELow)}{company.estimatedSDEHigh ? `–${formatCurrency(company.estimatedSDEHigh)}` : ''}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={company.status} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {company.priority && <StatusBadge status={company.priority} />}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-[#A7A29A]">
                    {company.lastInteractionAt ? formatRelativeDate(company.lastInteractionAt) : formatRelativeDate(company.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/crm/companies/${company.id}`}
                      className="text-xs text-[#C9A227] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227] rounded"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddCompanyModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
