/*
  Warnings:

  - The `onDelete` column on the `FieldDefn` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DeleteBehaviors" AS ENUM ('Cascade', 'Restrict');

-- AlterTable
ALTER TABLE "FieldDefn" DROP COLUMN "onDelete",
ADD COLUMN     "onDelete" "DeleteBehaviors" NOT NULL DEFAULT 'Cascade';

-- DropEnum
DROP TYPE "DeleteBehavior";
