-- CreateEnum
CREATE TYPE "TranslationSyncType" AS ENUM ('Full', 'Model', 'Field');

-- CreateEnum
CREATE TYPE "TranslationSyncMode" AS ENUM ('Sync', 'DryRun', 'Generate');

-- CreateTable
CREATE TABLE "TranslationSyncLog" (
    "id" UUID NOT NULL,
    "type" "TranslationSyncType" NOT NULL DEFAULT 'Full',
    "mode" "TranslationSyncMode" NOT NULL DEFAULT 'Sync',
    "status" "ProcessStatus" NOT NULL DEFAULT 'Processing',
    "microserviceId" UUID,
    "modelId" UUID,
    "totalModels" INTEGER,
    "processedModels" INTEGER NOT NULL DEFAULT 0,
    "totalFields" INTEGER,
    "processedFields" INTEGER NOT NULL DEFAULT 0,
    "translationsCreated" INTEGER NOT NULL DEFAULT 0,
    "translationsUpdated" INTEGER NOT NULL DEFAULT 0,
    "codesGenerated" INTEGER NOT NULL DEFAULT 0,
    "lastProcessedModelId" UUID,
    "lastProcessedFieldId" UUID,
    "failureReason" TEXT,
    "errorDetails" JSONB,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "tags" TEXT,
    "everyoneCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "anonymousCanSeeIt" BOOLEAN NOT NULL DEFAULT false,
    "everyoneInObjectCompanyCanSeeIt" BOOLEAN NOT NULL DEFAULT true,
    "onlyTheseRolesCanSeeIt" JSONB,
    "onlyTheseUsersCanSeeIt" JSONB,
    "client" UUID NOT NULL,
    "createdBy" UUID NOT NULL,
    "updatedBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deleted" TIMESTAMP(3),

    CONSTRAINT "TranslationSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationSyncLog_status_idx" ON "TranslationSyncLog"("status");

-- CreateIndex
CREATE INDEX "TranslationSyncLog_client_idx" ON "TranslationSyncLog"("client");

-- CreateIndex
CREATE INDEX "TranslationSyncLog_createdAt_idx" ON "TranslationSyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "TranslationSyncLog_microserviceId_idx" ON "TranslationSyncLog"("microserviceId");
