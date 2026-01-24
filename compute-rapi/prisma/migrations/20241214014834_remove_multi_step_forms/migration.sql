/*
  Warnings:

  - You are about to drop the `FieldLayoutDefn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FormDefn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StepDefn` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "FieldLayoutDefn" DROP CONSTRAINT "FieldLayoutDefn_fieldDefnId_fkey";

-- DropForeignKey
ALTER TABLE "FieldLayoutDefn" DROP CONSTRAINT "FieldLayoutDefn_stepDefnId_fkey";

-- DropForeignKey
ALTER TABLE "FormDefn" DROP CONSTRAINT "FormDefn_modelId_fkey";

-- DropForeignKey
ALTER TABLE "StepDefn" DROP CONSTRAINT "StepDefn_formDefnId_fkey";

-- DropTable
DROP TABLE "FieldLayoutDefn";

-- DropTable
DROP TABLE "FormDefn";

-- DropTable
DROP TABLE "StepDefn";

-- DropEnum
DROP TYPE "FormDefnTypes";
