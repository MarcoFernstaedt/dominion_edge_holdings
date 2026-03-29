/**
 * Service layer unit tests — all deterministic, no AI calls.
 */

import request from 'supertest';
import { app } from '../server.js';

// ─── DealService API routes ────────────────────────────────────────────────────
describe('DealService — DSCR endpoint', () => {
  it('calculates DSCR correctly', async () => {
    const res = await request(app)
      .post('/api/services/deal/dscr')
      .send({ netOperatingIncome: 250000, annualDebtService: 200000 });
    expect(res.status).toBe(200);
    expect(res.body.dscr).toBeCloseTo(1.25, 2);
    expect(res.body.meetsThreshold).toBe(true);
  });

  it('flags DSCR below 1.25 threshold', async () => {
    const res = await request(app)
      .post('/api/services/deal/dscr')
      .send({ netOperatingIncome: 100000, annualDebtService: 200000 });
    expect(res.status).toBe(200);
    expect(res.body.dscr).toBeCloseTo(0.5, 2);
    expect(res.body.meetsThreshold).toBe(false);
  });

  it('rejects missing annualDebtService', async () => {
    const res = await request(app)
      .post('/api/services/deal/dscr')
      .send({ netOperatingIncome: 100000 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('DealService — loan payment endpoint', () => {
  it('calculates monthly SBA payment', async () => {
    const res = await request(app)
      .post('/api/services/deal/loan-payment')
      .send({ principal: 2000000, annualRate: 0.075, termYears: 10 });
    expect(res.status).toBe(200);
    expect(res.body.monthlyPayment).toBeGreaterThan(0);
    expect(res.body.annualDebtService).toBeCloseTo(res.body.monthlyPayment * 12, 0);
    expect(res.body.totalCost).toBeGreaterThan(2000000);
  });

  it('rejects annualRate > 1 (percentage instead of decimal)', async () => {
    const res = await request(app)
      .post('/api/services/deal/loan-payment')
      .send({ principal: 1000000, annualRate: 7.5, termYears: 10 });
    expect(res.status).toBe(400);
  });
});

describe('DealService — valuation range endpoint', () => {
  it('returns valuation range for service business', async () => {
    const res = await request(app)
      .post('/api/services/deal/valuation')
      .send({ sde: 1000000, industryType: 'service' });
    expect(res.status).toBe(200);
    expect(res.body.low).toBe(3000000);
    expect(res.body.high).toBe(5000000);
  });

  it('returns higher multiples for industrial', async () => {
    const res = await request(app)
      .post('/api/services/deal/valuation')
      .send({ sde: 1000000, industryType: 'industrial' });
    expect(res.status).toBe(200);
    expect(res.body.low).toBeGreaterThan(3000000);
  });
});

describe('DealService — stage list endpoint', () => {
  it('returns all deal stages in order', async () => {
    const res = await request(app).get('/api/services/deal/stages');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stages)).toBe(true);
    expect(res.body.stages).toContain('prospect');
    expect(res.body.stages).toContain('closed_won');
  });
});

// ─── CRMService API routes ────────────────────────────────────────────────────
describe('CRMService — duplicate detection endpoint', () => {
  it('returns empty duplicates when no contacts', async () => {
    const res = await request(app).get('/api/services/crm/duplicates');
    expect(res.status).toBe(200);
    expect(res.body.duplicates).toEqual([]);
    expect(res.body.count).toBe(0);
  });
});

// ─── TaskService API routes ───────────────────────────────────────────────────
describe('TaskService — overdue tasks endpoint', () => {
  it('returns empty overdue when no tasks', async () => {
    const res = await request(app).get('/api/services/tasks/overdue');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.overdue)).toBe(true);
  });
});

// ─── Automation routes ────────────────────────────────────────────────────────
describe('GET /api/automation/rules', () => {
  it('returns list of automation rules', async () => {
    const res = await request(app).get('/api/automation/rules');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rules)).toBe(true);
    expect(res.body.rules.length).toBeGreaterThan(0);
    expect(res.body.rules[0]).toHaveProperty('id');
    expect(res.body.rules[0]).toHaveProperty('trigger');
    expect(res.body.rules[0]).toHaveProperty('enabled');
  });

  it('allows disabling a rule', async () => {
    const rulesRes = await request(app).get('/api/automation/rules');
    const ruleId   = rulesRes.body.rules[0].id;

    const patchRes = await request(app)
      .patch(`/api/automation/rules/${ruleId}`)
      .send({ enabled: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.enabled).toBe(false);

    // Re-enable
    await request(app).patch(`/api/automation/rules/${ruleId}`).send({ enabled: true });
  });
});

describe('GET /api/automation/jobs', () => {
  it('returns background job status list', async () => {
    const res = await request(app).get('/api/automation/jobs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });
});

// ─── Audit log routes ─────────────────────────────────────────────────────────
describe('GET /api/audit', () => {
  it('returns audit entries array', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});

// ─── Cache routes ─────────────────────────────────────────────────────────────
describe('GET /api/cache/stats', () => {
  it('returns cache entry count', async () => {
    const res = await request(app).get('/api/cache/stats');
    expect(res.status).toBe(200);
    expect(typeof res.body.entries).toBe('number');
  });
});

describe('DELETE /api/cache', () => {
  it('invalidates cache by prefix', async () => {
    const res = await request(app).delete('/api/cache').send({ prefix: 'test_' });
    expect(res.status).toBe(200);
    expect(res.body.invalidated).toBe(true);
  });

  it('rejects missing prefix', async () => {
    const res = await request(app).delete('/api/cache').send({});
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/agents includes model routes ────────────────────────────────────
describe('GET /api/agents', () => {
  it('returns agents list with model routes', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(Array.isArray(res.body.modelRoutes)).toBe(true);
    // Verify key agents present
    const names = res.body.agents.map((a) => a.name);
    expect(names).toContain('ResponseAnalysisAgent');
    expect(names).toContain('OutreachExecutionAgent');
    // OutreachExecutionAgent is deterministic
    const exec = res.body.agents.find((a) => a.name === 'OutreachExecutionAgent');
    expect(exec.isDeterministic).toBe(true);
  });
});
