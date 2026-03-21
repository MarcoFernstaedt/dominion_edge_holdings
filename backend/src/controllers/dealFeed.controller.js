import store   from '../store.js';
import DealFeedService        from '../../services/DealFeedService.js';
import DealFeedScoringService from '../../services/DealFeedScoringService.js';
import DealFeedIngestionJob   from '../../jobs/DealFeedIngestionJob.js';
import AutomationRuleEngine   from '../../services/AutomationRuleEngine.js';
import { errorResponse }      from '../middleware/errorResponse.js';
import { uid, nowIso }        from '../lib/helpers.js';

const serviceCtx = {
  get store() { return store; },
  uid,
  nowIso,
};

export function list(req, res) {
  try {
    const {
      industry, location, minRevenue, maxRevenue,
      minYears, maxYears, minScore, status, search,
      sortBy, sortDir, page, pageSize,
    } = req.query;

    const result = DealFeedService.listListings({
      industry:   industry   ? String(industry).slice(0, 100)   : undefined,
      location:   location   ? String(location).slice(0, 200)   : undefined,
      minRevenue: minRevenue ? Number(minRevenue)  : undefined,
      maxRevenue: maxRevenue ? Number(maxRevenue)  : undefined,
      minYears:   minYears   ? Number(minYears)    : undefined,
      maxYears:   maxYears   ? Number(maxYears)    : undefined,
      minScore:   minScore   ? Number(minScore)    : undefined,
      status:     status     ? String(status)      : 'active',
      search:     search     ? String(search).slice(0, 200) : undefined,
      sortBy:     sortBy     ? String(sortBy)      : 'acquisitionScore',
      sortDir:    sortDir    ? String(sortDir)     : 'desc',
      page:       page       ? parseInt(page, 10)  : 1,
      pageSize:   pageSize   ? parseInt(pageSize, 10) : 20,
    });
    res.json(result);
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', err.message);
  }
}

export function summary(req, res) {
  try { res.json(DealFeedService.getSummary()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function saved(req, res) {
  try {
    const userId = req.query.userId ? String(req.query.userId).slice(0, 100) : 'default';
    res.json({ saved: DealFeedService.getSavedListings(userId) });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getOne(req, res) {
  try {
    const listing = DealFeedService.getListing(req.params.id);
    if (!listing) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    const scoreBreakdown = DealFeedScoringService.breakdown(listing);
    res.json({ listing, scoreBreakdown });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function create(req, res) {
  try {
    const listing = DealFeedService.createListing(req.validated);
    res.status(201).json({ listing });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function update(req, res) {
  try {
    const updated = DealFeedService.updateListing(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    res.json({ listing: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function archive(req, res) {
  try {
    const updated = DealFeedService.archiveListing(req.params.id);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    res.json({ archived: true });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function saveListing(req, res) {
  try {
    const { listingId, userId } = req.validated;
    const saved = DealFeedService.saveListing(userId, listingId);
    if (saved === null) {
      const listing = DealFeedService.getListing(listingId);
      if (!listing) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
      return res.json({ saved: false, alreadySaved: true });
    }
    res.status(201).json({ saved: true, record: saved });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function unsaveListing(req, res) {
  try {
    const userId    = req.query.userId    ? String(req.query.userId).slice(0, 100) : 'default';
    const listingId = req.query.listingId ? String(req.query.listingId) : '';
    if (!listingId) return errorResponse(res, 400, 'VALIDATION_ERROR', 'listingId is required');
    const removed = DealFeedService.unsaveListing(userId, listingId);
    res.json({ removed });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function importListing(req, res) {
  try {
    const { listingId } = req.validated;
    const result = DealFeedService.importToCRM(
      listingId,
      store,
      uid,
      nowIso(),
      ({ company, deal }) => {
        AutomationRuleEngine.fire('company_created',    { company },                     serviceCtx);
        AutomationRuleEngine.fire('deal_stage_changed', { deal, stage: 'identified' },   serviceCtx);
        AutomationRuleEngine.fire('playbook_sync_on_company_created', {},                serviceCtx);
      }
    );
    if (!result) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    res.status(result.alreadyImported ? 200 : 201).json(result);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export async function ingestCsv(req, res) {
  try {
    const { rows, source } = req.validated;
    const result = await DealFeedIngestionJob.ingestCsvRows(rows, source);
    res.json({ ingested: true, ...result });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function score(req, res) {
  try {
    const listing = DealFeedService.getListing(req.params.id);
    if (!listing) return errorResponse(res, 404, 'NOT_FOUND', 'Listing not found');
    const score     = DealFeedScoringService.applyScore(listing);
    const breakdown = DealFeedScoringService.breakdown(listing);
    res.json({ score, breakdown });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}
