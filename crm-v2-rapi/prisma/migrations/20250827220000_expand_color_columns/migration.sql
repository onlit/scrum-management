-- Expand color column lengths to store full RGBA values like 'rgba(255, 235, 59, 0.25)'
-- Safe to run repeatedly; uses standard ALTER COLUMN statements

-- Company.color
ALTER TABLE "Company"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- PipelineStage.color
ALTER TABLE "PipelineStage"
  ALTER COLUMN "color" TYPE VARCHAR(40);


