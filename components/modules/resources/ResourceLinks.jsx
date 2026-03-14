import SectionHeader from '@/components/ui/SectionHeader';

const CATEGORIES = [
  {
    label: 'Target Lists & Registries',
    color: '#C9A84C',
    links: [
      { title: 'AZ OPM Registry (Arizona OPM licensed operators)', url: 'https://opm.azda.gov' },
      { title: 'AZPMA – Arizona Pest Management Association', url: 'https://www.azpma.org' },
      { title: 'NPMA – National Pest Management Association', url: 'https://www.npmapestworld.org' },
      { title: 'PCT Magazine – Top 100 PCOs', url: 'https://www.pctonline.com' },
    ],
  },
  {
    label: 'SBA & Financing',
    color: '#5A8DB5',
    links: [
      { title: 'SBA Arizona District Office', url: 'https://www.sba.gov/offices/district/az/phoenix' },
      { title: 'Live Oak Bank – SBA 7(a) for Acquisitions', url: 'https://www.liveoakbank.com' },
      { title: 'Newtek Business Services – SBA Lender', url: 'https://www.newtekone.com' },
      { title: 'SBA 7(a) Loan Program Overview', url: 'https://www.sba.gov/funding-programs/loans/7a-loans' },
    ],
  },
  {
    label: 'M&A & Deal Networks',
    color: '#8B6F9E',
    links: [
      { title: 'ACG Phoenix – Association for Corporate Growth', url: 'https://www.acg.org/arizona' },
      { title: 'BizBuySell – SMB Deal Flow (reference only)', url: 'https://www.bizbuysell.com' },
      { title: 'Axial – Lower Middle Market Deals', url: 'https://www.axial.net' },
      { title: 'Arizona State Bar – M&A Attorney Directory', url: 'https://www.azbar.org' },
    ],
  },
  {
    label: 'Valuation & QofE',
    color: '#7B9E87',
    links: [
      { title: 'AICPA ABV Directory – Accredited Business Valuators', url: 'https://www.aicpa.org/membership/join/credentials/abv' },
      { title: 'BVR – Business Valuation Resources', url: 'https://www.bvresources.com' },
      { title: 'Martindale-Hubbell – Attorney Ratings', url: 'https://www.martindale.com' },
    ],
  },
  {
    label: 'QLA Methodology',
    color: '#D4845A',
    links: [
      { title: 'Guthrie Castle – Dan Peña\'s QLA HQ', url: 'https://www.danpena.co.uk' },
      { title: 'Your First Hundred Million – Buy on Amazon', url: 'https://www.amazon.com/s?k=your+first+hundred+million+dan+pena' },
      { title: 'QLA Seminar Info', url: 'https://www.danpena.co.uk/seminars' },
    ],
  },
];

export default function ResourceLinks() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
      {CATEGORIES.map(cat => (
        <div key={cat.label} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '16px 20px' }}>
          <SectionHeader style={{ color: cat.color }}>{cat.label}</SectionHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cat.links.map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13, color: '#888', textDecoration: 'none', lineHeight: 1.5 }}
              >
                → {link.title}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
