-- OpportunityHistory targeted indexes for controller-level uniqueness checks and list performance

-- Speeds duplicate URL checks within tenant and per opportunity
CREATE INDEX "OpportunityHistory_client_deleted_opp_lower_url_idx"
ON "OpportunityHistory" ("client", "deleted", "opportunityId", lower("url"));

-- Speeds duplicate notes checks within tenant and per opportunity
CREATE INDEX "OpportunityHistory_client_deleted_opp_lower_notes_idx"
ON "OpportunityHistory" ("client", "deleted", "opportunityId", lower("notes"));

-- Speeds lists and FK lookups by opportunityId under soft-delete and tenant filters
CREATE INDEX "OpportunityHistory_opportunityId_deleted_createdAt_idx"
ON "OpportunityHistory" ("opportunityId", "deleted", "createdAt");


