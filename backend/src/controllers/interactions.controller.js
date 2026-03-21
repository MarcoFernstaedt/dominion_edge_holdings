import repo                 from '../../db/repo.js';
import store                from '../store.js';
import AutomationRuleEngine from '../../services/AutomationRuleEngine.js';
import TaskService          from '../../services/TaskService.js';
import NotificationService  from '../../services/NotificationService.js';
import AgentOrchestrator    from '../../services/AgentOrchestrator.js';
import { uid, nowIso, touchEntity } from '../lib/helpers.js';

const serviceCtx = {
  get store() { return store; },
  taskService:         TaskService,
  notificationService: NotificationService,
  orchestrator:        AgentOrchestrator,
  uid,
  nowIso,
};

export async function list(req, res) {
  const { companyId, contactId, dealId, interactionType } = req.query;
  const results = await repo.interactions.list({ companyId, contactId, dealId, interactionType }, store);
  res.json(results);
}

export async function create(req, res) {
  const interaction = { id: uid(), createdAt: nowIso(), ...req.validated };
  const created     = await repo.interactions.create(interaction, store);
  const now         = nowIso();
  if (created.companyId) touchEntity(store.companies, created.companyId, now);
  if (created.contactId) touchEntity(store.contacts,  created.contactId,  now);
  if (created.dealId)    touchEntity(store.deals,     created.dealId,     now);
  AutomationRuleEngine.fire('interaction_logged', { interaction: created }, serviceCtx);
  res.status(201).json(created);
}
