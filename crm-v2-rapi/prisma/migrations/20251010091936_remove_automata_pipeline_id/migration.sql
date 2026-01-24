/*
  Warnings:

  - You are about to drop the column `automataPipelineId` on the `Opportunity` table. All the data in the column will be lost.
  - You are about to drop the column `automataPipelineId` on the `Prospect` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Opportunity" DROP COLUMN "automataPipelineId";

-- AlterTable
ALTER TABLE "public"."Prospect" DROP COLUMN "automataPipelineId";
