-- CreateEnum
CREATE TYPE "DataExchangeLogTypes" AS ENUM ('Import', 'Export');

-- CreateEnum
CREATE TYPE "DataExchangeLogStatuses" AS ENUM ('Processing', 'Failed', 'Completed');

-- CreateEnum
CREATE TYPE "DeleteBehavior" AS ENUM ('Cascade', 'Restrict');

-- AlterTable
ALTER TABLE "ModelDefn" ADD COLUMN     "deleteBehavior" "DeleteBehavior" NOT NULL DEFAULT 'Restrict';

-- CreateTable
CREATE TABLE "DataExchangeLog" (
    "id" UUID NOT NULL,
    "type" "DataExchangeLogTypes" NOT NULL,
    "status" "DataExchangeLogStatuses" NOT NULL DEFAULT 'Processing',
    "modelName" TEXT NOT NULL,
    "filePath" TEXT,
    "failureReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "importedRowsCount" INTEGER,
    "errorsRowsCount" INTEGER,
    "metaData" JSONB,
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

    CONSTRAINT "DataExchangeLog_pkey" PRIMARY KEY ("id")
);
