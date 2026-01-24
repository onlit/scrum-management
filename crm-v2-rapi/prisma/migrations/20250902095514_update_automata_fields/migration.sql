/*
  Warnings:

  - You are about to drop the column `workflow` on the `ActionPlan` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `ActionPlan` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CallHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CallHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CallList` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CallList` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CallListPipeline` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CallListPipeline` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CallListPipelineStage` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CallListPipelineStage` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CallSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CallSchedule` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Channel` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Client` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Company` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CompanyContact` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CompanyContact` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CompanySocialMedia` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CompanySocialMedia` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CompanySpin` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CompanySpin` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CustomerEnquiry` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CustomerEnquiry` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CustomerEnquiryPurpose` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CustomerEnquiryPurpose` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CustomerEnquiryStatus` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CustomerEnquiryStatus` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `DataNeeded` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `DataNeeded` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `MarketingList` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `MarketingList` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `OpportunityHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `OpportunityHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `OpportunityInfluencer` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `OpportunityInfluencer` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `OpportunityProduct` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `OpportunityProduct` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Person` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Person` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `PersonInMarketingList` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `PersonInMarketingList` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `PersonRelationship` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `PersonRelationship` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `PersonRelationshipHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `PersonRelationshipHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `PersonSocialMedia` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `PersonSocialMedia` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Pipeline` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Pipeline` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `PipelineStage` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `PipelineStage` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Relationship` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Relationship` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `SalesPersonTarget` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `SalesPersonTarget` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `SocialMediaType` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `SocialMediaType` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `TargetActualHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `TargetActualHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `Territory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `Territory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `TerritoryOwner` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `TerritoryOwner` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ActionPlan" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CallHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CallList" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CallListPipeline" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CallListPipelineStage" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CallSchedule" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Channel" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Client" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Company" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CompanyContact" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CompanySocialMedia" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CompanySpin" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CustomerEnquiry" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CustomerEnquiryPurpose" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CustomerEnquiryStatus" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."DataNeeded" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."MarketingList" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Opportunity" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."OpportunityHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."OpportunityInfluencer" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."OpportunityProduct" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Person" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."PersonInMarketingList" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."PersonRelationship" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."PersonRelationshipHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."PersonSocialMedia" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Pipeline" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."PipelineStage" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Relationship" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."SalesPersonTarget" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."SocialMediaType" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."TargetActualHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."Territory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."TerritoryOwner" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;
