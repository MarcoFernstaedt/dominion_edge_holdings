// Seed: Empire Phases (QLA 15-phase journey)
// Run: node prisma/seed.js

import db from './client.js';

const EMPIRE_PHASES = [
  {
    phaseOrder: 1,
    phaseCode: 'IDENTITY',
    phaseName: 'Identity & Commitment',
    description: 'Establish your identity as a serious acquirer. Declare your commitment to the QLA methodology. Eliminate doubt.',
    whyItMatters: 'Everything flows from identity. If you do not see yourself as an acquirer, every obstacle will stop you. Your mindset is your first asset.',
    danaPenaQuote: '"You cannot out-perform your self-image."',
    entryCriteria: JSON.stringify(['You have decided to pursue acquisition as a primary wealth strategy']),
    exitCriteria: JSON.stringify([
      'Written personal mission statement as an acquirer',
      'QLA commitment documented',
      'Time commitment scheduled (minimum 20 hrs/week)',
    ]),
    keyDeliverables: JSON.stringify(['Personal mission statement', 'Time commitment schedule', 'Accountability structure']),
    estimatedWeeks: 1,
    status: 'active',
  },
  {
    phaseOrder: 2,
    phaseCode: 'THESIS',
    phaseName: 'Industry Thesis',
    description: 'Identify the specific industry you will target. Define your edge, your access, and your rationale for that sector.',
    whyItMatters: 'Generalists die in acquisitions. Your thesis gives you credibility with sellers, lenders, and board members. It defines your hunting ground.',
    danaPenaQuote: '"You cannot be all things to all people. Pick your sector and dominate it."',
    entryCriteria: JSON.stringify(['Identity phase complete', 'Research capacity available (20+ hours)']),
    exitCriteria: JSON.stringify([
      'Primary industry selected (SIC/NAICS range defined)',
      'Deal thesis written (1-2 pages)',
      'Size criteria defined (revenue, SDE, employees)',
      'Geography defined',
    ]),
    keyDeliverables: JSON.stringify(['Deal thesis document', 'Target criteria scorecard', 'Industry research notes']),
    estimatedWeeks: 2,
    status: 'locked',
  },
  {
    phaseOrder: 3,
    phaseCode: 'BOARD',
    phaseName: 'Board Assembly',
    description: 'Build your 6-seat advisory board. This is your primary credibility infrastructure and deal-making leverage.',
    whyItMatters: 'Dan Peña built his empire on the board. Sellers trust boards. Lenders trust boards. Investors trust boards. Your board makes you look institutional.',
    danaPenaQuote: '"Your board is your greatest asset. Build it before you need it."',
    entryCriteria: JSON.stringify(['Deal thesis complete', 'Target industry defined']),
    exitCriteria: JSON.stringify([
      'At least 3 board seats committed (verbal or written)',
      'All 6 seats defined and targeted',
      'Board credibility package created',
    ]),
    keyDeliverables: JSON.stringify(['Board candidate pipeline (20+ names)', 'Board invitation letters', 'Board credibility deck']),
    estimatedWeeks: 6,
    status: 'locked',
  },
  {
    phaseOrder: 4,
    phaseCode: 'RELATIONSHIPS',
    phaseName: 'Relationship Network',
    description: 'Build the core relationship network: bankers, lawyers, CPAs, brokers, and operators in your target sector.',
    whyItMatters: 'Deals happen through relationships. Your access to deal flow, financing, and expertise all come from people who know and trust you.',
    entryCriteria: JSON.stringify(['Board phase started (at least 2 seats targeted)']),
    exitCriteria: JSON.stringify([
      'At least 1 SBA/acquisition lender relationship established',
      'At least 1 M&A attorney identified',
      'CRM populated with 50+ contacts',
    ]),
    keyDeliverables: JSON.stringify(['Professional advisor directory', 'Lender relationship log', 'Warm intro map']),
    estimatedWeeks: 4,
    status: 'locked',
  },
  {
    phaseOrder: 5,
    phaseCode: 'SOURCING',
    phaseName: 'Deal Sourcing Machine',
    description: 'Build systematic, high-volume deal flow from brokers, direct outreach, and proprietary sources.',
    whyItMatters: 'Acquisition is a numbers game. You need to see 100 deals to find 1 worth pursuing. The machine must run constantly.',
    danaPenaQuote: '"It is a numbers game. Always has been. Always will be."',
    entryCriteria: JSON.stringify(['Deal thesis finalized', 'CRM set up', 'Outreach templates ready']),
    exitCriteria: JSON.stringify([
      '25+ targets contacted per week',
      'Deal feed active with 50+ listings reviewed',
      'At least 3 broker relationships established',
      'CRM has 100+ target companies',
    ]),
    keyDeliverables: JSON.stringify(['Target list (100+ companies)', 'Outreach sequence templates', 'Broker relationship log']),
    estimatedWeeks: 8,
    status: 'locked',
  },
  {
    phaseOrder: 6,
    phaseCode: 'CONVERSATIONS',
    phaseName: 'Seller Conversations',
    description: 'Conduct systematic seller conversations. Qualify motivation, timeline, and deal structure. Build trust.',
    whyItMatters: 'Sellers sell to people they trust. Conversations build trust. Most buyers never have a real conversation. That gap is your advantage.',
    entryCriteria: JSON.stringify(['Sourcing machine operational', '25+ contacts/week rhythm established']),
    exitCriteria: JSON.stringify([
      '10+ seller conversations completed',
      'Conversation intelligence documented in CRM',
      'At least 2 sellers in active follow-up',
    ]),
    keyDeliverables: JSON.stringify(['Conversation notes (CRM)', 'Follow-up sequences', 'Seller objection playbook']),
    estimatedWeeks: 8,
    status: 'locked',
  },
  {
    phaseOrder: 7,
    phaseCode: 'EVALUATION',
    phaseName: 'Deal Evaluation',
    description: 'Apply rigorous financial and qualitative evaluation to opportunities. Separate signal from noise.',
    whyItMatters: 'Most businesses are not worth buying. Rigorous evaluation protects your capital and time. A bad deal is worse than no deal.',
    entryCriteria: JSON.stringify(['Active seller conversations (2+)', 'Lender relationship established']),
    exitCriteria: JSON.stringify([
      'At least 1 deal in financial review stage',
      'Underwriting model applied to 5+ opportunities',
      'First LOI-worthy candidate identified',
    ]),
    keyDeliverables: JSON.stringify(['Underwriting models', 'Deal evaluation scorecard', 'Opportunity log']),
    estimatedWeeks: 6,
    status: 'locked',
  },
  {
    phaseOrder: 8,
    phaseCode: 'LOI',
    phaseName: 'LOI & Negotiation',
    description: 'Prepare and submit your Letter of Intent. Negotiate deal structure, price, and key terms.',
    whyItMatters: 'The LOI sets every expectation for the rest of the deal. Price, structure, exclusivity, and diligence terms all get anchored here.',
    entryCriteria: JSON.stringify(['Deal with GO verdict', 'At least 3 board members committed', 'M&A attorney identified']),
    exitCriteria: JSON.stringify(['LOI submitted', 'LOI accepted or negotiated to acceptance', 'Exclusivity period secured']),
    keyDeliverables: JSON.stringify(['LOI document', 'Deal structure memo', 'Negotiation notes']),
    estimatedWeeks: 2,
    status: 'locked',
  },
  {
    phaseOrder: 9,
    phaseCode: 'DILIGENCE',
    phaseName: 'Due Diligence',
    description: 'Conduct systematic due diligence across financial, legal, operational, and customer dimensions.',
    whyItMatters: 'Diligence reveals the gap between what was represented and what is real. Issues found in diligence are negotiating tools. Issues missed become losses.',
    entryCriteria: JSON.stringify(['LOI signed', 'Exclusivity period active', 'M&A attorney engaged']),
    exitCriteria: JSON.stringify([
      'Financial diligence complete',
      'Legal diligence complete',
      'All lender document requirements met',
      'No unresolved close-blocking issues',
    ]),
    keyDeliverables: JSON.stringify(['Diligence checklist (100% complete)', 'Issue log with resolutions', 'QoE summary']),
    estimatedWeeks: 6,
    status: 'locked',
  },
  {
    phaseOrder: 10,
    phaseCode: 'FINANCING',
    phaseName: 'Deal Financing',
    description: 'Secure the capital stack. SBA/conventional debt, seller note, investor equity, and operator contribution.',
    whyItMatters: 'Financing is where most deals die. Start the lender process early. The capital stack determines your returns and your risk.',
    entryCriteria: JSON.stringify(['Diligence 80%+ complete', 'Lender pre-approval in process', 'Capital stack modeled']),
    exitCriteria: JSON.stringify(['Lender commitment letter received', 'Seller note terms agreed', 'Capital stack fully covered']),
    keyDeliverables: JSON.stringify(['Lender commitment letter', 'Capital stack summary', 'Investor commitments']),
    estimatedWeeks: 6,
    status: 'locked',
  },
  {
    phaseOrder: 11,
    phaseCode: 'CLOSE',
    phaseName: 'Closing',
    description: 'Execute the closing. Coordinate attorneys, lender, seller, and all closing conditions.',
    whyItMatters: 'Closing requires total focus. Every open item must be resolved. This is when the deal either completes or falls apart.',
    entryCriteria: JSON.stringify(['Financing committed', 'Diligence complete', 'All closing conditions met']),
    exitCriteria: JSON.stringify(['Purchase agreement executed', 'Funds transferred', 'Ownership transferred']),
    keyDeliverables: JSON.stringify(['Signed purchase agreement', 'Closing checklist', 'Day-one operations plan']),
    estimatedWeeks: 2,
    status: 'locked',
  },
  {
    phaseOrder: 12,
    phaseCode: 'POST_CLOSE',
    phaseName: 'Post-Close Stabilization',
    description: 'Execute your 30/60/90 day stabilization plan. Retain key talent. Establish operating rhythm.',
    whyItMatters: 'Most value is created or destroyed in the first 90 days. Your credibility with employees, customers, and board is set here.',
    entryCriteria: JSON.stringify(['Closing complete', 'Ownership transferred']),
    exitCriteria: JSON.stringify([
      '30-day stabilization plan executed',
      'Key employee retention secured',
      'Financial reporting system operational',
      'Board reporting cadence established',
    ]),
    keyDeliverables: JSON.stringify(['30/60/90 plan', 'Employee retention agreements', 'Board report template']),
    estimatedWeeks: 12,
    status: 'locked',
  },
  {
    phaseOrder: 13,
    phaseCode: 'GROWTH',
    phaseName: 'Platform Growth',
    description: 'Grow the acquired platform. Optimize operations, expand margins, and build toward institutional quality.',
    whyItMatters: 'The acquisition is not the destination. Growth is where you build real enterprise value and create the platform for roll-up.',
    entryCriteria: JSON.stringify(['Post-close stabilization complete', 'Business cash flow positive']),
    exitCriteria: JSON.stringify([
      'EBITDA growth >10% vs. acquisition baseline',
      'Operating systems documented',
      'Management team strengthened',
    ]),
    keyDeliverables: JSON.stringify(['Quarterly board report', 'Operating metrics dashboard', 'Growth plan']),
    estimatedWeeks: 52,
    status: 'locked',
  },
  {
    phaseOrder: 14,
    phaseCode: 'ROLLUP',
    phaseName: 'Roll-Up Strategy',
    description: 'Execute a disciplined roll-up: acquire add-ons, integrate synergies, and build toward a platform exit.',
    whyItMatters: 'The multiple expansion from roll-up is where real wealth is built. Platforms sell at 7-12x. Individual businesses sell at 3-5x.',
    danaPenaQuote: '"Buy one. Fix it. Buy another. Repeat. Exit at 10x."',
    entryCriteria: JSON.stringify(['Platform operating profitably', 'Management team in place']),
    exitCriteria: JSON.stringify([
      'First add-on acquisition identified and modeled',
      'Roll-up thesis documented',
      'Platform EV trajectory modeled to exit',
    ]),
    keyDeliverables: JSON.stringify(['Roll-up thesis', 'Add-on target list', 'Platform EV model']),
    estimatedWeeks: 26,
    status: 'locked',
  },
  {
    phaseOrder: 15,
    phaseCode: 'EXIT',
    phaseName: 'Empire & Exit',
    description: 'Execute an institutional-quality exit or capital event. Strategic sale, private equity, or recapitalization.',
    whyItMatters: 'Everything you have built points here. The exit is where your equity converts to generational wealth.',
    danaPenaQuote: '"The first hundred million is the hardest."',
    entryCriteria: JSON.stringify(['Platform EBITDA >$2M', 'Management independent', 'Clean financials 3 years']),
    exitCriteria: JSON.stringify(['Investment banker engaged', 'CIM prepared', 'Transaction closed']),
    keyDeliverables: JSON.stringify(['CIM', 'Financial model for buyers', 'Management presentation']),
    estimatedWeeks: 26,
    status: 'locked',
  },
];

async function main() {
  // ─── System User ─────────────────────────────────────────────────────────
  console.log('Seeding system user...');
  const systemUser = await db.user.upsert({
    where: { email: 'marco@dominionedgeholdings.com' },
    update: { name: 'Marco Fernstaedt', role: 'owner' },
    create: { email: 'marco@dominionedgeholdings.com', name: 'Marco Fernstaedt', role: 'owner' },
  });
  console.log(`System user ready: ${systemUser.id}`);
  console.log(`\nEnsure .env contains:\nSYSTEM_USER_ID=${systemUser.id}\n`);

  // ─── Empire Phases ───────────────────────────────────────────────────────
  console.log('Seeding Empire Phases...');
  for (const phase of EMPIRE_PHASES) {
    await db.empirePhase.upsert({
      where: { phaseCode: phase.phaseCode },
      update: phase,
      create: phase,
    });
  }
  console.log(`Seeded ${EMPIRE_PHASES.length} Empire Phases.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
