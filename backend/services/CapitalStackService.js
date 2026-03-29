/**
 * CapitalStackService
 * Builds and calculates acquisition financing structures.
 */

import crypto from 'crypto';

class CapitalStackService {
  init(store) {
    this._store = store;
    if (!Array.isArray(store.capitalStacks)) store.capitalStacks = [];
  }

  // ─── Calculation ──────────────────────────────────────────────────────────────

  /**
   * Derives computed fields from raw input.
   * equityRequired = purchasePrice - seniorDebtAmount - sellerNoteAmount
   * equityStillNeeded = equityRequired - committedInvestorEquity
   */
  computeStack(data) {
    const purchasePrice      = Number(data.purchasePrice)      || 0;
    const seniorDebtAmount   = Number(data.seniorDebtAmount)   || 0;
    const sellerNoteAmount   = Number(data.sellerNoteAmount)   || 0;
    const operatorEquity     = Number(data.operatorEquity)     || 0;
    const investorEquity     = Number(data.investorEquity)     || 0;

    const equityRequired     = Math.max(0, purchasePrice - seniorDebtAmount - sellerNoteAmount);
    const committedInvestorEquity = operatorEquity + investorEquity;
    const equityStillNeeded  = Math.max(0, equityRequired - committedInvestorEquity);

    return {
      purchasePrice,
      seniorDebtAmount,
      sellerNoteAmount,
      equityRequired,
      operatorEquity,
      investorEquity,
      committedInvestorEquity,
      equityStillNeeded,
      debtInterestRate:       Number(data.debtInterestRate)       || 0,
      debtTermMonths:         Number(data.debtTermMonths)         || 0,
      sellerNoteRate:         Number(data.sellerNoteRate)         || 0,
      sellerNoteTermMonths:   Number(data.sellerNoteTermMonths)   || 0,
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  listStacks(dealId = null) {
    const stacks = this._store.capitalStacks || [];
    return dealId ? stacks.filter((s) => s.dealId === dealId) : [...stacks];
  }

  getStack(id) {
    return (this._store.capitalStacks || []).find((s) => s.id === id) || null;
  }

  getStackForDeal(dealId) {
    return (this._store.capitalStacks || []).find((s) => s.dealId === dealId) || null;
  }

  createStack(dealId, data, nowIso = new Date().toISOString()) {
    const computed = this.computeStack(data);
    const id = crypto.randomUUID();
    const stack = {
      id,
      dealId: dealId || null,
      ...computed,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    this._store.capitalStacks = [stack, ...(this._store.capitalStacks || [])];
    return stack;
  }

  updateStack(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.capitalStacks || []).findIndex((s) => s.id === id);
    if (idx === -1) return null;
    const existing = this._store.capitalStacks[idx];
    const merged = { ...existing, ...patch };
    const computed = this.computeStack(merged);
    const updated = { ...merged, ...computed, updatedAt: nowIso };
    this._store.capitalStacks[idx] = updated;
    return updated;
  }

  deleteStack(id) {
    const before = (this._store.capitalStacks || []).length;
    this._store.capitalStacks = (this._store.capitalStacks || []).filter((s) => s.id !== id);
    return (this._store.capitalStacks || []).length < before;
  }

  // ─── Dashboard summary ─────────────────────────────────────────────────────

  getCapitalSummary(dealId = null) {
    const stacks = dealId ? this.listStacks(dealId) : this.listStacks();
    if (!stacks.length) {
      return { purchasePrice: 0, equityRequired: 0, equityCommitted: 0, equityRemaining: 0 };
    }
    // Aggregate across all stacks (or single deal)
    const totals = stacks.reduce((acc, s) => ({
      purchasePrice:    acc.purchasePrice    + (s.purchasePrice    || 0),
      equityRequired:   acc.equityRequired   + (s.equityRequired   || 0),
      equityCommitted:  acc.equityCommitted  + (s.committedInvestorEquity || 0),
      equityRemaining:  acc.equityRemaining  + (s.equityStillNeeded || 0),
    }), { purchasePrice: 0, equityRequired: 0, equityCommitted: 0, equityRemaining: 0 });
    return totals;
  }
}

export default new CapitalStackService();
