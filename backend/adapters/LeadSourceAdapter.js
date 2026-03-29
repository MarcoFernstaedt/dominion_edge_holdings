/**
 * LeadSourceAdapter — base interface / no-op implementation
 *
 * All source adapters MUST extend this class and implement:
 *   healthCheck, fetchCandidates, normalizeCandidate, getRateLimitState
 *
 * Platform guarantees: if any method throws, SourcingRadarService catches
 * the error and marks the adapter as failed — never crashing the scan.
 */

export class LeadSourceAdapter {
  constructor(config = {}) {
    this.config = config;
    this.adapterType = 'base';
    this.adapterName = 'Base Adapter';
  }

  /**
   * Health check — verifies connectivity / credentials.
   * @returns {{ success: boolean, status: string, message: string }}
   */
  async healthCheck() {
    return { success: false, status: 'misconfigured', message: 'healthCheck not implemented' };
  }

  /**
   * Fetch raw candidate records from the source.
   * @param {{ filters, location, industry, lastRunAt, page, limit }} input
   * @returns {{ candidates: any[], nextPage: any, warnings: string[], errors: string[] }}
   */
  async fetchCandidates(input) { // eslint-disable-line no-unused-vars
    return { candidates: [], nextPage: null, warnings: ['fetchCandidates not implemented'], errors: [] };
  }

  /**
   * Normalize a raw source record into the common candidate shape.
   * @param {any} raw
   * @returns {object} Normalized candidate fields
   */
  normalizeCandidate(raw) { // eslint-disable-line no-unused-vars
    return {
      externalSourceId: null,
      name: '',
      industry: null,
      subIndustry: null,
      website: null,
      phone: null,
      email: null,
      address: null,
      city: null,
      state: null,
      zip: null,
      country: 'US',
      sourceUrl: null,
      sourceType: this.adapterType,
      yearsInBusiness: null,
      employeeEstimate: null,
      ownerName: null,
      rawPayload: raw,
    };
  }

  /**
   * Return current rate-limit state.
   * @returns {{ remaining: number|null, resetsAt: string|null, isLimited: boolean }}
   */
  getRateLimitState() {
    return { remaining: null, resetsAt: null, isLimited: false };
  }
}

export default LeadSourceAdapter;
