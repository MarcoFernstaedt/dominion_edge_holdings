/**
 * InvestorMemoService
 * Generates structured deal summaries for investors.
 * Supports deterministic template mode and AI-assisted (Claude Sonnet) generation.
 */

import crypto from 'crypto';

class InvestorMemoService {
  init(store, aiService) {
    this._store = store;
    this._ai = aiService;
    if (!Array.isArray(store.investorMemos)) store.investorMemos = [];
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  listMemos(dealId = null) {
    const memos = this._store.investorMemos || [];
    return dealId ? memos.filter((m) => m.dealId === dealId) : [...memos];
  }

  getMemo(id) {
    return (this._store.investorMemos || []).find((m) => m.id === id) || null;
  }

  createMemo(data, nowIso = new Date().toISOString()) {
    const id = crypto.randomUUID();
    const memo = {
      id,
      dealId:             data.dealId || null,
      title:              data.title || '',
      summary:            data.summary || '',
      purchasePrice:      Number(data.purchasePrice)  || 0,
      revenue:            Number(data.revenue)         || 0,
      ebitda:             Number(data.ebitda)          || 0,
      dealStructure:      data.dealStructure           || '',
      expectedReturns:    data.expectedReturns         || '',
      riskFactors:        data.riskFactors             || '',
      operatorBackground: data.operatorBackground      || '',
      createdAt:          nowIso,
      updatedAt:          nowIso,
    };
    this._store.investorMemos = [memo, ...(this._store.investorMemos || [])];
    return memo;
  }

  updateMemo(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.investorMemos || []).findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const allowed = [
      'title', 'summary', 'purchasePrice', 'revenue', 'ebitda',
      'dealStructure', 'expectedReturns', 'riskFactors', 'operatorBackground',
    ];
    const cleaned = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) cleaned[key] = patch[key];
    }
    const updated = { ...this._store.investorMemos[idx], ...cleaned, updatedAt: nowIso };
    this._store.investorMemos[idx] = updated;
    return updated;
  }

  deleteMemo(id) {
    const before = (this._store.investorMemos || []).length;
    this._store.investorMemos = (this._store.investorMemos || []).filter((m) => m.id !== id);
    return (this._store.investorMemos || []).length < before;
  }

  // ─── Generation ───────────────────────────────────────────────────────────────

  /**
   * Deterministic template — always works without AI.
   */
  buildDeterministicMemo(data) {
    const pp = this._formatCurrency(data.purchasePrice);
    const rev = this._formatCurrency(data.revenue);
    const ebitda = this._formatCurrency(data.ebitda);
    const multiple = data.ebitda > 0 ? (data.purchasePrice / data.ebitda).toFixed(1) : 'N/A';

    return {
      title: data.title || `Deal Memo — ${data.companyName || 'Target Company'}`,
      summary: [
        `This memo summarizes the acquisition opportunity for ${data.companyName || 'the target company'}.`,
        `The business is offered at ${pp}, representing a ${multiple}x EBITDA multiple.`,
        `Trailing twelve-month revenue is ${rev} with EBITDA of ${ebitda}.`,
      ].join(' '),
      dealStructure: data.dealStructure || `Purchase price of ${pp} financed through a combination of senior debt, seller note, and equity.`,
      expectedReturns: data.expectedReturns || 'Returns will be driven by operational improvements, debt paydown, and potential multiple expansion over a 5-7 year hold period.',
      riskFactors: data.riskFactors || 'Key risks include customer concentration, key-person dependency, and general economic sensitivity. These risks are mitigated through operational due diligence and earnout provisions.',
      operatorBackground: data.operatorBackground || 'The acquiring operator brings relevant industry experience and an operational improvement playbook aligned with the target business.',
    };
  }

  /**
   * AI-assisted memo generation using Claude Sonnet.
   * Falls back to deterministic template if AI unavailable.
   */
  async generateMemo(data, useAI = true) {
    if (!useAI || !this._ai) {
      return this.buildDeterministicMemo(data);
    }

    const pp = this._formatCurrency(data.purchasePrice);
    const rev = this._formatCurrency(data.revenue);
    const ebitda = this._formatCurrency(data.ebitda);
    const multiple = data.ebitda > 0 ? (data.purchasePrice / data.ebitda).toFixed(1) : 'N/A';

    const prompt = `You are helping an acquisition operator write a professional investor deal memo.
Write concise, professional narrative sections based on these facts:

Company: ${data.companyName || 'Target Company'}
Purchase Price: ${pp}
Revenue (TTM): ${rev}
EBITDA (TTM): ${ebitda}
Multiple: ${multiple}x EBITDA
Deal Structure: ${data.dealStructure || 'SBA + seller note + equity'}
Operator Background: ${data.operatorBackground || 'Experienced operator with relevant industry expertise'}

Write the following sections in JSON format:
{
  "summary": "2-3 sentence executive summary",
  "dealStructure": "2-3 sentence deal structure description",
  "expectedReturns": "2-3 sentence return expectation",
  "riskFactors": "2-3 sentence risk discussion with mitigants"
}

Be factual, professional, and concise. Do not make up specific numbers.`;

    try {
      const response = await this._ai.complete(prompt, { model: 'claude-sonnet-4-6', maxTokens: 600 });
      const text = response?.content?.[0]?.text || response?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          title: data.title || `Deal Memo — ${data.companyName || 'Target Company'}`,
          summary:            parsed.summary            || '',
          dealStructure:      parsed.dealStructure      || '',
          expectedReturns:    parsed.expectedReturns    || '',
          riskFactors:        parsed.riskFactors        || '',
          operatorBackground: data.operatorBackground   || '',
        };
      }
    } catch { /* fall through */ }

    return this.buildDeterministicMemo(data);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  _formatCurrency(n) {
    const num = Number(n) || 0;
    if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)     return `$${(num / 1_000).toFixed(0)}K`;
    return `$${num.toLocaleString()}`;
  }
}

export default new InvestorMemoService();
