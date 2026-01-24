/*
  Warnings:

  - You are about to drop the column `deleteBehavior` on the `ModelDefn` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "onDelete" "DeleteBehavior" NOT NULL DEFAULT 'Cascade';

-- AlterTable
ALTER TABLE "ModelDefn" DROP COLUMN "deleteBehavior";
