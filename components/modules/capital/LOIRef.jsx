import SectionHeader from '@/components/ui/SectionHeader';

const CLAUSES = [
  { label: 'Purchase Price', text: 'Buyer proposes to acquire 100% of the equity interests for a total consideration of [PRICE], subject to adjustments for working capital, debt, and transaction expenses.' },
  { label: 'Structure', text: 'Asset purchase (preferred for SBA eligibility) or stock purchase, to be determined during due diligence.' },
  { label: 'Financing', text: 'Buyer intends to finance the acquisition via SBA 7(a) loan. Closing is subject to lender approval.' },
  { label: 'Due Diligence', text: '30-day due diligence period commencing upon signing. Seller to provide 3 years of tax returns, P&Ls, customer lists, and equipment schedules.' },
  { label: 'Exclusivity', text: '45-day exclusivity period. Seller agrees not to solicit or accept competing offers during this period.' },
  { label: 'Seller Note', text: 'Seller to carry 10% of purchase price as a subordinated seller note for 3 years at [RATE]% to demonstrate confidence in the business.' },
  { label: 'Non-Compete', text: '3-year, 50-mile radius non-compete from date of closing.' },
  { label: 'Transition', text: 'Seller agrees to provide 90 days of transition consulting at no additional charge post-close.' },
];

export default function LOIRef() {
  return (
    <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '20px 24px' }}>
      <SectionHeader>LOI Key Clauses Reference</SectionHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {CLAUSES.map(({ label, text }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: '#C9A84C', fontWeight: 600, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>{text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
