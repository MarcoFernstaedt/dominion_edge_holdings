/**
 * CustomSourceAdapter
 *
 * Placeholder for user-configured custom API sources.
 * Users can configure an endpoint URL and auth header; this adapter
 * calls it and normalizes the response.
 *
 * Config fields:
 *   endpointUrl, authHeader, authToken, responseArrayPath
 */

import { LeadSourceAdapter } from './LeadSourceAdapter.js';

export class CustomSourceAdapter extends LeadSourceAdapter {
  constructor(config = {}) {
    super(config);
    this.adapterType = 'custom_api';
    this.adapterName = config.name || 'Custom API Source';
  }

  async healthCheck() {
    if (!this.config.endpointUrl) {
      return { success: false, status: 'misconfigured', message: 'Custom source: endpoint URL not configured.' };
    }
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.config.authHeader && this.config.authToken) {
        headers[this.config.authHeader] = this.config.authToken;
      }
      const res = await fetch(this.config.endpointUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        return { success: false, status: 'unreachable', message: `Custom source returned ${res.status}` };
      }
      return { success: true, status: 'healthy', message: 'Custom source reachable.' };
    } catch (err) {
      return { success: false, status: 'unreachable', message: `Custom source unreachable: ${err.message}` };
    }
  }

  async fetchCandidates({ page = 1, limit = 25 } = {}) {
    if (!this.config.endpointUrl) {
      return { candidates: [], nextPage: null, warnings: ['Custom source: no endpoint configured'], errors: [] };
    }

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.config.authHeader && this.config.authToken) {
        headers[this.config.authHeader] = this.config.authToken;
      }

      const url = new URL(this.config.endpointUrl);
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', String(limit));

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return { candidates: [], nextPage: null, warnings: [], errors: [`Custom source fetch failed: ${res.status}`] };
      }

      const data = await res.json();
      // Allow user to specify a path like "data.results" to extract array
      let rawList = data;
      if (this.config.responseArrayPath) {
        for (const segment of this.config.responseArrayPath.split('.')) {
          rawList = rawList?.[segment];
        }
      }

      if (!Array.isArray(rawList)) {
        return { candidates: [], nextPage: null, warnings: ['Custom source response was not an array'], errors: [] };
      }

      const candidates = rawList.map((r) => this.normalizeCandidate(r));
      return { candidates, nextPage: rawList.length === limit ? page + 1 : null, warnings: [], errors: [] };
    } catch (err) {
      return { candidates: [], nextPage: null, warnings: [], errors: [`Custom source error: ${err.message}`] };
    }
  }

  normalizeCandidate(raw) {
    const map = this.config.fieldMapping || {};
    const get = (field) => raw[map[field] || field] || null;

    return {
      externalSourceId: get('id') || null,
      name: get('name') || get('company_name') || '',
      industry: get('industry') || null,
      subIndustry: get('sub_industry') || null,
      website: get('website') || null,
      phone: get('phone') || null,
      email: get('email') || null,
      address: get('address') || null,
      city: get('city') || null,
      state: get('state') || null,
      zip: get('zip') || null,
      country: get('country') || 'US',
      sourceUrl: get('source_url') || null,
      sourceType: this.adapterType,
      yearsInBusiness: get('years_in_business') ? Number(get('years_in_business')) : null,
      employeeEstimate: get('employees') ? Number(get('employees')) : null,
      ownerName: get('owner_name') || null,
      rawPayload: raw,
    };
  }

  getRateLimitState() {
    return { remaining: null, resetsAt: null, isLimited: false };
  }
}

export default CustomSourceAdapter;
