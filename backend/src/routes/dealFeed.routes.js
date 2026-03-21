import express from 'express';
import { validate } from '../middleware/validate.js';
import {
  DealFeedListingSchema, DealFeedListingPatchSchema,
  SaveListingSchema, ImportListingSchema, CsvIngestSchema,
} from '../../schemas/index.js';
import * as controller from '../controllers/dealFeed.controller.js';

const router = express.Router();

router.get('/api/deal-feed',             controller.list);
router.get('/api/deal-feed/summary',     controller.summary);
router.get('/api/deal-feed/saved',       controller.saved);
router.get('/api/deal-feed/:id',         controller.getOne);
router.post('/api/deal-feed',            validate(DealFeedListingSchema),      controller.create);
router.patch('/api/deal-feed/:id',       validate(DealFeedListingPatchSchema), controller.update);
router.delete('/api/deal-feed/:id',      controller.archive);
router.post('/api/deal-feed/save',       validate(SaveListingSchema),          controller.saveListing);
router.delete('/api/deal-feed/save',     controller.unsaveListing);
router.post('/api/deal-feed/import',     validate(ImportListingSchema),        controller.importListing);
router.post('/api/deal-feed/ingest/csv', validate(CsvIngestSchema),            controller.ingestCsv);
router.post('/api/deal-feed/:id/score',  controller.score);

export default router;
