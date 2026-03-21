import express  from 'express';
import repo      from '../../db/repo.js';
import store     from '../store.js';
import { validate, asyncRoute } from '../middleware/validate.js';
import { errorResponse }         from '../middleware/errorResponse.js';
import { uid, nowIso }           from '../lib/helpers.js';
import { TaskSchema }            from '../../schemas/index.js';

const router = express.Router();

router.get('/api/tasks', asyncRoute(async (req, res) => {
  const { status, priority, companyId, dealId } = req.query;
  const results = await repo.tasks.list({ status, priority, companyId, dealId }, store);
  res.json(results);
}));

router.post('/api/tasks', validate(TaskSchema), asyncRoute(async (req, res) => {
  const task = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), status: 'todo', priority: 'medium', ...req.validated };
  const created = await repo.tasks.create(task, store);
  res.status(201).json(created);
}));

router.patch('/api/tasks/:id', validate(TaskSchema.partial()), asyncRoute(async (req, res) => {
  const existing = await repo.tasks.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
  const updates = { ...req.validated, updatedAt: nowIso() };
  if (updates.status === 'done' && !existing.completedAt) updates.completedAt = nowIso();
  const updated = await repo.tasks.update(req.params.id, updates, store);
  res.json(updated);
}));

router.delete('/api/tasks/:id', asyncRoute(async (req, res) => {
  const existing = await repo.tasks.get(req.params.id, store);
  if (!existing) return errorResponse(res, 404, 'NOT_FOUND', 'Task not found');
  await repo.tasks.delete(req.params.id, store);
  res.status(204).end();
}));

export default router;
