import express    from 'express';
import { validate } from '../middleware/validate.js';
import { ChatSchema } from '../../schemas/index.js';
import * as controller from '../controllers/chat.controller.js';

const router = express.Router();

router.post('/api/chat', validate(ChatSchema), controller.chat);

export default router;
