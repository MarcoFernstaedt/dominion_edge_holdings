/**
 * MeetingPreparationService
 *
 * Builds prep packets for meetings — deterministic by default, AI-assisted if enabled.
 * Never throws; always returns a usable prep packet.
 */

import crypto from 'crypto';
import ModelGateway from './ModelGateway.js';

// ─── Deterministic templates by meeting type ──────────────────────────────────

const PREP_TEMPLATES = {
  seller_discovery: {
    agenda: [
      'Introductions and context',
      'Business overview — history and model',
      'Owner role and daily involvement',
      'Customer base and revenue stability',
      'Team structure and key dependencies',
      'Financial shape at a high level',
      'Future plans and timing',
      'Next steps',
    ],
    keyQuestions: [
      'How long have you owned the business?',
      'What does your day-to-day role look like?',
      'How dependent is the business on you personally?',
      'How stable is recurring or repeat revenue?',
      'What would the ideal transition look like for you?',
      'What concerns would you have about bringing in a new owner?',
      'Have you thought about timing — is there a window that works better?',
    ],
    meetingObjectives: [
      'Build rapport and establish trust',
      'Understand seller motivation and timeline',
      'Surface any owner-dependence risk',
      'Assess openness to a structured exit',
      'Earn the next conversation',
    ],
    riskFlags: [
      'No financial details available before call',
      'No clear seller motivation logged',
      'Limited prior interaction history',
      'Unknown owner timeline',
    ],
  },

  seller_followup: {
    agenda: [
      'Recap of prior conversation',
      'Questions or follow-up items from seller',
      'Progress update on our side',
      'Deeper dive on any open topics',
      'Next steps and timeline',
    ],
    keyQuestions: [
      'Any questions since we last spoke?',
      'Has anything changed on your end?',
      'Can you share any financials to help us sharpen the picture?',
      'What timeline are you working toward?',
    ],
    meetingObjectives: [
      'Continue building the relationship',
      'Surface timeline and urgency',
      'Move toward financial information sharing',
      'Set a clear next milestone',
    ],
    riskFlags: [
      'Seller has not shared any financials yet',
      'Timing unclear',
    ],
  },

  board_intro: {
    agenda: [
      'Introductions',
      'Dominion Edge platform overview',
      'Board seat scope and expectations',
      'Candidate background and relevant experience',
      'Fit discussion',
      'Equity and comp overview',
      'Next steps',
    ],
    keyQuestions: [
      'What types of acquisition situations have you seen?',
      'What would make this opportunity worth your time?',
      'Where could you contribute most immediately post-close?',
      'What would concern you most about this type of deal?',
      'What does your ideal board engagement look like?',
    ],
    meetingObjectives: [
      'Test fit with seat requirements',
      'Establish expectations clearly',
      'Gauge interest and commitment level',
      'Earn a second meeting or offer',
    ],
    riskFlags: [
      'Candidate background not fully researched',
      'Equity expectations unknown',
    ],
  },

  banker_intro: {
    agenda: [
      'Introductions',
      'Acquisition criteria overview',
      'Target deal size and structure',
      'Current pipeline snapshot',
      'Financing approach and structure preferences',
      'Lender fit discussion',
      'Next steps',
    ],
    keyQuestions: [
      'What structure ranges do you typically prefer?',
      'What would disqualify a deal early for you?',
      'What documentation do you want to see first?',
      'What deal sizes work best for your book?',
      'How do you handle seller note situations?',
    ],
    meetingObjectives: [
      'Confirm lender fit for our target profile',
      'Clarify financing process and timeline',
      'Gain clarity on documentation requirements',
    ],
    riskFlags: [
      'Lender deal size requirements unknown',
      'SBA vs. conventional preference unclear',
    ],
  },

  diligence_review: {
    agenda: [
      'Outstanding document items review',
      'Financial document status',
      'Legal review status',
      'Red flags and open questions',
      'Timeline to closing',
      'Next concrete steps',
    ],
    keyQuestions: [
      'What outstanding documents are still needed?',
      'Are there any legal flags from attorney review?',
      'Is the seller responsive to diligence requests?',
      'What is the realistic path to closing?',
    ],
    meetingObjectives: [
      'Clear document backlog',
      'Surface any deal-breaking issues',
      'Confirm closing timeline',
    ],
    riskFlags: [
      'Incomplete financial documents',
      'Unresolved legal questions',
      'Seller response time slowing',
    ],
  },

  internal_planning: {
    agenda: [
      'Current status review',
      'This week priorities',
      'Blockers and issues',
      'Next actions and owners',
    ],
    keyQuestions: [
      'What is the most important thing to move forward this week?',
      'What is blocked and what unblocks it?',
    ],
    meetingObjectives: [
      'Align on priorities',
      'Clear blockers',
      'Assign next actions',
    ],
    riskFlags: [],
  },
};

const DEFAULT_TEMPLATE = {
  agenda: ['Introductions', 'Discussion', 'Next steps'],
  keyQuestions: ['What is the goal of this meeting?', 'What would make this meeting a success?'],
  meetingObjectives: ['Align on purpose', 'Define next steps'],
  riskFlags: ['Meeting type not specifically templated'],
};

// ─── Service ──────────────────────────────────────────────────────────────────

class MeetingPreparationServiceClass {
  init(store) {
    this._store = store;
    if (!store.meetingPrepPackets) store.meetingPrepPackets = [];
  }

  /**
   * Build a prep packet for a meeting.
   * Returns the stored packet.
   */
  async buildPrepPacket(meetingId, aiEnabled = false) {
    const store = this._store;

    const meeting = (store.meetings || []).find((m) => m.id === meetingId);
    if (!meeting) return null;

    const company  = meeting.linkedCompanyId
      ? (store.companies || []).find((c) => c.id === meeting.linkedCompanyId) : null;
    const deal     = meeting.linkedDealId
      ? (store.deals || []).find((d) => d.id === meeting.linkedDealId) : null;
    const contacts = (meeting.linkedContactIds || [])
      .map((cid) => (store.contacts || []).find((c) => c.id === cid)).filter(Boolean);

    const recentInteractions = (store.interactions || [])
      .filter((i) => i.companyId === meeting.linkedCompanyId || i.dealId === meeting.linkedDealId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const scenarios = deal
      ? (store.underwritingScenarios || []).filter((s) => s.dealId === deal.id)
      : [];

    const contextSnapshot = {
      meeting: { id: meeting.id, type: meeting.meetingType, title: meeting.title, startsAt: meeting.startsAt },
      company: company ? { name: company.name, industry: company.industry, city: company.city, state: company.state,
        yearsInBusiness: company.yearsInBusiness, retirementSignal: company.retirementSignal,
        estimatedRevenueLow: company.estimatedRevenueLow, estimatedSDELow: company.estimatedSDELow,
        status: company.status, notes: company.notes } : null,
      contacts: contacts.map((c) => ({ name: c.fullName, title: c.title, contactType: c.contactType,
        relationshipWarmth: c.relationshipWarmth, sellerMotivation: c.sellerMotivation,
        sellerTimeline: c.sellerTimeline, lastConversationSummary: c.lastConversationSummary })),
      deal: deal ? { stage: deal.stage, status: deal.status, estimatedRevenue: deal.estimatedRevenue,
        estimatedSDE: deal.estimatedSDE, askingPrice: deal.askingPrice, dealThesis: deal.dealThesis,
        riskLevel: deal.riskLevel } : null,
      recentInteractions: recentInteractions.map((i) => ({
        type: i.type, direction: i.direction, subject: i.subject, outcome: i.outcome,
        sellerMotivation: i.sellerMotivation, sellerTimeline: i.sellerTimeline,
        sellerConcerns: i.sellerConcerns, createdAt: i.createdAt })),
      underwritingHighlights: scenarios.length > 0 ? {
        count: scenarios.length,
        bestDSCR: Math.max(...scenarios.map((s) => s.dscr || 0)),
      } : null,
    };

    let packet;
    const useAI = aiEnabled && (store.settings?.enableMeetingPrepAI !== false);

    if (useAI) {
      packet = await this._buildAIAssistedPacket(meeting, contextSnapshot);
    } else {
      packet = this._buildDeterministicPacket(meeting, contextSnapshot);
    }

    const now = new Date().toISOString();
    const packetRecord = {
      id:                   crypto.randomUUID(),
      meetingId:            meeting.id,
      meetingType:          meeting.meetingType,
      linkedEntityType:     company ? 'company' : (deal ? 'deal' : null),
      linkedEntityId:       company?.id || deal?.id || null,
      linkedDealId:         deal?.id || null,
      linkedCompanyId:      company?.id || null,
      linkedContactIds:     contacts.map((c) => c.id),
      contextSnapshot,
      agenda:               packet.agenda,
      keyQuestions:         packet.keyQuestions,
      motivationHypotheses: packet.motivationHypotheses || [],
      riskFlags:            packet.riskFlags,
      meetingObjectives:    packet.meetingObjectives,
      recommendedNextStepTargets: packet.recommendedNextStepTargets || [],
      generatedBy:          useAI ? 'calendar_scheduling_agent' : 'system_template',
      generationMode:       useAI ? 'ai_assisted' : 'deterministic',
      status:               'final',
      missingInputs:        packet.missingInputs || [],
      createdAt:            now,
      updatedAt:            now,
    };

    // Remove any prior packet for this meeting
    store.meetingPrepPackets = (store.meetingPrepPackets || []).filter((p) => p.meetingId !== meetingId);
    store.meetingPrepPackets.unshift(packetRecord);
    store.meetingPrepPackets = store.meetingPrepPackets.slice(0, 200);

    // Attach prep packet id to meeting record
    const m = (store.meetings || []).find((x) => x.id === meetingId);
    if (m) { m.prepPacketId = packetRecord.id; m.updatedAt = now; }

    return packetRecord;
  }

  _buildDeterministicPacket(meeting, ctx) {
    const template = PREP_TEMPLATES[meeting.meetingType] || DEFAULT_TEMPLATE;

    const riskFlags = [...template.riskFlags];

    // Dynamic risk flags from context
    if (!ctx.company && !ctx.deal) riskFlags.push('No company or deal linked to this meeting');
    if (ctx.recentInteractions.length === 0) riskFlags.push('No prior interactions recorded');
    if (ctx.contacts.length === 0) riskFlags.push('No contacts linked to meeting');

    const motivationHypotheses = [];
    for (const c of ctx.contacts) {
      if (c.sellerMotivation && c.sellerMotivation !== 'unknown') {
        motivationHypotheses.push(`${c.name}: motivation likely "${c.sellerMotivation}" (from prior notes — verify on call)`);
      }
    }
    if (ctx.company?.retirementSignal) {
      motivationHypotheses.push('Retirement signal detected — owner may be actively considering exit');
    }

    const recommendedNextStepTargets = [
      'Confirm next meeting date before call ends',
      'Get permission to share financials or NDA',
      'Clarify any open questions from this session',
    ];

    // Enrich agenda with known context
    const agenda = [...template.agenda];
    if (ctx.deal && ctx.deal.stage === 'loi_discussion') {
      agenda.splice(-1, 0, 'LOI structure discussion');
    }

    const missingInputs = [];
    if (!ctx.company) missingInputs.push('company_record');
    if (!ctx.deal && ['diligence_review'].includes(meeting.meetingType)) missingInputs.push('deal_record');
    if (ctx.contacts.length === 0) missingInputs.push('contact_records');

    return {
      agenda,
      keyQuestions: template.keyQuestions,
      motivationHypotheses,
      riskFlags,
      meetingObjectives: template.meetingObjectives,
      recommendedNextStepTargets,
      missingInputs,
    };
  }

  async _buildAIAssistedPacket(meeting, ctx) {
    const template = PREP_TEMPLATES[meeting.meetingType] || DEFAULT_TEMPLATE;

    const prompt = `You are the Conversation Preparation Agent for Dominion Edge Holdings.

Generate a meeting prep packet for the following meeting.

Meeting type: ${meeting.meetingType}
Meeting title: ${meeting.title || 'Untitled'}
Starts: ${meeting.startsAt || 'TBD'}

Company context:
${ctx.company ? JSON.stringify(ctx.company, null, 2) : 'No company linked.'}

Contacts:
${ctx.contacts.length > 0 ? JSON.stringify(ctx.contacts, null, 2) : 'No contacts linked.'}

Deal status:
${ctx.deal ? JSON.stringify(ctx.deal, null, 2) : 'No deal linked.'}

Recent interactions (last 5):
${ctx.recentInteractions.length > 0 ? JSON.stringify(ctx.recentInteractions, null, 2) : 'No interactions recorded.'}

Underwriting:
${ctx.underwritingHighlights ? JSON.stringify(ctx.underwritingHighlights, null, 2) : 'No scenarios.'}

Return a JSON object with these fields:
- agenda: string[] — ordered agenda items
- keyQuestions: string[] — 5-8 specific questions to ask
- motivationHypotheses: string[] — hypotheses about seller/contact motivations (mark as hypotheses only, do not invent facts)
- riskFlags: string[] — preparation gaps or deal risks to be aware of
- meetingObjectives: string[] — 3-5 concrete objectives for this meeting
- recommendedNextStepTargets: string[] — outcomes to commit to before meeting ends
- missingInputs: string[] — context that would improve this packet if known
- confidenceScore: number 0-100

Rules:
- Do not invent company-specific facts
- Mark motivationHypotheses as hypotheses
- Only use information provided above
- Be concise and actionable

Return JSON only.`;

    try {
      const result = await ModelGateway.run({
        taskType: 'outreach_draft',
        agentName: 'ConversationPreparationAgent',
        entityIds: [meeting.id || `meeting_prep_${Date.now()}`],
        systemPrompt: 'You are the Conversation Preparation Agent for Dominion Edge Holdings. Generate a meeting prep packet based on the provided context.',
        userMessage: prompt,
        outputSchema: null,
      });

      const content = result?.content;
      if (content && typeof content === 'object' && content.agenda) {
        return content;
      }

      // Try parsing text response
      const text = typeof content === 'string' ? content : (typeof result === 'string' ? result : '');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...parsed, missingInputs: parsed.missingInputs || [] };
      }
    } catch {
      // AI failed — fall back to deterministic
    }

    return this._buildDeterministicPacket(meeting, ctx);
  }

  getPrepPacket(meetingId) {
    return (this._store?.meetingPrepPackets || []).find((p) => p.meetingId === meetingId) || null;
  }

  updatePrepPacket(packetId, updates) {
    const packet = (this._store?.meetingPrepPackets || []).find((p) => p.id === packetId);
    if (!packet) return null;
    Object.assign(packet, updates, { updatedAt: new Date().toISOString(), status: 'final' });
    return packet;
  }
}

export const MeetingPreparationService = new MeetingPreparationServiceClass();
export default MeetingPreparationService;
