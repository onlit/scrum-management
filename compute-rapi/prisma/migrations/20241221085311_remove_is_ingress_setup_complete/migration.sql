/*
  Warnings:

  - You are about to drop the column `isIngressSetupComplete` on the `Microservice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Microservice" DROP COLUMN "isIngressSetupComplete";
