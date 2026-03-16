/**
 * InvestorCRMService
 * Manages the investor collection — CRUD, filtering, and relationship automation helpers.
 */

import crypto from 'crypto';

const VALID_INVESTOR_TYPES = [
  'angel', 'family_office', 'private_equity', 'operator_investor',
  'private_lender', 'bank', 'search_fund_investor',
];

const VALID_RELATIONSHIP_STAGES = [
  'cold', 'aware', 'engaged', 'relationship', 'active_investor',
];

class InvestorCRMService {
  /** @param {object} store */
  init(store) {
    this._store = store;
    if (!Array.isArray(store.investors)) store.investors = [];
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  listInvestors({ investorType, relationshipStage, minCheckSize, industry } = {}) {
    let list = [...(this._store.investors || [])];

    if (investorType)       list = list.filter((i) => i.investorType === investorType);
    if (relationshipStage)  list = list.filter((i) => i.relationshipStage === relationshipStage);
    if (typeof minCheckSize === 'number') {
      list = list.filter((i) => (i.checkSizeMax || 0) >= minCheckSize);
    }
    if (industry) {
      list = list.filter((i) =>
        Array.isArray(i.industriesPreferred)
          ? i.industriesPreferred.some((ind) => ind.toLowerCase().includes(industry.toLowerCase()))
          : false
      );
    }

    return list.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  getInvestor(id) {
    return (this._store.investors || []).find((i) => i.id === id) || null;
  }

  createInvestor(data, nowIso = new Date().toISOString()) {
    const id = crypto.randomUUID();
    const investor = {
      id,
      name:                data.name || '',
      organization:        data.organization || '',
      investorType:        VALID_INVESTOR_TYPES.includes(data.investorType) ? data.investorType : 'angel',
      email:               data.email || '',
      phone:               data.phone || '',
      location:            data.location || '',
      checkSizeMin:        typeof data.checkSizeMin === 'number' ? data.checkSizeMin : null,
      checkSizeMax:        typeof data.checkSizeMax === 'number' ? data.checkSizeMax : null,
      industriesPreferred: Array.isArray(data.industriesPreferred) ? data.industriesPreferred : [],
      dealStagePreference: data.dealStagePreference || '',
      riskTolerance:       data.riskTolerance || 'moderate',
      priorDeals:          data.priorDeals || '',
      relationshipStage:   VALID_RELATIONSHIP_STAGES.includes(data.relationshipStage) ? data.relationshipStage : 'cold',
      notes:               data.notes || '',
      lastInteractionAt:   data.lastInteractionAt || null,
      createdAt:           nowIso,
      updatedAt:           nowIso,
    };
    this._store.investors = [investor, ...(this._store.investors || [])];
    return investor;
  }

  updateInvestor(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.investors || []).findIndex((i) => i.id === id);
    if (idx === -1) return null;
    const existing = this._store.investors[idx];
    const allowed = [
      'name', 'organization', 'investorType', 'email', 'phone', 'location',
      'checkSizeMin', 'checkSizeMax', 'industriesPreferred', 'dealStagePreference',
      'riskTolerance', 'priorDeals', 'relationshipStage', 'notes', 'lastInteractionAt',
    ];
    const cleaned = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) cleaned[key] = patch[key];
    }
    // Validate enums if present
    if (cleaned.investorType && !VALID_INVESTOR_TYPES.includes(cleaned.investorType)) {
      delete cleaned.investorType;
    }
    if (cleaned.relationshipStage && !VALID_RELATIONSHIP_STAGES.includes(cleaned.relationshipStage)) {
      delete cleaned.relationshipStage;
    }
    const updated = { ...existing, ...cleaned, updatedAt: nowIso };
    this._store.investors[idx] = updated;
    return updated;
  }

  deleteInvestor(id) {
    const before = (this._store.investors || []).length;
    this._store.investors = (this._store.investors || []).filter((i) => i.id !== id);
    return this._store.investors.length < before;
  }

  // ─── Automation helpers ───────────────────────────────────────────────────────

  /**
   * Returns investors who haven't been contacted in >=30 days.
   */
  getStaleInvestors(thresholdDays = 30) {
    const cutoff = new Date(Date.now() - thresholdDays * 24 * 60 * 60 * 1000).toISOString();
    return (this._store.investors || []).filter((inv) => {
      if (!inv.lastInteractionAt) return true; // never contacted
      return inv.lastInteractionAt < cutoff;
    });
  }

  /**
   * Moves investor to 'engaged' when they express interest.
   */
  markInterested(id, nowIso = new Date().toISOString()) {
    return this.updateInvestor(id, { relationshipStage: 'engaged', lastInteractionAt: nowIso }, nowIso);
  }

  /**
   * Pipeline summary counts for dashboard widget.
   */
  getPipelineSummary() {
    const investors = this._store.investors || [];
    return {
      identified:    investors.length,
      contacted:     investors.filter((i) => i.lastInteractionAt).length,
      conversations: investors.filter((i) => ['engaged', 'relationship', 'active_investor'].includes(i.relationshipStage)).length,
      meetings:      investors.filter((i) => ['relationship', 'active_investor'].includes(i.relationshipStage)).length,
      commitments:   investors.filter((i) => i.relationshipStage === 'active_investor').length,
    };
  }

  /** Valid enums for external validation */
  static get INVESTOR_TYPES() { return VALID_INVESTOR_TYPES; }
  static get RELATIONSHIP_STAGES() { return VALID_RELATIONSHIP_STAGES; }
}

export default new InvestorCRMService();
