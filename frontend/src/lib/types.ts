// ─── Core Entity Types ────────────────────────────────────────────────────────

export type ID = string;

// ─── Company ─────────────────────────────────────────────────────────────────

export type CompanyStatus =
  | 'target'
  | 'contacted'
  | 'conversation'
  | 'interested'
  | 'diligence'
  | 'under_loi'
  | 'under_contract'
  | 'closed'
  | 'lost'
  | 'archived';

export type PipelinePressureLevel = 'active' | 'cooling' | 'stalled';
export type SellerConversationStatus = 'not_contacted' | 'contacted' | 'conversation_started' | 'meeting_scheduled' | 'negotiation';

export interface Company {
  id: ID;
  name: string;
  industry: string;
  subIndustry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  source?: string;
  status: CompanyStatus;
  estimatedRevenueLow?: number;
  estimatedRevenueHigh?: number;
  estimatedSDELow?: number;
  estimatedSDEHigh?: number;
  yearsInBusiness?: number;
  employeeEstimate?: number;
  ownerName?: string;
  ownerAgeSignal?: string;
  retirementSignal?: boolean;
  noWebsiteSignal?: boolean;
  notes?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  acquisitionScore?: number;
  createdAt: string;
  updatedAt: string;
  // System 1 — Pipeline Pressure
  lastInteractionAt?: string;
  pipelinePressureLevel?: PipelinePressureLevel;
  daysSinceLastInteraction?: number;
  // System 3 — Seller Signal Detection
  reviewDeclineSignal?: boolean;
  websiteOutdatedSignal?: boolean;
  hiringSlowdownSignal?: boolean;
  linkedinInactiveSignal?: boolean;
  sellerSignalScore?: number;
  // System 8 — Owner Conversation Pipeline
  sellerConversationStatus?: SellerConversationStatus;
}

// ─── Contact ──────────────────────────────────────────────────────────────────

export type ContactType =
  | 'seller'
  | 'board_candidate'
  | 'banker'
  | 'attorney'
  | 'cpa'
  | 'capital_partner'
  | 'operator'
  | 'networking_contact'
  | 'vendor'
  | 'employee_candidate';

export type ContactStatus = 'active' | 'inactive' | 'stale' | 'suppressed';

export type RelationshipStage = 'cold' | 'aware' | 'engaged' | 'relationship' | 'trusted';
export type RelationshipWarmth = 'cold' | 'cooling' | 'warm' | 'hot';
export type SellerMotivation = 'retirement' | 'burnout' | 'expansion_capital' | 'family_transition' | 'unknown';
export type SellerTimeline = 'immediate' | '6_months' | '1_year' | 'unknown';

export interface Contact {
  id: ID;
  firstName: string;
  lastName: string;
  fullName: string;
  title?: string;
  companyId?: ID;
  companyName?: string;
  contactType: ContactType;
  email?: string;
  phone?: string;
  linkedinUrl?: string;
  preferredChannel?: string;
  timezone?: string;
  status: ContactStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // System 1 — Pipeline Pressure
  lastInteractionAt?: string;
  pipelinePressureLevel?: PipelinePressureLevel;
  daysSinceLastInteraction?: number;
  // System 2 — Relationship Intelligence
  influenceScore?: number;
  relationshipWarmth?: RelationshipWarmth;
  relationshipStage?: RelationshipStage;
  lastConversationSummary?: string;
  relationshipNotes?: string;
  // System 4 — Conversation Intelligence
  sellerTimeline?: SellerTimeline;
  sellerMotivation?: SellerMotivation;
}

// ─── Interaction ──────────────────────────────────────────────────────────────

export type InteractionType =
  | 'email'
  | 'call'
  | 'meeting'
  | 'note'
  | 'document_sent'
  | 'proposal'
  | 'loi'
  | 'follow_up'
  | 'research';

export interface Interaction {
  id: ID;
  entityType: 'company' | 'contact' | 'deal';
  entityId: ID;
  contactId?: ID;
  interactionType: InteractionType;
  direction: 'inbound' | 'outbound';
  channel?: string;
  subject?: string;
  bodyPreview?: string;
  outcome?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  requiresFollowUp?: boolean;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // System 4 — Conversation Intelligence
  conversationSummary?: string;
  sellerMotivation?: SellerMotivation;
  sellerTimeline?: SellerTimeline;
  sellerConcerns?: string;
  nextConversationGoal?: string;
}

// ─── Deal / Pipeline ─────────────────────────────────────────────────────────

export type DealStage =
  | 'identified'
  | 'contacted'
  | 'discovery'
  | 'financial_review'
  | 'loi_discussion'
  | 'loi_signed'
  | 'due_diligence'
  | 'financing'
  | 'closing'
  | 'closed'
  | 'lost';

export type DealType = 'platform' | 'add_on' | 'board_recruitment_related' | 'networking_only';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Deal {
  id: ID;
  companyId?: ID;
  companyName: string;
  name: string;
  dealType: DealType;
  stage: DealStage;
  source?: string;
  estimatedPurchasePrice?: number;
  estimatedRevenue?: number;
  estimatedSDE?: number;
  askingPrice?: number;
  targetStructure?: string;
  dealThesis?: string;
  status: 'active' | 'stalled' | 'closed' | 'lost';
  riskLevel?: RiskLevel;
  confidenceLevel?: number;
  nextActionDate?: string;
  lastStageChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  // System 1 — Pipeline Pressure
  lastInteractionAt?: string;
  pipelinePressureLevel?: PipelinePressureLevel;
  daysSinceLastInteraction?: number;
  // System 7 — Deal Velocity
  stageEnteredAt?: string;
  stageDurationDays?: number;
  // Deal Probability Scoring
  probabilityScore?: number;
  probabilityBand?: ProbabilityBand;
  probabilityUpdatedAt?: string;
  probabilityFactors?: ProbabilityFactors;
  probabilityNotes?: string;
}

// ─── Performance Systems ─────────────────────────────────────────────────────

export interface PipelinePressureMetrics {
  stalledCompaniesCount: number;
  stalledDealsCount: number;
  stalledContactsCount: number;
  coolingRelationshipsCount: number;
}

export interface AcquisitionScoreboard {
  targetsFound: number;
  ownersContacted: number;
  conversationsStarted: number;
  meetingsHeld: number;
  dealsEvaluated: number;
  LOIsSubmitted: number;
  dealsClosed: number;
  emailsSentThisWeek: number;
  repliesThisWeek: number;
  updatedAt: string;
}

export interface DealVelocityEntry {
  dealId: string;
  companyName: string;
  stage: string;
  stageDurationDays: number;
  threshold: number | null;
  slowMoving: boolean;
}

export interface ConversationFunnel {
  companiesIdentified: number;
  ownersContacted: number;
  repliesReceived: number;
  meetingsScheduled: number;
  dealsProgressing: number;
  emailsSent: number;
  replyRate: number;
  meetingRate: number;
}

export interface FrequencyTarget {
  current: number;
  target: number;
  label: string;
}

export interface FrequencyProgress {
  ownersContactedPerWeek: FrequencyTarget;
  followUpsPerDay: FrequencyTarget;
  boardOutreachPerWeek: FrequencyTarget;
}

// ─── Underwriting ─────────────────────────────────────────────────────────────

export interface UnderwritingScenario {
  id: ID;
  dealId: ID;
  scenarioName: string;
  revenue: number;
  cogs: number;
  opex: number;
  ownerSalaryAdjustments: number;
  oneTimeAdjustments: number;
  personalExpenseAddBacks: number;
  normalizedSDE: number;
  purchasePrice: number;
  downPayment: number;
  seniorDebtAmount: number;
  seniorDebtRate: number;
  seniorDebtTermMonths: number;
  sellerNoteAmount: number;
  sellerNoteRate: number;
  sellerNoteTermMonths: number;
  annualDebtService: number;
  monthlyDebtService: number;
  dscr: number;
  postDebtCashFlowAnnual: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Board ────────────────────────────────────────────────────────────────────

export type BoardSeatStatus = 'open' | 'in_progress' | 'filled';
export type CandidateStatus =
  | 'identified'
  | 'researched'
  | 'outreach_sent'
  | 'meeting_scheduled'
  | 'interested'
  | 'negotiating'
  | 'confirmed'
  | 'passed';

export interface BoardSeat {
  id: ID;
  roleName: string;
  description: string;
  equityRangeLow: number;
  equityRangeHigh: number;
  priorityOrder: number;
  isCoreSeat: boolean;
  status: BoardSeatStatus;
  filledByContactId?: ID;
  filledByName?: string;
  notes?: string;
  color: string;
  whyNeeded: string;
  whereTo: string;
  pitch: string;
}

export interface BoardCandidate {
  id: ID;
  contactId?: ID;
  seatId: ID;
  seatName: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  source?: string;
  status: CandidateStatus;
  score?: number;
  rationale?: string;
  equityOffered?: number;
  bio?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Cap Table ────────────────────────────────────────────────────────────────

export type StakeholderType = 'founder' | 'advisor' | 'operator' | 'future_pool' | 'other';

export interface CapTableEntry {
  id: ID;
  name: string;
  stakeholderType: StakeholderType;
  linkedContactId?: ID;
  equityPercent: number;
  vestingType?: string;
  notes?: string;
  createdAt: string;
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export type CompletionType =
  | 'manual'
  | 'requires-linked-entity'
  | 'requires-document'
  | 'requires-meeting'
  | 'requires-financial-model';

export interface ChecklistItem {
  id: ID;
  phase: string;
  phaseId: string;
  section?: string;
  title: string;
  description?: string;
  whyItMatters?: string;
  completionType: CompletionType;
  isComplete: boolean;
  completedAt?: string;
  evidenceRequired?: boolean;
  evidenceType?: string;
  notes?: string;
  autoGenerateTasks?: boolean;
  sortOrder: number;
}

export interface ChecklistPhase {
  id: string;
  name: string;
  color: string;
  items: ChecklistItem[];
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'archived';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: ID;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  linkedEntityType?: string;
  linkedEntityId?: ID;
  source?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ─── Document ─────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'loi'
  | 'board_invite'
  | 'outreach_letter'
  | 'follow_up_email'
  | 'meeting_agenda'
  | 'meeting_summary'
  | 'deal_memo'
  | 'diligence_checklist'
  | 'board_update'
  | 'post_acquisition_plan';

export type DocumentStatus = 'draft' | 'approved' | 'sent' | 'signed' | 'archived';

export interface Document {
  id: ID;
  entityType?: string;
  entityId?: ID;
  documentType: DocumentType;
  title: string;
  content: string;
  status: DocumentStatus;
  version: number;
  source?: string;
  generatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Inbox / Email ────────────────────────────────────────────────────────────

export type InboxStatus = 'unread' | 'read' | 'replied' | 'archived' | 'needs_reply' | 'waiting';

export interface EmailThread {
  id: ID;
  providerThreadId?: string;
  subject: string;
  participants: string[];
  primaryCompanyId?: ID;
  primaryCompanyName?: string;
  primaryContactId?: ID;
  primaryContactName?: string;
  threadType?: string;
  inboxStatus: InboxStatus;
  lastMessageAt: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  requiresReply: boolean;
  followUpDate?: string;
  isSuppressed: boolean;
  tags: string[];
  preview?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: ID;
  threadId: ID;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  plainText?: string;
  html?: string;
  sentAt: string;
  classification?: string;
  draftStatus?: string;
}

// ─── Outreach ─────────────────────────────────────────────────────────────────

export type CampaignType =
  | 'seller_outreach'
  | 'board_outreach'
  | 'lender_outreach'
  | 'networking_outreach';

export interface OutreachTemplate {
  id: ID;
  name: string;
  templateType: string;
  subjectTemplate: string;
  bodyTemplate: string;
  tone?: string;
  variables: string[];
  isSystemTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Meeting ──────────────────────────────────────────────────────────────────

export type MeetingType =
  | 'seller_discovery'
  | 'seller_followup'
  | 'board_intro'
  | 'banker_intro'
  | 'attorney_intro'
  | 'cpa_intro'
  | 'capital_intro'
  | 'diligence_review'
  | 'post_acquisition_transition'
  | 'internal_planning';

export type MeetingStatus =
  | 'draft'
  | 'proposed'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'no_show';

export type MeetingLocationType = 'phone' | 'google_meet' | 'zoom' | 'in_person' | 'other';

export interface ProposedSlot {
  slotId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  score: number;
  reason: string;
  isAvailable: boolean;
  createdAt: string;
}

export interface Meeting {
  id: ID;
  meetingType: MeetingType;
  title: string;
  status: MeetingStatus;
  source: string;
  timezone?: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  locationType?: MeetingLocationType;
  locationValue?: string;
  linkedEntityType?: string;
  linkedEntityId?: ID;
  linkedDealId?: ID;
  linkedCompanyId?: ID;
  linkedContactIds: ID[];
  proposedSlots: ProposedSlot[];
  selectedSlot?: ProposedSlot;
  agenda?: string;
  meetingNotes?: string;
  summary?: string;
  calendarProviderEventId?: string;
  externalConfirmationStatus?: 'not_needed' | 'pending' | 'confirmed' | 'declined';
  followUpTaskCreated: boolean;
  prepTaskCreated: boolean;
  prepPacketId?: ID;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cancelledAt?: string;
}

// ─── Affirmation ──────────────────────────────────────────────────────────────

export interface Affirmation {
  id: string;
  text: string;
  theme: string;
  isActive: boolean;
  order: number;
}

// ─── Next Best Action ─────────────────────────────────────────────────────────

export type ActionUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface NextBestAction {
  id: string;
  actionType: string;
  title: string;
  whyItMatters: string;
  estimatedTimeMinutes: number;
  linkedEntityType?: string;
  linkedEntityId?: string;
  urgency: ActionUrgency;
  recommendedBy: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: ID;
  type: string;
  title: string;
  message: string;
  linkedEntityType?: string;
  linkedEntityId?: ID;
  isRead: boolean;
  createdAt: string;
}

// ─── Sourcing Radar ───────────────────────────────────────────────────────────

export type AdapterStatus = 'connected' | 'disabled' | 'misconfigured' | 'unreachable' | 'healthy' | 'rate_limited';
export type AdapterType = 'apollo' | 'csv' | 'manual_import' | 'public_directory' | 'custom_api' | 'listing_site';
export type CandidateDedupeStatus = 'unchecked' | 'matched_existing' | 'new_candidate' | 'possible_duplicate';
export type CandidateQualificationStatus = 'unreviewed' | 'qualified' | 'disqualified' | 'needs_manual_review';
export type CandidateReviewStatus = 'pending_review' | 'accepted_to_crm' | 'rejected' | 'archived';
export type RadarRunStatus = 'queued' | 'running' | 'completed' | 'completed_with_warnings' | 'failed';

export interface SourceAdapter {
  id: ID;
  adapterName: string;
  adapterType: AdapterType;
  isEnabled: boolean;
  config: Record<string, unknown>;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  status: AdapterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingRadarRun {
  id: ID;
  startedAt: string;
  completedAt?: string;
  status: RadarRunStatus;
  sourcesAttempted: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  totalCandidatesFound: number;
  newCandidatesInserted: number;
  duplicatesDetected: number;
  warnings: string[];
  errors: string[];
  triggeredBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourcingCandidate {
  id: ID;
  sourceAdapterId: ID;
  externalSourceId?: string;
  name: string;
  industry?: string;
  subIndustry?: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  sourceUrl?: string;
  sourceType: AdapterType;
  yearsInBusiness?: number;
  employeeEstimate?: number;
  ownerName?: string;
  notes?: string;
  normalizedHash: string;
  dedupeStatus: CandidateDedupeStatus;
  qualificationStatus: CandidateQualificationStatus;
  relevanceScore: number;
  reviewStatus: CandidateReviewStatus;
  linkedCompanyId?: ID;
  createdAt: string;
  updatedAt: string;
}

// ─── Meeting Prep Packet ─────────────────────────────────────────────────────

export type PrepGenerationMode = 'deterministic' | 'ai_assisted' | 'hybrid';
export type PrepPacketStatus = 'draft' | 'final' | 'archived';

export interface MeetingPrepPacket {
  id: ID;
  meetingId: ID;
  meetingType: string;
  linkedEntityType?: string;
  linkedEntityId?: ID;
  linkedDealId?: ID;
  linkedCompanyId?: ID;
  linkedContactIds: ID[];
  agenda: string[];
  keyQuestions: string[];
  motivationHypotheses: string[];
  riskFlags: string[];
  meetingObjectives: string[];
  recommendedNextStepTargets: string[];
  generatedBy: string;
  generationMode: PrepGenerationMode;
  status: PrepPacketStatus;
  missingInputs: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Deal Probability ─────────────────────────────────────────────────────────

export type ProbabilityBand = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';

export interface ProbabilityFactors {
  sellerMotivationStrength: number;
  sellerTimelineStrength: number;
  relationshipStrength: number;
  financialTransparency: number;
  responsiveness: number;
  processMomentum: number;
  structureFit: number;
  dealEconomics: number;
  riskPenalty: number;
}

// ─── App Store State ──────────────────────────────────────────────────────────

export interface AppState {
  // Companies
  companies: Company[];
  addCompany: (company: Company) => void;
  updateCompany: (id: ID, updates: Partial<Company>) => void;
  deleteCompany: (id: ID) => void;

  // Contacts
  contacts: Contact[];
  addContact: (contact: Contact) => void;
  updateContact: (id: ID, updates: Partial<Contact>) => void;
  deleteContact: (id: ID) => void;

  // Interactions
  interactions: Interaction[];
  addInteraction: (interaction: Interaction) => void;

  // Deals
  deals: Deal[];
  addDeal: (deal: Deal) => void;
  updateDeal: (id: ID, updates: Partial<Deal>) => void;
  deleteDeal: (id: ID) => void;

  // Underwriting
  underwritingScenarios: UnderwritingScenario[];
  addScenario: (scenario: UnderwritingScenario) => void;
  updateScenario: (id: ID, updates: Partial<UnderwritingScenario>) => void;
  deleteScenario: (id: ID) => void;

  // Board
  boardSeats: BoardSeat[];
  setBoardSeats: (seats: BoardSeat[]) => void;
  boardCandidates: BoardCandidate[];
  addCandidate: (candidate: BoardCandidate) => void;
  updateCandidate: (id: ID, updates: Partial<BoardCandidate>) => void;
  deleteCandidate: (id: ID) => void;
  capTable: CapTableEntry[];
  addCapTableEntry: (entry: CapTableEntry) => void;
  updateCapTableEntry: (id: ID, updates: Partial<CapTableEntry>) => void;
  deleteCapTableEntry: (id: ID) => void;

  // Checklist
  checklistPhases: ChecklistPhase[];
  toggleChecklistItem: (phaseId: string, itemId: ID) => void;

  // Tasks
  tasks: Task[];
  addTask: (task: Task) => void;
  updateTask: (id: ID, updates: Partial<Task>) => void;
  deleteTask: (id: ID) => void;

  // Documents
  documents: Document[];
  addDocument: (doc: Document) => void;
  updateDocument: (id: ID, updates: Partial<Document>) => void;
  deleteDocument: (id: ID) => void;

  // Email Threads
  emailThreads: EmailThread[];
  addEmailThread: (thread: EmailThread) => void;
  updateEmailThread: (id: ID, updates: Partial<EmailThread>) => void;

  // Meetings
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: ID, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: ID) => void;

  // Meeting Prep Packets
  meetingPrepPackets: MeetingPrepPacket[];
  addMeetingPrepPacket: (packet: MeetingPrepPacket) => void;
  updateMeetingPrepPacket: (id: ID, updates: Partial<MeetingPrepPacket>) => void;

  // Sourcing Radar
  sourcingCandidates: SourcingCandidate[];
  addSourcingCandidate: (c: SourcingCandidate) => void;
  updateSourcingCandidate: (id: ID, updates: Partial<SourcingCandidate>) => void;
  sourceAdapters: SourceAdapter[];
  setSourceAdapters: (adapters: SourceAdapter[]) => void;
  sourcingRadarRuns: SourcingRadarRun[];
  addSourcingRadarRun: (run: SourcingRadarRun) => void;

  // Outreach Templates
  outreachTemplates: OutreachTemplate[];
  addOutreachTemplate: (template: OutreachTemplate) => void;
  updateOutreachTemplate: (id: ID, updates: Partial<OutreachTemplate>) => void;

  // Notifications
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  markNotificationRead: (id: ID) => void;
  clearAllNotifications: () => void;

  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Affirmations
  currentAffirmationIndex: number;
  setAffirmationIndex: (idx: number) => void;

  // Capital Raising
  investors: Investor[];
  addInvestor: (i: Investor) => void;
  updateInvestor: (id: ID, updates: Partial<Investor>) => void;
  deleteInvestor: (id: ID) => void;
  capitalStacks: CapitalStack[];
  addCapitalStack: (s: CapitalStack) => void;
  updateCapitalStack: (id: ID, updates: Partial<CapitalStack>) => void;
  investorMemos: InvestorMemo[];
  addInvestorMemo: (m: InvestorMemo) => void;
  updateInvestorMemo: (id: ID, updates: Partial<InvestorMemo>) => void;
  deleteInvestorMemo: (id: ID) => void;
  firmMessaging: FirmMessaging[];
  addFirmMessaging: (f: FirmMessaging) => void;
  updateFirmMessaging: (id: ID, updates: Partial<FirmMessaging>) => void;
  pitchDecks: PitchDeck[];
  addPitchDeck: (d: PitchDeck) => void;
  updatePitchDeck: (id: ID, updates: Partial<PitchDeck>) => void;
  deletePitchDeck: (id: ID) => void;
}

// ─── Capital Raising ──────────────────────────────────────────────────────────

export type InvestorType =
  | 'angel' | 'family_office' | 'private_equity' | 'operator_investor'
  | 'private_lender' | 'bank' | 'search_fund_investor';

export type InvestorRelationshipStage = 'cold' | 'aware' | 'engaged' | 'relationship' | 'active_investor';

export interface Investor {
  id: ID;
  name: string;
  organization: string;
  investorType: InvestorType;
  email: string;
  phone: string;
  location: string;
  checkSizeMin: number | null;
  checkSizeMax: number | null;
  industriesPreferred: string[];
  dealStagePreference: string;
  riskTolerance: string;
  priorDeals: string;
  relationshipStage: InvestorRelationshipStage;
  notes: string;
  lastInteractionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CapitalStack {
  id: ID;
  dealId: ID | null;
  purchasePrice: number;
  seniorDebtAmount: number;
  sellerNoteAmount: number;
  equityRequired: number;
  operatorEquity: number;
  investorEquity: number;
  committedInvestorEquity: number;
  equityStillNeeded: number;
  debtInterestRate: number;
  debtTermMonths: number;
  sellerNoteRate: number;
  sellerNoteTermMonths: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorMemo {
  id: ID;
  dealId: ID | null;
  title: string;
  summary: string;
  purchasePrice: number;
  revenue: number;
  ebitda: number;
  dealStructure: string;
  expectedReturns: string;
  riskFactors: string;
  operatorBackground: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirmMessaging {
  id: ID;
  missionStatement: string;
  investmentThesis: string;
  targetIndustries: string[];
  targetDealSize: string;
  geographicFocus: string;
  valueCreationStrategy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PitchSlide {
  title: string;
  bulletPoints: string[];
  speakerNotes: string;
}

export interface PitchDeck {
  id: ID;
  firmMessagingId: ID | null;
  deckTitle: string;
  slides: PitchSlide[];
  createdAt: string;
  updatedAt: string;
}

export interface InvestorPipeline {
  identified: number;
  contacted: number;
  conversations: number;
  meetings: number;
  commitments: number;
}

export interface CapitalSummary {
  purchasePrice: number;
  equityRequired: number;
  equityCommitted: number;
  equityRemaining: number;
}

// ─── Execution Tracker ────────────────────────────────────────────────────────

export type MomentumRiskLevel = 'healthy' | 'warming' | 'cooling' | 'stalled';

export interface ExecutionDailyStat {
  id: ID;
  date: string;
  ownersCalled: number;
  ownersEmailed: number;
  ownersLinkedIn: number;
  ownersTotalContacted: number;
  ownerConversations: number;
  meetingsScheduled: number;
  loisSent: number;
  investorConversations: number;
  boardOutreach: number;
  boardMeetings: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionWeeklyStat {
  id: ID;
  weekStartDate: string;
  ownersContacted: number;
  ownerConversations: number;
  meetingsScheduled: number;
  investorConversations: number;
  boardMeetings: number;
  loisSent: number;
  companiesAdded: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionMonthlyStat {
  id: ID;
  month: string;
  ownersContacted: number;
  ownerConversations: number;
  meetingsScheduled: number;
  investorConversations: number;
  boardMeetings: number;
  loisSent: number;
  dealsOpened: number;
  dealsClosed: number;
  createdAt: string;
  updatedAt: string;
}

export interface QlaTarget {
  id: ID;
  targetType: string;
  targetValue: number;
  period: string;
}

export interface QlaTargets {
  daily_owner_calls: number;
  weekly_owner_contacts: number;
  weekly_investor_calls: number;
  monthly_lois: number;
  pipeline_companies: number;
  pipeline_owners_contacted: number;
  pipeline_conversations: number;
  pipeline_opportunities: number;
  pipeline_lois: number;
  pipeline_closed: number;
  board_target_min: number;
  board_target_max: number;
  investor_identified_min: number;
}

export interface AcquisitionPipelineStat {
  id: ID;
  totalCompanies: number;
  ownersContacted: number;
  ownerConversations: number;
  seriousOpportunities: number;
  loisSent: number;
  loisAccepted: number;
  dealsClosed: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoardRecruitmentStat {
  id: ID;
  candidatesIdentified: number;
  candidatesContacted: number;
  callsScheduled: number;
  boardMembersSecured: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvestorPipelineStat {
  id: ID;
  investorsIdentified: number;
  investorsContacted: number;
  investorMeetings: number;
  softCommitments: number;
  hardCommitments: number;
  createdAt: string;
  updatedAt: string;
}

export interface DealMomentumStat {
  id: ID;
  dealId: ID;
  dealName: string;
  companyName: string;
  stage: string;
  lastOwnerContactDate: string | null;
  lastMeetingDate: string | null;
  lastFinancialReviewDate: string | null;
  lastFollowUpDate: string | null;
  daysSinceLastContact: number | null;
  daysSinceLastMeeting: number | null;
  momentumScore: number;
  riskLevel: MomentumRiskLevel;
  nextActionRequired: string;
  interactionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionAlert {
  level: 'warning' | 'critical';
  message: string;
}

export interface ExecutionSummary {
  targets: QlaTargets;
  today: ExecutionDailyStat;
  week: ExecutionWeeklyStat;
  month: ExecutionMonthlyStat;
  pipeline: AcquisitionPipelineStat;
  board: BoardRecruitmentStat;
  investors: InvestorPipelineStat;
  momentum: DealMomentumStat[];
  alerts: ExecutionAlert[];
}

// ─── Playbook Engine ──────────────────────────────────────────────────────────

export type PlaybookTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped';
export type PlaybookCompletionType = 'manual' | 'automatic' | 'hybrid';
export type PlaybookCompletionMode = 'tasks' | 'metrics' | 'hybrid';

export interface PlaybookStage {
  id: ID;
  stageOrder: number;
  stageName: string;
  description: string;
  completionMode: PlaybookCompletionMode;
  metricRequirements?: Record<string, number>;
  createdAt: string;
  updatedAt: string;
  // Augmented by API (GET /api/playbook/stages adds completion; pages compute isComplete/isCurrent)
  completion?: StageCompletion;
  isComplete?: boolean;
  isCurrent?: boolean;
}

export interface PlaybookTask {
  id: ID;
  stageId: ID;
  taskTitle: string;
  taskDescription: string;
  taskCategory: string;
  taskOrder: number;
  estimatedEffortMinutes: number;
  completionType: PlaybookCompletionType;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookProgress {
  id: ID;
  taskId: ID;
  status: PlaybookTaskStatus;
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetricRequirementCheck {
  label: string;
  actual: number;
  required: number;
  met: boolean;
}

export interface StageCompletion {
  complete: boolean;
  taskPct: number;
  completed: number;
  tasks: number;
  metricsMet: {
    allMet: boolean;
    requirements: MetricRequirementCheck[];
  };
}

export interface PlaybookTaskWithProgress {
  task: PlaybookTask;
  status: PlaybookTaskStatus;
  completedAt: string | null;
  notes: string | null;
  stage?: PlaybookStage;
}

export interface DailyAction {
  source: 'playbook' | 'execution' | 'momentum' | 'stage' | 'alert';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  taskId: ID | null;
  stageId: ID | null;
  stageName: string | null;
  dealId?: ID;
  effortMin?: number;
  estimatedMinutes?: number; // alias used by some pages
  relatedEntity?: string;    // optional label for the related record
}

export interface DailyActionPlan {
  stageName: string;
  stageId: ID;
  actions: DailyAction[];
  generatedAt: string;
  // Aliases for pages that reference these names
  currentStage?: string;
  date?: string;
}

export interface PlaybookSummary {
  currentStage: PlaybookStage;
  stagesCompleted: number;
  totalStages: number;
  completion: StageCompletion;
  allComplete: boolean;
  nextTasks: PlaybookTaskWithProgress[];
  overallProgress: number;
}

export interface AppSettings {
  reducedMotion: boolean;
  highContrast: boolean;
  density: 'compact' | 'standard' | 'spacious';
  keyboardShortcutsEnabled: boolean;
  aiDraftingEnabled: boolean;
  aiReplyEnabled: boolean;
  aiBriefingEnabled: boolean;
  primaryModel: string;
  apiUrl: string;
  emailMode: 'smtp_only' | 'imap_smtp' | 'gmail_api';
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  fromName: string;
  fromEmail: string;
  // Sourcing Radar
  sourcingRadarEnabled?: boolean;
  sourcingTargetIndustries?: string[];
  sourcingTargetStates?: string[];
  sourcingMinRelevanceThreshold?: number;
  sourcingNotifyHighPriority?: boolean;
  // Meeting Prep
  autoGeneratePrepPackets?: boolean;
  enableMeetingPrepAI?: boolean;
  prepPacketReminderHours?: number;
  // Deal Probability
  enableProbabilityScoring?: boolean;
  enableDealProbabilityCommentary?: boolean;
  probabilityHighThreshold?: number;
  probabilityLowRescueThreshold?: number;
}

// ─── Deal Feed Marketplace ────────────────────────────────────────────────────

export type DealFeedListingStatus = 'active' | 'archived' | 'imported';

export interface DealFeedListing {
  id: ID;
  companyName: string;
  industry: string;
  location: string;
  revenueEstimate: number | null;
  ebitdaEstimate: number | null;
  yearsInBusiness: number | null;
  listingPrice: number | null;
  source: string;
  sourceUrl: string;
  /** Redacted in list view — only visible in detail view */
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  listingStatus: DealFeedListingStatus;
  acquisitionScore: number;
  ownerRetirementSignal: boolean;
  noWebsiteSignal: boolean;
  notes: string;
  externalId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealFeedScoreBreakdownItem {
  factor: string;
  maxPts: number;
  pts: number;
}

export interface DealFeedListingDetail {
  listing: DealFeedListing;
  scoreBreakdown: DealFeedScoreBreakdownItem[];
}

export interface SavedListing {
  id: ID;
  userId: string;
  listingId: ID;
  savedAt: string;
  listing: DealFeedListing | null;
}

export interface DealFeedPage {
  listings: DealFeedListing[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DealFeedFilters {
  industry?: string;
  location?: string;
  minRevenue?: number;
  maxRevenue?: number;
  minYears?: number;
  maxYears?: number;
  minScore?: number;
  status?: DealFeedListingStatus | 'all';
  search?: string;
  sortBy?: 'acquisitionScore' | 'createdAt' | 'revenueEstimate' | 'listingPrice' | 'yearsInBusiness';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface DealFeedSummary {
  totalListings: number;
  activeListings: number;
  savedListings: number;
  importedListings: number;
  avgScore: number;
  topListings: DealFeedListing[];
  industryBreakdown: { industry: string; count: number }[];
  scoreDistribution: Record<string, number>;
}

export interface DealFeedImportResult {
  company: unknown;
  deal: unknown | null;
  listing: DealFeedListing;
  alreadyImported: boolean;
}

// ─── Relationship Management Engine ──────────────────────────────────────────

export type RelationshipEntityType = 'seller' | 'board_member' | 'investor';

export type RelationshipStatus =
  | 'new'
  | 'warming'
  | 'active'
  | 'long_term'
  | 'closed'
  | 'not_interested';

export type InterestLevel = 'low' | 'medium' | 'high' | 'ready';

export type RelationshipInteractionType = 'call' | 'email' | 'meeting' | 'note';

export interface Relationship {
  id: ID;
  entityType: RelationshipEntityType;
  entityId: string;
  name: string;
  company: string;
  relationshipStatus: RelationshipStatus;
  interestLevel: InterestLevel;
  lastContactDate: string | null;
  nextFollowUpDate: string;
  followUpFrequencyDays: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipInteraction {
  id: ID;
  relationshipId: ID;
  interactionType: RelationshipInteractionType;
  interactionSummary: string;
  createdAt: string;
}

export interface RelationshipDashboard {
  overdueSellers: Relationship[];
  overdueBoardMembers: Relationship[];
  overdueInvestors: Relationship[];
  overdueTotal: number;
  upcoming: Relationship[];
  summary: {
    total: number;
    sellers: number;
    boardMembers: number;
    investors: number;
    active: number;
    longTerm: number;
    new: number;
    highInterest: number;
  };
}

export interface RelationshipPage {
  relationships: Relationship[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RelationshipFilters {
  entityType?: RelationshipEntityType;
  relationshipStatus?: RelationshipStatus;
  interestLevel?: InterestLevel;
  overdue?: boolean;
  search?: string;
  sortBy?: 'nextFollowUpDate' | 'lastContactDate' | 'createdAt' | 'name';
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

// ─── Conversation KPI System ──────────────────────────────────────────────────

export type ConversationEntityType = 'seller' | 'board_member' | 'investor';
export type ConversationType = 'phone' | 'zoom' | 'meeting' | 'email_thread';
export type KPIStatus = 'on_target' | 'at_risk' | 'below_target';

export interface RelationshipConversation {
  id: ID;
  entityType: ConversationEntityType;
  entityId: string;
  entityName: string;
  company: string;
  conversationType: ConversationType;
  conversationSummary: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationKPIItem {
  entityType: ConversationEntityType;
  count: number;
  target: number;
  pct: number;
  status: KPIStatus;
}

export interface ConversationKPIResult {
  weekStart: string;
  items: ConversationKPIItem[];
  overallStatus: KPIStatus;
}

export interface ConversationTrendWeek {
  weekStart: string;
  seller: number;
  board_member: number;
  investor: number;
}

export interface ConversationPipelineAlert {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  message: string;
  type: ConversationEntityType;
  action: string;
}

export interface ConversationWeeklyReport {
  weekStart: string;
  kpi: ConversationKPIResult;
  monthly: { month: string; seller: number; board_member: number; investor: number; total: number };
  alerts: ConversationPipelineAlert[];
  conversions: { toOpportunities: number; toDeals: number };
}

export interface ConversationTargets {
  seller: number;
  board_member: number;
  investor: number;
}

export interface ConversationPage {
  conversations: RelationshipConversation[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ConversationFilters {
  entityType?: ConversationEntityType;
  conversationType?: ConversationType;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
