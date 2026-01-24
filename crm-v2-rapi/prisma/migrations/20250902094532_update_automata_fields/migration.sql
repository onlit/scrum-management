/*
  Warnings:

  - You are about to drop the column `workflow` on the `AccountManagerInCompany` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `AccountManagerInCompany` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `ClientHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `ClientHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CompanyHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CompanyHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `CompanyInTerritory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `CompanyInTerritory` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `OnlineSignup` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `OnlineSignup` table. All the data in the column will be lost.
  - You are about to drop the column `workflow` on the `PersonHistory` table. All the data in the column will be lost.
  - You are about to drop the column `workflowInstance` on the `PersonHistory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."AccountManagerInCompany" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."ClientHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CompanyHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."CompanyInTerritory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."OnlineSignup" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;

-- AlterTable
ALTER TABLE "public"."PersonHistory" DROP COLUMN "workflow",
DROP COLUMN "workflowInstance",
ADD COLUMN     "workflowId" UUID,
ADD COLUMN     "workflowInstanceId" UUID;
