import repo      from '../../db/repo.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { uid, nowIso }   from '../lib/helpers.js';
import { SELLER_SIGNAL_FIELDS } from '../config/constants.js';
import { enrichCompany as apolloEnrichCompany } from '../../adapters/ApolloAdapter.js';

export async function list(req, res) {
  const { status, search, industry } = req.query;
  const results = await repo.companies.list({ status, search, industry });
  res.json(results);
}

export async function create(req, res) {
  const validated = req.validated;
  const sellerSignalScore = SELLER_SIGNAL_FIELDS.filter((f) => validated[f]).length;
  const company = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    status: 'target', sellerConversationStatus: 'not_contacted',
    pipelinePressureLevel: 'active', daysSinceLastInteraction: 0,
    sellerSignalScore: Math.max(sellerSignalScore, validated.sellerSignalScore ?? 0),
    ...validated,
  };
  const created = await repo.companies.create(company);
  res.status(201).json(created);
}

export async function getOne(req, res) {
  const company = await repo.companies.get(req.params.id);
  if (!company) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  const [interactions, deals] = await Promise.all([
    repo.interactions.list({ companyId: req.params.id }),
    repo.deals.list({ companyId: req.params.id }),
  ]);
  res.json({ ...company, interactions, deals });
}

export async function update(req, res) {
  const existing = await repo.companies.get(req.params.id);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  if (SELLER_SIGNAL_FIELDS.some((f) => f in req.validated)) {
    const merged = { ...existing, ...updates };
    updates.sellerSignalScore = SELLER_SIGNAL_FIELDS.filter((f) => merged[f]).length;
  }
  const updated = await repo.companies.update(req.params.id, updates);
  res.json(updated);
}

export async function remove(req, res) {
  const existing = await repo.companies.get(req.params.id);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  await repo.companies.delete(req.params.id);
  res.status(204).end();
}

export async function enrich(req, res) {
  const company = await repo.companies.get(req.params.id);
  if (!company) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');

  const result = await apolloEnrichCompany({ domain: company.domain || company.website, name: company.name });
  if (!result.enriched) {
    return res.status(503).json({ enriched: false, warning: result.warning });
  }

  // Merge Apollo data into company (only fill in missing fields)
  const apolloData = result.data || {};
  const updates = { updatedAt: nowIso() };
  if (!company.industry     && apolloData.industry)       updates.industry       = apolloData.industry;
  if (!company.employeeCount && apolloData.employeeCount) updates.employeeCount  = apolloData.employeeCount;
  if (!company.annualRevenue && apolloData.annualRevenue) updates.annualRevenue  = apolloData.annualRevenue;
  if (!company.city         && apolloData.city)           updates.city           = apolloData.city;
  if (!company.state        && apolloData.state)          updates.state          = apolloData.state;
  if (!company.description  && apolloData.description)    updates.description    = apolloData.description;
  if (!company.linkedinUrl  && apolloData.linkedinUrl)    updates.linkedinUrl    = apolloData.linkedinUrl;
  if (!company.foundedYear  && apolloData.foundedYear)    updates.foundedYear    = apolloData.foundedYear;
  updates.apolloId = apolloData.apolloId || company.apolloId;

  const updated = await repo.companies.update(req.params.id, updates);
  res.json({ enriched: true, company: updated, apolloData });
}
