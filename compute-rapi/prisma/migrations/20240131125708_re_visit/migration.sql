/*
  Warnings:

  - You are about to drop the column `comment` on the `FieldDefn` table. All the data in the column will be lost.
  - You are about to drop the column `foreignKeyMicroserviceId` on the `FieldDefn` table. All the data in the column will be lost.
  - You are about to drop the column `microserviceId` on the `InstanceLog` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "FieldDefn" DROP CONSTRAINT "FieldDefn_foreignKeyMicroserviceId_fkey";

-- DropForeignKey
ALTER TABLE "InstanceLog" DROP CONSTRAINT "InstanceLog_microserviceId_fkey";

-- AlterTable
ALTER TABLE "FieldDefn" DROP COLUMN "comment",
DROP COLUMN "foreignKeyMicroserviceId",
ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "InstanceLog" DROP COLUMN "microserviceId";
