/**
 * ApolloAdapter
 *
 * External lead discovery via Apollo.io.
 * Always checks IntegrationRegistry before making any API call.
 * Degrades gracefully to manual-entry guidance when disabled or unreachable.
 */

import IntegrationRegistry from '../services/IntegrationRegistry.js';
import { withRetry } from '../utils/retry.js';

const APOLLO_BASE = 'https://api.apollo.io/v1';

// ─── Graceful degradation result shape ───────────────────────────────────────
function degraded(guard) {
  return {
    source:    'manual',
    data:      [],
    warning:   guard.degradedMessage,
    suggestion: 'You can still add companies manually or import CSV data.',
    status:    guard.status,
    reason:    guard.reason,
  };
}

// ─── API call helper ──────────────────────────────────────────────────────────
async function apolloFetch(path, body) {
  const cfg = IntegrationRegistry.getConfig('apollo');
  const response = await withRetry(async () => {
    const res = await fetch(`${APOLLO_BASE}${path}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key':    cfg.apiKey,
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (res.status === 429) throw Object.assign(new Error('Apollo rate limited'), { code: 'RATE_LIMITED', retryable: false });
    if (res.status === 401) throw Object.assign(new Error('Apollo auth failed'), { code: 'AUTH_FAILED',  retryable: false });
    if (!res.ok)            throw new Error(`Apollo returned ${res.status}`);
    return res.json();
  }, {
    maxRetries:  3,
    baseDelayMs: 1000,
    shouldRetry: (err) => err.retryable !== false,
    onRetry:     (attempt, err, delay) => console.warn(`[ApolloAdapter] retry ${attempt} in ${delay}ms — ${err.message}`),
  });

  IntegrationRegistry.recordSuccess('apollo');
  return response;
}

// ─── Adapter interface ────────────────────────────────────────────────────────

/**
 * Search for companies matching criteria.
 * Falls back gracefully if Apollo is disabled or unreachable.
 */
export async function searchCompanies({ industries = [], locations = [], employeeRanges = [], keywords = [], page = 1 } = {}) {
  const guard = IntegrationRegistry.guard('apollo');
  if (!guard.ok) return degraded(guard);

  try {
    const data = await apolloFetch('/mixed_companies/search', {
      page,
      per_page: 25,
      organization_industry_tag_ids: industries,
      organization_locations:        locations,
      organization_num_employees_ranges: employeeRanges,
      q_organization_keyword_tags:   keywords,
    });

    return {
      source:     'apollo',
      data:       (data.organizations || []).map(_normalizeCompany),
      total:      data.pagination?.total_entries ?? 0,
      page,
      status:     'connected',
    };
  } catch (err) {
    IntegrationRegistry.recordError('apollo', err.message);
    return {
      source:    'error',
      data:      [],
      warning:   IntegrationRegistry.getStatus('apollo').lastError,
      message:   'Apollo service temporarily unavailable. Lead discovery will resume once connection is restored.',
      status:    'unreachable',
    };
  }
}

/**
 * Enrich a single company with Apollo data.
 */
export async function enrichCompany({ domain, name } = {}) {
  const guard = IntegrationRegistry.guard('apollo');
  if (!guard.ok) return { enriched: false, warning: guard.degradedMessage };

  try {
    const data = await apolloFetch('/organizations/enrich', { domain, name });
    return { enriched: true, source: 'apollo', data: _normalizeCompany(data.organization) };
  } catch (err) {
    IntegrationRegistry.recordError('apollo', err.message);
    return { enriched: false, warning: err.message };
  }
}

/**
 * Search for people (contacts) at a company.
 */
export async function searchPeople({ companyDomain, titles = [], seniorities = [] } = {}) {
  const guard = IntegrationRegistry.guard('apollo');
  if (!guard.ok) return degraded(guard);

  try {
    const data = await apolloFetch('/mixed_people/search', {
      per_page: 10,
      organization_domains: [companyDomain],
      person_titles:        titles,
      person_seniorities:   seniorities,
    });
    return {
      source:  'apollo',
      data:    (data.people || []).map(_normalizePerson),
      status:  'connected',
    };
  } catch (err) {
    IntegrationRegistry.recordError('apollo', err.message);
    return { source: 'error', data: [], warning: err.message };
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────────
function _normalizeCompany(org) {
  if (!org) return null;
  return {
    apolloId:         org.id,
    name:             org.name,
    domain:           org.primary_domain,
    industry:         org.industry,
    employeeCount:    org.estimated_num_employees,
    annualRevenue:    org.annual_revenue,
    city:             org.city,
    state:            org.state,
    country:          org.country,
    foundedYear:      org.founded_year,
    description:      org.short_description,
    linkedinUrl:      org.linkedin_url,
  };
}

function _normalizePerson(p) {
  if (!p) return null;
  return {
    apolloId:    p.id,
    firstName:   p.first_name,
    lastName:    p.last_name,
    title:       p.title,
    email:       p.email,
    phone:       p.phone_numbers?.[0]?.sanitized_number,
    linkedinUrl: p.linkedin_url,
    seniority:   p.seniority,
  };
}

export const ApolloAdapter = { searchCompanies, enrichCompany, searchPeople };
export default ApolloAdapter;
