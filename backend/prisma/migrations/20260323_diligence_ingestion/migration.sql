-- CreateTable: DiligenceDocument
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

-- CreateTable: DiligenceFinding
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

-- CreateTable: DiligenceSummary
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

-- CreateIndex
CREATE UNIQUE INDEX "DiligenceDocument_fileId_key" ON "DiligenceDocument"("fileId");
CREATE INDEX "DiligenceDocument_dealId_idx" ON "DiligenceDocument"("dealId");
CREATE INDEX "DiligenceDocument_dealId_ingestionStatus_idx" ON "DiligenceDocument"("dealId", "ingestionStatus");

CREATE INDEX "DiligenceFinding_dealId_severity_idx" ON "DiligenceFinding"("dealId", "severity");
CREATE INDEX "DiligenceFinding_dealId_status_idx" ON "DiligenceFinding"("dealId", "status");
CREATE INDEX "DiligenceFinding_documentId_idx" ON "DiligenceFinding"("documentId");

CREATE UNIQUE INDEX "DiligenceSummary_dealId_key" ON "DiligenceSummary"("dealId");

-- AddForeignKey
ALTER TABLE "DiligenceDocument" ADD CONSTRAINT "DiligenceDocument_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiligenceFinding" ADD CONSTRAINT "DiligenceFinding_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DiligenceFinding" ADD CONSTRAINT "DiligenceFinding_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "DiligenceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DiligenceSummary" ADD CONSTRAINT "DiligenceSummary_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
