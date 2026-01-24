-- AlterTable
ALTER TABLE "public"."Prospect" ADD COLUMN     "prospectPipelineId" UUID;

-- AddForeignKey
ALTER TABLE "public"."Prospect" ADD CONSTRAINT "Prospect_prospectPipelineId_fkey" FOREIGN KEY ("prospectPipelineId") REFERENCES "public"."ProspectPipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;
