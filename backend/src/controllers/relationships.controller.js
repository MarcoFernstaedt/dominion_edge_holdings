import store   from '../store.js';
import RelationshipService    from '../../services/RelationshipService.js';
import AutomationRuleEngine   from '../../services/AutomationRuleEngine.js';
import NotificationService    from '../../services/NotificationService.js';
import { errorResponse }      from '../middleware/errorResponse.js';
import { uid, nowIso }        from '../lib/helpers.js';

const serviceCtx = {
  get store() { return store; },
  notificationService: NotificationService,
  uid,
  nowIso,
};

export function getDashboard(req, res) {
  try { res.json(RelationshipService.getDashboardData()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function list(req, res) {
  try {
    const {
      entityType, relationshipStatus, interestLevel, overdue,
      search, sortBy, sortDir, page, pageSize,
    } = req.query;

    res.json(RelationshipService.listRelationships({
      entityType:         entityType         ? String(entityType)         : undefined,
      relationshipStatus: relationshipStatus ? String(relationshipStatus) : undefined,
      interestLevel:      interestLevel      ? String(interestLevel)      : undefined,
      overdue:            overdue === 'true' ? true                       : undefined,
      search:             search             ? String(search).slice(0, 200) : undefined,
      sortBy:             sortBy             ? String(sortBy)             : 'nextFollowUpDate',
      sortDir:            sortDir            ? String(sortDir)            : 'asc',
      page:               page               ? parseInt(page, 10)        : 1,
      pageSize:           pageSize           ? parseInt(pageSize, 10)    : 50,
    }));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getExecutionCounts(req, res) {
  try { res.json(RelationshipService.getExecutionCounts()); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function generateTasks(req, res) {
  try {
    const created = RelationshipService.generateFollowUpTasks(store, uid, nowIso());
    res.json({ tasksCreated: created });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getOne(req, res) {
  try {
    const rel = RelationshipService.getRelationship(req.params.id);
    if (!rel) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    const { interactions, total: interactionTotal } = RelationshipService.getInteractions(rel.id, { limit: 20 });
    res.json({ relationship: rel, interactions, interactionTotal });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function create(req, res) {
  try {
    const rel = RelationshipService.createRelationship(req.validated);
    res.status(201).json({ relationship: rel });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function update(req, res) {
  try {
    const updated = RelationshipService.updateRelationship(req.params.id, req.validated);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    res.json({ relationship: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function remove(req, res) {
  try {
    const deleted = RelationshipService.deleteRelationship(req.params.id);
    if (!deleted) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    res.json({ deleted: true });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function getInteractions(req, res) {
  try {
    const rel = RelationshipService.getRelationship(req.params.id);
    if (!rel) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    const limit  = req.query.limit  ? parseInt(req.query.limit, 10)  : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    res.json(RelationshipService.getInteractions(req.params.id, { limit, offset }));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function logInteraction(req, res) {
  try {
    const interaction = RelationshipService.logInteraction(req.params.id, req.validated);
    if (!interaction) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');

    const updated = RelationshipService.calculateRelationshipStatus(req.params.id);

    const rel = RelationshipService.getRelationship(req.params.id);
    if (rel?.entityType === 'seller') {
      AutomationRuleEngine.fire('interaction_logged', { relationship: rel, interaction }, serviceCtx);
    }

    res.status(201).json({ interaction, relationship: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function updateInterestLevel(req, res) {
  try {
    const { interestLevel } = req.body || {};
    const updated = RelationshipService.updateInterestLevel(req.params.id, interestLevel);
    if (!updated) return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid interestLevel or relationship not found');
    res.json({ relationship: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}

export function scheduleFollowup(req, res) {
  try {
    const updated = RelationshipService.scheduleNextFollowUp(req.params.id, req.validated.daysFromNow);
    if (!updated) return errorResponse(res, 404, 'NOT_FOUND', 'Relationship not found');
    res.json({ relationship: updated });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
}
