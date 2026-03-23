/**
 * src/routes/index.js — Central route registry
 *
 * Mounts every domain router onto the Express app.
 * app.js imports only this file; nothing else.
 */

import healthRouter        from './health.routes.js';
import chatRouter          from './chat.routes.js';
import dashboardRouter     from './dashboard.routes.js';
import companiesRouter     from './companies.routes.js';
import contactsRouter      from './contacts.routes.js';
import interactionsRouter  from './interactions.routes.js';
import dealsRouter         from './deals.routes.js';
import underwritingRouter  from './underwriting.routes.js';
import boardRouter         from './board.routes.js';
import networkRouter       from './network.routes.js';
import investorsRouter     from './investors.routes.js';
import checklistRouter     from './checklist.routes.js';
import tasksRouter         from './tasks.routes.js';
import meetingsRouter      from './meetings.routes.js';
import inboxRouter         from './inbox.routes.js';
import documentsRouter     from './documents.routes.js';
import agentsRouter        from './agents.routes.js';
import approvalsRouter     from './approvals.routes.js';
import timingRouter        from './timing.routes.js';
import integrationsRouter  from './integrations.routes.js';
import sourcingRouter      from './sourcing.routes.js';
import capitalRouter       from './capital.routes.js';
import executionRouter     from './execution.routes.js';
import playbookRouter      from './playbook.routes.js';
import dealFeedRouter      from './dealFeed.routes.js';
import relationshipsRouter from './relationships.routes.js';
import conversationsRouter from './conversations.routes.js';
import notificationsRouter from './notifications.routes.js';
import filesRouter         from './files.routes.js';
import adminRouter         from './admin.routes.js';
import negotiationRouter   from './negotiation.routes.js';

/**
 * @param {import('express').Application} app
 */
export default function mountRoutes(app) {
  app.use(healthRouter);
  app.use(chatRouter);
  app.use(dashboardRouter);
  app.use(companiesRouter);
  app.use(contactsRouter);
  app.use(interactionsRouter);
  app.use(dealsRouter);
  app.use(underwritingRouter);
  app.use(boardRouter);
  app.use(networkRouter);
  app.use(investorsRouter);
  app.use(checklistRouter);
  app.use(tasksRouter);
  app.use(meetingsRouter);
  app.use(inboxRouter);
  app.use(documentsRouter);
  app.use(agentsRouter);
  app.use(approvalsRouter);
  app.use(timingRouter);
  app.use(integrationsRouter);
  app.use(sourcingRouter);
  app.use(capitalRouter);
  app.use(executionRouter);
  app.use(playbookRouter);
  app.use(dealFeedRouter);
  app.use(relationshipsRouter);
  app.use(conversationsRouter);
  app.use(notificationsRouter);
  app.use(filesRouter);
  app.use(adminRouter);
  app.use(negotiationRouter);
}
