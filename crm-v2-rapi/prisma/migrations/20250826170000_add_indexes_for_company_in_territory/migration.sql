-- CompanyInTerritory performance indexes for controller-level uniqueness checks
-- Note: Created without CONCURRENTLY to remain compatible with Prisma migration transactions

-- Speed up duplicate active assignment check across tenant
CREATE INDEX IF NOT EXISTS "idx_cit_client_deleted_company_territory_expiry"
ON "CompanyInTerritory" ("client", "deleted", "companyId", "territoryId", "expiryDate");

-- Helpful selective filters on foreign keys under soft-delete
CREATE INDEX IF NOT EXISTS "idx_cit_company_deleted"
ON "CompanyInTerritory" ("companyId", "deleted");

CREATE INDEX IF NOT EXISTS "idx_cit_territory_deleted"
ON "CompanyInTerritory" ("territoryId", "deleted");


