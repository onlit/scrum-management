/*
  Warnings:

  - You are about to drop the column `parentId` on the `ModelDefn` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "ModelDefn" DROP CONSTRAINT "ModelDefn_parentId_fkey";

-- AlterTable
ALTER TABLE "ModelDefn" DROP COLUMN "parentId";
