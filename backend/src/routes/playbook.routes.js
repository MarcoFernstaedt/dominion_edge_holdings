import express       from 'express';
import store         from '../store.js';
import PlaybookService from '../../services/PlaybookService.js';
import ExecutionTrackerService from '../../services/ExecutionTrackerService.js';
import AuditLogService from '../../services/AuditLogService.js';
import { errorResponse } from '../middleware/errorResponse.js';

const router = express.Router();

router.get('/api/playbook/summary', (req, res) => {
  try { res.json(PlaybookService.getPlaybookSummary()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/playbook/stages', (req, res) => {
  try {
    const stages = PlaybookService.getStages().map((stage) => ({
      ...stage,
      completion: PlaybookService.evaluateStageCompletion(stage.id),
    }));
    res.json({ stages });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/playbook/current', (req, res) => {
  try { res.json(PlaybookService.getCurrentStage()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/playbook/stages/:id', (req, res) => {
  try {
    const stage = PlaybookService.getStage(req.params.id);
    if (!stage) return errorResponse(res, 404, 'NOT_FOUND', 'Playbook stage not found');
    const tasks      = PlaybookService.getTasksForStage(stage.id);
    const progress   = PlaybookService.getProgressForStage(stage.id);
    const completion = PlaybookService.evaluateStageCompletion(stage.id);
    res.json({ stage, tasks, progress, completion });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/playbook/next-tasks', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    res.json({ tasks: PlaybookService.getNextTasks(limit) });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.post('/api/playbook/tasks/:id/complete', (req, res) => {
  try {
    const task = (store.playbookTasks || []).find((t) => t.id === req.params.id);
    if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Playbook task not found');
    const { notes = '' } = req.body;
    const progress = PlaybookService.markTaskComplete(req.params.id, notes);
    AuditLogService.log('playbook_task_completed', { taskId: req.params.id, title: task.taskTitle });
    res.json({ progress, task });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.patch('/api/playbook/tasks/:id/status', (req, res) => {
  try {
    const { status, notes = '' } = req.body;
    if (!status) return errorResponse(res, 400, 'VALIDATION_ERROR', 'status required');
    const task = (store.playbookTasks || []).find((t) => t.id === req.params.id);
    if (!task) return errorResponse(res, 404, 'NOT_FOUND', 'Playbook task not found');
    const progress = PlaybookService.updateTaskStatus(req.params.id, status, notes);
    AuditLogService.log('playbook_task_updated', { taskId: req.params.id, status });
    res.json({ progress, task });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/playbook/today', (req, res) => {
  try {
    let executionSummary = null;
    try { executionSummary = ExecutionTrackerService.getExecutionSummary(); } catch { /* optional */ }
    res.json(PlaybookService.generateDailyActions(executionSummary));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.post('/api/playbook/sync', (req, res) => {
  try {
    const synced = PlaybookService.syncAutomaticTasks();
    AuditLogService.log('playbook_synced', { synced });
    res.json({ synced, message: `${synced} automatic task${synced !== 1 ? 's' : ''} updated` });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/playbook/progress', (req, res) => {
  try { res.json({ progress: store.playbookProgress || [] }); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

export default router;
