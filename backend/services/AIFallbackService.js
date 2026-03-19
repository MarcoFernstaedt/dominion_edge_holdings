/**
 * AIFallbackService — deterministic (non-AI) fallbacks for every major task type.
 *
 * When both Anthropic and OpenAI fail, these builders produce structured,
 * useful output from raw record data. The platform must never return an empty
 * panel — degraded UX should still be actionable.
 *
 * Contract:
 *   buildFallback(taskType, context) → { content, confidence: 'low', fallback: true }
 *
 * Each builder returns valid content shaped like the AI output would be,
 * marked with a degraded_mode flag so the UI can render an appropriate badge.
 */

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Build a deterministic fallback for the given task type.
 *
 * @param {string} taskType   — from TASK_TIERS / TASK_TTL_MAP
 * @param {object} context    — raw entity records, enriched by caller
 * @returns {{ content: object, confidence: 'low', fallback: true, fallback_reason: string }}
 */
export function buildFallback(taskType, context = {}) {
  const builder = FALLBACK_BUILDERS[taskType] ?? FALLBACK_BUILDERS._default;
  const content = builder(context);

  return {
    content,
    confidence:      'low',
    fallback:        true,
    fallback_reason: `AI unavailable; deterministic fallback applied for task_type=${taskType}`,
  };
}

/**
 * Returns true if a deterministic fallback exists for this task type.
 */
export function hasFallback(taskType) {
  return taskType in FALLBACK_BUILDERS || '_default' in FALLBACK_BUILDERS;
}

// ─── Fallback builders ────────────────────────────────────────────────────────

const FALLBACK_BUILDERS = {

  // ── Classification tasks ───────────────────────────────────────────────────

  document_classification(ctx) {
    const { fileName = '', mimeType = '', fileSize = 0 } = ctx;
    const ext = (fileName.split('.').pop() ?? '').toLowerCase();
    const category = _classifyByExtension(ext, mimeType);
    return {
      category,
      subcategory:    null,
      confidence:     0.3,
      reasoning:      `Classified by file extension (${ext}) — AI unavailable`,
      degraded_mode:  true,
    };
  },

  contact_classification(ctx) {
    const { email = '', title = '', company = '' } = ctx;
    const domain = email.split('@')[1] ?? '';
    const role   = _inferRoleFromTitle(title);
    return {
      classification: role,
      tier:           _tierFromRole(role),
      domain,
      company,
      confidence:     0.25,
      reasoning:      `Inferred from title "${title}" — AI unavailable`,
      degraded_mode:  true,
    };
  },

  field_extraction(ctx) {
    const { rawText = '' } = ctx;
    return {
      extracted_fields: {},
      raw_text_preview: rawText.slice(0, 200),
      confidence:       0.1,
      note:             'Field extraction requires AI — returning raw text preview only',
      degraded_mode:    true,
    };
  },

  metadata_normalization(ctx) {
    return {
      normalized: ctx,
      changes:    [],
      note:       'Normalization skipped — AI unavailable; original data passed through',
      degraded_mode: true,
    };
  },

  // ── Outreach drafts ────────────────────────────────────────────────────────

  outreach_draft(ctx) {
    const { recipientName = 'there', senderName = '', dealName = '', purpose = 'connect' } = ctx;
    return {
      subject:        `Following up — ${dealName || 'Introduction'}`,
      body:           _outreachTemplate({ recipientName, senderName, dealName, purpose }),
      tone:           'professional',
      template_used:  'standard_intro',
      degraded_mode:  true,
      note:           'Generated from template — AI draft unavailable',
    };
  },

  board_outreach_draft(ctx) {
    const { recipientName = 'there', senderName = '', boardRole = 'board member' } = ctx;
    return {
      subject:       `Board Opportunity — ${ctx.companyName ?? 'Portfolio Company'}`,
      body:          _boardOutreachTemplate({ recipientName, senderName, boardRole }),
      tone:          'executive',
      template_used: 'board_intro',
      degraded_mode: true,
      note:          'Generated from template — AI draft unavailable',
    };
  },

  investor_update_draft(ctx) {
    const { fundName = '', period = 'Q', highlights = [] } = ctx;
    return {
      subject:       `${fundName} Investor Update — ${period}`,
      body:          _investorUpdateTemplate({ fundName, period, highlights }),
      template_used: 'investor_update',
      degraded_mode: true,
      note:          'Generated from template — AI draft unavailable',
    };
  },

  investor_outreach_draft(ctx) {
    const { recipientName = 'there', fundName = '', dealName = '' } = ctx;
    return {
      subject:       `Investment Opportunity — ${dealName}`,
      body:          _investorOutreachTemplate({ recipientName, fundName, dealName }),
      template_used: 'investor_outreach',
      degraded_mode: true,
      note:          'Generated from template — AI draft unavailable',
    };
  },

  // ── Meeting prep ───────────────────────────────────────────────────────────

  meeting_prep(ctx) {
    const { meeting = {}, contacts = [], deals = [], recentEmails = [] } = ctx;
    const sections = [];

    if (meeting.title)    sections.push(`Meeting: ${meeting.title}`);
    if (meeting.datetime) sections.push(`When: ${meeting.datetime}`);

    if (contacts.length) {
      sections.push('Attendees:');
      contacts.forEach((c) => sections.push(`  • ${c.name ?? c.email} — ${c.title ?? 'Unknown title'} @ ${c.company ?? 'Unknown company'}`));
    }

    if (deals.length) {
      sections.push('Related deals:');
      deals.forEach((d) => sections.push(`  • ${d.name} (${d.stage ?? 'unknown stage'}, ${d.value ? `$${_fmtM(d.value)}` : 'value TBD'})`));
    }

    if (recentEmails.length) {
      sections.push(`Recent email context: ${recentEmails.length} threads found — review manually`);
    }

    sections.push('AI-generated talking points unavailable — review records directly.');

    return {
      brief:          sections.join('\n'),
      talking_points: [],
      risks:          [],
      follow_ups:     [],
      degraded_mode:  true,
      note:           'Assembled from records — AI prep unavailable',
    };
  },

  // ── Deal commentary ────────────────────────────────────────────────────────

  deal_snapshot(ctx) {
    const { deal = {} } = ctx;
    return _dealSummaryBlock(deal, 'snapshot');
  },

  deal_structure_commentary(ctx) {
    const { deal = {}, capitalStack = {} } = ctx;
    return {
      summary:         `Deal: ${deal.name ?? 'Unknown'} | Stage: ${deal.stage ?? 'Unknown'} | Value: ${deal.value ? `$${_fmtM(deal.value)}` : 'TBD'}`,
      structure_notes: 'AI commentary unavailable — review term sheet directly',
      capital_stack:   capitalStack,
      risks:           [],
      degraded_mode:   true,
    };
  },

  capital_stack_commentary(ctx) {
    const { capitalStack = {} } = ctx;
    const lines = Object.entries(capitalStack).map(([layer, val]) => `${layer}: $${_fmtM(val)}`);
    return {
      summary:        lines.length ? lines.join(' | ') : 'Capital stack data unavailable',
      commentary:     'AI narrative unavailable — calculated from raw stack data',
      layers:         capitalStack,
      degraded_mode:  true,
    };
  },

  seller_signal_commentary(ctx) {
    const { signals = [] } = ctx;
    return {
      summary:        signals.length ? `${signals.length} signal(s) detected — review manually` : 'No signals on record',
      signals,
      commentary:     'AI commentary unavailable',
      degraded_mode:  true,
    };
  },

  relationship_summary(ctx) {
    const { contact = {}, interactions = 0, lastContact = null } = ctx;
    return {
      summary:        `${contact.name ?? 'Contact'} — ${interactions} recorded interaction(s). Last contact: ${lastContact ?? 'unknown'}`,
      sentiment:      'neutral',
      next_action:    null,
      degraded_mode:  true,
      note:           'Summary from records — AI analysis unavailable',
    };
  },

  // ── Diligence ──────────────────────────────────────────────────────────────

  diligence_question_generation(ctx) {
    const { dealStage = 'unknown', sector = 'general' } = ctx;
    return {
      questions:     _standardDiligenceQuestions(dealStage, sector),
      source:        'standard_template',
      degraded_mode: true,
      note:          'Standard diligence questions — AI customization unavailable',
    };
  },

  complex_diligence_synthesis(ctx) {
    const { issues = [], documents = [] } = ctx;
    const grouped = _groupIssuesBySeverity(issues);
    return {
      critical_issues:  grouped.critical,
      high_issues:      grouped.high,
      medium_issues:    grouped.medium,
      low_issues:       grouped.low,
      document_count:   documents.length,
      synthesis_note:   'Issues grouped by severity from raw data — AI synthesis unavailable',
      recommendation:   issues.filter((i) => i.severity === 'critical').length > 0
        ? 'STOP: Critical issues require resolution before proceeding'
        : 'Review flagged items; proceed with standard diligence caution',
      degraded_mode:    true,
    };
  },

  // ── Execution briefs ───────────────────────────────────────────────────────

  execution_brief(ctx) {
    const { tasks = [], deals = [], meetings = [] } = ctx;
    const overdue   = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done');
    const stalled   = deals.filter((d) => d.daysSinceActivity > 14);
    const today     = meetings.filter((m) => _isToday(m.datetime));

    return {
      headline:       `${overdue.length} overdue · ${stalled.length} stalled deals · ${today.length} meeting(s) today`,
      overdue_tasks:  overdue.slice(0, 10).map((t) => ({ title: t.title, due: t.dueDate, owner: t.owner })),
      stalled_deals:  stalled.slice(0, 5).map((d) => ({ name: d.name, days_inactive: d.daysSinceActivity })),
      todays_meetings: today.slice(0, 5).map((m) => ({ title: m.title, time: m.datetime })),
      next_actions:   [],
      degraded_mode:  true,
      note:           'Assembled from records — AI narrative unavailable',
    };
  },

  execution_recovery(ctx) {
    const { blockers = [], tasks = [] } = ctx;
    const criticalBlockers = blockers.filter((b) => b.severity === 'critical' || b.severity === 'high');
    return {
      blockers:       criticalBlockers.map((b) => ({ description: b.description, deal: b.dealName, owner: b.owner })),
      recovery_plan:  'AI recovery plan unavailable — escalate blockers manually',
      priority_tasks: tasks.slice(0, 5).map((t) => ({ title: t.title, due: t.dueDate })),
      degraded_mode:  true,
    };
  },

  daily_briefing(ctx) {
    return FALLBACK_BUILDERS.execution_brief(ctx); // same shape, reuse
  },

  empire_coach_daily(ctx) {
    const { goals = [], metrics = {} } = ctx;
    return {
      coaching_note:  'AI coaching unavailable — review goals and metrics manually',
      goals:          goals.slice(0, 5),
      metrics,
      degraded_mode:  true,
    };
  },

  // ── Summaries / rankings ───────────────────────────────────────────────────

  short_summary(ctx) {
    const { text = '', maxLength = 200 } = ctx;
    return {
      summary:       text.slice(0, maxLength) + (text.length > maxLength ? '…' : ''),
      truncated:     text.length > maxLength,
      degraded_mode: true,
    };
  },

  board_candidate_ranking(ctx) {
    const { candidates = [] } = ctx;
    return {
      ranked:        candidates.map((c, i) => ({ rank: i + 1, name: c.name, reason: 'Manual ranking required — AI unavailable' })),
      methodology:   'unranked — original order preserved',
      degraded_mode: true,
    };
  },

  investor_fit_summary(ctx) {
    const { investor = {}, deal = {} } = ctx;
    return {
      fit_score:     null,
      summary:       `Investor: ${investor.name ?? 'Unknown'} | Deal: ${deal.name ?? 'Unknown'} — AI fit analysis unavailable`,
      factors:       [],
      degraded_mode: true,
    };
  },

  memo_section_draft(ctx) {
    const { section = 'Unknown Section', outline = [] } = ctx;
    return {
      section,
      content:       outline.length
        ? `[Section outline]\n${outline.map((item) => `• ${item}`).join('\n')}`
        : `[${section} — AI draft unavailable; populate from source materials]`,
      degraded_mode: true,
    };
  },

  crm_hygiene(ctx) {
    const { records = [] } = ctx;
    const stale = records.filter((r) => r.daysSinceUpdate > 90);
    return {
      stale_records:  stale.length,
      records_flagged: stale.slice(0, 20).map((r) => ({ id: r.id, name: r.name, days_stale: r.daysSinceUpdate })),
      action_required: stale.length > 0 ? 'Review and update stale records' : 'CRM appears current',
      degraded_mode:  true,
    };
  },

  strategy_summary(ctx) {
    const { goals = [], horizon = '12 months' } = ctx;
    return {
      summary:       `Strategic goals for horizon ${horizon}: ${goals.length} item(s) on record`,
      goals,
      commentary:    'AI strategy synthesis unavailable — review goals directly',
      degraded_mode: true,
    };
  },

  // ── Default ────────────────────────────────────────────────────────────────

  _default(ctx) {
    return {
      data:          ctx,
      note:          'AI output unavailable — raw context data returned',
      degraded_mode: true,
    };
  },
};

// ─── Template helpers ─────────────────────────────────────────────────────────

function _outreachTemplate({ recipientName, senderName, dealName, purpose }) {
  return [
    `Hi ${recipientName},`,
    '',
    `I hope this message finds you well. ${senderName ? `I'm ${senderName} and I` : 'I'} wanted to reach out regarding ${dealName || 'a potential opportunity'}.`,
    '',
    `I'd love to connect and explore whether there's mutual interest. Would you be open to a brief call at your convenience?`,
    '',
    'Looking forward to hearing from you.',
    '',
    `Best regards,`,
    senderName || '',
  ].join('\n');
}

function _boardOutreachTemplate({ recipientName, senderName, boardRole }) {
  return [
    `Dear ${recipientName},`,
    '',
    `I am reaching out regarding a board opportunity that I believe aligns well with your experience as a ${boardRole}.`,
    '',
    `Given your background, I think you would bring significant value to this role. I would welcome the chance to discuss further.`,
    '',
    `Please let me know if you would be available for a conversation.',`,
    '',
    `Best regards,`,
    senderName || '',
  ].join('\n');
}

function _investorUpdateTemplate({ fundName, period, highlights }) {
  const bulletPoints = highlights.length
    ? highlights.map((h) => `• ${h}`).join('\n')
    : '• [Key highlights to be populated]';

  return [
    `Dear Investor,`,
    '',
    `Please find below the ${fundName} update for ${period}.`,
    '',
    `Highlights:`,
    bulletPoints,
    '',
    `We will follow up with detailed financials separately.`,
    '',
    `Thank you for your continued partnership.`,
  ].join('\n');
}

function _investorOutreachTemplate({ recipientName, fundName, dealName }) {
  return [
    `Dear ${recipientName},`,
    '',
    `${fundName ? `On behalf of ${fundName}, I` : 'I'} am writing to introduce an investment opportunity: ${dealName}.`,
    '',
    `We believe this opportunity merits your consideration and would welcome the opportunity to share a detailed overview.`,
    '',
    `Please let us know if you would like to schedule a call.',`,
    '',
    `Best regards,`,
  ].join('\n');
}

// ─── Classification helpers ───────────────────────────────────────────────────

function _classifyByExtension(ext, mimeType) {
  const PDF     = ['pdf'];
  const DOCS    = ['doc', 'docx', 'odt', 'rtf'];
  const SHEETS  = ['xls', 'xlsx', 'csv', 'ods'];
  const IMAGES  = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
  const LEGAL   = ['pdf']; // ambiguous — flag as potentially legal

  if (mimeType?.includes('pdf') || PDF.includes(ext))       return 'document/pdf';
  if (DOCS.includes(ext))                                    return 'document/word';
  if (SHEETS.includes(ext))                                  return 'spreadsheet';
  if (IMAGES.includes(ext))                                  return 'image';
  if (ext === 'eml' || mimeType?.includes('message/rfc822')) return 'email';
  if (ext === 'msg')                                          return 'email';
  return 'unknown';
}

function _inferRoleFromTitle(title = '') {
  const t = title.toLowerCase();
  if (t.includes('ceo') || t.includes('chief executive'))    return 'C-Suite';
  if (t.includes('cfo') || t.includes('chief financial'))    return 'C-Suite';
  if (t.includes('coo') || t.includes('chief operating'))    return 'C-Suite';
  if (t.includes('president') || t.includes('chairman'))     return 'Senior Executive';
  if (t.includes('managing director') || t.includes(' md ')) return 'Senior Executive';
  if (t.includes('partner') || t.includes('principal'))      return 'Investment Professional';
  if (t.includes('associate') || t.includes('analyst'))      return 'Junior Professional';
  if (t.includes('board') || t.includes('director'))         return 'Board Member';
  if (t.includes('counsel') || t.includes('attorney') || t.includes('lawyer')) return 'Legal';
  if (t.includes('advisor') || t.includes('consultant'))     return 'Advisor';
  return 'Other';
}

function _tierFromRole(role) {
  const tiers = {
    'C-Suite':                1,
    'Senior Executive':       2,
    'Investment Professional': 3,
    'Board Member':           2,
    'Advisor':                3,
    'Legal':                  3,
    'Junior Professional':    4,
    'Other':                  5,
  };
  return tiers[role] ?? 5;
}

// ─── Diligence helpers ────────────────────────────────────────────────────────

function _groupIssuesBySeverity(issues = []) {
  const out = { critical: [], high: [], medium: [], low: [] };
  for (const issue of issues) {
    const sev = (issue.severity ?? 'low').toLowerCase();
    if (out[sev]) out[sev].push(issue);
    else          out.low.push(issue);
  }
  return out;
}

function _standardDiligenceQuestions(stage, sector) {
  const base = [
    'What are the primary revenue drivers and how have they trended over the past 3 years?',
    'Who are the top 5 customers by revenue and what are the contract terms?',
    'What is the current debt structure and any covenants?',
    'What IP does the company own and are there any disputes?',
    'What is the management team\'s equity stake and vesting schedule?',
    'Are there any pending or threatened legal actions?',
    'What are the key operational dependencies and single points of failure?',
    'What does the competitive landscape look like and what is the moat?',
  ];

  const staged = stage === 'loi' || stage === 'diligence'
    ? [
        'Provide audited financials for the last 3 years.',
        'Provide a cap table with full dilution.',
        'Identify all related-party transactions.',
        'Detail any change of control provisions.',
      ]
    : ['Provide management presentation and CIM if available.'];

  return [...base, ...staged].map((q, i) => ({ id: i + 1, question: q, category: 'standard', priority: i < 4 ? 'high' : 'medium' }));
}

// ─── Deal helpers ─────────────────────────────────────────────────────────────

function _dealSummaryBlock(deal, type) {
  return {
    name:           deal.name ?? 'Unknown',
    stage:          deal.stage ?? 'Unknown',
    value:          deal.value ? `$${_fmtM(deal.value)}` : 'TBD',
    sector:         deal.sector ?? 'Unknown',
    summary_type:   type,
    commentary:     'AI narrative unavailable — data assembled from deal record',
    key_metrics:    deal.metrics ?? {},
    degraded_mode:  true,
  };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function _fmtM(value) {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function _isToday(datetimeStr) {
  if (!datetimeStr) return false;
  const d = new Date(datetimeStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

export default { buildFallback, hasFallback };
