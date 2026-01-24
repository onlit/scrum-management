-- Covering composite index to accelerate /opportunities/stages endpoint
-- Filters commonly used: pipelineId (required), ownerId (optional), createdAt range (optional), deleted IS NULL
-- Note: In production, prefer CREATE INDEX CONCURRENTLY outside transaction if needed.

CREATE INDEX IF NOT EXISTS idx_opportunity_pipeline_owner_created_deleted
  ON "Opportunity" ("pipelineId", "ownerId", "createdAt")
  WHERE "deleted" IS NULL;


