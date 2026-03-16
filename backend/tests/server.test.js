/**
 * Backend API integration tests
 * Run with: npm test
 *
 * Uses supertest to hit routes against the Express app without a real HTTP server.
 */

import request from 'supertest';
import { app } from '../server.js';

// ─── Health check ─────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('returns 404 for unknown path', async () => {
    const res = await request(app).get('/api/unknown-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('does not leak stack traces in response body', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(JSON.stringify(res.body)).not.toMatch(/at Object\./);
    expect(JSON.stringify(res.body)).not.toMatch(/\.js:\d+/);
  });
});

// ─── CORS ─────────────────────────────────────────────────────────────────────
describe('CORS', () => {
  it('allows requests from localhost:3000', async () => {
    const res = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:3000');
    // Either 200 or cors-pass through
    expect(res.status).toBeLessThan(500);
  });
});

// ─── Companies ────────────────────────────────────────────────────────────────
describe('Companies CRUD', () => {
  let createdId;

  it('GET /api/companies returns empty array initially', async () => {
    const res = await request(app).get('/api/companies');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/companies creates a company', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({ name: 'Test Pest Control', industry: 'Pest Control', city: 'Phoenix', state: 'AZ' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test Pest Control');
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
    createdId = res.body.id;
  });

  it('POST /api/companies rejects missing name', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({ industry: 'Pest Control' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/companies rejects invalid email', async () => {
    const res = await request(app)
      .post('/api/companies')
      .send({ name: 'Test Co', email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('GET /api/companies/:id retrieves created company', async () => {
    const res = await request(app).get(`/api/companies/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Test Pest Control');
    expect(Array.isArray(res.body.interactions)).toBe(true);
    expect(Array.isArray(res.body.deals)).toBe(true);
  });

  it('GET /api/companies/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/companies/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH /api/companies/:id updates a field', async () => {
    const res = await request(app)
      .patch(`/api/companies/${createdId}`)
      .send({ status: 'contacted' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('contacted');
  });

  it('PATCH /api/companies/:id rejects invalid status', async () => {
    const res = await request(app)
      .patch(`/api/companies/${createdId}`)
      .send({ status: 'invalid_status_xyz' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/companies/:id removes the company', async () => {
    const res = await request(app).delete(`/api/companies/${createdId}`);
    expect(res.status).toBe(204);

    const check = await request(app).get(`/api/companies/${createdId}`);
    expect(check.status).toBe(404);
  });
});

// ─── Contacts ─────────────────────────────────────────────────────────────────
describe('Contacts CRUD', () => {
  let contactId;

  it('POST /api/contacts creates a contact', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .send({ firstName: 'John', lastName: 'Doe', contactType: 'seller', email: 'john@example.com' });
    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe('John');
    expect(res.body.fullName).toBe('John Doe');
    contactId = res.body.id;
  });

  it('POST /api/contacts rejects missing firstName', async () => {
    const res = await request(app)
      .post('/api/contacts')
      .send({ lastName: 'Doe' });
    expect(res.status).toBe(400);
  });

  it('GET /api/contacts/:id returns contact with interactions', async () => {
    const res = await request(app).get(`/api/contacts/${contactId}`);
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('John');
    expect(Array.isArray(res.body.interactions)).toBe(true);
  });
});

// ─── Underwriting calculation ─────────────────────────────────────────────────
describe('POST /api/underwriting/calculate', () => {
  it('calculates DSCR correctly for passing deal', async () => {
    const res = await request(app)
      .post('/api/underwriting/calculate')
      .send({
        netIncome: 150_000,
        ownerSalary: 80_000,
        personalAddbacks: 15_000,
        oneTimeAdjustments: 5_000,
        marketRateManagement: 60_000,
        askingPrice: 1_250_000,
        downPaymentPct: 10,
        sellerNotePct: 10,
        seniorDebtRatePct: 6.5,
        seniorDebtTermMonths: 120,
        sellerNoteRatePct: 6,
        sellerNoteTermMonths: 60,
      });

    expect(res.status).toBe(200);
    // grossSDE = 150K + 80K + 15K + 5K = 250K
    expect(res.body.grossSDE).toBe(250_000);
    // normalizedSDE = 250K - 60K = 190K
    expect(res.body.normalizedSDE).toBe(190_000);
    expect(res.body.dscr).toBeGreaterThan(0);
    expect(typeof res.body.riskFlags).toBe('object');
    expect(Array.isArray(res.body.riskFlags)).toBe(true);
  });

  it('flags low DSCR', async () => {
    const res = await request(app)
      .post('/api/underwriting/calculate')
      .send({
        netIncome: 50_000,
        ownerSalary: 50_000,
        personalAddbacks: 0,
        oneTimeAdjustments: 0,
        marketRateManagement: 0,
        askingPrice: 2_000_000,
        downPaymentPct: 10,
        sellerNotePct: 0,
        seniorDebtRatePct: 7,
        seniorDebtTermMonths: 120,
        sellerNoteRatePct: 6,
        sellerNoteTermMonths: 60,
      });

    expect(res.status).toBe(200);
    const dscrFlag = res.body.riskFlags.find((f) => f.type === 'dscr');
    expect(dscrFlag).toBeDefined();
  });

  it('flags high multiple', async () => {
    const res = await request(app)
      .post('/api/underwriting/calculate')
      .send({
        netIncome: 100_000,
        ownerSalary: 100_000,
        personalAddbacks: 0,
        oneTimeAdjustments: 0,
        marketRateManagement: 0,
        askingPrice: 4_000_000, // 20x multiple
        downPaymentPct: 10,
        sellerNotePct: 0,
        seniorDebtRatePct: 6.5,
        seniorDebtTermMonths: 120,
        sellerNoteRatePct: 6,
        sellerNoteTermMonths: 60,
      });

    const multipleFlag = res.body.riskFlags.find((f) => f.type === 'multiple');
    expect(multipleFlag).toBeDefined();
  });

  it('returns 0 DSCR when askingPrice is 0', async () => {
    const res = await request(app)
      .post('/api/underwriting/calculate')
      .send({
        netIncome: 200_000,
        ownerSalary: 80_000,
        personalAddbacks: 0,
        oneTimeAdjustments: 0,
        marketRateManagement: 0,
        askingPrice: 0,
        downPaymentPct: 10,
        sellerNotePct: 0,
        seniorDebtRatePct: 6.5,
        seniorDebtTermMonths: 120,
        sellerNoteRatePct: 6,
        sellerNoteTermMonths: 60,
      });

    expect(res.status).toBe(200);
    expect(res.body.dscr).toBe(0);
  });

  it('rejects invalid seniorDebtRatePct above 50', async () => {
    const res = await request(app)
      .post('/api/underwriting/calculate')
      .send({
        netIncome: 100_000,
        seniorDebtRatePct: 99, // Invalid
        seniorDebtTermMonths: 120,
        sellerNoteTermMonths: 60,
        askingPrice: 1_000_000,
        downPaymentPct: 10,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ─── Tasks ────────────────────────────────────────────────────────────────────
describe('Tasks CRUD', () => {
  let taskId;

  it('POST /api/tasks creates a task', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Call seller', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Call seller');
    expect(res.body.status).toBe('todo');
    taskId = res.body.id;
  });

  it('POST /api/tasks rejects empty title', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: '', priority: 'high' });
    expect(res.status).toBe(400);
  });

  it('POST /api/tasks rejects invalid priority', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test task', priority: 'ultra-super-critical' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/tasks/:id marks task done and sets completedAt', async () => {
    const res = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({ status: 'done' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).toBeDefined();
  });

  it('GET /api/tasks filters by status', async () => {
    const res = await request(app).get('/api/tasks?status=done');
    expect(res.status).toBe(200);
    expect(res.body.every((t) => t.status === 'done')).toBe(true);
  });

  it('DELETE /api/tasks/:id removes the task', async () => {
    const res = await request(app).delete(`/api/tasks/${taskId}`);
    expect(res.status).toBe(204);
  });
});

// ─── Deals ────────────────────────────────────────────────────────────────────
describe('Deals CRUD', () => {
  let dealId;

  it('POST /api/deals creates a deal', async () => {
    const res = await request(app)
      .post('/api/deals')
      .send({ companyName: 'Acme Pest Control', estimatedSDE: 200_000 });
    expect(res.status).toBe(201);
    expect(res.body.companyName).toBe('Acme Pest Control');
    expect(res.body.status).toBe('active');
    expect(res.body.stage).toBe('sourcing');
    dealId = res.body.id;
  });

  it('GET /api/deals/:id returns deal with linked data', async () => {
    const res = await request(app).get(`/api/deals/${dealId}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.scenarios)).toBe(true);
    expect(Array.isArray(res.body.interactions)).toBe(true);
    expect(Array.isArray(res.body.documents)).toBe(true);
  });

  it('PATCH /api/deals/:id updates stage', async () => {
    const res = await request(app)
      .patch(`/api/deals/${dealId}`)
      .send({ stage: 'discovery' });
    expect(res.status).toBe(200);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────
describe('Settings', () => {
  it('GET /api/settings returns safe settings', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    // Must never include password fields
    expect(res.body.smtpPassword).toBeUndefined();
  });

  it('PATCH /api/settings updates a setting', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ density: 'compact' });
    expect(res.status).toBe(200);
    expect(res.body.density).toBe('compact');
  });

  it('PATCH /api/settings rejects invalid density value', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ density: 'ultra-wide' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/settings rejects requests containing smtpPassword (strict schema)', async () => {
    // The strict schema blocks unknown fields including smtpPassword entirely.
    // Credentials must be set via server .env, never via API.
    const res = await request(app)
      .patch('/api/settings')
      .send({ fromName: 'Marco', smtpPassword: 'super-secret' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/settings rejects extra unknown keys (strict schema)', async () => {
    const res = await request(app)
      .patch('/api/settings')
      .send({ fromName: 'Marco', injectedField: 'evil' });
    expect(res.status).toBe(400);
  });
});

// ─── Inbox compose ────────────────────────────────────────────────────────────
describe('POST /api/inbox/compose', () => {
  it('creates an email thread', async () => {
    const res = await request(app)
      .post('/api/inbox/compose')
      .send({ to: 'seller@example.com', subject: 'Acquisition inquiry', body: 'Hello...' });
    expect(res.status).toBe(201);
    expect(res.body.subject).toBe('Acquisition inquiry');
    expect(Array.isArray(res.body.messages)).toBe(true);
  });

  it('rejects invalid recipient email', async () => {
    const res = await request(app)
      .post('/api/inbox/compose')
      .send({ to: 'not-an-email', subject: 'Test' });
    expect(res.status).toBe(400);
  });

  it('rejects missing subject', async () => {
    const res = await request(app)
      .post('/api/inbox/compose')
      .send({ to: 'seller@example.com' });
    expect(res.status).toBe(400);
  });
});

// ─── Documents ────────────────────────────────────────────────────────────────
describe('Documents', () => {
  it('POST /api/documents creates a document', async () => {
    const res = await request(app)
      .post('/api/documents')
      .send({
        title: 'LOI — Acme Pest Control',
        content: 'This is a letter of intent...',
        documentType: 'loi',
        status: 'draft',
      });
    expect(res.status).toBe(201);
    expect(res.body.documentType).toBe('loi');
    expect(res.body.status).toBe('draft');
  });

  it('POST /api/documents rejects invalid documentType', async () => {
    const res = await request(app)
      .post('/api/documents')
      .send({ title: 'Test', content: 'content', documentType: 'illegal_type' });
    expect(res.status).toBe(400);
  });
});

// ─── Board candidates ─────────────────────────────────────────────────────────
describe('Board candidates', () => {
  let candidateId;

  it('POST /api/board/candidates creates a candidate', async () => {
    const res = await request(app)
      .post('/api/board/candidates')
      .send({ name: 'Jane Smith', equityOffered: 1.5 });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('identified');
    candidateId = res.body.id;
  });

  it('PATCH /api/board/candidates/:id updates status', async () => {
    const res = await request(app)
      .patch(`/api/board/candidates/${candidateId}`)
      .send({ status: 'meeting_scheduled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('meeting_scheduled');
  });

  it('PATCH /api/board/candidates/:id rejects invalid status', async () => {
    const res = await request(app)
      .patch(`/api/board/candidates/${candidateId}`)
      .send({ status: 'ready_to_sign' });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/board/candidates/:id rejects equity over 100', async () => {
    const res = await request(app)
      .patch(`/api/board/candidates/${candidateId}`)
      .send({ equityOffered: 150 });
    expect(res.status).toBe(400);
  });
});

// ─── Reports ─────────────────────────────────────────────────────────────────
describe('GET /api/reports/summary', () => {
  it('returns structured report', async () => {
    const res = await request(app).get('/api/reports/summary');
    expect(res.status).toBe(200);
    expect(res.body.overview).toBeDefined();
    expect(typeof res.body.overview.progressPct).toBe('number');
    expect(res.body.tasks).toBeDefined();
    expect(res.body.crm).toBeDefined();
    expect(res.body.pipeline).toBeDefined();
    expect(res.body.board).toBeDefined();
    expect(res.body.underwriting).toBeDefined();
  });
});

// ─── Chat endpoint input validation ──────────────────────────────────────────
describe('POST /api/chat', () => {
  it('rejects missing messages', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects non-array messages', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: 'not an array' });
    expect(res.status).toBe(400);
  });

  it('rejects messages with invalid role', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'hacker', content: 'test' }] });
    expect(res.status).toBe(400);
  });

  it('rejects oversized content', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ messages: [{ role: 'user', content: 'x'.repeat(25_000) }] });
    expect(res.status).toBe(400);
  });
});
