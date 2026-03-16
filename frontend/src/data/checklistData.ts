import type { ChecklistPhase } from '@/lib/types';
import { generateId } from '@/lib/utils';

function item(
  phaseId: string,
  phase: string,
  title: string,
  opts: {
    description?: string;
    whyItMatters?: string;
    completionType?: 'manual' | 'requires-linked-entity' | 'requires-document' | 'requires-meeting' | 'requires-financial-model';
    autoGenerateTasks?: boolean;
    sortOrder: number;
    done?: boolean;
  }
) {
  return {
    id: `${phaseId}_${opts.sortOrder}`,
    phaseId,
    phase,
    title,
    description: opts.description,
    whyItMatters: opts.whyItMatters,
    completionType: opts.completionType ?? 'manual',
    isComplete: opts.done ?? false,
    evidenceRequired: false,
    autoGenerateTasks: opts.autoGenerateTasks ?? false,
    sortOrder: opts.sortOrder,
  };
}

export const CHECKLIST_PHASES: ChecklistPhase[] = [
  {
    id: 'foundation',
    name: 'Foundation',
    color: '#D4AF37',
    items: [
      item('foundation', 'Foundation', 'Read core acquisition methodology and frameworks', { sortOrder: 1, done: true, whyItMatters: 'Your mental model determines your execution. Know the playbook before you run it.' }),
      item('foundation', 'Foundation', 'Define holding company name and brand identity', { sortOrder: 2, done: true }),
      item('foundation', 'Foundation', 'Build and publish holding company website', { sortOrder: 3, done: true }),
      item('foundation', 'Foundation', 'Set up professional domain email', { sortOrder: 4, done: true }),
      item('foundation', 'Foundation', 'Rebuild LinkedIn as Founder / Principal', { sortOrder: 5, done: true }),
      item('foundation', 'Foundation', 'Select target industry using fragmentation criteria', { sortOrder: 6, done: true, whyItMatters: 'Industry selection is your single most important strategic decision.' }),
      item('foundation', 'Foundation', 'Write 1-page industry thesis (why this industry, why now, why you)', { sortOrder: 7, completionType: 'requires-document', whyItMatters: 'Forces you to articulate your edge clearly before raising capital or approaching board members.' }),
      item('foundation', 'Foundation', 'Document target deal parameters ($1M–$5M revenue, EBITDA, seller profile)', { sortOrder: 8, completionType: 'requires-document' }),
      item('foundation', 'Foundation', 'Defer LLC formation until board assembled', { sortOrder: 9, whyItMatters: 'Board credibility precedes entity formation.' }),
      item('foundation', 'Foundation', 'Set up CRM for deal and board tracking', { sortOrder: 10, done: true }),
    ],
  },
  {
    id: 'industry',
    name: 'Industry Selection',
    color: '#7B9E87',
    items: [
      item('industry', 'Industry Selection', 'Pull AZ OPM registry — full licensed operator list', { sortOrder: 1, whyItMatters: 'This is the master list of every licensed pest control operator in Arizona.' }),
      item('industry', 'Industry Selection', 'Cross-reference AZ Corp Commission for owner names and formation dates', { sortOrder: 2 }),
      item('industry', 'Industry Selection', 'Map Phoenix market: residential vs commercial concentration', { sortOrder: 3 }),
      item('industry', 'Industry Selection', 'Research 3–5 comparable closed deals for valuation benchmarks', { sortOrder: 4 }),
      item('industry', 'Industry Selection', 'Understand EBITDA multiples for target industry (4–5x SDE for owner-operated)', { sortOrder: 5 }),
      item('industry', 'Industry Selection', 'Pull SBA 7(a) public loan data on target companies', { sortOrder: 6 }),
      item('industry', 'Industry Selection', 'Create buyer profile to capture passive broker deal flow', { sortOrder: 7 }),
    ],
  },
  {
    id: 'targets',
    name: 'Target Discovery',
    color: '#D4845A',
    items: [
      item('targets', 'Target Discovery', 'Build initial target list — first 50 companies', { sortOrder: 1, autoGenerateTasks: true, whyItMatters: 'No targets, no deals. This is the fuel for everything downstream.' }),
      item('targets', 'Target Discovery', 'Identify top 10 priority targets (15+ yrs, owner 55–70, no web presence)', { sortOrder: 2 }),
      item('targets', 'Target Discovery', 'Load all targets into CRM with name, phone, email, years in business', { sortOrder: 3, completionType: 'requires-linked-entity' }),
      item('targets', 'Target Discovery', 'Score targets on acquisition criteria matrix', { sortOrder: 4 }),
      item('targets', 'Target Discovery', 'Research owner retirement signals for top 10 targets', { sortOrder: 5 }),
      item('targets', 'Target Discovery', 'Reach 100 total targets loaded in CRM', { sortOrder: 6 }),
    ],
  },
  {
    id: 'board',
    name: 'Board Assembly',
    color: '#8B6F9E',
    items: [
      item('board', 'Board Assembly', 'Draft 1-page board pitch deck (thesis, criteria, equity offer, ask)', { sortOrder: 1, completionType: 'requires-document' }),
      item('board', 'Board Assembly', 'Write personalized board invitation email template', { sortOrder: 2, completionType: 'requires-document' }),
      item('board', 'Board Assembly', 'Identify 5–10 Industry Veteran candidates', { sortOrder: 3, completionType: 'requires-linked-entity' }),
      item('board', 'Board Assembly', 'Make first Industry Veteran outreach — LinkedIn + email', { sortOrder: 4, completionType: 'requires-linked-entity' }),
      item('board', 'Board Assembly', 'Secure Industry Veteran commitment (Board Seat 1)', { sortOrder: 5, completionType: 'requires-meeting', whyItMatters: 'This is your anchor board member. Everyone else follows their credibility.' }),
      item('board', 'Board Assembly', 'Identify SBA Banker candidates (Live Oak, Western Alliance, Newtek)', { sortOrder: 6, completionType: 'requires-linked-entity' }),
      item('board', 'Board Assembly', 'Make SBA Banker outreach — lead with Industry Veteran\'s name', { sortOrder: 7 }),
      item('board', 'Board Assembly', 'Secure SBA Banker commitment (Board Seat 2)', { sortOrder: 8, completionType: 'requires-meeting' }),
      item('board', 'Board Assembly', 'Attend first ACG Phoenix event — collect 5+ business cards', { sortOrder: 9, completionType: 'requires-meeting' }),
      item('board', 'Board Assembly', 'Secure M&A Attorney commitment (Board Seat 3)', { sortOrder: 10, completionType: 'requires-meeting' }),
      item('board', 'Board Assembly', 'Secure Transaction CPA commitment (Board Seat 4)', { sortOrder: 11, completionType: 'requires-meeting' }),
      item('board', 'Board Assembly', 'Secure Operations Advisor commitment (Board Seat 5)', { sortOrder: 12, completionType: 'requires-meeting' }),
      item('board', 'Board Assembly', 'Secure Capital Connector commitment (Board Seat 6)', { sortOrder: 13, completionType: 'requires-meeting' }),
      item('board', 'Board Assembly', 'Form LLC (minimum 3 board members committed)', { sortOrder: 14 }),
      item('board', 'Board Assembly', 'Issue equity agreements (0.5–2% each, no cash)', { sortOrder: 15, completionType: 'requires-document' }),
      item('board', 'Board Assembly', 'Hold first board strategy call — align on deal criteria and 90-day actions', { sortOrder: 16, completionType: 'requires-meeting', autoGenerateTasks: true }),
    ],
  },
  {
    id: 'outreach',
    name: 'Outreach',
    color: '#5A8DB5',
    items: [
      item('outreach', 'Outreach', 'Send first 10 outreach letters or emails', { sortOrder: 1, autoGenerateTasks: true, whyItMatters: 'Getting started is the hardest part. First 10 breaks the inertia.' }),
      item('outreach', 'Outreach', 'Follow-up calls — 5–7 days after letter delivery', { sortOrder: 2 }),
      item('outreach', 'Outreach', 'Complete first 50 outreach contacts', { sortOrder: 3, autoGenerateTasks: true }),
      item('outreach', 'Outreach', 'Track all contacts in CRM — date, method, response, follow-up due', { sortOrder: 4, completionType: 'requires-linked-entity' }),
      item('outreach', 'Outreach', 'Set up 3 discovery calls from initial outreach batch', { sortOrder: 5, completionType: 'requires-meeting' }),
      item('outreach', 'Outreach', 'Attend industry association event', { sortOrder: 6, completionType: 'requires-meeting' }),
      item('outreach', 'Outreach', 'Complete 100 total outreach contacts', { sortOrder: 7 }),
      item('outreach', 'Outreach', 'Have 5+ serious seller conversations (not brokers)', { sortOrder: 8 }),
      item('outreach', 'Outreach', 'Develop 3 live deal opportunities (willing to talk structure)', { sortOrder: 9 }),
    ],
  },
  {
    id: 'evaluation',
    name: 'Deal Evaluation',
    color: '#3FA66B',
    items: [
      item('evaluation', 'Deal Evaluation', 'Request 3 years of P&L and tax returns for first serious target', { sortOrder: 1, completionType: 'requires-linked-entity' }),
      item('evaluation', 'Deal Evaluation', 'Calculate SDE for each serious target', { sortOrder: 2, completionType: 'requires-financial-model' }),
      item('evaluation', 'Deal Evaluation', 'Build DSCR model: Annual NOI ÷ Annual Debt Service ≥ 1.25x', { sortOrder: 3, completionType: 'requires-financial-model', whyItMatters: 'DSCR ≥ 1.25x is non-negotiable for SBA approval.' }),
      item('evaluation', 'Deal Evaluation', 'Engage Transaction CPA for informal QofE review', { sortOrder: 4, completionType: 'requires-meeting' }),
      item('evaluation', 'Deal Evaluation', 'Assess customer concentration — no single customer over 20%', { sortOrder: 5 }),
      item('evaluation', 'Deal Evaluation', 'Review employee roster — assess key-person dependency risk', { sortOrder: 6 }),
      item('evaluation', 'Deal Evaluation', 'Check licensing, insurance, and bonding compliance', { sortOrder: 7 }),
      item('evaluation', 'Deal Evaluation', 'Score target on deal criteria matrix — GO / CONDITIONAL GO / NO-GO', { sortOrder: 8, completionType: 'requires-document' }),
    ],
  },
  {
    id: 'loi',
    name: 'LOI and Negotiation',
    color: '#D9A441',
    items: [
      item('loi', 'LOI and Negotiation', 'Structure preliminary offer terms with M&A Attorney board member', { sortOrder: 1, completionType: 'requires-meeting' }),
      item('loi', 'LOI and Negotiation', 'Draft Letter of Intent (LOI)', { sortOrder: 2, completionType: 'requires-document', autoGenerateTasks: true }),
      item('loi', 'LOI and Negotiation', 'Submit LOI to seller', { sortOrder: 3, completionType: 'requires-document' }),
      item('loi', 'LOI and Negotiation', 'Negotiate purchase price and structure', { sortOrder: 4, completionType: 'requires-meeting' }),
      item('loi', 'LOI and Negotiation', 'Execute signed LOI with exclusivity period', { sortOrder: 5, completionType: 'requires-document', whyItMatters: 'Signed LOI creates exclusivity and starts the due diligence clock.' }),
    ],
  },
  {
    id: 'financing',
    name: 'Financing',
    color: '#4D7EA8',
    items: [
      item('financing', 'Financing', 'Prepare SBA 7(a) loan package with banker board member', { sortOrder: 1 }),
      item('financing', 'Financing', 'Submit SBA loan application', { sortOrder: 2, completionType: 'requires-document' }),
      item('financing', 'Financing', 'Negotiate seller note terms', { sortOrder: 3 }),
      item('financing', 'Financing', 'Source equity gap funding if needed via Capital Connector', { sortOrder: 4 }),
      item('financing', 'Financing', 'Receive SBA commitment letter', { sortOrder: 5, completionType: 'requires-document' }),
    ],
  },
  {
    id: 'closing',
    name: 'Closing',
    color: '#C35B5B',
    items: [
      item('closing', 'Closing', 'Complete full due diligence checklist', { sortOrder: 1, completionType: 'requires-document' }),
      item('closing', 'Closing', 'Complete quality of earnings review', { sortOrder: 2, completionType: 'requires-document' }),
      item('closing', 'Closing', 'Execute Purchase Agreement', { sortOrder: 3, completionType: 'requires-document', whyItMatters: 'The purchase agreement is the definitive legal document of the acquisition.' }),
      item('closing', 'Closing', 'Complete closing and fund transaction', { sortOrder: 4 }),
      item('closing', 'Closing', 'Announce acquisition to employees (Day 1 communication)', { sortOrder: 5, completionType: 'requires-meeting' }),
    ],
  },
  {
    id: 'post_acquisition',
    name: 'Post-Acquisition',
    color: '#3FA66B',
    items: [
      item('post_acquisition', 'Post-Acquisition', 'Complete 90-day integration plan', { sortOrder: 1, completionType: 'requires-document', autoGenerateTasks: true }),
      item('post_acquisition', 'Post-Acquisition', 'Meet every employee (Day 1–7)', { sortOrder: 2, completionType: 'requires-meeting' }),
      item('post_acquisition', 'Post-Acquisition', 'Review all vendor contracts (Day 1–30)', { sortOrder: 3 }),
      item('post_acquisition', 'Post-Acquisition', 'Set up new accounting and reporting cadence', { sortOrder: 4 }),
      item('post_acquisition', 'Post-Acquisition', 'Complete KPI baseline and dashboard setup', { sortOrder: 5 }),
      item('post_acquisition', 'Post-Acquisition', 'Complete customer communication and transition', { sortOrder: 6, completionType: 'requires-meeting' }),
      item('post_acquisition', 'Post-Acquisition', 'First board meeting post-acquisition (Day 30)', { sortOrder: 7, completionType: 'requires-meeting' }),
    ],
  },
  {
    id: 'repeat',
    name: 'Second Acquisition Cycle',
    color: '#D4AF37',
    items: [
      item('repeat', 'Second Acquisition Cycle', 'Document lessons learned from first acquisition', { sortOrder: 1, completionType: 'requires-document' }),
      item('repeat', 'Second Acquisition Cycle', 'Identify add-on acquisition targets in same industry', { sortOrder: 2 }),
      item('repeat', 'Second Acquisition Cycle', 'Evaluate platform vs add-on strategy for Deal 2', { sortOrder: 3 }),
      item('repeat', 'Second Acquisition Cycle', 'Update deal parameters based on first acquisition experience', { sortOrder: 4 }),
      item('repeat', 'Second Acquisition Cycle', 'Launch outreach campaign for second acquisition', { sortOrder: 5 }),
    ],
  },
];
