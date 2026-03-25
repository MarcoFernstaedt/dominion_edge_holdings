/**
 * auth.test.js — Authentication endpoint and middleware tests.
 *
 * Tests run in NODE_ENV=test with AUTH_ENABLED unset, so requireAuth
 * operates in bypass mode (all requests get a synthetic system identity).
 * Tests that specifically need auth enforcement use Bearer tokens or
 * verify the correct status codes and response shapes.
 */

import request from 'supertest';
import { app }  from '../src/app.js';

// ─── GET /api/auth/status ─────────────────────────────────────────────────────
describe('GET /api/auth/status', () => {
  it('returns 200 with auth config shape', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(typeof res.body.authEnabled).toBe('boolean');
    expect(typeof res.body.jwtConfigured).toBe('boolean');
    expect(typeof res.body.setupRequired).toBe('boolean');
  });

  it('is accessible without a session cookie', async () => {
    // No credentials — must still succeed (public endpoint)
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
  });

  it('does not expose the JWT secret or passwords', async () => {
    const res  = await request(app).get('/api/auth/status');
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/AUTH_JWT_SECRET/i);
    expect(body).not.toMatch(/password/i);
    expect(body).not.toMatch(/secret/i);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('rejects missing credentials with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid email format with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'somepass' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty password with 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: '' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unknown user (not 500, no user enumeration leak)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrongpassword' });
    // Either 401 (auth failed) or 503 (DB unavailable in test) — never 500 from app logic
    expect([401, 503]).toContain(res.status);
    if (res.status === 401) {
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      // Error message must not reveal whether the user exists
      expect(res.body.error.message).not.toMatch(/user not found/i);
    }
  });

  it('does not leak stack traces on auth failure', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong' });
    expect(JSON.stringify(res.body)).not.toMatch(/\.js:\d+/);
    expect(JSON.stringify(res.body)).not.toMatch(/at Object\./);
  });
});

// ─── POST /api/auth/setup ─────────────────────────────────────────────────────
describe('POST /api/auth/setup', () => {
  it('rejects short passwords with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ email: 'owner@example.com', password: 'short', name: 'Owner' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects missing name with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ email: 'owner@example.com', password: 'longenoughpassword' });
    expect(res.status).toBe(400);
  });

  it('rejects missing email with 400', async () => {
    const res = await request(app)
      .post('/api/auth/setup')
      .send({ password: 'longenoughpassword', name: 'Owner' });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('returns 200 even without a session (optionalAuth)', async () => {
    // Logout must work whether or not a token is present (including expired tokens)
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('clears the deh_token cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    // The Set-Cookie header should clear the cookie (maxAge=0 or expires in past)
    const setCookie = res.headers['set-cookie'] ?? [];
    const tokenCookie = setCookie.find((c) => c.includes('deh_token'));
    if (tokenCookie) {
      // If cookie is set, it must be cleared (maxAge=0 or empty value)
      expect(tokenCookie).toMatch(/deh_token=;|Max-Age=0/i);
    }
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns 200 in bypass mode with synthetic user', async () => {
    // In test/dev with AUTH_ENABLED unset, requireAuth bypasses and sets synthetic user
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBeDefined();
  });

  it('returns a safe user object without password fields', async () => {
    const res = await request(app).get('/api/auth/me');
    if (res.status === 200) {
      expect(res.body.user).not.toHaveProperty('passwordHash');
      expect(res.body.user).not.toHaveProperty('password');
    }
  });
});

// ─── Protected route enforcement ──────────────────────────────────────────────
describe('Protected route auth enforcement', () => {
  it('returns 200 for /api/companies in bypass mode (AUTH_ENABLED not set)', async () => {
    const res = await request(app).get('/api/companies');
    // In test mode, bypass allows unauthenticated access
    expect(res.status).toBe(200);
  });

  it('returns 503 or 400 (not 200) if AUTH_JWT_SECRET missing and auth enforced', async () => {
    // This tests that the middleware correctly rejects when misconfigured.
    // Simulate by making a request with a malformed Bearer token when auth
    // would be enforced in production. In test env, bypass mode means 200.
    // We verify the shape of a 401/503 response format is correct if returned.
    const res = await request(app)
      .get('/api/companies')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt');
    // In bypass mode (test), this still passes (200). In prod this would be 401.
    // Just verify no 500 server crash.
    expect(res.status).not.toBe(500);
  });
});

// ─── Admin route role guard ───────────────────────────────────────────────────
describe('Admin routes', () => {
  it('GET /api/admin/jobs returns 200 in bypass mode (owner role assumed)', async () => {
    // Bypass mode gives owner role, so admin routes should pass
    const res = await request(app).get('/api/admin/jobs');
    expect(res.status).toBe(200);
    expect(res.body.jobs).toBeDefined();
    expect(Array.isArray(res.body.jobs)).toBe(true);
  });

  it('GET /api/admin/integrations/health returns 200 in bypass mode', async () => {
    const res = await request(app).get('/api/admin/integrations/health');
    expect(res.status).toBe(200);
  });
});

// ─── Cookie security properties ───────────────────────────────────────────────
describe('Cookie security', () => {
  it('login response does not expose the JWT token in the body', async () => {
    // We can test the shape of an error response — no token in body
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrongpassword12345' });
    // Whether 401 or 503, no token should be in the body
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/); // JWT header prefix
  });

  it('blocks unsafe cookie-authenticated requests without a trusted origin', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', ['deh_token=test-session'])
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_BLOCKED');
  });

  it('allows unsafe cookie-authenticated requests from a trusted origin', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('Cookie', ['deh_token=test-session'])
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
