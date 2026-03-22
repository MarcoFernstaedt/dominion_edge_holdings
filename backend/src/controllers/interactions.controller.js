import repo                 from '../../db/repo.js';
import AutomationRuleEngine from '../../services/AutomationRuleEngine.js';
import TaskService          from '../../services/TaskService.js';
import NotificationService  from '../../services/NotificationService.js';
import AgentOrchestrator    from '../../services/AgentOrchestrator.js';
import { uid, nowIso } from '../lib/helpers.js';

const serviceCtx = {
  taskService:         TaskService,
  notificationService: NotificationService,
  orchestrator:        AgentOrchestrator,
  uid,
  nowIso,
};

export async function list(req, res) {
  const { companyId, contactId, dealId, interactionType } = req.query;
  const results = await repo.interactions.list({ companyId, contactId, dealId, interactionType });
  res.json(results);
}

export async function create(req, res) {
  const interaction = { id: uid(), createdAt: nowIso(), ...req.validated };
  const created     = await repo.interactions.create(interaction);
  const now         = nowIso();
  const touchUpdates = { lastInteractionAt: now, updatedAt: now };
  // Touch related entities in DB (fire-and-forget; non-fatal if entity not found)
  await Promise.all([
    created.companyId ? repo.companies.update(created.companyId, touchUpdates).catch(() => null) : null,
    created.contactId ? repo.contacts.update(created.contactId, touchUpdates).catch(() => null)  : null,
    created.dealId    ? repo.deals.update(created.dealId, touchUpdates).catch(() => null)         : null,
  ]);
  AutomationRuleEngine.fire('interaction_logged', { interaction: created }, serviceCtx);
  res.status(201).json(created);
}
