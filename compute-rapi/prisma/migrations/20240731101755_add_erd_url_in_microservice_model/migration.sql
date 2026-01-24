/*
  Warnings:

  - You are about to drop the column `erdUrl` on the `Instance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "erdUrl";

-- AlterTable
ALTER TABLE "Microservice" ADD COLUMN     "erdUrl" TEXT;
