/*
  Warnings:

  - Made the column `foreignKeyMicroserviceId` on table `FieldDefn` required. This step will fail if there are existing NULL values in that column.
  - Made the column `foreignKeyModelId` on table `FieldDefn` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "FieldDefn" ALTER COLUMN "foreignKeyMicroserviceId" SET NOT NULL,
ALTER COLUMN "foreignKeyModelId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_foreignKeyModelId_fkey" FOREIGN KEY ("foreignKeyModelId") REFERENCES "ModelDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldDefn" ADD CONSTRAINT "FieldDefn_foreignKeyMicroserviceId_fkey" FOREIGN KEY ("foreignKeyMicroserviceId") REFERENCES "Microservice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
