const TIMELINE = [
  {
    period: 'Months 1–3',
    label: 'Foundation & Intelligence',
    color: '#C9A84C',
    items: [
      'Website and email live',
      'LinkedIn rebuilt as Principal',
      'First 50 targets loaded into CRM',
      '1–2 board commitments secured',
    ],
  },
  {
    period: 'Months 3–6',
    label: 'Board Assembly',
    color: '#7B9E87',
    items: [
      '3–4 board members committed',
      'Industry Veteran locked in',
      'SBA Banker committed',
      'First 10 outreach letters sent',
    ],
  },
  {
    period: 'Months 6–12',
    label: 'Active Deal Sourcing',
    color: '#8B6F9E',
    items: [
      'Full board assembled (5–6 members)',
      'LLC formed',
      '100+ owner contacts made',
      '3 live deal opportunities open',
    ],
  },
  {
    period: 'Months 12–18',
    label: 'First Close',
    color: '#D4845A',
    items: [
      'LOI signed on platform company',
      'SBA 7(a) underwriting in process',
      'QofE completed',
      'First salary drawn from acquired business',
    ],
  },
];

const RESOURCES = [
  {
    category: 'Deal Sourcing',
    color: '#C9A84C',
    links: [
      { name: 'AZ OPM Registry', url: 'https://opm.azda.gov', desc: 'Every licensed pest control operator in AZ with owner name. Your master list.' },
      { name: 'AZ Corp Commission', url: 'https://azcc.gov', desc: 'Formation dates, owner names, statutory agents' },
      { name: 'BizBuySell', url: 'https://bizbuysell.com', desc: 'Valuation comps ONLY — never for deal sourcing' },
      { name: 'DealReach', url: 'https://dealreach.com', desc: 'Free buyer profile — passive broker deal flow' },
      { name: 'USA Spending', url: 'https://usaspending.gov', desc: 'SBA loan history on any business — public record' },
    ],
  },
  {
    category: 'Industry & Networking',
    color: '#5A8DB5',
    links: [
      { name: 'NPMA', url: 'https://npma.org', desc: 'National Pest Management Association' },
      { name: 'AZPMA', url: 'https://azpma.org', desc: 'Arizona Pest Management Association — state chapter events' },
      { name: 'ACG Phoenix', url: 'https://acg.org/arizona', desc: 'The best M&A room in Phoenix. Attend every event.' },
      { name: 'PCT Magazine', url: 'https://pctonline.com', desc: 'Industry publication — profiles veteran executives' },
      { name: 'SBA AZ District', url: 'https://sba.gov/offices/district/az', desc: 'Free lender events' },
    ],
  },
  {
    category: 'Legal & Financial',
    color: '#8B6F9E',
    links: [
      { name: 'AZ State Bar', url: 'https://azbar.org', desc: 'M&A attorney directory' },
      { name: 'Martindale-Hubbell', url: 'https://martindale.com', desc: 'Attorney directory with specialty filters' },
      { name: 'AICPA ABV', url: 'https://aicpa.org', desc: 'CPAs with Accredited in Business Valuation credential' },
      { name: 'Live Oak Bank', url: 'https://liveoakbank.com', desc: 'Most active SBA 7(a) lender for service business acquisitions' },
      { name: 'Newtek Business', url: 'https://newtekbusiness.com', desc: 'Top SBA 7(a) lender' },
    ],
  },
  {
    category: 'Your Brand',
    color: '#7B9E87',
    links: [
      { name: 'dominionedgeholdings.com', url: 'https://dominionedgeholdings.com', desc: 'Your live website' },
      { name: 'LinkedIn Profile', url: 'https://linkedin.com/in/marco-f-19a372219', desc: 'Principal profile' },
      { name: 'GitHub', url: 'https://github.com/marcofernstaedt', desc: 'Dev portfolio' },
    ],
  },
];

const PRINCIPLES = [
  'Board first. Before capital, before credit — assemble the board.',
  'Off-market deals only. BizBuySell is for amateurs and overpriced businesses.',
  'Speed. Decide fast, act fast, move on fast. Hesitation kills deals.',
  'OPM / OPC / OPE — leverage other people\'s money, credit, and experience.',
  'DSCR ≥ 1.25x. Every deal model starts here. If it doesn\'t clear, you don\'t pursue.',
  'The first acquisition is the hardest. Every one after gets easier — you have a platform.',
  '100 hours a week builds empires. At 20 hours — you\'ll get there. It just takes longer.',
  'Inaction disguised as preparation is still inaction. Move.',
];

export default function Resources() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto', color: '#E8E0D0' }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Resources</div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 28 }}>Every URL, timeline, and principle — in one place</div>

      {/* Timeline */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Realistic Timeline — 20 Hours/Week</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {TIMELINE.map(t => (
            <div key={t.period} style={{ background: '#111', border: `1px solid ${t.color}44`, borderTop: `3px solid ${t.color}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, color: t.color, fontWeight: 700, marginBottom: 2, letterSpacing: '0.05em' }}>{t.period}</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{t.label}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {t.items.map((item, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#CCC', display: 'flex', gap: 6, lineHeight: 1.4 }}>
                    <span style={{ color: t.color, flexShrink: 0, fontSize: 10, marginTop: 2 }}>◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Resource Links */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16 }}>Key Resources</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {RESOURCES.map(cat => (
            <div key={cat.category} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '16px 20px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: cat.color, marginBottom: 12, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cat.category}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cat.links.map(link => (
                  <div key={link.name} style={{ borderBottom: '1px solid #141414', paddingBottom: 10 }}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, color: '#E8E0D0', fontWeight: 500, textDecoration: 'none' }}
                      onMouseEnter={e => { e.target.style.color = cat.color; }}
                      onMouseLeave={e => { e.target.style.color = '#E8E0D0'; }}
                    >
                      {link.name} ↗
                    </a>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{link.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Peña's 8 Principles */}
      <div style={{ background: '#0F0F0F', border: '1px solid #1E1E1E', borderRadius: 8, padding: '20px 24px' }}>
        <div style={{ fontSize: 11, color: '#C9A84C', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 16, fontWeight: 700 }}>Peña's Eight Core Principles</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {PRINCIPLES.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, color: '#C9A84C', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{i + 1}.</span>
              <span style={{ fontSize: 13, color: '#AAA', lineHeight: 1.6 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
