-- PRH performance indexes to support controller-level uniqueness and listing

-- Composite visibility/tenant index
CREATE INDEX IF NOT EXISTS "PersonRelationshipHistory_client_deleted_prId_createdAt_idx"
ON "PersonRelationshipHistory" ("client", "deleted", "personRelationshipId", "createdAt");

-- Case-insensitive notes uniqueness support per tenant and relation
CREATE INDEX IF NOT EXISTS "PersonRelationshipHistory_client_deleted_prId_lower_notes_idx"
ON "PersonRelationshipHistory" ("client", "deleted", "personRelationshipId", lower("notes"));


