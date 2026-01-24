-- CreateEnum
CREATE TYPE "DataExchangeLogType" AS ENUM ('EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "DataExchangeLogStatus" AS ENUM ('COMPLETED', 'FAILED', 'PROCESSING');

-- CreateEnum
CREATE TYPE "ProspectTemperature" AS ENUM ('COLD', 'WARM', 'HOT');

-- CreateEnum
CREATE TYPE "ProspectDisqualificationReason" AS ENUM ('NO_BUDGET', 'WRONG_TIMING', 'LOST_TO_COMPETITOR', 'UNRESPONSIVE', 'NOT_A_FIT', 'OTHER');

-- CreateEnum
CREATE TYPE "ActionReminderProgress" AS ENUM ('T', 'E', 'TEST_ING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PersonStatus" AS ENUM ('APPLICANT', 'NEW');

-- CreateEnum
CREATE TYPE "TargetFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ActionReminderType" AS ENUM ('REMINDER_EVENT', 'INA_REMINDER_EVENT');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('SIZE_1', 'SIZE_2_TO_10', 'SIZE_11_TO_50', 'SIZE_51_TO_100', 'SIZE_101_TO_250', 'SIZE_251_TO_500', 'SIZE_501_TO_1000', 'SIZE_1001_TO_10000');

-- CreateEnum
CREATE TYPE "CompanySpinBuyerInfluence" AS ENUM ('USER', 'TECHNICAL', 'ECONOMIC');

-- CreateEnum
CREATE TYPE "CustomerSentiment" AS ENUM ('FEARFUL', 'DISTRESSED', 'CONCERNED', 'OK', 'GOOD', 'SECURE', 'ECSTATIC');

-- CreateEnum
CREATE TYPE "CustomerPriority" AS ENUM ('URGENT', 'ASAP', 'LATER');

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
CREATE TABLE "ProspectCategory" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProspectCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prospect" (
    "id" UUID NOT NULL,
    "disqualificationReason" "ProspectDisqualificationReason",
    "sourceCampaign" UUID,
    "interestSummary" TEXT,
    "ownerId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "qualificationScore" INTEGER NOT NULL,
    "temperature" "ProspectTemperature" NOT NULL,
    "prospectPipelineId" UUID,
    "statusId" UUID,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Prospect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectPipeline" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProspectPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectProduct" (
    "id" UUID NOT NULL,
    "amount" INTEGER,
    "estimatedValue" INTEGER,
    "productVariantId" UUID NOT NULL,
    "prospectId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProspectProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProspectPipelineStage" (
    "id" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "immediateNextAction" VARCHAR(200),
    "description" TEXT,
    "confidence" INTEGER NOT NULL,
    "rottingDays" INTEGER NOT NULL,
    "conversion" INTEGER NOT NULL,
    "stage" TEXT NOT NULL,
    "parentPipelineStageId" UUID,
    "pipelineId" UUID,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProspectPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialMediaType" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SocialMediaType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "expiryDate" DATE,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEnquiryPurpose" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEnquiryPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEnquiryStatus" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEnquiryStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityPipeline" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" VARCHAR(50) NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallListPipeline" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallListPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" UUID NOT NULL,
    "stage" VARCHAR(150) NOT NULL,
    "conversion" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "rottingDays" INTEGER NOT NULL,
    "pipelineId" UUID,
    "parentPipelineStageId" UUID,
    "description" TEXT,
    "immediateNextAction" VARCHAR(200),
    "order" INTEGER NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallListPipelineStage" (
    "id" UUID NOT NULL,
    "order" DECIMAL(65,30) NOT NULL,
    "rottingDays" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "callListPipelineId" UUID,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallListPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "email" TEXT,
    "fax" VARCHAR(25),
    "staffUrl" TEXT,
    "contactUrl" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "stateId" UUID,
    "zip" VARCHAR(15),
    "size" "CompanySize",
    "industryId" UUID,
    "keywords" TEXT,
    "notes" TEXT,
    "branchOfId" UUID,
    "ownerId" UUID,
    "betaPartners" BOOLEAN NOT NULL,
    "website" TEXT,
    "newsUrl" TEXT,
    "phone" TEXT,
    "countryId" UUID,
    "cityId" UUID,
    "companyIntelligence" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "firstName" VARCHAR(100) NOT NULL,
    "hasWhatsapp" BOOLEAN NOT NULL,
    "middleName" VARCHAR(100),
    "preferredName" VARCHAR(100),
    "username" VARCHAR(100),
    "homePhone" TEXT,
    "avatar" VARCHAR(200),
    "address1" TEXT,
    "address2" TEXT,
    "dob" DATE,
    "personalMobile" TEXT,
    "zip" TEXT,
    "stateId" UUID,
    "parentId" UUID,
    "companyOwnerId" UUID,
    "source" TEXT,
    "sourceNotes" TEXT,
    "owner" TEXT,
    "notes" TEXT,
    "lastName" VARCHAR(100),
    "email" TEXT NOT NULL,
    "status" "PersonStatus",
    "countryId" UUID,
    "user" UUID,
    "cityId" UUID,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingList" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "expiryDate" DATE,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MarketingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyHistory" (
    "id" UUID NOT NULL,
    "notes" TEXT,
    "history" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySocialMedia" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "companyId" UUID,
    "socialMediaId" UUID,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanySocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySpin" (
    "id" UUID NOT NULL,
    "situation" TEXT NOT NULL,
    "implication" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "need" TEXT NOT NULL,
    "buyerInfluence" "CompanySpinBuyerInfluence" NOT NULL,
    "notes" TEXT,
    "problem" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanySpin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountManagerInCompany" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "expiryDate" DATE,
    "accountManagerId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AccountManagerInCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyInTerritory" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "territoryId" UUID NOT NULL,
    "expiryDate" DATE,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyInTerritory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonHistory" (
    "id" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "history" TEXT,
    "personId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonSocialMedia" (
    "id" UUID NOT NULL,
    "personId" UUID,
    "socialMediaId" UUID,
    "url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonSocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonInMarketingList" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "marketingListId" UUID NOT NULL,
    "expiryDate" DATE,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonInMarketingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRelationship" (
    "id" UUID NOT NULL,
    "relationshipId" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryOwner" (
    "id" UUID NOT NULL,
    "salesPersonId" UUID NOT NULL,
    "territoryId" UUID,
    "expiryDate" DATE,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TerritoryOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "companyId" UUID,
    "workEmail" TEXT,
    "endDate" DATE,
    "accounts" BOOLEAN,
    "startDate" DATE,
    "jobTitle" TEXT,
    "workPhone" TEXT,
    "workMobile" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerEnquiry" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "sourceNotes" TEXT,
    "statusId" UUID,
    "message" TEXT,
    "purposeId" UUID,
    "source" TEXT,
    "phone" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CustomerEnquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallList" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "callListPipelineId" UUID NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonRelationshipHistory" (
    "id" UUID NOT NULL,
    "personRelationshipId" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonRelationshipHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPersonTarget" (
    "id" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "targetUnit" "TargetFrequency",
    "target" INTEGER,
    "notes" TEXT,
    "expiryDate" DATE,
    "pipelineStageId" UUID NOT NULL,
    "salesPersonId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SalesPersonTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "personId" UUID,
    "companyContactId" UUID,
    "actualValue" INTEGER,
    "probability" INTEGER,
    "ownerId" UUID,
    "salesPersonId" UUID,
    "channelId" UUID,
    "dataSource" TEXT,
    "sentiment" "CustomerSentiment",
    "economicBuyerInfluenceId" UUID,
    "technicalBuyerInfluenceId" UUID,
    "customerPriority" "CustomerPriority",
    "notes" TEXT,
    "name" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "pipelineId" UUID,
    "estimatedValue" INTEGER,
    "userBuyerInfluenceId" UUID,
    "estimatedCloseDate" DATE,
    "categoryId" UUID,
    "statusId" UUID,
    "statusAssignedDate" TIMESTAMP(3),
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallSchedule" (
    "id" UUID NOT NULL,
    "callListPipelineStageId" UUID NOT NULL,
    "scheduleDatetime" TIMESTAMP(3) NOT NULL,
    "callListId" UUID,
    "personId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" UUID NOT NULL,
    "opportunityId" UUID,
    "companyContactId" UUID NOT NULL,
    "notes" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TargetActualHistory" (
    "id" UUID NOT NULL,
    "actuals" INTEGER NOT NULL,
    "targetId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "TargetActualHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityInfluencer" (
    "id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "companyContactId" UUID NOT NULL,
    "opportunityId" UUID,
    "desireForCompany" TEXT,
    "desireForSelf" TEXT,
    "rating" INTEGER,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityInfluencer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityProduct" (
    "id" UUID NOT NULL,
    "opportunityId" UUID NOT NULL,
    "amount" INTEGER,
    "estimatedValue" INTEGER,
    "productVariantId" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityHistory" (
    "id" UUID NOT NULL,
    "opportunityId" UUID,
    "notes" TEXT NOT NULL,
    "url" TEXT,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OpportunityHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionPlan" (
    "id" UUID NOT NULL,
    "what" TEXT NOT NULL,
    "opportunityId" UUID NOT NULL,
    "who" TEXT,
    "when" DATE,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
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
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DataNeeded_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallHistory" (
    "id" UUID NOT NULL,
    "outcome" TEXT NOT NULL,
    "callListPipelineStageId" UUID NOT NULL,
    "callScheduleId" UUID,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CallHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientHistory" (
    "id" UUID NOT NULL,
    "clientRefId" UUID,
    "url" TEXT NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ClientHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlineSignup" (
    "id" UUID NOT NULL,
    "source" TEXT,
    "fields" TEXT,
    "owner" VARCHAR(200) NOT NULL,
    "emailconfirmed" BOOLEAN,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OnlineSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProspectCategory_everyoneCanSeeIt_anonymousCanSeeIt_everyon_idx" ON "ProspectCategory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Prospect_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjec_idx" ON "Prospect"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ProspectPipeline_everyoneCanSeeIt_anonymousCanSeeIt_everyon_idx" ON "ProspectPipeline"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ProspectProduct_everyoneCanSeeIt_anonymousCanSeeIt_everyone_idx" ON "ProspectProduct"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityCategory_everyoneCanSeeIt_anonymousCanSeeIt_ever_idx" ON "OpportunityCategory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ProspectPipelineStage_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "ProspectPipelineStage"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

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
CREATE INDEX "OpportunityPipeline_everyoneCanSeeIt_anonymousCanSeeIt_ever_idx" ON "OpportunityPipeline"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

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
CREATE INDEX "Opportunity_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInOb_idx" ON "Opportunity"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "ownerId", "salesPersonId");

-- CreateIndex
CREATE INDEX "CallSchedule_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInO_idx" ON "CallSchedule"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Client_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjectC_idx" ON "Client"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "TargetActualHistory_everyoneCanSeeIt_anonymousCanSeeIt_ever_idx" ON "TargetActualHistory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityInfluencer_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "OpportunityInfluencer"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "OpportunityProduct_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "OpportunityProduct"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "productVariantId");

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
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProspectCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_prospectPipelineId_fkey" FOREIGN KEY ("prospectPipelineId") REFERENCES "ProspectPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prospect" ADD CONSTRAINT "Prospect_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ProspectPipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectProduct" ADD CONSTRAINT "ProspectProduct_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectPipelineStage" ADD CONSTRAINT "ProspectPipelineStage_parentPipelineStageId_fkey" FOREIGN KEY ("parentPipelineStageId") REFERENCES "ProspectPipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProspectPipelineStage" ADD CONSTRAINT "ProspectPipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "ProspectPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "OpportunityPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_parentPipelineStageId_fkey" FOREIGN KEY ("parentPipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "PersonInMarketingList" ADD CONSTRAINT "PersonInMarketingList_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonInMarketingList" ADD CONSTRAINT "PersonInMarketingList_marketingListId_fkey" FOREIGN KEY ("marketingListId") REFERENCES "MarketingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonRelationship" ADD CONSTRAINT "PersonRelationship_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "SalesPersonTarget" ADD CONSTRAINT "SalesPersonTarget_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "OpportunityPipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPersonTarget" ADD CONSTRAINT "SalesPersonTarget_pipelineStageId_fkey" FOREIGN KEY ("pipelineStageId") REFERENCES "PipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyContactId_fkey" FOREIGN KEY ("companyContactId") REFERENCES "CompanyContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_economicBuyerInfluenceId_fkey" FOREIGN KEY ("economicBuyerInfluenceId") REFERENCES "CompanySpin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_technicalBuyerInfluenceId_fkey" FOREIGN KEY ("technicalBuyerInfluenceId") REFERENCES "CompanySpin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "OpportunityPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_userBuyerInfluenceId_fkey" FOREIGN KEY ("userBuyerInfluenceId") REFERENCES "CompanySpin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "OpportunityCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "PipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "CallHistory" ADD CONSTRAINT "CallHistory_callListPipelineStageId_fkey" FOREIGN KEY ("callListPipelineStageId") REFERENCES "CallListPipelineStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallHistory" ADD CONSTRAINT "CallHistory_callScheduleId_fkey" FOREIGN KEY ("callScheduleId") REFERENCES "CallSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientHistory" ADD CONSTRAINT "ClientHistory_clientRefId_fkey" FOREIGN KEY ("clientRefId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
