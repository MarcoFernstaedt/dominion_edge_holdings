'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, X, CheckCheck, AlertCircle, AlertTriangle, Info, Eye, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { notificationsApi, type Notification } from '@/lib/api';

// ─── Severity icon + color mapping ───────────────────────────────────────────

function SeverityIcon({ severity }: { severity: Notification['severity'] }) {
  if (severity === 'critical') return <AlertCircle size={12} className="text-red-400 flex-shrink-0" aria-hidden />;
  if (severity === 'important') return <AlertTriangle size={12} className="text-[#C9A227] flex-shrink-0" aria-hidden />;
  if (severity === 'watch') return <Eye size={12} className="text-blue-400 flex-shrink-0" aria-hidden />;
  return <Info size={12} className="text-[#737373] flex-shrink-0" aria-hidden />;
}

function severityBorder(severity: Notification['severity']) {
  if (severity === 'critical')  return 'border-l-red-500';
  if (severity === 'important') return 'border-l-[#C9A227]';
  if (severity === 'watch')     return 'border-l-blue-500';
  return 'border-l-[#2A2A2E]';
}

function formatAge(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── NotificationsPanel ───────────────────────────────────────────────────────

export function NotificationsPanel() {
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const panelRef                      = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read_at && !n.dismissed_at).length;
  const critical = notifications.filter((n) => n.severity === 'critical' && !n.dismissed_at).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Load notifications when panel opens
  useEffect(() => {
    if (!open) return;
    load();
  }, [open]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await notificationsApi.list();
      setNotifications(data.notifications.filter((n) => !n.dismissed_at));
    } catch {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    } catch { /* silent */ }
  }

  async function handleDismiss(id: string) {
    try {
      await notificationsApi.dismiss(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    } catch { /* silent */ }
  }

  // Sort: critical pinned first, then by recency
  const sorted = [...notifications].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const sa = a.severity === 'critical' ? 0 : a.severity === 'important' ? 1 : a.severity === 'watch' ? 2 : 3;
    const sb = b.severity === 'critical' ? 0 : b.severity === 'important' ? 1 : b.severity === 'watch' ? 2 : 3;
    if (sa !== sb) return sa - sb;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative flex items-center justify-center w-7 h-7 rounded-[7px]',
          'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A]',
          'transition-colors duration-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]',
          open && 'bg-[#1A1A1A] text-[#E5E5E5]'
        )}
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={13} aria-hidden />
        {unread > 0 && (
          <span
            className={cn(
              'absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full',
              critical > 0 ? 'bg-red-500' : 'bg-[#C9A227]'
            )}
            aria-hidden="true"
          />
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className={cn(
            'absolute right-0 top-9 z-50',
            'w-[360px] max-h-[520px] flex flex-col',
            'bg-[#111111] border border-[#262626] rounded-[10px] shadow-2xl',
            'overflow-hidden'
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#262626] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-[#E8E6E3]">Notifications</span>
              {unread > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A22720] text-[#C9A227]">
                  {unread}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-[#737373] hover:text-[#E5E5E5] rounded transition-colors"
                  title="Mark all as read"
                >
                  <CheckCheck size={11} aria-hidden />
                  All read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-6 h-6 rounded text-[#737373] hover:text-[#E5E5E5] hover:bg-[#1A1A1A] transition-colors"
                aria-label="Close notifications"
              >
                <X size={12} aria-hidden />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-4 py-8 text-center text-xs text-[#737373]">Loading…</div>
            )}
            {error && !loading && (
              <div className="px-4 py-8 text-center text-xs text-red-400">{error}</div>
            )}
            {!loading && !error && sorted.length === 0 && (
              <div className="px-4 py-10 text-center">
                <Bell size={24} className="mx-auto text-[#3A3A3E] mb-2" aria-hidden />
                <p className="text-xs text-[#737373]">No notifications</p>
              </div>
            )}
            {!loading && !error && sorted.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex gap-3 px-4 py-3 border-b border-[#1A1A1A] border-l-[3px]',
                  severityBorder(n.severity),
                  n.read_at ? 'opacity-60' : 'bg-[#141414]',
                  'hover:bg-[#1A1A1A] transition-colors group'
                )}
              >
                <div className="mt-0.5">
                  <SeverityIcon severity={n.severity} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-xs font-medium leading-tight', n.read_at ? 'text-[#737373]' : 'text-[#E8E6E3]')}>
                      {n.title}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read_at && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="p-0.5 text-[#737373] hover:text-[#E5E5E5] transition-colors"
                          title="Mark as read"
                        >
                          <CheckCheck size={11} aria-hidden />
                        </button>
                      )}
                      <button
                        onClick={() => handleDismiss(n.id)}
                        className="p-0.5 text-[#737373] hover:text-[#E5E5E5] transition-colors"
                        title="Dismiss"
                      >
                        <X size={11} aria-hidden />
                      </button>
                    </div>
                  </div>
                  {n.body && (
                    <p className="text-[11px] text-[#737373] mt-0.5 leading-snug line-clamp-2">{n.body}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-[#555555]">{formatAge(n.createdAt)}</span>
                    {n.pinned && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-[#C9A22715] text-[#C9A227] uppercase tracking-wide">Pinned</span>
                    )}
                    {n.action_label && n.action_url && (
                      <a
                        href={n.action_url}
                        className="text-[10px] text-[#C9A227] hover:underline flex items-center gap-0.5"
                        onClick={() => setOpen(false)}
                      >
                        {n.action_label}
                        <ExternalLink size={9} aria-hidden />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {sorted.length > 0 && (
            <div className="px-4 py-2 border-t border-[#262626] flex-shrink-0">
              <p className="text-[10px] text-[#555555] text-center">
                {sorted.length} notification{sorted.length !== 1 ? 's' : ''} · Pinned alerts stay until resolved
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
