-- Partial indexes to speed up /opportunity-stages endpoint filters
-- Note: In production, prefer CREATE INDEX CONCURRENTLY in a non-transactional migration.

-- Opportunity indexes
CREATE INDEX IF NOT EXISTS idx_opportunity_pipeline_deleted_created_at
  ON "Opportunity" ("pipelineId", "createdAt")
  WHERE "deleted" IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_status_deleted
  ON "Opportunity" ("statusId")
  WHERE "deleted" IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_owner_deleted_created_at
  ON "Opportunity" ("ownerId", "createdAt")
  WHERE "deleted" IS NULL;

-- Uniqueness-supporting indexes (controller-enforced)
-- Speeds up controller-level duplicate checks for name within client (case-insensitive handled in query)
CREATE INDEX IF NOT EXISTS idx_opportunity_client_name_not_deleted
  ON "Opportunity" ("client", "name")
  WHERE "deleted" IS NULL;

-- Composite checks for (companyId, personId) and companyContactId within client
CREATE INDEX IF NOT EXISTS idx_opportunity_client_company_person_not_deleted
  ON "Opportunity" ("client", "companyId", "personId")
  WHERE "deleted" IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_client_company_contact_not_deleted
  ON "Opportunity" ("client", "companyContactId")
  WHERE "deleted" IS NULL;

-- PipelineStage indexes
CREATE INDEX IF NOT EXISTS idx_pipelinestage_pipeline_deleted_order
  ON "PipelineStage" ("pipelineId", "order")
  WHERE "deleted" IS NULL;
