-- Fix index row size issues by limiting the length of text fields in functional indexes
-- This prevents exceeding PostgreSQL's btree version 4 maximum of 2704 bytes

-- Drop the problematic indexes
DROP INDEX IF EXISTS "OpportunityHistory_client_deleted_opp_lower_notes_idx";
DROP INDEX IF EXISTS "OpportunityHistory_client_deleted_opp_lower_url_idx";
DROP INDEX IF EXISTS "PersonRelationshipHistory_client_deleted_prId_lower_notes_idx";

-- Recreate with length-limited functional indexes
-- Limit text fields to first 500 characters to stay within btree limits
CREATE INDEX "OpportunityHistory_client_deleted_opp_lower_notes_idx"
ON "OpportunityHistory" ("client", "deleted", "opportunityId", substring(lower("notes"), 1, 500));

CREATE INDEX "OpportunityHistory_client_deleted_opp_lower_url_idx"
ON "OpportunityHistory" ("client", "deleted", "opportunityId", substring(lower("url"), 1, 500));

CREATE INDEX "PersonRelationshipHistory_client_deleted_prId_lower_notes_idx"
ON "PersonRelationshipHistory" ("client", "deleted", "personRelationshipId", substring(lower("notes"), 1, 500));