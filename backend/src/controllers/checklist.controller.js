import store                  from '../store.js';
import { errorResponse }      from '../middleware/errorResponse.js';
import { nowIso }             from '../lib/helpers.js';

export function listChecklist(_req, res) {
  res.json(store.checklistPhases);
}

export function completeChecklistItem(req, res) {
  try {
    const { itemId }    = req.params;
    const isComplete    = req.body?.isComplete ?? true;
    if (typeof isComplete !== 'boolean') return errorResponse(res, 400, 'VALIDATION_ERROR', 'isComplete must be a boolean');
    let found = false;
    for (const phase of store.checklistPhases) {
      const item = (phase.items || []).find((i) => i.id === itemId);
      if (item) {
        item.isComplete  = isComplete;
        item.completedAt = isComplete ? nowIso() : undefined;
        found = true;
        break;
      }
    }
    if (!found) return errorResponse(res, 404, 'NOT_FOUND', 'Checklist item not found');
    res.json({ ok: true });
  } catch (err) {
    errorResponse(res, 500, 'INTERNAL_ERROR', 'Failed to update checklist item');
  }
}
