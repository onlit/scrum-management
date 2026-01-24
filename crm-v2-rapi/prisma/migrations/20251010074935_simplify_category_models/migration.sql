/*
  Warnings:

  - You are about to drop the column `automataPipelineId` on the `OpportunityCategory` table. All the data in the column will be lost.
  - You are about to drop the column `crmPipelineId` on the `OpportunityCategory` table. All the data in the column will be lost.
  - You are about to drop the column `pipelineSource` on the `OpportunityCategory` table. All the data in the column will be lost.
  - You are about to drop the column `automataPipelineId` on the `ProspectCategory` table. All the data in the column will be lost.
  - You are about to drop the column `crmPipelineId` on the `ProspectCategory` table. All the data in the column will be lost.
  - You are about to drop the column `pipelineSource` on the `ProspectCategory` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."OpportunityCategory" DROP CONSTRAINT "OpportunityCategory_crmPipelineId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ProspectCategory" DROP CONSTRAINT "ProspectCategory_crmPipelineId_fkey";

-- AlterTable
ALTER TABLE "OpportunityCategory" DROP COLUMN "automataPipelineId",
DROP COLUMN "crmPipelineId",
DROP COLUMN "pipelineSource";

-- AlterTable
ALTER TABLE "ProspectCategory" DROP COLUMN "automataPipelineId",
DROP COLUMN "crmPipelineId",
DROP COLUMN "pipelineSource";

-- DropEnum
DROP TYPE "public"."PipelineSource";
