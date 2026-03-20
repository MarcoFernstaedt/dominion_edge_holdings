'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, generateId, nowIso, formatRelativeDate, truncate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Mail, Plus, Filter, Search, AlertCircle, Clock, CheckCheck } from 'lucide-react';
import type { EmailThread } from '@/lib/types';
import { useFormField } from '@/hooks/useFormField';

const THREAD_TYPES = [
  { value: '', label: 'All Threads' },
  { value: 'needs_reply', label: 'Needs Reply' },
  { value: 'unread', label: 'Unread' },
  { value: 'waiting', label: 'Waiting on Them' },
];

function ComposeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addEmailThread = useAppStore((s) => s.addEmailThread);
  const companies = useAppStore((s) => s.companies);
  const contacts = useAppStore((s) => s.contacts);

  const [form, setForm] = useState({
    to: '',
    subject: '',
    body: '',
    companyId: '',
    contactId: '',
    scheduledFor: '',
  });

  function handleSend() {
    if (!form.to.trim() || !form.subject.trim()) return;
    const company = companies.find((c) => c.id === form.companyId);
    const contact = contacts.find((c) => c.id === form.contactId);

    addEmailThread({
      id: generateId(),
      subject: form.subject.trim(),
      participants: [form.to],
      primaryCompanyId: form.companyId || undefined,
      primaryCompanyName: company?.name,
      primaryContactId: form.contactId || undefined,
      primaryContactName: contact?.fullName,
      inboxStatus: 'read',
      lastMessageAt: nowIso(),
      lastOutboundAt: nowIso(),
      requiresReply: false,
      isSuppressed: false,
      tags: [],
      preview: truncate(form.body, 120),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
    setForm({ to: '', subject: '', body: '', companyId: '', contactId: '', scheduledFor: '' });
    const announcer = document.getElementById('status-announcer');
    if (announcer) announcer.textContent = 'Email sent (simulated)';
  }

  const f = useFormField(setForm);

  return (
    <Modal open={open} onClose={onClose} title="Compose Email" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="To *" value={form.to} onChange={f('to')} placeholder="owner@example.com" autoFocus />
          <Input label="Subject *" value={form.subject} onChange={f('subject')} placeholder="Regarding [Company Name]..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Link Company"
            value={form.companyId}
            onChange={(e) => setForm((p) => ({ ...p, companyId: e.target.value }))}
            options={[{ value: '', label: '— No company —' }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
          />
          <Select
            label="Link Contact"
            value={form.contactId}
            onChange={(e) => setForm((p) => ({ ...p, contactId: e.target.value }))}
            options={[{ value: '', label: '— No contact —' }, ...contacts.map((c) => ({ value: c.id, label: c.fullName }))]}
          />
        </div>
        <Textarea
          label="Message *"
          value={form.body}
          onChange={f('body')}
          rows={8}
          placeholder="Compose your message..."
        />
        <div className="bg-[#D9A44115] border border-[#D9A44130] rounded px-3 py-2 text-xs text-[#D9A441]">
          ⚠ Email sending requires SMTP configuration in Settings. This will be logged as a sent thread.
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="primary" onClick={handleSend}>Send Email</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function ThreadRow({ thread }: { thread: EmailThread }) {
  const updateThread = useAppStore((s) => s.updateEmailThread);
  const isUnread = thread.inboxStatus === 'unread';
  const needsReply = thread.requiresReply;

  return (
    <div className={cn(
      'flex items-start gap-3 px-4 py-3.5 border-b border-[#2A2A2E] hover:bg-[#1B1B1D] cursor-pointer transition-colors',
      isUnread && 'bg-[#C9A22705]'
    )}>
      <div className="flex-shrink-0 mt-0.5">
        {needsReply ? (
          <AlertCircle size={16} className="text-[#D9A441]" aria-label="Needs reply" />
        ) : (
          <Mail size={16} className={isUnread ? 'text-[#C9A227]' : 'text-[#A7A29A]'} aria-hidden />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm truncate', isUnread ? 'font-semibold text-[#E8E6E3]' : 'text-[#E8E6E3]')}>
              {thread.participants[0] ?? 'Unknown'}
            </span>
            {thread.primaryCompanyName && (
              <Badge variant="muted" size="sm">{thread.primaryCompanyName}</Badge>
            )}
          </div>
          <span className="text-xs text-[#A7A29A] flex-shrink-0">{formatRelativeDate(thread.lastMessageAt)}</span>
        </div>
        <div className={cn('text-sm truncate', isUnread ? 'text-[#E8E6E3]' : 'text-[#A7A29A]')}>
          {thread.subject}
        </div>
        {thread.preview && (
          <div className="text-xs text-[#A7A29A] truncate mt-0.5">{thread.preview}</div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {needsReply && <Badge variant="warning" size="sm">Needs Reply</Badge>}
          {thread.inboxStatus === 'waiting' && <Badge variant="info" size="sm">Waiting on Them</Badge>}
          {thread.followUpDate && (
            <Badge variant="muted" size="sm">
              <Clock size={9} className="mr-1" aria-hidden />
              Follow-up
            </Badge>
          )}
          {thread.tags.map((tag) => <Badge key={tag} variant="muted" size="sm">{tag}</Badge>)}
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={() => updateThread(thread.id, { requiresReply: !thread.requiresReply })}
          className="text-xs text-[#A7A29A] hover:text-[#D9A441] px-1 py-0.5 rounded transition-colors"
          aria-label={thread.requiresReply ? 'Remove needs-reply flag' : 'Mark as needs reply'}
        >
          {thread.requiresReply ? '✓Reply' : 'Reply?'}
        </button>
      </div>
    </div>
  );
}

export default function InboxPage() {
  const emailThreads = useAppStore((s) => s.emailThreads);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showCompose, setShowCompose] = useState(false);

  const filtered = emailThreads.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || t.subject.toLowerCase().includes(q) || t.participants.some((p) => p.toLowerCase().includes(q)) || (t.primaryCompanyName || '').toLowerCase().includes(q);
    const matchesFilter =
      !filter ||
      (filter === 'needs_reply' && t.requiresReply) ||
      (filter === 'unread' && t.inboxStatus === 'unread') ||
      (filter === 'waiting' && t.inboxStatus === 'waiting');
    return matchesSearch && matchesFilter && !t.isSuppressed;
  }).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const needsReplyCount = emailThreads.filter((t) => t.requiresReply && !t.isSuppressed).length;
  const unreadCount = emailThreads.filter((t) => t.inboxStatus === 'unread' && !t.isSuppressed).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#E8E6E3]">Inbox</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            {needsReplyCount > 0 && `${needsReplyCount} needs reply · `}
            {unreadCount > 0 && `${unreadCount} unread · `}
            {emailThreads.length} total threads
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCompose(true)}>
          <Plus size={14} aria-hidden />
          Compose
        </Button>
      </header>

      {/* SMTP notice */}
      <div className="bg-[#4D7EA815] border border-[#4D7EA840] rounded-md px-4 py-3 text-sm text-[#4D7EA8]">
        Configure SMTP and IMAP in <a href="/settings" className="underline hover:text-[#6B9EC0]">Settings</a> to sync your real inbox. Threads created here are logged locally.
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A7A29A]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inbox..."
            className="w-full bg-[#1B1B1D] border border-[#2A2A2E] rounded text-sm text-[#E8E6E3] pl-8 pr-3 py-2 focus:outline-none focus:border-[#C9A227] placeholder:text-[#A7A29A60]"
            aria-label="Search inbox"
          />
        </div>
        <div className="flex border border-[#2A2A2E] rounded overflow-hidden" role="group" aria-label="Filter threads">
          {THREAD_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFilter(t.value)}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                filter === t.value ? 'bg-[#C9A227] text-black font-semibold' : 'text-[#A7A29A] hover:text-[#E8E6E3]'
              )}
              aria-pressed={filter === t.value}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-12 text-center">
          <Mail size={32} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
          <p className="text-sm text-[#A7A29A]">
            {emailThreads.length === 0 ? 'No emails yet. Compose your first email above.' : 'No threads match your filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden" role="list" aria-label="Email threads">
          {filtered.map((thread) => (
            <div key={thread.id} role="listitem">
              <ThreadRow thread={thread} />
            </div>
          ))}
        </div>
      )}

      <ComposeModal open={showCompose} onClose={() => setShowCompose(false)} />
    </div>
  );
}
