/*
  Warnings:

  - You are about to drop the column `foreignKey` on the `FieldDefn` table. All the data in the column will be lost.
  - You are about to drop the column `primaryKey` on the `FieldDefn` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FieldDefn" DROP COLUMN "foreignKey",
DROP COLUMN "primaryKey",
ADD COLUMN     "isForeignKey" BOOLEAN,
ADD COLUMN     "isPrimaryKey" BOOLEAN;
