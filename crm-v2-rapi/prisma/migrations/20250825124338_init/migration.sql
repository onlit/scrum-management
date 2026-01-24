-- CreateEnum
CREATE TYPE "DataExchangeLogType" AS ENUM ('EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "DataExchangeLogStatus" AS ENUM ('COMPLETED', 'FAILED', 'PROCESSING');

-- CreateEnum
CREATE TYPE "ActionReminderProgress" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('APPLICANT', 'NEW');

-- CreateEnum
CREATE TYPE "TargetFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ActionReminderType" AS ENUM ('REMINDER_EVENT', 'INA_REMINDER_EVENT');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('SIZE_2_TO_10', 'SIZE_1', 'SIZE_11_TO_50', 'SIZE_51_TO_100', 'SIZE_101_TO_250', 'SIZE_501_TO_1000', 'SIZE_251_TO_500', 'SIZE_1001_TO_10000');

-- CreateEnum
CREATE TYPE "CompanySpinBuyerInfluence" AS ENUM ('USER', 'TECHNICAL', 'ECONOMIC');

-- CreateTable
CREATE TABLE "DataExchangeLog" (
    "id" UUID NOT NULL,
    "type" "DataExchangeLogType" NOT NULL,
    "status" "DataExchangeLogStatus" NOT NULL DEFAULT 'PROCESSING',
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

-- CreateTable
CREATE TABLE "Relationship" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaType" (
    "id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(20),
    "description" TEXT,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialMediaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "color" VARCHAR(20),
    "expiryDate" TIMESTAMP(3),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "description" TEXT,
    "name" TEXT NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEnquiryPurpose" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEnquiryPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEnquiryStatus" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "name" TEXT NOT NULL,
    "description" TEXT,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEnquiryStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "description" TEXT,
    "name" VARCHAR(50) NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallListPipeline" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "description" TEXT,
    "name" TEXT NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallListPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" UUID NOT NULL,
    "parentPipelineStageId" UUID,
    "pipelineId" UUID,
    "order" INTEGER NOT NULL,
    "immediateNextAction" VARCHAR(200),
    "description" TEXT,
    "confidence" INTEGER NOT NULL,
    "color" VARCHAR(20),
    "rottingDays" INTEGER NOT NULL,
    "conversion" INTEGER NOT NULL,
    "stage" VARCHAR(150) NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallListPipelineStage" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "order" DECIMAL(65,30) NOT NULL,
    "rottingDays" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "callListPipelineId" UUID,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallListPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "staffUrl" TEXT,
    "email" TEXT,
    "website" TEXT,
    "notes" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" VARCHAR(15),
    "industry" TEXT,
    "name" VARCHAR(150) NOT NULL,
    "color" VARCHAR(20),
    "description" TEXT,
    "companyIntelligence" TEXT,
    "size" "CompanySize",
    "keywords" TEXT,
    "contactUrl" TEXT,
    "phone" VARCHAR(25),
    "fax" VARCHAR(25),
    "address1" TEXT,
    "address2" TEXT,
    "branchOfId" UUID,
    "betaPartners" BOOLEAN NOT NULL,
    "ownerId" UUID,
    "newsUrl" TEXT,
    "countryId" UUID,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "middleName" VARCHAR(100),
    "dob" TIMESTAMP(3),
    "personalMobile" VARCHAR(50),
    "address2" TEXT,
    "state" TEXT,
    "owner" VARCHAR(50),
    "source" TEXT,
    "preferredName" VARCHAR(100),
    "username" VARCHAR(100),
    "avatar" VARCHAR(200),
    "countryId" UUID,
    "homePhone" VARCHAR(50),
    "city" TEXT,
    "parentId" UUID,
    "companyOwnerId" UUID,
    "hasWhatsapp" BOOLEAN NOT NULL,
    "address1" TEXT,
    "notes" TEXT,
    "firstName" VARCHAR(100) NOT NULL,
    "zip" VARCHAR(15),
    "sourceNotes" TEXT,
    "lastName" VARCHAR(100),
    "user" UUID,
    "email" TEXT NOT NULL,
    "status" "PersonStatus",
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingList" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(20),
    "expiryDate" TIMESTAMP(3),
    "description" TEXT,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MarketingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHistory" (
    "id" UUID NOT NULL,
    "history" TEXT NOT NULL,
    "color" VARCHAR(20),
    "notes" TEXT,
    "companyId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySocialMedia" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "companyId" UUID,
    "url" TEXT NOT NULL,
    "socialMediaId" UUID,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanySocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySpin" (
    "id" UUID NOT NULL,
    "situation" TEXT NOT NULL,
    "implication" TEXT NOT NULL,
    "need" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "notes" TEXT,
    "color" VARCHAR(20),
    "buyerInfluence" "CompanySpinBuyerInfluence" NOT NULL,
    "problem" TEXT NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanySpin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountManagerInCompany" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "expiryDate" TIMESTAMP(3),
    "companyId" UUID NOT NULL,
    "accountManagerId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AccountManagerInCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInTerritory" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "color" VARCHAR(20),
    "expiryDate" TIMESTAMP(3),
    "territoryId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyInTerritory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonHistory" (
    "id" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "color" VARCHAR(20),
    "history" TEXT,
    "personId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSocialMedia" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "personId" UUID,
    "socialMediaId" UUID,
    "username" TEXT NOT NULL,
    "url" TEXT NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonSocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonInMarketingList" (
    "id" UUID NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "color" VARCHAR(20),
    "marketingListId" UUID NOT NULL,
    "personId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonInMarketingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRelationship" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "color" VARCHAR(20),
    "relationshipId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryOwner" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "expiryDate" TIMESTAMP(3),
    "territoryId" UUID,
    "salesPersonId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TerritoryOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "workPhone" VARCHAR(25),
    "jobTitle" TEXT,
    "accounts" BOOLEAN,
    "personId" UUID NOT NULL,
    "companyId" UUID,
    "workMobile" VARCHAR(25),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "workEmail" TEXT,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEnquiry" (
    "id" UUID NOT NULL,
    "firstName" TEXT,
    "phone" VARCHAR(30),
    "sourceNotes" TEXT,
    "color" VARCHAR(20),
    "personId" UUID NOT NULL,
    "lastName" TEXT,
    "statusId" UUID,
    "message" TEXT,
    "purposeId" UUID,
    "source" TEXT,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallList" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "name" TEXT NOT NULL,
    "callListPipelineId" UUID NOT NULL,
    "description" TEXT,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRelationshipHistory" (
    "id" UUID NOT NULL,
    "personRelationshipId" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonRelationshipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPersonTarget" (
    "id" UUID NOT NULL,
    "target" INTEGER,
    "targetUnit" "TargetFrequency",
    "color" VARCHAR(20),
    "pipelineStageId" UUID NOT NULL,
    "salesPersonId" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "notes" TEXT,
    "expiryDate" TIMESTAMP(3),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SalesPersonTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "personId" UUID,
    "statusId" UUID,
    "sentiment" VARCHAR(12),
    "dataSource" TEXT,
    "actualValue" INTEGER,
    "probability" INTEGER,
    "economicBuyerInfluenceId" UUID,
    "salesPersonId" UUID,
    "ownerId" UUID,
    "companyContactId" UUID,
    "color" VARCHAR(20),
    "notes" TEXT,
    "technicalBuyerInfluenceId" UUID,
    "name" VARCHAR(50) NOT NULL,
    "statusAssignedDate" TIMESTAMP(3),
    "pipelineId" UUID,
    "description" TEXT,
    "estimatedValue" INTEGER,
    "estimatedCloseDate" TIMESTAMP(3),
    "userBuyerInfluenceId" UUID,
    "customerPriority" VARCHAR(7),
    "channelId" UUID,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSchedule" (
    "id" UUID NOT NULL,
    "callListPipelineStageId" UUID NOT NULL,
    "callListId" UUID,
    "color" VARCHAR(20),
    "scheduleDatetime" TIMESTAMP(3) NOT NULL,
    "personId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "opportunityId" UUID,
    "notes" TEXT,
    "companyContactId" UUID NOT NULL,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetActualHistory" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "targetId" UUID NOT NULL,
    "actuals" INTEGER NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TargetActualHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityInfluencer" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "desireForSelf" TEXT,
    "color" VARCHAR(20),
    "rating" INTEGER,
    "companyContactId" UUID NOT NULL,
    "desireForCompany" TEXT,
    "opportunityId" UUID,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityInfluencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityProduct" (
    "id" UUID NOT NULL,
    "color" VARCHAR(20),
    "amount" INTEGER,
    "estimatedValue" INTEGER,
    "opportunityId" UUID NOT NULL,
    "productVariant" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityHistory" (
    "id" UUID NOT NULL,
    "opportunityId" UUID,
    "notes" TEXT NOT NULL,
    "url" TEXT,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "who" TEXT,
    "what" TEXT NOT NULL,
    "when" TIMESTAMP(3),
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ActionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataNeeded" (
    "id" UUID NOT NULL,
    "whoFrom" TEXT NOT NULL,
    "opportunityId" UUID,
    "infoNeeded" TEXT NOT NULL,
    "notes" TEXT,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DataNeeded_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallHistory" (
    "id" UUID NOT NULL,
    "callScheduleId" UUID,
    "outcome" TEXT NOT NULL,
    "color" VARCHAR(20),
    "callListPipelineStageId" UUID NOT NULL,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientHistory" (
    "id" UUID NOT NULL,
    "clientRefId" UUID,
    "url" TEXT NOT NULL,
    "color" VARCHAR(20),
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineSignup" (
    "id" UUID NOT NULL,
    "owner" VARCHAR(200) NOT NULL,
    "color" VARCHAR(20),
    "fields" TEXT,
    "source" TEXT,
    "emailconfirmed" BOOLEAN,
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
    "workflow" UUID,
    "workflowInstance" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OnlineSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Relationship_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInO_idx" ON "Relationship"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "SocialMediaType_everyoneCanSeeIt_anonymousCanSeeIt_everyone_idx" ON "SocialMediaType"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Territory_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObje_idx" ON "Territory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Channel_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObject_idx" ON "Channel"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerEnquiryPurpose_everyoneCanSeeIt_anonymousCanSeeIt_e_idx" ON "CustomerEnquiryPurpose"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerEnquiryStatus_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "CustomerEnquiryStatus"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Pipeline_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjec_idx" ON "Pipeline"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CallListPipeline_everyoneCanSeeIt_anonymousCanSeeIt_everyon_idx" ON "CallListPipeline"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PipelineStage_everyoneCanSeeIt_anonymousCanSeeIt_everyoneIn_idx" ON "PipelineStage"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CallListPipelineStage_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "CallListPipelineStage"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Company_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObject_idx" ON "Company"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "ownerId", "countryId");

-- CreateIndex
CREATE INDEX "Person_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjectC_idx" ON "Person"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "countryId");

-- CreateIndex
CREATE INDEX "MarketingList_everyoneCanSeeIt_anonymousCanSeeIt_everyoneIn_idx" ON "MarketingList"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CompanyHistory_everyoneCanSeeIt_anonymousCanSeeIt_everyoneI_idx" ON "CompanyHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CompanySocialMedia_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "CompanySocialMedia"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CompanySpin_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInOb_idx" ON "CompanySpin"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "AccountManagerInCompany_everyoneCanSeeIt_anonymousCanSeeIt__idx" ON "AccountManagerInCompany"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "accountManagerId");

-- CreateIndex
CREATE INDEX "CompanyInTerritory_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "CompanyInTerritory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonHistory_everyoneCanSeeIt_anonymousCanSeeIt_everyoneIn_idx" ON "PersonHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonSocialMedia_everyoneCanSeeIt_anonymousCanSeeIt_everyo_idx" ON "PersonSocialMedia"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonInMarketingList_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "PersonInMarketingList"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonRelationship_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "PersonRelationship"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "TerritoryOwner_everyoneCanSeeIt_anonymousCanSeeIt_everyoneI_idx" ON "TerritoryOwner"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "salesPersonId");

-- CreateIndex
CREATE INDEX "CompanyContact_everyoneCanSeeIt_anonymousCanSeeIt_everyoneI_idx" ON "CompanyContact"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerEnquiry_everyoneCanSeeIt_anonymousCanSeeIt_everyone_idx" ON "CustomerEnquiry"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CallList_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjec_idx" ON "CallList"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "PersonRelationshipHistory_everyoneCanSeeIt_anonymousCanSeeI_idx" ON "PersonRelationshipHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "SalesPersonTarget_everyoneCanSeeIt_anonymousCanSeeIt_everyo_idx" ON "SalesPersonTarget"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "salesPersonId");

-- CreateIndex
CREATE INDEX "Opportunity_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInOb_idx" ON "Opportunity"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "salesPersonId", "ownerId");

-- CreateIndex
CREATE INDEX "CallSchedule_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInO_idx" ON "CallSchedule"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Client_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjectC_idx" ON "Client"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- Performance indexes for client duplicate checks
CREATE INDEX IF NOT EXISTS "idx_client_client_deleted_opportunity" ON "Client" ("client", "deleted", "opportunityId");
CREATE INDEX IF NOT EXISTS "idx_client_client_deleted_company_contact" ON "Client" ("client", "deleted", "companyContactId");

-- CreateIndex
CREATE INDEX "TargetActualHistory_everyoneCanSeeIt_anonymousCanSeeIt_ever_idx" ON "TargetActualHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityInfluencer_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "OpportunityInfluencer"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityProduct_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "OpportunityProduct"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "productVariant");

-- CreateIndex
CREATE INDEX "OpportunityHistory_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "OpportunityHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ActionPlan_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObj_idx" ON "ActionPlan"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "DataNeeded_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObj_idx" ON "DataNeeded"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "CallHistory_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInOb_idx" ON "CallHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ClientHistory_everyoneCanSeeIt_anonymousCanSeeIt_everyoneIn_idx" ON "ClientHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "OnlineSignup_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInO_idx" ON "OnlineSignup"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_parentPipelineStageId_fkey" FOREIGN KEY ("parentPipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallListPipelineStage" ADD CONSTRAINT "CallListPipelineStage_callListPipelineId_fkey" FOREIGN KEY ("callListPipelineId") REFERENCES "CallListPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_branchOfId_fkey" FOREIGN KEY ("branchOfId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_companyOwnerId_fkey" FOREIGN KEY ("companyOwnerId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyHistory" ADD CONSTRAINT "CompanyHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySocialMedia" ADD CONSTRAINT "CompanySocialMedia_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySocialMedia" ADD CONSTRAINT "CompanySocialMedia_socialMediaId_fkey" FOREIGN KEY ("socialMediaId") REFERENCES "SocialMediaType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySpin" ADD CONSTRAINT "CompanySpin_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountManagerInCompany" ADD CONSTRAINT "AccountManagerInCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInTerritory" ADD CONSTRAINT "CompanyInTerritory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyInTerritory" ADD CONSTRAINT "CompanyInTerritory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonHistory" ADD CONSTRAINT "PersonHistory_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSocialMedia" ADD CONSTRAINT "PersonSocialMedia_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonSocialMedia" ADD CONSTRAINT "PersonSocialMedia_socialMediaId_fkey" FOREIGN KEY ("socialMediaId") REFERENCES "SocialMediaType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonInMarketingList" ADD CONSTRAINT "PersonInMarketingList_marketingListId_fkey" FOREIGN KEY ("marketingListId") REFERENCES "MarketingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonInMarketingList" ADD CONSTRAINT "PersonInMarketingList_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryOwner" ADD CONSTRAINT "TerritoryOwner_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "CustomerEnquiryStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerEnquiry" ADD CONSTRAINT "CustomerEnquiry_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "CustomerEnquiryPurpose"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallList" ADD CONSTRAINT "CallList_callListPipelineId_fkey" FOREIGN KEY ("callListPipelineId") REFERENCES "CallListPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRelationshipHistory" ADD CONSTRAINT "PersonRelationshipHistory_personRelationshipId_fkey" FOREIGN KEY ("personRelationshipId") REFERENCES "PersonRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPersonTarget" ADD CONSTRAINT "SalesPersonTarget_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPersonTarget" ADD CONSTRAINT "SalesPersonTarget_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_economicBuyerInfluenceId_fkey" FOREIGN KEY ("economicBuyerInfluenceId") REFERENCES "CompanySpin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_technicalBuyerInfluenceId_fkey" FOREIGN KEY ("technicalBuyerInfluenceId") REFERENCES "CompanySpin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userBuyerInfluenceId_fkey" FOREIGN KEY ("userBuyerInfluenceId") REFERENCES "CompanySpin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSchedule" ADD CONSTRAINT "CallSchedule_callListPipelineStageId_fkey" FOREIGN KEY ("callListPipelineStageId") REFERENCES "CallListPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSchedule" ADD CONSTRAINT "CallSchedule_callListId_fkey" FOREIGN KEY ("callListId") REFERENCES "CallList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallSchedule" ADD CONSTRAINT "CallSchedule_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TargetActualHistory" ADD CONSTRAINT "TargetActualHistory_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "SalesPersonTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityInfluencer" ADD CONSTRAINT "OpportunityInfluencer_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityInfluencer" ADD CONSTRAINT "OpportunityInfluencer_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityHistory" ADD CONSTRAINT "OpportunityHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionPlan" ADD CONSTRAINT "ActionPlan_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataNeeded" ADD CONSTRAINT "DataNeeded_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallHistory" ADD CONSTRAINT "CallHistory_callScheduleId_fkey" FOREIGN KEY ("callScheduleId") REFERENCES "CallSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallHistory" ADD CONSTRAINT "CallHistory_callListPipelineStageId_fkey" FOREIGN KEY ("callListPipelineStageId") REFERENCES "CallListPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHistory" ADD CONSTRAINT "ClientHistory_clientRefId_fkey" FOREIGN KEY ("clientRefId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
