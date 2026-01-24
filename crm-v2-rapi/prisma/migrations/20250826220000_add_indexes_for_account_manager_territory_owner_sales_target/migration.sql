-- Optimize controller-level duplicate checks and filters for AMC/TO/SPT

-- AccountManagerInCompany: prevent active duplicate (companyId, accountManagerId)
CREATE INDEX IF NOT EXISTS idx_amc_client_deleted_company_manager_expiry
ON "AccountManagerInCompany" ("client", "deleted", "companyId", "accountManagerId", "expiryDate");

-- TerritoryOwner: prevent active duplicate (territoryId, salesPersonId)
CREATE INDEX IF NOT EXISTS idx_to_client_deleted_territory_salesperson_expiry
ON "TerritoryOwner" ("client", "deleted", "territoryId", "salesPersonId", "expiryDate");

-- SalesPersonTarget: prevent active duplicate (pipelineStageId, salesPersonId)
CREATE INDEX IF NOT EXISTS idx_spt_client_deleted_stage_salesperson_expiry
ON "SalesPersonTarget" ("client", "deleted", "pipelineStageId", "salesPersonId", "expiryDate");


