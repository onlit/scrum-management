/*
  Warnings:

  - The `status` column on the `DataExchangeLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `status` on the `Instance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `status` on the `InstanceLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('Processing', 'Failed', 'Completed');

-- AlterTable
ALTER TABLE "DataExchangeLog" DROP COLUMN "status",
ADD COLUMN     "status" "ProcessStatus" NOT NULL DEFAULT 'Processing';

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "duration" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "ProcessStatus" NOT NULL;

-- AlterTable
ALTER TABLE "InstanceLog" DROP COLUMN "status",
ADD COLUMN     "status" "ProcessStatus" NOT NULL;

-- DropEnum
DROP TYPE "DataExchangeLogStatuses";

-- DropEnum
DROP TYPE "StatusTypes";
