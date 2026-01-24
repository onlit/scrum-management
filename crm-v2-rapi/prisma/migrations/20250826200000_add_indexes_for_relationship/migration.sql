-- Relationship performance indexes

-- Case-insensitive name uniqueness checks within a tenant among non-deleted rows
CREATE INDEX IF NOT EXISTS idx_relationship_tenant_deleted_lower_name
  ON "Relationship" ("client", "deleted", lower("name"));

-- Visibility compound index is already present in Prisma schema; adding covering index for frequent list ordering
CREATE INDEX IF NOT EXISTS idx_relationship_client_deleted_createdAt
  ON "Relationship" ("client", "deleted", "createdAt");


-- PersonRelationship performance indexes
-- Support controller-level uniqueness checks: (client, personId, relationshipId) where deleted is null
CREATE INDEX IF NOT EXISTS idx_person_relationship_client_deleted_person_relationship
  ON "PersonRelationship" ("client", "deleted", "personId", "relationshipId");

-- Additional covering index for quick preview duplicate scans by relationshipId alone
CREATE INDEX IF NOT EXISTS idx_person_relationship_relationshipId_deleted
  ON "PersonRelationship" ("relationshipId", "deleted");

-- Support list and detail queries by tenant and visibility
CREATE INDEX IF NOT EXISTS idx_person_relationship_client_deleted_createdAt
  ON "PersonRelationship" ("client", "deleted", "createdAt");

