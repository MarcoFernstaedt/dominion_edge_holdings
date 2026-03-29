/**
 * DiligenceIngestionService — unit tests
 *
 * Deterministic only. AI and S3 are mocked.
 * DiligenceEngine is loaded real (pure functions, no DB/AI).
 */

import { jest } from '@jest/globals';

// ─── Mock prisma ───────────────────────────────────────────────────────────────

const mockPrisma = {
  deal:              { findUnique: jest.fn() },
  storedFile:        { findUnique: jest.fn() },
  diligenceDocument: {
    findUnique: jest.fn(),
    create:     jest.fn(),
    update:     jest.fn(),
    findMany:   jest.fn(),
  },
  diligenceFinding: {
    deleteMany:  jest.fn(),
    create:      jest.fn(),
    findMany:    jest.fn(),
  },
  diligenceSummary: {
    findUnique: jest.fn(),
    upsert:     jest.fn(),
  },
  task: { create: jest.fn() },
};
jest.unstable_mockModule('../src/lib/prisma.js', () => ({ default: mockPrisma }));

// ─── Mock AIService ────────────────────────────────────────────────────────────

const mockRun             = jest.fn();
const mockRunWithDocument = jest.fn();
jest.unstable_mockModule('../services/AIService.js', () => ({
  run:             mockRun,
  runWithDocument: mockRunWithDocument,
}));

// ─── Mock S3StorageProvider ────────────────────────────────────────────────────

const mockGetObjectBuffer = jest.fn();
jest.unstable_mockModule('../services/providers/S3StorageProvider.js', () => ({
  S3StorageProvider: {
    isConfigured:    () => true,
    getObjectBuffer: mockGetObjectBuffer,
  },
  default: {
    isConfigured:    () => true,
    getObjectBuffer: mockGetObjectBuffer,
  },
}));

// ─── Lazy imports (after mocks registered) ────────────────────────────────────

let linkDocument, processDocument, DOCUMENT_TYPES;
let DILIGENCE_CATEGORIES, SEVERITY_LEVELS, overallCompleteness, categoryCompleteness;

beforeAll(async () => {
  const ingestion = await import('../services/DiligenceIngestionService.js');
  linkDocument   = ingestion.linkDocument;
  processDocument = ingestion.processDocument;
  DOCUMENT_TYPES  = ingestion.DOCUMENT_TYPES;

  const engine = await import('../services/DiligenceEngine.js');
  DILIGENCE_CATEGORIES  = engine.DILIGENCE_CATEGORIES;
  SEVERITY_LEVELS       = engine.SEVERITY_LEVELS;
  overallCompleteness   = engine.overallCompleteness;
  categoryCompleteness  = engine.categoryCompleteness;
});

// ─── linkDocument ─────────────────────────────────────────────────────────────

describe('linkDocument', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a DiligenceDocument for valid deal + file', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue({ id: 'deal_1' });
    mockPrisma.storedFile.findUnique.mockResolvedValue({
      id: 'file_1', originalName: 'CIM.pdf', mimeType: 'application/pdf',
    });
    mockPrisma.diligenceDocument.findUnique.mockResolvedValue(null);
    mockPrisma.diligenceDocument.create.mockResolvedValue({
      id: 'doc_1', dealId: 'deal_1', fileId: 'file_1',
      documentType: 'cim', displayName: 'CIM.pdf', ingestionStatus: 'pending',
    });

    const doc = await linkDocument('deal_1', 'file_1', 'cim', 'CIM.pdf');

    expect(doc.documentType).toBe('cim');
    expect(doc.ingestionStatus).toBe('pending');
    expect(mockPrisma.diligenceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dealId: 'deal_1', fileId: 'file_1', documentType: 'cim' }),
      }),
    );
  });

  it('throws if deal does not exist', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue(null);
    mockPrisma.storedFile.findUnique.mockResolvedValue({ id: 'file_1' });
    mockPrisma.diligenceDocument.findUnique.mockResolvedValue(null);

    await expect(linkDocument('bad_deal', 'file_1')).rejects.toThrow('Deal bad_deal not found');
  });

  it('throws if file is already linked to a diligence document', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue({ id: 'deal_1' });
    mockPrisma.storedFile.findUnique.mockResolvedValue({ id: 'file_1', originalName: 'x.pdf' });
    mockPrisma.diligenceDocument.findUnique.mockResolvedValue({ id: 'existing_doc' });

    await expect(linkDocument('deal_1', 'file_1')).rejects.toThrow('already linked');
  });

  it('normalises unknown documentType to "other"', async () => {
    mockPrisma.deal.findUnique.mockResolvedValue({ id: 'deal_1' });
    mockPrisma.storedFile.findUnique.mockResolvedValue({ id: 'file_1', originalName: 'f.pdf' });
    mockPrisma.diligenceDocument.findUnique.mockResolvedValue(null);
    mockPrisma.diligenceDocument.create.mockResolvedValue({
      id: 'doc_1', documentType: 'other', ingestionStatus: 'pending',
    });

    await linkDocument('deal_1', 'file_1', 'completely_invalid_type');
    expect(mockPrisma.diligenceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ documentType: 'other' }),
      }),
    );
  });
});

// ─── Finding validation helpers ───────────────────────────────────────────────

describe('finding validation against DiligenceEngine', () => {
  it('DOCUMENT_TYPES contains key types', () => {
    expect(DOCUMENT_TYPES).toContain('cim');
    expect(DOCUMENT_TYPES).toContain('financial_statements');
    expect(DOCUMENT_TYPES).toContain('lease');
    expect(DOCUMENT_TYPES).toContain('other');
    expect(DOCUMENT_TYPES).toHaveLength(9);
  });

  it('valid category+severity pass DiligenceEngine checks', () => {
    expect(DILIGENCE_CATEGORIES).toContain('financial');
    expect(DILIGENCE_CATEGORIES).toContain('customer');
    expect(SEVERITY_LEVELS).toContain('fatal');
    expect(SEVERITY_LEVELS).toContain('critical');
  });

  it('rejects invented category', () => {
    expect(DILIGENCE_CATEGORIES).not.toContain('made_up_category');
  });

  it('rejects invented severity', () => {
    expect(SEVERITY_LEVELS).not.toContain('catastrophic');
  });
});

// ─── DiligenceEngine completeness (deterministic) ─────────────────────────────

describe('DiligenceEngine — readiness score', () => {
  it('returns not_started label and low score with no input', () => {
    const result = overallCompleteness([], []);
    // Engine gives "no criticals = full credit" (20 pts) even with no issues.
    // Score ≤ 30 = not_started label.
    expect(result.overall_score).toBeLessThanOrEqual(30);
    expect(result.overall_label).toBe('not_started');
    expect(result.fatal_issue_count).toBe(0);
    expect(result.lender_blocker_count).toBe(0);
  });

  it('counts fatal issues correctly', () => {
    const issues = [
      { category: 'financial', severity: 'fatal', status: 'open',
        owner_id: null, is_lender_blocker: true, is_close_blocker: true },
    ];
    const result = overallCompleteness(issues, []);
    expect(result.fatal_issue_count).toBe(1);
    expect(result.lender_blocker_count).toBe(1);
  });

  it('gives full credit when no criticals exist in a category', () => {
    const issues = [
      { category: 'financial', severity: 'low', status: 'open',
        owner_id: 'user_1', is_lender_blocker: false, is_close_blocker: false },
    ];
    const result = categoryCompleteness('financial', issues, []);
    // review_started (30) + assigned (20) + no-criticals credit (20) = 70
    expect(result.score).toBeGreaterThanOrEqual(20);
    expect(result.fatals_present).toBe(false);
  });
});

// ─── processDocument — finding filtering ──────────────────────────────────────

describe('processDocument — AI finding validation', () => {
  beforeEach(() => jest.clearAllMocks());

  function setupDocMocks(docId, fileId, mimeType = 'text/plain') {
    mockPrisma.diligenceDocument.findUnique.mockResolvedValue({
      id: docId, dealId: 'deal_1', fileId,
      documentType: 'financial_statements',
      deal: { id: 'deal_1' },
    });
    mockPrisma.storedFile.findUnique.mockResolvedValue({
      id: fileId, key: `deal/deal_1/${fileId}.txt`,
      mimeType, sizeBytes: 200, originalName: 'test.txt',
    });
    mockPrisma.diligenceDocument.update.mockResolvedValue({ id: docId, ingestionStatus: 'done' });
    mockPrisma.diligenceFinding.deleteMany.mockResolvedValue({});
    mockPrisma.task.create.mockResolvedValue({ id: 'task_1' });
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('Revenue $1.2M. Single client 65%.'));
    mockRun.mockImplementation((taskType) => {
      if (taskType === 'diligence_extract_fields') {
        return Promise.resolve({ content: JSON.stringify({ revenue_ttm: 1200000 }) });
      }
      return Promise.resolve({ content: '[]' });
    });
  }

  it('keeps only validated findings and discards malformed ones', async () => {
    setupDocMocks('doc_v1', 'file_v1');

    mockRun.mockImplementation((taskType) => {
      if (taskType === 'diligence_extract_fields') {
        return Promise.resolve({ content: JSON.stringify({ revenue_ttm: 1200000 }) });
      }
      if (taskType === 'diligence_flag_extraction') {
        return Promise.resolve({ content: JSON.stringify([
          // ✓ Valid
          {
            category: 'customer', severity: 'critical', confidence: 'high',
            title: 'High customer concentration',
            sourceSnippet: 'Single client 65%.',
            whyItMatters: 'Risk if largest client churns.',
            recommendedFollowUp: 'Request multi-year contract.',
          },
          // ✗ Invalid category
          {
            category: 'INVALID', severity: 'high', confidence: 'medium',
            title: 'Bad', whyItMatters: 'x', recommendedFollowUp: 'y',
          },
          // ✗ Missing required fields
          { category: 'financial', severity: 'low' },
        ]) });
      }
      return Promise.resolve({ content: '{}' });
    });

    mockPrisma.diligenceFinding.create.mockResolvedValue({
      id: 'f_1', severity: 'critical', status: 'open',
    });

    const result = await processDocument('doc_v1');
    expect(result.findings).toHaveLength(1);
    expect(mockPrisma.diligenceFinding.create).toHaveBeenCalledTimes(1);
  });

  it('auto-creates a task for critical findings', async () => {
    setupDocMocks('doc_v2', 'file_v2');

    mockRun.mockImplementation((taskType) => {
      if (taskType === 'diligence_extract_fields') {
        return Promise.resolve({ content: '{}' });
      }
      if (taskType === 'diligence_flag_extraction') {
        return Promise.resolve({ content: JSON.stringify([{
          category: 'legal', severity: 'critical', confidence: 'high',
          title: 'Pending lawsuit',
          whyItMatters: 'Active litigation may affect deal.',
          recommendedFollowUp: 'Request full case file.',
          sourceSnippet: null,
        }]) });
      }
      return Promise.resolve({ content: '{}' });
    });

    mockPrisma.diligenceFinding.create.mockResolvedValue({ id: 'f_2', severity: 'critical', status: 'open' });

    await processDocument('doc_v2');

    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priority:         'high',
          linkedEntityType: 'deal',
          source:           'diligence_ingestion',
        }),
      }),
    );
  });

  it('sets ingestionStatus to failed on error', async () => {
    mockPrisma.diligenceDocument.findUnique.mockResolvedValue({
      id: 'doc_fail', dealId: 'deal_1', fileId: 'file_fail',
      documentType: 'other', deal: { id: 'deal_1' },
    });
    mockPrisma.storedFile.findUnique.mockResolvedValue({
      id: 'file_fail', key: 'x', mimeType: 'text/plain', sizeBytes: 50,
    });
    mockPrisma.diligenceDocument.update.mockResolvedValue({});
    mockGetObjectBuffer.mockRejectedValue(new Error('S3 connection refused'));

    await expect(processDocument('doc_fail')).rejects.toThrow('S3 connection refused');

    expect(mockPrisma.diligenceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ingestionStatus: 'failed' }),
      }),
    );
  });
});
