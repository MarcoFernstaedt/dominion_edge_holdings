import ExecutionTrackerService from '../../services/ExecutionTrackerService.js';
import { errorResponse } from '../middleware/errorResponse.js';

export function getExecutionSummary(req, res) {
  try { res.json(ExecutionTrackerService.getExecutionSummary()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getPipelineHealth(req, res) {
  try { res.json(ExecutionTrackerService.getPipelineHealth()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getTargets(req, res) {
  try { res.json({ targets: ExecutionTrackerService.getTargets() }); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function setTargets(req, res) {
  try {
    const { targetType, targetValue, period } = req.body;
    if (!targetType || targetValue === undefined) {
      return errorResponse(res, 400, 'VALIDATION_ERROR', 'targetType and targetValue required');
    }
    const targets = ExecutionTrackerService.setTarget(targetType, Number(targetValue), period);
    res.json({ targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getTargetCompletion(req, res) {
  try { res.json(ExecutionTrackerService.checkTargetCompletion()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getDaily(req, res) {
  try {
    const date = req.query.date || undefined;
    const stat = date
      ? ExecutionTrackerService.getDailyStats(date)
      : ExecutionTrackerService.getTodayStats();
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getDailyHistory(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 30, 90);
    res.json({ stats: ExecutionTrackerService.getDailyStatsList(limit) });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function recordDailyActivity(req, res) {
  try { res.json(ExecutionTrackerService.recordDailyActivity(req.body)); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getWeekly(req, res) {
  try {
    const weekStart = req.query.weekStart || undefined;
    const stat      = ExecutionTrackerService.getWeeklyStats(weekStart);
    const targets   = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function updateWeekly(req, res) {
  try {
    const { weekStart, ...patch } = req.body;
    res.json(ExecutionTrackerService.updateWeeklyStats(patch, weekStart));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getMonthly(req, res) {
  try {
    const month   = req.query.month || undefined;
    const stat    = ExecutionTrackerService.getMonthlyStats(month);
    const targets = ExecutionTrackerService.getTargets();
    res.json({ stat, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function updateMonthly(req, res) {
  try {
    const { month, ...patch } = req.body;
    res.json(ExecutionTrackerService.updateMonthlyStats(patch, month));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getPipeline(req, res) {
  try {
    const pipeline = ExecutionTrackerService.calculatePipelineStats();
    const targets  = ExecutionTrackerService.getTargets();
    res.json({ pipeline, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getBoard(req, res) {
  try {
    const board   = ExecutionTrackerService.calculateBoardStats();
    const targets = ExecutionTrackerService.getTargets();
    res.json({ board, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getInvestors(req, res) {
  try {
    const investors = ExecutionTrackerService.calculateInvestorStats();
    const targets   = ExecutionTrackerService.getTargets();
    res.json({ investors, targets });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getDealMomentum(req, res) {
  try {
    const momentum = ExecutionTrackerService.calculateMomentumStats();
    res.json({
      momentum,
      stalled: momentum.filter((m) => m.riskLevel === 'stalled'),
      cooling: momentum.filter((m) => m.riskLevel === 'cooling'),
    });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getAlerts(req, res) {
  try {
    const summary = ExecutionTrackerService.getExecutionSummary();
    res.json({ alerts: summary.alerts });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}
