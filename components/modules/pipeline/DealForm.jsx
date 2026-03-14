'use client';

import { useState } from 'react';
import { FormField, inputStyle } from '@/components/ui/FormField';
import { DEAL_STAGES, HOW_FOUND, EMPTY_DEAL } from '@/lib/data/pipeline';

export default function DealForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY_DEAL);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      background: '#111', border: '1px solid #1E1E1E', borderRadius: 8,
      padding: '20px 24px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0', marginBottom: 16 }}>
        {initial ? 'Edit Deal' : 'New Deal'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <FormField label="COMPANY NAME">
          <input style={inputStyle} value={form.company} onChange={e => set('company', e.target.value)} placeholder="Phoenix Pest Control Co." />
        </FormField>
        <FormField label="OWNER NAME">
          <input style={inputStyle} value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="John Doe" />
        </FormField>
        <FormField label="PHONE">
          <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(602) 555-0000" />
        </FormField>
        <FormField label="EMAIL">
          <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="owner@company.com" />
        </FormField>
        <FormField label="ANNUAL REVENUE ($)">
          <input style={inputStyle} type="number" value={form.revenue} onChange={e => set('revenue', e.target.value)} placeholder="1500000" />
        </FormField>
        <FormField label="EBITDA ($)">
          <input style={inputStyle} type="number" value={form.ebitda} onChange={e => set('ebitda', e.target.value)} placeholder="300000" />
        </FormField>
        <FormField label="TRUCKS">
          <input style={inputStyle} type="number" value={form.trucks} onChange={e => set('trucks', e.target.value)} placeholder="8" />
        </FormField>
        <FormField label="YEARS IN BUSINESS">
          <input style={inputStyle} type="number" value={form.years} onChange={e => set('years', e.target.value)} placeholder="15" />
        </FormField>
        <FormField label="HOW FOUND">
          <select style={inputStyle} value={form.howFound} onChange={e => set('howFound', e.target.value)}>
            {HOW_FOUND.map(h => <option key={h}>{h}</option>)}
          </select>
        </FormField>
        <FormField label="STAGE">
          <select style={inputStyle} value={form.stage} onChange={e => set('stage', e.target.value)}>
            {DEAL_STAGES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="NOTES" span={2}>
          <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Key observations, next steps…" />
        </FormField>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'none', border: '1px solid #333', color: '#666', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
        <button
          onClick={() => form.company.trim() && onSave(form)}
          style={{ padding: '8px 16px', background: '#C9A84C', border: 'none', color: '#0A0A0A', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
