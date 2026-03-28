/**
 * DealFeedService
 *
 * CRUD for dealFeedListings and savedListings.
 * CRM import creates a Company + Deal record in the main store.
 *
 * Security rules applied here:
 *  - contactEmail / contactPhone are redacted on list responses.
 *  - Only the full get-by-id response exposes seller contact details.
 *  - All writes are validated before reaching this service.
 */

import crypto from 'crypto';
import DealFeedScoringService from './DealFeedScoringService.js';
import AuditLogService from './AuditLogService.js';

const VALID_STATUSES = ['active', 'archived', 'imported'];
const MAX_PAGE_SIZE  = 50;

// ─── Field sanitiser ──────────────────────────────────────────────────────────

function sanitizeString(val, maxLen = 500) {
  if (typeof val !== 'string') return '';
  // strip HTML tags to prevent stored-XSS
  return val.replace(/<[^>]*>/g, '').slice(0, maxLen).trim();
}

function sanitizeNumber(val) {
  if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) return null;
  return val;
}

// ─── Redact sensitive fields for list view ────────────────────────────────────

function redactForList(listing) {
  // eslint-disable-next-line no-unused-vars
  const { contactEmail, contactPhone, ...safe } = listing;
  return safe;
}

// ─── Service ──────────────────────────────────────────────────────────────────

class DealFeedService {
  /**
   * @param {object} store  - shared in-memory store
   */
  init(store) {
    this._store = store;
    if (!Array.isArray(store.dealFeedListings)) store.dealFeedListings = [];
    if (!Array.isArray(store.savedListings))    store.savedListings    = [];
  }

  // ─── List / filter / paginate ───────────────────────────────────────────────

  /**
   * Returns paginated, filtered, redacted listings.
   * Seller contact info is NOT returned in list view.
   *
   * @param {object} opts
   * @returns {{ listings: object[], total: number, page: number, pageSize: number }}
   */
  listListings({
    industry,
    location,
    minRevenue,
    maxRevenue,
    minYears,
    maxYears,
    minScore,
    status,
    search,
    sortBy = 'acquisitionScore',
    sortDir = 'desc',
    page = 1,
    pageSize = 20,
  } = {}) {
    let items = [...(this._store.dealFeedListings || [])];

    // Default to active listings
    const filterStatus = VALID_STATUSES.includes(status) ? status : 'active';
    items = items.filter((l) => l.listingStatus === filterStatus);

    if (industry) {
      items = items.filter((l) =>
        (l.industry || '').toLowerCase().includes(industry.toLowerCase())
      );
    }
    if (location) {
      items = items.filter((l) =>
        (l.location || '').toLowerCase().includes(location.toLowerCase())
      );
    }
    if (minRevenue !== null && minRevenue !== undefined) {
      items = items.filter((l) => (l.revenueEstimate || 0) >= minRevenue);
    }
    if (maxRevenue !== null && maxRevenue !== undefined) {
      items = items.filter((l) => (l.revenueEstimate || 0) <= maxRevenue);
    }
    if (minYears !== null && minYears !== undefined) {
      items = items.filter((l) => (l.yearsInBusiness || 0) >= minYears);
    }
    if (maxYears !== null && maxYears !== undefined) {
      items = items.filter((l) => (l.yearsInBusiness || 0) <= maxYears);
    }
    if (minScore !== null && minScore !== undefined) {
      items = items.filter((l) => (l.acquisitionScore || 0) >= minScore);
    }
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((l) =>
        (l.companyName || '').toLowerCase().includes(q) ||
        (l.industry    || '').toLowerCase().includes(q) ||
        (l.location    || '').toLowerCase().includes(q)
      );
    }

    // Sort
    const SORTABLE = ['acquisitionScore', 'createdAt', 'revenueEstimate', 'listingPrice', 'yearsInBusiness'];
    const col = SORTABLE.includes(sortBy) ? sortBy : 'acquisitionScore';
    const dir = sortDir === 'asc' ? 1 : -1;
    items.sort((a, b) => {
      const av = a[col] ?? 0;
      const bv = b[col] ?? 0;
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return dir * (bv - av) * -1; // desc default: higher first
    });
    // Fix: for desc we want b > a first
    items.sort((a, b) => {
      const av = a[col] ?? (typeof a[col] === 'string' ? '' : 0);
      const bv = b[col] ?? (typeof b[col] === 'string' ? '' : 0);
      if (typeof av === 'string') return dir * av.localeCompare(bv);
      return sortDir === 'desc' ? bv - av : av - bv;
    });

    const total = items.length;
    const ps    = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    const pg    = Math.max(1, page);
    const start = (pg - 1) * ps;
    const slice = items.slice(start, start + ps);

    return {
      listings: slice.map(redactForList),
      total,
      page: pg,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
  }

  /**
   * Return a single listing with full contact details visible.
   * Caller must have confirmed they have permission to view seller info.
   */
  getListing(id) {
    return (this._store.dealFeedListings || []).find((l) => l.id === id) || null;
  }

  // ─── Create / update ────────────────────────────────────────────────────────

  /**
   * Create a new listing (manual entry or ingestion).
   * Score is computed automatically.
   */
  createListing(data, nowIso = new Date().toISOString()) {
    const id = crypto.randomUUID();
    const listing = {
      id,
      companyName:           sanitizeString(data.companyName, 200),
      industry:              sanitizeString(data.industry, 100),
      location:              sanitizeString(data.location, 200),
      revenueEstimate:       sanitizeNumber(data.revenueEstimate),
      ebitdaEstimate:        sanitizeNumber(data.ebitdaEstimate),
      yearsInBusiness:       sanitizeNumber(data.yearsInBusiness),
      listingPrice:          sanitizeNumber(data.listingPrice),
      source:                sanitizeString(data.source, 100),
      sourceUrl:             sanitizeString(data.sourceUrl, 500),
      contactName:           sanitizeString(data.contactName, 200),
      contactEmail:          sanitizeString(data.contactEmail, 200),
      contactPhone:          sanitizeString(data.contactPhone, 50),
      listingStatus:         VALID_STATUSES.includes(data.listingStatus) ? data.listingStatus : 'active',
      acquisitionScore:      0,
      ownerRetirementSignal: !!data.ownerRetirementSignal,
      noWebsiteSignal:       !!data.noWebsiteSignal,
      notes:                 sanitizeString(data.notes, 2000),
      externalId:            sanitizeString(data.externalId, 200),
      createdAt:             nowIso,
      updatedAt:             nowIso,
    };

    DealFeedScoringService.applyScore(listing);

    this._store.dealFeedListings = [listing, ...(this._store.dealFeedListings || [])];
    AuditLogService.log('deal_feed_listing_created', { listingId: id, companyName: listing.companyName });
    return listing;
  }

  updateListing(id, patch, nowIso = new Date().toISOString()) {
    const idx = (this._store.dealFeedListings || []).findIndex((l) => l.id === id);
    if (idx === -1) return null;
    const existing = this._store.dealFeedListings[idx];

    const allowed = [
      'companyName', 'industry', 'location', 'revenueEstimate', 'ebitdaEstimate',
      'yearsInBusiness', 'listingPrice', 'source', 'sourceUrl', 'contactName',
      'contactEmail', 'contactPhone', 'listingStatus', 'ownerRetirementSignal',
      'noWebsiteSignal', 'notes',
    ];
    const cleaned = { ...existing };
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        if (key === 'listingStatus') {
          cleaned[key] = VALID_STATUSES.includes(patch[key]) ? patch[key] : existing[key];
        } else if (['revenueEstimate', 'ebitdaEstimate', 'yearsInBusiness', 'listingPrice'].includes(key)) {
          cleaned[key] = sanitizeNumber(patch[key]);
        } else if (['ownerRetirementSignal', 'noWebsiteSignal'].includes(key)) {
          cleaned[key] = !!patch[key];
        } else {
          cleaned[key] = sanitizeString(patch[key]);
        }
      }
    }

    cleaned.updatedAt = nowIso;
    // Rescore on update
    DealFeedScoringService.applyScore(cleaned);

    this._store.dealFeedListings[idx] = cleaned;
    return cleaned;
  }

  archiveListing(id, nowIso = new Date().toISOString()) {
    return this.updateListing(id, { listingStatus: 'archived' }, nowIso);
  }

  // ─── Saved listings ─────────────────────────────────────────────────────────

  getSavedListings(userId) {
    const saved = (this._store.savedListings || []).filter((s) => s.userId === userId);
    // Join with listing data (redacted)
    return saved.map((s) => {
      const listing = (this._store.dealFeedListings || []).find((l) => l.id === s.listingId);
      return {
        ...s,
        listing: listing ? redactForList(listing) : null,
      };
    });
  }

  saveListing(userId, listingId, nowIso = new Date().toISOString()) {
    const exists = (this._store.savedListings || []).some(
      (s) => s.userId === userId && s.listingId === listingId
    );
    if (exists) return null; // already saved

    const listing = this.getListing(listingId);
    if (!listing) return null;

    const saved = {
      id:        crypto.randomUUID(),
      userId:    String(userId).slice(0, 100),
      listingId,
      savedAt:   nowIso,
    };
    this._store.savedListings = [saved, ...(this._store.savedListings || [])];
    return saved;
  }

  unsaveListing(userId, listingId) {
    const before = (this._store.savedListings || []).length;
    this._store.savedListings = (this._store.savedListings || []).filter(
      (s) => !(s.userId === userId && s.listingId === listingId)
    );
    return this._store.savedListings.length < before;
  }

  isListingSaved(userId, listingId) {
    return (this._store.savedListings || []).some(
      (s) => s.userId === userId && s.listingId === listingId
    );
  }

  // ─── CRM import ─────────────────────────────────────────────────────────────

  /**
   * Import a listing into the CRM.
   * Creates a Company record and a Deal record.
   * Marks listing as 'imported'.
   *
   * @param {string}   listingId
   * @param {object}   store        – full platform store (has companies + deals)
   * @param {Function} uid          – () => uuid
   * @param {Function} nowIso       – () => ISO string
   * @param {Function} onImported   – optional callback({ company, deal }) for automations
   * @returns {{ company: object, deal: object, listing: object } | null}
   */
  importToCRM(listingId, store, uid, nowIso = new Date().toISOString(), onImported) {
    const listing = this.getListing(listingId);
    if (!listing) return null;

    // Avoid duplicate imports: check if a company with matching name + source already exists
    const existing = (store.companies || []).find(
      (c) => c.name === listing.companyName && c.sourceDealFeedId === listingId
    );
    if (existing) {
      return { company: existing, deal: null, listing, alreadyImported: true };
    }

    const companyId = uid();
    const company = {
      id:                   companyId,
      name:                 listing.companyName,
      industry:             listing.industry || '',
      location:             listing.location || '',
      city:                 '',
      state:                listing.location || '',
      ownerName:            listing.contactName || '',
      estimatedRevenueLow:  listing.revenueEstimate || null,
      estimatedRevenueHigh: listing.revenueEstimate || null,
      estimatedSDELow:      listing.ebitdaEstimate  || null,
      estimatedSDEHigh:     listing.ebitdaEstimate  || null,
      yearsInBusiness:      listing.yearsInBusiness || null,
      source:               listing.source || 'deal_feed',
      sourceDealFeedId:     listingId,
      status:               'target',
      notes:                listing.notes || '',
      retirementSignal:     listing.ownerRetirementSignal || false,
      noWebsiteSignal:      listing.noWebsiteSignal || false,
      createdAt:            nowIso,
      updatedAt:            nowIso,
    };

    const dealId = uid();
    const deal = {
      id:               dealId,
      companyName:      listing.companyName,
      companyId,
      dealType:         'platform',
      estimatedRevenue: listing.revenueEstimate || null,
      estimatedSDE:     listing.ebitdaEstimate  || null,
      askingPrice:      listing.listingPrice     || null,
      stage:            'identified',
      status:           'active',
      source:           listing.source || 'deal_feed',
      sourceDealFeedId: listingId,
      notes:            `Imported from Deal Feed. Score: ${listing.acquisitionScore}/100.`,
      createdAt:        nowIso,
      updatedAt:        nowIso,
    };

    store.companies = [company, ...(store.companies || [])];
    store.deals     = [deal,    ...(store.deals     || [])];

    // Mark listing as imported
    this.updateListing(listingId, { listingStatus: 'imported' }, nowIso);

    AuditLogService.log('deal_feed_listing_imported', {
      listingId,
      companyId,
      dealId,
      companyName: listing.companyName,
    });

    if (typeof onImported === 'function') {
      try { onImported({ company, deal, listing }); } catch { /* no-op */ }
    }

    return { company, deal, listing, alreadyImported: false };
  }

  // ─── Batch ingestion ─────────────────────────────────────────────────────────

  /**
   * Ingest an array of raw listing objects (from CSV / broker feed / manual bulk).
   * Deduplicates by externalId (if provided).
   *
   * @param {object[]} rows
   * @param {string}   source  – e.g. 'csv', 'bizbuysell', 'manual'
   * @returns {{ created: number, skipped: number, errors: number }}
   */
  ingestBatch(rows, source = 'manual') {
    let created = 0, skipped = 0, errors = 0;
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      try {
        // Deduplicate by externalId
        if (row.externalId) {
          const dup = (this._store.dealFeedListings || []).find(
            (l) => l.externalId === String(row.externalId)
          );
          if (dup) { skipped++; continue; }
        }
        this.createListing({ ...row, source: row.source || source }, nowIso);
        created++;
      } catch {
        errors++;
      }
    }

    return { created, skipped, errors };
  }

  // ─── Aggregates ──────────────────────────────────────────────────────────────

  getIndustryBreakdown() {
    const active = (this._store.dealFeedListings || []).filter((l) => l.listingStatus === 'active');
    const counts = {};
    for (const l of active) {
      const k = l.industry || 'Unknown';
      counts[k] = (counts[k] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([industry, count]) => ({ industry, count }))
      .sort((a, b) => b.count - a.count);
  }

  getScoreDistribution() {
    const active = (this._store.dealFeedListings || []).filter((l) => l.listingStatus === 'active');
    const buckets = { '0-24': 0, '25-49': 0, '50-74': 0, '75-100': 0 };
    for (const l of active) {
      const s = l.acquisitionScore || 0;
      if (s < 25)       buckets['0-24']++;
      else if (s < 50)  buckets['25-49']++;
      else if (s < 75)  buckets['50-74']++;
      else              buckets['75-100']++;
    }
    return buckets;
  }

  getSummary() {
    const all    = this._store.dealFeedListings || [];
    const active = all.filter((l) => l.listingStatus === 'active');
    const scores = active.map((l) => l.acquisitionScore || 0);
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const topListings = active
      .slice()
      .sort((a, b) => (b.acquisitionScore || 0) - (a.acquisitionScore || 0))
      .slice(0, 5)
      .map(redactForList);

    return {
      totalListings: all.length,
      activeListings: active.length,
      savedListings: (this._store.savedListings || []).length,
      importedListings: all.filter((l) => l.listingStatus === 'imported').length,
      avgScore,
      topListings,
      industryBreakdown: this.getIndustryBreakdown(),
      scoreDistribution: this.getScoreDistribution(),
    };
  }
}

export default new DealFeedService();
