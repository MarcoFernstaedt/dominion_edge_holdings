/**
 * Centralised Zod schemas for all API request validation.
 * Import from here instead of defining schemas inline in server.js.
 */
import { z } from 'zod';

// ─── Shared field validators ──────────────────────────────────────────────────

const optionalUuid   = z.string().uuid().optional().or(z.literal(''));
const optionalEmail  = z.string().email().optional().or(z.literal(''));
const optionalDatetime = z.string().datetime().optional().or(z.literal(''));
const priorityEnum   = z.enum(['critical', 'high', 'medium', 'low']);
const pressureEnum   = z.enum(['active', 'cooling', 'stalled']);

/** Common pipeline-pressure fields shared by Company, Contact and Deal. */
const pipelinePressureFields = {
  lastInteractionAt:        optionalDatetime,
  pipelinePressureLevel:    pressureEnum.optional(),
  daysSinceLastInteraction: z.number().min(0).optional(),
};

// ─── CRM ──────────────────────────────────────────────────────────────────────

export const CompanySchema = z.object({
  name:                  z.string().min(1).max(200).trim(),
  industry:              z.string().max(100).trim().optional(),
  subIndustry:           z.string().max(100).trim().optional(),
  website:               z.string().url().optional().or(z.literal('')),
  phone:                 z.string().max(30).trim().optional(),
  email:                 optionalEmail,
  city:                  z.string().max(100).trim().optional(),
  state:                 z.string().max(50).trim().optional(),
  ownerName:             z.string().max(200).trim().optional(),
  estimatedRevenueLow:   z.number().min(0).optional(),
  estimatedRevenueHigh:  z.number().min(0).optional(),
  estimatedSDELow:       z.number().min(0).optional(),
  estimatedSDEHigh:      z.number().min(0).optional(),
  yearsInBusiness:       z.number().min(0).max(500).optional(),
  notes:                 z.string().max(5000).trim().optional(),
  priority:              priorityEnum.optional(),
  source:                z.string().max(100).trim().optional(),
  status:                z.enum(['target', 'contacted', 'conversation', 'interested', 'diligence', 'under_loi', 'under_contract', 'closed', 'lost', 'archived']).optional(),
  // Seller signal detection
  retirementSignal:       z.boolean().optional(),
  noWebsiteSignal:        z.boolean().optional(),
  reviewDeclineSignal:    z.boolean().optional(),
  websiteOutdatedSignal:  z.boolean().optional(),
  hiringSlowdownSignal:   z.boolean().optional(),
  linkedinInactiveSignal: z.boolean().optional(),
  sellerSignalScore:      z.number().min(0).max(10).optional(),
  // Owner conversation pipeline
  sellerConversationStatus: z.enum(['not_contacted', 'contacted', 'conversation_started', 'meeting_scheduled', 'negotiation']).optional(),
  ...pipelinePressureFields,
});

export const ContactSchema = z.object({
  firstName:               z.string().min(1).max(100).trim(),
  lastName:                z.string().max(100).trim().optional(),
  title:                   z.string().max(200).trim().optional(),
  companyId:               optionalUuid,
  contactType:             z.enum(['seller', 'board_candidate', 'banker', 'attorney', 'cpa', 'capital_partner', 'operator', 'networking_contact', 'vendor', 'employee_candidate']).optional(),
  email:                   optionalEmail,
  phone:                   z.string().max(30).trim().optional(),
  notes:                   z.string().max(5000).trim().optional(),
  // Relationship intelligence
  influenceScore:          z.number().min(1).max(10).optional(),
  relationshipWarmth:      z.enum(['cold', 'cooling', 'warm', 'hot']).optional(),
  relationshipStage:       z.enum(['cold', 'aware', 'engaged', 'relationship', 'trusted']).optional(),
  lastConversationSummary: z.string().max(2000).trim().optional(),
  relationshipNotes:       z.string().max(5000).trim().optional(),
  ...pipelinePressureFields,
});

export const InteractionSchema = z.object({
  type:                z.enum(['email', 'call', 'meeting', 'note', 'document_sent', 'proposal', 'loi', 'follow_up', 'research']),
  direction:           z.enum(['inbound', 'outbound', 'internal']).optional(),
  companyId:           optionalUuid,
  contactId:           optionalUuid,
  dealId:              optionalUuid,
  subject:             z.string().max(500).trim().optional(),
  notes:               z.string().max(10000).trim().optional(),
  outcome:             z.string().max(500).trim().optional(),
  requiresFollowUp:    z.boolean().optional(),
  followUpDate:        optionalDatetime,
  // Conversation intelligence
  conversationSummary:  z.string().max(5000).trim().optional(),
  sellerMotivation:     z.enum(['retirement', 'burnout', 'expansion_capital', 'family_transition', 'unknown']).optional(),
  sellerTimeline:       z.enum(['immediate', '6_months', '1_year', 'unknown']).optional(),
  sellerConcerns:       z.string().max(2000).trim().optional(),
  nextConversationGoal: z.string().max(1000).trim().optional(),
});

export const DealSchema = z.object({
  companyName:           z.string().min(1).max(200).trim(),
  companyId:             optionalUuid,
  dealType:              z.enum(['platform', 'add_on', 'other']).optional(),
  estimatedRevenue:      z.number().min(0).optional(),
  estimatedSDE:          z.number().min(0).optional(),
  askingPrice:           z.number().min(0).optional(),
  notes:                 z.string().max(10000).trim().optional(),
  dealThesis:            z.string().max(2000).trim().optional(),
  riskLevel:             z.enum(['low', 'medium', 'high', 'critical']).optional(),
  confidenceLevel:       z.number().min(0).max(100).optional(),
  source:                z.string().max(100).trim().optional(),
  // Deal velocity
  stage:                 z.string().max(50).trim().optional(),
  status:                z.string().max(50).trim().optional(),
  stageEnteredAt:        optionalDatetime,
  stageDurationDays:     z.number().min(0).optional(),
  // Deal probability
  probabilityScore:      z.number().min(0).max(100).optional(),
  probabilityBand:       z.enum(['very_low', 'low', 'medium', 'high', 'very_high']).optional(),
  probabilityUpdatedAt:  optionalDatetime,
  probabilityNotes:      z.string().max(1000).trim().optional(),
  ...pipelinePressureFields,
});

export const TaskSchema = z.object({
  title:            z.string().min(1).max(500).trim(),
  description:      z.string().max(5000).trim().optional(),
  priority:         priorityEnum.optional(),
  dueDate:          optionalDatetime,
  linkedEntityType: z.string().max(50).trim().optional(),
  linkedEntityId:   optionalUuid,
  status:           z.enum(['todo', 'in_progress', 'blocked', 'done', 'archived']).optional(),
});

export const BoardCandidateSchema = z.object({
  name:           z.string().min(1).max(200).trim(),
  seatId:         optionalUuid,
  source:         z.string().max(200).trim().optional(),
  status:         z.enum(['identified', 'researched', 'outreach_sent', 'meeting_scheduled', 'interested', 'negotiating', 'confirmed', 'passed']).optional(),
  equityOffered:  z.number().min(0).max(100).optional(),
  bio:            z.string().max(5000).trim().optional(),
  notes:          z.string().max(5000).trim().optional(),
});

export const DocumentSchema = z.object({
  title:        z.string().min(1).max(500).trim(),
  content:      z.string().max(100000),
  documentType: z.enum(['loi', 'board_invite', 'outreach_letter', 'follow_up_email', 'meeting_agenda', 'meeting_summary', 'deal_memo', 'diligence_checklist', 'board_update', 'post_acquisition_plan']),
  entityType:   z.string().max(50).optional(),
  entityId:     optionalUuid,
  status:       z.enum(['draft', 'approved', 'sent', 'signed', 'archived']).optional(),
});

export const ComposeSchema = z.object({
  to:        z.string().email(),
  subject:   z.string().min(1).max(1000).trim(),
  body:      z.string().max(50000).optional(),
  companyId: optionalUuid,
  contactId: optionalUuid,
});

export const SettingsPatchSchema = z.object({
  fromName:                z.string().max(200).trim().optional(),
  fromEmail:               optionalEmail,
  smtpHost:                z.string().max(300).trim().optional(),
  smtpPort:                z.number().int().min(1).max(65535).optional(),
  smtpUser:                z.string().max(300).trim().optional(),
  emailMode:               z.enum(['smtp_only', 'imap_smtp', 'gmail_api']).optional(),
  primaryModel:            z.string().max(100).trim().optional(),
  reducedMotion:           z.boolean().optional(),
  highContrast:            z.boolean().optional(),
  keyboardShortcutsEnabled:z.boolean().optional(),
  density:                 z.enum(['compact', 'standard', 'spacious']).optional(),
  aiDraftingEnabled:       z.boolean().optional(),
  aiReplyEnabled:          z.boolean().optional(),
  aiBriefingEnabled:       z.boolean().optional(),
  // Contact frequency targets
  ownersContactedPerWeek:  z.number().int().min(0).max(500).optional(),
  followUpsPerDay:         z.number().int().min(0).max(100).optional(),
  boardOutreachPerWeek:    z.number().int().min(0).max(100).optional(),
  // Sourcing radar
  sourcingRadarEnabled:            z.boolean().optional(),
  sourcingTargetIndustries:        z.array(z.string().max(100)).max(10).optional(),
  sourcingTargetStates:            z.array(z.string().max(50)).max(60).optional(),
  sourcingMinRelevanceThreshold:   z.number().int().min(0).max(100).optional(),
  sourcingNotifyHighPriority:      z.boolean().optional(),
  // Meeting prep
  autoGeneratePrepPackets:   z.boolean().optional(),
  enableMeetingPrepAI:       z.boolean().optional(),
  prepPacketReminderHours:   z.number().int().min(1).max(168).optional(),
  // Deal probability
  enableProbabilityScoring:        z.boolean().optional(),
  enableDealProbabilityCommentary: z.boolean().optional(),
  probabilityHighThreshold:        z.number().int().min(0).max(100).optional(),
  probabilityLowRescueThreshold:   z.number().int().min(0).max(100).optional(),
}).strict();

export const UnderwritingCalcSchema = z.object({
  netIncome:            z.number().finite().optional().default(0),
  ownerSalary:          z.number().finite().optional().default(0),
  personalAddbacks:     z.number().finite().optional().default(0),
  oneTimeAdjustments:   z.number().finite().optional().default(0),
  marketRateManagement: z.number().finite().optional().default(0),
  askingPrice:          z.number().min(0).finite().optional().default(0),
  downPaymentPct:       z.number().min(0).max(100).optional().default(10),
  sellerNotePct:        z.number().min(0).max(100).optional().default(0),
  seniorDebtRatePct:    z.number().min(0).max(50).optional().default(6.5),
  seniorDebtTermMonths: z.number().int().min(1).max(360).optional().default(120),
  sellerNoteRatePct:    z.number().min(0).max(50).optional().default(6),
  sellerNoteTermMonths: z.number().int().min(1).max(360).optional().default(60),
});

export const ChatSchema = z.object({
  messages: z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().max(20000),
  })).min(1).max(50),
  system: z.string().max(5000).optional(),
});

// ─── Outreach / Inbox ─────────────────────────────────────────────────────────

export const OutreachGenerateSchema = z.object({
  templateType: z.enum(['seller_outreach', 'seller_follow_up', 'board_outreach', 'lender_outreach', 'networking_outreach']),
  companyName:  z.string().max(200).trim().optional(),
  ownerName:    z.string().max(200).trim().optional(),
  context:      z.string().max(1000).trim().optional(),
});

export const ReplySuggestionSchema = z.object({
  threadSubject: z.string().max(500).trim().optional(),
  lastMessage:   z.string().min(1).max(5000),
  senderName:    z.string().max(200).trim().optional(),
  companyName:   z.string().max(200).trim().optional(),
});

// ─── Meetings ─────────────────────────────────────────────────────────────────

const MEETING_TYPES = ['seller_discovery', 'seller_followup', 'board_intro', 'banker_intro', 'attorney_intro', 'cpa_intro', 'capital_intro', 'diligence_review', 'post_acquisition_transition', 'internal_planning'];

export const MeetingSchema = z.object({
  meetingType:      z.enum(MEETING_TYPES),
  title:            z.string().min(1).max(500).trim(),
  startsAt:         z.string().datetime(),
  endsAt:           z.string().datetime(),
  durationMinutes:  z.number().int().min(5).max(480),
  locationType:     z.enum(['phone', 'google_meet', 'zoom', 'in_person', 'other']).optional(),
  locationValue:    z.string().max(1000).trim().optional(),
  linkedCompanyId:  optionalUuid,
  linkedDealId:     optionalUuid,
  linkedContactIds: z.array(z.string().uuid()).optional(),
  agenda:           z.string().max(10000).optional(),
  meetingNotes:     z.string().max(10000).optional(),
  status:           z.enum(['draft', 'proposed', 'awaiting_confirmation', 'confirmed', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show']).optional(),
});

// ─── Agents ───────────────────────────────────────────────────────────────────

export const AgentModelSchema = z.string().regex(/^claude-(opus|sonnet|haiku|instant)-[0-9][-\w]*$/).optional();

export const ResponseAnalysisSchema = z.object({
  emailBody:     z.string().min(1).max(20000).trim(),
  senderName:    z.string().max(200).trim().optional(),
  senderEmail:   optionalEmail,
  companyName:   z.string().max(200).trim().optional(),
  threadContext: z.string().max(5000).trim().optional(),
  model:         AgentModelSchema,
});

export const CalendarSchedulingSchema = z.object({
  meetingType:      z.enum(MEETING_TYPES),
  durationMinutes:  z.number().int().min(15).max(180).optional(),
  contactName:      z.string().max(200).trim().optional(),
  contactTimezone:  z.string().max(50).trim().optional(),
  preferredDays:    z.array(z.string()).max(7).optional(),
  preferredTimes:   z.array(z.string()).max(5).optional(),
  model:            AgentModelSchema,
});

export const DailyOperationsSchema = z.object({
  date:  z.string().datetime().optional(),
  model: AgentModelSchema,
});

export const BoardBuilderSchema = z.object({
  targetIndustry: z.string().max(200).trim().optional(),
  dealContext:    z.string().max(2000).trim().optional(),
  model:          AgentModelSchema,
});

export const OutreachGenerationSchema = z.object({
  contactType:        z.enum(['seller', 'board_candidate', 'banker', 'attorney', 'cpa', 'capital_partner', 'operator', 'networking_contact', 'vendor']).optional(),
  contactName:        z.string().max(200).trim().optional(),
  companyName:        z.string().max(200).trim().optional(),
  industry:           z.string().max(100).trim().optional(),
  context:            z.string().max(2000).trim().optional(),
  templateType:       z.string().max(100).trim().optional(),
  customInstructions: z.string().max(1000).trim().optional(),
  model:              AgentModelSchema,
});

export const DealAnalysisSchema = z.object({
  companyId:  z.string().uuid().optional(),
  financials: z.object({
    revenue:      z.number().min(0).optional(),
    sde:          z.number().min(0).optional(),
    askingPrice:  z.number().min(0).optional(),
  }).optional(),
  notes: z.string().max(5000).trim().optional(),
  model: AgentModelSchema,
});

export const LeadDiscoverySchema = z.object({
  targetIndustry:   z.string().max(200).trim().optional(),
  targetGeography:  z.string().max(200).trim().optional(),
  model:            AgentModelSchema,
});

export const TargetQualificationSchema = z.object({
  companyId:      z.string().uuid().optional(),
  researchNotes:  z.string().max(5000).trim().optional(),
  linkedinData:   z.string().max(2000).trim().optional(),
  websiteSignals: z.string().max(2000).trim().optional(),
  model:          AgentModelSchema,
});

export const StrategyAdvisorSchema = z.object({
  question: z.string().min(10).max(2000).trim(),
  context:  z.string().max(5000).trim().optional(),
  dealId:   z.string().uuid().optional(),
  model:    AgentModelSchema,
});

// ─── Integrations ─────────────────────────────────────────────────────────────

export const IntegrationPatchSchema = z.object({
  enabled:          z.boolean().optional(),
  apolloApiKey:     z.string().max(200).optional(),
  calendarProvider: z.enum(['google', 'outlook', 'none']).optional(),
  calendarEnabled:  z.boolean().optional(),
}).strict();

// ─── Capital raising ──────────────────────────────────────────────────────────

export const InvestorSchema = z.object({
  name:                z.string().min(1),
  organization:        z.string().optional().default(''),
  investorType:        z.enum(['angel', 'family_office', 'private_equity', 'operator_investor', 'private_lender', 'bank', 'search_fund_investor']).optional().default('angel'),
  email:               optionalEmail.default(''),
  phone:               z.string().optional().default(''),
  location:            z.string().optional().default(''),
  checkSizeMin:        z.number().nullable().optional(),
  checkSizeMax:        z.number().nullable().optional(),
  industriesPreferred: z.array(z.string()).optional().default([]),
  dealStagePreference: z.string().optional().default(''),
  riskTolerance:       z.string().optional().default('moderate'),
  priorDeals:          z.string().optional().default(''),
  relationshipStage:   z.enum(['cold', 'aware', 'engaged', 'relationship', 'active_investor']).optional().default('cold'),
  notes:               z.string().optional().default(''),
  lastInteractionAt:   z.string().nullable().optional(),
});

export const CapitalStackSchema = z.object({
  dealId:               z.string().optional().nullable(),
  purchasePrice:        z.number().default(0),
  seniorDebtAmount:     z.number().default(0),
  sellerNoteAmount:     z.number().default(0),
  operatorEquity:       z.number().default(0),
  investorEquity:       z.number().default(0),
  debtInterestRate:     z.number().default(0),
  debtTermMonths:       z.number().default(0),
  sellerNoteRate:       z.number().default(0),
  sellerNoteTermMonths: z.number().default(0),
});

export const InvestorMemoSchema = z.object({
  dealId:             z.string().optional().nullable(),
  title:              z.string().optional().default(''),
  summary:            z.string().optional().default(''),
  purchasePrice:      z.number().default(0),
  revenue:            z.number().default(0),
  ebitda:             z.number().default(0),
  dealStructure:      z.string().optional().default(''),
  expectedReturns:    z.string().optional().default(''),
  riskFactors:        z.string().optional().default(''),
  operatorBackground: z.string().optional().default(''),
});

export const FirmMessagingSchema = z.object({
  missionStatement:      z.string().optional().default(''),
  investmentThesis:      z.string().optional().default(''),
  targetIndustries:      z.array(z.string()).optional().default([]),
  targetDealSize:        z.string().optional().default(''),
  geographicFocus:       z.string().optional().default(''),
  valueCreationStrategy: z.string().optional().default(''),
});

// ─── Deal feed ────────────────────────────────────────────────────────────────

export const DealFeedListingSchema = z.object({
  companyName:           z.string().min(1).max(200).trim(),
  industry:              z.string().max(100).trim().optional(),
  location:              z.string().max(200).trim().optional(),
  revenueEstimate:       z.number().min(0).optional(),
  ebitdaEstimate:        z.number().min(0).optional(),
  yearsInBusiness:       z.number().min(0).max(200).optional(),
  listingPrice:          z.number().min(0).optional(),
  source:                z.string().max(100).trim().optional(),
  sourceUrl:             z.string().url().optional().or(z.literal('')),
  contactName:           z.string().max(200).trim().optional(),
  contactEmail:          optionalEmail,
  contactPhone:          z.string().max(50).trim().optional(),
  ownerRetirementSignal: z.boolean().optional(),
  noWebsiteSignal:       z.boolean().optional(),
  notes:                 z.string().max(2000).trim().optional(),
  externalId:            z.string().max(200).trim().optional(),
});

export const DealFeedListingPatchSchema = DealFeedListingSchema.extend({
  listingStatus: z.enum(['active', 'archived', 'imported']).optional(),
}).partial();

export const SaveListingSchema = z.object({
  listingId: z.string().uuid(),
  userId:    z.string().min(1).max(100).optional().default('default'),
});

export const ImportListingSchema = z.object({
  listingId: z.string().uuid(),
  userId:    z.string().min(1).max(100).optional().default('default'),
});

export const CsvIngestSchema = z.object({
  rows:   z.array(z.record(z.string())).min(1).max(500),
  source: z.string().max(100).trim().optional().default('csv'),
});

// ─── Relationship management ──────────────────────────────────────────────────

export const RelationshipSchema = z.object({
  entityType:            z.enum(['seller', 'board_member', 'investor']),
  entityId:              optionalUuid,
  name:                  z.string().min(1).max(200).trim(),
  company:               z.string().max(200).trim().optional(),
  relationshipStatus:    z.enum(['new', 'warming', 'active', 'long_term', 'closed', 'not_interested']).optional(),
  interestLevel:         z.enum(['low', 'medium', 'high', 'ready']).optional(),
  lastContactDate:       optionalDatetime,
  nextFollowUpDate:      z.string().optional(),
  followUpFrequencyDays: z.number().int().min(1).max(365).optional(),
  notes:                 z.string().max(2000).trim().optional(),
});

export const RelationshipPatchSchema      = RelationshipSchema.partial();

export const RelationshipInteractionSchema = z.object({
  interactionType:    z.enum(['call', 'email', 'meeting', 'note']),
  interactionSummary: z.string().max(2000).trim().optional(),
});

export const ScheduleFollowUpSchema = z.object({
  daysFromNow: z.number().int().min(1).max(365),
});

// ─── Conversation KPI ─────────────────────────────────────────────────────────

export const ConversationSchema = z.object({
  entityType:          z.enum(['seller', 'board_member', 'investor']),
  entityId:            optionalUuid,
  entityName:          z.string().min(1).max(200).trim(),
  company:             z.string().max(200).trim().optional(),
  conversationType:    z.enum(['phone', 'zoom', 'meeting', 'email_thread']),
  conversationSummary: z.string().max(2000).trim().optional(),
  date:                z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const ConversationPatchSchema  = ConversationSchema.omit({ entityType: true, entityId: true }).partial();

export const ConversationTargetSchema = z.object({
  entityType:   z.enum(['seller', 'board_member', 'investor']),
  weeklyTarget: z.number().int().min(0).max(100),
});
