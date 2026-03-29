'use client';

import { useState, useEffect, useCallback } from 'react';
import { capitalRaisingApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Presentation, Wand2, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import type { PitchDeck, PitchSlide } from '@/lib/types';

function SlideCard({ slide, index }: { slide: PitchSlide; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-[var(--color-bg)] hover:bg-[var(--color-surface)] transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-text-muted)] w-5 text-right">{index + 1}</span>
          <span className="font-medium text-[var(--color-text-primary)] text-sm">{slide.title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-[var(--color-text-muted)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />}
      </button>
      {open && (
        <div className="px-4 py-4 space-y-3 bg-[var(--color-surface)]">
          <ul className="space-y-1.5">
            {slide.bulletPoints.map((bp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-accent)] mt-0.5">•</span>
                {bp}
              </li>
            ))}
          </ul>
          {slide.speakerNotes && (
            <div className="bg-[#C9A22715] border border-[#C9A22730] rounded px-3 py-2">
              <p className="text-xs text-[#C9A227] uppercase tracking-wide mb-1">Speaker Notes</p>
              <p className="text-xs text-[#C9A227]">{slide.speakerNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeckCard({ deck, onDelete }: { deck: PitchDeck; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Presentation className="w-4 h-4 text-[var(--color-accent)]" />
          <h3 className="font-medium text-[var(--color-text-primary)]">{deck.deckTitle}</h3>
          <span className="text-xs text-[var(--color-text-muted)]">· {deck.slides.length} slides</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setExpanded((o) => !o)}>
            {expanded ? 'Collapse' : 'View Slides'}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400">Delete</Button>
        </div>
      </div>
      {expanded && (
        <div className="space-y-2">
          {deck.slides.map((slide, i) => (
            <SlideCard key={i} slide={slide} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function GenerateForm({ onGenerated, onCancel }: { onGenerated: () => void; onCancel: () => void }) {
  const [deckTitle, setDeckTitle] = useState('Investor Pitch Deck');
  const [operatorName, setOperatorName] = useState('');
  const [useAI, setUseAI] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      await capitalRaisingApi.generateDeck({ deckTitle, operatorName, useAI });
      onGenerated();
    } catch {
      setError('Generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--color-text-muted)]">
        The deck will be built from your latest firm messaging. Define your mission and thesis first in the Messaging section for best results.
      </p>
      <Input label="Deck Title" value={deckTitle} onChange={(e) => setDeckTitle(e.target.value)} />
      <Input label="Operator Name" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Your name" />
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="useAI"
          checked={useAI}
          onChange={(e) => setUseAI(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        <label htmlFor="useAI" className="text-sm text-[var(--color-text-secondary)]">
          Use AI for narrative generation (Claude Sonnet)
        </label>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={generate} disabled={generating} className="flex items-center gap-2">
          <Wand2 className="w-4 h-4" />
          {generating ? 'Generating…' : 'Generate Deck'}
        </Button>
      </div>
    </div>
  );
}

export default function PitchDeckPage() {
  const [decks, setDecks] = useState<PitchDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await capitalRaisingApi.listDecks();
      setDecks((res as { pitchDecks: PitchDeck[] }).pitchDecks);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this pitch deck?')) return;
    await capitalRaisingApi.deleteDeck(id);
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">Pitch Deck Generator</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Generate 10-slide investor pitch deck outlines</p>
        </div>
        <Button onClick={() => setShowGenerate(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Generate Deck
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : decks.length === 0 ? (
        <div className="text-center py-12">
          <Presentation className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)] mb-4">No pitch decks yet.</p>
          <Button onClick={() => setShowGenerate(true)}>Generate Your First Deck</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {decks.map((d) => (
            <DeckCard key={d.id} deck={d} onDelete={() => handleDelete(d.id)} />
          ))}
        </div>
      )}

      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Pitch Deck">
        <GenerateForm
          onGenerated={() => { setShowGenerate(false); load(); }}
          onCancel={() => setShowGenerate(false)}
        />
      </Modal>
    </div>
  );
}
