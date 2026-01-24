/*
  Warnings:

  - Added the required column `modelId` to the `MenuDefn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "MenuDefn" ADD COLUMN     "modelId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "MenuDefn" ADD CONSTRAINT "MenuDefn_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ModelDefn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
