'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatRelativeDate, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Plus, Search, Users } from 'lucide-react';
import type { Contact, ContactType } from '@/lib/types';
import Link from 'next/link';
import { useFormField } from '@/hooks/useFormField';

const CONTACT_TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: 'seller', label: 'Seller' },
  { value: 'board_candidate', label: 'Board Candidate' },
  { value: 'banker', label: 'Banker' },
  { value: 'attorney', label: 'Attorney' },
  { value: 'cpa', label: 'CPA' },
  { value: 'capital_partner', label: 'Capital Partner' },
  { value: 'operator', label: 'Operator' },
  { value: 'networking_contact', label: 'Networking Contact' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'employee_candidate', label: 'Employee Candidate' },
];

function AddContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addContact = useAppStore((s) => s.addContact);
  const companies = useAppStore((s) => s.companies);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    title: '',
    companyId: '',
    contactType: 'seller' as ContactType,
    email: '',
    phone: '',
    linkedinUrl: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name required';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const companyName = companies.find((c) => c.id === form.companyId)?.name;
    addContact({
      id: generateId(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
      title: form.title || undefined,
      companyId: form.companyId || undefined,
      companyName,
      contactType: form.contactType,
      email: form.email || undefined,
      phone: form.phone || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      status: 'active',
      notes: form.notes || undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
    setForm({ firstName: '', lastName: '', title: '', companyId: '', contactType: 'seller', email: '', phone: '', linkedinUrl: '', notes: '' });
    setErrors({});
  }

  const f = useFormField(setForm);

  return (
    <Modal open={open} onClose={onClose} title="Add Contact">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="First Name *" value={form.firstName} onChange={f('firstName')} error={errors.firstName} autoFocus />
          <Input label="Last Name" value={form.lastName} onChange={f('lastName')} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Title" value={form.title} onChange={f('title')} placeholder="CEO, Owner, VP..." />
          <Select
            label="Contact Type"
            value={form.contactType}
            onChange={(e) => setForm((p) => ({ ...p, contactType: e.target.value as ContactType }))}
            options={CONTACT_TYPE_OPTIONS}
          />
        </div>
        <Select
          label="Company"
          value={form.companyId}
          onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}
          options={[{ value: '', label: '— No company —' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Email" value={form.email} onChange={f('email')} type="email" />
          <Input label="Phone" value={form.phone} onChange={f('phone')} type="tel" />
        </div>
        <Input label="LinkedIn URL" value={form.linkedinUrl} onChange={f('linkedinUrl')} placeholder="linkedin.com/in/..." />
        <Textarea label="Notes" value={form.notes} onChange={f('notes')} rows={2} />
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSubmit}>Add Contact</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function ContactsPage() {
  const contacts = useAppStore((s) => s.contacts);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || c.fullName.toLowerCase().includes(q) || (c.companyName || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
      const matchesType = !typeFilter || c.contactType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [contacts, search, typeFilter]);

  const typeColors: Record<string, string> = {
    seller: 'gold',
    board_candidate: 'info',
    banker: 'success',
    attorney: 'muted',
    cpa: 'muted',
    capital_partner: 'warning',
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Contacts</h1>
          <p className="text-sm text-[#A7A29A] mt-1">{contacts.length} total contacts</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} aria-hidden />
          Add Contact
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A7A29A]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] pl-8 pr-3 py-2 focus:outline-none focus:border-[#C9A227] placeholder:text-[#A7A29A60]"
            aria-label="Search contacts"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] px-3 py-2 focus:outline-none focus:border-[#C9A227]"
          aria-label="Filter by contact type"
        >
          <option value="">All Types</option>
          {CONTACT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1B1B1D]">{o.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-12 text-center">
          <Users size={32} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
          <p className="text-sm text-[#A7A29A] mb-3">
            {search || typeFilter ? 'No contacts match your filters.' : 'No contacts yet.'}
          </p>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} aria-hidden />
            Add First Contact
          </Button>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
          <table className="w-full" role="table" aria-label={`${filtered.length} contacts`}>
            <thead>
              <tr className="border-b border-[#2A2A2E]">
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3">Name</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden sm:table-cell">Type</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden md:table-cell">Company</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden lg:table-cell">Contact</th>
                <th scope="col" className="text-left text-[9px] font-medium tracking-widest uppercase text-[#A7A29A] px-4 py-3 hidden lg:table-cell">Last Touch</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((contact) => (
                <tr key={contact.id} className="border-b border-[#2A2A2E] last:border-0 hover:bg-[#1B1B1D] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#E8E6E3]">{contact.fullName}</div>
                    {contact.title && <div className="text-xs text-[#A7A29A]">{contact.title}</div>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant={(typeColors[contact.contactType] as 'gold' | 'info' | 'success' | 'muted' | 'warning') ?? 'muted'} size="sm">
                      {statusLabel(contact.contactType)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-[#A7A29A]">
                    {contact.companyName || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-[#A7A29A]">
                    {contact.email || contact.phone || '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-[#A7A29A]">
                    {contact.lastInteractionAt ? formatRelativeDate(contact.lastInteractionAt) : formatRelativeDate(contact.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/crm/contacts/${contact.id}`}
                      className="text-xs text-[#C9A227] hover:underline"
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

      <AddContactModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
