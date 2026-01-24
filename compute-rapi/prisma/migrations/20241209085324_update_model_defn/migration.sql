-- AlterTable
ALTER TABLE "ModelDefn" ADD COLUMN     "addToDashboard" BOOLEAN,
ADD COLUMN     "dashboardStageFieldId" UUID;

-- AddForeignKey
ALTER TABLE "ModelDefn" ADD CONSTRAINT "ModelDefn_dashboardStageFieldId_fkey" FOREIGN KEY ("dashboardStageFieldId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
