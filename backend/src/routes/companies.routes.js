import express from 'express';
import { validate, asyncRoute } from '../middleware/validate.js';
import { CompanySchema } from '../../schemas/index.js';
import * as controller from '../controllers/companies.controller.js';

const router = express.Router();

router.get('/api/companies',       asyncRoute(controller.list));
router.post('/api/companies',      validate(CompanySchema), asyncRoute(controller.create));
router.get('/api/companies/:id',   asyncRoute(controller.getOne));
router.patch('/api/companies/:id', validate(CompanySchema.partial()), asyncRoute(controller.update));
router.delete('/api/companies/:id', asyncRoute(controller.remove));

export default router;
