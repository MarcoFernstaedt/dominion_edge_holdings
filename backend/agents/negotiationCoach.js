/**
 * NegotiationCoachAgent
 *
 * AI coach for negotiation preparation and recap intelligence (QLA Step 10).
 * Supports:
 *   - Scenario simulation (price pushback, financing resistance, competitive bids, etc.)
 *   - Call recap extraction from transcript/notes/summary
 *   - Follow-up draft generation
 *
 * All outputs are grounded in actual deal/company/contact context.
 * Model: HIGH tier (negotiation_simulation, negotiation_draft) / MID (call_recap_extraction)
 */

import NegotiationService, { NEGOTIATION_SCENARIOS, DRAFT_TYPES } from '../services/NegotiationService.js';

export async function NegotiationCoachAgent({
  mode,           // 'simulate' | 'recap' | 'draft'
  // Simulate params
  sessionId,
  dealId,
  companyId,
  contactId,
  scenario,
  role = 'buyer',
  userMessage,
  sessionHistory = [],
  // Recap params
  meetingId,
  transcript,
  notes,
  summary,
  autoCreateTasks = true,
  // Draft params
  recapId,
  draftType,
  additionalContext,
  // Shared
  store,
  costFlags = {},
}) {
  if (!store) {
    return _errorOutput('NegotiationCoachAgent', 'No store provided.');
  }

  NegotiationService.init(store);

  const aiEnabled =
    costFlags?.aiDraftingEnabled !== false &&
    costFlags?.enableNegotiationAI !== false;

  // ── Simulate mode ────────────────────────────────────────────────────────

  if (mode === 'simulate') {
    if (!scenario || !NEGOTIATION_SCENARIOS[scenario]) {
      return _errorOutput('NegotiationCoachAgent', `Unknown or missing scenario: ${scenario}. Valid scenarios: ${Object.keys(NEGOTIATION_SCENARIOS).join(', ')}`);
    }
    if (!userMessage) {
      return _errorOutput('NegotiationCoachAgent', 'userMessage required for simulate mode.');
    }

    const context = NegotiationService.buildSimulationContext({ dealId, companyId, contactId, scenario, role });

    // Create session if new
    let session = sessionId ? NegotiationService.getSession(sessionId) : null;
    if (!session) {
      session = NegotiationService.createSession({ dealId, companyId, contactId, scenario, role, context });
    }

    let coachOutput;
    if (aiEnabled) {
      coachOutput = await NegotiationService.runSimulationTurn({
        sessionId: session.id,
        context,
        userMessage,
        sessionHistory: session.history,
      });
    } else {
      coachOutput = NegotiationService._simulationFallback(context, userMessage);
    }

    NegotiationService.appendToSession(session.id, userMessage, coachOutput);

    return {
      agentName:       'NegotiationCoachAgent',
      mode:            'simulate',
      sessionId:       session.id,
      scenario,
      analysisSummary: coachOutput.coachingSummary ?? 'Coaching feedback generated.',
      actionsProposed: ['review_coaching_output', 'continue_simulation'],
      confidenceScore: aiEnabled ? 0.80 : 0.50,
      ...coachOutput,
    };
  }

  // ── Recap mode ───────────────────────────────────────────────────────────

  if (mode === 'recap') {
    const recap = await NegotiationService.processRecap({
      meetingId,
      transcript,
      notes,
      summary,
      dealId,
      companyId,
      autoCreateTasks: aiEnabled && autoCreateTasks,
    });

    return {
      agentName:       'NegotiationCoachAgent',
      mode:            'recap',
      recapId:         recap.id,
      analysisSummary: `Recap processed. Outcome: ${recap.meetingOutcome}. Sentiment: ${recap.sentiment}. ${recap.tasksCreated.length} task(s) auto-created.`,
      actionsProposed: [
        'review_recap',
        ...(recap.tasksCreated.length > 0 ? ['review_auto_tasks'] : []),
        'generate_follow_up_draft',
      ],
      confidenceScore: aiEnabled ? 0.80 : 0.40,
      recap,
    };
  }

  // ── Draft mode ───────────────────────────────────────────────────────────

  if (mode === 'draft') {
    if (!draftType || !DRAFT_TYPES[draftType]) {
      return _errorOutput('NegotiationCoachAgent', `Unknown draft type: ${draftType}. Valid: ${Object.keys(DRAFT_TYPES).join(', ')}`);
    }

    const draft = await NegotiationService.generateDraft({
      recapId,
      meetingId,
      dealId,
      companyId,
      draftType,
      additionalContext,
    });

    return {
      agentName:       'NegotiationCoachAgent',
      mode:            'draft',
      analysisSummary: `${draft.label} draft generated.`,
      actionsProposed: ['review_draft', 'edit_and_send'],
      confidenceScore: aiEnabled ? 0.85 : 0.50,
      draft,
    };
  }

  return _errorOutput('NegotiationCoachAgent', `Unknown mode: ${mode}. Use 'simulate', 'recap', or 'draft'.`);
}

function _errorOutput(agentName, message) {
  return {
    agentName,
    analysisSummary: message,
    actionsProposed: [],
    confidenceScore: 0,
    error: message,
  };
}

export default NegotiationCoachAgent;
