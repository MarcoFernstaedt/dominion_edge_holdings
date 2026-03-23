/**
 * store.js — In-memory runtime store (singleton).
 *
 * ARCHITECTURE: DEV/TEST ONLY for HTTP routes.
 *
 * Production entry point (src/index.js → src/app.js) routes all HTTP traffic
 * through Prisma-backed repositories in src/repositories/. Those paths NEVER
 * read from or write to this store.
 *
 * This store is retained for:
 *   1. Background jobs that have not yet been migrated to DB-backed storage
 *      (deal feed listings, sourcing radar, relationship graph).
 *   2. The legacy server.js entry point used by integration tests (no-DB path).
 *   3. Ephemeral, non-persistent runtime state (export queue, approval inbox)
 *      that intentionally resets on process restart.
 *
 * Rules:
 *   - HTTP route handlers in src/controllers/ MUST NOT import this file.
 *   - Do NOT add new domain entities here — create a Prisma model + repository.
 *   - The db/repo.js HAS_DB fallback may read this store; those reads are
 *     for the no-DB dev/test path only and must not run in production.
 */

const store = {
  companies:    [],
  contacts:     [],
  interactions: [],
  deals:        [],
  underwritingScenarios: [],
  boardSeats:   [],
  boardCandidates: [],
  capTable:     [],
  checklistPhases: [],
  tasks:        [],
  documents:    [],
  emailThreads: [],
  outreachTemplates: [],
  meetings:     [],
  notifications: [],

  // Sourcing Radar
  sourceAdapters:         [],
  sourcingRadarRuns:      [],
  sourcingRadarCandidates: [],

  // Meeting Prep
  meetingPrepPackets: [],

  // Negotiation Coach (QLA Step 10)
  negotiationSessions: [],
  callRecaps:          [],

  // Capital Raising
  investors:     [],
  capitalStacks: [],
  investorMemos: [],
  firmMessaging: [],
  pitchDecks:    [],

  // Execution Tracker
  executionDailyStats:   [],
  executionWeeklyStats:  [],
  executionMonthlyStats: [],
  qlaTargets:            [],
  dealMomentumStats:     [],

  // Playbook Engine
  playbookStages:   [],
  playbookTasks:    [],
  playbookProgress: [],

  // Deal Feed Marketplace
  dealFeedListings: [],
  savedListings:    [],

  // Relationship Management Engine
  relationships:            [],
  relationshipInteractions: [],
  relationshipEdges:        [],

  // Conversation KPI System
  relationshipConversations: [],
  conversationTargets:       [],
  _metrics: {},

  settings: {
    fromName:     '',
    fromEmail:    '',
    smtpHost:     '',
    smtpPort:     587,
    smtpUser:     '',
    emailMode:    'smtp_only',
    primaryModel: 'claude-haiku-4-5-20251001',
    reducedMotion:               false,
    highContrast:                false,
    keyboardShortcutsEnabled:    true,
    density:                     'standard',
    aiDraftingEnabled:           true,
    aiReplyEnabled:              true,
    aiBriefingEnabled:           true,
    enableAIOutreachDrafts:      true,
    enableAIReplySuggestions:    true,
    enableDealAnalysis:          true,
    enableStrategyInsights:      true,
    ownersContactedPerWeek:      25,
    followUpsPerDay:             5,
    boardOutreachPerWeek:        3,
    sourcingRadarEnabled:        true,
    sourcingTargetIndustries:    [],
    sourcingTargetStates:        [],
    sourcingMinRelevanceThreshold: 50,
    sourcingNotifyHighPriority:  true,
    autoGeneratePrepPackets:     true,
    enableMeetingPrepAI:         true,
    prepPacketReminderHours:     24,
    enableProbabilityScoring:    true,
    enableDealProbabilityCommentary: true,
    probabilityHighThreshold:    60,
    probabilityLowRescueThreshold: 30,
    // Targets (System 6)
    weeklyOwnerContactTarget:    25,
    weeklyBoardOutreachTarget:   3,
    weeklyInvestorOutreachTarget: 5,
  },
};

export default store;
