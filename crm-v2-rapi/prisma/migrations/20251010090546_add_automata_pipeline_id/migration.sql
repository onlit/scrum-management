-- AlterTable
ALTER TABLE "public"."Opportunity" ADD COLUMN     "automataPipelineId" UUID;

-- AlterTable
ALTER TABLE "public"."Prospect" ADD COLUMN     "automataPipelineId" UUID;
