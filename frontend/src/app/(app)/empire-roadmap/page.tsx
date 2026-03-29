'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Map,
  CheckCircle2,
  Circle,
  Lock,
  ChevronDown,
  ChevronRight,
  Zap,
  ArrowRight,
  Target,
  Users,
  TrendingUp,
  Building2,
  DollarSign,
  Search,
  MessageCircle,
  FileText,
  Scale,
  Landmark,
  ClipboardCheck,
  Handshake,
  BarChart3,
  RefreshCw,
  Infinity,
} from 'lucide-react';

// ─── Phase Definitions ────────────────────────────────────────────────────────
// 15-phase QLA acquisition journey from identity to empire

type PhaseStatus = 'locked' | 'active' | 'complete';

interface EmpirePhaseDef {
  order: number;
  code: string;
  name: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  description: string;
  whyItMatters: string;
  danaPenaQuote?: string;
  entryCriteria: string[];
  exitCriteria: string[];
  keyDeliverables: string[];
  linkedRoutes?: { label: string; href: string }[];
  estimatedWeeks: number;
}

const PHASES: EmpirePhaseDef[] = [
  {
    order: 1,
    code: 'IDENTITY',
    name: 'Identity & Commitment',
    icon: Target,
    description: 'Establish your identity as a serious acquirer. Declare your commitment to the QLA methodology. Eliminate doubt.',
    whyItMatters: 'Everything flows from identity. If you do not see yourself as an acquirer, every obstacle will stop you. Your mindset is your first asset.',
    danaPenaQuote: '"You cannot out-perform your self-image."',
    entryCriteria: ['You have decided to pursue acquisition as a primary wealth strategy'],
    exitCriteria: [
      'Written personal mission statement as an acquirer',
      'QLA commitment documented',
      'Prior limiting beliefs identified and neutralized',
      'Time commitment scheduled (minimum 20 hrs/week)',
    ],
    keyDeliverables: ['Personal mission statement', 'Time commitment schedule', 'Accountability structure'],
    estimatedWeeks: 1,
  },
  {
    order: 2,
    code: 'THESIS',
    name: 'Industry Thesis',
    icon: Search,
    description: 'Identify the specific industry you will target. Define your edge, your access, and your rationale for that sector.',
    whyItMatters: 'Generalists die in acquisitions. Your thesis gives you credibility with sellers, lenders, and board members. It defines your hunting ground.',
    danaPenaQuote: '"You cannot be all things to all people. Pick your sector and dominate it."',
    entryCriteria: ['Identity phase complete', 'Research capacity available (20+ hours)'],
    exitCriteria: [
      'Primary industry selected (SIC/NAICS range defined)',
      'Secondary industry backup selected',
      'Deal thesis written (1-2 pages)',
      'Size criteria defined (revenue, SDE, employees)',
      'Geography defined',
      'Seller profile defined',
    ],
    keyDeliverables: ['Deal thesis document', 'Target criteria scorecard', 'Industry research notes'],
    linkedRoutes: [{ label: 'CRM Companies', href: '/crm/companies' }],
    estimatedWeeks: 2,
  },
  {
    order: 3,
    code: 'BOARD',
    name: 'Board Assembly',
    icon: Users,
    description: 'Build your 6-seat advisory board. This is your primary credibility infrastructure and deal-making leverage.',
    whyItMatters: 'Dan Peña built his empire on the board. Sellers trust boards. Lenders trust boards. Investors trust boards. Your board makes you look institutional.',
    danaPenaQuote: '"Your board is your greatest asset. Build it before you need it."',
    entryCriteria: ['Deal thesis complete', 'Target industry defined'],
    exitCriteria: [
      'At least 3 board seats committed (verbal or written)',
      'All 6 seats defined and targeted',
      'Board credibility package created',
      'At least 1 board member with industry operator experience',
      'At least 1 board member with lender relationships',
    ],
    keyDeliverables: ['Board candidate pipeline (20+ names)', 'Board invitation letters', 'Board credibility deck'],
    linkedRoutes: [
      { label: 'Board OS', href: '/board' },
      { label: 'Contacts', href: '/crm/contacts' },
    ],
    estimatedWeeks: 6,
  },
  {
    order: 4,
    code: 'RELATIONSHIPS',
    name: 'Relationship Network',
    icon: MessageCircle,
    description: 'Build the core relationship network: bankers, lawyers, CPAs, brokers, and operators in your target sector.',
    whyItMatters: 'Deals happen through relationships. Your access to deal flow, financing, and expertise all come from people who know and trust you.',
    entryCriteria: ['Board phase started (at least 2 seats targeted)'],
    exitCriteria: [
      'At least 1 SBA/acquisition lender relationship established',
      'At least 1 M&A attorney identified',
      'At least 1 CPA/QoE provider identified',
      'At least 3 industry operators in your network',
      'CRM populated with 50+ contacts',
    ],
    keyDeliverables: ['Professional advisor directory', 'Lender relationship log', 'Warm intro map'],
    linkedRoutes: [
      { label: 'CRM Contacts', href: '/crm/contacts' },
      { label: 'Relationships', href: '/relationships' },
    ],
    estimatedWeeks: 4,
  },
  {
    order: 5,
    code: 'SOURCING',
    name: 'Deal Sourcing Machine',
    icon: Zap,
    description: 'Build systematic, high-volume deal flow from brokers, direct outreach, and proprietary sources.',
    whyItMatters: 'Acquisition is a numbers game. You need to see 100 deals to find 1 worth pursuing. The machine must run constantly.',
    danaPenaQuote: '"It is a numbers game. Always has been. Always will be."',
    entryCriteria: ['Deal thesis finalized', 'CRM set up', 'Outreach templates ready'],
    exitCriteria: [
      '25+ targets contacted per week',
      'Deal feed active with 50+ listings reviewed',
      'At least 3 broker relationships established',
      'CRM has 100+ target companies',
      'Outreach system running (not manual one-offs)',
    ],
    keyDeliverables: ['Target list (100+ companies)', 'Outreach sequence templates', 'Broker relationship log'],
    linkedRoutes: [
      { label: 'CRM Companies', href: '/crm/companies' },
      { label: 'Deal Feed', href: '/deal-feed' },
      { label: 'Outreach', href: '/outreach' },
      { label: 'Sourcing Radar', href: '/pipeline/sourcing-radar' },
    ],
    estimatedWeeks: 8,
  },
  {
    order: 6,
    code: 'CONVERSATIONS',
    name: 'Seller Conversations',
    icon: MessageCircle,
    description: 'Conduct systematic seller conversations. Qualify motivation, timeline, and deal structure. Build trust.',
    whyItMatters: 'Sellers sell to people they trust. Conversations build trust. Most buyers never have a real conversation. That gap is your advantage.',
    entryCriteria: ['Sourcing machine operational', '25+ contacts/week rhythm established'],
    exitCriteria: [
      '10+ seller conversations completed',
      'Conversation intelligence documented in CRM',
      'Seller motivation patterns identified in your market',
      'At least 2 sellers in active follow-up',
      'Conversation funnel metrics tracked',
    ],
    keyDeliverables: ['Conversation notes (CRM)', 'Follow-up sequences', 'Seller objection playbook'],
    linkedRoutes: [
      { label: 'Conversations', href: '/conversations' },
      { label: 'Outreach', href: '/outreach' },
      { label: 'Meetings', href: '/meetings' },
    ],
    estimatedWeeks: 8,
  },
  {
    order: 7,
    code: 'EVALUATION',
    name: 'Deal Evaluation',
    icon: Scale,
    description: 'Apply rigorous financial and qualitative evaluation to opportunities. Separate signal from noise.',
    whyItMatters: 'Most businesses are not worth buying. Rigorous evaluation protects your capital and time. A bad deal is worse than no deal.',
    entryCriteria: ['Active seller conversations (2+)', 'Lender relationship established'],
    exitCriteria: [
      'At least 1 deal in financial review stage',
      'Underwriting model applied to 5+ opportunities',
      'Deal scoring criteria defined and applied',
      'GO/NO-GO framework in use',
      'First LOI-worthy candidate identified',
    ],
    keyDeliverables: ['Underwriting models', 'Deal evaluation scorecard', 'Opportunity log'],
    linkedRoutes: [
      { label: 'Pipeline', href: '/pipeline' },
      { label: 'Underwriting', href: '/underwriting' },
    ],
    estimatedWeeks: 6,
  },
  {
    order: 8,
    code: 'LOI',
    name: 'LOI & Negotiation',
    icon: FileText,
    description: 'Prepare and submit your Letter of Intent. Negotiate deal structure, price, and key terms.',
    whyItMatters: 'The LOI sets every expectation for the rest of the deal. Price, structure, exclusivity, and diligence terms all get anchored here. Get it right.',
    entryCriteria: [
      'Deal in financial review with GO verdict',
      'At least 3 board members committed',
      'Lender relationship confirmed',
      'M&A attorney identified',
    ],
    exitCriteria: [
      'LOI submitted',
      'LOI accepted or negotiated to acceptance',
      'Exclusivity period secured',
      'Price and structure agreed in principle',
      'Key advisors engaged',
    ],
    keyDeliverables: ['LOI document', 'Deal structure memo', 'Negotiation notes'],
    linkedRoutes: [
      { label: 'Pipeline', href: '/pipeline' },
      { label: 'Documents', href: '/documents' },
    ],
    estimatedWeeks: 2,
  },
  {
    order: 9,
    code: 'DILIGENCE',
    name: 'Due Diligence',
    icon: ClipboardCheck,
    description: 'Conduct systematic due diligence across financial, legal, operational, and customer dimensions.',
    whyItMatters: 'Diligence reveals the gap between what was represented and what is real. Issues found in diligence are negotiating tools. Issues missed become losses.',
    entryCriteria: ['LOI signed', 'Exclusivity period active', 'M&A attorney engaged'],
    exitCriteria: [
      'Financial diligence complete (QoE or equivalent)',
      'Legal diligence complete (contracts, IP, liabilities)',
      'Operational diligence complete (key employees, systems)',
      'Customer concentration assessed',
      'All lender document requirements met',
      'No unresolved close-blocking issues',
    ],
    keyDeliverables: ['Diligence checklist (100% complete)', 'Issue log with resolutions', 'QoE summary'],
    linkedRoutes: [
      { label: 'Pipeline', href: '/pipeline' },
      { label: 'Documents', href: '/documents' },
    ],
    estimatedWeeks: 6,
  },
  {
    order: 10,
    code: 'FINANCING',
    name: 'Deal Financing',
    icon: Landmark,
    description: 'Secure the capital stack. SBA/conventional debt, seller note, investor equity, and operator contribution.',
    whyItMatters: 'Financing is where most deals die. Start the lender process early. The capital stack determines your returns and your risk.',
    entryCriteria: ['Diligence 80%+ complete', 'Lender pre-approval in process', 'Capital stack modeled'],
    exitCriteria: [
      'SBA/lender commitment letter received',
      'Seller note terms agreed',
      'Investor equity committed (if applicable)',
      'Capital stack fully covered',
      'Closing conditions from lender documented',
    ],
    keyDeliverables: ['Lender commitment letter', 'Capital stack summary', 'Investor commitments'],
    linkedRoutes: [
      { label: 'Capital Raising', href: '/capital-raising' },
      { label: 'Underwriting', href: '/underwriting' },
    ],
    estimatedWeeks: 6,
  },
  {
    order: 11,
    code: 'CLOSE',
    name: 'Closing',
    icon: Handshake,
    description: 'Execute the closing. Coordinate attorneys, lender, seller, and all closing conditions.',
    whyItMatters: 'Closing requires total focus. Every open item must be resolved. This is when the deal either completes or falls apart.',
    entryCriteria: ['Financing committed', 'Diligence complete', 'All closing conditions met'],
    exitCriteria: [
      'Purchase agreement executed',
      'Funds transferred',
      'Ownership transferred',
      'Transition plan in place',
      'Key employees secured',
    ],
    keyDeliverables: ['Signed purchase agreement', 'Closing checklist', 'Day-one operations plan'],
    linkedRoutes: [{ label: 'Documents', href: '/documents' }],
    estimatedWeeks: 2,
  },
  {
    order: 12,
    code: 'POST_CLOSE',
    name: 'Post-Close Stabilization',
    icon: Building2,
    description: 'Execute your 30/60/90 day stabilization plan. Retain key talent. Maintain customer relationships. Establish operating rhythm.',
    whyItMatters: 'Most value is created or destroyed in the first 90 days. Your credibility with employees, customers, and board is set here.',
    entryCriteria: ['Closing complete', 'Ownership transferred'],
    exitCriteria: [
      '30-day stabilization plan executed',
      'Key employee retention secured',
      'Customer communication complete',
      'Financial reporting system operational',
      'Board reporting cadence established',
      'Cash flow positive or on plan',
    ],
    keyDeliverables: ['30/60/90 plan', 'Employee retention agreements', 'Board report template'],
    linkedRoutes: [{ label: 'Post-Acquisition', href: '/post-acquisition' }],
    estimatedWeeks: 12,
  },
  {
    order: 13,
    code: 'GROWTH',
    name: 'Platform Growth',
    icon: TrendingUp,
    description: 'Grow the acquired platform. Optimize operations, expand margins, and build toward institutional quality.',
    whyItMatters: 'The acquisition is not the destination. Growth is where you build real enterprise value and create the platform for roll-up.',
    entryCriteria: ['Post-close stabilization complete', 'Business cash flow positive'],
    exitCriteria: [
      'EBITDA growth >10% vs. acquisition baseline',
      'Operating systems documented',
      'Management team strengthened',
      'Customer retention >90%',
      'Board fully seated and engaged',
    ],
    keyDeliverables: ['Quarterly board report', 'Operating metrics dashboard', 'Growth plan'],
    linkedRoutes: [{ label: 'Execution', href: '/execution' }],
    estimatedWeeks: 52,
  },
  {
    order: 14,
    code: 'ROLLUP',
    name: 'Roll-Up Strategy',
    icon: RefreshCw,
    description: 'Execute a disciplined roll-up: acquire add-ons, integrate synergies, and build toward a platform exit.',
    whyItMatters: 'The multiple expansion from roll-up is where real wealth is built. Platforms sell at 7-12x. Individual businesses sell at 3-5x.',
    danaPenaQuote: '"Buy one. Fix it. Buy another. Repeat. Exit at 10x."',
    entryCriteria: ['Platform operating profitably', 'Management team in place', 'Lender relationship established'],
    exitCriteria: [
      'First add-on acquisition identified and modeled',
      'Roll-up thesis documented',
      'Synergy map created',
      'Platform EV trajectory modeled to exit',
    ],
    keyDeliverables: ['Roll-up thesis', 'Add-on target list', 'Platform EV model'],
    linkedRoutes: [{ label: 'Pipeline', href: '/pipeline' }],
    estimatedWeeks: 26,
  },
  {
    order: 15,
    code: 'EXIT',
    name: 'Empire & Exit',
    icon: Infinity,
    description: 'Execute an institutional-quality exit or capital event. Strategic sale, private equity, or recapitalization.',
    whyItMatters: 'Everything you have built points here. The exit is where your equity converts to generational wealth.',
    danaPenaQuote: '"The first hundred million is the hardest."',
    entryCriteria: ['Platform EBITDA >$2M', 'Management independent', 'Clean financials 3 years'],
    exitCriteria: [
      'Investment banker engaged',
      'CIM prepared',
      'Strategic and financial buyers contacted',
      'LOI from buyer received',
      'Transaction closed',
    ],
    keyDeliverables: ['CIM', 'Financial model for buyers', 'Management presentation'],
    linkedRoutes: [{ label: 'Documents', href: '/documents' }],
    estimatedWeeks: 26,
  },
];

// ─── Mock current state (to be replaced by API) ───────────────────────────────
const MOCK_STATUSES: Record<string, PhaseStatus> = {
  IDENTITY:      'complete',
  THESIS:        'active',
  BOARD:         'active',
  RELATIONSHIPS: 'active',
  SOURCING:      'locked',
  CONVERSATIONS: 'locked',
  EVALUATION:    'locked',
  LOI:           'locked',
  DILIGENCE:     'locked',
  FINANCING:     'locked',
  CLOSE:         'locked',
  POST_CLOSE:    'locked',
  GROWTH:        'locked',
  ROLLUP:        'locked',
  EXIT:          'locked',
};

const MOCK_COMPLETION: Record<string, number> = {
  IDENTITY:      100,
  THESIS:        60,
  BOARD:         35,
  RELATIONSHIPS: 20,
};

// ─── Components ───────────────────────────────────────────────────────────────

function PhaseStatusBadge({ status }: { status: PhaseStatus }) {
  if (status === 'complete') {
    return (
      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-400 border border-emerald-700/40">
        Complete
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#C9A22720]/40 text-[#C9A227] border border-[#C9A22740]">
        Active
      </span>
    );
  }
  return (
    <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#1F1F23] text-[#A7A29A] border border-[#2A2A2E]">
      Locked
    </span>
  );
}

function PhaseRow({ phase, status, completion, expanded, onToggle }: {
  phase: EmpirePhaseDef;
  status: PhaseStatus;
  completion: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = phase.icon;
  const isLocked = status === 'locked';
  const isComplete = status === 'complete';
  const isActive = status === 'active';

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isComplete
          ? 'border-emerald-800/30 bg-emerald-900/5'
          : isActive
          ? 'border-[#C9A22740] bg-[#C9A22720]/5'
          : 'border-[#2A2A2E] bg-[#141414]'
      }`}
    >
      {/* Header */}
      <button
        onClick={isLocked ? undefined : onToggle}
        className={`w-full flex items-center gap-4 p-4 text-left rounded-xl transition-colors ${
          isLocked
            ? 'cursor-default opacity-50'
            : 'hover:bg-white/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C9A227]'
        }`}
        aria-expanded={!isLocked ? expanded : undefined}
        disabled={isLocked}
      >
        {/* Order badge */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            isComplete
              ? 'bg-emerald-700/30 text-emerald-400'
              : isActive
              ? 'bg-[#C9A227] text-black'
              : 'bg-[#2A2A2E] text-[#A7A29A]'
          }`}
        >
          {isLocked ? <Lock size={12} /> : isComplete ? <CheckCircle2 size={14} /> : phase.order}
        </div>

        {/* Icon */}
        <div className={`flex-shrink-0 ${isComplete ? 'text-emerald-400' : isActive ? 'text-[#C9A227]' : 'text-[#A7A29A]'}`}>
          <Icon size={18} />
        </div>

        {/* Title + description */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-semibold ${
                isComplete ? 'text-emerald-400' : isActive ? 'text-[#C9A227]' : 'text-[#A7A29A]'
              }`}
            >
              Phase {phase.order}: {phase.name}
            </span>
            <PhaseStatusBadge status={status} />
          </div>
          <p className="text-xs text-[#A7A29A] mt-0.5 line-clamp-1">{phase.description}</p>
          {/* Progress bar */}
          {(isActive || isComplete) && (
            <div className="mt-1.5 h-1 w-48 max-w-full rounded-full bg-[#2A2A2E] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete ? 'bg-emerald-500' : 'bg-[#C9A227]'
                }`}
                style={{ width: `${completion}%` }}
              />
            </div>
          )}
        </div>

        {/* Chevron */}
        {!isLocked && (
          <div className="text-[#A7A29A] flex-shrink-0">
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </div>
        )}
      </button>

      {/* Expanded Detail */}
      {!isLocked && expanded && (
        <div className="border-t border-[#2A2A2E] px-4 pb-5 pt-4 space-y-5">
          {/* Why it matters */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A227] mb-1.5">
              Why This Phase Matters
            </h4>
            <p className="text-sm text-[#C4C1BB] leading-relaxed">{phase.whyItMatters}</p>
            {phase.danaPenaQuote && (
              <blockquote className="mt-3 pl-3 border-l-2 border-[#C9A227]/40 text-sm italic text-[#C9A227]/80">
                {phase.danaPenaQuote}
              </blockquote>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Entry criteria */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#A7A29A] mb-2">
                Entry Criteria
              </h4>
              <ul className="space-y-1">
                {phase.entryCriteria.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[#C4C1BB]">
                    <Circle size={8} className="mt-1 text-[#3A3A3E] flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Exit criteria */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#A7A29A] mb-2">
                Exit Gates
              </h4>
              <ul className="space-y-1">
                {phase.exitCriteria.map((c, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[#C4C1BB]">
                    <CheckCircle2 size={8} className="mt-1 text-emerald-500/60 flex-shrink-0" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>

            {/* Key deliverables */}
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-widest text-[#A7A29A] mb-2">
                Key Deliverables
              </h4>
              <ul className="space-y-1">
                {phase.keyDeliverables.map((d, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-[#C4C1BB]">
                    <FileText size={8} className="mt-1 text-[#C9A227]/60 flex-shrink-0" />
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Linked routes */}
          {phase.linkedRoutes && phase.linkedRoutes.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {phase.linkedRoutes.map((r) => (
                <Link
                  key={r.href}
                  href={r.href}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2A2A2E] text-xs text-[#A7A29A] hover:text-[#E8E6E3] hover:border-[#3A3A3E] transition-colors"
                >
                  {r.label}
                  <ArrowRight size={10} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function EmpireRoadmapPage() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['THESIS', 'BOARD']));

  const togglePhase = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const activePhases = PHASES.filter((p) => MOCK_STATUSES[p.code] === 'active');
  const completedCount = PHASES.filter((p) => MOCK_STATUSES[p.code] === 'complete').length;
  const activeCount = activePhases.length;
  const overallPct = Math.round(
    PHASES.reduce((acc, p) => acc + (MOCK_COMPLETION[p.code] ?? 0), 0) / PHASES.length
  );

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#E8E6E3] flex items-center gap-2">
            <Map size={22} className="text-[#C9A227]" aria-hidden />
            Empire Roadmap
          </h1>
          <p className="text-sm text-[#A7A29A] mt-1">
            Your 15-phase QLA acquisition journey — from identity to exit.
          </p>
        </div>
        <Link
          href="/playbook"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2A2A2E] text-sm text-[#A7A29A] hover:text-[#E8E6E3] hover:border-[#3A3A3E] transition-colors"
        >
          <BarChart3 size={14} />
          Detailed Playbook
        </Link>
      </div>

      {/* Overall progress */}
      <div className="bg-[#141414] border border-[#2A2A2E] rounded-xl p-5 grid grid-cols-2 md:grid-cols-4 gap-6">
        <div>
          <div className="text-xs text-[#A7A29A] uppercase tracking-widest font-semibold mb-1">Overall Progress</div>
          <div className="text-2xl font-bold text-[#C9A227]">{overallPct}%</div>
        </div>
        <div>
          <div className="text-xs text-[#A7A29A] uppercase tracking-widest font-semibold mb-1">Phases Complete</div>
          <div className="text-2xl font-bold text-emerald-400">{completedCount}</div>
        </div>
        <div>
          <div className="text-xs text-[#A7A29A] uppercase tracking-widest font-semibold mb-1">Active Phases</div>
          <div className="text-2xl font-bold text-[#C9A227]">{activeCount}</div>
        </div>
        <div>
          <div className="text-xs text-[#A7A29A] uppercase tracking-widest font-semibold mb-1">Total Phases</div>
          <div className="text-2xl font-bold text-[#E8E6E3]">{PHASES.length}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full bg-[#2A2A2E] overflow-hidden"
        role="progressbar"
        aria-valuenow={overallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${overallPct}% of empire roadmap complete`}
      >
        <div
          className="h-full rounded-full bg-[#C9A227] transition-all duration-700"
          style={{ width: `${overallPct}%` }}
        />
      </div>

      {/* Active phase callout */}
      {activePhases.length > 0 && (
        <div className="bg-[#C9A22710] border border-[#C9A22740] rounded-xl p-4">
          <div className="text-xs uppercase tracking-widest text-[#C9A227] font-semibold mb-2">
            Currently Active
          </div>
          <div className="flex flex-wrap gap-2">
            {activePhases.map((p) => (
              <button
                key={p.code}
                onClick={() => togglePhase(p.code)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A22720] border border-[#C9A22740] text-[#C9A227] text-sm hover:bg-[#C9A22720]/30 transition-colors"
              >
                <Zap size={12} />
                Phase {p.order}: {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Phase list */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#A7A29A]">
          All 15 Phases
        </h2>
        {PHASES.map((phase) => (
          <PhaseRow
            key={phase.code}
            phase={phase}
            status={MOCK_STATUSES[phase.code] ?? 'locked'}
            completion={MOCK_COMPLETION[phase.code] ?? 0}
            expanded={expanded.has(phase.code)}
            onToggle={() => togglePhase(phase.code)}
          />
        ))}
      </div>

      {/* Footer note */}
      <p className="text-xs text-[#A7A29A] border-t border-[#2A2A2E] pt-4">
        Phase status and completion will be driven by your activity across Board OS, CRM, Pipeline, Playbook, and Execution modules. Locked phases unlock automatically when entry criteria are met.
      </p>
    </div>
  );
}
