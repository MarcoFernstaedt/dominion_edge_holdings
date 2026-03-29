import store   from '../store.js';
import ConversationMetricsService from '../../services/ConversationMetricsService.js';
import NotificationService        from '../../services/NotificationService.js';
import { errorResponse }          from '../middleware/errorResponse.js';

export function getKpi(req, res) {
  try {
    const weekStart = req.query.weekStart ? String(req.query.weekStart) : undefined;
    res.json(ConversationMetricsService.getKPIStatus(weekStart));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getWeeklyReport(req, res) {
  try {
    const weekStart = req.query.weekStart ? String(req.query.weekStart) : undefined;
    res.json(ConversationMetricsService.getWeeklyReport(weekStart));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getTrends(req, res) {
  try {
    const weeksBack = req.query.weeks ? Math.min(52, parseInt(req.query.weeks, 10)) : 8;
    res.json({ trends: ConversationMetricsService.calculateConversationTrends(weeksBack) });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getPipelineHealth(req, res) {
  try { res.json({ alerts: ConversationMetricsService.getPipelineHealthAlerts() }); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getTargets(req, res) {
  try { res.json({ targets: ConversationMetricsService.getTargets() }); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function setTarget(req, res) {
  try {
    const { entityType, weeklyTarget } = req.validated;
    const updated = ConversationMetricsService.setTarget(entityType, weeklyTarget);
    res.json({ targets: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getAgentContext(req, res) {
  try { res.json(ConversationMetricsService.getAgentContext()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function list(req, res) {
  try {
    const { entityType, conversationType, search, dateFrom, dateTo, sortDir, page, pageSize } = req.query;
    res.json(ConversationMetricsService.listConversations({
      entityType:       entityType       ? String(entityType)       : undefined,
      conversationType: conversationType ? String(conversationType) : undefined,
      search:           search           ? String(search).slice(0, 200) : undefined,
      dateFrom:         dateFrom         ? String(dateFrom)         : undefined,
      dateTo:           dateTo           ? String(dateTo)           : undefined,
      sortDir:          sortDir          ? String(sortDir)          : 'desc',
      page:             page             ? parseInt(page, 10)       : 1,
      pageSize:         pageSize         ? parseInt(pageSize, 10)   : 50,
    }));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function create(req, res) {
  try {
    const conversation = ConversationMetricsService.recordConversation(req.validated);

    const alerts = ConversationMetricsService.getPipelineHealthAlerts();
    for (const alert of alerts.filter((a) => a.severity === 'critical')) {
      const n = NotificationService.createNotification({
        type:     'system',
        title:    alert.title,
        message:  alert.message,
        priority: 'high',
      });
      store.notifications = [n, ...(store.notifications || [])].slice(0, 100);
    }

    res.status(201).json({ conversation });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function update(req, res) {
  try {
    const updated = ConversationMetricsService.updateConversation(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Conversation not found');
    res.json({ conversation: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function remove(req, res) {
  try {
    const deleted = ConversationMetricsService.deleteConversation(req.params.id);
    if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Conversation not found');
    res.json({ deleted: true });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}
