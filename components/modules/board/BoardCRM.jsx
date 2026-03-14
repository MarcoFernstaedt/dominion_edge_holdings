'use client';

import { useState } from 'react';
import { useApp } from '@/lib/context/AppContext';
import { BOARD_SEATS } from '@/lib/data/board';
import SeatCard from './SeatCard';
import SeatDetail from './SeatDetail';
import ContactCard from './ContactCard';
import ContactForm from './ContactForm';
import SectionHeader from '@/components/ui/SectionHeader';
import EmptyState from '@/components/ui/EmptyState';

export default function BoardCRM() {
  const { boardContacts, setBoardContacts } = useApp();
  const [activeSeat, setActiveSeat] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  const committedBySeat = id => boardContacts.filter(c => c.seat === id && c.status === 'Committed').length;

  const saveContact = form => {
    if (editing !== null) {
      setBoardContacts(prev => prev.map((c, i) => i === editing ? { ...c, ...form } : c));
      setEditing(null);
    } else {
      setBoardContacts(prev => [...prev, { ...form, id: Date.now() }]);
    }
    setShowForm(false);
  };

  const deleteContact = i => setBoardContacts(prev => prev.filter((_, idx) => idx !== i));

  const startEdit = i => { setEditing(i); setShowForm(true); };
  const cancelForm = () => { setEditing(null); setShowForm(false); };

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#E8E0D0', margin: '0 0 4px' }}>Board CRM</h1>
          <div style={{ fontSize: 13, color: '#555' }}>Recruit and manage your advisory board</div>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: '9px 16px', background: '#C9A84C', border: 'none', color: '#0A0A0A', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          + Add Contact
        </button>
      </div>

      {showForm && (
        <ContactForm
          initial={editing !== null ? boardContacts[editing] : undefined}
          onSave={saveContact}
          onCancel={cancelForm}
        />
      )}

      <SectionHeader>Board Seats</SectionHeader>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 28 }}>
        {BOARD_SEATS.map(seat => (
          <SeatCard
            key={seat.id}
            seat={seat}
            filled={committedBySeat(seat.id)}
            active={activeSeat === seat.id}
            onClick={() => setActiveSeat(id => id === seat.id ? null : seat.id)}
          />
        ))}
      </div>

      {activeSeat && (
        <div style={{ marginBottom: 28 }}>
          <SeatDetail seat={BOARD_SEATS.find(s => s.id === activeSeat)} />
        </div>
      )}

      <SectionHeader>Contacts ({boardContacts.length})</SectionHeader>
      {boardContacts.length === 0 ? (
        <EmptyState message="No contacts yet. Add your first board prospect." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {boardContacts.map((c, i) => (
            <ContactCard key={c.id ?? i} contact={c} onEdit={() => startEdit(i)} onDelete={() => deleteContact(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
