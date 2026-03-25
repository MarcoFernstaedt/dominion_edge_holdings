import { z }              from 'zod';
import store               from '../store.js';
import env                 from '../config/env.js';
import { validate }        from '../middleware/validate.js';
import { errorResponse }   from '../middleware/errorResponse.js';
import { nowIso, getSafeModel } from '../lib/helpers.js';
import { createAnthropicMessage } from '../lib/aiClient.js';

// ─── List / complete ──────────────────────────────────────────────────────────

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

// ─── AI grading ───────────────────────────────────────────────────────────────

const GradeSchema = z.object({
  itemTitle:      z.string().min(1).max(300),
  completionType: z.enum(['requires-document', 'requires-financial-model']),
  submission:     z.string().min(10).max(12000),
});

export const gradeSubmissionValidate = validate(GradeSchema);

export async function gradeSubmission(req, res) {
  if (!env.ANTHROPIC_API_KEY) {
    return errorResponse(res, 503, 'AI_UNAVAILABLE', 'AI grading requires ANTHROPIC_API_KEY');
  }

  const { itemTitle, completionType, submission } = req.validated;
  const isFinancial = completionType === 'requires-financial-model';

  const system = `You are Dan Peña — billionaire mentor, author of "Your First Hundred Million," creator of the QLA acquisition methodology. You are grading work from a searcher who claims to be executing a QLA-style acquisition. You are brutally honest. You do not tolerate vagueness, hedging, or half-measures. You respond ONLY with valid JSON — no markdown fences, no commentary outside the JSON object.`;

  const user = `Grade this ${isFinancial ? 'financial model / calculation' : 'written document'} for the QLA checklist item: "${itemTitle}"

SUBMISSION:
---
${submission.trim()}
---

Return ONLY this JSON object (all fields required, no extra fields):
{
  "score": <integer 0–100>,
  "level": "<elite|solid|needs_work|reject>",
  "passed": <boolean — true if score >= 70>,
  "headline": "<one direct Peña-style verdict, max 12 words>",
  "feedback": "<3–5 sentences of specific critique — name what is strong, what is weak, what is missing>",
  "improvements": ["<precise actionable fix 1>", "<precise actionable fix 2>", "<precise actionable fix 3 if warranted>"]
}

Scoring guide:
• 85–100 (elite)     — Board-ready. Shows mastery of QLA principles. Execute.
• 70–84 (solid)      — Acceptable. Specific gaps must be addressed before presenting externally.
• 50–69 (needs_work) — Too vague, too safe, or incomplete. Redo the fundamentals.
• 0–49  (reject)     — Amateur hour. This would embarrass you in front of any real board member or lender.

Be Peña-level demanding. Do not pass mediocre work.`;

  try {
    const message = await createAnthropicMessage({
      model:      getSafeModel(store.settings),
      max_tokens: 700,
      system,
      messages:   [{ role: 'user', content: user }],
    });

    const raw       = (message.content[0]?.text ?? '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI did not return valid JSON');

    const grade = JSON.parse(jsonMatch[0]);

    // Coerce / validate required fields
    const score       = Math.max(0, Math.min(100, Number(grade.score) || 0));
    const levelMap    = { elite: 'elite', solid: 'solid', needs_work: 'needs_work', reject: 'reject' };
    const level       = levelMap[grade.level] ?? (score >= 85 ? 'elite' : score >= 70 ? 'solid' : score >= 50 ? 'needs_work' : 'reject');
    const passed      = score >= 70;

    res.json({
      grade: {
        score,
        level,
        passed,
        headline:     String(grade.headline     ?? 'No verdict returned.'),
        feedback:     String(grade.feedback     ?? 'No feedback returned.'),
        improvements: Array.isArray(grade.improvements) ? grade.improvements.map(String).slice(0, 4) : [],
      },
    });
  } catch (err) {
    errorResponse(res, 500, 'GRADE_FAILED', `Grading failed: ${err.message}`);
  }
}
