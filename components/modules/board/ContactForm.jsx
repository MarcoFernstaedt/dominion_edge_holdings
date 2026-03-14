'use client';

import { useState } from 'react';
import { FormField, inputStyle } from '@/components/ui/FormField';
import { CONTACT_STATUSES, BOARD_SEATS } from '@/lib/data/board';

const EMPTY = { name: '', role: '', company: '', linkedIn: '', email: '', phone: '', status: 'Identified', seat: '', notes: '' };

export default function ContactForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      background: '#111', border: '1px solid #1E1E1E', borderRadius: 8,
      padding: '20px 24px', marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0', marginBottom: 16 }}>
        {initial ? 'Edit Contact' : 'Add Contact'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <FormField label="FULL NAME">
          <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Jane Smith" />
        </FormField>
        <FormField label="TITLE / ROLE">
          <input style={inputStyle} value={form.role} onChange={e => set('role', e.target.value)} placeholder="Regional VP" />
        </FormField>
        <FormField label="COMPANY">
          <input style={inputStyle} value={form.company} onChange={e => set('company', e.target.value)} placeholder="Rollins Inc." />
        </FormField>
        <FormField label="STATUS">
          <select style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
            {CONTACT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </FormField>
        <FormField label="BOARD SEAT TARGET">
          <select style={inputStyle} value={form.seat} onChange={e => set('seat', e.target.value)}>
            <option value="">— none —</option>
            {BOARD_SEATS.map(s => <option key={s.id} value={s.id}>{s.role}</option>)}
          </select>
        </FormField>
        <FormField label="LINKEDIN">
          <input style={inputStyle} value={form.linkedIn} onChange={e => set('linkedIn', e.target.value)} placeholder="linkedin.com/in/..." />
        </FormField>
        <FormField label="EMAIL">
          <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
        </FormField>
        <FormField label="PHONE">
          <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(602) 555-0000" />
        </FormField>
        <FormField label="NOTES" span={2}>
          <textarea style={{ ...inputStyle, height: 72, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Meeting notes, next steps…" />
        </FormField>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 16px', background: 'none', border: '1px solid #333', color: '#666', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
        <button
          onClick={() => form.name.trim() && onSave(form)}
          style={{ padding: '8px 16px', background: '#C9A84C', border: 'none', color: '#0A0A0A', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
