/**
 * monitoring.routes.js
 *
 * All routes under /api/monitoring
 */

import { Router } from 'express';
import {
  listEntities,
  registerEntityHandler,
  disableEntityHandler,
  triggerCheck,
  listAlerts,
  unreadCount,
  updateAlert,
  dismissAll,
  alertsByEntity,
} from '../controllers/monitoring.controller.js';

const router = Router();

// ─── Monitored entities ───────────────────────────────────────────────────────
router.get   ('/entities',                              listEntities);
router.post  ('/entities',                              registerEntityHandler);
router.delete('/entities/:monitoredEntityId',           disableEntityHandler);
router.post  ('/entities/:monitoredEntityId/check',     triggerCheck);

// ─── Alerts (MonitorEvents) ───────────────────────────────────────────────────
router.get   ('/alerts',                                listAlerts);
router.get   ('/alerts/unread-count',                   unreadCount);
router.post  ('/alerts/dismiss-all',                    dismissAll);
router.patch ('/alerts/:eventId',                       updateAlert);
router.get   ('/alerts/by-entity/:entityType/:entityId', alertsByEntity);

export default router;
