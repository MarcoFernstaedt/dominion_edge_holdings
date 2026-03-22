import repo      from '../../db/repo.js';
import { errorResponse }         from '../middleware/errorResponse.js';
import { uid, nowIso }           from '../lib/helpers.js';
import { searchPeople } from '../../adapters/ApolloAdapter.js';

export async function list(req, res) {
  const { companyId, type, search } = req.query;
  const results = await repo.contacts.list({ companyId, contactType: type, search });
  res.json(results);
}

export async function create(req, res) {
  const contact = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    fullName: [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
    name:     [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
    ...req.validated,
  };
  const created = await repo.contacts.create(contact);
  res.status(201).json(created);
}

export async function getOne(req, res) {
  const contact = await repo.contacts.get(req.params.id);
  if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
  const interactions = await repo.interactions.list({ contactId: req.params.id });
  res.json({ ...contact, interactions });
}

export async function update(req, res) {
  const existing = await repo.contacts.get(req.params.id);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
  const updated = await repo.contacts.update(req.params.id, { ...req.validated, updatedAt: nowIso() });
  res.json(updated);
}

/**
 * Discover contacts at a company via Apollo people search.
 * Returns normalized people records without creating them automatically.
 */
export async function discoverByCompany(req, res) {
  const { domain, titles, seniorities } = req.query;
  if (!domain) return errorResponse(res, 400, 'MISSING_PARAM', 'domain query param is required');

  const result = await searchPeople({
    companyDomain: domain,
    titles:       titles ? titles.split(',') : [],
    seniorities:  seniorities ? seniorities.split(',') : [],
  });

  res.json(result);
}
