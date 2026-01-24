-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FieldTypes" ADD VALUE 'Phone';
ALTER TYPE "FieldTypes" ADD VALUE 'Latitude';
ALTER TYPE "FieldTypes" ADD VALUE 'Longitude';
ALTER TYPE "FieldTypes" ADD VALUE 'Percentage';
ALTER TYPE "FieldTypes" ADD VALUE 'Slug';
