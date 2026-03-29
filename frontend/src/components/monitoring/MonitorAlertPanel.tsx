'use client';

/**
 * MonitorAlertPanel
 *
 * Displays monitoring alerts for a specific entity (company, deal, contact)
 * with actions: mark read, dismiss, convert to task.
 *
 * Also handles registering the entity for monitoring.
 */

import { useState, useEffect, useCallback } from 'react';
import { monitoringApi } from '@/lib/api';
import type { MonitorEvent, MonitoredEntity } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Props {
  entityType: 'company' | 'deal' | 'contact';
  entityId: string;
  displayName: string;
  website?: string;
  linkedinUrl?: string;
}

const SEVERITY_STYLES: Record<string, string> = {
  critical:  'bg-red-900/40 border-red-700 text-red-300',
  important: 'bg-orange-900/30 border-orange-700 text-orange-300',
  watch:     'bg-yellow-900/20 border-yellow-700 text-yellow-300',
  info:      'bg-slate-800 border-slate-600 text-slate-300',
};

const SEVERITY_BADGE: Record<string, string> = {
  critical:  'bg-red-700 text-white',
  important: 'bg-orange-600 text-white',
  watch:     'bg-yellow-600 text-black',
  info:      'bg-slate-600 text-white',
};

const SIGNAL_LABELS: Record<string, string> = {
  website_change:   'Website Changed',
  review_drop:      'Review Drop',
  ownership_change: 'Ownership Change',
  job_posting:      'Job Postings',
  legal_mention:    'Legal / Regulatory',
  domain_issue:     'Domain Issue',
  local_presence:   'Local Presence',
};

export default function MonitorAlertPanel({ entityType, entityId, displayName, website, linkedinUrl }: Props) {
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [entity, setEntity] = useState<MonitoredEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, entitiesRes] = await Promise.all([
        monitoringApi.alertsByEntity(entityType, entityId),
        monitoringApi.listEntities(),
      ]);
      setEvents(alertsRes.events);
      const found = entitiesRes.entities.find(
        (e) => e.entityType === entityType && e.entityId === entityId
      );
      setEntity(found ?? null);
    } catch {
      setError('Failed to load monitoring data.');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  async function handleRegister() {
    setRegistering(true);
    try {
      const res = await monitoringApi.registerEntity({ entityType, entityId, displayName, website, linkedinUrl });
      setEntity(res.entity);
    } catch {
      setError('Failed to enable monitoring.');
    } finally {
      setRegistering(false);
    }
  }

  async function handleMarkRead(eventId: string) {
    await monitoringApi.markRead(eventId);
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, reviewState: 'read' } : e));
  }

  async function handleDismiss(eventId: string) {
    await monitoringApi.dismiss(eventId);
    setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, reviewState: 'dismissed' } : e));
  }

  async function handleConvertTask(eventId: string, title: string) {
    try {
      await monitoringApi.convertToTask(eventId, { taskTitle: title });
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, reviewState: 'converted_task' } : e));
    } catch {
      setError('Failed to create task.');
    }
  }

  async function handleTriggerCheck() {
    if (!entity) return;
    try {
      await monitoringApi.triggerCheck(entity.id);
      setTimeout(load, 3000); // reload after a brief delay
    } catch {
      setError('Failed to trigger check.');
    }
  }

  const visibleEvents = events.filter((e) =>
    showDismissed ? true : e.reviewState !== 'dismissed'
  );

  const unread = events.filter((e) => e.reviewState === 'unread').length;

  if (loading) {
    return <div className="py-8 text-center text-sm text-[#A7A29A]">Loading monitoring data…</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded p-3 text-sm text-red-300">{error}</div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-[#E8E6E3]">Monitoring</h3>
          {unread > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#C9A227] text-[10px] font-bold text-black">
              {unread}
            </span>
          )}
          {entity && (
            <span className={`text-xs px-1.5 py-0.5 rounded ${entity.enabled ? 'bg-green-900/40 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
              {entity.enabled ? 'Active' : 'Paused'}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {entity && (
            <Button variant="ghost" size="sm" onClick={handleTriggerCheck}>
              Check Now
            </Button>
          )}
          {!entity && (
            <Button variant="outline" size="sm" onClick={handleRegister} disabled={registering}>
              {registering ? 'Enabling…' : 'Enable Monitoring'}
            </Button>
          )}
        </div>
      </div>

      {/* Not yet registered */}
      {!entity && !loading && (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-6 text-center">
          <p className="text-sm text-[#A7A29A] mb-1">Monitoring is not yet enabled for this target.</p>
          <p className="text-xs text-[#6B6762]">Enable it to receive website, domain, and job posting alerts automatically.</p>
        </div>
      )}

      {/* Event list */}
      {entity && visibleEvents.length === 0 && (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-6 text-center">
          <p className="text-sm text-[#A7A29A]">No signals detected yet.</p>
          <p className="text-xs text-[#6B6762] mt-1">
            {entity.lastCheckedAt
              ? `Last checked ${new Date(entity.lastCheckedAt).toLocaleDateString()}`
              : 'First check will run shortly.'}
          </p>
        </div>
      )}

      {entity && visibleEvents.length > 0 && (
        <div className="space-y-2">
          {visibleEvents.map((event) => (
            <div
              key={event.id}
              className={`border rounded-md p-3 transition-opacity ${SEVERITY_STYLES[event.severity] ?? SEVERITY_STYLES.info} ${
                event.reviewState === 'dismissed' || event.reviewState === 'converted_task' ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${SEVERITY_BADGE[event.severity] ?? SEVERITY_BADGE.info}`}>
                    {event.severity}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-current opacity-70">
                    {SIGNAL_LABELS[event.signalType] ?? event.signalType}
                  </span>
                  {event.reviewState === 'unread' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] inline-block" aria-label="Unread" />
                  )}
                </div>
                <span className="text-[10px] opacity-60 whitespace-nowrap flex-shrink-0">
                  {new Date(event.detectedAt).toLocaleDateString()}
                </span>
              </div>

              <p className="text-xs font-medium mb-0.5">{event.title}</p>
              <p className="text-xs opacity-80 mb-1">{event.summary}</p>

              {event.sourceSnippet && (
                <blockquote className="text-[11px] opacity-60 border-l-2 border-current pl-2 mb-1 italic">
                  {event.sourceSnippet.slice(0, 160)}
                </blockquote>
              )}

              {event.aiExplanation && (
                <p className="text-[11px] opacity-75 mb-1">
                  <span className="font-semibold">Why it matters: </span>{event.aiExplanation}
                </p>
              )}
              {event.aiNextAction && (
                <p className="text-[11px] opacity-75 mb-2">
                  <span className="font-semibold">Suggested: </span>{event.aiNextAction}
                </p>
              )}

              {/* Actions */}
              {event.reviewState === 'unread' && (
                <div className="flex gap-1.5 flex-wrap mt-1">
                  <button
                    onClick={() => handleMarkRead(event.id)}
                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    Mark Read
                  </button>
                  <button
                    onClick={() => handleConvertTask(event.id, event.title)}
                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    → Task
                  </button>
                  <button
                    onClick={() => handleDismiss(event.id)}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {event.reviewState === 'read' && (
                <div className="flex gap-1.5 mt-1">
                  <button
                    onClick={() => handleConvertTask(event.id, event.title)}
                    className="text-[10px] px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    → Task
                  </button>
                  <button
                    onClick={() => handleDismiss(event.id)}
                    className="text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors opacity-60"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {event.reviewState === 'converted_task' && (
                <span className="text-[10px] opacity-50">Task created</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Show/hide dismissed */}
      {entity && events.some((e) => e.reviewState === 'dismissed') && (
        <button
          onClick={() => setShowDismissed((p) => !p)}
          className="text-xs text-[#A7A29A] hover:text-[#E8E6E3] transition-colors"
        >
          {showDismissed ? 'Hide dismissed' : `Show ${events.filter(e => e.reviewState === 'dismissed').length} dismissed`}
        </button>
      )}

      {/* Last checked info */}
      {entity && (
        <div className="text-[10px] text-[#6B6762]">
          {entity.lastCheckedAt
            ? `Last checked ${new Date(entity.lastCheckedAt).toLocaleString()}`
            : 'Not yet checked'}
        </div>
      )}
    </div>
  );
}
