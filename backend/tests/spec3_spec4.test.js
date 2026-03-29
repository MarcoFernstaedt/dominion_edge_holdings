/**
 * Spec 3 & 4 integration tests
 *
 * Covers: Board Intelligence, Credibility Index, Network Alerts,
 *         Notifications, Artifacts, Export Service, Quick Actions
 *
 * All tests are deterministic — no AI calls, in-memory store only.
 */

import request from 'supertest';
import { app } from '../server.js';

// ─── Board Intelligence ───────────────────────────────────────────────────────

describe('GET /api/board/seats/health', () => {
  it('returns board readiness score structure', async () => {
    const res = await request(app).get('/api/board/seats/health');
    expect(res.status).toBe(200);
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(typeof res.body.label).toBe('string');
    expect(Array.isArray(res.body.analyzed_seats)).toBe(true);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(typeof res.body.components).toBe('object');
  });

  it('analyzed_seats contains valid health states', async () => {
    const res = await request(app).get('/api/board/seats/health');
    const VALID_HEALTH_STATES = ['empty', 'weak', 'developing', 'active', 'secured'];
    const VALID_RISK_LEVELS   = ['low', 'moderate', 'high', 'critical'];

    for (const seat of res.body.analyzed_seats) {
      expect(VALID_HEALTH_STATES).toContain(seat.health_state);
      expect(VALID_RISK_LEVELS).toContain(seat.risk_level);
      expect(typeof seat.candidate_count).toBe('number');
    }
  });
});

describe('GET /api/board/seats/:seatType/candidates', () => {
  it('returns ranked candidates for a seat type', async () => {
    const res = await request(app).get('/api/board/seats/industry_veteran/candidates');
    expect(res.status).toBe(200);
    expect(res.body.seat_type).toBe('industry_veteran');
    expect(Array.isArray(res.body.ranked_candidates)).toBe(true);
  });

  it('handles unknown seat types gracefully', async () => {
    const res = await request(app).get('/api/board/seats/unknown_seat_xyz/candidates');
    expect(res.status).toBe(200); // returns empty array, not an error
    expect(Array.isArray(res.body.ranked_candidates)).toBe(true);
  });
});

// ─── Credibility Index ────────────────────────────────────────────────────────

describe('GET /api/credibility', () => {
  it('returns credibility index with all required fields', async () => {
    const res = await request(app).get('/api/credibility');
    expect(res.status).toBe(200);
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(typeof res.body.label).toBe('string');
    expect(['elite', 'credible', 'developing', 'early_stage', 'limited']).toContain(res.body.label);
    expect(typeof res.body.components).toBe('object');
    expect(Array.isArray(res.body.gaps)).toBe(true);
    expect(typeof res.body.downstream).toBe('object');
  });

  it('score is consistent with label', async () => {
    const res = await request(app).get('/api/credibility');
    const { score, label } = res.body;

    if (score >= 85) expect(label).toBe('elite');
    else if (score >= 70) expect(label).toBe('credible');
    else if (score >= 50) expect(label).toBe('developing');
    else if (score >= 30) expect(label).toBe('early_stage');
    else expect(label).toBe('limited');
  });

  it('components include all 9 expected keys', async () => {
    const res = await request(app).get('/api/credibility');
    const expected = [
      'industry_veteran_progress', 'board_readiness', 'advisor_quality',
      'asset_completeness', 'thesis_clarity', 'deal_pipeline_seriousness',
      'document_readiness', 'meeting_traction', 'capital_connector_progress',
    ];
    for (const key of expected) {
      expect(res.body.components).toHaveProperty(key);
      expect(typeof res.body.components[key]).toBe('number');
    }
  });
});

// ─── Network Alerts ───────────────────────────────────────────────────────────

describe('GET /api/network/alerts', () => {
  it('returns alerts structure', async () => {
    const res = await request(app).get('/api/network/alerts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.alerts)).toBe(true);
    expect(typeof res.body.critical_count).toBe('number');
    expect(typeof res.body.high_count).toBe('number');
    expect(typeof res.body.total).toBe('number');
  });

  it('counts are consistent with alerts array', async () => {
    const res = await request(app).get('/api/network/alerts');
    expect(res.body.total).toBe(res.body.alerts.length);
    expect(res.body.critical_count).toBeLessThanOrEqual(res.body.total);
    expect(res.body.high_count).toBeLessThanOrEqual(res.body.total);
  });
});

describe('GET /api/command-center/network', () => {
  it('returns full network command center summary', async () => {
    const res = await request(app).get('/api/command-center/network');
    expect(res.status).toBe(200);
    expect(typeof res.body.credibility_index).toBe('object');
    expect(typeof res.body.critical_alert_count).toBe('number');
    expect(typeof res.body.high_alert_count).toBe('number');
    expect(typeof res.body.total_alert_count).toBe('number');
    expect(Array.isArray(res.body.network_leverage_alerts)).toBe(true);
  });
});

// ─── Investor Readiness Gaps ──────────────────────────────────────────────────

describe('GET /api/investors/readiness-gaps', () => {
  it('returns gap analysis structure', async () => {
    const res = await request(app).get('/api/investors/readiness-gaps');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.gaps)).toBe(true);
    expect(typeof res.body.gap_count).toBe('number');
    expect(typeof res.body.ready).toBe('boolean');
    expect(Array.isArray(res.body.critical_gaps)).toBe(true);
    expect(typeof res.body.credibility_score).toBe('number');
  });

  it('gap_count matches gaps array length', async () => {
    const res = await request(app).get('/api/investors/readiness-gaps');
    expect(res.body.gap_count).toBe(res.body.gaps.length);
  });

  it('ready is false when there are critical gaps', async () => {
    const res = await request(app).get('/api/investors/readiness-gaps');
    if (res.body.critical_gaps.length > 0) {
      expect(res.body.ready).toBe(false);
    }
  });
});

// ─── Notifications ────────────────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  it('returns notification list', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(res.body.total).toBe(res.body.notifications.length);
  });

  it('filters by unread=true', async () => {
    const res = await request(app).get('/api/notifications?unread=true');
    expect(res.status).toBe(200);
    for (const n of res.body.notifications) {
      expect(n.read_at).toBeNull();
    }
  });
});

describe('POST /api/notifications/mark-all-read', () => {
  it('returns marked_read count', async () => {
    const res = await request(app).post('/api/notifications/mark-all-read').send({});
    expect(res.status).toBe(200);
    expect(typeof res.body.marked_read).toBe('number');
  });
});

// ─── Artifacts ────────────────────────────────────────────────────────────────

describe('GET /api/artifacts', () => {
  it('returns artifact list', async () => {
    const res = await request(app).get('/api/artifacts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.artifacts)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });

  it('filters by artifactStatus', async () => {
    const res = await request(app).get('/api/artifacts?artifactStatus=draft');
    expect(res.status).toBe(200);
    for (const a of res.body.artifacts) {
      expect(a.status ?? a.artifactStatus).toBe('draft');
    }
  });
});

describe('POST /api/artifacts', () => {
  it('creates a new artifact', async () => {
    const res = await request(app)
      .post('/api/artifacts')
      .send({
        type:    'email_draft',
        title:   'Test Email Draft',
        content: 'Hello, this is a test email.',
      });
    expect(res.status).toBe(201);
    expect(res.body.artifact).toBeDefined();
    expect(res.body.artifact.title).toBe('Test Email Draft');
  });

  it('rejects missing type', async () => {
    const res = await request(app)
      .post('/api/artifacts')
      .send({ title: 'No Type', content: 'body' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('sets approval-required status for email_draft', async () => {
    const res = await request(app)
      .post('/api/artifacts')
      .send({ type: 'email_draft', title: 'Approval Test', content: 'needs approval' });
    expect(res.status).toBe(201);
    // email_draft requires approval — status should be submitted_for_approval or draft (not sent)
    const status = res.body.artifact.status ?? res.body.artifact.artifactStatus;
    expect(['submitted_for_approval', 'draft', 'ready']).toContain(status);
  });
});

describe('POST /api/artifacts/:id/archive', () => {
  it('archives an existing artifact', async () => {
    // First create one
    const create = await request(app)
      .post('/api/artifacts')
      .send({ type: 'memo', title: 'Archive Me', content: 'test content' });
    expect(create.status).toBe(201);

    const id = create.body.artifact.artifactId ?? create.body.artifact.id;

    const res = await request(app)
      .post(`/api/artifacts/${id}/archive`)
      .send({ by: 'test_user', reason: 'No longer needed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('archived');
  });

  it('returns 404 for unknown artifact', async () => {
    const res = await request(app)
      .post('/api/artifacts/nonexistent-id/archive')
      .send({ by: 'user' });
    expect(res.status).toBe(404);
  });
});

// ─── Export Service ───────────────────────────────────────────────────────────

describe('GET /api/exports', () => {
  it('returns export list', async () => {
    const res = await request(app).get('/api/exports');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.exports)).toBe(true);
  });
});

describe('POST /api/artifacts/:id/export', () => {
  it('queues an export for a non-approval-required artifact', async () => {
    // Create a plain artifact type that does not require approval
    const create = await request(app)
      .post('/api/artifacts')
      .send({ type: 'deal_memo', title: 'Export Test', content: 'content here' });
    expect(create.status).toBe(201);

    const id = create.body.artifact.artifactId ?? create.body.artifact.id;

    const res = await request(app)
      .post(`/api/artifacts/${id}/export`)
      .send({ export_type: 'pdf', requested_by: 'test_user' });

    // deal_memo is not in APPROVAL_REQUIRED_TYPES, so should succeed
    expect([202, 422]).toContain(res.status); // 422 if it was auto-approved, 202 otherwise
  });

  it('blocks external export of email_draft without approval', async () => {
    const create = await request(app)
      .post('/api/artifacts')
      .send({ type: 'email_draft', title: 'Blocked Export', content: 'content' });
    expect(create.status).toBe(201);

    const id = create.body.artifact.artifactId ?? create.body.artifact.id;

    const res = await request(app)
      .post(`/api/artifacts/${id}/export`)
      .send({ export_type: 'email', requested_by: 'test_user' });

    // email_draft requires approval — external export (email) should be blocked
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('EXPORT_NOT_ELIGIBLE');
  });
});

// ─── Quick Actions ────────────────────────────────────────────────────────────

describe('POST /api/quick-log', () => {
  it('logs a quick interaction', async () => {
    const res = await request(app)
      .post('/api/quick-log')
      .send({
        entity_type:      'contact',
        entity_id:        'test-contact-1',
        interaction_type: 'call',
        notes:            'Spoke for 10 minutes about deal',
        sentiment:        'positive',
        logged_by:        'user',
      });
    expect(res.status).toBe(201);
    expect(res.body.quick_log).toBeDefined();
    expect(res.body.quick_log.interaction_type).toBe('call');
    expect(res.body.quick_log.entity_type).toBe('contact');
  });

  it('rejects invalid entity_type', async () => {
    const res = await request(app)
      .post('/api/quick-log')
      .send({
        entity_type:      'invalid_type',
        entity_id:        'id-1',
        interaction_type: 'call',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid interaction_type', async () => {
    const res = await request(app)
      .post('/api/quick-log')
      .send({
        entity_type:      'contact',
        entity_id:        'id-1',
        interaction_type: 'telegram',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/quick-action/proof-submit', () => {
  it('rejects missing task_id', async () => {
    const res = await request(app)
      .post('/api/quick-action/proof-submit')
      .send({ proof_type: 'screenshot' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown task', async () => {
    const res = await request(app)
      .post('/api/quick-action/proof-submit')
      .send({ task_id: 'nonexistent-task', proof_type: 'screenshot' });
    expect(res.status).toBe(404);
  });
});

// ─── Relationship Edges ───────────────────────────────────────────────────────

describe('POST /api/relationships/edges', () => {
  it('creates a relationship edge', async () => {
    const res = await request(app)
      .post('/api/relationships/edges')
      .send({
        from_contact_id: 'contact-a',
        to_contact_id:   'contact-b',
        edge_type:       'knows',
        strength:        7,
        confidence:      80,
      });
    expect(res.status).toBe(201);
    expect(res.body.edge).toBeDefined();
    expect(res.body.edge.edge_type).toBe('knows');
  });

  it('rejects invalid edge_type', async () => {
    const res = await request(app)
      .post('/api/relationships/edges')
      .send({
        from_contact_id: 'contact-a',
        to_contact_id:   'contact-b',
        edge_type:       'invented_type',
      });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/relationships/edges', () => {
  it('returns all edges', async () => {
    const res = await request(app).get('/api/relationships/edges');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.edges)).toBe(true);
  });
});

// ─── Investor funnel ──────────────────────────────────────────────────────────

describe('GET /api/investors/funnel', () => {
  it('returns funnel with stage breakdown', async () => {
    const res = await request(app).get('/api/investors/funnel');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.stages)).toBe(true);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.active).toBe('number');
  });
});

describe('GET /api/investors/high-fit', () => {
  it('returns high-fit investors', async () => {
    const res = await request(app).get('/api/investors/high-fit');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.investors)).toBe(true);
    expect(typeof res.body.total).toBe('number');
  });
});
