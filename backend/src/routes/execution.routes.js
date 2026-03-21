import express from 'express';
import ExecutionTrackerService from '../../services/ExecutionTrackerService.js';
import { errorResponse } from '../middleware/errorResponse.js';

const router = express.Router();

router.get('/api/execution/summary', (req, res) => {
  try { res.json(ExecutionTrackerService.getExecutionSummary()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/pipeline-health', (req, res) => {
  try { res.json(ExecutionTrackerService.getPipelineHealth()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/targets', (req, res) => {
  try { res.json({ targets: ExecutionTrackerService.getTargets() }); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.patch('/api/execution/targets', (req, res) => {
  try {
    const { targetType, targetValue, period } = req.body;
    if (!targetType || targetValue === undefined) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'targetType and targetValue required');
    }
    const targets = ExecutionTrackerService.setTarget(targetType, Number(targetValue), period);
    res.json({ targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/target-completion', (req, res) => {
  try { res.json(ExecutionTrackerService.checkTargetCompletion()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/daily', (req, res) => {
  try {
    const date = req.query.date || undefined;
    const stat = date
      ? ExecutionTrackerService.getDailyStats(date)
      : ExecutionTrackerService.getTodayStats();
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/daily/history', (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 90);
    res.json({ stats: ExecutionTrackerService.getDailyStatsList(limit) });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.post('/api/execution/daily', (req, res) => {
  try { res.json(ExecutionTrackerService.recordDailyActivity(req.body)); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/weekly', (req, res) => {
  try {
    const weekStart = req.query.weekStart || undefined;
    const stat      = ExecutionTrackerService.getWeeklyStats(weekStart);
    const targets   = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.post('/api/execution/weekly', (req, res) => {
  try {
    const { weekStart, ...patch } = req.body;
    res.json(ExecutionTrackerService.updateWeeklyStats(patch, weekStart));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/monthly', (req, res) => {
  try {
    const month   = req.query.month || undefined;
    const stat    = ExecutionTrackerService.getMonthlyStats(month);
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.post('/api/execution/monthly', (req, res) => {
  try {
    const { month, ...patch } = req.body;
    res.json(ExecutionTrackerService.updateMonthlyStats(patch, month));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/pipeline', (req, res) => {
  try {
    const pipeline = ExecutionTrackerService.calculatePipelineStats();
    const targets  = ExecutionTrackerService.getTargets();
    res.json({ pipeline, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/board', (req, res) => {
  try {
    const board   = ExecutionTrackerService.calculateBoardStats();
    const targets = ExecutionTrackerService.getTargets();
    res.json({ board, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/investors', (req, res) => {
  try {
    const investors = ExecutionTrackerService.calculateInvestorStats();
    const targets   = ExecutionTrackerService.getTargets();
    res.json({ investors, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/deal-momentum', (req, res) => {
  try {
    const momentum = ExecutionTrackerService.calculateMomentumStats();
    res.json({
      momentum,
      stalled: momentum.filter((m) => m.riskLevel === 'stalled'),
      cooling: momentum.filter((m) => m.riskLevel === 'cooling'),
    });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/execution/alerts', (req, res) => {
  try {
    const summary = ExecutionTrackerService.getExecutionSummary();
    res.json({ alerts: summary.alerts });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

export default router;
