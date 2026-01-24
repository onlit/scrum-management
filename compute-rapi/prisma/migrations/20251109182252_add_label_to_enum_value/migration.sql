/*
  Warnings:

  - Added the required column `label` to the `EnumValue` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Add label column as nullable initially
ALTER TABLE "EnumValue" ADD COLUMN "label" VARCHAR(200);

-- Step 2: Backfill label with value for all existing records
UPDATE "EnumValue" SET "label" = "value" WHERE "label" IS NULL;

-- Step 3: Make label NOT NULL now that all records have values
ALTER TABLE "EnumValue" ALTER COLUMN "label" SET NOT NULL;
