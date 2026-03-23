/**
 * monitoring.controller.js
 *
 * REST handlers for target monitoring (Component C).
 * Routes: /api/monitoring/…
 *
 * Alert actions: dismiss | mark read | convert to task | register entity
 */

import prisma from '../lib/prisma.js';
import {
  registerEntity,
  disableEntity,
  runEntityCheck,
  SIGNAL_TYPES,
} from '../../services/MonitoringEngine.js';
import pino from 'pino';

const logger = pino({ name: 'monitoring.controller' });

// ─── Monitored entities ───────────────────────────────────────────────────────

/**
 * GET /api/monitoring/entities
 * List all monitored entities for the authenticated user.
 */
export async function listEntities(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const entities = await prisma.monitoredEntity.findMany({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { events: { where: { reviewState: 'unread' } } },
        },
      },
    });

    res.json({ entities, total: entities.length });
  } catch (err) {
    logger.error({ err }, '[monitoring] listEntities error');
    res.status(500).json({ error: 'Failed to list monitored entities' });
  }
}

/**
 * POST /api/monitoring/entities
 * Register a company/deal/contact for monitoring.
 * Body: { entityType, entityId, displayName, website?, linkedinUrl?, googlePlaceId?, checkIntervalMs? }
 */
export async function registerEntityHandler(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { entityType, entityId, displayName, website, linkedinUrl, googlePlaceId, checkIntervalMs } = req.body;

  if (!entityType || !entityId || !displayName) {
    return res.status(400).json({ error: 'entityType, entityId, and displayName are required' });
  }
  if (!['company', 'deal', 'contact'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be company | deal | contact' });
  }

  try {
    const entity = await registerEntity({ userId, entityType, entityId, displayName, website, linkedinUrl, googlePlaceId, checkIntervalMs });
    res.status(201).json({ entity });
  } catch (err) {
    logger.error({ err }, '[monitoring] registerEntity error');
    res.status(500).json({ error: 'Failed to register entity for monitoring' });
  }
}

/**
 * DELETE /api/monitoring/entities/:monitoredEntityId
 * Disable monitoring for an entity.
 */
export async function disableEntityHandler(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { monitoredEntityId } = req.params;
  try {
    const entity = await prisma.monitoredEntity.findUnique({ where: { id: monitoredEntityId } });
    if (!entity || entity.userId !== userId) {
      return res.status(404).json({ error: 'Monitored entity not found' });
    }
    await prisma.monitoredEntity.update({ where: { id: monitoredEntityId }, data: { enabled: false } });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[monitoring] disableEntity error');
    res.status(500).json({ error: 'Failed to disable monitoring' });
  }
}

/**
 * POST /api/monitoring/entities/:monitoredEntityId/check
 * Trigger an immediate check for one entity (manual re-check).
 */
export async function triggerCheck(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { monitoredEntityId } = req.params;
  try {
    const entity = await prisma.monitoredEntity.findUnique({ where: { id: monitoredEntityId } });
    if (!entity || entity.userId !== userId) {
      return res.status(404).json({ error: 'Monitored entity not found' });
    }
    // Run async — return immediately
    runEntityCheck(entity).catch(err => logger.error({ err }, '[monitoring] triggerCheck error'));
    res.json({ status: 'checking' });
  } catch (err) {
    logger.error({ err }, '[monitoring] triggerCheck error');
    res.status(500).json({ error: 'Failed to trigger check' });
  }
}

// ─── Alert (MonitorEvent) handlers ───────────────────────────────────────────

/**
 * GET /api/monitoring/alerts
 * List monitor events (alerts) for the authenticated user.
 * Query: ?reviewState=unread|read|dismissed|converted_task  &severity=  &entityType=  &entityId=  &limit=  &offset=
 */
export async function listAlerts(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { reviewState, severity, entityType, entityId, limit = '50', offset = '0' } = req.query;

  const where = { userId };
  if (reviewState) where.reviewState = reviewState;
  if (severity)    where.severity    = severity;
  if (entityType)  where.entityType  = entityType;
  if (entityId)    where.entityId    = entityId;

  try {
    const [events, total] = await Promise.all([
      prisma.monitorEvent.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        take:    Math.min(parseInt(limit, 10) || 50, 200),
        skip:    parseInt(offset, 10) || 0,
        include: { monitoredEntity: { select: { displayName: true, entityType: true, website: true } } },
      }),
      prisma.monitorEvent.count({ where }),
    ]);

    res.json({ events, total });
  } catch (err) {
    logger.error({ err }, '[monitoring] listAlerts error');
    res.status(500).json({ error: 'Failed to list alerts' });
  }
}

/**
 * GET /api/monitoring/alerts/unread-count
 * Returns count of unread alerts for badge display.
 */
export async function unreadCount(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const count = await prisma.monitorEvent.count({
      where: { userId, reviewState: 'unread' },
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get unread count' });
  }
}

/**
 * PATCH /api/monitoring/alerts/:eventId
 * Update alert review state: dismiss | mark read | convert to task.
 * Body: { reviewState: 'read'|'dismissed' } OR { action: 'convert_task', taskTitle?, taskNote? }
 */
export async function updateAlert(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { eventId } = req.params;
  const { reviewState, action, taskTitle, taskNote } = req.body;

  try {
    const event = await prisma.monitorEvent.findUnique({ where: { id: eventId } });
    if (!event || event.userId !== userId) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    if (action === 'convert_task') {
      // Create a task linked to the entity
      const title = taskTitle || `Follow up: ${event.title}`;
      const description = [
        taskNote,
        event.aiNextAction,
        event.summary,
      ].filter(Boolean).join('\n\n').slice(0, 2000);

      const priority = event.severity === 'critical' ? 'critical'
                     : event.severity === 'important' ? 'high'
                     : 'medium';

      const task = await prisma.task.create({
        data: {
          userId,
          title:           title.slice(0, 250),
          description,
          status:          'todo',
          priority,
          linkedEntityType: event.entityType,
          linkedEntityId:  event.entityId,
          source:          'monitor_alert',
        },
      });

      // Mark event as converted
      const updated = await prisma.monitorEvent.update({
        where: { id: eventId },
        data:  { reviewState: 'converted_task', taskId: task.id },
      });

      return res.json({ event: updated, task });
    }

    // Simple state update
    const allowedStates = ['read', 'dismissed', 'unread'];
    if (reviewState && !allowedStates.includes(reviewState)) {
      return res.status(400).json({ error: `reviewState must be one of: ${allowedStates.join(', ')}` });
    }

    const updated = await prisma.monitorEvent.update({
      where: { id: eventId },
      data:  { reviewState: reviewState ?? 'read' },
    });

    res.json({ event: updated });
  } catch (err) {
    logger.error({ err }, '[monitoring] updateAlert error');
    res.status(500).json({ error: 'Failed to update alert' });
  }
}

/**
 * POST /api/monitoring/alerts/dismiss-all
 * Dismiss all unread alerts for the user (bulk action).
 */
export async function dismissAll(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { count } = await prisma.monitorEvent.updateMany({
      where: { userId, reviewState: 'unread' },
      data:  { reviewState: 'dismissed' },
    });
    res.json({ dismissed: count });
  } catch (err) {
    logger.error({ err }, '[monitoring] dismissAll error');
    res.status(500).json({ error: 'Failed to dismiss alerts' });
  }
}

/**
 * GET /api/monitoring/alerts/by-entity/:entityType/:entityId
 * Get all alerts for a specific company/deal/contact (for inline badges in detail views).
 */
export async function alertsByEntity(req, res) {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const { entityType, entityId } = req.params;

  try {
    const events = await prisma.monitorEvent.findMany({
      where:   { userId, entityType, entityId },
      orderBy: { detectedAt: 'desc' },
      take:    100,
    });
    const unread = events.filter(e => e.reviewState === 'unread').length;
    res.json({ events, total: events.length, unread });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get entity alerts' });
  }
}
