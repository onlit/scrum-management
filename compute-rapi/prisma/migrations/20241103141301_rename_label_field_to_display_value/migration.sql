/*
  Warnings:

  - You are about to drop the column `labelFieldId` on the `ModelDefn` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ModelDefn" DROP CONSTRAINT "ModelDefn_labelFieldId_fkey";

-- AlterTable
ALTER TABLE "ModelDefn" DROP COLUMN "labelFieldId",
ADD COLUMN     "displayValueId" UUID;

-- AddForeignKey
ALTER TABLE "ModelDefn" ADD CONSTRAINT "ModelDefn_displayValueId_fkey" FOREIGN KEY ("displayValueId") REFERENCES "FieldDefn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
