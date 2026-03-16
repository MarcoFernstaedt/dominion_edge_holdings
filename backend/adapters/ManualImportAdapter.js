/**
 * ManualImportAdapter
 *
 * Processes manually-uploaded CSV rows or individually-entered company records.
 * No external connectivity required — always "connected" if enabled.
 *
 * Expected CSV columns (case-insensitive):
 *   name, industry, city, state, website, phone, email, ownerName,
 *   yearsInBusiness, employeeEstimate, notes
 */

import { LeadSourceAdapter } from './LeadSourceAdapter.js';

export class ManualImportAdapter extends LeadSourceAdapter {
  constructor(config = {}) {
    super(config);
    this.adapterType = 'manual_import';
    this.adapterName = 'Manual Import';
  }

  async healthCheck() {
    return { success: true, status: 'healthy', message: 'Manual import adapter always available.' };
  }

  /**
   * fetchCandidates — for manual import, caller passes rows directly in filters.rows
   */
  async fetchCandidates({ filters = {} } = {}) {
    const rows = filters.rows || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      return { candidates: [], nextPage: null, warnings: ['No rows provided for manual import'], errors: [] };
    }

    const candidates = rows.map((r) => this.normalizeCandidate(r));
    return { candidates, nextPage: null, warnings: [], errors: [] };
  }

  normalizeCandidate(raw) {
    // Normalize CSV header keys to lowercase for consistency
    const r = {};
    for (const k of Object.keys(raw)) {
      r[k.toLowerCase().trim().replace(/\s+/g, '_')] = raw[k];
    }

    return {
      externalSourceId: r.id || r.external_id || null,
      name: (r.name || r.company_name || r.business_name || '').trim(),
      industry: r.industry || null,
      subIndustry: r.sub_industry || r.subindustry || null,
      website: r.website || r.url || null,
      phone: r.phone || r.phone_number || null,
      email: r.email || null,
      address: r.address || null,
      city: r.city || null,
      state: r.state || null,
      zip: r.zip || r.zipcode || r.postal_code || null,
      country: r.country || 'US',
      sourceUrl: null,
      sourceType: this.adapterType,
      yearsInBusiness: r.years_in_business ? Number(r.years_in_business) : null,
      employeeEstimate: r.employee_estimate || r.employees ? Number(r.employee_estimate || r.employees) : null,
      ownerName: r.owner_name || r.owner || null,
      notes: r.notes || null,
      rawPayload: raw,
    };
  }

  getRateLimitState() {
    return { remaining: null, resetsAt: null, isLimited: false };
  }
}

export default ManualImportAdapter;
