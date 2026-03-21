import repo      from '../../db/repo.js';
import store     from '../store.js';
import { errorResponse }         from '../middleware/errorResponse.js';
import { uid, nowIso }           from '../lib/helpers.js';

export async function list(req, res) {
  const { companyId, type, search } = req.query;
  const results = await repo.contacts.list({ companyId, contactType: type, search }, store);
  res.json(results);
}

export async function create(req, res) {
  const contact = {
    id: uid(), createdAt: nowIso(), updatedAt: nowIso(),
    fullName: [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
    name:     [req.validated.firstName, req.validated.lastName].filter(Boolean).join(' '),
    ...req.validated,
  };
  const created = await repo.contacts.create(contact, store);
  res.status(201).json(created);
}

export async function getOne(req, res) {
  const contact = await repo.contacts.get(req.params.id, store);
  if (!contact) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
  const interactions = store.interactions.filter((i) => i.contactId === req.params.id);
  res.json({ ...contact, interactions });
}

export async function update(req, res) {
  const existing = await repo.contacts.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Contact not found');
  const updated = await repo.contacts.update(req.params.id, { ...req.validated, updatedAt: nowIso() }, store);
  res.json(updated);
}
