import express    from 'express';
import Anthropic   from '@anthropic-ai/sdk';
import { z }       from 'zod';
import store       from '../store.js';
import MeetingPreparationService from '../../services/MeetingPreparationService.js';
import DealProbabilityService    from '../../services/DealProbabilityService.js';
import AuditLogService           from '../../services/AuditLogService.js';
import AgentOrchestrator         from '../../services/AgentOrchestrator.js';
import { validate }        from '../middleware/validate.js';
import { errorResponse }   from '../middleware/errorResponse.js';
import { uid, nowIso, findById, getSafeModel } from '../lib/helpers.js';
import { MeetingSchema }   from '../../schemas/index.js';
import { DEH_SYSTEM_PROMPT } from '../config/constants.js';

const router    = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.get('/api/meetings', (req, res) => {
  try {
    const { status, upcoming } = req.query;
    let results = [...store.meetings];
    if (status) results = results.filter((m) => m.status === status);
    if (upcoming === 'true') {
      const now = new Date();
      results = results.filter((m) => new Date(m.startsAt) > now && !['completed', 'cancelled'].includes(m.status));
    }
    results.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
    res.json(results);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve meetings'); }
});

router.post('/api/meetings', validate(MeetingSchema), (req, res) => {
  try {
    const meeting = { id: uid(), createdAt: nowIso(), updatedAt: nowIso(), source: 'manual', status: 'draft', linkedContactIds: [], proposedSlots: [], followUpTaskCreated: false, prepTaskCreated: false, ...req.validated };
    store.meetings.push(meeting);
    res.status(201).json(meeting);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to create meeting'); }
});

router.get('/api/meetings/upcoming', (req, res) => {
  try {
    const now = new Date();
    res.json(store.meetings.filter((m) => new Date(m.startsAt) > now && !['completed', 'cancelled'].includes(m.status)).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()));
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve upcoming meetings'); }
});

router.get('/api/meetings/:id', (req, res) => {
  try {
    const meeting = findById(store.meetings, req.params.id);
    if (!meeting) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    res.json(meeting);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve meeting'); }
});

router.patch('/api/meetings/:id', validate(MeetingSchema.partial()), (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], ...req.validated, updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update meeting'); }
});

router.post('/api/meetings/:id/confirm', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], status: 'confirmed', updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to confirm meeting'); }
});

router.post('/api/meetings/:id/schedule', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], status: 'scheduled', updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to schedule meeting'); }
});

router.post('/api/meetings/:id/complete', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], status: 'completed', completedAt: nowIso(), updatedAt: nowIso(), summary: req.body?.summary || undefined };
    res.json(store.meetings[idx]);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to complete meeting'); }
});

router.post('/api/meetings/:id/cancel', (req, res) => {
  try {
    const idx = store.meetings.findIndex((m) => m.id === req.params.id);
    if (idx === -1) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    store.meetings[idx] = { ...store.meetings[idx], status: 'cancelled', cancelledAt: nowIso(), updatedAt: nowIso() };
    res.json(store.meetings[idx]);
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to cancel meeting'); }
});

router.post('/api/meetings/:id/generate-agenda', async (req, res) => {
  try {
    const meeting = findById(store.meetings, req.params.id);
    if (!meeting) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    const linkedCompany = meeting.linkedCompanyId ? findById(store.companies, meeting.linkedCompanyId) : null;
    const message = await anthropic.messages.create({
      model: getSafeModel(store.settings), max_tokens: 512, system: DEH_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Generate a concise meeting agenda for a ${(meeting.meetingType||'').replace(/_/g,' ')} call.\nTitle: ${meeting.title}\nCompany: ${linkedCompany?.name || 'Not specified'}\nDuration: ${meeting.durationMinutes} minutes\nNotes: ${meeting.meetingNotes || 'None'}\n\nReturn a numbered list of agenda items only. Be specific and actionable.` }],
    });
    res.json({ agenda: message.content[0]?.text ?? '' });
  } catch (err) { errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI service temporarily unavailable'); }
});

// ─── Meeting prep ─────────────────────────────────────────────────────────────

router.get('/api/meetings/:id/prep', (req, res) => {
  try { res.json({ packet: MeetingPreparationService.getPrepPacket(req.params.id) || null }); }
  catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to get prep packet'); }
});

router.post('/api/meetings/:id/prep', async (req, res) => {
  try {
    const meeting = findById(store.meetings, req.params.id);
    if (!meeting) return errorResponse(res, 404, 'NOT_FOUND', 'Meeting not found');
    const packet = await MeetingPreparationService.buildPrepPacket(req.params.id, store.settings?.enableMeetingPrepAI !== false);
    if (!packet) return errorResponse(res, 500, 'INTERNAL_ERROR', 'Prep packet generation failed');
    res.json({ packet });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', `Prep generation failed: ${err.message}`); }
});

router.patch('/api/meetings/:id/prep', validate(z.object({
  agenda: z.array(z.string()).optional(), keyQuestions: z.array(z.string()).optional(),
  motivationHypotheses: z.array(z.string()).optional(), riskFlags: z.array(z.string()).optional(),
  meetingObjectives: z.array(z.string()).optional(), recommendedNextStepTargets: z.array(z.string()).optional(),
  status: z.enum(['draft', 'final', 'archived']).optional(),
}).strict()), (req, res) => {
  try {
    const packet = MeetingPreparationService.getPrepPacket(req.params.id);
    if (!packet) return errorResponse(res, 404, 'NOT_FOUND', 'No prep packet for this meeting');
    res.json({ packet: MeetingPreparationService.updatePrepPacket(packet.id, req.validated) });
  } catch (err) { errorResponse(res, 500, 'INTERNAL_ERROR', err.message); }
});

router.get('/api/meeting-prep/packets', (req, res) => {
  const limit   = Math.min(Number(req.query.limit) || 20, 100);
  const packets = (store.meetingPrepPackets || []).slice(0, limit);
  res.json({ packets, total: packets.length });
});

export default router;
