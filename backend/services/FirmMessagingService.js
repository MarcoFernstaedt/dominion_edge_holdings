/**
 * FirmMessagingService
 * Manages acquisition thesis, mission statement, and investor messaging.
 * AI drafting via Claude Haiku; deterministic fallback always available.
 */

import crypto from 'crypto';

class FirmMessagingService {
  init(store, aiService) {
    this._store = store;
    this._ai = aiService;
    if (!Array.isArray(store.firmMessaging)) store.firmMessaging = [];
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  list() {
    return [...(this._store.firmMessaging || [])].sort(
      (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')
    );
  }

  getLatest() {
    const list = this.list();
    return list[0] || null;
  }

  get(id) {
    return (this._store.firmMessaging || []).find((f) => f.id === id) || null;
  }

  create(data, nowIso = new Date().toISOString()) {
    const id = crypto.randomUUID();
    const record = {
      id,
      missionStatement:      data.missionStatement      || '',
      investmentThesis:      data.investmentThesis       || '',
      targetIndustries:      Array.isArray(data.targetIndustries) ? data.targetIndustries : [],
      targetDealSize:        data.targetDealSize         || '',
      geographicFocus:       data.geographicFocus        || '',
      valueCreationStrategy: data.valueCreationStrategy  || '',
      createdAt:             nowIso,
      updatedAt:             nowIso,
    };
    this._store.firmMessaging = [record, ...(this._store.firmMessaging || [])];
    return record;
  }

  update(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.firmMessaging || []).findIndex((f) => f.id === id);
    if (idx === -1) return null;
    const allowed = [
      'missionStatement', 'investmentThesis', 'targetIndustries',
      'targetDealSize', 'geographicFocus', 'valueCreationStrategy',
    ];
    const cleaned = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) cleaned[key] = patch[key];
    }
    const updated = { ...this._store.firmMessaging[idx], ...cleaned, updatedAt: nowIso };
    this._store.firmMessaging[idx] = updated;
    return updated;
  }

  // ─── Generation ───────────────────────────────────────────────────────────────

  /**
   * Deterministic mission statement from structured inputs.
   */
  buildDeterministicMission(inputs) {
    const industries = (inputs.targetIndustries || []).join(', ') || 'small businesses';
    const size = inputs.targetDealSize || '$1M–$10M';
    const geo = inputs.geographicFocus || 'the United States';
    const why = inputs.whyThese || 'strong fundamentals and recurring cash flow';
    const ops = inputs.operationalImprovements || 'operational systems, talent, and technology';

    return [
      `We acquire and operate ${industries} businesses in ${geo} with revenues of ${size}.`,
      `We target companies with ${why}, where focused operational improvements in ${ops} create lasting enterprise value.`,
      `Our mission is to be the preferred partner for founders seeking a trusted transition of their life's work.`,
    ].join(' ');
  }

  buildDeterministicThesis(inputs) {
    const industries = (inputs.targetIndustries || []).join(', ') || 'essential-service businesses';
    const size = inputs.targetDealSize || '$1M–$10M EBITDA';
    return [
      `We focus on acquiring ${industries} companies with ${size} in revenue.`,
      `These businesses benefit from our operator-led approach, hands-on management, and capital discipline.`,
      `We create value through revenue growth, cost optimization, and strategic add-on acquisitions.`,
    ].join(' ');
  }

  /**
   * AI-assisted mission statement using Claude Haiku.
   */
  async generateMission(inputs, useAI = true) {
    if (!useAI || !this._ai) {
      return {
        missionStatement: this.buildDeterministicMission(inputs),
        investmentThesis:  this.buildDeterministicThesis(inputs),
      };
    }

    const prompt = `You are helping an acquisition entrepreneur write their firm's mission statement and investment thesis.

Inputs:
- Target industries: ${(inputs.targetIndustries || []).join(', ') || 'not specified'}
- Target deal size: ${inputs.targetDealSize || 'not specified'}
- Why these industries: ${inputs.whyThese || 'not specified'}
- Operational improvements: ${inputs.operationalImprovements || 'not specified'}
- Geographic focus: ${inputs.geographicFocus || 'not specified'}
- Value creation strategy: ${inputs.valueCreationStrategy || 'not specified'}

Write a JSON response with:
{
  "missionStatement": "2-3 sentence mission statement that is clear, compelling, and authentic",
  "investmentThesis": "2-3 sentence investment thesis explaining what you acquire and why"
}

Be concise, professional, and avoid jargon.`;

    try {
      const response = await this._ai.complete(prompt, {
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 400,
      });
      const text = response?.content?.[0]?.text || response?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          missionStatement: parsed.missionStatement || this.buildDeterministicMission(inputs),
          investmentThesis:  parsed.investmentThesis  || this.buildDeterministicThesis(inputs),
        };
      }
    } catch { /* fall through */ }

    return {
      missionStatement: this.buildDeterministicMission(inputs),
      investmentThesis:  this.buildDeterministicThesis(inputs),
    };
  }
}

export default new FirmMessagingService();
