'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatDate, statusLabel } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { FileText, Plus, Download, Eye } from 'lucide-react';
import type { Document, DocumentType, DocumentStatus } from '@/lib/types';

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'loi', label: 'Letter of Intent (LOI)' },
  { value: 'board_invite', label: 'Board Invitation' },
  { value: 'outreach_letter', label: 'Outreach Letter' },
  { value: 'follow_up_email', label: 'Follow-up Email' },
  { value: 'meeting_agenda', label: 'Meeting Agenda' },
  { value: 'meeting_summary', label: 'Meeting Summary' },
  { value: 'deal_memo', label: 'Deal Memo' },
  { value: 'diligence_checklist', label: 'Diligence Checklist' },
  { value: 'board_update', label: 'Board Update' },
  { value: 'post_acquisition_plan', label: 'Post-Acquisition Plan' },
];

const LOI_TEMPLATE = `LETTER OF INTENT

Date: {{date}}

FROM:
{{buyer_entity}}
{{buyer_address}}

TO:
{{seller_name}}
{{seller_company}}
{{seller_address}}

Dear {{seller_name}},

This Letter of Intent ("LOI") sets forth the general terms under which {{buyer_entity}} ("Buyer") proposes to acquire {{seller_company}} ("Company") subject to satisfactory due diligence and the execution of a definitive purchase agreement.

1. ACQUISITION STRUCTURE
   Type: {{asset_or_equity}} Purchase
   Target Company: {{seller_company}}

2. PURCHASE PRICE
   Total Purchase Price: ${{purchase_price}}
   Down Payment: ${{down_payment}}
   Seller Note: ${{seller_note}} at {{seller_note_rate}}% over {{seller_note_term}} months
   SBA Financing: Subject to lender approval

3. EXCLUSIVITY
   Upon execution of this LOI, Seller agrees to an exclusivity period of {{exclusivity_days}} days during which Seller shall not solicit or entertain other offers for the acquisition of the Company.

4. DUE DILIGENCE PERIOD
   Buyer shall have {{diligence_days}} days from execution to complete satisfactory due diligence.

5. FINANCING CONTINGENCY
   This LOI is contingent upon Buyer obtaining satisfactory financing.

6. WORKING CAPITAL
   The parties agree to negotiate a working capital adjustment at closing.

7. CLOSING TARGET
   Target closing date: {{target_closing_date}}

8. NON-BINDING
   Except for the exclusivity and confidentiality provisions, this LOI is non-binding and does not create any legal obligation. Any transaction will be subject to final agreement and attorney review.

⚠️ ATTORNEY REVIEW REQUIRED: This is a draft template only. This document is not a legal instrument and must be reviewed and modified by qualified legal counsel prior to use.

Respectfully,

_______________________
{{buyer_name}}
{{buyer_title}}
{{buyer_entity}}

Date: ___________`;

function GenerateLOIModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addDocument = useAppStore((s) => s.addDocument);
  const deals = useAppStore((s) => s.deals);
  const companies = useAppStore((s) => s.companies);

  const [form, setForm] = useState({
    dealId: '',
    buyerEntity: 'Dominion Edge Holdings LLC',
    buyerName: 'Marco Fernstaedt',
    buyerTitle: 'Principal',
    sellerName: '',
    sellerCompany: '',
    purchasePrice: '',
    downPayment: '',
    sellerNote: '',
    sellerNoteRate: '6',
    sellerNoteTerm: '60',
    exclusivityDays: '30',
    diligenceDays: '60',
    targetClosingDate: '',
    assetOrEquity: 'Asset',
  });

  function handleGenerate() {
    const content = LOI_TEMPLATE
      .replace('{{date}}', new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      .replace('{{buyer_entity}}', form.buyerEntity)
      .replace('{{buyer_address}}', 'Phoenix, Arizona')
      .replace('{{seller_name}}', form.sellerName || '[Seller Name]')
      .replace('{{seller_company}}', form.sellerCompany || '[Company Name]')
      .replace('{{seller_address}}', '[Seller Address]')
      .replace('{{buyer_entity}}', form.buyerEntity)
      .replace('{{seller_company}}', form.sellerCompany || '[Company Name]')
      .replace('{{asset_or_equity}}', form.assetOrEquity)
      .replace('{{seller_company}}', form.sellerCompany || '[Company Name]')
      .replace('{{purchase_price}}', form.purchasePrice ? Number(form.purchasePrice).toLocaleString() : '[PURCHASE PRICE]')
      .replace('{{down_payment}}', form.downPayment ? Number(form.downPayment).toLocaleString() : '[DOWN PAYMENT]')
      .replace('{{seller_note}}', form.sellerNote ? Number(form.sellerNote).toLocaleString() : '[SELLER NOTE]')
      .replace('{{seller_note_rate}}', form.sellerNoteRate)
      .replace('{{seller_note_term}}', form.sellerNoteTerm)
      .replace('{{exclusivity_days}}', form.exclusivityDays)
      .replace('{{diligence_days}}', form.diligenceDays)
      .replace('{{target_closing_date}}', form.targetClosingDate || '[TBD]')
      .replace('{{buyer_name}}', form.buyerName)
      .replace('{{buyer_title}}', form.buyerTitle)
      .replace('{{buyer_entity}}', form.buyerEntity);

    addDocument({
      id: generateId(),
      entityType: form.dealId ? 'deal' : undefined,
      entityId: form.dealId || undefined,
      documentType: 'loi',
      title: `LOI — ${form.sellerCompany || 'Draft'}`,
      content,
      status: 'draft',
      version: 1,
      source: 'template',
      generatedBy: 'system',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
  }

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Generate LOI Draft" size="lg">
      <div className="space-y-4">
        <div className="bg-[#D9A44115] border border-[#D9A44130] rounded px-3 py-2 text-xs text-[#D9A441]">
          ⚠️ This generates a template draft only. Attorney review is required before any legal use.
        </div>
        {deals.length > 0 && (
          <Select
            label="Link to Deal"
            value={form.dealId}
            onChange={(e) => {
              const deal = deals.find((d) => d.id === e.target.value);
              const company = companies.find((c) => c.id === deal?.companyId);
              setForm((p) => ({
                ...p,
                dealId: e.target.value,
                sellerCompany: deal?.companyName ?? p.sellerCompany,
                sellerName: company?.ownerName ?? p.sellerName,
                purchasePrice: deal?.askingPrice ? String(deal.askingPrice) : p.purchasePrice,
              }));
            }}
            options={[{ value: '', label: '— No deal —' }, ...deals.map((d) => ({ value: d.id, label: d.companyName }))]}
          />
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Buyer Entity" value={form.buyerEntity} onChange={f('buyerEntity')} />
          <Select label="Asset or Equity" value={form.assetOrEquity} onChange={(e) => setForm((p) => ({ ...p, assetOrEquity: e.target.value }))} options={[{ value: 'Asset', label: 'Asset Purchase' }, { value: 'Equity', label: 'Equity Purchase' }]} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Seller Name" value={form.sellerName} onChange={f('sellerName')} placeholder="John Smith" />
          <Input label="Seller Company" value={form.sellerCompany} onChange={f('sellerCompany')} placeholder="Acme Pest Control" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Purchase Price ($)" value={form.purchasePrice} onChange={f('purchasePrice')} type="number" />
          <Input label="Down Payment ($)" value={form.downPayment} onChange={f('downPayment')} type="number" />
          <Input label="Seller Note ($)" value={form.sellerNote} onChange={f('sellerNote')} type="number" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Exclusivity (days)" value={form.exclusivityDays} onChange={f('exclusivityDays')} type="number" />
          <Input label="Due Diligence (days)" value={form.diligenceDays} onChange={f('diligenceDays')} type="number" />
          <Input label="Target Closing Date" value={form.targetClosingDate} onChange={f('targetClosingDate')} type="date" />
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleGenerate}>Generate LOI Draft</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function DocumentView({ doc, onClose }: { doc: Document; onClose: () => void }) {
  function handleDownload() {
    const blob = new Blob([doc.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal open={true} onClose={onClose} title={doc.title} size="xl">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <StatusBadge status={doc.status} />
          <Badge variant="muted" size="sm">{statusLabel(doc.documentType)}</Badge>
          <span className="text-xs text-[#A7A29A]">v{doc.version} · {formatDate(doc.createdAt)}</span>
        </div>
        <pre className="bg-[#0D0D0D] border border-[#2A2A2E] rounded p-4 text-sm text-[#E8E6E3] whitespace-pre-wrap font-sans leading-relaxed max-h-[60vh] overflow-y-auto">
          {doc.content}
        </pre>
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleDownload}>
            <Download size={13} aria-hidden />
            Download
          </Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

export default function DocumentsPage() {
  const documents = useAppStore((s) => s.documents);
  const addDocument = useAppStore((s) => s.addDocument);
  const [showLOI, setShowLOI] = useState(false);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Documents</h1>
          <p className="text-sm text-[#A7A29A] mt-1">{documents.length} documents</p>
        </div>
        <Button variant="primary" onClick={() => setShowLOI(true)}>
          <Plus size={14} aria-hidden />
          Generate LOI
        </Button>
      </header>

      <div className="bg-[#4D7EA815] border border-[#4D7EA840] rounded-md px-4 py-3 text-sm text-[#4D7EA8]">
        All generated documents are template drafts. Attorney review is required before any legal or business use.
      </div>

      {documents.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-12 text-center">
          <FileText size={32} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
          <p className="text-sm text-[#A7A29A] mb-3">No documents yet. Generate your first LOI.</p>
          <Button variant="primary" onClick={() => setShowLOI(true)}>Generate LOI Draft</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div key={doc.id} className="bg-[#141414] border border-[#2A2A2E] rounded-md px-4 py-3 flex items-center justify-between gap-4 hover:border-[#3A3A3E]">
              <div className="flex items-center gap-3 min-w-0">
                <FileText size={16} className="text-[#A7A29A] flex-shrink-0" aria-hidden />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#E8E6E3] truncate">{doc.title}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StatusBadge status={doc.status} />
                    <span className="text-xs text-[#A7A29A]">{statusLabel(doc.documentType)}</span>
                    <span className="text-xs text-[#A7A29A]">{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setViewDoc(doc)}>
                <Eye size={13} aria-hidden />
                View
              </Button>
            </div>
          ))}
        </div>
      )}

      <GenerateLOIModal open={showLOI} onClose={() => setShowLOI(false)} />
      {viewDoc && <DocumentView doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
