import SectionHeader from '@/components/ui/SectionHeader';

const MILESTONES = [
  { month: 'Month 1–2',  color: '#C9A84C', items: ['Board: Industry Veteran + SBA Banker committed', 'First 50 target letters mailed (AZ OPM registry)', 'First 10 outreach calls made'] },
  { month: 'Month 2–3',  color: '#5A8DB5', items: ['Board: M&A Attorney + Transaction CPA committed', 'First seller discovery call completed', '100+ targets in active pipeline'] },
  { month: 'Month 3–5',  color: '#7B9E87', items: ['First LOI submitted', 'SBA lender pre-approval in hand', 'Board fully assembled (6/6)'] },
  { month: 'Month 5–10', color: '#D4845A', items: ['Under contract on first acquisition', 'QofE completed', 'SBA loan approved'] },
  { month: 'Month 10–18',color: '#4CAF50', items: ['First acquisition closed', 'Operations Executor managing day-to-day', 'Second target identified and under LOI'] },
];

export default function Timeline() {
  return (
    <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
      <SectionHeader>18-Month Acquisition Timeline</SectionHeader>
      <div style={{ position: 'relative', paddingLeft: 20 }}>
        <div style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 1, background: '#1E1E1E' }} />
        {MILESTONES.map((m, i) => (
          <div key={i} style={{ position: 'relative', marginBottom: 20, paddingLeft: 20 }}>
            <div style={{ position: 'absolute', left: -6, top: 3, width: 12, height: 12, borderRadius: '50%', background: m.color }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: m.color, marginBottom: 6 }}>{m.month}</div>
            {m.items.map((item, j) => (
              <div key={j} style={{ fontSize: 12, color: '#666', lineHeight: 1.7 }}>· {item}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
