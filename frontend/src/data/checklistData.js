export const PHASES = [
  {
    id: 'foundation',
    name: 'Foundation',
    color: '#C9A84C',
    items: [
      { id: 'f1', text: 'Read Your First Hundred Million (Dan Peña)', done: true },
      { id: 'f2', text: 'Define holding company name and brand identity', done: true },
      { id: 'f3', text: 'Build and publish holding company website', done: true },
      { id: 'f4', text: 'Set up professional domain email', done: true },
      { id: 'f5', text: 'Rebuild LinkedIn as Founder / Principal (not call center)', done: true },
      { id: 'f6', text: 'Select target industry using Peña\'s fragmentation criteria', done: true },
      { id: 'f7', text: 'Write 1-page industry thesis (why this industry, why now, why you)', done: false },
      { id: 'f8', text: 'Document target deal parameters ($1M–$5M revenue, EBITDA range, seller profile)', done: false },
      { id: 'f9', text: 'Defer LLC formation until board assembled (per Peña methodology)', done: false },
      { id: 'f10', text: 'Set up CRM for deal and board tracking', done: true },
    ],
  },
  {
    id: 'market',
    name: 'Market Intelligence',
    color: '#7B9E87',
    items: [
      { id: 'm1', text: 'Pull AZ OPM registry (opm.azda.gov) — full licensed operator list', done: false },
      { id: 'm2', text: 'Cross-reference AZ Corp Commission (azcc.gov) for owner names and formation dates', done: false },
      { id: 'm3', text: 'Build Google Maps scrape of "pest control Phoenix" — capture owner names, phones, reviews', done: false },
      { id: 'm4', text: 'Load first 50 targets into CRM with name, phone, email, years in business', done: false },
      { id: 'm5', text: 'Identify top 10 priority targets (15+ yrs, owner 55–70, no web presence, 3–5 trucks)', done: false },
      { id: 'm6', text: 'Research 3–5 comparable closed deals on BizBuySell for valuation benchmarks', done: false },
      { id: 'm7', text: 'Understand EBITDA multiples for pest control (4–5x SDE for owner-operated)', done: false },
      { id: 'm8', text: 'Pull SBA 7(a) public loan data on target companies (usaspending.gov)', done: false },
      { id: 'm9', text: 'Create DealReach buyer profile to capture passive broker deal flow', done: false },
      { id: 'm10', text: 'Map Phoenix market: residential vs commercial concentration', done: false },
    ],
  },
  {
    id: 'board',
    name: 'Board Assembly',
    color: '#8B6F9E',
    items: [
      { id: 'b1', text: 'Draft 1-page board pitch deck (thesis, criteria, equity offer, ask)', done: false },
      { id: 'b2', text: 'Write personalized board invitation email template', done: false },
      { id: 'b3', text: 'Identify 5–10 Industry Veteran candidates (ex-Rollins/Orkin/Terminix regional VPs)', done: false },
      { id: 'b4', text: 'Make first Industry Veteran outreach — LinkedIn + email', done: false },
      { id: 'b5', text: 'Secure Industry Veteran commitment (Board Seat 1)', done: false },
      { id: 'b6', text: 'Identify SBA Banker candidates (Live Oak Bank, Western Alliance, Newtek)', done: false },
      { id: 'b7', text: 'Make SBA Banker outreach — lead with Veteran\'s name', done: false },
      { id: 'b8', text: 'Secure SBA Banker commitment (Board Seat 2)', done: false },
      { id: 'b9', text: 'Identify M&A Attorney candidates via ACG Phoenix', done: false },
      { id: 'b10', text: 'Attend first ACG Phoenix event — collect 5+ business cards', done: false },
      { id: 'b11', text: 'Secure M&A Attorney commitment (Board Seat 3)', done: false },
      { id: 'b12', text: 'Identify Transaction CPA (QofE experience, ABV credential)', done: false },
      { id: 'b13', text: 'Secure Transaction CPA commitment (Board Seat 4)', done: false },
      { id: 'b14', text: 'Identify Operations Executor / COO candidate', done: false },
      { id: 'b15', text: 'Secure Operations Executor commitment (Board Seat 5)', done: false },
      { id: 'b16', text: 'Identify Capital Connector (Scottsdale / Paradise Valley relationships)', done: false },
      { id: 'b17', text: 'Secure Capital Connector commitment (Board Seat 6)', done: false },
      { id: 'b18', text: 'Form LLC (minimum 3 board members committed)', done: false },
      { id: 'b19', text: 'Issue equity agreements (0.5–2% each, no cash)', done: false },
      { id: 'b20', text: 'Hold first board strategy call — align on deal criteria, intros, 90-day actions', done: false },
    ],
  },
  {
    id: 'sourcing',
    name: 'Deal Sourcing',
    color: '#D4845A',
    items: [
      { id: 's1', text: 'Send first 10 outreach letters (handwritten or high-quality print — no cold email first touch)', done: false },
      { id: 's2', text: 'Follow-up calls — 5–7 days after letter delivery', done: false },
      { id: 's3', text: 'Deliver opening line: "Not a broker. Not here to lowball. Building a platform."', done: false },
      { id: 's4', text: 'Complete first 50 outreach contacts', done: false },
      { id: 's5', text: 'Track all contacts in CRM — date, method, response, follow-up due', done: false },
      { id: 's6', text: 'Set up 3 discovery calls from initial outreach batch', done: false },
      { id: 's7', text: 'Attend AZPMA event — introduce as acquisition principal', done: false },
      { id: 's8', text: 'Attend NPMA national convention — industry veteran connections', done: false },
      { id: 's9', text: 'Complete 100 total outreach contacts', done: false },
      { id: 's10', text: 'Have 5+ serious seller conversations (not brokers)', done: false },
      { id: 's11', text: 'Develop 3 live deal opportunities (willing to talk structure)', done: false },
      { id: 's12', text: 'Ask every interested seller: "When would be right for you?"', done: false },
    ],
  },
  {
    id: 'evaluation',
    name: 'Deal Evaluation',
    color: '#5A8DB5',
    items: [
      { id: 'e1', text: 'Request 3 years of P&L and tax returns for serious targets', done: false },
      { id: 'e2', text: 'Calculate Seller\'s Discretionary Earnings (SDE) for each target', done: false },
      { id: 'e3', text: 'Build DSCR model: Annual NOI ÷ Annual Debt Service ≥ 1.25x (SBA requirement)', done: false },
      { id: 'e4', text: 'Engage Transaction CPA board member for informal QofE review', done: false },
      { id: 'e5', text: 'Assess customer concentration — no single customer over 20% of revenue', done: false },
      { id: 'e6', text: 'Review contract terms — percentage on recurring monthly/quarterly vs one-time', done: false },
      { id: 'e7', text: 'Review employee roster — assess key-person dependency risk', done: false },
      { id: 'e8', text: 'Check licensing, insurance, and bonding (AZ OPM compliance)', done: false },
      { id: 'e9', text: "Research owner's BBB history and online reputation", done: false },
      { id: 'e10', text: 'Score target on deal criteria matrix — GO / CONDITIONAL GO / NO-GO', done: false },
    ],
  },
  {
    id: 'loi',
    name: 'LOI & Structuring',
    color: '#C9A84C',
    items: [
      { id: 'l1', text: 'Engage M&A Attorney board member for LOI template review', done: false },
      { id: 'l2', text: 'Structure deal: SBA 7(a) 70–80% + Seller Note 20–30% + 10% down', done: false },
      { id: 'l3', text: 'Negotiate seller note terms — 3–5 year payoff from business cash flow', done: false },
      { id: 'l4', text: 'Draft and present Letter of Intent', done: false },
      { id: 'l5', text: 'Get LOI signed — enter exclusivity period (30–60 days standard)', done: false },
      { id: 'l6', text: 'Engage SBA Banker board member — submit deal package for pre-approval', done: false },
      { id: 'l7', text: 'Arrange formal Quality of Earnings (QofE) analysis from Transaction CPA', done: false },
      { id: 'l8', text: 'Negotiate final purchase price based on QofE findings', done: false },
      { id: 'l9', text: 'Draft Purchase Agreement with M&A Attorney', done: false },
      { id: 'l10', text: 'Get Purchase Agreement signed by both parties', done: false },
    ],
  },
  {
    id: 'financing',
    name: 'Financing & Close',
    color: '#7B9E87',
    items: [
      { id: 'fi1', text: 'Submit formal SBA 7(a) loan application with full business package', done: false },
      { id: 'fi2', text: 'Provide lender: 3-yr P&L, tax returns, business plan, board bios', done: false },
      { id: 'fi3', text: 'Clear SBA underwriting — respond to all lender questions within 24 hours', done: false },
      { id: 'fi4', text: 'Secure SBA loan commitment letter', done: false },
      { id: 'fi5', text: 'Coordinate closing with M&A Attorney, title/escrow, seller, and lender', done: false },
      { id: 'fi6', text: 'Confirm LLC formed before close — entity must exist', done: false },
      { id: 'fi7', text: 'Sign all closing documents', done: false },
      { id: 'fi8', text: 'Fund and close — you now own a cash-flowing business', done: false },
      { id: 'fi9', text: 'Announce acquisition — press release to Phoenix business media', done: false },
      { id: 'fi10', text: 'Send customer transition letter with continuity messaging', done: false },
    ],
  },
  {
    id: 'postacq',
    name: 'Post-Acquisition',
    color: '#8B6F9E',
    items: [
      { id: 'pa1', text: 'Install Operations Executor as day-to-day COO', done: false },
      { id: 'pa2', text: 'Set up QuickBooks from Day 1', done: false },
      { id: 'pa3', text: 'Draw your first salary from the acquired business', done: false },
      { id: 'pa4', text: 'Audit all customer contracts — confirm recurring vs one-time breakdown', done: false },
      { id: 'pa5', text: 'Identify quick-win upsells to existing customer base (termite, rodent add-ons)', done: false },
      { id: 'pa6', text: 'Begin sourcing Target 2 — use platform company credibility for next deal', done: false },
      { id: 'pa7', text: 'Build monthly board update cadence — keep all members engaged', done: false },
      { id: 'pa8', text: 'Track DSCR monthly — ensure debt service covered at all times', done: false },
      { id: 'pa9', text: 'Develop integration playbook for next acquisition', done: false },
      { id: 'pa10', text: 'Target 3–5 acquisitions for roll-up and eventual exit to PE or strategic buyer', done: false },
    ],
  },
  {
    id: 'exit',
    name: 'Exit',
    color: '#D4845A',
    items: [
      { id: 'ex1', text: 'Hit $5M+ combined revenue across portfolio companies', done: false },
      { id: 'ex2', text: 'Achieve 3-year clean audited financials on platform company', done: false },
      { id: 'ex3', text: 'Engage investment banker for exit process (not M&A attorney — banker this time)', done: false },
      { id: 'ex4', text: 'Prepare Confidential Information Memorandum (CIM) with banker', done: false },
      { id: 'ex5', text: 'Run controlled auction process — 3–5 qualified buyers minimum', done: false },
      { id: 'ex6', text: 'Negotiate final exit — target 6–8x EBITDA for PE sale', done: false },
      { id: 'ex7', text: 'Structure earnout if necessary — ensure it is achievable and capped', done: false },
      { id: 'ex8', text: 'Close exit transaction — transfer to acquirer', done: false },
      { id: 'ex9', text: 'Redeploy capital into next acquisition platform, larger industry', done: false },
      { id: 'ex10', text: 'Execute Peña Methodology at scale — $100M+ enterprise value', done: false },
    ],
  },
];

export const AFFIRMATIONS = [
  'I am building Dominion Edge Holdings into a multi-acquisition empire.',
  'My board is my balance sheet. I am assembling it now.',
  '150–200 targets in Phoenix. I go find them today.',
  'I am not a call center employee. I am a principal building generational wealth.',
  'Every call I make today is one step closer to my first close.',
  'Off-market deals only. I go direct to owners. Brokers are for amateurs.',
  'Board first. Everything else is second.',
  'DSCR ≥ 1.25x. The math decides. Nothing else.',
  'OPM. OPC. OPE. I need none of my own.',
  'The next 18 months change the trajectory of the next 18 years.',
  'I move fast. I decide fast. Hesitation kills deals.',
  'The Phoenix market is fragmented. I am the consolidator.',
  'My board members are investing their credibility in me. I will deliver.',
  'Inaction disguised as preparation is still inaction. I move today.',
  'The SBA 7(a) is my weapon. I know the math cold.',
];

export const BOARD_SEATS = [
  {
    id: 'seat1',
    role: 'Industry Veteran',
    equityRange: '1.5–2%',
    priority: 'RECRUIT FIRST',
    description: 'Retired/semi-retired Regional VP or GM from Rollins, Orkin, Terminix, or Rentokil. Ran $20M–$100M territory.',
    why: 'Knows every operator in Phoenix. Validates multiples. Gives instant seller credibility. This name on your deck makes every subsequent board conversation easier.',
    whereTo: 'LinkedIn ("Rollins regional VP Arizona"), NPMA (npma.org), AZPMA (azpma.org), PCT Magazine',
    pitch: 'I\'m building a pest control acquisition platform in Phoenix targeting the $27B fragmented market. I want you as our founding industry board member — equity only, no capital required.',
    color: '#C9A84C',
  },
  {
    id: 'seat2',
    role: 'SBA Banker',
    equityRange: '0.5–1%',
    priority: null,
    description: 'Currently or formerly at a bank with an active SBA 7(a) lending desk.',
    why: 'Their lender relationships are worth more than personal capital. The SBA 7(a) loan is your primary financing vehicle for acquisitions of $500K to $5M.',
    whereTo: 'Live Oak Bank BDOs (LinkedIn), Western Alliance Bank Phoenix, Newtek Business Services, SBA Arizona District Office events',
    pitch: 'Lead with Industry Veteran\'s name. "First close within 12 months. Deal-by-deal relationship, not a one-time transaction."',
    color: '#5A8DB5',
  },
  {
    id: 'seat3',
    role: 'M&A Attorney',
    equityRange: '0.5–1%',
    priority: null,
    description: 'Phoenix-based. Has closed SMB service sector acquisitions.',
    why: 'Reviews LOIs, purchase agreements, deal structure. Deferred fees or success-fee arrangement possible at smaller boutique firms.',
    whereTo: 'ACG Phoenix (acg.org/arizona), AZ State Bar (azbar.org), LinkedIn ("M&A attorney Phoenix small business"), Martindale-Hubbell',
    pitch: 'We\'re building a pest control acquisition platform. I need a deal-minded attorney who wants equity in the upside, not just an hourly rate.',
    color: '#8B6F9E',
  },
  {
    id: 'seat4',
    role: 'Transaction CPA',
    equityRange: '0.5–1%',
    priority: null,
    description: 'Quality of Earnings experience. ABV (Accredited in Business Valuation) credential preferred.',
    why: 'Validates seller financials. Protects EBITDA integrity. Without credible QofE, sophisticated lenders will not close.',
    whereTo: 'ACG Phoenix events, AICPA ABV directory, LinkedIn ("quality of earnings Arizona"), BDO / RSM / Grant Thornton Phoenix offices',
    pitch: 'I need a CPA who can run informal QofE on sub-$3M targets and eventually lead the formal QofE on our first close. Equity in exchange for your expertise.',
    color: '#7B9E87',
  },
  {
    id: 'seat5',
    role: 'Operations Executor',
    equityRange: '1–2%',
    priority: 'Future COO',
    description: 'Has run multi-location field services. Pest control, HVAC, plumbing, commercial cleaning — any route-based service company.',
    why: 'Runs acquired company day-to-day while Marco sources the next deal. Critical. You will be deal-making, not route-managing.',
    whereTo: 'LinkedIn ("operations manager pest control Phoenix"), AZPMA events, Indeed / ZipRecruiter advisory equity post',
    pitch: 'I\'m acquiring a pest control company in Phoenix. Once we close, I need you running day-to-day operations. Equity in the platform, not just the first acquisition.',
    color: '#D4845A',
  },
  {
    id: 'seat6',
    role: 'Capital Connector',
    equityRange: '0.5–1%',
    priority: null,
    description: 'Relationships at family offices, private equity, or HNW individuals in Scottsdale and Paradise Valley.',
    why: 'Does not need to invest — needs to open doors. Phoenix has enormous family office wealth actively looking for deal flow in service businesses.',
    whereTo: 'ACG Phoenix, Arizona Community Foundation events, Scottsdale Chamber of Commerce, LinkedIn ("family office Phoenix")',
    pitch: 'I\'m building a pest control acquisition platform. I don\'t need your capital — I need your network. One intro to the right family office changes everything.',
    color: '#C9A84C',
  },
];

export const CONTACT_STATUSES = [
  'Identified',
  'Researched',
  'Contacted',
  'Responded',
  'Meeting Set',
  'Pitch Delivered',
  'Committed',
  'Passed',
];

export const DEAL_STAGES = [
  'Identified',
  'Contacted',
  'Conversation',
  'Diligence',
  'LOI Sent',
  'Under Contract',
  'Closed',
  'Dead',
];

export const SCRIPTS = [
  {
    id: 'cold-call',
    title: 'Cold Call Opener (Seller)',
    icon: '📞',
    deliveryNote: 'Tone is calm, direct, peer-level. Never sound desperate. If they say not interested: "Understood. Would it be okay if I checked back in 6 months? Markets change, and so do circumstances."',
    text: `Hi, is this [Owner Name]? My name is Marco Fernstaedt — I'm a principal with Dominion Edge Holdings, a private acquisition firm based here in Phoenix.

I'm not a broker and I'm not here to lowball you. I'm building a regional pest control platform and I make it a point to speak with the best operators in the metro — your company came up.

I'm not asking you to sell anything today. I just want to have a conversation — whether that's about you eventually joining our platform, or about your exit, whenever that looks right for you.

Do you have 10 minutes in the next week or two?`,
  },
  {
    id: 'followup-call',
    title: 'Follow-Up Call (Post-Letter)',
    icon: '📬',
    deliveryNote: 'If voicemail, leave this exactly as scripted. Speak slowly. Mention the letter. End with your callback number twice.',
    text: `Hi [Owner Name] — Marco Fernstaedt, Dominion Edge Holdings. I sent you a letter about 5 days ago — you may have seen it, you may not.

I'll be brief: I'm building an acquisition platform focused on established pest control operations in the Phoenix metro. I'm not a broker. I don't use intermediaries. I talk directly to operators.

My interest in your company is straightforward — you've been in business [X years], you've built something real, and I want to understand your business and where your head is at for the future.

Could we find 20 minutes this week?`,
  },
  {
    id: 'discovery-call',
    title: 'Discovery Call Framework (First Seller Meeting)',
    icon: '🤝',
    deliveryNote: 'Listen 80% of the time. Let them talk. The seller who talks most in a first call signs first. Your job is to surface motivation, not pitch.',
    text: `Opening: "Thank you for your time. My goal today is just to understand your business — no pressure, no pitch."

Questions:
1. How long have you been running the business?
2. What does your customer mix look like — residential, commercial, or mixed?
3. How many trucks are you running right now?
4. Do you have a management layer, or is it mostly you running the show?
5. What does your week look like day-to-day?
6. Have you had any conversations with buyers before?
7. If you think about the next 3–5 years — what does that look like for you and the business?
8. Is there a number you've had in your head for what the business is worth?

Close: "I appreciate you being straight with me. Let me run some numbers on our end and come back to you with a range of what a structure could look like. No obligation on either side. Would that be alright?"`,
  },
  {
    id: 'board-veteran',
    title: 'Board Invitation Email (Industry Veteran)',
    icon: '🏆',
    deliveryNote: 'Always research their specific tenure and mention it by name. Generic emails get deleted.',
    text: `Subject: Advisory Board — Pest Control Acquisition Platform (Phoenix)

[First Name],

My name is Marco Fernstaedt. I'm the principal of Dominion Edge Holdings, a private acquisition firm I'm building to consolidate established pest control operators in the Phoenix metro.

Your background at [Company] — specifically [specific tenure / achievement] — is exactly what I'm looking for in a founding advisory board member.

What I'm offering: founding equity (1.5–2%), no capital required, and a front-row seat on a platform acquisition play in one of the fastest-growing pest markets in the country.

I'm not asking for a commitment. I'm asking for 30 minutes.

Would you be open to a call this week or next?

Marco Fernstaedt
Principal, Dominion Edge Holdings
marco@dominionedgeholdings.com
dominionedgeholdings.com`,
  },
  {
    id: 'board-banker',
    title: 'Board Invitation Email (SBA Banker)',
    icon: '🏦',
    deliveryNote: 'Always lead with the Industry Veteran\'s name. Credibility transfers directly.',
    text: `Subject: SBA Advisory Role — Pest Control Acquisition Platform (Phoenix)

[First Name],

I'm Marco Fernstaedt, Principal of Dominion Edge Holdings. We're building a pest control acquisition platform in Phoenix — first acquisition within 12 months.

Our industry board member is [Veteran Name], formerly [Title] at [Company].

I'm looking for an SBA lending professional who understands service business acquisitions and wants a seat at the table from Day 1. This is a deal-by-deal relationship, not a one-time transaction.

0.5–1% founding advisor equity. I'd like 20 minutes to walk you through our first target profile.

Are you available this week?

Marco Fernstaedt
Principal, Dominion Edge Holdings`,
  },
  {
    id: 'verbal-pitch',
    title: 'One-Sentence Board Pitch (Verbal)',
    icon: '💬',
    deliveryNote: 'Memorize this exactly. Use it at ACG events, AZPMA, anywhere you introduce yourself. Deliver at normal conversational pace. Stop talking after. Let them respond.',
    text: `I'm building a pest control acquisition platform in Phoenix targeting the $27 billion fragmented pest control industry — I'm offering you founding equity in exchange for your expertise and relationships as we execute our first acquisition.`,
  },
];

export const AGENT_CONFIGS = [
  {
    id: 'pena-coach',
    name: 'Peña Coach',
    icon: '◆',
    title: 'QLA Methodology & Accountability',
    tagline: 'What would Peña do? Move.',
    color: '#C9A84C',
    suggestedPrompts: [
      'Am I ready to start making outreach calls?',
      "I've been preparing for 3 weeks and haven't called anyone. Call me out.",
      'Walk me through assembling a board from zero credibility.',
      'I got rejected by 10 sellers in a row. What\'s your take?',
      'Should I form my LLC before my board is assembled?',
    ],
    systemPrompt: `You are a strict QLA (Quantum Leap Acquisition) coach modeled on Dan Peña's methodology from "Your First Hundred Million." You are coaching Marco Fernstaedt, Principal of Dominion Edge Holdings — a private acquisition firm targeting pest control companies in the Phoenix metro ($1.5M–$3M revenue, $200K–$500K EBITDA, $800K–$2.5M purchase price).

Marco's current status:
- Board seats filled: 0 of 6
- Website: live at dominionedgeholdings.com
- LinkedIn: rebuilt as Principal
- Industry selected: Pest Control, Phoenix Metro
- Time available: 20 hours per week
- Capital available: zero personal capital (OPM/OPC/OPE model)

Your coaching style:
- Direct, no-nonsense, never sugarcoats
- Never flatters or coddles
- Calls out inaction disguised as preparation
- References Peña's exact principles
- Pushes for fast action over perfect preparation

CRITICAL: Every single response MUST end with one specific, concrete action Marco can take in the next 24 hours. Format it as: "Your 24-hour action: [specific action]"

Key Peña principles you enforce:
1. Board first. Before capital, before credit — assemble the board.
2. Off-market deals only. BizBuySell is for amateurs.
3. Speed. Decide fast, act fast, move on fast.
4. OPM/OPC/OPE — leverage other people's money, credit, and experience.
5. DSCR ≥ 1.25x. Every deal model starts here.
6. The first acquisition is the hardest. Every one after gets easier.
7. 100 hours a week builds empires. At 20 hours — you'll get there. It just takes longer.
8. Inaction disguised as preparation is still inaction. Move.`,
  },
  {
    id: 'deal-scout',
    name: 'Deal Scout',
    icon: '◎',
    title: 'Target Evaluation & DSCR Math',
    tagline: 'Score it. Model it. Go or no-go.',
    color: '#5A8DB5',
    suggestedPrompts: [
      'Score this target: 18 years in business, 4 trucks, owner 63, $1.8M revenue, $280K SDE, no web presence.',
      'Model DSCR on a $1.5M SBA loan at current rates over 10 years.',
      'What red flags immediately kill a pest control deal?',
      'How do I calculate SDE from a P&L a seller just handed me?',
      'What customer concentration ratio disqualifies a deal for SBA underwriting?',
    ],
    systemPrompt: `You are Deal Scout, a specialized deal evaluation agent for Dominion Edge Holdings. You evaluate pest control acquisition targets against QLA criteria and SBA requirements.

Target profile you're evaluating against:
- Industry: Pest Control, Phoenix Metro
- Revenue: $1.5M–$3M
- EBITDA/SDE: $200K–$500K
- Purchase price: $800K–$2.5M (4–5x SDE)
- Financing: SBA 7(a) + Seller Note
- DSCR requirement: ≥ 1.25x (non-negotiable)
- Customer concentration: No single customer over 20% of revenue
- Contract mix: 60%+ recurring residential preferred

SBA monthly payment formula you use explicitly:
P × [r(1+r)^n] / [(1+r)^n − 1]
Where P = loan amount, r = monthly rate (annual ÷ 12), n = 120 months
Current SBA 7(a) rate: approximately 11.25% (prime + 2.75%)

Scoring criteria (score each 1–10):
1. Seller motivation (age, health, family, competition)
2. Revenue quality (recurring % vs one-time)
3. Years in business (15+ preferred)
4. Owner age (55–70 preferred)
5. Customer concentration risk (lower = better)
6. Licensing compliance (AZ OPM)
7. Key-person dependency risk (lower = better)
8. Route density (Phoenix metro preferred)

Red flags that immediately kill a deal:
- Owner is only licensed applicator (SBA won't fund without licensed replacement)
- Single customer over 20% of revenue
- Revenue declining 2+ consecutive years
- Active liens on business assets
- No recurring contracts
- Pattern of BBB complaints

Always show full DSCR math step by step. Return clear GO / CONDITIONAL GO / NO-GO verdicts with specific reasoning.`,
  },
  {
    id: 'outreach-writer',
    name: 'Outreach Writer',
    icon: '◻',
    title: 'Letters, Scripts & Email Sequences',
    tagline: 'Words that open doors.',
    color: '#7B9E87',
    suggestedPrompts: [
      'Write a cold outreach letter to Ray Gutierrez, pest control owner, 22 years in business.',
      'Write a follow-up email after leaving a voicemail with no response for 10 days.',
      'Draft a LinkedIn connection request to a retired Rollins regional VP in Phoenix.',
      'Write the 3-touch follow-up sequence for a seller who was interested then went cold.',
      'Draft the board invitation email for an SBA banker after the veteran is already committed.',
    ],
    systemPrompt: `You are Outreach Writer, a specialized copywriting agent for Dominion Edge Holdings. You write ready-to-send cold letters, follow-up sequences, board invitation emails, and LinkedIn outreach.

Marco's positioning you always reinforce:
- Not a broker. Not a national chain.
- Building a regional pest control platform in Phoenix.
- Deals directly with owners — no intermediaries.
- Offers fair value, not lowball offers.
- Principal of Dominion Edge Holdings (dominionedgeholdings.com)
- Email: marco@dominionedgeholdings.com

Two audiences you write for:
1. Baby boomer sellers (55–70) who've built their pest control business over 15–25 years and have never been approached by a serious, professional buyer. They need to feel respected, understood, and not pressured. The first touch is always direct mail (physical letter), not email. Tone: direct, respectful, peer-level. Never sound like a broker.

2. Board candidates — professional advisors (industry veterans, SBA bankers, M&A attorneys, CPAs, operators, capital connectors) who need a specific, compelling reason to say yes to equity in exchange for their expertise. Tone: professional, confident, specific about value.

Writing rules:
- Always use [BRACKETS] for personalization fields
- Never generic — always reference something specific about the person/company
- Keep letters under 250 words
- Keep emails under 200 words
- When use case is ambiguous, offer 2 tone variations: Direct and Warmer
- Copy should be ready to send — no additional editing needed`,
  },
  {
    id: 'board-builder',
    name: 'Board Builder',
    icon: '◈',
    title: 'Advisor Recruitment & Equity Strategy',
    tagline: 'Your board is your balance sheet.',
    color: '#8B6F9E',
    suggestedPrompts: [
      'I found a retired Orkin district manager on LinkedIn. Walk me through the approach.',
      "A board candidate asked what DEH's track record is. How do I handle that?",
      'Give me the full 10-minute pitch I deliver on a first board call.',
      'What\'s the right equity split across all 6 seats?',
      'How do I run the first board meeting once I have 3 members committed?',
    ],
    systemPrompt: `You are Board Builder, a specialized advisor recruitment agent for Dominion Edge Holdings. You guide Marco through every stage of assembling his 6-member advisory board.

The 6 seats and their equity ranges:
1. Industry Veteran — 1.5–2% (RECRUIT FIRST — always)
2. SBA Banker — 0.5–1%
3. M&A Attorney — 0.5–1%
4. Transaction CPA — 0.5–1%
5. Operations Executor (Future COO) — 1–2%
6. Capital Connector — 0.5–1%

Total equity allocated: approximately 4.5–8% of Dominion Edge Holdings

Board objection handling scripts:
"You have no track record."
→ "That's exactly why I'm building the board first. Your credibility IS the track record."

"I'm too busy."
→ "This is 2–4 hours per quarter plus introductions when needed. That's it."

"What's the equity worth?"
→ "At 5x EBITDA on our first acquisition, 1% is worth $40K–$125K at close alone. This is a founder position."

"Why pest control?"
→ "$27B market, 26,000+ operators, highly fragmented. Phoenix is a top-5 pest-pressure metro — year-round demand, no seasonality, fastest-growing large city in the US. Baby boomer owners with no exit plan, never approached by a serious buyer. The national chains only target $3M+ companies. Below that is wide open."

Current board status: 0 of 6 seats filled.
Sequence: Always start with Industry Veteran. Every subsequent pitch leads with the Veteran's name.

Guide Marco through: candidate identification → initial outreach → first call pitch → objection handling → commitment → equity agreement → first board meeting.`,
  },
  {
    id: 'deal-structurer',
    name: 'Deal Structurer',
    icon: '⬡',
    title: 'Financing, LOI & Deal Architecture',
    tagline: 'Structure the deal. Close it.',
    color: '#D4845A',
    suggestedPrompts: [
      'Model: $2.1M purchase price, SBA at 75%, seller carries 25% at 6% over 5 years. Show full math.',
      "What's the SBA minimum down payment and how do I structure around it with no cash?",
      'Walk me through every section of an LOI for a pest control acquisition.',
      'A seller wants all-cash at $2M. How do I restructure this?',
      'What does a seller note negotiation look like — what do I ask for, what do they push back on?',
    ],
    systemPrompt: `You are Deal Structurer, a specialized financing and deal architecture agent for Dominion Edge Holdings. You model SBA 7(a) + seller note stacks, build LOI frameworks, and stress-test deal math against SBA requirements.

Critical constraint: Marco has zero personal capital. Every structure you propose must work using OPM/OPC/OPE only.

Standard deal structure:
- SBA 7(a): 70–80% of purchase price
- Seller note: 20–30% of purchase price
- Down payment: 10% (often financed via seller note or rollover equity)
- SBA rate: ~11.25% (prime + 2.75%), 10-year amortization
- DSCR requirement: ≥ 1.25x (non-negotiable SBA requirement)

SBA monthly payment formula (always show explicitly):
P × [r(1+r)^n] / [(1+r)^n − 1]
Where P = loan amount, r = monthly rate (annual ÷ 12), n = 120 months

LOI standard terms:
- Purchase price and structure breakdown
- Exclusivity period: 30–60 days standard
- Due diligence: 3 years P&L, tax returns, customer contracts, licenses
- Transition assistance: 90 days from seller — non-negotiable
- Non-compete: 2–3 years, Phoenix metro, pest control industry
- Working capital adjustment: agree on normalized working capital at close
- Representations and warranties
- SBA loan approval contingency

Seller note negotiation:
- Marco asks for: 5–7 year term, 4–5% interest, interest-only first year
- Seller typically pushes for: 3–4 year term, 6–7% interest, full amortization
- Compromise zone: 5 years, 5–6%, no balloon

Always show full amortization math. Always check DSCR. If DSCR fails, show exactly what needs to change (price reduction, extended term, or more SDE).`,
  },
  {
    id: 'market-intel',
    name: 'Market Intel',
    icon: '◑',
    title: 'Industry Research & Valuation Benchmarks',
    tagline: 'Know the market cold.',
    color: '#5A8DB5',
    suggestedPrompts: [
      'What are current EBITDA multiples for pest control acquisitions under $3M?',
      'Who are the biggest regional operators in Phoenix I need to know?',
      "What makes a pest control company's revenue high quality vs low quality?",
      'Walk me through the full Phoenix pest control market opportunity.',
      'What does Rollins typically pay for small acquisitions and how do I compete?',
    ],
    systemPrompt: `You are Market Intel, a specialized industry research agent for Dominion Edge Holdings. You provide deep Phoenix pest control market intelligence, valuation benchmarks, and competitive landscape analysis.

Key market facts you know cold:
- US pest control market: $27B+ annually
- 26,000+ operators nationally, highly fragmented
- Phoenix Metro is a top-5 pest-pressure city (scorpions, termites, cockroaches, rodents — year-round demand)
- Phoenix is the fastest-growing large city in the US
- Baby boomer succession gap: owners 55–70 with no exit plan, never approached by a serious buyer
- National chains (Rollins, Terminix, Rentokil) target $3M+ revenue companies — sub-$3M space is wide open

Valuation benchmarks (sub-$3M pest control, owner-operated):
- Revenue multiple: 0.6–1.0x annual revenue
- SDE multiple: 4–5x (owner-operated, residential-heavy)
- EBITDA multiple: 4–6x (if management in place)
- Rollins/Terminix typically pay: 6–8x EBITDA for acquisitions (but minimum $3M revenue)
- Why Marco can compete below $3M: nationals don't want the integration headache; Marco offers speed, certainty, and local continuity

Revenue quality factors (high to low):
1. Recurring monthly/quarterly contracts (highest quality)
2. Annual prepaid programs
3. Spot treatment repeat customers
4. One-time call-backs (lowest quality)

Key Phoenix operators to know:
- Western Exterminator (regional)
- Rottler Pest Solutions (expanding)
- Arizona Pest Control (local)
- Truly Nolen (regional chain)
- Bug Out Service (independent)

AZ OPM registry at opm.azda.gov is the master list. Every licensed operator in AZ with owner name attached.

Provide analysis that makes Marco the most informed person in any room about Phoenix pest control market dynamics, valuations, and acquisition strategy.`,
  },
];
