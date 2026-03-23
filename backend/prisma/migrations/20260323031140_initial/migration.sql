-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('prospect', 'active', 'diligence', 'loi_sent', 'under_loi', 'closed_won', 'closed_lost', 'on_hold');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('seller', 'board_candidate', 'investor', 'advisor', 'lender', 'lawyer', 'accountant', 'broker', 'operator', 'networking_contact', 'vendor', 'employee_candidate');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('active', 'inactive', 'stale', 'suppressed');

-- CreateEnum
CREATE TYPE "RelationshipStage" AS ENUM ('cold', 'aware', 'engaged', 'relationship', 'trusted');

-- CreateEnum
CREATE TYPE "RelationshipWarmth" AS ENUM ('cold', 'cooling', 'warm', 'hot');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('email', 'call', 'meeting', 'note', 'document_sent', 'proposal', 'loi', 'follow_up', 'research');

-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('identified', 'contacted', 'discovery', 'financial_review', 'loi_discussion', 'loi_signed', 'due_diligence', 'financing', 'closing', 'closed', 'lost');

-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('platform', 'add_on', 'board_recruitment_related', 'networking_only');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'in_progress', 'blocked', 'done', 'archived');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('critical', 'high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('loi', 'board_invite', 'outreach_letter', 'follow_up_email', 'meeting_agenda', 'meeting_summary', 'deal_memo', 'diligence_checklist', 'board_update', 'post_acquisition_plan');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'review', 'final', 'sent', 'archived');

-- CreateEnum
CREATE TYPE "InvestorType" AS ENUM ('angel', 'family_office', 'private_equity', 'operator_investor', 'private_lender', 'bank', 'search_fund_investor');

-- CreateEnum
CREATE TYPE "InvestorRelationshipStage" AS ENUM ('cold', 'aware', 'engaged', 'relationship', 'active_investor');

-- CreateEnum
CREATE TYPE "PlaybookTaskStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "PlaybookCompletionType" AS ENUM ('manual', 'automatic', 'hybrid');

-- CreateEnum
CREATE TYPE "PlaybookCompletionMode" AS ENUM ('tasks', 'metrics', 'hybrid');

-- CreateEnum
CREATE TYPE "EmpirePhaseStatus" AS ENUM ('locked', 'active', 'complete');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiDraftingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiBriefingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "primaryModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "emailMode" TEXT NOT NULL DEFAULT 'smtp_only',
    "smtpHost" TEXT NOT NULL DEFAULT '',
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpUser" TEXT NOT NULL DEFAULT '',
    "fromName" TEXT NOT NULL DEFAULT '',
    "fromEmail" TEXT NOT NULL DEFAULT '',
    "weeklyOwnerContactTarget" INTEGER NOT NULL DEFAULT 25,
    "dailyFollowUpTarget" INTEGER NOT NULL DEFAULT 5,
    "weeklyBoardOutreachTarget" INTEGER NOT NULL DEFAULT 3,
    "weeklyInvestorOutreachTarget" INTEGER NOT NULL DEFAULT 5,
    "sourcingRadarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sourcingMinRelevanceThreshold" INTEGER NOT NULL DEFAULT 50,
    "autoGeneratePrepPackets" BOOLEAN NOT NULL DEFAULT true,
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "highContrast" BOOLEAN NOT NULL DEFAULT false,
    "density" TEXT NOT NULL DEFAULT 'standard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "subIndustry" TEXT,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'US',
    "employeeCount" INTEGER,
    "annualRevenue" DOUBLE PRECISION,
    "annualRevenueMin" DOUBLE PRECISION,
    "annualRevenueMax" DOUBLE PRECISION,
    "sdeEstimate" DOUBLE PRECISION,
    "ebitdaEstimate" DOUBLE PRECISION,
    "askingPrice" DOUBLE PRECISION,
    "status" "CompanyStatus" NOT NULL DEFAULT 'prospect',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "source" TEXT,
    "sourceUrl" TEXT,
    "sourcedAt" TIMESTAMP(3),
    "notes" TEXT,
    "tags" TEXT[],
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "sellerMotivation" TEXT,
    "sellerTimeline" TEXT,
    "yearsOwned" INTEGER,
    "lastInteractionAt" TIMESTAMP(3),
    "pipelinePressureLevel" TEXT,
    "daysSinceLastContact" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "title" TEXT,
    "contactType" "ContactType" NOT NULL DEFAULT 'networking_contact',
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "preferredChannel" TEXT,
    "timezone" TEXT,
    "status" "ContactStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "tags" TEXT[],
    "influenceScore" INTEGER,
    "relationshipWarmth" "RelationshipWarmth",
    "relationshipStage" "RelationshipStage" NOT NULL DEFAULT 'cold',
    "lastInteractionAt" TIMESTAMP(3),
    "lastConversationSummary" TEXT,
    "relationshipNotes" TEXT,
    "sellerTimeline" TEXT,
    "sellerMotivation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "interactionType" "InteractionType" NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "channel" TEXT,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "outcome" TEXT,
    "sentiment" TEXT,
    "requiresFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "conversationSummary" TEXT,
    "sellerMotivation" TEXT,
    "sellerTimeline" TEXT,
    "sellerConcerns" TEXT,
    "nextConversationGoal" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "dealType" "DealType" NOT NULL DEFAULT 'platform',
    "stage" "DealStage" NOT NULL DEFAULT 'identified',
    "probability" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "askingPrice" DOUBLE PRECISION,
    "sde" DOUBLE PRECISION,
    "ebitda" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "grossProfit" DOUBLE PRECISION,
    "employeeCount" INTEGER,
    "industry" TEXT,
    "location" TEXT,
    "source" TEXT,
    "brokerName" TEXT,
    "brokerEmail" TEXT,
    "notes" TEXT,
    "tags" TEXT[],
    "daysSinceLastActivity" INTEGER,
    "lastActivityAt" TIMESTAMP(3),
    "stageChangedAt" TIMESTAMP(3),
    "closeProbability" DOUBLE PRECISION,
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'medium',
    "loiSentAt" TIMESTAMP(3),
    "loiSignedAt" TIMESTAMP(3),
    "closingTargetAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnderwritingScenario" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Base Case',
    "revenue" DOUBLE PRECISION,
    "grossProfit" DOUBLE PRECISION,
    "ownerSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "addBacks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sde" DOUBLE PRECISION,
    "ebitda" DOUBLE PRECISION,
    "purchasePrice" DOUBLE PRECISION,
    "multipleUsed" DOUBLE PRECISION,
    "seniorDebtAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "seniorDebtRate" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "seniorDebtTermYears" INTEGER NOT NULL DEFAULT 10,
    "sellerNoteAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerNoteRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "sellerNoteTermYears" INTEGER NOT NULL DEFAULT 5,
    "equityRequired" DOUBLE PRECISION,
    "operatorEquity" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "investorEquity" DOUBLE PRECISION NOT NULL DEFAULT 90,
    "annualDebtService" DOUBLE PRECISION,
    "dscr" DOUBLE PRECISION,
    "verdict" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnderwritingScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiligenceItem" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3),
    "blocksClose" BOOLEAN NOT NULL DEFAULT false,
    "blocksLender" BOOLEAN NOT NULL DEFAULT false,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "notes" TEXT,
    "assignedTo" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiligenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiligenceDocument" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ingestionStatus" TEXT NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "pageCount" INTEGER,
    "wordCount" INTEGER,
    "extractedFields" JSONB,
    "textPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiligenceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiligenceFinding" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "documentId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceSnippet" TEXT,
    "whyItMatters" TEXT NOT NULL,
    "recommendedFollowUp" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiligenceFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiligenceSummary" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "executiveSummary" TEXT,
    "topRisks" JSONB,
    "missingItems" JSONB,
    "sellerQuestions" JSONB,
    "brokerQuestions" JSONB,
    "lenderQuestions" JSONB,
    "attorneyQuestions" JSONB,
    "readinessState" TEXT NOT NULL DEFAULT 'not_started',
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "lastSynthesizedAt" TIMESTAMP(3),
    "synthesisVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiligenceSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardSeat" (
    "id" TEXT NOT NULL,
    "seatOrder" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "focusArea" TEXT NOT NULL,
    "criticalQuestion" TEXT NOT NULL,
    "targetProfile" TEXT,
    "isFilledBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'vacant',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardCandidate" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "linkedinUrl" TEXT,
    "yearsRelevantExp" INTEGER,
    "networksOwnedDeals" INTEGER,
    "capitalDeployed" DOUBLE PRECISION,
    "industryFocus" TEXT,
    "warmthScore" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "referredBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "lastContactAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "commitmentLevel" TEXT NOT NULL DEFAULT 'none',
    "notes" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "investorType" "InvestorType" NOT NULL DEFAULT 'angel',
    "email" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "checkSizeMin" DOUBLE PRECISION,
    "checkSizeMax" DOUBLE PRECISION,
    "industriesPreferred" TEXT[],
    "dealStagePreference" TEXT,
    "riskTolerance" TEXT NOT NULL DEFAULT 'moderate',
    "priorDeals" TEXT,
    "relationshipStage" "InvestorRelationshipStage" NOT NULL DEFAULT 'cold',
    "notes" TEXT,
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapitalStack" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "seniorDebtAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerNoteAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equityRequired" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operatorEquity" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "investorEquity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "committedInvestorEquity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equityStillNeeded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debtInterestRate" DOUBLE PRECISION NOT NULL DEFAULT 6.5,
    "debtTermMonths" INTEGER NOT NULL DEFAULT 120,
    "sellerNoteRate" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "sellerNoteTermMonths" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapitalStack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestorMemo" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestorMemo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "source" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingType" TEXT NOT NULL DEFAULT 'general',
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "location" TEXT,
    "videoLink" TEXT,
    "agenda" TEXT,
    "notes" TEXT,
    "outcome" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "aiPrepped" BOOLEAN NOT NULL DEFAULT false,
    "calendarEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "contactId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "role" TEXT,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingPrepPacket" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingPrepPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dealId" TEXT,
    "documentType" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "generatedBy" TEXT,
    "model" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionDailyStat" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "ownersCalled" INTEGER NOT NULL DEFAULT 0,
    "ownersEmailed" INTEGER NOT NULL DEFAULT 0,
    "ownersLinkedIn" INTEGER NOT NULL DEFAULT 0,
    "ownersTotalContacted" INTEGER NOT NULL DEFAULT 0,
    "ownerConversations" INTEGER NOT NULL DEFAULT 0,
    "meetingsScheduled" INTEGER NOT NULL DEFAULT 0,
    "loisSent" INTEGER NOT NULL DEFAULT 0,
    "investorConversations" INTEGER NOT NULL DEFAULT 0,
    "boardOutreach" INTEGER NOT NULL DEFAULT 0,
    "boardMeetings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionWeeklyStat" (
    "id" TEXT NOT NULL,
    "weekStartDate" TEXT NOT NULL,
    "ownersContacted" INTEGER NOT NULL DEFAULT 0,
    "ownerConversations" INTEGER NOT NULL DEFAULT 0,
    "meetingsScheduled" INTEGER NOT NULL DEFAULT 0,
    "investorConversations" INTEGER NOT NULL DEFAULT 0,
    "boardMeetings" INTEGER NOT NULL DEFAULT 0,
    "loisSent" INTEGER NOT NULL DEFAULT 0,
    "companiesAdded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionWeeklyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionMonthlyStat" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "ownersContacted" INTEGER NOT NULL DEFAULT 0,
    "ownerConversations" INTEGER NOT NULL DEFAULT 0,
    "meetingsScheduled" INTEGER NOT NULL DEFAULT 0,
    "investorConversations" INTEGER NOT NULL DEFAULT 0,
    "boardMeetings" INTEGER NOT NULL DEFAULT 0,
    "loisSent" INTEGER NOT NULL DEFAULT 0,
    "dealsOpened" INTEGER NOT NULL DEFAULT 0,
    "dealsClosed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionMonthlyStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QlaTargets" (
    "id" TEXT NOT NULL,
    "weeklyOwnerContacts" INTEGER NOT NULL DEFAULT 25,
    "weeklyOwnerConversations" INTEGER NOT NULL DEFAULT 5,
    "weeklyMeetings" INTEGER NOT NULL DEFAULT 3,
    "weeklyLoisSent" INTEGER NOT NULL DEFAULT 1,
    "weeklyBoardOutreach" INTEGER NOT NULL DEFAULT 3,
    "weeklyInvestorConversations" INTEGER NOT NULL DEFAULT 5,
    "dailyOwnerCalls" INTEGER NOT NULL DEFAULT 5,
    "dailyFollowUps" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QlaTargets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookStage" (
    "id" TEXT NOT NULL,
    "stageOrder" INTEGER NOT NULL,
    "stageName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "completionMode" "PlaybookCompletionMode" NOT NULL DEFAULT 'tasks',
    "metricRequirements" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookTask" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "taskDescription" TEXT,
    "taskCategory" TEXT NOT NULL DEFAULT 'general',
    "taskOrder" INTEGER NOT NULL DEFAULT 0,
    "estimatedEffortMinutes" INTEGER NOT NULL DEFAULT 30,
    "completionType" "PlaybookCompletionType" NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaybookProgress" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "PlaybookTaskStatus" NOT NULL DEFAULT 'not_started',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaybookProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpirePhase" (
    "id" TEXT NOT NULL,
    "phaseOrder" INTEGER NOT NULL,
    "phaseName" TEXT NOT NULL,
    "phaseCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "danPenaQuote" TEXT,
    "entryCriteria" JSONB NOT NULL,
    "exitCriteria" JSONB NOT NULL,
    "keyDeliverables" JSONB NOT NULL,
    "blockers" JSONB NOT NULL DEFAULT '[]',
    "estimatedWeeks" INTEGER NOT NULL DEFAULT 2,
    "status" "EmpirePhaseStatus" NOT NULL DEFAULT 'locked',
    "unlockedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpirePhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpireMilestone" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "proof" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpireMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealFeedListing" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "sourceAdapter" TEXT NOT NULL DEFAULT 'manual',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "industry" TEXT,
    "location" TEXT,
    "askingPrice" DOUBLE PRECISION,
    "revenue" DOUBLE PRECISION,
    "sde" DOUBLE PRECISION,
    "ebitda" DOUBLE PRECISION,
    "employees" INTEGER,
    "yearsInBusiness" INTEGER,
    "reasonForSelling" TEXT,
    "listingUrl" TEXT,
    "brokerName" TEXT,
    "brokerEmail" TEXT,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "fitScore" DOUBLE PRECISION,
    "fitNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "listedAt" TIMESTAMP(3),
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealFeedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "userId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "scope" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "labelIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "from" TEXT,
    "to" TEXT,
    "subject" TEXT,
    "bodyPreview" TEXT,
    "bodyText" TEXT,
    "sentAt" TIMESTAMP(3),
    "direction" TEXT NOT NULL DEFAULT 'inbound',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "labelIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "entityType" TEXT,
    "entityId" TEXT,
    "uploadedBy" TEXT,
    "metadata" JSONB,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitoredEntity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "website" TEXT,
    "linkedinUrl" TEXT,
    "googlePlaceId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "checkIntervalMs" INTEGER NOT NULL DEFAULT 43200000,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitoredEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorEvent" (
    "id" TEXT NOT NULL,
    "monitoredEntityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'watch',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceSnippet" TEXT,
    "sourceUrl" TEXT,
    "aiExplanation" TEXT,
    "aiNextAction" TEXT,
    "dedupeFingerprint" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL DEFAULT 'unread',
    "taskId" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonitorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Company_userId_status_idx" ON "Company"("userId", "status");

-- CreateIndex
CREATE INDEX "Company_userId_createdAt_idx" ON "Company"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Company_userId_lastInteractionAt_idx" ON "Company"("userId", "lastInteractionAt");

-- CreateIndex
CREATE INDEX "Contact_userId_contactType_idx" ON "Contact"("userId", "contactType");

-- CreateIndex
CREATE INDEX "Contact_userId_status_idx" ON "Contact"("userId", "status");

-- CreateIndex
CREATE INDEX "Contact_userId_companyId_idx" ON "Contact"("userId", "companyId");

-- CreateIndex
CREATE INDEX "Contact_userId_relationshipStage_idx" ON "Contact"("userId", "relationshipStage");

-- CreateIndex
CREATE INDEX "Interaction_companyId_createdAt_idx" ON "Interaction"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_contactId_createdAt_idx" ON "Interaction"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_dealId_createdAt_idx" ON "Interaction"("dealId", "createdAt");

-- CreateIndex
CREATE INDEX "Interaction_userId_interactionType_idx" ON "Interaction"("userId", "interactionType");

-- CreateIndex
CREATE INDEX "Deal_userId_stage_idx" ON "Deal"("userId", "stage");

-- CreateIndex
CREATE INDEX "Deal_userId_createdAt_idx" ON "Deal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Deal_userId_riskLevel_idx" ON "Deal"("userId", "riskLevel");

-- CreateIndex
CREATE INDEX "Deal_companyId_stage_idx" ON "Deal"("companyId", "stage");

-- CreateIndex
CREATE INDEX "DiligenceItem_dealId_category_idx" ON "DiligenceItem"("dealId", "category");

-- CreateIndex
CREATE INDEX "DiligenceItem_dealId_received_idx" ON "DiligenceItem"("dealId", "received");

-- CreateIndex
CREATE INDEX "DiligenceItem_dealId_blocksClose_idx" ON "DiligenceItem"("dealId", "blocksClose");

-- CreateIndex
CREATE UNIQUE INDEX "DiligenceDocument_fileId_key" ON "DiligenceDocument"("fileId");

-- CreateIndex
CREATE INDEX "DiligenceDocument_dealId_idx" ON "DiligenceDocument"("dealId");

-- CreateIndex
CREATE INDEX "DiligenceDocument_dealId_ingestionStatus_idx" ON "DiligenceDocument"("dealId", "ingestionStatus");

-- CreateIndex
CREATE INDEX "DiligenceFinding_dealId_severity_idx" ON "DiligenceFinding"("dealId", "severity");

-- CreateIndex
CREATE INDEX "DiligenceFinding_dealId_status_idx" ON "DiligenceFinding"("dealId", "status");

-- CreateIndex
CREATE INDEX "DiligenceFinding_documentId_idx" ON "DiligenceFinding"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "DiligenceSummary_dealId_key" ON "DiligenceSummary"("dealId");

-- CreateIndex
CREATE UNIQUE INDEX "CapitalStack_dealId_key" ON "CapitalStack"("dealId");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE INDEX "Task_userId_priority_idx" ON "Task"("userId", "priority");

-- CreateIndex
CREATE INDEX "Task_userId_dueDate_idx" ON "Task"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "Task_dealId_status_idx" ON "Task"("dealId", "status");

-- CreateIndex
CREATE INDEX "Meeting_userId_scheduledAt_idx" ON "Meeting"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Meeting_userId_status_idx" ON "Meeting"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingPrepPacket_meetingId_key" ON "MeetingPrepPacket"("meetingId");

-- CreateIndex
CREATE INDEX "Document_userId_documentType_idx" ON "Document"("userId", "documentType");

-- CreateIndex
CREATE INDEX "Document_userId_status_idx" ON "Document"("userId", "status");

-- CreateIndex
CREATE INDEX "Document_dealId_documentType_idx" ON "Document"("dealId", "documentType");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionDailyStat_date_key" ON "ExecutionDailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionWeeklyStat_weekStartDate_key" ON "ExecutionWeeklyStat"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionMonthlyStat_month_key" ON "ExecutionMonthlyStat"("month");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookStage_stageOrder_key" ON "PlaybookStage"("stageOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PlaybookProgress_taskId_key" ON "PlaybookProgress"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "EmpirePhase_phaseOrder_key" ON "EmpirePhase"("phaseOrder");

-- CreateIndex
CREATE UNIQUE INDEX "EmpirePhase_phaseCode_key" ON "EmpirePhase"("phaseCode");

-- CreateIndex
CREATE INDEX "DealFeedListing_status_fitScore_idx" ON "DealFeedListing"("status", "fitScore");

-- CreateIndex
CREATE INDEX "DealFeedListing_sourceAdapter_status_idx" ON "DealFeedListing"("sourceAdapter", "status");

-- CreateIndex
CREATE INDEX "DealFeedListing_industry_status_idx" ON "DealFeedListing"("industry", "status");

-- CreateIndex
CREATE INDEX "Notification_isRead_createdAt_idx" ON "Notification"("isRead", "createdAt");

-- CreateIndex
CREATE INDEX "OAuthToken_provider_idx" ON "OAuthToken"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_provider_key" ON "OAuthToken"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_gmailThreadId_key" ON "EmailThread"("gmailThreadId");

-- CreateIndex
CREATE INDEX "EmailThread_gmailThreadId_idx" ON "EmailThread"("gmailThreadId");

-- CreateIndex
CREATE INDEX "EmailThread_contactId_lastMessageAt_idx" ON "EmailThread"("contactId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "EmailThread_companyId_lastMessageAt_idx" ON "EmailThread"("companyId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_gmailMessageId_key" ON "EmailMessage"("gmailMessageId");

-- CreateIndex
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_sentAt_idx" ON "EmailMessage"("sentAt");

-- CreateIndex
CREATE INDEX "EmailMessage_direction_sentAt_idx" ON "EmailMessage"("direction", "sentAt");

-- CreateIndex
CREATE INDEX "StoredFile_entityType_entityId_idx" ON "StoredFile"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "StoredFile_uploadedBy_createdAt_idx" ON "StoredFile"("uploadedBy", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StoredFile_bucket_key_key" ON "StoredFile"("bucket", "key");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "MonitoredEntity_userId_enabled_idx" ON "MonitoredEntity"("userId", "enabled");

-- CreateIndex
CREATE INDEX "MonitoredEntity_enabled_nextCheckAt_idx" ON "MonitoredEntity"("enabled", "nextCheckAt");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredEntity_userId_entityType_entityId_key" ON "MonitoredEntity"("userId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "MonitorEvent_monitoredEntityId_detectedAt_idx" ON "MonitorEvent"("monitoredEntityId", "detectedAt");

-- CreateIndex
CREATE INDEX "MonitorEvent_userId_reviewState_idx" ON "MonitorEvent"("userId", "reviewState");

-- CreateIndex
CREATE INDEX "MonitorEvent_userId_severity_reviewState_idx" ON "MonitorEvent"("userId", "severity", "reviewState");

-- CreateIndex
CREATE INDEX "MonitorEvent_entityType_entityId_idx" ON "MonitorEvent"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorEvent_dedupeFingerprint_key" ON "MonitorEvent"("dedupeFingerprint");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UnderwritingScenario" ADD CONSTRAINT "UnderwritingScenario_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiligenceItem" ADD CONSTRAINT "DiligenceItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiligenceDocument" ADD CONSTRAINT "DiligenceDocument_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiligenceFinding" ADD CONSTRAINT "DiligenceFinding_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiligenceFinding" ADD CONSTRAINT "DiligenceFinding_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DiligenceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiligenceSummary" ADD CONSTRAINT "DiligenceSummary_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardCandidate" ADD CONSTRAINT "BoardCandidate_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "BoardSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CapitalStack" ADD CONSTRAINT "CapitalStack_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestorMemo" ADD CONSTRAINT "InvestorMemo_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingPrepPacket" ADD CONSTRAINT "MeetingPrepPacket_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookTask" ADD CONSTRAINT "PlaybookTask_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PlaybookStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookProgress" ADD CONSTRAINT "PlaybookProgress_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlaybookTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaybookProgress" ADD CONSTRAINT "PlaybookProgress_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PlaybookStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmpireMilestone" ADD CONSTRAINT "EmpireMilestone_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "EmpirePhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorEvent" ADD CONSTRAINT "MonitorEvent_monitoredEntityId_fkey" FOREIGN KEY ("monitoredEntityId") REFERENCES "MonitoredEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
