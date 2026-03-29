/**
 * NegotiationService
 *
 * Core service for negotiation prep, simulation, call recap, and draft generation.
 * All AI calls go through ModelGateway. Deterministic fallbacks are always available.
 *
 * Responsibilities:
 *   1. Build deal-aware simulation context from store
 *   2. Run negotiation simulation turns (AI coach, not a chatbot)
 *   3. Process call recaps from transcript/notes/summary
 *   4. Auto-create follow-up tasks from recap next-steps
 *   5. Generate follow-up drafts (email, memo, brief)
 */

import crypto from 'crypto';
import ModelGateway from './ModelGateway.js';

// ─── Scenario definitions ─────────────────────────────────────────────────────

export const NEGOTIATION_SCENARIOS = {
  price_pushback: {
    label: 'Price pushback',
    description: 'Seller/counterparty pushes back on valuation or offer price.',
    sellerRole: 'seller',
    systemHint: 'The counterparty thinks the price is too low and is pushing back hard.',
  },
  seller_financing_resistance: {
    label: 'Seller financing resistance',
    description: 'Seller resists providing any seller note or deferred consideration.',
    sellerRole: 'seller',
    systemHint: 'The seller does not want to carry any paper and wants all cash at close.',
  },
  competitive_bid_pressure: {
    label: 'Competitive bid pressure',
    description: 'Seller signals other buyers are in the picture or runs a light auction.',
    sellerRole: 'seller',
    systemHint: 'Seller says they have other interested parties and implies urgency.',
  },
  diligence_dispute: {
    label: 'Diligence dispute',
    description: 'Seller pushes back on diligence findings or add-back challenges.',
    sellerRole: 'seller',
    systemHint: 'Seller disputes a diligence finding that affects valuation.',
  },
  rollover_earnout_objection: {
    label: 'Rollover / earnout objection',
    description: 'Seller objects to rollover equity requirement or earnout structure.',
    sellerRole: 'seller',
    systemHint: 'Seller does not want an earnout or rollover and prefers clean cash exit.',
  },
  transition_objection: {
    label: 'Transition objection',
    description: 'Seller resists extended transition period or training commitment.',
    sellerRole: 'seller',
    systemHint: 'Seller wants a short or minimal transition period.',
  },
  investor_skepticism: {
    label: 'Investor skepticism',
    description: 'LP or equity investor questions deal quality, returns, or structure.',
    sellerRole: 'investor',
    systemHint: 'Investor is skeptical about deal quality or projected returns.',
  },
  board_pushback: {
    label: 'Board / advisor pushback',
    description: 'Prospective board member questions fit, equity, or commitment scope.',
    sellerRole: 'board_candidate',
    systemHint: 'Board candidate pushes back on equity offer or board expectations.',
  },
  lender_dscr_objection: {
    label: 'Lender / DSCR objection',
    description: 'Lender raises concerns about DSCR coverage or deal structure.',
    sellerRole: 'lender',
    systemHint: 'Lender questions whether DSCR is sufficient for the proposed structure.',
  },
};

// ─── Draft type definitions ───────────────────────────────────────────────────

export const DRAFT_TYPES = {
  follow_up_email:  { label: 'Follow-up email', tone: 'professional, warm, brief', audience: 'counterparty' },
  internal_update:  { label: 'Internal update', tone: 'direct, factual, concise', audience: 'internal team' },
  seller_memo:      { label: 'Seller memo', tone: 'clear, relationship-preserving', audience: 'seller/owner' },
  investor_memo:    { label: 'Investor memo', tone: 'analytical, investor-grade', audience: 'LP/equity investor' },
  next_call_brief:  { label: 'Next-call prep brief', tone: 'tactical, action-oriented', audience: 'self/team prep' },
};

// ─── System prompts ───────────────────────────────────────────────────────────

const COACH_SYSTEM = `You are a negotiation coach and deal advisor for Dominion Edge Holdings, a search fund acquiring lower-middle-market businesses.

Your role:
- Coach the searcher (user) through deal negotiations
- Provide objection-specific response angles grounded in the actual deal context
- Identify leverage points, risks, and walk-away thresholds
- Never invent financial figures or company facts not provided
- Be specific, not generic — reference actual deal details when available
- Flag when the user is making a mistake or giving away leverage

You are a coach and drafting assistant, not a generic chatbot.`;

const RECAP_SYSTEM = `You are the call recap intelligence engine for Dominion Edge Holdings.

Extract structured intelligence from meeting transcripts, notes, or summaries.
Be conservative — only extract what is clearly stated or strongly implied.
Never invent commitments, objections, or sentiment not evidenced in the text.`;

const DRAFT_SYSTEM = `You are a professional drafting assistant for Dominion Edge Holdings.

Generate concise, deal-grounded drafts. Use actual deal/company context provided.
Never invent facts. Keep output tight and professional. No filler or fluff.`;

// ─── Service ──────────────────────────────────────────────────────────────────

class NegotiationServiceClass {
  init(store) {
    this._store = store;
    if (!store.negotiationSessions) store.negotiationSessions = [];
    if (!store.callRecaps) store.callRecaps = [];
  }

  // ── Context building ───────────────────────────────────────────────────────

  buildSimulationContext({ dealId, companyId, contactId, scenario, role }) {
    const store = this._store;
    const deal    = dealId    ? (store.deals    || []).find(d => d.id === dealId)    : null;
    const company = companyId ? (store.companies|| []).find(c => c.id === companyId) : null;
    const contact = contactId ? (store.contacts || []).find(c => c.id === contactId) : null;

    const recentInteractions = (store.interactions || [])
      .filter(i => i.companyId === companyId || i.dealId === dealId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5);

    const underwritingScenarios = dealId
      ? (store.underwritingScenarios || []).filter(s => s.dealId === dealId)
      : [];

    const scenarioDef = NEGOTIATION_SCENARIOS[scenario] || null;

    return {
      scenario,
      scenarioDef,
      role,
      deal: deal ? {
        id: deal.id,
        stage: deal.stage,
        status: deal.status,
        estimatedRevenue: deal.estimatedRevenue,
        estimatedSDE: deal.estimatedSDE,
        askingPrice: deal.askingPrice,
        dealThesis: deal.dealThesis,
        riskLevel: deal.riskLevel,
        riskNotes: deal.riskNotes,
      } : null,
      company: company ? {
        id: company.id,
        name: company.name,
        industry: company.industry,
        city: company.city,
        state: company.state,
        yearsInBusiness: company.yearsInBusiness,
        retirementSignal: company.retirementSignal,
        estimatedRevenueLow: company.estimatedRevenueLow,
        estimatedSDELow: company.estimatedSDELow,
        notes: company.notes,
      } : null,
      contact: contact ? {
        fullName: contact.fullName,
        title: contact.title,
        contactType: contact.contactType,
        sellerMotivation: contact.sellerMotivation,
        sellerTimeline: contact.sellerTimeline,
        relationshipWarmth: contact.relationshipWarmth,
      } : null,
      recentInteractions: recentInteractions.map(i => ({
        type: i.type,
        direction: i.direction,
        outcome: i.outcome,
        sellerMotivation: i.sellerMotivation,
        sellerConcerns: i.sellerConcerns,
        sellerTimeline: i.sellerTimeline,
        createdAt: i.createdAt,
      })),
      bestDSCR: underwritingScenarios.length > 0
        ? Math.max(...underwritingScenarios.map(s => s.dscr || 0))
        : null,
    };
  }

  // ── Simulation ─────────────────────────────────────────────────────────────

  async runSimulationTurn({ sessionId, context, userMessage, sessionHistory = [] }) {
    const { scenarioDef, deal, company, contact, bestDSCR } = context;

    const contextBlock = `
Deal context:
${deal ? `- Stage: ${deal.stage}, Revenue: $${deal.estimatedRevenue?.toLocaleString() ?? 'unknown'}, SDE: $${deal.estimatedSDE?.toLocaleString() ?? 'unknown'}, Asking: $${deal.askingPrice?.toLocaleString() ?? 'unknown'}, DSCR: ${bestDSCR ?? 'unknown'}` : '- No deal linked.'}
${company ? `- Company: ${company.name}, ${company.industry}, ${company.city} ${company.state}, ${company.yearsInBusiness ?? '?'} years in business` : ''}
${contact ? `- Contact: ${contact.fullName} (${contact.title ?? 'unknown role'}), motivation: ${contact.sellerMotivation ?? 'unknown'}, timeline: ${contact.sellerTimeline ?? 'unknown'}` : ''}
Scenario: ${scenarioDef?.label ?? context.scenario}
${scenarioDef?.systemHint ? `Scenario context: ${scenarioDef.systemHint}` : ''}
`.trim();

    const historyMessages = sessionHistory.map(h => ({
      role: h.role,
      content: h.content,
    }));

    const prompt = `${contextBlock}

The user is practicing this negotiation scenario. They said:
"${userMessage}"

Respond as their negotiation coach. Provide:
1. A direct coaching response to what they just said (what worked, what didn't, what to improve)
2. The counterparty's likely next objection or move
3. 2-3 specific response angles for that objection
4. What NOT to say in this situation
5. Any leverage points or risk flags they should be aware of

Return JSON only:
{
  "coachResponse": "<direct coaching feedback on what the user just said>",
  "counterpartyMove": "<likely next move/objection from counterparty>",
  "responseAngles": ["<angle 1>", "<angle 2>", "<angle 3>"],
  "doNotSay": ["<thing to avoid>", ...],
  "leveragePoints": ["<leverage point>", ...],
  "riskPoints": ["<risk to watch>", ...],
  "walkAwayWarning": "<when to walk away or key threshold — null if not relevant>",
  "coachingSummary": "<1-2 sentence overall coaching note>"
}`;

    try {
      const result = await ModelGateway.run({
        taskType: 'negotiation_simulation',
        agentName: 'NegotiationCoachAgent',
        entityIds: [sessionId],
        systemPrompt: COACH_SYSTEM,
        userMessage: prompt,
        conversationHistory: historyMessages,
        outputSchema: null,
      });

      const content = result?.content;
      if (content && typeof content === 'object' && content.coachResponse) return content;

      const text = typeof content === 'string' ? content : (typeof result === 'string' ? result : '');
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
    } catch {
      // fall through to deterministic fallback
    }

    return this._simulationFallback(context, userMessage);
  }

  _simulationFallback(context, _userMessage) {
    const s = context.scenarioDef;
    return {
      coachResponse: 'AI coaching unavailable. Review scenario guidance below.',
      counterpartyMove: s ? `Expect continued resistance on: ${s.label}` : 'Counterparty likely to push back further.',
      responseAngles: [
        'Acknowledge the concern before responding',
        'Anchor on value created, not price conceded',
        'Ask a clarifying question to surface the real objection',
      ],
      doNotSay: [
        'Never show desperation or urgency to close',
        'Avoid making concessions without getting something in return',
      ],
      leveragePoints: context.deal?.dealThesis ? [`Your thesis: ${context.deal.dealThesis}`] : ['Understand their timeline before negotiating'],
      riskPoints: ['No AI analysis available — proceed with caution'],
      walkAwayWarning: context.deal?.askingPrice
        ? `Know your walk-away price before entering this conversation`
        : null,
      coachingSummary: 'Deterministic fallback active. AI coaching requires valid API key.',
    };
  }

  createSession({ dealId, companyId, contactId, scenario, role, context }) {
    const session = {
      id: crypto.randomUUID(),
      dealId: dealId || null,
      companyId: companyId || null,
      contactId: contactId || null,
      scenario,
      role,
      context,
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    (this._store.negotiationSessions = this._store.negotiationSessions || []).unshift(session);
    this._store.negotiationSessions = this._store.negotiationSessions.slice(0, 100);
    return session;
  }

  getSession(id) {
    return (this._store.negotiationSessions || []).find(s => s.id === id) || null;
  }

  appendToSession(sessionId, userMessage, coachOutput) {
    const session = this.getSession(sessionId);
    if (!session) return null;
    session.history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: JSON.stringify(coachOutput) },
    );
    session.updatedAt = new Date().toISOString();
    return session;
  }

  // ── Call recap ─────────────────────────────────────────────────────────────

  async processRecap({ meetingId, transcript, notes, summary, dealId, companyId, autoCreateTasks: shouldAutoCreate = true }) {
    const store = this._store;
    const deal    = dealId    ? (store.deals    || []).find(d => d.id === dealId)    : null;
    const company = companyId ? (store.companies|| []).find(c => c.id === companyId) : null;
    const meeting = meetingId ? (store.meetings || []).find(m => m.id === meetingId) : null;

    const inputText = [
      transcript ? `TRANSCRIPT:\n${transcript}` : null,
      notes      ? `NOTES:\n${notes}`           : null,
      summary    ? `SUMMARY:\n${summary}`        : null,
    ].filter(Boolean).join('\n\n');

    if (!inputText.trim()) {
      return this._emptyRecap({ meetingId, dealId, companyId, meeting, deal, company });
    }

    const contextBlock = [
      deal    ? `Deal: stage=${deal.stage}, revenue=$${deal.estimatedRevenue?.toLocaleString() ?? '?'}, asking=$${deal.askingPrice?.toLocaleString() ?? '?'}` : null,
      company ? `Company: ${company.name}, ${company.industry}` : null,
      meeting ? `Meeting type: ${meeting.meetingType}` : null,
    ].filter(Boolean).join('\n');

    const prompt = `Extract structured intelligence from this call/meeting.

${contextBlock ? `Context:\n${contextBlock}\n` : ''}
${inputText}

Return JSON only:
{
  "objections": [{ "text": "<objection stated>", "severity": "low|medium|high", "category": "<price|financing|transition|diligence|other>" }],
  "commitments": [{ "who": "<party>", "what": "<commitment>", "deadline": "<date or null>" }],
  "openQuestions": ["<unanswered question>", ...],
  "risks": [{ "risk": "<risk identified>", "severity": "low|medium|high" }],
  "sentiment": "positive|neutral|cautious|negative",
  "sentimentNotes": "<brief explanation of sentiment>",
  "nextSteps": [{ "action": "<specific action>", "owner": "self|counterparty|both", "deadline": "<date or null>" }],
  "meetingOutcome": "progressed|stalled|ended|unclear",
  "outcomeNotes": "<brief summary of where things stand>",
  "keyInsights": ["<important insight>", ...]
}`;

    let extracted = null;
    try {
      const result = await ModelGateway.run({
        taskType: 'call_recap_extraction',
        agentName: 'NegotiationCoachAgent',
        entityIds: [meetingId || dealId || `recap_${Date.now()}`],
        systemPrompt: RECAP_SYSTEM,
        userMessage: prompt,
        outputSchema: null,
      });

      const content = result?.content;
      if (content && typeof content === 'object' && (content.nextSteps || content.objections)) {
        extracted = content;
      } else {
        const text = typeof content === 'string' ? content : '';
        const match = text.match(/\{[\s\S]*\}/);
        if (match) extracted = JSON.parse(match[0]);
      }
    } catch {
      // fall through to minimal extraction
    }

    if (!extracted) extracted = this._minimalRecapExtraction(inputText);

    const now = new Date().toISOString();
    const recap = {
      id: crypto.randomUUID(),
      meetingId: meetingId || null,
      dealId: dealId || null,
      companyId: companyId || null,
      inputLength: inputText.length,
      ...extracted,
      tasksCreated: [],
      draftsGenerated: [],
      createdAt: now,
      updatedAt: now,
    };

    (this._store.callRecaps = this._store.callRecaps || []).unshift(recap);
    this._store.callRecaps = this._store.callRecaps.slice(0, 200);

    if (shouldAutoCreate && (extracted?.nextSteps || []).length > 0) {
      const created = this._autoCreateTasks(recap, extracted.nextSteps, dealId, companyId);
      recap.tasksCreated = created.map(t => t.id);
    }

    return recap;
  }

  _emptyRecap({ meetingId, dealId, companyId }) {
    const now = new Date().toISOString();
    const recap = {
      id: crypto.randomUUID(),
      meetingId: meetingId || null,
      dealId: dealId || null,
      companyId: companyId || null,
      inputLength: 0,
      objections: [],
      commitments: [],
      openQuestions: [],
      risks: [],
      sentiment: 'unclear',
      sentimentNotes: 'No input provided.',
      nextSteps: [],
      meetingOutcome: 'unclear',
      outcomeNotes: 'No transcript, notes, or summary provided.',
      keyInsights: [],
      tasksCreated: [],
      draftsGenerated: [],
      createdAt: now,
      updatedAt: now,
    };
    (this._store.callRecaps = this._store.callRecaps || []).unshift(recap);
    return recap;
  }

  _minimalRecapExtraction(text) {
    // Very basic keyword extraction when AI is unavailable
    const lowerText = text.toLowerCase();
    const sentiment = lowerText.includes('concern') || lowerText.includes('hesitant') || lowerText.includes('not sure')
      ? 'cautious'
      : lowerText.includes('excited') || lowerText.includes('interested') || lowerText.includes('moving forward')
      ? 'positive'
      : 'neutral';

    return {
      objections: [],
      commitments: [],
      openQuestions: [],
      risks: [],
      sentiment,
      sentimentNotes: 'AI extraction unavailable — basic keyword fallback used.',
      nextSteps: [],
      meetingOutcome: 'unclear',
      outcomeNotes: 'AI recap extraction unavailable. Review transcript manually.',
      keyInsights: ['AI unavailable — manual review recommended'],
    };
  }

  _autoCreateTasks(recap, nextSteps, dealId, companyId) {
    const created = [];
    const now = new Date().toISOString();

    for (const step of nextSteps) {
      if (!step.action || step.owner === 'counterparty') continue;

      const task = {
        id: crypto.randomUUID(),
        title: step.action,
        description: `Auto-created from call recap ${recap.id}`,
        status: 'todo',
        priority: 'medium',
        dealId: dealId || null,
        companyId: companyId || null,
        dueDate: step.deadline || null,
        source: 'recap_auto',
        recapId: recap.id,
        createdAt: now,
        updatedAt: now,
      };

      (this._store.tasks = this._store.tasks || []).push(task);
      created.push(task);
    }

    return created;
  }

  getRecap(id) {
    return (this._store.callRecaps || []).find(r => r.id === id) || null;
  }

  listRecaps({ limit = 20, dealId, companyId } = {}) {
    let recaps = this._store.callRecaps || [];
    if (dealId)    recaps = recaps.filter(r => r.dealId === dealId);
    if (companyId) recaps = recaps.filter(r => r.companyId === companyId);
    return recaps.slice(0, Math.min(limit, 100));
  }

  // ── Draft generation ───────────────────────────────────────────────────────

  async generateDraft({ recapId, meetingId, dealId, companyId, draftType, additionalContext }) {
    const store = this._store;
    const typeDef = DRAFT_TYPES[draftType];
    if (!typeDef) throw new Error(`Unknown draft type: ${draftType}`);

    const recap   = recapId   ? this.getRecap(recapId) : null;
    const deal    = dealId    ? (store.deals    || []).find(d => d.id === dealId)    : recap?.dealId    ? (store.deals    || []).find(d => d.id === recap.dealId)    : null;
    const company = companyId ? (store.companies|| []).find(c => c.id === companyId) : recap?.companyId ? (store.companies|| []).find(c => c.id === recap.companyId) : null;
    const meeting = meetingId ? (store.meetings || []).find(m => m.id === meetingId) : recap?.meetingId ? (store.meetings || []).find(m => m.id === recap.meetingId) : null;

    const contextLines = [
      company ? `Company: ${company.name} (${company.industry ?? 'unknown industry'}, ${company.city ?? ''} ${company.state ?? ''})`.trim() : null,
      deal    ? `Deal: stage=${deal.stage}, revenue=$${deal.estimatedRevenue?.toLocaleString() ?? '?'}, SDE=$${deal.estimatedSDE?.toLocaleString() ?? '?'}, asking=$${deal.askingPrice?.toLocaleString() ?? '?'}` : null,
      meeting ? `Meeting type: ${meeting.meetingType}` : null,
    ].filter(Boolean).join('\n');

    const recapLines = recap ? [
      recap.sentiment ? `Sentiment: ${recap.sentiment}` : null,
      recap.meetingOutcome ? `Outcome: ${recap.meetingOutcome}` : null,
      (recap.commitments || []).length > 0 ? `Commitments: ${recap.commitments.map(c => `${c.who}: ${c.what}`).join('; ')}` : null,
      (recap.nextSteps || []).length > 0 ? `Next steps: ${recap.nextSteps.map(s => s.action).join('; ')}` : null,
      (recap.openQuestions || []).length > 0 ? `Open questions: ${recap.openQuestions.join('; ')}` : null,
      recap.outcomeNotes ? `Notes: ${recap.outcomeNotes}` : null,
    ].filter(Boolean).join('\n') : null;

    const draftInstructions = {
      follow_up_email:  'Write a concise follow-up email (subject + body). Reference specific points from the call. Warm but professional. Under 200 words.',
      internal_update:  'Write a brief internal update (bullet format). Cover what happened, what we learned, risks, and next steps. Under 150 words.',
      seller_memo:      'Write a relationship-preserving seller memo covering: where we stand, what we agreed, what comes next. Clear and respectful. Under 250 words.',
      investor_memo:    'Write an investor-grade memo update. Cover deal status, key findings, risks, next milestones. Analytical and concise. Under 300 words.',
      next_call_brief:  'Write a next-call prep brief. Cover: what to accomplish, key questions to ask, objections to prepare for, what not to say. Tactical and specific.',
    };

    const prompt = `Generate a ${typeDef.label} based on the following context.

${contextLines ? `Deal / company context:\n${contextLines}\n` : ''}
${recapLines ? `Call recap context:\n${recapLines}\n` : ''}
${additionalContext ? `Additional context:\n${additionalContext}\n` : ''}

Instructions: ${draftInstructions[draftType]}
Tone: ${typeDef.tone}
Audience: ${typeDef.audience}

Return JSON only:
{
  "subject": "<email subject line or null if not applicable>",
  "body": "<draft body text>",
  "notes": "<optional: any coaching notes about this draft>"
}`;

    try {
      const result = await ModelGateway.run({
        taskType: 'negotiation_draft',
        agentName: 'NegotiationCoachAgent',
        entityIds: [recapId || dealId || `draft_${Date.now()}`],
        systemPrompt: DRAFT_SYSTEM,
        userMessage: prompt,
        outputSchema: null,
      });

      const content = result?.content;
      if (content && typeof content === 'object' && content.body) {
        return { draftType, ...typeDef, ...content };
      }
      const text = typeof content === 'string' ? content : '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return { draftType, ...typeDef, ...parsed };
      }
    } catch {
      // fall through to fallback
    }

    return this._draftFallback(draftType, typeDef, company, deal, recap);
  }

  _draftFallback(draftType, typeDef, company, deal, recap) {
    const companyName = company?.name ?? 'the company';
    const bodies = {
      follow_up_email: `[Draft unavailable — AI error]\n\nThank you for your time today. I wanted to follow up on our conversation regarding ${companyName}.\n\n[Add specific points from the call here.]\n\nLooking forward to next steps.`,
      internal_update: `[Draft unavailable — AI error]\n\n• Company: ${companyName}\n• Outcome: ${recap?.meetingOutcome ?? 'unclear'}\n• Next steps: [review recap manually]`,
      seller_memo:     `[Draft unavailable — AI error]\n\nThank you for speaking with us about ${companyName}. We wanted to capture where things stand and confirm next steps.\n\n[Add specifics here.]`,
      investor_memo:   `[Draft unavailable — AI error]\n\nRe: ${companyName} — Deal Update\n\nStage: ${deal?.stage ?? 'unknown'}\nStatus: [add current status]\nNext milestone: [add milestone]`,
      next_call_brief: `[Draft unavailable — AI error]\n\nPrep for next call re: ${companyName}:\n• Goal: [define goal]\n• Key questions: [add questions]\n• Watch for: [add objections]`,
    };

    return {
      draftType,
      ...typeDef,
      subject: draftType === 'follow_up_email' ? `Following up — ${companyName}` : null,
      body: bodies[draftType] ?? '[Draft unavailable]',
      notes: 'AI drafting unavailable — template fallback used.',
    };
  }
}

export const NegotiationService = new NegotiationServiceClass();
export default NegotiationService;
