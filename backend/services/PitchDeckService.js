/**
 * PitchDeckService
 * Generates investor pitch deck outlines with slide content.
 * AI narrative via Claude Sonnet; deterministic fallback always available.
 */

import crypto from 'crypto';

// ─── Deterministic slide templates ────────────────────────────────────────────

function buildDeterministicSlides(firmMessaging, operatorName) {
  const industries = (firmMessaging?.targetIndustries || []).join(', ') || 'small businesses';
  const size       = firmMessaging?.targetDealSize || '$1M–$10M revenue';
  const geo        = firmMessaging?.geographicFocus || 'the United States';
  const mission    = firmMessaging?.missionStatement || 'We acquire and operate enduring small businesses.';
  const thesis     = firmMessaging?.investmentThesis || 'We focus on cash-flowing businesses with strong fundamentals.';

  return [
    {
      title: 'Firm Overview',
      bulletPoints: [
        `Operator-led acquisition firm`,
        `Focused on ${industries}`,
        `Target deal size: ${size}`,
        `Geographic focus: ${geo}`,
      ],
      speakerNotes: 'Open with a brief overview of who you are and what the firm does.',
    },
    {
      title: 'Mission Statement',
      bulletPoints: [mission],
      speakerNotes: 'State the mission clearly. This anchors the rest of the deck.',
    },
    {
      title: 'Investment Thesis',
      bulletPoints: [thesis],
      speakerNotes: 'Explain the logic behind the acquisition strategy.',
    },
    {
      title: 'Target Industries',
      bulletPoints: [
        `Primary focus: ${industries}`,
        'Businesses with recurring or repeat revenue',
        'Essential services with stable demand',
        'Owner-operator transition situations',
      ],
      speakerNotes: 'Describe why these industries and what makes them attractive for acquisition.',
    },
    {
      title: 'Acquisition Strategy',
      bulletPoints: [
        'Source deals off-market through direct outreach',
        'Target profitable, cash-flowing businesses',
        'Acquire at reasonable multiples (3–6x EBITDA)',
        'Hold and operate — not flip',
      ],
      speakerNotes: 'Walk through the sourcing and selection process.',
    },
    {
      title: 'Example Deal Economics',
      bulletPoints: [
        'Purchase Price: $2,000,000',
        'Revenue: $3,500,000 | EBITDA: $450,000',
        'Debt: $1,200,000 (SBA) | Seller Note: $400,000',
        'Equity: $400,000 | Multiple: 4.4x EBITDA',
      ],
      speakerNotes: 'Use a representative deal to illustrate the economics. Adjust to reflect actual target.',
    },
    {
      title: 'Capital Structure',
      bulletPoints: [
        'Senior Debt: SBA 7(a) or conventional bank financing',
        'Seller Note: Deferred seller financing (10–20%)',
        'Investor Equity: LP equity from investor group',
        'Operator Equity: Meaningful GP co-invest',
      ],
      speakerNotes: 'Explain how each deal is financed. Emphasize alignment of interests.',
    },
    {
      title: 'Operator Background',
      bulletPoints: [
        operatorName ? `Led by ${operatorName}` : 'Experienced acquisition operator',
        'Relevant industry and operational experience',
        'Track record of operational improvement',
        'Committed full-time to the acquisition',
      ],
      speakerNotes: 'This is your credibility slide. Be specific about your background and edge.',
    },
    {
      title: 'Why Now',
      bulletPoints: [
        'Record number of baby boomer business owners approaching retirement',
        '$10T+ in small business wealth transferring over next decade',
        'Fragmented markets with no institutional competition',
        'Seller financing and SBA lending creating attractive entry points',
      ],
      speakerNotes: 'Explain the macro tailwinds driving the search fund / acquisition model.',
    },
    {
      title: 'Next Steps',
      bulletPoints: [
        'Schedule introductory call',
        'Share deal pipeline and underwriting model',
        'Discuss investment terms and structure',
        'Begin due diligence on active deal',
      ],
      speakerNotes: 'End with a clear call to action. Make it easy for investors to engage.',
    },
  ];
}

class PitchDeckService {
  init(store, aiService) {
    this._store = store;
    this._ai = aiService;
    if (!Array.isArray(store.pitchDecks)) store.pitchDecks = [];
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  listDecks() {
    return [...(this._store.pitchDecks || [])].sort(
      (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
  }

  getDeck(id) {
    return (this._store.pitchDecks || []).find((d) => d.id === id) || null;
  }

  saveDeck(data, nowIso = new Date().toISOString()) {
    const existing = data.id ? this.getDeck(data.id) : null;
    if (existing) {
      const idx = this._store.pitchDecks.findIndex((d) => d.id === data.id);
      const updated = { ...existing, ...data, updatedAt: nowIso };
      this._store.pitchDecks[idx] = updated;
      return updated;
    }
    const id = crypto.randomUUID();
    const deck = {
      id,
      firmMessagingId: data.firmMessagingId || null,
      deckTitle:       data.deckTitle       || 'Investor Pitch Deck',
      slides:          data.slides          || [],
      createdAt:       nowIso,
      updatedAt:       nowIso,
    };
    this._store.pitchDecks = [deck, ...(this._store.pitchDecks || [])];
    return deck;
  }

  deleteDeck(id) {
    const before = (this._store.pitchDecks || []).length;
    this._store.pitchDecks = (this._store.pitchDecks || []).filter((d) => d.id !== id);
    return (this._store.pitchDecks || []).length < before;
  }

  // ─── Generation ───────────────────────────────────────────────────────────────

  generateDeterministic(firmMessaging, operatorName = '') {
    return buildDeterministicSlides(firmMessaging, operatorName);
  }

  async generateWithAI(firmMessaging, operatorName = '', useAI = true) {
    if (!useAI || !this._ai) {
      return this.generateDeterministic(firmMessaging, operatorName);
    }

    const industries = (firmMessaging?.targetIndustries || []).join(', ') || 'small businesses';
    const size       = firmMessaging?.targetDealSize       || '$1M–$10M revenue';
    const geo        = firmMessaging?.geographicFocus      || 'the United States';
    const mission    = firmMessaging?.missionStatement     || '';
    const thesis     = firmMessaging?.investmentThesis     || '';
    const valueStrat = firmMessaging?.valueCreationStrategy || '';

    const prompt = `You are helping an acquisition entrepreneur generate a 10-slide investor pitch deck.

Firm context:
- Operator: ${operatorName || 'the operator'}
- Mission: ${mission}
- Thesis: ${thesis}
- Industries: ${industries}
- Deal size: ${size}
- Geography: ${geo}
- Value creation: ${valueStrat}

Generate exactly 10 slides as a JSON array. Each slide has:
{
  "title": "slide title",
  "bulletPoints": ["point 1", "point 2", "point 3", "point 4"],
  "speakerNotes": "1-2 sentence speaker guidance"
}

Slides (in order): Firm Overview, Mission Statement, Investment Thesis, Target Industries, Acquisition Strategy, Example Deal Economics, Capital Structure, Operator Background, Why Now, Next Steps.

Return only valid JSON array.`;

    try {
      const response = await this._ai.complete(prompt, {
        model: 'claude-sonnet-4-6',
        maxTokens: 2000,
      });
      const text = response?.content?.[0]?.text || response?.text || '';
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const slides = JSON.parse(arrMatch[0]);
        if (Array.isArray(slides) && slides.length === 10) return slides;
      }
    } catch { /* fall through */ }

    return this.generateDeterministic(firmMessaging, operatorName);
  }
}

export default new PitchDeckService();
