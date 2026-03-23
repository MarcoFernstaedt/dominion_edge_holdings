/**
 * NegotiationCoach — tests (Batch 3, QLA Step 10)
 *
 * Tests:
 *  1. GET /api/negotiation/scenarios — returns all 9 scenarios
 *  2. GET /api/negotiation/draft-types — returns all 5 draft types
 *  3. POST /api/negotiation/simulate — rejects missing scenario
 *  4. POST /api/negotiation/simulate — rejects missing userMessage
 *  5. POST /api/negotiation/simulate — rejects unknown scenario
 *  6. POST /api/negotiation/simulate — returns coach output (AI mocked)
 *  7. POST /api/negotiation/simulate — reuses session on second turn
 *  8. POST /api/negotiation/recap — rejects missing input
 *  9. POST /api/negotiation/recap — processes notes and creates recap
 * 10. POST /api/negotiation/recap — auto-creates tasks from next steps
 * 11. GET /api/negotiation/recaps — lists recaps
 * 12. GET /api/negotiation/recaps/:id — returns recap by id
 * 13. POST /api/negotiation/draft — rejects missing draftType
 * 14. POST /api/negotiation/draft — rejects unknown draftType
 * 15. POST /api/negotiation/draft — returns fallback draft when AI mocked to fail
 * 16. NegotiationService — buildSimulationContext handles missing entities gracefully
 * 17. NegotiationService — _minimalRecapExtraction detects positive sentiment
 * 18. NegotiationService — _autoCreateTasks skips counterparty-owned steps
 */

import { jest } from '@jest/globals';

// ─── Mock ModelGateway so AI calls return controlled output ──────────────────

const mockModelGatewayRun = jest.fn();
jest.unstable_mockModule('../services/ModelGateway.js', () => ({
  default: { run: mockModelGatewayRun },
  GatewayError: class GatewayError extends Error {},
}));

// ─── Import after mocking ────────────────────────────────────────────────────

const { app, store }    = await import('../server.js');
const request           = (await import('supertest')).default;
const NegotiationSvcMod = await import('../services/NegotiationService.js');
const NegotiationService = NegotiationSvcMod.default;

// ─── Reset state between tests ───────────────────────────────────────────────

beforeEach(() => {
  store.negotiationSessions = [];
  store.callRecaps          = [];
  store.tasks               = [];
  store.companies           = [];
  store.deals               = [];
  store.contacts            = [];
  store.interactions        = [];
  NegotiationService.init(store);
  mockModelGatewayRun.mockReset();
});

// ─── 1. List scenarios ───────────────────────────────────────────────────────

describe('GET /api/negotiation/scenarios', () => {
  it('returns all 9 scenarios', async () => {
    const res = await request(app).get('/api/negotiation/scenarios');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scenarios)).toBe(true);
    expect(res.body.scenarios.length).toBe(9);
    const keys = res.body.scenarios.map(s => s.key);
    expect(keys).toContain('price_pushback');
    expect(keys).toContain('lender_dscr_objection');
    expect(keys).toContain('investor_skepticism');
  });
});

// ─── 2. List draft types ─────────────────────────────────────────────────────

describe('GET /api/negotiation/draft-types', () => {
  it('returns all 5 draft types', async () => {
    const res = await request(app).get('/api/negotiation/draft-types');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.draftTypes)).toBe(true);
    expect(res.body.draftTypes.length).toBe(5);
    const keys = res.body.draftTypes.map(d => d.key);
    expect(keys).toContain('follow_up_email');
    expect(keys).toContain('next_call_brief');
    expect(keys).toContain('investor_memo');
  });
});

// ─── 3-5. Simulate validation ────────────────────────────────────────────────

describe('POST /api/negotiation/simulate — validation', () => {
  it('rejects missing scenario', async () => {
    const res = await request(app)
      .post('/api/negotiation/simulate')
      .send({ userMessage: 'test' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELD');
  });

  it('rejects missing userMessage', async () => {
    const res = await request(app)
      .post('/api/negotiation/simulate')
      .send({ scenario: 'price_pushback' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELD');
  });

  it('rejects unknown scenario', async () => {
    const res = await request(app)
      .post('/api/negotiation/simulate')
      .send({ scenario: 'nonexistent_scenario', userMessage: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_SCENARIO');
  });
});

// ─── 6. Simulate — success with AI mocked ───────────────────────────────────

describe('POST /api/negotiation/simulate — success', () => {
  it('returns structured coach output', async () => {
    const mockCoachOutput = {
      coachResponse: 'Good opening — you anchored on value.',
      counterpartyMove: 'Seller will likely cite a competing offer.',
      responseAngles: ['Emphasize certainty of close', 'Ask what the other offer looks like'],
      doNotSay: ['Never say "we can go higher"'],
      leveragePoints: ['Seller wants clean exit by year-end'],
      riskPoints: ['Competing offer may be real'],
      walkAwayWarning: 'Walk away if price exceeds 5x SDE',
      coachingSummary: 'Solid opening. Watch for artificial urgency.',
    };
    mockModelGatewayRun.mockResolvedValueOnce({ content: mockCoachOutput });

    const res = await request(app)
      .post('/api/negotiation/simulate')
      .send({
        scenario: 'price_pushback',
        userMessage: 'Our offer reflects a fair 4x SDE multiple given the transition risk.',
      });

    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeTruthy();
    expect(res.body.scenario).toBe('price_pushback');
    expect(res.body.coachResponse).toBe(mockCoachOutput.coachResponse);
    expect(Array.isArray(res.body.responseAngles)).toBe(true);
    expect(Array.isArray(res.body.doNotSay)).toBe(true);
    expect(res.body.coachingSummary).toBeTruthy();
    expect(typeof res.body.turn).toBe('number');
  });
});

// ─── 7. Simulate — session reuse ────────────────────────────────────────────

describe('POST /api/negotiation/simulate — session reuse', () => {
  it('reuses existing session on second turn', async () => {
    const mockCoachOutput = {
      coachResponse: 'Good.',
      counterpartyMove: 'Next push.',
      responseAngles: ['Angle A'],
      doNotSay: [],
      leveragePoints: [],
      riskPoints: [],
      walkAwayWarning: null,
      coachingSummary: 'Keep going.',
    };
    mockModelGatewayRun.mockResolvedValue({ content: mockCoachOutput });

    // First turn — creates session
    const res1 = await request(app)
      .post('/api/negotiation/simulate')
      .send({ scenario: 'competitive_bid_pressure', userMessage: 'Turn 1' });
    expect(res1.status).toBe(200);
    const sessionId = res1.body.sessionId;

    // Second turn — reuses session
    const res2 = await request(app)
      .post('/api/negotiation/simulate')
      .send({ scenario: 'competitive_bid_pressure', userMessage: 'Turn 2', sessionId });
    expect(res2.status).toBe(200);
    expect(res2.body.sessionId).toBe(sessionId);
    expect(res2.body.turn).toBe(2);

    // Session history should have 4 entries (2 user + 2 assistant)
    const session = NegotiationService.getSession(sessionId);
    expect(session.history.length).toBe(4);
  });
});

// ─── 8. Recap validation ─────────────────────────────────────────────────────

describe('POST /api/negotiation/recap — validation', () => {
  it('rejects when no input provided', async () => {
    const res = await request(app)
      .post('/api/negotiation/recap')
      .send({ dealId: 'deal_1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_INPUT');
  });
});

// ─── 9. Recap — processes notes ─────────────────────────────────────────────

describe('POST /api/negotiation/recap — success', () => {
  it('processes notes and returns structured recap', async () => {
    const mockRecapOutput = {
      objections: [{ text: 'Price too low', severity: 'high', category: 'price' }],
      commitments: [{ who: 'buyer', what: 'Send revised LOI by Friday', deadline: '2026-03-27' }],
      openQuestions: ['What is the actual EBITDA for 2024?'],
      risks: [{ risk: 'Seller talking to other buyers', severity: 'high' }],
      sentiment: 'cautious',
      sentimentNotes: 'Seller expressed hesitation on price.',
      nextSteps: [
        { action: 'Send revised LOI', owner: 'self', deadline: '2026-03-27' },
        { action: 'Follow up on financials', owner: 'self', deadline: null },
      ],
      meetingOutcome: 'progressed',
      outcomeNotes: 'Good progress but price remains the key sticking point.',
      keyInsights: ['Seller is motivated but price-sensitive'],
    };
    mockModelGatewayRun.mockResolvedValueOnce({ content: mockRecapOutput });

    const res = await request(app)
      .post('/api/negotiation/recap')
      .send({
        notes: 'Call with John. He pushed back on our 4x offer. Said he needs closer to 5x. We agreed to send revised LOI by Friday.',
        dealId: 'deal_abc',
        autoCreateTasks: false,
      });

    expect(res.status).toBe(201);
    expect(res.body.recap.id).toBeTruthy();
    expect(res.body.recap.sentiment).toBe('cautious');
    expect(res.body.recap.meetingOutcome).toBe('progressed');
    expect(res.body.recap.objections.length).toBe(1);
    expect(res.body.recap.commitments.length).toBe(1);
    expect(res.body.recap.nextSteps.length).toBe(2);
  });
});

// ─── 10. Recap — auto-creates tasks ─────────────────────────────────────────

describe('POST /api/negotiation/recap — auto task creation', () => {
  it('creates tasks for self-owned next steps, skips counterparty steps', async () => {
    const mockRecapOutput = {
      objections: [],
      commitments: [],
      openQuestions: [],
      risks: [],
      sentiment: 'positive',
      sentimentNotes: 'Moving forward.',
      nextSteps: [
        { action: 'Draft LOI and send', owner: 'self', deadline: null },
        { action: 'Seller to provide P&L', owner: 'counterparty', deadline: null },
        { action: 'Schedule site visit', owner: 'self', deadline: '2026-04-01' },
      ],
      meetingOutcome: 'progressed',
      outcomeNotes: 'Both sides aligned on next steps.',
      keyInsights: [],
    };
    mockModelGatewayRun.mockResolvedValueOnce({ content: mockRecapOutput });

    const res = await request(app)
      .post('/api/negotiation/recap')
      .send({
        notes: 'Good call. Moving forward.',
        dealId: 'deal_xyz',
        autoCreateTasks: true,
      });

    expect(res.status).toBe(201);
    // 2 self-owned tasks created, 1 counterparty step skipped
    expect(res.body.recap.tasksCreated.length).toBe(2);

    // Verify tasks exist in store
    const created = store.tasks.filter(t => t.recapId === res.body.recap.id);
    expect(created.length).toBe(2);
    expect(created.every(t => t.status === 'todo')).toBe(true);
  });
});

// ─── 11. List recaps ─────────────────────────────────────────────────────────

describe('GET /api/negotiation/recaps', () => {
  it('lists recaps with correct total', async () => {
    // Pre-populate
    store.callRecaps = [
      { id: 'r1', dealId: 'd1', companyId: null, meetingOutcome: 'progressed', createdAt: new Date().toISOString() },
      { id: 'r2', dealId: 'd2', companyId: null, meetingOutcome: 'stalled',    createdAt: new Date().toISOString() },
    ];

    const res = await request(app).get('/api/negotiation/recaps');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.recaps)).toBe(true);
    expect(res.body.total).toBe(2);
  });

  it('filters by dealId', async () => {
    store.callRecaps = [
      { id: 'r1', dealId: 'd1', companyId: null, createdAt: new Date().toISOString() },
      { id: 'r2', dealId: 'd2', companyId: null, createdAt: new Date().toISOString() },
    ];

    const res = await request(app).get('/api/negotiation/recaps?dealId=d1');
    expect(res.status).toBe(200);
    expect(res.body.recaps.length).toBe(1);
    expect(res.body.recaps[0].id).toBe('r1');
  });
});

// ─── 12. Get recap by id ─────────────────────────────────────────────────────

describe('GET /api/negotiation/recaps/:id', () => {
  it('returns recap by id', async () => {
    store.callRecaps = [
      { id: 'recap_001', dealId: 'd1', sentiment: 'positive', createdAt: new Date().toISOString() },
    ];

    const res = await request(app).get('/api/negotiation/recaps/recap_001');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('recap_001');
    expect(res.body.sentiment).toBe('positive');
  });

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/negotiation/recaps/does_not_exist');
    expect(res.status).toBe(404);
  });
});

// ─── 13-14. Draft validation ─────────────────────────────────────────────────

describe('POST /api/negotiation/draft — validation', () => {
  it('rejects missing draftType', async () => {
    const res = await request(app)
      .post('/api/negotiation/draft')
      .send({ dealId: 'deal_1' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_FIELD');
  });

  it('rejects unknown draftType', async () => {
    const res = await request(app)
      .post('/api/negotiation/draft')
      .send({ draftType: 'alien_format' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_DRAFT_TYPE');
  });
});

// ─── 15. Draft — fallback when AI fails ─────────────────────────────────────

describe('POST /api/negotiation/draft — fallback', () => {
  it('returns fallback draft when AI is unavailable', async () => {
    mockModelGatewayRun.mockRejectedValueOnce(new Error('AI unavailable'));

    store.companies = [{ id: 'co1', name: 'Acme Industrial', industry: 'Manufacturing' }];

    const res = await request(app)
      .post('/api/negotiation/draft')
      .send({ draftType: 'follow_up_email', companyId: 'co1' });

    expect(res.status).toBe(200);
    expect(res.body.draft.draftType).toBe('follow_up_email');
    expect(res.body.draft.body).toBeTruthy();
    expect(typeof res.body.draft.body).toBe('string');
  });

  it('returns next_call_brief draft', async () => {
    mockModelGatewayRun.mockResolvedValueOnce({
      content: {
        subject: null,
        body: 'Prep brief: Goal — confirm pricing. Questions: ask about 2024 EBITDA. Objections: expect price pushback.',
        notes: 'AI generated.',
      },
    });

    const res = await request(app)
      .post('/api/negotiation/draft')
      .send({ draftType: 'next_call_brief', dealId: 'deal_1' });

    expect(res.status).toBe(200);
    expect(res.body.draft.draftType).toBe('next_call_brief');
    expect(res.body.draft.body).toBeTruthy();
  });
});

// ─── 16. NegotiationService unit — buildSimulationContext ───────────────────

describe('NegotiationService.buildSimulationContext', () => {
  it('returns null company/deal when ids not provided', () => {
    const ctx = NegotiationService.buildSimulationContext({
      scenario: 'price_pushback',
      role: 'buyer',
    });
    expect(ctx.company).toBeNull();
    expect(ctx.deal).toBeNull();
    expect(ctx.contact).toBeNull();
    expect(ctx.scenario).toBe('price_pushback');
  });

  it('returns context from store when ids provided', () => {
    store.companies = [{ id: 'c1', name: 'Test Co', industry: 'Services', yearsInBusiness: 10 }];
    store.deals     = [{ id: 'd1', stage: 'loi_discussion', estimatedRevenue: 5000000, estimatedSDE: 800000, askingPrice: 3500000 }];

    const ctx = NegotiationService.buildSimulationContext({
      dealId: 'd1',
      companyId: 'c1',
      scenario: 'seller_financing_resistance',
      role: 'buyer',
    });

    expect(ctx.company.name).toBe('Test Co');
    expect(ctx.deal.stage).toBe('loi_discussion');
    expect(ctx.deal.askingPrice).toBe(3500000);
  });
});

// ─── 17. NegotiationService — _minimalRecapExtraction ───────────────────────

describe('NegotiationService._minimalRecapExtraction', () => {
  it('detects positive sentiment', () => {
    const result = NegotiationService._minimalRecapExtraction('They are excited about moving forward with the deal.');
    expect(result.sentiment).toBe('positive');
  });

  it('detects cautious sentiment', () => {
    const result = NegotiationService._minimalRecapExtraction('They expressed concern about the transition period.');
    expect(result.sentiment).toBe('cautious');
  });

  it('returns neutral for ambiguous text', () => {
    const result = NegotiationService._minimalRecapExtraction('We discussed the financials.');
    expect(result.sentiment).toBe('neutral');
  });
});

// ─── 18. NegotiationService — _autoCreateTasks skips counterparty ───────────

describe('NegotiationService._autoCreateTasks', () => {
  it('only creates tasks for self-owned next steps', () => {
    const recap = { id: 'recap_test' };
    const nextSteps = [
      { action: 'Send LOI', owner: 'self', deadline: null },
      { action: 'Provide P&L', owner: 'counterparty', deadline: null },
      { action: 'Schedule diligence call', owner: 'both', deadline: '2026-04-01' },
    ];

    const created = NegotiationService._autoCreateTasks(recap, nextSteps, 'deal_1', 'co_1');
    // 'self' and 'both' should be created, 'counterparty' skipped
    expect(created.length).toBe(2);
    expect(created.every(t => t.dealId === 'deal_1')).toBe(true);
    expect(created.every(t => t.source === 'recap_auto')).toBe(true);
  });
});
