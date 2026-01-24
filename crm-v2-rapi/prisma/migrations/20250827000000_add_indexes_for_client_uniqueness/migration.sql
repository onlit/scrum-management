-- OpportunityInfluencer indexes for controller-level uniqueness checks and filters
CREATE INDEX IF NOT EXISTS idx_opportunity_influencer_client_deleted_opportunity_company_contact
  ON "OpportunityInfluencer" ("client", "deleted", "opportunityId", "companyContactId");

CREATE INDEX IF NOT EXISTS idx_opportunity_influencer_opportunity_deleted
  ON "OpportunityInfluencer" ("opportunityId", "deleted");

CREATE INDEX IF NOT EXISTS idx_opportunity_influencer_company_contact_deleted
  ON "OpportunityInfluencer" ("companyContactId", "deleted");

-- OpportunityInfluencer indexes to accelerate controller-level uniqueness and lookups
-- We avoid DB unique constraints; controller enforces soft-delete-aware uniqueness.

-- Composite index for tenant-scoped duplicate checks
CREATE INDEX IF NOT EXISTS idx_opportunity_influencer_client_deleted_opp_contact
ON "OpportunityInfluencer" ("client", "deleted", "opportunityId", "companyContactId");

-- Covering indexes for common filters
CREATE INDEX IF NOT EXISTS idx_opportunity_influencer_opportunity_deleted
ON "OpportunityInfluencer" ("opportunityId", "deleted");

CREATE INDEX IF NOT EXISTS idx_opportunity_influencer_company_contact_deleted
ON "OpportunityInfluencer" ("companyContactId", "deleted");


