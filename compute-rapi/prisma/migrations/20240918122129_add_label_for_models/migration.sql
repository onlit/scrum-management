/*
  Warnings:

  - You are about to alter the column `label` on the `FieldDefn` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(200)`.

*/
-- AlterTable
ALTER TABLE "FieldDefn" ALTER COLUMN "label" SET DATA TYPE VARCHAR(200);

-- AlterTable
ALTER TABLE "ModelDefn" ADD COLUMN     "label" VARCHAR(200);
