/*
  Warnings:

  - You are about to drop the column `foreignKeyMicroserviceId` on the `FieldDefn` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FieldDefn" DROP CONSTRAINT "FieldDefn_foreignKeyMicroserviceId_fkey";

-- AlterTable
ALTER TABLE "FieldDefn" DROP COLUMN "foreignKeyMicroserviceId";
