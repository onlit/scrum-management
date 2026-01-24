-- CompanyContact performance indexes for controller-level uniqueness checks
-- Note: Created without CONCURRENTLY to remain compatible with Prisma migration transactions

-- Speed up duplicate pair check: (client, deleted, personId, companyId)
CREATE INDEX IF NOT EXISTS "idx_company_contact_client_deleted_person_company"
ON "CompanyContact" ("client", "deleted", "personId", "companyId");

-- Speed up case-insensitive email duplicate check within tenant
CREATE INDEX IF NOT EXISTS "idx_company_contact_client_deleted_lower_work_email"
ON "CompanyContact" ("client", "deleted", (LOWER("workEmail")));

-- Helpful selective filters on foreign keys under soft-delete
CREATE INDEX IF NOT EXISTS "idx_company_contact_company_deleted"
ON "CompanyContact" ("companyId", "deleted");

CREATE INDEX IF NOT EXISTS "idx_company_contact_person_deleted"
ON "CompanyContact" ("personId", "deleted");


