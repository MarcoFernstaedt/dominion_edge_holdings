import { useState } from 'react';
import { BOARD_SEATS, CONTACT_STATUSES } from '../data/checklistData';
import { formInput as input, formLabel as label } from '../styles/shared';

const ROLES = BOARD_SEATS.map(s => s.role);

const statusColor = (status) => {
  if (status === 'Committed') return { bg: 'rgba(201,168,76,0.15)', text: '#C9A84C', border: '#C9A84C55' };
  if (status === 'Passed') return { bg: 'rgba(180,60,60,0.1)', text: '#B44040', border: '#B4404055' };
  if (status === 'Meeting Set' || status === 'Pitch Delivered') return { bg: 'rgba(90,141,181,0.1)', text: '#5A8DB5', border: '#5A8DB555' };
  return { bg: 'rgba(80,80,80,0.1)', text: '#888', border: '#33333355' };
};

const empty = { role: '', name: '', company: '', email: '', phone: '', linkedin: '', status: 'Identified', notes: '' };

const OBJECTIONS = [
  { q: '"You have no track record."', a: 'That\'s exactly why I\'m building the board first. Your credibility IS the track record.' },
  { q: '"I\'m too busy."', a: 'This is 2–4 hours per quarter plus introductions when needed. That\'s it.' },
  { q: '"What\'s the equity worth?"', a: 'At 5x EBITDA on our first acquisition, 1% is worth $40K–$125K at close alone. This is a founder position.' },
  { q: '"Why pest control?"', a: '$27B market, 26,000+ operators, highly fragmented. Phoenix is a top-5 pest-pressure metro — year-round demand, no seasonality, fastest-growing large city in the US. Baby boomer owners with no exit plan, never approached by a serious buyer. The national chains only target $3M+ companies. Below that is wide open.' },
];

export default function BoardCRM({ boardContacts, setBoardContacts }) {
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [objOpen, setObjOpen] = useState(false);

  const addContact = () => {
    if (!form.name.trim()) return;
    setBoardContacts(prev => [...prev, { ...form, id: Date.now().toString() }]);
    setForm(empty);
    setShowForm(false);
  };

  const updateStatus = (id, status) => {
    setBoardContacts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const removeContact = (id) => {
    setBoardContacts(prev => prev.filter(c => c.id !== id));
  };

  const committedForSeat = (role) => boardContacts.find(c => c.role === role && c.status === 'Committed');

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto', color: '#E8E0D0' }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Board CRM</div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 28 }}>Track all 6 board seats from candidate to signed equity agreement</div>

      {/* Seat Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        {BOARD_SEATS.map(seat => {
          const committed = committedForSeat(seat.role);
          const isSelected = selectedSeat?.id === seat.id;
          return (
            <div
              key={seat.id}
              onClick={() => setSelectedSeat(isSelected ? null : seat)}
              style={{
                background: '#111', border: `1px solid ${committed ? seat.color : '#1E1E1E'}`,
                borderRadius: 8, padding: '14px 16px', cursor: 'pointer',
                boxShadow: committed ? `0 0 12px ${seat.color}22` : 'none',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = seat.color + '88'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = committed ? seat.color : '#1E1E1E'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#E8E0D0' }}>{seat.role}</div>
                {seat.priority && <span style={{ fontSize: 9, background: seat.color, color: '#000', padding: '2px 6px', borderRadius: 3, fontWeight: 700, letterSpacing: '0.05em' }}>{seat.priority}</span>}
              </div>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>Equity: {seat.equityRange}</div>
              {committed
                ? <div style={{ fontSize: 12, color: seat.color, fontWeight: 600 }}>✓ {committed.name}</div>
                : <div style={{ fontSize: 12, color: '#444' }}>○ Open seat</div>
              }
            </div>
          );
        })}
      </div>

      {/* Seat Detail */}
      {selectedSeat && (
        <div style={{ background: '#111', border: `1px solid ${selectedSeat.color}44`, borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: selectedSeat.color }}>{selectedSeat.role}</div>
            <button onClick={() => setSelectedSeat(null)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: '0.08em' }}>WHO TO RECRUIT</div>
              <div style={{ fontSize: 13, color: '#CCC', lineHeight: 1.6 }}>{selectedSeat.description}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: '0.08em' }}>WHY THIS PERSON</div>
              <div style={{ fontSize: 13, color: '#CCC', lineHeight: 1.6 }}>{selectedSeat.why}</div>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 4, letterSpacing: '0.08em' }}>WHERE TO FIND</div>
            <div style={{ fontSize: 13, color: '#AAA' }}>{selectedSeat.whereTo}</div>
          </div>
          <div style={{ background: '#0D0D0D', border: '1px solid #1E1E1E', borderRadius: 6, padding: '12px 16px' }}>
            <div style={{ fontSize: 10, color: '#555', marginBottom: 6, letterSpacing: '0.08em' }}>PITCH SCRIPT</div>
            <div style={{ fontSize: 13, color: '#C9A84C', fontStyle: 'italic', lineHeight: 1.6 }}>"{selectedSeat.pitch}"</div>
          </div>
        </div>
      )}

      {/* Add Contact Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Contacts ({boardContacts.length})</div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{ background: '#C9A84C', color: '#000', border: 'none', padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
        >
          {showForm ? '✕ Cancel' : '+ Add Contact'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div style={{ background: '#111', border: '1px solid #2A2A2A', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={label}>ROLE</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={input}>
                <option value="">Select role…</option>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>NAME</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} placeholder="Full name" />
            </div>
            <div>
              <label style={label}>COMPANY</label>
              <input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} style={input} placeholder="Company or affiliation" />
            </div>
            <div>
              <label style={label}>EMAIL</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} placeholder="email@example.com" />
            </div>
            <div>
              <label style={label}>PHONE</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={input} placeholder="(602) 555-0100" />
            </div>
            <div>
              <label style={label}>LINKEDIN</label>
              <input value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} style={input} placeholder="linkedin.com/in/…" />
            </div>
            <div>
              <label style={label}>STATUS</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={input}>
                {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={label}>NOTES</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ ...input, height: 60, resize: 'vertical' }} placeholder="Notes about this contact…" />
            </div>
          </div>
          <button onClick={addContact} style={{ background: '#C9A84C', color: '#000', border: 'none', padding: '9px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Save Contact
          </button>
        </div>
      )}

      {/* Contact List */}
      {boardContacts.length === 0 ? (
        <div style={{ background: '#111', border: '1px solid #1A1A1A', borderRadius: 8, padding: '32px', textAlign: 'center', color: '#444', fontSize: 13 }}>
          No contacts yet. Start by identifying your Industry Veteran — recruit this seat first.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
          {boardContacts.map(contact => {
            const sc = statusColor(contact.status);
            return (
              <div key={contact.id} style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, padding: '14px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#E8E0D0' }}>{contact.name}</div>
                    <span style={{ fontSize: 11, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, padding: '2px 8px', borderRadius: 10 }}>{contact.status}</span>
                    {contact.role && <span style={{ fontSize: 11, color: '#666' }}>{contact.role}</span>}
                  </div>
                  {contact.company && <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{contact.company}</div>}
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#555' }}>
                    {contact.email && <span>{contact.email}</span>}
                    {contact.phone && <span>{contact.phone}</span>}
                  </div>
                  {contact.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 6, fontStyle: 'italic' }}>{contact.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <select
                    value={contact.status}
                    onChange={e => updateStatus(contact.id, e.target.value)}
                    style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', color: '#AAA', padding: '5px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}
                  >
                    {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => removeContact(contact.id)} style={{ background: 'none', border: '1px solid #2A2A2A', color: '#555', width: 28, height: 28, borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Objection Handling */}
      <div style={{ background: '#111', border: '1px solid #1E1E1E', borderRadius: 8, overflow: 'hidden' }}>
        <div
          style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
          onClick={() => setObjOpen(!objOpen)}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Objection Handling</span>
          <span style={{ color: '#555', fontSize: 11 }}>{objOpen ? '▲' : '▼'}</span>
        </div>
        {objOpen && (
          <div style={{ padding: '0 18px 18px' }}>
            {OBJECTIONS.map((obj, i) => (
              <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < OBJECTIONS.length - 1 ? '1px solid #1A1A1A' : 'none' }}>
                <div style={{ fontSize: 13, color: '#AAA', fontStyle: 'italic', marginBottom: 6 }}>{obj.q}</div>
                <div style={{ fontSize: 13, color: '#C9A84C', lineHeight: 1.6 }}>→ {obj.a}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
