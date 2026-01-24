/*
  Warnings:

  - You are about to alter the column `translationCode` on the `Translation` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(8)`.
  - Added the required column `helpfulHintTranslationCode` to the `FieldDefn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `labelTranslationCode` to the `FieldDefn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `helpfulHintTranslationCode` to the `ModelDefn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `labelTranslationCode` to the `ModelDefn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "helpfulHintTranslationCode" VARCHAR(8) NOT NULL,
ADD COLUMN     "labelTranslationCode" VARCHAR(8) NOT NULL;

-- AlterTable
ALTER TABLE "ModelDefn" ADD COLUMN     "helpfulHintTranslationCode" VARCHAR(8) NOT NULL,
ADD COLUMN     "labelTranslationCode" VARCHAR(8) NOT NULL;

-- AlterTable
ALTER TABLE "Translation" ALTER COLUMN "translationCode" SET DATA TYPE VARCHAR(8);
