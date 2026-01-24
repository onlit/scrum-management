/*
  Warnings:

  - You are about to drop the column `productVariant` on the `OpportunityProduct` table. All the data in the column will be lost.
  - Added the required column `productVariantId` to the `OpportunityProduct` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ProspectTemperature" AS ENUM ('COLD', 'WARM', 'HOT');

-- CreateEnum
CREATE TYPE "public"."ProspectDisqualificationReason" AS ENUM ('NO_BUDGET', 'WRONG_TIMING', 'LOST_TO_COMPETITOR', 'UNRESPONSIVE', 'NOT_A_FIT', 'OTHER');

-- DropIndex
DROP INDEX "public"."OpportunityProduct_everyoneCanSeeIt_anonymousCanSeeIt_every_idx";

-- AlterTable
ALTER TABLE "public"."OpportunityProduct" DROP COLUMN "productVariant",
ADD COLUMN     "productVariantId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "public"."Prospect" (
    "id" UUID NOT NULL,
    "personId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "sourceCampaignId" UUID NOT NULL,
    "pipelineId" UUID,
    "statusId" UUID,
    "qualificationScore" INTEGER NOT NULL DEFAULT 0,
    "interestSummary" TEXT,
    "temperature" "public"."ProspectTemperature" NOT NULL,
    "disqualificationReason" "public"."ProspectDisqualificationReason",
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
CREATE TABLE "public"."ProspectProduct" (
    "id" UUID NOT NULL,
    "amount" INTEGER,
    "estimatedValue" INTEGER,
    "prospectId" UUID NOT NULL,
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

    CONSTRAINT "ProspectProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProspectPipeline" (
    "id" UUID NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProspectPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProspectPipelineStage" (
    "id" UUID NOT NULL,
    "parentPipelineStageId" UUID,
    "pipelineId" UUID,
    "order" INTEGER NOT NULL,
    "immediateNextAction" VARCHAR(200),
    "description" TEXT,
    "confidence" INTEGER NOT NULL,
    "color" VARCHAR(40),
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
    "workflowId" UUID,
    "workflowInstanceId" UUID,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProspectPipelineStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Prospect_everyoneCanSeeIt_anonymousCanSeeIt_everyoneInObjec_idx" ON "public"."Prospect"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Prospect_pipelineId_statusId_deleted_idx" ON "public"."Prospect"("pipelineId", "statusId", "deleted");

-- CreateIndex
CREATE INDEX "ProspectProduct_everyoneCanSeeIt_anonymousCanSeeIt_everyone_idx" ON "public"."ProspectProduct"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "productVariantId");

-- CreateIndex
CREATE INDEX "ProspectProduct_prospectId_deleted_idx" ON "public"."ProspectProduct"("prospectId", "deleted");

-- CreateIndex
CREATE INDEX "ProspectPipeline_everyoneCanSeeIt_anonymousCanSeeIt_everyon_idx" ON "public"."ProspectPipeline"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ProspectPipelineStage_everyoneCanSeeIt_anonymousCanSeeIt_ev_idx" ON "public"."ProspectPipelineStage"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ProspectPipelineStage_pipelineId_deleted_order_idx" ON "public"."ProspectPipelineStage"("pipelineId", "deleted", "order");

-- CreateIndex
CREATE INDEX "OpportunityProduct_everyoneCanSeeIt_anonymousCanSeeIt_every_idx" ON "public"."OpportunityProduct"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt", "productVariantId");

-- AddForeignKey
ALTER TABLE "public"."Prospect" ADD CONSTRAINT "Prospect_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prospect" ADD CONSTRAINT "Prospect_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "public"."ProspectPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prospect" ADD CONSTRAINT "Prospect_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "public"."ProspectPipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProspectProduct" ADD CONSTRAINT "ProspectProduct_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "public"."Prospect"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProspectPipelineStage" ADD CONSTRAINT "ProspectPipelineStage_parentPipelineStageId_fkey" FOREIGN KEY ("parentPipelineStageId") REFERENCES "public"."ProspectPipelineStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProspectPipelineStage" ADD CONSTRAINT "ProspectPipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "public"."ProspectPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
