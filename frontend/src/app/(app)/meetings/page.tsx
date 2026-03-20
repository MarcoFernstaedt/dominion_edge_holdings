'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { cn, formatDate, nowIso, generateId } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Calendar, Plus, Clock, CheckCircle, XCircle, AlertTriangle, BookOpen, RefreshCw } from 'lucide-react';
import { meetingPrepApi } from '@/lib/api';
import type { MeetingPrepPacket } from '@/lib/types';
import type { Meeting, MeetingStatus, MeetingType } from '@/lib/types';
import { useFormField } from '@/hooks/useFormField';

const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  seller_discovery: 'Seller Discovery',
  seller_followup: 'Seller Follow-up',
  board_intro: 'Board Intro',
  banker_intro: 'Banker Intro',
  attorney_intro: 'Attorney Intro',
  cpa_intro: 'CPA Intro',
  capital_intro: 'Capital Intro',
  diligence_review: 'Diligence Review',
  post_acquisition_transition: 'Post-Acquisition',
  internal_planning: 'Internal Planning',
};

const DEFAULT_DURATIONS: Record<MeetingType, number> = {
  seller_discovery: 30,
  seller_followup: 20,
  board_intro: 30,
  banker_intro: 30,
  attorney_intro: 30,
  cpa_intro: 30,
  capital_intro: 30,
  diligence_review: 45,
  post_acquisition_transition: 45,
  internal_planning: 30,
};

const AGENDA_TEMPLATES: Record<MeetingType, string[]> = {
  seller_discovery: ['Intro and context', 'Owner background', 'Business overview', 'Customer base', 'Team and operations', 'Financial shape at high level', 'Future plans', 'Next steps'],
  seller_followup: ['Recap of prior conversation', 'Any questions from seller', 'Progress update', 'Next steps'],
  board_intro: ['Intro', 'Dominion Edge overview', 'Seat role and expectations', 'Candidate background', 'Fit discussion', 'Next steps'],
  banker_intro: ['Intro', 'Acquisition criteria', 'Current pipeline', 'Capital and structure discussion', 'Process fit', 'Next steps'],
  attorney_intro: ['Intro', 'Deal strategy', 'Target profile', 'Legal support needs', 'Process expectations', 'Next steps'],
  cpa_intro: ['Intro', 'Target profile', 'Underwriting approach', 'Diligence support needs', 'Reporting expectations', 'Next steps'],
  capital_intro: ['Intro', 'Thesis', 'Target profile', 'Capital role discussion', 'Relationship next steps'],
  diligence_review: ['Outstanding items review', 'Financial document status', 'Legal review status', 'Red flags', 'Timeline and closing steps'],
  post_acquisition_transition: ['Day 1 priorities', 'Operator introduction plan', 'Vendor communication', 'Employee meetings schedule', 'Reporting setup'],
  internal_planning: ['Current status', 'This week priorities', 'Blockers', 'Next actions'],
};

const STATUS_CONFIG: Record<MeetingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Draft', color: '#A7A29A', icon: <Clock size={12} /> },
  proposed: { label: 'Proposed', color: '#D9A441', icon: <Clock size={12} /> },
  awaiting_confirmation: { label: 'Awaiting', color: '#4D7EA8', icon: <Clock size={12} /> },
  confirmed: { label: 'Confirmed', color: '#3FA66B', icon: <CheckCircle size={12} /> },
  scheduled: { label: 'Scheduled', color: '#3FA66B', icon: <Calendar size={12} /> },
  completed: { label: 'Completed', color: '#A7A29A', icon: <CheckCircle size={12} /> },
  cancelled: { label: 'Cancelled', color: '#C35B5B', icon: <XCircle size={12} /> },
  rescheduled: { label: 'Rescheduled', color: '#D9A441', icon: <AlertTriangle size={12} /> },
  no_show: { label: 'No Show', color: '#C35B5B', icon: <XCircle size={12} /> },
};

interface CreateMeetingForm {
  meetingType: MeetingType;
  title: string;
  startsAt: string;
  durationMinutes: number;
  locationType: string;
  locationValue: string;
  notes: string;
  linkedCompanyId: string;
}

function CreateMeetingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addMeeting = useAppStore((s) => s.addMeeting);
  const companies = useAppStore((s) => s.companies);

  const [form, setForm] = useState<CreateMeetingForm>({
    meetingType: 'seller_discovery',
    title: '',
    startsAt: '',
    durationMinutes: 30,
    locationType: 'phone',
    locationValue: '',
    notes: '',
    linkedCompanyId: '',
  });

  const f = useFormField(setForm);

  function handleTypeChange(type: MeetingType) {
    setForm((p) => ({
      ...p,
      meetingType: type,
      durationMinutes: DEFAULT_DURATIONS[type],
      title: p.title || MEETING_TYPE_LABELS[type],
    }));
  }

  function handleCreate() {
    if (!form.startsAt) return;
    const start = new Date(form.startsAt);
    const end = new Date(start.getTime() + form.durationMinutes * 60_000);

    const agendaItems = AGENDA_TEMPLATES[form.meetingType];

    addMeeting({
      id: generateId(),
      meetingType: form.meetingType,
      title: form.title || MEETING_TYPE_LABELS[form.meetingType],
      status: 'draft',
      source: 'manual',
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      durationMinutes: form.durationMinutes,
      locationType: form.locationType as Meeting['locationType'],
      locationValue: form.locationValue,
      linkedCompanyId: form.linkedCompanyId || undefined,
      linkedContactIds: [],
      proposedSlots: [],
      agenda: agendaItems.join('\n'),
      meetingNotes: form.notes,
      followUpTaskCreated: false,
      prepTaskCreated: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule Meeting" size="lg">
      <div className="space-y-4">
        <Select
          label="Meeting Type"
          value={form.meetingType}
          onChange={(e) => handleTypeChange(e.target.value as MeetingType)}
          options={Object.entries(MEETING_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />

        <Input
          label="Title"
          value={form.title}
          onChange={f('title')}
          placeholder={MEETING_TYPE_LABELS[form.meetingType]}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Date & Time"
            type="datetime-local"
            value={form.startsAt}
            onChange={f('startsAt')}
          />
          <Input
            label="Duration (minutes)"
            type="number"
            value={String(form.durationMinutes)}
            onChange={(e) => setForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Location Type"
            value={form.locationType}
            onChange={f('locationType')}
            options={[
              { value: 'phone', label: 'Phone' },
              { value: 'google_meet', label: 'Google Meet' },
              { value: 'zoom', label: 'Zoom' },
              { value: 'in_person', label: 'In Person' },
              { value: 'other', label: 'Other' },
            ]}
          />
          <Input
            label="Location / Link / Phone"
            value={form.locationValue}
            onChange={f('locationValue')}
            placeholder="+1 (555) 000-0000 or https://..."
          />
        </div>

        {companies.length > 0 && (
          <Select
            label="Link to Company"
            value={form.linkedCompanyId}
            onChange={f('linkedCompanyId')}
            options={[
              { value: '', label: '— None —' },
              ...companies.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        )}

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={f('notes')}
          placeholder="Pre-meeting context..."
          rows={3}
        />

        <div className="bg-[#141414] border border-[#2A2A2E] rounded p-3">
          <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-2">Auto-generated agenda</div>
          <ul className="space-y-1">
            {AGENDA_TEMPLATES[form.meetingType].map((item, i) => (
              <li key={i} className="text-xs text-[#A7A29A] flex gap-2">
                <span className="text-[#C9A227] flex-shrink-0">{i + 1}.</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-2 flex-wrap pt-2">
          <Button variant="primary" onClick={handleCreate} disabled={!form.startsAt}>
            Create Meeting
          </Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function PrepPacketSection({ meetingId }: { meetingId: string }) {
  const [packet, setPacket] = useState<MeetingPrepPacket | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    setLoading(true);
    meetingPrepApi.getPacket(meetingId)
      .then((r) => setPacket(r.packet as MeetingPrepPacket | null))
      .catch(() => setPacket(null))
      .finally(() => setLoading(false));
  }, [meetingId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const r = await meetingPrepApi.generatePacket(meetingId);
      setPacket(r.packet as MeetingPrepPacket);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <div className="text-xs text-[#A7A29A]">Loading prep packet…</div>;

  return (
    <div className="border border-[#2A2A2E] rounded-md p-3 bg-[#0D0D0D]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[9px] tracking-widest uppercase text-[#A7A29A] font-medium">
          <BookOpen size={10} aria-hidden />
          Prep Packet
          {packet && (
            <span className="ml-1 text-[#C9A227]">{packet.generationMode === 'ai_assisted' ? '· AI-assisted' : '· Template'}</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={generate}
          disabled={generating}
          aria-label={packet ? 'Regenerate prep packet' : 'Generate prep packet'}
        >
          <RefreshCw size={10} className={cn('mr-1', generating && 'animate-spin')} aria-hidden />
          {generating ? 'Generating…' : packet ? 'Regenerate' : 'Generate Prep'}
        </Button>
      </div>

      {!packet && !generating && (
        <p className="text-xs text-[#A7A29A]">No prep packet yet. Generate one to get agenda, key questions, and risk flags.</p>
      )}

      {packet && (
        <div className="space-y-3">
          {/* Objectives */}
          {packet.meetingObjectives.length > 0 && (
            <div>
              <div className="text-[9px] text-[#C9A227] uppercase tracking-wide mb-1">Objectives</div>
              <ol className="space-y-0.5">
                {packet.meetingObjectives.map((obj, i) => (
                  <li key={i} className="text-xs text-[#E8E6E3] flex gap-1.5">
                    <span className="text-[#C9A227] flex-shrink-0">{i + 1}.</span>
                    {obj}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {showFull && (
            <>
              {/* Agenda */}
              {packet.agenda.length > 0 && (
                <div>
                  <div className="text-[9px] text-[#A7A29A] uppercase tracking-wide mb-1">Agenda</div>
                  <ol className="space-y-0.5">
                    {packet.agenda.map((a, i) => (
                      <li key={i} className="text-xs text-[#A7A29A] flex gap-1.5">
                        <span className="flex-shrink-0">{i + 1}.</span>{a}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Key Questions */}
              {packet.keyQuestions.length > 0 && (
                <div>
                  <div className="text-[9px] text-[#A7A29A] uppercase tracking-wide mb-1">Key Questions</div>
                  <ul className="space-y-0.5">
                    {packet.keyQuestions.map((q, i) => (
                      <li key={i} className="text-xs text-[#E8E6E3] flex gap-1.5">
                        <span className="text-[#A7A29A] flex-shrink-0">·</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk Flags */}
              {packet.riskFlags.length > 0 && (
                <div>
                  <div className="text-[9px] text-[#C35B5B] uppercase tracking-wide mb-1">Risk Flags</div>
                  <ul className="space-y-0.5">
                    {packet.riskFlags.map((r, i) => (
                      <li key={i} className="text-xs text-[#C35B5B] flex gap-1.5">
                        <AlertTriangle size={9} className="flex-shrink-0 mt-0.5" aria-hidden />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Hypotheses */}
              {packet.motivationHypotheses.length > 0 && (
                <div>
                  <div className="text-[9px] text-[#A7A29A] uppercase tracking-wide mb-1">Motivation Hypotheses</div>
                  <ul className="space-y-0.5">
                    {packet.motivationHypotheses.map((h, i) => (
                      <li key={i} className="text-xs text-[#A7A29A] italic flex gap-1.5">
                        <span className="flex-shrink-0">·</span>{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {packet.recommendedNextStepTargets.length > 0 && (
                <div>
                  <div className="text-[9px] text-[#3FA66B] uppercase tracking-wide mb-1">Next Step Targets</div>
                  <ul className="space-y-0.5">
                    {packet.recommendedNextStepTargets.map((s, i) => (
                      <li key={i} className="text-xs text-[#E8E6E3] flex gap-1.5">
                        <span className="text-[#3FA66B] flex-shrink-0">→</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <button
            className="text-xs text-[#4D7EA8] hover:text-[#7EB0D4] underline"
            onClick={() => setShowFull((s) => !s)}
            aria-expanded={showFull}
            aria-controls="prep-full-content"
          >
            {showFull ? 'Show less' : 'Show full prep packet'}
          </button>
        </div>
      )}
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const updateMeeting = useAppStore((s) => s.updateMeeting);
  const companies = useAppStore((s) => s.companies);
  const tasks = useAppStore((s) => s.tasks);
  const addTask = useAppStore((s) => s.addTask);
  const [expanded, setExpanded] = useState(false);

  const statusCfg = STATUS_CONFIG[meeting.status];
  const company = meeting.linkedCompanyId
    ? companies.find((c) => c.id === meeting.linkedCompanyId)
    : null;

  function advance(status: MeetingStatus) {
    updateMeeting(meeting.id, { status, updatedAt: nowIso() });

    // Create prep task when meeting becomes confirmed/scheduled
    if ((status === 'confirmed' || status === 'scheduled') && !meeting.prepTaskCreated) {
      addTask({
        id: generateId(),
        title: `Prepare for: ${meeting.title}`,
        description: meeting.agenda ? `Agenda:\n${meeting.agenda}` : '',
        status: 'todo',
        priority: 'high',
        dueDate: new Date(new Date(meeting.startsAt).getTime() - 3600_000).toISOString(), // 1hr before
        linkedEntityType: 'meeting',
        linkedEntityId: meeting.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      updateMeeting(meeting.id, { prepTaskCreated: true });
    }

    // Create follow-up task when meeting completed
    if (status === 'completed' && !meeting.followUpTaskCreated) {
      addTask({
        id: generateId(),
        title: `Send follow-up after: ${meeting.title}`,
        status: 'todo',
        priority: 'high',
        dueDate: new Date(new Date(meeting.endsAt).getTime() + 24 * 3600_000).toISOString(),
        linkedEntityType: 'meeting',
        linkedEntityId: meeting.id,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
      updateMeeting(meeting.id, { followUpTaskCreated: true });
    }
  }

  const START_STATUS_FLOW: Partial<Record<MeetingStatus, MeetingStatus>> = {
    draft: 'confirmed',
    confirmed: 'scheduled',
    scheduled: 'completed',
  };
  const nextStatus = START_STATUS_FLOW[meeting.status];

  const nextStatusLabels: Partial<Record<MeetingStatus, string>> = {
    draft: 'Mark Confirmed',
    confirmed: 'Mark Scheduled',
    scheduled: 'Mark Complete',
  };

  return (
    <article className="bg-[#141414] border border-[#2A2A2E] rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start justify-between p-4 text-left hover:bg-[#1B1B1D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]"
        aria-expanded={expanded}
        aria-controls={`meeting-${meeting.id}-detail`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span style={{ color: statusCfg.color }} className="flex-shrink-0 mt-0.5" aria-hidden>
            {statusCfg.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[#E8E6E3] truncate">{meeting.title}</div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs text-[#A7A29A]">{MEETING_TYPE_LABELS[meeting.meetingType]}</span>
              {company && <span className="text-xs text-[#A7A29A]">· {company.name}</span>}
              <span className="text-xs text-[#C9A227]">
                {new Date(meeting.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' '}
                {new Date(meeting.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </span>
              <span className="text-xs text-[#A7A29A]">{meeting.durationMinutes}min</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded"
            style={{ color: statusCfg.color, border: `1px solid ${statusCfg.color}40` }}
          >
            {statusCfg.label}
          </span>
          <span className="text-xs text-[#A7A29A]">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div id={`meeting-${meeting.id}-detail`} className="border-t border-[#2A2A2E] p-4 space-y-4">
          {/* Location */}
          {meeting.locationValue && (
            <div>
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Location</div>
              <div className="text-sm text-[#E8E6E3]">{meeting.locationType?.replace(/_/g, ' ')} · {meeting.locationValue}</div>
            </div>
          )}

          {/* Agenda */}
          {meeting.agenda && (
            <div>
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-2">Agenda</div>
              <ol className="space-y-1">
                {meeting.agenda.split('\n').filter(Boolean).map((item, i) => (
                  <li key={i} className="text-xs text-[#A7A29A] flex gap-2">
                    <span className="text-[#C9A227] flex-shrink-0">{i + 1}.</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Notes */}
          {meeting.meetingNotes && (
            <div>
              <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">Notes</div>
              <p className="text-xs text-[#A7A29A]">{meeting.meetingNotes}</p>
            </div>
          )}

          {/* Prep Packet */}
          <PrepPacketSection meetingId={meeting.id} />

          {/* Task status indicators */}
          <div className="flex gap-4 flex-wrap">
            <span className={cn('text-xs', meeting.prepTaskCreated ? 'text-[#3FA66B]' : 'text-[#A7A29A]')}>
              {meeting.prepTaskCreated ? '✓ Prep task created' : '— No prep task yet'}
            </span>
            <span className={cn('text-xs', meeting.followUpTaskCreated ? 'text-[#3FA66B]' : 'text-[#A7A29A]')}>
              {meeting.followUpTaskCreated ? '✓ Follow-up task created' : '— No follow-up task yet'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-1">
            {nextStatus && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => advance(nextStatus)}
              >
                {nextStatusLabels[meeting.status]}
              </Button>
            )}
            {meeting.status !== 'cancelled' && meeting.status !== 'completed' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateMeeting(meeting.id, { status: 'cancelled', updatedAt: nowIso() })}
              >
                Cancel Meeting
              </Button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

export default function MeetingsPage() {
  const meetings = useAppStore((s) => s.meetings);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'upcoming' | 'completed'>('upcoming');

  const now = new Date();

  const filtered = meetings.filter((m) => {
    if (filterStatus === 'upcoming') {
      return !['completed', 'cancelled'].includes(m.status);
    }
    if (filterStatus === 'completed') {
      return ['completed', 'cancelled'].includes(m.status);
    }
    return true;
  }).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const upcoming = meetings.filter((m) => new Date(m.startsAt) > now && !['completed', 'cancelled'].includes(m.status));
  const todayMeetings = upcoming.filter((m) => {
    const d = new Date(m.startsAt);
    return d.toDateString() === now.toDateString();
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#E8E6E3]">Meetings</h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            {upcoming.length} upcoming · {todayMeetings.length} today
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} aria-hidden />
          <span className="hidden sm:inline">Schedule Meeting</span>
          <span className="sm:hidden">New</span>
        </Button>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Today', value: todayMeetings.length, color: '#C9A227' },
          { label: 'This Week', value: upcoming.filter((m) => (new Date(m.startsAt).getTime() - now.getTime()) < 7 * 86400000).length, color: '#C9A227' },
          { label: 'Confirmed', value: meetings.filter((m) => m.status === 'confirmed' || m.status === 'scheduled').length, color: '#3FA66B' },
          { label: 'Completed', value: meetings.filter((m) => m.status === 'completed').length, color: '#A7A29A' },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#141414] border border-[#2A2A2E] rounded-md p-3 sm:p-4">
            <div className="text-[9px] tracking-widest uppercase text-[#A7A29A] mb-1">{stat.label}</div>
            <div className="text-xl sm:text-2xl font-bold font-serif" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[#141414] border border-[#2A2A2E] rounded p-1 w-fit" role="tablist" aria-label="Meeting filter">
        {([['upcoming', 'Upcoming'], ['completed', 'Past'], ['all', 'All']] as const).map(([val, label]) => (
          <button
            key={val}
            role="tab"
            aria-selected={filterStatus === val}
            onClick={() => setFilterStatus(val)}
            className={cn(
              'px-3 py-1.5 text-xs rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]',
              filterStatus === val ? 'bg-[#C9A227] text-black font-semibold' : 'text-[#A7A29A] hover:text-[#E8E6E3]'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Meeting list */}
      {filtered.length === 0 ? (
        <div className="bg-[#141414] border border-[#2A2A2E] rounded-md p-8 sm:p-12 text-center">
          <Calendar size={32} className="mx-auto text-[#A7A29A] mb-3" aria-hidden />
          <p className="text-sm text-[#A7A29A] mb-3">
            {filterStatus === 'upcoming' ? 'No upcoming meetings. Schedule your first.' : 'No meetings in this view.'}
          </p>
          {filterStatus === 'upcoming' && (
            <Button variant="primary" onClick={() => setShowCreate(true)}>Schedule Meeting</Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <MeetingCard key={m.id} meeting={m} />
          ))}
        </div>
      )}

      <CreateMeetingModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
