-- Indexes to optimize Person lookups by email with tenant visibility

-- 1) Functional index on lower(email) for case-insensitive search, scoped to non-deleted
CREATE INDEX IF NOT EXISTS idx_person_lower_email
ON "Person" (lower("email"))
WHERE "deleted" IS NULL;

-- 2) Compound tenant + email index to leverage visibility filters
CREATE INDEX IF NOT EXISTS idx_person_client_deleted_lower_email
ON "Person" ("client", "deleted", lower("email"));

-- 3) Update table stats
ANALYZE "Person";


