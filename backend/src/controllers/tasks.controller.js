import repo      from '../../db/repo.js';
import { errorResponse } from '../middleware/errorResponse.js';
import { uid, nowIso }   from '../lib/helpers.js';

export async function list(req, res) {
  const { status, priority, companyId, dealId } = req.query;
  const results = await repo.tasks.list({ status, priority, companyId, dealId });
  res.json(results);
}

export async function create(req, res) {
  const task = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), status: 'todo', priority: 'medium', ...req.validated };
  const created = await repo.tasks.create(task);
  res.status(201).json(created);
}

export async function update(req, res) {
  const existing = await repo.tasks.get(req.params.id);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  if (updates.status === 'done' && !existing.completedAt) updates.completedAt = nowIso();
  const updated = await repo.tasks.update(req.params.id, updates);
  res.json(updated);
}

export async function remove(req, res) {
  const existing = await repo.tasks.get(req.params.id);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
  await repo.tasks.delete(req.params.id);
  res.status(204).end();
}
