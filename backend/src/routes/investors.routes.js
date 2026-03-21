import express           from 'express';
import { validate }      from '../middleware/validate.js';
import { InvestorSchema, CapitalStackSchema, InvestorMemoSchema } from '../../schemas/index.js';
import * as controller   from '../controllers/investors.controller.js';

const router = express.Router();

// ─── Investor scoring ─────────────────────────────────────────────────────────

router.get('/api/investors/funnel',                                                 controller.getInvestorFunnel);
router.get('/api/investors/high-fit',                                               controller.getHighFitInvestors);
router.get('/api/investors/:id/fit',                                                controller.getInvestorFit);
router.get('/api/investors/:id/intro-paths',                                        controller.getInvestorIntroPaths);
router.post('/api/investors/:id/outreach-draft',                                    controller.createOutreachDraft);
router.post('/api/investors/:id/memo-section-draft',                                controller.createMemoSectionDraft);

// ─── Capital raising CRM ──────────────────────────────────────────────────────

router.get('/api/capital-raising/investors',                                        controller.listCapitalRaisingInvestors);
router.post('/api/capital-raising/investors',        validate(InvestorSchema),      controller.createCapitalRaisingInvestor);
router.get('/api/capital-raising/investors/:id',                                    controller.getCapitalRaisingInvestor);
router.patch('/api/capital-raising/investors/:id',                                  controller.updateCapitalRaisingInvestor);
router.delete('/api/capital-raising/investors/:id',                                 controller.deleteCapitalRaisingInvestor);
router.post('/api/capital-raising/investors/:id/mark-interested',                   controller.markInvestorInterested);

// ─── Capital stacks ───────────────────────────────────────────────────────────

router.get('/api/capital-raising/capital-stacks',                                   controller.listCapitalStacks);
router.post('/api/capital-raising/capital-stacks',   validate(CapitalStackSchema),  controller.createCapitalStack);
router.get('/api/capital-raising/capital-stacks/:id',                               controller.getCapitalStack);
router.patch('/api/capital-raising/capital-stacks/:id',                             controller.updateCapitalStack);
router.delete('/api/capital-raising/capital-stacks/:id',                            controller.deleteCapitalStack);

// ─── Investor memos ───────────────────────────────────────────────────────────

router.get('/api/capital-raising/memos',                                            controller.listMemos);
router.post('/api/capital-raising/memos',            validate(InvestorMemoSchema),  controller.createMemo);
router.get('/api/capital-raising/memos/:id',                                        controller.getMemo);
router.patch('/api/capital-raising/memos/:id',                                      controller.updateMemo);
router.delete('/api/capital-raising/memos/:id',                                     controller.deleteMemo);

export default router;
