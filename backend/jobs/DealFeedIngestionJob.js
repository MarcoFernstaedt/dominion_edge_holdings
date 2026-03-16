/**
 * DealFeedIngestionJob
 *
 * Background ingestion pipeline for deal feed listings.
 *
 * Design principles:
 *  - NEVER run ingestion in the request cycle.
 *  - All external data is validated and sanitized before storage.
 *  - Log all ingestion results for audit trail.
 *  - Fail gracefully: one failing source does NOT stop others.
 *
 * Current sources:
 *  - manual   : records added via POST /api/deal-feed
 *  - csv      : CSV rows posted to POST /api/deal-feed/ingest/csv
 *  - broker   : placeholder for future broker feed adapters
 *
 * Future sources (stubs only — do NOT activate without legal review):
 *  - bizbuysell : scraping is against ToS — use official API when available
 *  - bizquest   : same
 */

import DealFeedService from '../services/DealFeedService.js';
import AuditLogService from '../services/AuditLogService.js';

// ─── CSV row normaliser ───────────────────────────────────────────────────────

/**
 * Convert a raw CSV row object (string values) into a normalised listing shape.
 * All values are trimmed and coerced to appropriate types.
 * Unknown / missing fields default to safe nulls.
 *
 * @param {Record<string, string>} row
 * @returns {object}
 */
function normalizeCsvRow(row) {
  function str(key) {
    const v = row[key] || row[key.toLowerCase()] || '';
    return String(v).trim().slice(0, 500);
  }
  function num(key) {
    const v = str(key).replace(/[$,\s]/g, '');
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function bool(key) {
    const v = str(key).toLowerCase();
    return v === 'true' || v === 'yes' || v === '1';
  }

  return {
    companyName:           str('companyName')    || str('company_name')    || str('Company Name'),
    industry:              str('industry')       || str('Industry'),
    location:              str('location')       || str('Location'),
    revenueEstimate:       num('revenueEstimate')|| num('revenue_estimate')|| num('Revenue'),
    ebitdaEstimate:        num('ebitdaEstimate') || num('ebitda_estimate') || num('EBITDA'),
    yearsInBusiness:       num('yearsInBusiness')|| num('years_in_business')|| num('Years In Business'),
    listingPrice:          num('listingPrice')   || num('listing_price')   || num('Listing Price') || num('Price'),
    source:                str('source')         || str('Source') || 'csv',
    sourceUrl:             str('sourceUrl')      || str('source_url')      || str('URL'),
    contactName:           str('contactName')    || str('contact_name')    || str('Contact'),
    contactEmail:          str('contactEmail')   || str('contact_email')   || str('Email'),
    contactPhone:          str('contactPhone')   || str('contact_phone')   || str('Phone'),
    ownerRetirementSignal: bool('ownerRetirementSignal') || bool('retirement_signal'),
    noWebsiteSignal:       bool('noWebsiteSignal')       || bool('no_website'),
    notes:                 str('notes')          || str('Notes'),
    externalId:            str('externalId')     || str('external_id')     || str('ID'),
  };
}

// ─── Source adapters ──────────────────────────────────────────────────────────

/**
 * Process a pre-parsed array of CSV rows.
 * @param {object[]}  rawRows   – already parsed from CSV
 * @param {string}    source
 * @returns {{ created: number, skipped: number, errors: number }}
 */
async function ingestCsvRows(rawRows, source = 'csv') {
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { created: 0, skipped: 0, errors: 0 };
  }

  const normalised = rawRows
    .map(normalizeCsvRow)
    .filter((r) => r.companyName); // require at minimum a company name

  const result = DealFeedService.ingestBatch(normalised, source);
  AuditLogService.log('deal_feed_csv_ingested', { source, ...result });
  return result;
}

/**
 * Ingest a single manually-submitted listing (already validated via Zod in the route).
 * @param {object} data
 * @returns {object} – created listing
 */
function ingestManual(data) {
  return DealFeedService.createListing(data);
}

// ─── Broker feed stubs ────────────────────────────────────────────────────────
// These are intentionally STUBS. Activating real scraping without explicit
// broker API agreements could violate Terms of Service.
// Replace with official API integrations when agreements are in place.

async function fetchBizBuySellFeed() {
  // TODO: Replace with official BizBuySell API integration when available.
  // Scraping bizbuysell.com is against their Terms of Service.
  AuditLogService.log('deal_feed_broker_stub', { source: 'bizbuysell', status: 'not_configured' });
  return [];
}

async function fetchBizQuestFeed() {
  // TODO: Replace with official BizQuest API integration when available.
  AuditLogService.log('deal_feed_broker_stub', { source: 'bizquest', status: 'not_configured' });
  return [];
}

// ─── Main job ─────────────────────────────────────────────────────────────────

/**
 * DealFeedIngestionJob
 *
 * Registers with BackgroundJobRunner. Runs on a configurable schedule.
 * Each source adapter is isolated — a single source failure does not abort others.
 */
const DealFeedIngestionJob = {
  id:         'dealFeedIngestion',
  name:       'Deal Feed Ingestion',
  intervalMs: 6 * 60 * 60 * 1000, // every 6 hours

  /**
   * Main job function. Called by BackgroundJobRunner.
   * @param {object} store  – platform store (injected by runner)
   */
  async run(store) {
    const results = [];

    // BizBuySell (stub)
    try {
      const rows = await fetchBizBuySellFeed();
      if (rows.length > 0) {
        const r = DealFeedService.ingestBatch(rows, 'bizbuysell');
        results.push({ source: 'bizbuysell', ...r });
      }
    } catch (err) {
      AuditLogService.log('deal_feed_ingestion_error', { source: 'bizbuysell', error: String(err) });
      results.push({ source: 'bizbuysell', error: true });
    }

    // BizQuest (stub)
    try {
      const rows = await fetchBizQuestFeed();
      if (rows.length > 0) {
        const r = DealFeedService.ingestBatch(rows, 'bizquest');
        results.push({ source: 'bizquest', ...r });
      }
    } catch (err) {
      AuditLogService.log('deal_feed_ingestion_error', { source: 'bizquest', error: String(err) });
      results.push({ source: 'bizquest', error: true });
    }

    // Re-score all listings to pick up any model changes
    DealFeedService._store && DealFeedService.constructor &&
      (() => {
        const listings = store.dealFeedListings || [];
        let rescored = 0;
        for (const l of listings) {
          const prev = l.acquisitionScore;
          const next = require('../services/DealFeedScoringService.js').default?.score(l);
          if (typeof next === 'number' && next !== prev) {
            l.acquisitionScore = next;
            rescored++;
          }
        }
        if (rescored > 0) {
          AuditLogService.log('deal_feed_rescored', { count: rescored });
        }
      })();

    return results;
  },

  // ─── Exported helpers for routes ─────────────────────────────────────────────
  normalizeCsvRow,
  ingestCsvRows,
  ingestManual,
};

export default DealFeedIngestionJob;
