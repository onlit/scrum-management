-- Indexes to optimize controller-level uniqueness checks and common filters for CallListPipelineStage

-- Ensure quick tenant-scoped, soft-delete-aware lookups by name within a pipeline
CREATE INDEX IF NOT EXISTS idx_clps_client_deleted_pipeline_lower_name
  ON "CallListPipelineStage" (client, deleted, "callListPipelineId", lower(name));

-- Ensure quick order-dup checks within a pipeline
CREATE INDEX IF NOT EXISTS idx_clps_client_deleted_pipeline_order
  ON "CallListPipelineStage" (client, deleted, "callListPipelineId", "order");

-- Cover frequent list filters and default sorting
CREATE INDEX IF NOT EXISTS idx_clps_client_deleted_createdAt
  ON "CallListPipelineStage" (client, deleted, "createdAt");

-- Aid filtering by pipeline foreign key
CREATE INDEX IF NOT EXISTS idx_clps_pipeline_deleted
  ON "CallListPipelineStage" ("callListPipelineId", deleted);

