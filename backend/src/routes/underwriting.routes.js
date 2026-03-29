import express  from 'express';
import { validate } from '../middleware/validate.js';
import { UnderwritingCalcSchema } from '../../schemas/index.js';
import * as controller from '../controllers/underwriting.controller.js';

const router = express.Router();

router.post('/api/underwriting/calculate',  validate(UnderwritingCalcSchema), controller.calculate);
router.get('/api/underwriting/scenarios',   controller.listScenarios);
router.post('/api/underwriting/scenarios',  controller.createScenario);
router.delete('/api/underwriting/scenarios/:id', controller.deleteScenario);

export default router;
