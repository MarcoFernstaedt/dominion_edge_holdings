import { useState } from 'react';
import { DEAL_STAGES } from '../data/checklistData';
import { formInput as input, formLabel as lbl } from '../styles/shared';

const HOW_FOUND = ['AZ OPM Registry', 'Google Maps', 'Referral', 'LinkedIn', 'AZPMA Event', 'Other'];

const stageColor = (stage) => {
  const map = {
    'Identified': '#666',
    'Contacted': '#5A8DB5',
    'Conversation': '#7B9E87',
    'Diligence': '#8B6F9E',
    'LOI Sent': '#C9A84C',
    'Under Contract': '#D4845A',
    'Closed': '#4CAF50',
    'Dead': '#444',
  };
  return map[stage] || '#666';
};

const fmtRevenue = (n) => {
  if (!n) return '—';
  const num = Number(n);
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${Math.round(num / 1000)}k`;
  return `$${num}`;
};

const empty = { company: '', owner: '', phone: '', email: '', revenue: '', ebitda: '', trucks: '', years: '', howFound: 'AZ OPM Registry', stage: 'Identified', notes: '' };

export default function DealPipeline({ deals, setDeals }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [filter, setFilter] = useState('All');

  const addDeal = () => {
    if (!form.company.trim()) return;
    setDeals(prev => [...prev, { ...form, id: Date.now().toString() }]);
    setForm(empty);
    setShowForm(false);
  };

  const updateStage = (id, stage) => setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d));
  const removeDeal = (id) => setDeals(prev => prev.filter(d => d.id !== id));

  // Single O(n) pass instead of O(n × stages)
  const stageCounts = deals.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] || 0) + 1;
    return acc;
  }, {});

  const filtered = filter === 'All' ? deals : deals.filter(d => d.stage === filter);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 980, margin: '0 auto', color: '#E8E0D0' }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Deal Pipeline</div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 24 }}>Track every target from AZ OPM registry through close</div>

      {/* Pipeline Summary Bar */}
      <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '14px 18px', marginBottom: 20, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
          <button
            onClick={() => setFilter('All')}
            style={{ background: filter === 'All' ? '#C9A84C22' : 'transparent', border: `1px solid ${filter === 'All' ? '#C9A84C' : '#2A2A2A'}`, color: filter === 'All' ? '#C9A84C' : '#888', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            All <span style={{ marginLeft: 4, opacity: 0.8 }}>{deals.length}</span>
          </button>
          {DEAL_STAGES.map(stage => {
            const count = stageCounts[stage];
            const active = filter === stage;
            const color = stageColor(stage);
            return (
              <button
                key={stage}
                onClick={() => setFilter(active ? 'All' : stage)}
                style={{ background: active ? `${color}22` : 'transparent', border: `1px solid ${active ? color : '#2A2A2A'}`, color: active ? color : count > 0 ? '#AAA' : '#444', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}
              >
                {stage} {count > 0 && <span style={{ background: color, color: '#000', borderRadius: 8, padding: '1px 6px', marginLeft: 4, fontSize: 10, fontWeight: 700 }}>{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Funnel Math */}
      <div style={{ background: '#0F0F0F', border: '1px solid #1E1E1E', borderRadius: 8, padding: '14px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, color: '#555', marginBottom: 8, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Peña Deal Funnel</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12 }}>
          {[
            ['150 contacted', '#C9A84C'],
            ['→', '#444'],
            ['30–40 real conversations', '#5A8DB5'],
            ['→', '#444'],
            ['10–15 open to selling', '#7B9E87'],
            ['→', '#444'],
            ['3–5 right price + timing', '#D4845A'],
            ['→', '#444'],
            ['1–2 will close', '#4CAF50'],
          ].map(([t, c], i) => (
            <span key={i} style={{ color: c, fontWeight: t === '→' ? 400 : 600 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Primary Source Note */}
      <div style={{ background: '#0D1A0D', border: '1px solid #1E4A1E', borderRadius: 6, padding: '10px 16px', marginBottom: 20, fontSize: 12, color: '#7B9E87' }}>
        <strong>Primary sourcing:</strong> AZ OPM registry at <strong>opm.azda.gov</strong> — every licensed pest control operator in AZ with owner name attached. This is your master list. Load it. Work it.
      </div>

      {/* Add Deal Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Targets ({filtered.length}{filter !== 'All' ? ` in ${filter}` : ''})
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ background: '#C9A84C', color: '#000', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
        >
          {showForm ? '✕ Cancel' : '+ Add Target'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>COMPANY NAME *</label>
              <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={input} placeholder="ABC Pest Control" />
            </div>
            <div>
              <label style={lbl}>OWNER NAME</label>
              <input value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} style={input} placeholder="John Smith" />
            </div>
            <div>
              <label style={lbl}>PHONE</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} placeholder="(602) 555-0100" />
            </div>
            <div>
              <label style={lbl}>EMAIL</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} placeholder="owner@company.com" />
            </div>
            <div>
              <label style={lbl}>EST. REVENUE ($)</label>
              <input type="number" value={form.revenue} onChange={e => setForm({ ...form, revenue: e.target.value })} style={input} placeholder="1800000" />
            </div>
            <div>
              <label style={lbl}>EST. EBITDA/SDE ($)</label>
              <input type="number" value={form.ebitda} onChange={e => setForm({ ...form, ebitda: e.target.value })} style={input} placeholder="280000" />
            </div>
            <div>
              <label style={lbl}>TRUCKS</label>
              <input type="number" value={form.trucks} onChange={e => setForm({ ...form, trucks: e.target.value })} style={input} placeholder="4" />
            </div>
            <div>
              <label style={lbl}>YEARS IN BUSINESS</label>
              <input type="number" value={form.years} onChange={e => setForm({ ...form, years: e.target.value })} style={input} placeholder="18" />
            </div>
            <div>
              <label style={lbl}>HOW FOUND</label>
              <select value={form.howFound} onChange={e => setForm({ ...form, howFound: e.target.value })} style={input}>
                {HOW_FOUND.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>STAGE</label>
              <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} style={input}>
                {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...input, height: 60, resize: 'vertical' }} placeholder="Key details about this target…" />
            </div>
          </div>
          <button onClick={addDeal} style={{ background: '#C9A84C', color: '#000', border: 'none', padding: '9px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Save Target
          </button>
        </div>
      )}

      {/* Deal List */}
      {filtered.length === 0 ? (
        <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '40px', textAlign: 'center', color: '#444', fontSize: 13 }}>
          {deals.length === 0
            ? 'No targets yet. Pull the AZ OPM registry and load your first 50 targets.'
            : `No targets in ${filter} stage.`}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map(deal => {
            const color = stageColor(deal.stage);
            return (
              <div key={deal.id} style={{ background: '#111', border: '1px solid #1E1E1E', borderLeft: `3px solid ${color}`, borderRadius: 8, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E0D0' }}>{deal.company}</div>
                    <span style={{ fontSize: 11, background: `${color}22`, color, border: `1px solid ${color}55`, padding: '2px 8px', borderRadius: 10 }}>{deal.stage}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#888', flexWrap: 'wrap' }}>
                    {deal.owner && <span>Owner: <strong style={{ color: '#AAA' }}>{deal.owner}</strong></span>}
                    {deal.revenue && <span>Rev: <strong style={{ color: '#C9A84C' }}>{fmtRevenue(deal.revenue)}</strong></span>}
                    {deal.ebitda && <span>SDE: <strong style={{ color: '#7B9E87' }}>{fmtRevenue(deal.ebitda)}</strong></span>}
                    {deal.trucks && <span>{deal.trucks} trucks</span>}
                    {deal.years && <span>{deal.years} yrs</span>}
                    {deal.howFound && <span style={{ color: '#555' }}>{deal.howFound}</span>}
                  </div>
                  {deal.phone && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{deal.phone}{deal.email ? ` · ${deal.email}` : ''}</div>}
                  {deal.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 6, fontStyle: 'italic' }}>{deal.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <select
                    value={deal.stage}
                    onChange={e => updateStage(deal.id, e.target.value)}
                    style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#AAA', padding: '5px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                  >
                    {DEAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeDeal(deal.id)} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#555', width: 28, height: 28, borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
