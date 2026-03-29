import express from 'express';
import { validate, asyncRoute } from '../middleware/validate.js';
import { ContactSchema } from '../../schemas/index.js';
import * as controller from '../controllers/contacts.controller.js';

const router = express.Router();

router.get('/api/contacts',              asyncRoute(controller.list));
router.post('/api/contacts',             validate(ContactSchema), asyncRoute(controller.create));
router.get('/api/contacts/discover',     asyncRoute(controller.discoverByCompany));
router.get('/api/contacts/:id',          asyncRoute(controller.getOne));
router.patch('/api/contacts/:id',        validate(ContactSchema.partial()), asyncRoute(controller.update));

export default router;
