/*
  Warnings:

  - Added the required column `order` to the `FieldLayoutDefn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "FieldLayoutDefn" ADD COLUMN     "order" INTEGER NOT NULL;
