/**
 * ConversationPreparationAgent
 *
 * Generates or assists with high-quality prep packets for meetings.
 * Delegates to MeetingPreparationService — returns the prep packet as agent output.
 *
 * Model: Fast model for simple prep; deterministic fallback if AI disabled.
 */

import MeetingPreparationService from '../services/MeetingPreparationService.js';

export async function ConversationPreparationAgent({
  meetingId,
  store,
  costFlags = {},
}) {
  if (!meetingId || !store) {
    return {
      agentName:       'ConversationPreparationAgent',
      analysisSummary: 'No meeting or store provided.',
      actionsProposed: [],
      confidenceScore: 0,
      packet:          null,
    };
  }

  const aiEnabled = costFlags?.enableMeetingPrepAI !== false && costFlags?.aiDraftingEnabled !== false;

  let packet;
  let fallbackUsed = false;

  try {
    packet = await MeetingPreparationService.buildPrepPacket(meetingId, aiEnabled);
  } catch {
    fallbackUsed = true;
    try {
      packet = await MeetingPreparationService.buildPrepPacket(meetingId, false);
    } catch (err2) {
      return {
        agentName:       'ConversationPreparationAgent',
        analysisSummary: `Prep generation failed: ${err2.message}`,
        actionsProposed: ['review_prep_manually'],
        confidenceScore: 0,
        packet:          null,
      };
    }
  }

  if (!packet) {
    return {
      agentName:       'ConversationPreparationAgent',
      analysisSummary: 'Meeting not found.',
      actionsProposed: [],
      confidenceScore: 0,
      packet:          null,
    };
  }

  const riskCount    = (packet.riskFlags || []).length;
  const hasObjectives = (packet.meetingObjectives || []).length > 0;
  const confidenceScore = Math.max(0.3, (hasObjectives ? 0.6 : 0.3) - (riskCount * 0.05));

  return {
    agentName:       'ConversationPreparationAgent',
    timestamp:       new Date().toISOString(),
    analysisSummary: `Prep packet generated for meeting "${packet.meetingType}" in ${packet.generationMode} mode.${fallbackUsed ? ' AI unavailable — deterministic fallback used.' : ''}`,
    agenda:               packet.agenda,
    keyQuestions:         packet.keyQuestions,
    motivationHypotheses: packet.motivationHypotheses,
    riskFlags:            packet.riskFlags,
    meetingObjectives:    packet.meetingObjectives,
    recommendedNextStepTargets: packet.recommendedNextStepTargets,
    missingInputs:        packet.missingInputs,
    actionsProposed:      ['review_prep_packet', 'confirm_objectives'],
    confidenceScore:      Math.round(confidenceScore * 100) / 100,
    generationMode:       packet.generationMode,
    fallbackUsed,
    packet,
  };
}

export default ConversationPreparationAgent;
