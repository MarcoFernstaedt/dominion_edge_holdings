/**
 * DiligenceEngine — deterministic diligence management.
 *
 * Rules:
 *  - Issue severity and blocker status are deterministic.
 *  - Completeness scores are calculated, not estimated.
 *  - AI may only cluster, summarize, or draft questions on top of this.
 *  - Fatal issue and lender blocker flags are never AI-derived.
 */

// ─── Categories ───────────────────────────────────────────────────────────────

export const DILIGENCE_CATEGORIES = [
  'financial', 'legal', 'operational', 'commercial', 'customer',
  'compliance', 'technology', 'licensing', 'insurance', 'working_capital',
  'hr', 'tax',
];

// Category weights for overall completeness (must sum to 100)
export const CATEGORY_WEIGHTS = {
  financial:       20,
  legal:           15,
  compliance:      12,
  licensing:       12,
  working_capital: 10,
  customer:        10,
  operational:     8,
  tax:             5,
  hr:              4,
  insurance:       4,
};

export const SEVERITY_LEVELS = ['fatal', 'critical', 'high', 'medium', 'low'];
export const ISSUE_STATUSES   = ['open', 'in_progress', 'resolved', 'waived', 'escalated'];

// ─── Issue factory ────────────────────────────────────────────────────────────

/**
 * Create a new diligence issue. Returns a structured issue object.
 * Caller must persist to database.
 */
export function createIssue({
  deal_id, category, severity, title, description,
  source_document_id = null, owner_id = null, due_at = null,
  is_lender_blocker = null, is_close_blocker = null, cluster_key = null,
}) {
  if (!DILIGENCE_CATEGORIES.includes(category)) throw new Error(`Invalid category: ${category}`);
  if (!SEVERITY_LEVELS.includes(severity))      throw new Error(`Invalid severity: ${severity}`);

  // Auto-set blocker flags from severity if not explicitly provided
  const resolvedIsLenderBlocker = is_lender_blocker ?? (severity === 'fatal' || severity === 'critical');
  const resolvedIsCloseBlocker  = is_close_blocker  ?? (severity === 'fatal');

  return {
    issue_id:          `issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    deal_id,
    category,
    severity,
    title,
    description,
    source_document_id,
    owner_id,
    status:            'open',
    created_at:        new Date().toISOString(),
    due_at,
    impact_summary:    _defaultImpactSummary(severity),
    recommended_question: _defaultQuestion(title, category),
    is_lender_blocker: resolvedIsLenderBlocker,
    is_close_blocker:  resolvedIsCloseBlocker,
    cluster_key,
    resolution_notes:  null,
    resolved_at:       null,
  };
}

/**
 * Resolve an issue. Returns updated issue — caller must persist.
 */
export function resolveIssue(issue, { resolution_notes, resolved_by }) {
  if (!resolution_notes || resolution_notes.trim().length < 10) {
    return { success: false, error: 'Resolution notes required (min 10 characters)' };
  }
  return {
    success: true,
    issue: {
      ...issue,
      status:           'resolved',
      resolution_notes: resolution_notes.trim(),
      resolved_by,
      resolved_at:      new Date().toISOString(),
      is_lender_blocker: false,
      is_close_blocker:  false,
    },
  };
}

// ─── Category completeness ────────────────────────────────────────────────────

/**
 * Calculate completeness for a single diligence category.
 */
export function categoryCompleteness(category, issues = [], documents = []) {
  const catIssues = issues.filter((i) => i.category === category);
  const catDocs   = documents.filter((d) => d.category === category || d.diligence_category === category);

  const required_docs_present = catDocs.filter((d) => d.is_required).length;
  const review_started        = catIssues.length > 0 || catDocs.length > 0;
  const issues_logged         = catIssues.length;
  const issues_assigned       = catIssues.filter((i) => i.owner_id).length;
  const criticals_resolved    = catIssues.filter((i) => (i.severity === 'critical' || i.severity === 'fatal') && i.status === 'resolved').length;
  const criticals_total       = catIssues.filter((i) => i.severity === 'critical' || i.severity === 'fatal').length;
  const fatals_present        = catIssues.some((i) => i.severity === 'fatal' && i.status !== 'resolved' && i.status !== 'waived');

  // Score: review_started 30 + docs present 30 + issues_assigned/total 20 + criticals_resolved/total 20
  let score = 0;
  if (review_started)         score += 30;
  if (required_docs_present > 0) score += 30;
  if (issues_logged > 0)      score += (issues_assigned / issues_logged) * 20;
  if (criticals_total > 0)    score += (criticals_resolved / criticals_total) * 20;
  else                        score += 20; // no criticals = full credit

  return {
    category,
    score:                  Math.round(score),
    required_docs_present,
    review_started,
    issues_logged,
    issues_assigned,
    criticals_resolved,
    criticals_total,
    fatals_present,
  };
}

/**
 * Calculate overall diligence completeness across all categories.
 */
export function overallCompleteness(issues = [], documents = []) {
  const categoryResults = {};
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const cat of DILIGENCE_CATEGORIES) {
    const result = categoryCompleteness(cat, issues, documents);
    categoryResults[cat] = result;
    const weight = CATEGORY_WEIGHTS[cat] ?? 0;
    totalWeightedScore += result.score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
  const fatalIssues   = issues.filter((i) => i.severity === 'fatal' && i.status !== 'resolved' && i.status !== 'waived');
  const lenderBlockers = issues.filter((i) => i.is_lender_blocker && i.status !== 'resolved' && i.status !== 'waived');
  const closeBlockers  = issues.filter((i) => i.is_close_blocker  && i.status !== 'resolved' && i.status !== 'waived');
  const openCriticals  = issues.filter((i) => i.severity === 'critical' && i.status === 'open');
  const unassigned     = issues.filter((i) => !i.owner_id && i.status === 'open');

  return {
    overall_score:          overallScore,
    overall_label:          _scoreLabel(overallScore),
    categories:             categoryResults,
    fatal_issue_count:      fatalIssues.length,
    lender_blocker_count:   lenderBlockers.length,
    close_blocker_count:    closeBlockers.length,
    open_critical_count:    openCriticals.length,
    unassigned_issue_count: unassigned.length,
    fatal_issues:           fatalIssues.map(_issueSummary),
    lender_blockers:        lenderBlockers.map(_issueSummary),
    close_blockers:         closeBlockers.map(_issueSummary),
    improvement_actions:    _improvementActions({ fatalIssues, lenderBlockers, openCriticals, unassigned, categoryResults }),
    calculated_at:          new Date().toISOString(),
  };
}

// ─── Issue grouping ───────────────────────────────────────────────────────────

/**
 * Group issues by severity for display.
 */
export function groupBySeverity(issues = []) {
  const groups = { fatal: [], critical: [], high: [], medium: [], low: [] };
  for (const issue of issues) {
    const sev = issue.severity ?? 'low';
    if (groups[sev]) groups[sev].push(issue);
    else groups.low.push(issue);
  }
  return groups;
}

/**
 * Group issues by category.
 */
export function groupByCategory(issues = []) {
  const groups = {};
  for (const issue of issues) {
    const cat = issue.category ?? 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(issue);
  }
  return groups;
}

// ─── Standard question generator ─────────────────────────────────────────────

/**
 * Generate standard diligence questions for a category.
 * AI may enhance these — deterministic questions are always available as fallback.
 */
export function standardQuestions(category) {
  return (STANDARD_QUESTIONS[category] ?? STANDARD_QUESTIONS._default).map((q, i) => ({
    id:       i + 1,
    category,
    question: q,
    source:   'standard_template',
    priority: i < 3 ? 'high' : 'medium',
  }));
}

const STANDARD_QUESTIONS = {
  financial: [
    'Provide audited or reviewed financials for the past 3 years (P&L, balance sheet, cash flow).',
    'Provide monthly revenue and expense detail for the trailing 12 months.',
    'Explain any revenue or margin fluctuations > 10% year over year.',
    'Identify all owner addbacks claimed and provide documentation.',
    'List all related-party transactions and terms.',
  ],
  legal: [
    'Provide all corporate formation documents (articles, bylaws, operating agreement).',
    'List all pending and threatened litigation or regulatory actions.',
    'Provide all material contracts (customer, vendor, lease, employment).',
    'Identify any change of control provisions in material agreements.',
    'Confirm no liens or encumbrances on business assets.',
  ],
  compliance: [
    'Confirm all required permits and licenses are current and in good standing.',
    'List any regulatory inspections, findings, or consent orders in the past 5 years.',
    'Provide documentation of OSHA, EPA, or other regulatory compliance.',
  ],
  licensing: [
    'List all licenses required to operate the business.',
    'Confirm transferability of each license upon change of ownership.',
    'Identify any licenses tied to current owner\'s personal credentials.',
  ],
  customer: [
    'Provide top 10 customers by revenue with contract terms and renewal dates.',
    'Identify any customers accounting for > 15% of total revenue.',
    'Describe customer concentration risk and mitigation strategies.',
    'Provide customer churn/retention data for the past 3 years.',
  ],
  tax: [
    'Provide federal and state tax returns for the past 3 years.',
    'Confirm no outstanding tax liabilities, liens, or correspondence with IRS/state.',
    'Identify any open tax audits or potential assessments.',
  ],
  hr: [
    'Provide current org chart and list of all employees with tenure and compensation.',
    'Identify any key person risks and succession plans.',
    'List any open EEOC complaints, labor violations, or employment litigation.',
  ],
  working_capital: [
    'Provide accounts receivable aging as of most recent month end.',
    'Provide accounts payable aging as of most recent month end.',
    'Describe seasonal working capital fluctuations.',
    'Confirm adequate working capital will transfer with the business.',
  ],
  operational: [
    'Describe day-to-day operations and any owner-dependent functions.',
    'Identify key suppliers, vendors, and any single-source dependencies.',
    'Describe technology systems and infrastructure.',
  ],
  insurance: [
    'Provide current insurance certificates for all policies.',
    'Confirm coverage types, limits, and expiration dates.',
    'Identify any claims filed in the past 3 years.',
  ],
  _default: [
    'Provide all relevant documentation for this category.',
    'Identify any material risks or open items in this area.',
  ],
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _defaultImpactSummary(severity) {
  const map = { fatal: 'Deal-ending if unresolved', critical: 'Must be resolved before close', high: 'Material risk requiring remediation', medium: 'Should be addressed; may affect valuation', low: 'Minor; monitor or waive' };
  return map[severity] ?? 'Assess impact and assign owner';
}

function _defaultQuestion(title, category) {
  return `Provide documentation and explanation addressing: "${title}" (${category})`;
}

function _issueSummary(i) {
  return { issue_id: i.issue_id, title: i.title, category: i.category, severity: i.severity, owner_id: i.owner_id, status: i.status };
}

function _scoreLabel(score) {
  if (score >= 80) return 'advanced';
  if (score >= 60) return 'in_progress';
  if (score >= 30) return 'early';
  return 'not_started';
}

function _improvementActions({ fatalIssues, lenderBlockers, openCriticals, unassigned, categoryResults }) {
  const actions = [];
  if (fatalIssues.length)   actions.push(`Resolve ${fatalIssues.length} fatal issue(s) immediately — deal cannot proceed`);
  if (lenderBlockers.length) actions.push(`Clear ${lenderBlockers.length} lender blocker(s) before financing submission`);
  if (openCriticals.length) actions.push(`Assign owners to ${openCriticals.length} open critical issue(s)`);
  if (unassigned.length)    actions.push(`Assign ${unassigned.length} unassigned open issue(s) to owners`);

  const weakCategories = Object.entries(categoryResults)
    .filter(([, r]) => r.score < 30 && (CATEGORY_WEIGHTS[r.category] ?? 0) >= 10)
    .map(([cat]) => cat);
  if (weakCategories.length) actions.push(`Begin high-weight diligence categories: ${weakCategories.join(', ')}`);

  return actions;
}

export default {
  DILIGENCE_CATEGORIES, CATEGORY_WEIGHTS, SEVERITY_LEVELS, ISSUE_STATUSES,
  createIssue, resolveIssue, categoryCompleteness, overallCompleteness,
  groupBySeverity, groupByCategory, standardQuestions,
};
