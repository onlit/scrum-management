-- Optimized indexes for Person uniqueness and lookups
-- Controller enforces uniqueness, but indexes speed up pre-checks

-- Safe create indexes if not exist (Postgres 9.5+)
CREATE INDEX IF NOT EXISTS "Person_client_deleted_parentId" ON "Person" ("client", "deleted", "parentId");
CREATE INDEX IF NOT EXISTS "Person_client_deleted_parentId_personalMobile" ON "Person" ("client", "deleted", "parentId", "personalMobile");
CREATE INDEX IF NOT EXISTS "Person_client_deleted_parentId_email_ci" ON "Person" ("client", "deleted", "parentId", lower("email"));

-- Optional: support GET lookups by id with visibility filters
CREATE INDEX IF NOT EXISTS "Person_client_deleted_id" ON "Person" ("client", "deleted", "id");


