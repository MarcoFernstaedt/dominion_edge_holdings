'use client';

import { useState, useMemo } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { DEAL_STAGES, STAGE_COLORS, FUNNEL_STEPS } from '@/lib/data/pipeline';
import FilterBar from './FilterBar';
import DealCard from './DealCard';
import DealForm from './DealForm';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function DealPipeline() {
  const { deals, setDeals } = useApp();
  const [filter, setFilter] = useState({ stage: '', search: '' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const stageCounts = useMemo(() => deals.reduce((acc, d) => {
    acc[d.stage] = (acc[d.stage] ?? 0) + 1;
    return acc;
  }, {}), [deals]);

  const filtered = useMemo(() => deals.filter(d => {
    if (filter.stage && d.stage !== filter.stage) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      return d.company.toLowerCase().includes(q) || d.owner.toLowerCase().includes(q);
    }
    return true;
  }), [deals, filter]);

  const saveDeal = form => {
    if (editing !== null) {
      setDeals(prev => prev.map((d, i) => i === editing ? { ...d, ...form } : d));
      setEditing(null);
    } else {
      setDeals(prev => [...prev, { ...form, id: Date.now() }]);
    }
    setShowForm(false);
  };

  const deleteDeal = i => setDeals(prev => prev.filter((_, idx) => idx !== i));
  const startEdit = i => { setEditing(i); setShowForm(true); };
  const cancelForm = () => { setEditing(null); setShowForm(false); };

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>Deal Pipeline</h1>
          <div style={{ fontSize: 13, color: '#555' }}>{deals.length} targets tracked</div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: '9px 16px', background: '#C9A84C', border: 'none', color: '#0A0A0A', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          + New Deal
        </button>
      </div>

      {/* Funnel overview */}
      <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '16px 20px', marginBottom: 24 }}>
        <SectionHeader>Acquisition Funnel Target</SectionHeader>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FUNNEL_STEPS.map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: s.color, display: 'flex', alignItems: 'center', gap: 4 }}>
              {i > 0 && <span style={{ color: '#333' }}>→</span>}
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* Stage counts */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {DEAL_STAGES.map(s => (
          <div key={s} style={{
            padding: '6px 12px', borderRadius: 6,
            background: (stageCounts[s] ?? 0) > 0 ? STAGE_COLORS[s] + '22' : '#111',
            border: `1px solid ${(stageCounts[s] ?? 0) > 0 ? STAGE_COLORS[s] + '55' : '#1E1E1E'}`,
            fontSize: 12, color: (stageCounts[s] ?? 0) > 0 ? STAGE_COLORS[s] : '#444',
          }}>
            {s} · {stageCounts[s] ?? 0}
          </div>
        ))}
      </div>

      {showForm && (
        <DealForm
          initial={editing !== null ? deals[editing] : undefined}
          onSave={saveDeal}
          onCancel={cancelForm}
        />
      )}

      <FilterBar filter={filter} onFilter={setFilter} />

      {filtered.length === 0 ? (
        <EmptyState message={deals.length === 0 ? 'No deals yet. Add your first target.' : 'No deals match your filters.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((d, i) => (
            <DealCard
              key={d.id ?? i}
              deal={d}
              onEdit={() => startEdit(deals.indexOf(d))}
              onDelete={() => deleteDeal(deals.indexOf(d))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
