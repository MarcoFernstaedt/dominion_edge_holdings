/**
 * store.js — In-memory runtime store (singleton).
 *
 * ARCHITECTURE NOTE:
 * This store is a temporary runtime layer. The authoritative data is in
 * Postgres/Prisma. For entities with full Prisma-backed repository support,
 * route handlers should call the repository layer directly.
 *
 * This store exists for:
 * 1. Entities not yet migrated to Prisma (deal feed listings, relationships, etc.)
 * 2. Ephemeral runtime state (export jobs, approval queues, notification inbox)
 * 3. Settings cache (loaded from DB on boot, written back on mutation)
 *
 * Do NOT add new domain data here — create a Prisma model and repository instead.
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
