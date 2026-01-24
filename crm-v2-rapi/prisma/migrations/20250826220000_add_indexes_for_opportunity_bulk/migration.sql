-- Opportunity performance indexes for controller-level uniqueness checks
-- Goal: Speed up duplicate checks on (client, deleted, pipelineId, companyId)

CREATE INDEX IF NOT EXISTS "idx_opportunity_client_deleted_pipeline_company"
ON "Opportunity" ("client", "deleted", "pipelineId", "companyId");

-- Helpful selective filters on soft-deleted and pipeline dimension
CREATE INDEX IF NOT EXISTS "idx_opportunity_pipeline_deleted"
ON "Opportunity" ("pipelineId", "deleted");


