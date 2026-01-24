/*
  Warnings:

  - You are about to drop the column `pipelineId` on the `Prospect` table. All the data in the column will be lost.
  - Added the required column `categoryId` to the `Prospect` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."PipelineSource" AS ENUM ('MANUAL_CRM', 'AUTOMATED_PA');

-- DropForeignKey
ALTER TABLE "public"."Prospect" DROP CONSTRAINT "Prospect_pipelineId_fkey";

-- DropIndex
DROP INDEX "public"."Prospect_pipelineId_statusId_deleted_idx";

-- AlterTable
ALTER TABLE "public"."Opportunity" ADD COLUMN     "categoryId" UUID;

-- AlterTable
ALTER TABLE "public"."Prospect" DROP COLUMN "pipelineId",
ADD COLUMN     "categoryId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "public"."OpportunityCategory" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "pipelineSource" "public"."PipelineSource" NOT NULL,
    "crmPipelineId" UUID,
    "automataPipelineId" UUID,
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
CREATE TABLE "public"."ProspectCategory" (
    "id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "pipelineSource" "public"."PipelineSource" NOT NULL,
    "crmPipelineId" UUID,
    "automataPipelineId" UUID,
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

-- CreateIndex
CREATE INDEX "OpportunityCategory_everyoneCanSeeIt_anonymousCanSeeIt_ever_idx" ON "public"."OpportunityCategory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "ProspectCategory_everyoneCanSeeIt_anonymousCanSeeIt_everyon_idx" ON "public"."ProspectCategory"("everyoneCanSeeIt", "anonymousCanSeeIt", "everyoneInObjectCompanyCanSeeIt", "onlyTheseRolesCanSeeIt", "onlyTheseUsersCanSeeIt", "client", "createdBy", "isSystemTemplate", "deleted", "createdAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Prospect_categoryId_statusId_deleted_idx" ON "public"."Prospect"("categoryId", "statusId", "deleted");

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."OpportunityCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpportunityCategory" ADD CONSTRAINT "OpportunityCategory_crmPipelineId_fkey" FOREIGN KEY ("crmPipelineId") REFERENCES "public"."Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Prospect" ADD CONSTRAINT "Prospect_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."ProspectCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProspectCategory" ADD CONSTRAINT "ProspectCategory_crmPipelineId_fkey" FOREIGN KEY ("crmPipelineId") REFERENCES "public"."ProspectPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
