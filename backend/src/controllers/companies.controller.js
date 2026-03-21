import repo      from '../../db/repo.js';
import store     from '../store.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { uid, nowIso }   from '../lib/helpers.js';
import { SELLER_SIGNAL_FIELDS } from '../config/constants.js';

export async function list(req, res) {
  const { status, search, industry } = req.query;
  const results = await repo.companies.list({ status, search, industry }, store);
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
  const created = await repo.companies.create(company, store);
  res.status(201).json(created);
}

export async function getOne(req, res) {
  const company = await repo.companies.get(req.params.id, store);
  if (!company) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  const interactions = store.interactions.filter((i) => i.companyId === req.params.id);
  const deals        = store.deals.filter((d) => d.companyId === req.params.id);
  res.json({ ...company, interactions, deals });
}

export async function update(req, res) {
  const existing = await repo.companies.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  if (SELLER_SIGNAL_FIELDS.some((f) => f in req.validated)) {
    const merged = { ...existing, ...updates };
    updates.sellerSignalScore = SELLER_SIGNAL_FIELDS.filter((f) => merged[f]).length;
  }
  const updated = await repo.companies.update(req.params.id, updates, store);
  res.json(updated);
}

export async function remove(req, res) {
  const existing = await repo.companies.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Company not found');
  await repo.companies.delete(req.params.id, store);
  res.status(204).end();
}
