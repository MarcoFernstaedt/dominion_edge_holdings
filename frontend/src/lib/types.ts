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
  lastInteractionAt?: string;
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
  lastInteractionAt?: string;
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
}
