-- Pipelines: support controller-level uniqueness checks on name
CREATE INDEX IF NOT EXISTS "Pipeline_client_deleted_lower_name_idx"
  ON "Pipeline" ("client", "deleted", lower("name"));

-- PipelineStage: support controller-level uniqueness checks and frequent lookups
CREATE INDEX IF NOT EXISTS "PipelineStage_client_deleted_pipeline_lower_stage_idx"
  ON "PipelineStage" ("client", "deleted", "pipelineId", lower("stage"));

-- PipelineStage ordering within pipeline
CREATE INDEX IF NOT EXISTS "PipelineStage_pipeline_deleted_order_idx"
  ON "PipelineStage" ("pipelineId", "deleted", "order");


