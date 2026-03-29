import express from 'express';
import { validate }             from '../middleware/validate.js';
import { BoardCandidateSchema } from '../../schemas/index.js';
import * as controller          from '../controllers/board.controller.js';

const router = express.Router();

router.get('/api/board/seats',                                                         controller.listSeats);
router.get('/api/board/candidates',                                                    controller.listCandidates);
router.post('/api/board/candidates',           validate(BoardCandidateSchema),         controller.createCandidate);
router.patch('/api/board/candidates/:id',      validate(BoardCandidateSchema.partial()), controller.updateCandidate);
router.get('/api/board/cap-table',                                                     controller.listCapTable);
router.post('/api/board/cap-table',                                                    controller.createCapTableEntry);
router.delete('/api/board/cap-table/:id',                                              controller.deleteCapTableEntry);
router.get('/api/board/seats/health',                                                  controller.getSeatsHealth);
router.get('/api/board/seats/:seatType/candidates',                                    controller.listCandidatesBySeatType);
router.get('/api/board/candidates/:id/fit',                                            controller.getCandidateFit);
router.post('/api/board/candidates/:id/rank-commentary',                               controller.getCandidateRankCommentary);

export default router;
