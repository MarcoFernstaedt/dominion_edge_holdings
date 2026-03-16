'use client';

import { useAppStore } from '@/lib/store';
import { formatDate, formatRelativeDate, statusLabel } from '@/lib/utils';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { ArrowLeft, Mail, Phone, Linkedin, Building2 } from 'lucide-react';
import Link from 'next/link';

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const contacts = useAppStore((s) => s.contacts);
  const interactions = useAppStore((s) => s.interactions);

  const contact = contacts.find((c) => c.id === params.id);

  if (!contact) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-6 text-center">
        <p className="text-sm text-[#A7A29A]">Contact not found.</p>
        <Link href="/crm/contacts" className="text-[#D4AF37] hover:underline text-sm mt-2 inline-block">← Back to Contacts</Link>
      </div>
    );
  }

  const contactInteractions = interactions.filter(
    (i) => i.contactId === params.id || (i.entityType === 'contact' && i.entityId === params.id)
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <Link href="/crm/contacts" className="inline-flex items-center gap-1.5 text-sm text-[#A7A29A] hover:text-[#E8E6E3] transition-colors">
        <ArrowLeft size={14} aria-hidden />
        Contacts
      </Link>

      <header>
        <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">{contact.fullName}</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <Badge variant="muted">{statusLabel(contact.contactType)}</Badge>
          {contact.title && <span className="text-sm text-[#A7A29A]">{contact.title}</span>}
          {contact.companyName && <span className="text-sm text-[#A7A29A]">at {contact.companyName}</span>}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-5">
            <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">Contact Info</h2>
            <dl className="space-y-2.5">
              {contact.email && (
                <div className="flex items-center gap-2">
                  <dt><Mail size={13} className="text-[#A7A29A]" aria-label="Email" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    <a href={`mailto:${contact.email}`} className="hover:text-[#D4AF37]">{contact.email}</a>
                  </dd>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2">
                  <dt><Phone size={13} className="text-[#A7A29A]" aria-label="Phone" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    <a href={`tel:${contact.phone}`} className="hover:text-[#D4AF37]">{contact.phone}</a>
                  </dd>
                </div>
              )}
              {contact.linkedinUrl && (
                <div className="flex items-center gap-2">
                  <dt><Linkedin size={13} className="text-[#A7A29A]" aria-label="LinkedIn" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37] truncate block">
                      LinkedIn Profile
                    </a>
                  </dd>
                </div>
              )}
              {contact.companyName && (
                <div className="flex items-center gap-2">
                  <dt><Building2 size={13} className="text-[#A7A29A]" aria-label="Company" /></dt>
                  <dd className="text-sm text-[#E8E6E3]">
                    {contact.companyId ? (
                      <Link href={`/crm/companies/${contact.companyId}`} className="hover:text-[#D4AF37]">
                        {contact.companyName}
                      </Link>
                    ) : contact.companyName}
                  </dd>
                </div>
              )}
            </dl>
          </div>
          {contact.notes && (
            <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-4">
              <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-2">Notes</h2>
              <p className="text-sm text-[#E8E6E3] whitespace-pre-line">{contact.notes}</p>
            </div>
          )}
          <div className="text-xs text-[#A7A29A]">Added {formatDate(contact.createdAt)}</div>
        </div>

        <div className="lg:col-span-2">
          <h2 className="text-[10px] tracking-widest uppercase font-medium text-[#A7A29A] mb-3">
            Interaction History ({contactInteractions.length})
          </h2>
          {contactInteractions.length === 0 ? (
            <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-8 text-center">
              <p className="text-sm text-[#A7A29A]">No interactions yet.</p>
            </div>
          ) : (
            <ol className="relative border-l border-[#2A2A2E] ml-3">
              {contactInteractions.map((i) => (
                <li key={i.id} className="mb-3 ml-4">
                  <div className="absolute -left-2 w-3 h-3 rounded-full bg-[#141414] border-2 border-[#2A2A2E]" aria-hidden />
                  <div className="bg-[#141414] border border-[#2A2A2E] rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={i.direction === 'inbound' ? 'info' : 'gold'} size="sm">
                        {i.direction === 'inbound' ? '↓' : '↑'} {statusLabel(i.interactionType)}
                      </Badge>
                      <span className="text-xs text-[#A7A29A]">{formatRelativeDate(i.createdAt)}</span>
                    </div>
                    {i.subject && <div className="text-sm text-[#E8E6E3]">{i.subject}</div>}
                    {i.bodyPreview && <p className="text-xs text-[#A7A29A] mt-0.5">{i.bodyPreview}</p>}
                    {i.outcome && <div className="text-xs mt-1"><span className="text-[#A7A29A]">Outcome: </span><span className="text-[#E8E6E3]">{i.outcome}</span></div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
