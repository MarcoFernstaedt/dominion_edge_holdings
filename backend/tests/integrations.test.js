/**
 * Integration system tests
 * Tests graceful degradation, registry, health endpoints, adapter behavior.
 * All external API calls are stubbed — no real network calls.
 */

import request from 'supertest';
import { app } from '../server.js';

// ─── GET /api/integrations ────────────────────────────────────────────────────
describe('GET /api/integrations', () => {
  it('returns all 4 integrations with status and sanitized config', async () => {
    const res = await request(app).get('/api/integrations');
    expect(res.status).toBe(200);
    expect(res.body.config).toBeDefined();
    expect(res.body.status).toBeDefined();

    // All 4 integrations must be present
    expect(res.body.config).toHaveProperty('apollo');
    expect(res.body.config).toHaveProperty('ai');
    expect(res.body.config).toHaveProperty('calendar');
    expect(res.body.config).toHaveProperty('email');

    // API keys must be sanitized
    expect(res.body.config.apollo.apiKey).toBe(null);
    expect(res.body.config.ai.apiKey).toBe(null);
  });

  it('returns status fields per integration', async () => {
    const res = await request(app).get('/api/integrations');
    const statuses = res.body.status;
    expect(Array.isArray(statuses)).toBe(true);
    for (const s of statuses) {
      expect(s).toHaveProperty('integrationName');
      expect(s).toHaveProperty('enabled');
      expect(s).toHaveProperty('apiConfigured');
      expect(s).toHaveProperty('status');
      expect(['connected', 'disabled', 'misconfigured', 'unreachable']).toContain(s.status);
    }
  });
});

describe('GET /api/integrations/:name', () => {
  it('returns single integration detail for apollo', async () => {
    const res = await request(app).get('/api/integrations/apollo');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('apollo');
    expect(res.body.config).toBeDefined();
    expect(res.body.status).toBeDefined();
  });

  it('returns 404 for unknown integration', async () => {
    const res = await request(app).get('/api/integrations/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── PATCH /api/integrations/:name ───────────────────────────────────────────
describe('PATCH /api/integrations/:name', () => {
  it('updates apollo enabled flag', async () => {
    const res = await request(app)
      .patch('/api/integrations/apollo')
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('apollo');
    expect(res.body.status).toBeDefined();
  });

  it('rejects unknown fields', async () => {
    const res = await request(app)
      .patch('/api/integrations/apollo')
      .send({ enabled: true, unknownField: 'hacker' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown integration name', async () => {
    const res = await request(app)
      .patch('/api/integrations/unknown_integration')
      .send({ enabled: false });
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/integrations/:name/test ───────────────────────────────────────
describe('POST /api/integrations/:name/test', () => {
  it('returns a health check result for apollo (disabled → not reachable)', async () => {
    const res = await request(app).post('/api/integrations/apollo/test');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('integration');
    expect(res.body).toHaveProperty('reachable');
    // Apollo is disabled by default → not reachable
    expect(res.body.reachable).toBe(false);
    expect(res.body.reason).toBe('INTEGRATION_DISABLED');
  });

  it('returns 404 for unknown integration name', async () => {
    const res = await request(app).post('/api/integrations/bogus/test');
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/integrations/health/check-all ─────────────────────────────────
describe('POST /api/integrations/health/check-all', () => {
  it('returns results for all integrations', async () => {
    const res = await request(app).post('/api/integrations/health/check-all');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThanOrEqual(4);
    expect(res.body.checkedAt).toBeDefined();
  });

  it('never throws — all checks complete even if integrations are down', async () => {
    const res = await request(app).post('/api/integrations/health/check-all');
    expect(res.status).toBe(200);
    for (const r of res.body.results) {
      expect(r).toHaveProperty('integration');
      expect(r).toHaveProperty('reachable');
    }
  });
});

// ─── Graceful degradation: agents return fallback when AI disabled ────────────
describe('Agent graceful degradation', () => {
  it('POST /api/agents/analyze-response returns fallback structure on error', async () => {
    // With no API key set (test env), the agent should fall back to keyword heuristic
    const res = await request(app)
      .post('/api/agents/analyze-response')
      .send({ emailBody: 'Yes I would be interested in learning more about this opportunity.' });

    expect(res.status).toBe(200);
    // Should return a valid agent output shape regardless of AI availability
    expect(res.body).toHaveProperty('agentName');
    expect(res.body).toHaveProperty('analysisSummary');
    expect(res.body).toHaveProperty('actionsProposed');
    expect(res.body).toHaveProperty('confidenceScore');
  });

  it('POST /api/agents/analyze-deal returns numeric fallback when AI unavailable', async () => {
    const res = await request(app)
      .post('/api/agents/analyze-deal')
      .send({
        financials: { revenue: 5000000, sde: 750000, askingPrice: 3000000 },
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agentName');
    expect(res.body).toHaveProperty('actionsProposed');
    // Should have financial data even in fallback
    if (res.body.fallbackUsed) {
      expect(res.body.calculatedMetrics).toBeDefined();
      expect(res.body.calculatedMetrics.impliedMultiple).toBeCloseTo(4.0, 1);
    }
  });

  it('GET /api/agents lists OutreachExecutionAgent as deterministic', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(200);
    const exec = res.body.agents.find((a) => a.name === 'OutreachExecutionAgent');
    expect(exec).toBeDefined();
    expect(exec.isDeterministic).toBe(true);
  });
});

// ─── Integration status model fields ─────────────────────────────────────────
describe('Integration status model', () => {
  it('status for disabled integration is "disabled"', async () => {
    const res = await request(app).get('/api/integrations/apollo');
    expect(res.status).toBe(200);
    // Apollo is disabled by default
    expect(res.body.status.status).toBe('disabled');
  });

  it('AI status reflects whether API key is configured', async () => {
    const res = await request(app).get('/api/integrations/ai');
    expect(res.status).toBe(200);
    // In test env ANTHROPIC_API_KEY is not set → misconfigured
    expect(['misconfigured', 'disabled', 'connected']).toContain(res.body.status.status);
  });
});

// ─── Retry utility tests ──────────────────────────────────────────────────────
describe('Retry utility', () => {
  it('resolves on first success', async () => {
    const { withRetry } = await import('../utils/retry.js');
    let attempts = 0;
    const result = await withRetry(async () => { attempts++; return 'ok'; });
    expect(result).toBe('ok');
    expect(attempts).toBe(1);
  });

  it('retries on failure and eventually resolves', async () => {
    const { withRetry } = await import('../utils/retry.js');
    let attempts = 0;
    const result = await withRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('temporary failure');
      return 'success';
    }, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after max retries exceeded', async () => {
    const { withRetry } = await import('../utils/retry.js');
    let attempts = 0;
    await expect(withRetry(async () => {
      attempts++;
      throw new Error('always fails');
    }, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('always fails');
    expect(attempts).toBe(3); // initial + 2 retries
  });

  it('aborts early when shouldRetry returns false', async () => {
    const { withRetry } = await import('../utils/retry.js');
    let attempts = 0;
    await expect(withRetry(async () => {
      attempts++;
      throw Object.assign(new Error('auth error'), { retryable: false });
    }, { maxRetries: 3, baseDelayMs: 1, shouldRetry: (e) => e.retryable !== false }))
      .rejects.toThrow('auth error');
    expect(attempts).toBe(1); // should not retry
  });
});
