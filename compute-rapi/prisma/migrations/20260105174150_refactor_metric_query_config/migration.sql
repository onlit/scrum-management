/*
  Warnings:

  - You are about to drop the column `queryConfig` on the `DashboardMetric` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Language_client_isPrimary_idx";

-- AlterTable
ALTER TABLE "DashboardMetric" DROP COLUMN "queryConfig",
ADD COLUMN     "aggregateFieldId" UUID,
ADD COLUMN     "aggregationType" "AggregationType",
ADD COLUMN     "groupByFieldId" UUID,
ADD COLUMN     "modelId" UUID,
ADD COLUMN     "queryJoins" JSONB,
ADD COLUMN     "whereConditions" JSONB;

-- CreateIndex
CREATE INDEX "DashboardMetric_modelId_idx" ON "DashboardMetric"("modelId");

-- AddForeignKey
ALTER TABLE "DashboardMetric" ADD CONSTRAINT "DashboardMetric_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardMetric" ADD CONSTRAINT "DashboardMetric_aggregateFieldId_fkey" FOREIGN KEY ("aggregateFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardMetric" ADD CONSTRAINT "DashboardMetric_groupByFieldId_fkey" FOREIGN KEY ("groupByFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
