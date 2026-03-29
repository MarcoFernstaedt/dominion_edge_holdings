/**
 * ApolloLeadAdapter
 *
 * Pulls company/contact data from Apollo.io API.
 * Requires: config.apiKey (Apollo API key)
 * Falls back gracefully if API is unavailable or key missing.
 *
 * API ref: https://apolloio.github.io/apollo-api-docs/
 */

import { LeadSourceAdapter } from './LeadSourceAdapter.js';

const APOLLO_BASE_URL = 'https://api.apollo.io/v1';
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 50; // conservative default

export class ApolloLeadAdapter extends LeadSourceAdapter {
  constructor(config = {}) {
    super(config);
    this.adapterType = 'apollo';
    this.adapterName = 'Apollo.io';
    this._callCount = 0;
    this._windowStart = Date.now();
  }

  _hasKey() {
    return !!(this.config.apiKey && this.config.apiKey.trim());
  }

  _resetWindowIfNeeded() {
    if (Date.now() - this._windowStart > RATE_LIMIT_WINDOW_MS) {
      this._callCount = 0;
      this._windowStart = Date.now();
    }
  }

  async healthCheck() {
    if (!this._hasKey()) {
      return { success: false, status: 'misconfigured', message: 'Apollo API key not configured.' };
    }

    this._resetWindowIfNeeded();
    if (this._callCount >= RATE_LIMIT_MAX) {
      return { success: false, status: 'rate_limited', message: 'Apollo rate limit reached. Try later.' };
    }

    try {
      const res = await fetch(`${APOLLO_BASE_URL}/accounts/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.config.apiKey,
        },
        body: JSON.stringify({ per_page: 1 }),
        signal: AbortSignal.timeout(8000),
      });
      this._callCount++;

      if (res.status === 401 || res.status === 403) {
        return { success: false, status: 'misconfigured', message: 'Invalid Apollo API key.' };
      }
      if (res.status === 429) {
        return { success: false, status: 'rate_limited', message: 'Apollo API rate limited.' };
      }
      if (!res.ok) {
        return { success: false, status: 'unreachable', message: `Apollo API returned ${res.status}` };
      }
      return { success: true, status: 'healthy', message: 'Apollo API connected.' };
    } catch (err) {
      return { success: false, status: 'unreachable', message: `Apollo API unreachable: ${err.message}` };
    }
  }

  async fetchCandidates({ filters = {}, industry, location, lastRunAt, page = 1, limit = 25 } = {}) {
    if (!this._hasKey()) {
      return { candidates: [], nextPage: null, warnings: ['Apollo adapter: API key not configured'], errors: [] };
    }

    this._resetWindowIfNeeded();
    if (this._callCount >= RATE_LIMIT_MAX) {
      return { candidates: [], nextPage: null, warnings: ['Apollo rate limited'], errors: [] };
    }

    const body = {
      per_page: Math.min(limit, 25),
      page,
    };

    if (industry) body.organization_industry_tag_ids = []; // would map industry to Apollo tags
    if (location) body.organization_locations = [location];
    if (filters.minEmployees) body.num_employees_ranges = [`${filters.minEmployees},${filters.maxEmployees || 500}`];

    try {
      const res = await fetch(`${APOLLO_BASE_URL}/accounts/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': this.config.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      this._callCount++;

      if (res.status === 429) {
        return { candidates: [], nextPage: null, warnings: ['Apollo rate limited during fetch'], errors: [] };
      }
      if (!res.ok) {
        return { candidates: [], nextPage: null, warnings: [], errors: [`Apollo fetch failed: ${res.status}`] };
      }

      const data = await res.json();
      const accounts = data.accounts || [];
      const candidates = accounts.map((a) => this.normalizeCandidate(a));
      const hasMore = accounts.length === limit;

      return { candidates, nextPage: hasMore ? page + 1 : null, warnings: [], errors: [] };
    } catch (err) {
      return { candidates: [], nextPage: null, warnings: [], errors: [`Apollo fetch error: ${err.message}`] };
    }
  }

  normalizeCandidate(raw) {
    return {
      externalSourceId: raw.id || null,
      name: raw.name || raw.company_name || '',
      industry: raw.industry || null,
      subIndustry: null,
      website: raw.website_url || raw.primary_domain ? `https://${raw.primary_domain}` : null,
      phone: raw.phone || null,
      email: raw.contact_email || null,
      address: null,
      city: raw.city || null,
      state: raw.state || null,
      zip: null,
      country: raw.country || 'US',
      sourceUrl: null,
      sourceType: this.adapterType,
      yearsInBusiness: raw.founded_year ? new Date().getFullYear() - raw.founded_year : null,
      employeeEstimate: raw.employee_count || null,
      ownerName: null,
      rawPayload: raw,
    };
  }

  getRateLimitState() {
    this._resetWindowIfNeeded();
    const remaining = Math.max(0, RATE_LIMIT_MAX - this._callCount);
    const resetsAt = new Date(this._windowStart + RATE_LIMIT_WINDOW_MS).toISOString();
    return { remaining, resetsAt, isLimited: remaining === 0 };
  }
}

export default ApolloLeadAdapter;
