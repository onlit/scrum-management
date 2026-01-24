/*
  Warnings:

  - The `foreignKeyTarget` column on the `FieldDefn` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ForeignKeyTargets" AS ENUM ('Internal', 'External');

-- CreateEnum
CREATE TYPE "ForeignKeyTypes" AS ENUM ('OneToOne', 'OneToMany');

-- AlterTable
ALTER TABLE "FieldDefn" ADD COLUMN     "foreignKeyType" "ForeignKeyTypes" DEFAULT 'OneToMany',
DROP COLUMN "foreignKeyTarget",
ADD COLUMN     "foreignKeyTarget" "ForeignKeyTargets" NOT NULL DEFAULT 'Internal';

-- DropEnum
DROP TYPE "ForeignKeyTarget";
