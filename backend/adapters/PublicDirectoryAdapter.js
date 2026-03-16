/**
 * PublicDirectoryAdapter
 *
 * Placeholder adapter for public business directories.
 * In production this would connect to a compliant directory API.
 * Current implementation: returns simulated/empty results safely.
 *
 * This adapter will never error-crash the radar scan.
 */

import { LeadSourceAdapter } from './LeadSourceAdapter.js';

export class PublicDirectoryAdapter extends LeadSourceAdapter {
  constructor(config = {}) {
    super(config);
    this.adapterType = 'public_directory';
    this.adapterName = 'Public Directory';
  }

  async healthCheck() {
    if (!this.config.enabled) {
      return { success: false, status: 'disabled', message: 'Public directory adapter is disabled.' };
    }
    return { success: true, status: 'healthy', message: 'Public directory adapter available (placeholder).' };
  }

  async fetchCandidates({ industry, location } = {}) {
    if (!this.config.enabled) {
      return { candidates: [], nextPage: null, warnings: ['Public directory disabled'], errors: [] };
    }
    // Placeholder — real implementation would call a compliant directory API
    return {
      candidates: [],
      nextPage: null,
      warnings: [`Public directory search for "${industry || 'all'}" in "${location || 'all'}" — no source configured yet`],
      errors: [],
    };
  }

  normalizeCandidate(raw) {
    return {
      externalSourceId: raw.id || null,
      name: raw.name || '',
      industry: raw.industry || null,
      subIndustry: null,
      website: raw.website || null,
      phone: raw.phone || null,
      email: raw.email || null,
      address: raw.address || null,
      city: raw.city || null,
      state: raw.state || null,
      zip: raw.zip || null,
      country: raw.country || 'US',
      sourceUrl: raw.listingUrl || null,
      sourceType: this.adapterType,
      yearsInBusiness: null,
      employeeEstimate: null,
      ownerName: null,
      rawPayload: raw,
    };
  }

  getRateLimitState() {
    return { remaining: null, resetsAt: null, isLimited: false };
  }
}

export default PublicDirectoryAdapter;
