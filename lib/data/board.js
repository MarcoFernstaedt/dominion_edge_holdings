export const CONTACT_STATUSES = [
  'Identified', 'Researched', 'Contacted', 'Responded',
  'Meeting Set', 'Pitch Delivered', 'Committed', 'Passed',
];

export const BOARD_SEATS = [
  {
    id: 'seat1', role: 'Industry Veteran', equityRange: '1.5–2%', priority: 'RECRUIT FIRST', color: '#C9A84C',
    description: 'Retired/semi-retired Regional VP or GM from Rollins, Orkin, Terminix, or Rentokil. Ran $20M–$100M territory.',
    why: 'Knows every operator in Phoenix. Validates multiples. Gives instant seller credibility. This name on your deck makes every subsequent board conversation easier.',
    whereTo: 'LinkedIn ("Rollins regional VP Arizona"), NPMA (npma.org), AZPMA (azpma.org), PCT Magazine',
    pitch: "I'm building a pest control acquisition platform in Phoenix targeting the $27B fragmented market. I want you as our founding industry board member — equity only, no capital required.",
  },
  {
    id: 'seat2', role: 'SBA Banker', equityRange: '0.5–1%', priority: null, color: '#5A8DB5',
    description: 'Currently or formerly at a bank with an active SBA 7(a) lending desk.',
    why: "Their lender relationships are worth more than personal capital. The SBA 7(a) loan is your primary financing vehicle for acquisitions of $500K to $5M.",
    whereTo: 'Live Oak Bank BDOs (LinkedIn), Western Alliance Bank Phoenix, Newtek Business Services, SBA Arizona District Office events',
    pitch: "Lead with Industry Veteran's name. First close within 12 months. Deal-by-deal relationship, not a one-time transaction.",
  },
  {
    id: 'seat3', role: 'M&A Attorney', equityRange: '0.5–1%', priority: null, color: '#8B6F9E',
    description: 'Phoenix-based. Has closed SMB service sector acquisitions.',
    why: 'Reviews LOIs, purchase agreements, deal structure. Deferred fees or success-fee arrangement possible at smaller boutique firms.',
    whereTo: 'ACG Phoenix (acg.org/arizona), AZ State Bar (azbar.org), LinkedIn ("M&A attorney Phoenix small business"), Martindale-Hubbell',
    pitch: "We're building a pest control acquisition platform. I need a deal-minded attorney who wants equity in the upside, not just an hourly rate.",
  },
  {
    id: 'seat4', role: 'Transaction CPA', equityRange: '0.5–1%', priority: null, color: '#7B9E87',
    description: 'Quality of Earnings experience. ABV (Accredited in Business Valuation) credential preferred.',
    why: 'Validates seller financials. Protects EBITDA integrity. Without credible QofE, sophisticated lenders will not close.',
    whereTo: 'ACG Phoenix events, AICPA ABV directory, LinkedIn ("quality of earnings Arizona"), BDO / RSM / Grant Thornton Phoenix offices',
    pitch: "I need a CPA who can run informal QofE on sub-$3M targets. Equity in exchange for your expertise.",
  },
  {
    id: 'seat5', role: 'Operations Executor', equityRange: '1–2%', priority: 'Future COO', color: '#D4845A',
    description: 'Has run multi-location field services. Pest control, HVAC, plumbing, commercial cleaning — any route-based service company.',
    why: "Runs acquired company day-to-day while Marco sources the next deal. Critical. You will be deal-making, not route-managing.",
    whereTo: 'LinkedIn ("operations manager pest control Phoenix"), AZPMA events, Indeed / ZipRecruiter advisory equity post',
    pitch: "I'm acquiring a pest control company in Phoenix. Once we close, I need you running day-to-day operations. Equity in the platform.",
  },
  {
    id: 'seat6', role: 'Capital Connector', equityRange: '0.5–1%', priority: null, color: '#C9A84C',
    description: 'Relationships at family offices, private equity, or HNW individuals in Scottsdale and Paradise Valley.',
    why: "Does not need to invest — needs to open doors. Phoenix has enormous family office wealth actively looking for deal flow in service businesses.",
    whereTo: 'ACG Phoenix, Arizona Community Foundation events, Scottsdale Chamber of Commerce, LinkedIn ("family office Phoenix")',
    pitch: "I'm building a pest control acquisition platform. I don't need your capital — I need your network.",
  },
];

export const OBJECTIONS = [
  {
    q: '"You have no track record."',
    a: "That's exactly why I'm building the board first. Your credibility IS the track record.",
  },
  {
    q: '"I\'m too busy."',
    a: 'This is 2–4 hours per quarter plus introductions when needed. That\'s it.',
  },
  {
    q: '"What\'s the equity worth?"',
    a: "At 5x EBITDA on our first acquisition, 1% is worth $40K–$125K at close alone. This is a founder position.",
  },
  {
    q: '"Why pest control?"',
    a: '$27B market, 26,000+ operators, highly fragmented. Phoenix is a top-5 pest-pressure metro — year-round demand, no seasonality, fastest-growing large city in the US. Baby boomer owners with no exit plan, never approached by a serious buyer. The national chains only target $3M+ companies. Below that is wide open.',
  },
];
