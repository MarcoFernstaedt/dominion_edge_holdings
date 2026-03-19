/**
 * MeaningfulActivityClassifier — determines whether an activity type resets
 * relationship/deal/cadence decay timers.
 *
 * Rules:
 *  - Only workflow-advancing actions count as meaningful touches.
 *  - Passive UI events, view-only actions, and AI artifact generation
 *    without follow-through do NOT reset decay.
 *  - Callers must use this to determine last_meaningful_touch_at.
 */

// ─── Meaningful activity types ────────────────────────────────────────────────

export const MEANINGFUL_ACTIVITY_TYPES = new Set([
  // Outbound communication
  'outbound_message_sent',
  'email_sent',
  'call_logged',
  'call_completed',
  'sms_sent',
  'letter_sent',

  // Inbound signals
  'reply_received',
  'email_reply_received',
  'call_received',
  'document_received',
  'response_received',

  // Meetings
  'meeting_scheduled',
  'meeting_completed',
  'meeting_summary_logged',

  // Document / proof flow
  'document_uploaded',
  'document_signed',
  'proof_submitted',
  'financials_received',
  'loi_sent',
  'loi_received',
  'psa_sent',
  'psa_received',

  // Issue / diligence actions
  'issue_status_changed',
  'issue_assigned',
  'issue_resolved',
  'issue_escalated',
  'diligence_item_updated',

  // Decisions and approvals
  'decision_logged',
  'approval_reviewed',
  'approval_applied',
  'stage_changed',

  // Relationship events
  'intro_made',
  'intro_requested',
  'commitment_received',
  'commitment_given',
  'verbal_interest_logged',
  'follow_up_sent',
  'follow_up_completed',

  // Execution
  'task_completed',
  'task_proof_submitted',
  'board_meeting_held',
  'investor_update_sent',
]);

// ─── Non-meaningful (passive) activity types — for documentation only ─────────

export const PASSIVE_ACTIVITY_TYPES = new Set([
  'page_viewed',
  'record_opened',
  'record_viewed',
  'search_performed',
  'note_added',           // notes without workflow advancement
  'tag_added',
  'field_edited',         // minor cosmetic edit
  'ai_artifact_generated',// generation without downstream approval/send
  'comment_added',        // unless linked to a decision
  'export_viewed',
  'report_viewed',
]);

// ─── Classifier ───────────────────────────────────────────────────────────────

/**
 * Returns true if the activity type counts as a meaningful touch.
 */
export function isMeaningful(activityType) {
  if (!activityType) return false;
  return MEANINGFUL_ACTIVITY_TYPES.has(activityType);
}

/**
 * Given an array of activity objects, return the most recent meaningful one.
 * Activity objects must have { type, occurred_at } or { activityType, at }.
 */
export function lastMeaningfulActivity(activities = []) {
  if (!Array.isArray(activities) || activities.length === 0) return null;

  return activities
    .filter((a) => {
      const type = a.type ?? a.activityType ?? a.activity_type;
      return isMeaningful(type);
    })
    .sort((a, b) => {
      const ta = new Date(a.occurred_at ?? a.at ?? a.created_at ?? 0).getTime();
      const tb = new Date(b.occurred_at ?? b.at ?? b.created_at ?? 0).getTime();
      return tb - ta;
    })[0] ?? null;
}

/**
 * Returns the ISO timestamp of the last meaningful activity, or null.
 */
export function lastMeaningfulTouchAt(activities = []) {
  const a = lastMeaningfulActivity(activities);
  if (!a) return null;
  return a.occurred_at ?? a.at ?? a.created_at ?? null;
}

/**
 * Returns days since the last meaningful activity (fractional).
 * Returns null if no meaningful activity found.
 */
export function daysSinceLastMeaningful(activities = [], now = new Date()) {
  const ts = lastMeaningfulTouchAt(activities);
  if (!ts) return null;
  const ms = now.getTime() - new Date(ts).getTime();
  return ms / 86_400_000;
}

/**
 * Classify whether a given days-since-last-meaningful value represents
 * a meaningful-touch breach relative to a threshold.
 * Returns true if the record has exceeded the threshold.
 */
export function hasBreahedTouchThreshold(daysSince, thresholdHours) {
  if (daysSince === null || daysSince === undefined) return true; // no data = treat as stale
  return daysSince * 24 > thresholdHours;
}

export default {
  MEANINGFUL_ACTIVITY_TYPES,
  PASSIVE_ACTIVITY_TYPES,
  isMeaningful,
  lastMeaningfulActivity,
  lastMeaningfulTouchAt,
  daysSinceLastMeaningful,
  hasBreahedTouchThreshold,
};
