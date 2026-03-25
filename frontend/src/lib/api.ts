/**
 * Typed API client for the DEH backend.
 * All requests go through this module — never fetch() directly in components.
 */

import type {
  ChecklistGrade,
  ConversationFunnel,
  DealVelocityEntry,
  FrequencyProgress,
  PipelinePressureMetrics,
} from './types';

const API_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
    : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isValidationError() {
    return this.status === 400;
  }

  get isRateLimited() {
    return this.status === 429;
  }

  get isServerError() {
    return this.status >= 500;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const res = await fetch(url, {
    credentials: 'include', // send HttpOnly auth cookie
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    let code = 'UNKNOWN_ERROR';
    let message = `Request failed: ${res.status}`;
    let requestId: string | undefined;

    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
      requestId = body?.error?.requestId;
    } catch {
      // Non-JSON error body — use defaults
    }

    throw new ApiError(res.status, code, message, requestId);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ─── Generic helpers ──────────────────────────────────────────────────────────
export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
};

// ─── Dashboard ────────────────────────────────────────────────────────────────
export interface DashboardMetrics {
  overdueTasks: number;
  activeDeals: number;
  outboundWeek: number;
  confirmedBoard: number;
  progressPct: number;
  completedItems: number;
  totalItems: number;
  needsReply: number;
}

export interface CommandCenterSystemStatus {
  generatedAt: string;
  app: {
    status: 'ok' | 'watch' | 'degraded' | string;
    uptimeSeconds: number;
    environment: string;
    version: string | null;
    checks: {
      dataLoaded: {
        companies: number;
        deals: number;
        tasks: number;
        notifications: number;
      };
      automation: {
        registeredJobs: number;
        runningJobs: number;
        jobsTouchedLastHour: number;
        failedRunsLastHour: number;
      };
    };
  };
  vps: {
    available: boolean;
    hostname: string | null;
    platform: string | null;
    uptimeSeconds: number | null;
    loadAverage1m: number | null;
    memory: {
      usedBytes: number;
      freeBytes: number;
      totalBytes: number;
      usedPercent: number | null;
    } | null;
    node: {
      version: string;
      pid: number;
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
    };
  };
  codexSession: {
    available: boolean;
    status: string;
    note: string;
  };
  workforce: {
    registeredAgents: number;
    agentsActiveLastHour: number;
    agentRunsLastHour: number;
    activeWorkNowApprox: number;
    subagents: {
      available: boolean;
      note: string;
    };
    agents: Array<{
      agentName: string;
      latestTask: string;
      lastRunAt: string;
      modelUsed: string | null;
      status: string;
      fallbackUsed: boolean;
      runCount: number;
    }>;
    jobs: Array<{
      id: string;
      name: string;
      running: boolean;
      enabled: boolean;
      lastRun: string | null;
      recentRuns: Array<{
        runId: string;
        status: string;
        startedAt: string;
        durationMs: number;
        error?: string;
      }>;
    }>;
  };
  ai: {
    totalRuns: number;
    failureRate: number;
    fallbackRate: number;
    cacheHitRate: number;
    recentRuns: Array<{
      runId: string;
      agentName: string;
      taskType: string;
      modelUsed: string;
      createdAt: string;
      latencyMs: number;
      estimatedCost: number;
      status: string;
      fallbackUsed: boolean;
      cached: boolean;
    }>;
  };
  integrations: {
    available: boolean;
    checkedAt: string | null;
    connected: number;
    degraded: number;
    items: Array<Record<string, unknown>>;
  };
}

export const dashboardApi = {
  getMetrics: () => api.get<DashboardMetrics>('/api/dashboard/metrics'),
  getNextActions: () => api.get<unknown[]>('/api/dashboard/next-actions'),
  getBriefing: () => api.get<{ briefing: string | null }>('/api/dashboard/briefing'),
  getSystemStatus: () => api.get<CommandCenterSystemStatus>('/api/dashboard/system-status'),
};

export const checklistApi = {
  gradeSubmission: (payload: { itemTitle: string; completionType: string; submission: string }) =>
    api.post<{ grade: ChecklistGrade }>('/api/checklist/grade', payload),
};

// ─── Companies ────────────────────────────────────────────────────────────────
export const companiesApi = {
  list: (params?: { status?: string; search?: string; industry?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<unknown[]>(`/api/companies${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<unknown>(`/api/companies/${id}`),
  create: (data: unknown) => api.post<unknown>('/api/companies', data),
  update: (id: string, data: unknown) => api.patch<unknown>(`/api/companies/${id}`, data),
  delete: (id: string) => api.delete(`/api/companies/${id}`),
};

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contactsApi = {
  list: (params?: { companyId?: string; type?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<unknown[]>(`/api/contacts${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<unknown>(`/api/contacts/${id}`),
  create: (data: unknown) => api.post<unknown>('/api/contacts', data),
  update: (id: string, data: unknown) => api.patch<unknown>(`/api/contacts/${id}`, data),
};

// ─── Interactions ─────────────────────────────────────────────────────────────
export const interactionsApi = {
  create: (data: unknown) => api.post<unknown>('/api/interactions', data),
  list: (params?: { companyId?: string; contactId?: string; dealId?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<unknown[]>(`/api/interactions${qs ? `?${qs}` : ''}`);
  },
};

// ─── Deals ────────────────────────────────────────────────────────────────────
export const dealsApi = {
  list: (params?: { status?: string; stage?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<unknown[]>(`/api/deals${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => api.get<unknown>(`/api/deals/${id}`),
  create: (data: unknown) => api.post<unknown>('/api/deals', data),
  update: (id: string, data: unknown) => api.patch<unknown>(`/api/deals/${id}`, data),
};

// ─── Underwriting ─────────────────────────────────────────────────────────────
export interface UnderwritingResult {
  grossSDE: number;
  normalizedSDE: number;
  downPayment: number;
  seniorDebtAmount: number;
  sellerNoteAmount: number;
  monthlyDebtService: number;
  annualDebtService: number;
  dscr: number;
  postDebtCashFlow: number;
  multiple: number;
  riskFlags: Array<{ type: string; message: string }>;
}

export const underwritingApi = {
  calculate: (data: unknown) => api.post<UnderwritingResult>('/api/underwriting/calculate', data),
  saveScenario: (data: unknown) => api.post<unknown>('/api/underwriting/scenarios', data),
  listScenarios: (dealId?: string) =>
    api.get<unknown[]>(`/api/underwriting/scenarios${dealId ? `?dealId=${dealId}` : ''}`),
  deleteScenario: (id: string) => api.delete(`/api/underwriting/scenarios/${id}`),
};

// ─── Board ────────────────────────────────────────────────────────────────────
export const boardApi = {
  getSeats: () => api.get<unknown[]>('/api/board/seats'),
  getCandidates: () => api.get<unknown[]>('/api/board/candidates'),
  createCandidate: (data: unknown) => api.post<unknown>('/api/board/candidates', data),
  updateCandidate: (id: string, data: unknown) => api.patch<unknown>(`/api/board/candidates/${id}`, data),
  getCapTable: () => api.get<unknown[]>('/api/board/cap-table'),
  addCapTableEntry: (data: unknown) => api.post<unknown>('/api/board/cap-table', data),
  deleteCapTableEntry: (id: string) => api.delete(`/api/board/cap-table/${id}`),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list: (params?: { status?: string; priority?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<unknown[]>(`/api/tasks${qs ? `?${qs}` : ''}`);
  },
  create: (data: unknown) => api.post<unknown>('/api/tasks', data),
  update: (id: string, data: unknown) => api.patch<unknown>(`/api/tasks/${id}`, data),
  delete: (id: string) => api.delete(`/api/tasks/${id}`),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentsApi = {
  list: (params?: { entityId?: string; documentType?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<unknown[]>(`/api/documents${qs ? `?${qs}` : ''}`);
  },
  create: (data: unknown) => api.post<unknown>('/api/documents', data),
  get: (id: string) => api.get<unknown>(`/api/documents/${id}`),
};

// ─── Outreach ─────────────────────────────────────────────────────────────────
export const outreachApi = {
  generateDraft: (data: {
    templateType: string;
    companyName?: string;
    ownerName?: string;
    context?: string;
  }) => api.post<{ subject: string; body: string }>('/api/outreach/generate', data),
  getReplySuggestion: (data: {
    threadSubject?: string;
    lastMessage: string;
    senderName?: string;
    companyName?: string;
  }) => api.post<{ subject: string; body: string }>('/api/ai/reply-suggestion', data),
};

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => api.get<unknown>('/api/settings'),
  update: (data: unknown) => api.patch<unknown>('/api/settings', data),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  getSummary: () => api.get<unknown>('/api/reports/summary'),
};

// ─── Sourcing Radar ───────────────────────────────────────────────────────────
export const sourcingRadarApi = {
  listAdapters: () => api.get<{ adapters: unknown[] }>('/api/sourcing-radar/adapters'),
  updateAdapter: (id: string, data: unknown) => api.patch<unknown>(`/api/sourcing-radar/adapters/${id}`, data),
  healthCheck: (id: string) => api.post<unknown>(`/api/sourcing-radar/adapters/${id}/health-check`, {}),
  runScan: () => api.post<{ run: unknown }>('/api/sourcing-radar/run', {}),
  getRuns: (limit?: number) => api.get<{ runs: unknown[] }>(`/api/sourcing-radar/runs${limit ? `?limit=${limit}` : ''}`),
  getCandidates: (params?: { reviewStatus?: string; minScore?: number; industry?: string; state?: string }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).reduce((a, [k, v]) => v != null ? { ...a, [k]: String(v) } : a, {} as Record<string, string>)).toString();
    return api.get<{ candidates: unknown[]; total: number }>(`/api/sourcing-radar/candidates${qs ? `?${qs}` : ''}`);
  },
  updateCandidate: (id: string, data: unknown) => api.patch<{ candidate: unknown }>(`/api/sourcing-radar/candidates/${id}`, data),
  acceptCandidate: (id: string) => api.post<{ company: unknown; candidate: unknown }>(`/api/sourcing-radar/candidates/${id}/accept`, {}),
  importCSV: (rows: Record<string, string>[]) => api.post<{ inserted: number; duplicates: number; total: number }>('/api/sourcing-radar/import-csv', { rows }),
  getSourcingSummary: () => api.get<unknown>('/api/dashboard/sourcing-summary'),
};

// ─── Performance Systems ─────────────────────────────────────────────────────

export const performanceSystemsApi = {
  getPipelinePressure: () => api.get<PipelinePressureMetrics>('/api/pipeline-pressure'),
  scanPipelinePressure: () => api.post<PipelinePressureMetrics & { tasksCreated?: number; tasks?: unknown[] }>('/api/pipeline-pressure/scan', {}),
  getDealVelocity: () => api.get<{ deals: DealVelocityEntry[]; slowMovingCount: number }>('/api/deal-velocity'),
  getConversationFunnel: () => api.get<ConversationFunnel>('/api/conversation-funnel'),
  getFrequencyProgress: () => api.get<FrequencyProgress>('/api/frequency-progress'),
};

// ─── Meeting Prep ─────────────────────────────────────────────────────────────
export const meetingPrepApi = {
  getPacket: (meetingId: string) => api.get<{ packet: unknown | null }>(`/api/meetings/${meetingId}/prep`),
  generatePacket: (meetingId: string) => api.post<{ packet: unknown }>(`/api/meetings/${meetingId}/prep`, {}),
  updatePacket: (meetingId: string, data: unknown) => api.patch<{ packet: unknown }>(`/api/meetings/${meetingId}/prep`, data),
  getPrepSummary: () => api.get<unknown>('/api/dashboard/prep-summary'),
};

// ─── Deal Probability ─────────────────────────────────────────────────────────
export const dealProbabilityApi = {
  get: (dealId: string) => api.get<unknown>(`/api/deals/${dealId}/probability`),
  refresh: (dealId: string) => api.post<unknown>(`/api/deals/${dealId}/probability/refresh`, {}),
  refreshAll: () => api.post<{ refreshed: number }>('/api/deals/probability/refresh-all', {}),
  getSummary: () => api.get<unknown>('/api/dashboard/probability-summary'),
  getCommentary: (dealId: string) => api.post<unknown>('/api/agents/deal-probability-commentary', { dealId }),
};

// ─── Capital Raising ──────────────────────────────────────────────────────────

export const capitalRaisingApi = {
  // Investor CRM
  listInvestors: (params?: { investorType?: string; relationshipStage?: string; minCheckSize?: number; industry?: string }) => {
    const qs = new URLSearchParams(Object.entries(params || {}).reduce((a, [k, v]) => v != null ? { ...a, [k]: String(v) } : a, {} as Record<string, string>)).toString();
    return api.get<{ investors: unknown[]; total: number }>(`/api/capital-raising/investors${qs ? `?${qs}` : ''}`);
  },
  createInvestor: (data: unknown) => api.post<unknown>('/api/capital-raising/investors', data),
  getInvestor: (id: string) => api.get<unknown>(`/api/capital-raising/investors/${id}`),
  updateInvestor: (id: string, data: unknown) => api.patch<unknown>(`/api/capital-raising/investors/${id}`, data),
  deleteInvestor: (id: string) => api.delete(`/api/capital-raising/investors/${id}`),
  markInterested: (id: string) => api.post<unknown>(`/api/capital-raising/investors/${id}/mark-interested`, {}),

  // Capital Stack
  listStacks: (dealId?: string) => api.get<{ capitalStacks: unknown[] }>(`/api/capital-raising/capital-stacks${dealId ? `?dealId=${dealId}` : ''}`),
  createStack: (data: unknown) => api.post<unknown>('/api/capital-raising/capital-stacks', data),
  getStack: (id: string) => api.get<unknown>(`/api/capital-raising/capital-stacks/${id}`),
  updateStack: (id: string, data: unknown) => api.patch<unknown>(`/api/capital-raising/capital-stacks/${id}`, data),
  deleteStack: (id: string) => api.delete(`/api/capital-raising/capital-stacks/${id}`),

  // Investor Memos
  listMemos: (dealId?: string) => api.get<{ memos: unknown[] }>(`/api/capital-raising/memos${dealId ? `?dealId=${dealId}` : ''}`),
  createMemo: (data: unknown) => api.post<unknown>('/api/capital-raising/memos', data),
  getMemo: (id: string) => api.get<unknown>(`/api/capital-raising/memos/${id}`),
  updateMemo: (id: string, data: unknown) => api.patch<unknown>(`/api/capital-raising/memos/${id}`, data),
  deleteMemo: (id: string) => api.delete(`/api/capital-raising/memos/${id}`),
  generateMemo: (data: unknown) => api.post<unknown>('/api/capital-raising/memos/generate', data),

  // Firm Messaging
  listMessaging: () => api.get<{ firmMessaging: unknown[]; latest: unknown | null }>('/api/capital-raising/messaging'),
  createMessaging: (data: unknown) => api.post<unknown>('/api/capital-raising/messaging', data),
  updateMessaging: (id: string, data: unknown) => api.patch<unknown>(`/api/capital-raising/messaging/${id}`, data),
  generateMission: (data: unknown) => api.post<{ missionStatement: string; investmentThesis: string }>('/api/capital-raising/messaging/generate', data),

  // Pitch Decks
  listDecks: () => api.get<{ pitchDecks: unknown[] }>('/api/capital-raising/pitch-decks'),
  getDeck: (id: string) => api.get<unknown>(`/api/capital-raising/pitch-decks/${id}`),
  saveDeck: (data: unknown) => api.post<unknown>('/api/capital-raising/pitch-decks', data),
  updateDeck: (id: string, data: unknown) => api.patch<unknown>(`/api/capital-raising/pitch-decks/${id}`, data),
  deleteDeck: (id: string) => api.delete(`/api/capital-raising/pitch-decks/${id}`),
  generateDeck: (data: unknown) => api.post<unknown>('/api/capital-raising/pitch-decks/generate', data),

  // Outreach
  generateOutreach: (data: { mode?: string; investorId?: string; investor?: unknown; dealSummary?: unknown; useAI?: boolean }) =>
    api.post<{ subjectDraft: string; emailDraft: string; keyHighlights: string[] }>('/api/capital-raising/outreach/generate', data),

  // Dashboard
  getDashboard: () => api.get<{ pipeline: unknown; capital: unknown }>('/api/capital-raising/dashboard'),
};

// ─── Execution Tracker ────────────────────────────────────────────────────────

export const executionApi = {
  getSummary:          () => api.get<unknown>('/api/execution/summary'),
  getPipelineHealth:   () => api.get<unknown>('/api/execution/pipeline-health'),
  getTargets:          () => api.get<{ targets: unknown }>('/api/execution/targets'),
  updateTarget: (targetType: string, targetValue: number, period?: string) =>
    api.patch<{ targets: unknown }>('/api/execution/targets', { targetType, targetValue, period }),
  getTargetCompletion: () => api.get<unknown>('/api/execution/target-completion'),

  // Daily
  getDaily:     (date?: string) =>
    api.get<{ stat: unknown; targets: unknown }>(`/api/execution/daily${date ? `?date=${date}` : ''}`),
  getDailyHistory: (limit?: number) =>
    api.get<{ stats: unknown[] }>(`/api/execution/daily/history${limit ? `?limit=${limit}` : ''}`),
  recordDaily:  (data: Record<string, number>) =>
    api.post<unknown>('/api/execution/daily', data),

  // Weekly
  getWeekly:    (weekStart?: string) =>
    api.get<{ stat: unknown; targets: unknown }>(`/api/execution/weekly${weekStart ? `?weekStart=${weekStart}` : ''}`),
  updateWeekly: (data: Record<string, unknown>) =>
    api.post<unknown>('/api/execution/weekly', data),

  // Monthly
  getMonthly:   (month?: string) =>
    api.get<{ stat: unknown; targets: unknown }>(`/api/execution/monthly${month ? `?month=${month}` : ''}`),
  updateMonthly: (data: Record<string, unknown>) =>
    api.post<unknown>('/api/execution/monthly', data),

  // Pipeline / Board / Investors / Momentum
  getPipeline:       () => api.get<{ pipeline: unknown; targets: unknown }>('/api/execution/pipeline'),
  getBoard:          () => api.get<{ board: unknown; targets: unknown }>('/api/execution/board'),
  getInvestors:      () => api.get<{ investors: unknown; targets: unknown }>('/api/execution/investors'),
  getDealMomentum:   () => api.get<{ momentum: unknown[]; stalled: unknown[]; cooling: unknown[] }>('/api/execution/deal-momentum'),
  getAlerts:         () => api.get<{ alerts: unknown[] }>('/api/execution/alerts'),
};

// ─── Playbook Engine ──────────────────────────────────────────────────────────

export const playbookApi = {
  getSummary:    () => api.get<unknown>('/api/playbook/summary'),
  getStages:     () => api.get<{ stages: unknown[] }>('/api/playbook/stages'),
  getCurrent:    () => api.get<unknown>('/api/playbook/current'),
  getStage:      (id: string) => api.get<unknown>(`/api/playbook/stages/${id}`),
  getNextTasks:  (limit?: number) =>
    api.get<{ tasks: unknown[] }>(`/api/playbook/next-tasks${limit ? `?limit=${limit}` : ''}`),
  getToday:      () => api.get<unknown>('/api/playbook/today'),
  completeTask:  (taskId: string, notes?: string) =>
    api.post<unknown>(`/api/playbook/tasks/${taskId}/complete`, { notes }),
  updateTaskStatus: (taskId: string, status: string, notes?: string) =>
    api.patch<unknown>(`/api/playbook/tasks/${taskId}/status`, { status, notes }),
  sync:          () => api.post<{ synced: number; message: string }>('/api/playbook/sync', {}),
  getProgress:   () => api.get<{ progress: unknown[] }>('/api/playbook/progress'),
};

// ─── Deal Feed Marketplace ────────────────────────────────────────────────────

import type { DealFeedPage, DealFeedListingDetail, DealFeedSummary, DealFeedFilters, DealFeedImportResult } from './types';

export const dealFeedApi = {
  /** Paginated + filtered listing index (seller contact info redacted). */
  list: (filters?: DealFeedFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      const {
        industry, location, minRevenue, maxRevenue, minYears, maxYears,
        minScore, status, search, sortBy, sortDir, page, pageSize,
      } = filters;
      if (industry)   params.set('industry',   industry);
      if (location)   params.set('location',   location);
      if (minRevenue != null) params.set('minRevenue', String(minRevenue));
      if (maxRevenue != null) params.set('maxRevenue', String(maxRevenue));
      if (minYears   != null) params.set('minYears',   String(minYears));
      if (maxYears   != null) params.set('maxYears',   String(maxYears));
      if (minScore   != null) params.set('minScore',   String(minScore));
      if (status)     params.set('status',     status);
      if (search)     params.set('search',     search);
      if (sortBy)     params.set('sortBy',     sortBy);
      if (sortDir)    params.set('sortDir',    sortDir);
      if (page    != null) params.set('page',     String(page));
      if (pageSize != null) params.set('pageSize', String(pageSize));
    }
    const qs = params.toString();
    return api.get<DealFeedPage>(`/api/deal-feed${qs ? `?${qs}` : ''}`);
  },

  getSummary: () => api.get<DealFeedSummary>('/api/deal-feed/summary'),

  getSaved: (userId = 'default') =>
    api.get<{ saved: unknown[] }>(`/api/deal-feed/saved?userId=${encodeURIComponent(userId)}`),

  /** Full listing with contact info + score breakdown. */
  get: (id: string) => api.get<DealFeedListingDetail>(`/api/deal-feed/${id}`),

  create: (data: unknown) => api.post<{ listing: unknown }>('/api/deal-feed', data),

  update: (id: string, data: unknown) => api.patch<{ listing: unknown }>(`/api/deal-feed/${id}`, data),

  archive: (id: string) => api.delete(`/api/deal-feed/${id}`),

  save: (listingId: string, userId = 'default') =>
    api.post<{ saved: boolean; alreadySaved?: boolean; record?: unknown }>(
      '/api/deal-feed/save',
      { listingId, userId }
    ),

  unsave: (listingId: string, userId = 'default') =>
    api.delete(`/api/deal-feed/save?listingId=${listingId}&userId=${encodeURIComponent(userId)}`),

  import: (listingId: string, userId = 'default') =>
    api.post<DealFeedImportResult>('/api/deal-feed/import', { listingId, userId }),

  ingestCsv: (rows: Record<string, string>[], source = 'csv') =>
    api.post<{ ingested: boolean; created: number; skipped: number; errors: number }>(
      '/api/deal-feed/ingest/csv',
      { rows, source }
    ),

  rescore: (id: string) =>
    api.post<{ score: number; breakdown: unknown[] }>(`/api/deal-feed/${id}/score`, {}),
};

// ─── Relationship Management Engine ──────────────────────────────────────────

import type {
  RelationshipPage,
  RelationshipDashboard,
  Relationship,
  RelationshipInteraction,
  RelationshipFilters,
} from './types';

export const relationshipsApi = {
  getDashboard: () =>
    api.get<RelationshipDashboard>('/api/relationships/dashboard'),

  list: (filters?: RelationshipFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      const { entityType, relationshipStatus, interestLevel, overdue, search, sortBy, sortDir, page, pageSize } = filters;
      if (entityType)         params.set('entityType',         entityType);
      if (relationshipStatus) params.set('relationshipStatus', relationshipStatus);
      if (interestLevel)      params.set('interestLevel',      interestLevel);
      if (overdue != null)    params.set('overdue',            String(overdue));
      if (search)             params.set('search',             search);
      if (sortBy)             params.set('sortBy',             sortBy);
      if (sortDir)            params.set('sortDir',            sortDir);
      if (page     != null)   params.set('page',               String(page));
      if (pageSize != null)   params.set('pageSize',           String(pageSize));
    }
    const qs = params.toString();
    return api.get<RelationshipPage>(`/api/relationships${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    api.get<{ relationship: Relationship; interactions: RelationshipInteraction[]; interactionTotal: number }>(
      `/api/relationships/${id}`
    ),

  create: (data: unknown) =>
    api.post<{ relationship: Relationship }>('/api/relationships', data),

  update: (id: string, data: unknown) =>
    api.patch<{ relationship: Relationship }>(`/api/relationships/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/relationships/${id}`),

  getInteractions: (id: string, limit = 50, offset = 0) =>
    api.get<{ interactions: RelationshipInteraction[]; total: number }>(
      `/api/relationships/${id}/interactions?limit=${limit}&offset=${offset}`
    ),

  logInteraction: (id: string, data: { interactionType: string; interactionSummary?: string }) =>
    api.post<{ interaction: RelationshipInteraction; relationship: Relationship }>(
      `/api/relationships/${id}/interactions`,
      data
    ),

  updateInterestLevel: (id: string, interestLevel: string) =>
    api.patch<{ relationship: Relationship }>(
      `/api/relationships/${id}/interest-level`,
      { interestLevel }
    ),

  scheduleFollowUp: (id: string, daysFromNow: number) =>
    api.post<{ relationship: Relationship }>(
      `/api/relationships/${id}/schedule-followup`,
      { daysFromNow }
    ),

  generateTasks: () =>
    api.post<{ tasksCreated: number }>('/api/relationships/generate-tasks', {}),

  getExecutionCounts: () =>
    api.get<{ ownersContactedThisWeek: number; boardOutreachThisWeek: number; investorConversationsThisWeek: number }>(
      '/api/relationships/execution-counts'
    ),
};

// ─── Conversation KPI System ──────────────────────────────────────────────────

import type {
  ConversationKPIResult,
  ConversationWeeklyReport,
  ConversationPipelineAlert,
  ConversationTargets,
  ConversationPage,
  ConversationFilters,
  RelationshipConversation,
  ConversationTrendWeek,
} from './types';

export const conversationsApi = {
  getKPI: (weekStart?: string) =>
    api.get<ConversationKPIResult>(
      `/api/conversations/kpi${weekStart ? `?weekStart=${weekStart}` : ''}`
    ),

  getWeeklyReport: (weekStart?: string) =>
    api.get<ConversationWeeklyReport>(
      `/api/conversations/weekly-report${weekStart ? `?weekStart=${weekStart}` : ''}`
    ),

  getTrends: (weeks = 8) =>
    api.get<{ trends: ConversationTrendWeek[] }>(`/api/conversations/trends?weeks=${weeks}`),

  getPipelineHealth: () =>
    api.get<{ alerts: ConversationPipelineAlert[] }>('/api/conversations/pipeline-health'),

  getTargets: () =>
    api.get<{ targets: ConversationTargets }>('/api/conversations/targets'),

  setTarget: (entityType: string, weeklyTarget: number) =>
    api.patch<{ targets: ConversationTargets }>('/api/conversations/targets', { entityType, weeklyTarget }),

  list: (filters?: ConversationFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      const { entityType, conversationType, search, dateFrom, dateTo, sortDir, page, pageSize } = filters;
      if (entityType)       params.set('entityType',       entityType);
      if (conversationType) params.set('conversationType', conversationType);
      if (search)           params.set('search',           search);
      if (dateFrom)         params.set('dateFrom',         dateFrom);
      if (dateTo)           params.set('dateTo',           dateTo);
      if (sortDir)          params.set('sortDir',          sortDir);
      if (page     != null) params.set('page',             String(page));
      if (pageSize != null) params.set('pageSize',         String(pageSize));
    }
    const qs = params.toString();
    return api.get<ConversationPage>(`/api/conversations${qs ? `?${qs}` : ''}`);
  },

  record: (data: unknown) =>
    api.post<{ conversation: RelationshipConversation }>('/api/conversations', data),

  update: (id: string, data: unknown) =>
    api.patch<{ conversation: RelationshipConversation }>(`/api/conversations/${id}`, data),

  delete: (id: string) =>
    api.delete(`/api/conversations/${id}`),

  getAgentContext: () =>
    api.get<unknown>('/api/conversations/agent-context'),
};

// ─── Board Intelligence (Spec 3) ──────────────────────────────────────────────

export const boardIntelApi = {
  getSeatHealth: () =>
    api.get<{
      score: number;
      label: string;
      analyzed_seats: unknown[];
      weakest_seat: unknown | null;
      alerts: unknown[];
      components: Record<string, number>;
    }>('/api/board/seats/health'),

  getSeatCandidates: (seatType: string) =>
    api.get<{ seat_type: string; ranked_candidates: unknown[]; best_to_act_on: unknown | null }>(
      `/api/board/seats/${encodeURIComponent(seatType)}/candidates`
    ),

  getCandidateFit: (candidateId: string) =>
    api.get<{ candidate_id: string; fit: unknown; commitment: unknown }>(
      `/api/board/candidates/${candidateId}/fit`
    ),
};

// ─── Network Intelligence (Spec 3) ───────────────────────────────────────────

export const networkApi = {
  getAlerts: () =>
    api.get<{ alerts: unknown[]; critical_count: number; high_count: number; total: number }>(
      '/api/network/alerts'
    ),

  getCommandCenterSummary: () =>
    api.get<{
      weakest_board_seat: unknown;
      best_board_candidate_to_act_on_now: unknown;
      high_value_relationship_cooling: unknown[];
      best_available_warm_intro_path: unknown | null;
      top_investor_opportunity: unknown | null;
      credibility_index: unknown;
      network_leverage_alerts: unknown[];
      critical_alert_count: number;
      high_alert_count: number;
      total_alert_count: number;
    }>('/api/command-center/network'),

  findIntroPaths: (sourceId: string, targetId: string) =>
    api.get<unknown>(`/api/network/intro-paths?sourceId=${sourceId}&targetId=${targetId}`),

  getRelationshipGraph: () =>
    api.get<{ nodes: unknown[]; edges: unknown[]; adjacency_summary: unknown }>(
      '/api/relationships/graph'
    ),

  getHighValueContacts: () =>
    api.get<{ contacts: unknown[]; total: number }>('/api/relationships/high-value'),

  getNetworkContext: (contactId: string) =>
    api.get<unknown>(`/api/relationships/${contactId}/network-context`),

  getNextMove: (contactId: string) =>
    api.post<unknown>(`/api/relationships/${contactId}/next-move`, {}),

  addEdge: (data: unknown) =>
    api.post<{ edge: unknown }>('/api/relationships/edges', data),

  listEdges: () =>
    api.get<{ edges: unknown[] }>('/api/relationships/edges'),
};

// ─── Credibility Index (Spec 3) ───────────────────────────────────────────────

export const credibilityApi = {
  get: () =>
    api.get<{
      score: number;
      label: string;
      components: Record<string, number>;
      downstream: Record<string, unknown>;
      gaps: string[];
    }>('/api/credibility'),
};

// ─── Investor Scoring (Spec 3) ────────────────────────────────────────────────

export const investorScoringApi = {
  getFunnel: () =>
    api.get<{ stages: unknown[]; total: number; active: number }>('/api/investors/funnel'),

  getHighFit: (minFit?: number, limit?: number) => {
    const qs = new URLSearchParams();
    if (minFit  != null) qs.set('minFit',  String(minFit));
    if (limit   != null) qs.set('limit',   String(limit));
    const q = qs.toString();
    return api.get<{ investors: unknown[]; total: number }>(`/api/investors/high-fit${q ? `?${q}` : ''}`);
  },

  getInvestorFit: (investorId: string) =>
    api.get<unknown>(`/api/investors/${investorId}/fit`),

  getReadinessGaps: () =>
    api.get<{ gaps: string[]; gap_count: number; ready: boolean; critical_gaps: string[]; credibility_score: number; credibility_label: string }>(
      '/api/investors/readiness-gaps'
    ),

  getIntroPaths: (investorId: string) =>
    api.get<unknown>(`/api/investors/${investorId}/intro-paths`),
};

// ─── Notifications (Spec 4) ───────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: 'info' | 'watch' | 'important' | 'critical';
  pinned: boolean;
  read_at: string | null;
  dismissed_at: string | null;
  createdAt: string;
  action_label?: string;
  action_url?: string;
  linked_entity_type?: string;
  linked_entity_id?: string;
}

export const notificationsApi = {
  list: (params?: { unread?: boolean; pinned?: boolean; severity?: string; type?: string }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).reduce((a, [k, v]) => v != null ? { ...a, [k]: String(v) } : a, {} as Record<string, string>)
    ).toString();
    return api.get<{ notifications: Notification[]; total: number }>(
      `/api/notifications${qs ? `?${qs}` : ''}`
    );
  },

  markRead: (id: string) =>
    api.post<{ id: string; read_at: string }>(`/api/notifications/${id}/read`, {}),

  dismiss: (id: string) =>
    api.post<{ id: string; dismissed_at: string }>(`/api/notifications/${id}/dismiss`, {}),

  markAllRead: () =>
    api.post<{ marked_read: number }>('/api/notifications/mark-all-read', {}),
};

// ─── Artifacts (Spec 4) ───────────────────────────────────────────────────────

export const artifactsApi = {
  list: (params?: { artifactStatus?: string; artifactType?: string; includeArchived?: boolean }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).reduce((a, [k, v]) => v != null ? { ...a, [k]: String(v) } : a, {} as Record<string, string>)
    ).toString();
    return api.get<{ artifacts: unknown[]; total: number }>(`/api/artifacts${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => api.get<unknown>(`/api/artifacts/${id}`),

  getSummary: (id: string) => api.get<unknown>(`/api/artifacts/${id}/summary`),

  getStaleness: (id: string) => api.get<unknown>(`/api/artifacts/${id}/staleness`),

  getVersions: (id: string) => api.get<{ versions: unknown[]; total: number }>(`/api/artifacts/${id}/versions`),

  generate: (data: {
    artifact_type: string;
    entity_ids?: string[];
    context?: Record<string, unknown>;
    requested_by?: string;
    format?: string;
    approval_required?: boolean;
  }) => api.post<{ artifact: unknown }>('/api/artifacts/generate', data),

  regenerate: (id: string, data?: { requested_by?: string; revision_notes?: string }) =>
    api.post<{ artifact: unknown; previous_version_id: string }>(`/api/artifacts/${id}/regenerate`, data ?? {}),

  archive: (id: string, by: string, reason?: string) =>
    api.post<{ id: string; status: string }>(`/api/artifacts/${id}/archive`, { by, reason }),

  export: (id: string, data: {
    export_type: string;
    requested_by: string;
    destination?: string;
    export_options?: Record<string, unknown>;
  }) => api.post<{ export_id: string; status: string; warnings: string[] }>(`/api/artifacts/${id}/export`, data),

  setApproval: (id: string, data: { approvalStatus: string; reviewedBy: string; reviewNote?: string }) =>
    api.post<unknown>(`/api/artifacts/${id}/approve`, data),
};

// ─── Export Service (Spec 4) ──────────────────────────────────────────────────

export const exportsApi = {
  list: (params?: { status?: string; export_type?: string; stale_only?: boolean }) => {
    const qs = new URLSearchParams(
      Object.entries(params ?? {}).reduce((a, [k, v]) => v != null ? { ...a, [k]: String(v) } : a, {} as Record<string, string>)
    ).toString();
    return api.get<{ exports: unknown[] }>(`/api/exports${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => api.get<unknown>(`/api/exports/${id}`),

  getAudit: (id: string) => api.get<unknown>(`/api/exports/${id}/audit`),

  complete: (id: string, data: { by: string; destination?: string; note?: string }) =>
    api.post<{ export_id: string; status: string; completed_at: string }>(`/api/exports/${id}/complete`, data),

  cancel: (id: string, data: { by: string; reason?: string }) =>
    api.post<{ export_id: string; status: string }>(`/api/exports/${id}/cancel`, data),
};

// ─── Quick Actions (Spec 4) ───────────────────────────────────────────────────

export const quickActionsApi = {
  quickLog: (data: {
    entity_type: 'contact' | 'deal' | 'investor' | 'board_candidate';
    entity_id: string;
    interaction_type: 'call' | 'email' | 'meeting' | 'text' | 'note' | 'linkedin';
    notes?: string;
    sentiment?: string;
    logged_by?: string;
  }) => api.post<{ quick_log: unknown }>('/api/quick-log', data),

  openNextAction: (task_id: string, opened_by?: string) =>
    api.post<{ task_id: string; status: string; started_at: string }>('/api/quick-action/next-action/open', { task_id, opened_by }),

  submitProof: (data: {
    task_id: string;
    proof_type: string;
    proof_url?: string;
    notes?: string;
    submitted_by?: string;
  }) => api.post<{ task_id: string; proof_status: string; submitted_at: string }>('/api/quick-action/proof-submit', data),

  approveAndSend: (data: {
    artifact_id: string;
    approved_by: string;
    export_type: string;
    destination?: string;
    approval_note?: string;
  }) => api.post<{ artifact_id: string; approved: boolean; export_id: string; export_status: string; warnings: string[] }>(
    '/api/quick-action/approve-and-send', data
  ),
};

// ─── Diligence Ingestion ──────────────────────────────────────────────────────

import type {
  DiligenceDocument,
  DiligenceFinding,
  DiligenceSummary,
} from './types';

export const diligenceApi = {
  // Documents
  listDocuments: (dealId: string) =>
    api.get<{ documents: DiligenceDocument[]; total: number }>(
      `/api/diligence/${dealId}/documents`
    ),

  linkDocument: (
    dealId: string,
    data: { fileId: string; documentType: string; displayName: string }
  ) =>
    api.post<{ status: string; doc: DiligenceDocument }>(
      `/api/diligence/${dealId}/documents`,
      data
    ),

  getDocument: (dealId: string, docId: string) =>
    api.get<{ doc: DiligenceDocument }>(`/api/diligence/${dealId}/documents/${docId}`),

  reprocess: (dealId: string, docId: string) =>
    api.post<{ status: string; docId: string }>(
      `/api/diligence/${dealId}/documents/${docId}/reprocess`,
      {}
    ),

  // Findings
  listFindings: (
    dealId: string,
    filters?: { status?: string; severity?: string; category?: string }
  ) => {
    const params = new URLSearchParams();
    if (filters?.status)   params.set('status',   filters.status);
    if (filters?.severity) params.set('severity', filters.severity);
    if (filters?.category) params.set('category', filters.category);
    const qs = params.toString();
    return api.get<{ findings: DiligenceFinding[]; total: number }>(
      `/api/diligence/${dealId}/findings${qs ? `?${qs}` : ''}`
    );
  },

  updateFinding: (
    dealId: string,
    findingId: string,
    data: { status?: string; resolutionNotes?: string }
  ) =>
    api.patch<{ finding: DiligenceFinding }>(
      `/api/diligence/${dealId}/findings/${findingId}`,
      data
    ),

  // Summary
  getSummary: (dealId: string) =>
    api.get<{ summary: DiligenceSummary }>(`/api/diligence/${dealId}/summary`),

  synthesize: (dealId: string) =>
    api.post<{ summary: DiligenceSummary }>(
      `/api/diligence/${dealId}/summary/synthesize`,
      {}
    ),

  getQuestions: (dealId: string) =>
    api.get<{
      questions: {
        seller: string[];
        broker: string[];
        lender: string[];
        attorney: string[];
      };
    }>(`/api/diligence/${dealId}/questions`),

  // Meta
  getDocumentTypes: () =>
    api.get<{ documentTypes: string[] }>('/api/diligence/document-types'),
};

// ─── Monitoring ───────────────────────────────────────────────────────────────
import type { MonitoredEntity, MonitorEvent } from './types';

export const monitoringApi = {
  // Entities
  listEntities: () =>
    api.get<{ entities: MonitoredEntity[]; total: number }>('/api/monitoring/entities'),

  registerEntity: (data: {
    entityType: string;
    entityId: string;
    displayName: string;
    website?: string;
    linkedinUrl?: string;
    checkIntervalMs?: number;
  }) => api.post<{ entity: MonitoredEntity }>('/api/monitoring/entities', data),

  disableEntity: (monitoredEntityId: string) =>
    api.delete(`/api/monitoring/entities/${monitoredEntityId}`),

  triggerCheck: (monitoredEntityId: string) =>
    api.post<{ status: string }>(`/api/monitoring/entities/${monitoredEntityId}/check`, {}),

  // Alerts
  listAlerts: (params?: {
    reviewState?: string;
    severity?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<{ events: MonitorEvent[]; total: number }>(
      `/api/monitoring/alerts${qs ? `?${qs}` : ''}`
    );
  },

  unreadCount: () =>
    api.get<{ count: number }>('/api/monitoring/alerts/unread-count'),

  dismissAll: () =>
    api.post<{ dismissed: number }>('/api/monitoring/alerts/dismiss-all', {}),

  markRead: (eventId: string) =>
    api.patch<{ event: MonitorEvent }>(`/api/monitoring/alerts/${eventId}`, { reviewState: 'read' }),

  dismiss: (eventId: string) =>
    api.patch<{ event: MonitorEvent }>(`/api/monitoring/alerts/${eventId}`, { reviewState: 'dismissed' }),

  convertToTask: (eventId: string, data?: { taskTitle?: string; taskNote?: string }) =>
    api.patch<{ event: MonitorEvent; task: unknown }>(
      `/api/monitoring/alerts/${eventId}`,
      { action: 'convert_task', ...data }
    ),

  alertsByEntity: (entityType: string, entityId: string) =>
    api.get<{ events: MonitorEvent[]; total: number; unread: number }>(
      `/api/monitoring/alerts/by-entity/${entityType}/${entityId}`
    ),
};
