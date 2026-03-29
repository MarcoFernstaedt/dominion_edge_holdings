/**
 * Shared UI constants: select options, status configs, and stage colours.
 * Import from here instead of redefining in each page component.
 */

// ─── Company ──────────────────────────────────────────────────────────────────

export const COMPANY_STATUS_OPTIONS = [
  { value: '',               label: 'All Statuses' },
  { value: 'target',         label: 'Target' },
  { value: 'contacted',      label: 'Contacted' },
  { value: 'conversation',   label: 'Conversation' },
  { value: 'interested',     label: 'Interested' },
  { value: 'diligence',      label: 'Diligence' },
  { value: 'under_loi',      label: 'Under LOI' },
  { value: 'under_contract', label: 'Under Contract' },
  { value: 'closed',         label: 'Closed' },
  { value: 'lost',           label: 'Lost' },
  { value: 'archived',       label: 'Archived' },
] as const;

export const PRIORITY_OPTIONS = [
  { value: '',         label: 'All Priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high',     label: 'High' },
  { value: 'medium',   label: 'Medium' },
  { value: 'low',      label: 'Low' },
] as const;

// ─── Board candidates ─────────────────────────────────────────────────────────

export const CANDIDATE_STATUS_OPTIONS = [
  { value: 'identified',        label: 'Identified' },
  { value: 'researched',        label: 'Researched' },
  { value: 'outreach_sent',     label: 'Outreach Sent' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'interested',        label: 'Interested' },
  { value: 'negotiating',       label: 'Negotiating' },
  { value: 'confirmed',         label: 'Confirmed' },
  { value: 'passed',            label: 'Passed' },
] as const;

// ─── Deal pipeline ────────────────────────────────────────────────────────────

export const DEAL_STAGE_COLORS: Record<string, string> = {
  identified:       '#A7A29A',
  contacted:        '#4D7EA8',
  discovery:        '#4D7EA8',
  financial_review: '#D9A441',
  loi_discussion:   '#C9A227',
  loi_signed:       '#C9A227',
  due_diligence:    '#D9A441',
  financing:        '#D9A441',
  closing:          '#3FA66B',
  closed:           '#3FA66B',
  lost:             '#C35B5B',
};

// ─── Meetings ─────────────────────────────────────────────────────────────────

export const MEETING_TYPE_OPTIONS = [
  { value: 'seller_discovery',           label: 'Seller Discovery' },
  { value: 'seller_followup',            label: 'Seller Follow-Up' },
  { value: 'board_intro',                label: 'Board Intro' },
  { value: 'banker_intro',               label: 'Banker Intro' },
  { value: 'attorney_intro',             label: 'Attorney Intro' },
  { value: 'cpa_intro',                  label: 'CPA Intro' },
  { value: 'capital_intro',              label: 'Capital Intro' },
  { value: 'diligence_review',           label: 'Diligence Review' },
  { value: 'post_acquisition_transition',label: 'Post-Acq. Transition' },
  { value: 'internal_planning',          label: 'Internal Planning' },
] as const;

export const MEETING_LOCATION_OPTIONS = [
  { value: 'phone',        label: 'Phone' },
  { value: 'google_meet',  label: 'Google Meet' },
  { value: 'zoom',         label: 'Zoom' },
  { value: 'in_person',    label: 'In Person' },
  { value: 'other',        label: 'Other' },
] as const;

// ─── Investors ────────────────────────────────────────────────────────────────

export const INVESTOR_RELATIONSHIP_STAGE_COLORS: Record<string, string> = {
  cold:             'text-[#A7A29A] bg-[#A7A29A20]',
  aware:            'text-[#4D7EA8] bg-[#4D7EA820]',
  engaged:          'text-[#D9A441] bg-[#D9A44120]',
  relationship:     'text-[#C9A227] bg-[#C9A22720]',
  active_investor:  'text-[#3FA66B] bg-[#3FA66B20]',
};

// ─── Design system colour tokens (for use in JS/TS) ───────────────────────────
// Matches the CSS custom properties in globals.css. Use these wherever you need
// a hex value in JS (e.g. inline style, canvas, charting). Prefer CSS vars in
// className when possible.

export const COLORS = {
  bgPrimary:   '#0A0A0A',
  bgElevated:  '#111111',
  bgCard:      '#141414',
  bgHover:     '#1A1A1A',
  borderSubtle:'#262626',
  borderDefault:'#2A2A2E',
  borderStrong: '#3A3A3E',
  textPrimary:  '#E8E6E3',
  textMuted:    '#A7A29A',
  textDim:      '#737373',
  accent:       '#C9A227',
  success:      '#3FA66B',
  error:        '#C35B5B',
  warning:      '#D9A441',
  info:         '#4D7EA8',
} as const;
