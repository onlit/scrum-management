-- Safe migration: guards index renames so missing legacy names won't fail the run.

-- =========================
-- DropIndex (safe)
-- =========================
DROP INDEX IF EXISTS "public"."idx_amc_client_deleted_company_manager_expiry";
DROP INDEX IF EXISTS "public"."idx_clps_client_deleted_createdat";
DROP INDEX IF EXISTS "public"."idx_clps_client_deleted_pipeline_order";
DROP INDEX IF EXISTS "public"."idx_clps_pipeline_deleted";
DROP INDEX IF EXISTS "public"."idx_company_contact_client_deleted_person_company";
DROP INDEX IF EXISTS "public"."idx_company_contact_company_deleted";
DROP INDEX IF EXISTS "public"."idx_company_contact_person_deleted";
DROP INDEX IF EXISTS "public"."idx_cit_client_deleted_company_territory_expiry";
DROP INDEX IF EXISTS "public"."idx_customer_enquiry_visibility_created_updated";
DROP INDEX IF EXISTS "public"."idx_opportunity_client_deleted_pipeline_company";
DROP INDEX IF EXISTS "public"."idx_opportunity_pipeline_deleted";
DROP INDEX IF EXISTS "public"."OpportunityHistory_opportunityId_deleted_createdAt_idx";
DROP INDEX IF EXISTS "public"."Person_client_deleted_id";
DROP INDEX IF EXISTS "public"."Person_client_deleted_parentId";
DROP INDEX IF EXISTS "public"."Person_client_deleted_parentId_personalMobile";
DROP INDEX IF EXISTS "public"."idx_person_in_marketing_list_client_deleted_ml_person";
DROP INDEX IF EXISTS "public"."idx_person_in_marketing_list_ml_deleted";
DROP INDEX IF EXISTS "public"."idx_person_in_marketing_list_person_deleted";
DROP INDEX IF EXISTS "public"."idx_person_relationship_client_deleted_createdat";
DROP INDEX IF EXISTS "public"."idx_person_relationship_client_deleted_person_relationship";
DROP INDEX IF EXISTS "public"."idx_person_relationship_relationshipid_deleted";
DROP INDEX IF EXISTS "public"."PersonRelationshipHistory_client_deleted_prId_createdAt_idx";
DROP INDEX IF EXISTS "public"."idx_relationship_client_deleted_createdat";
DROP INDEX IF EXISTS "public"."idx_spt_client_deleted_stage_salesperson_expiry";
DROP INDEX IF EXISTS "public"."idx_to_client_deleted_territory_salesperson_expiry";

-- =========================
-- AlterTable
-- =========================
ALTER TABLE "public"."AccountManagerInCompany" ALTER COLUMN "expiryDate" SET DATA TYPE DATE;
ALTER TABLE "public"."ActionPlan"            ALTER COLUMN "when"        SET DATA TYPE DATE;
ALTER TABLE "public"."CompanyContact"
  ALTER COLUMN "startDate" SET DATA TYPE DATE,
  ALTER COLUMN "endDate"   SET DATA TYPE DATE;
ALTER TABLE "public"."CompanyInTerritory"    ALTER COLUMN "expiryDate"  SET DATA TYPE DATE;
ALTER TABLE "public"."MarketingList"         ALTER COLUMN "expiryDate"  SET DATA TYPE DATE;
ALTER TABLE "public"."Opportunity"           ALTER COLUMN "estimatedCloseDate" SET DATA TYPE DATE;
ALTER TABLE "public"."Person"                ALTER COLUMN "dob"          SET DATA TYPE DATE;
ALTER TABLE "public"."PersonInMarketingList" ALTER COLUMN "expiryDate"   SET DATA TYPE DATE;
ALTER TABLE "public"."SalesPersonTarget"     ALTER COLUMN "expiryDate"   SET DATA TYPE DATE;
ALTER TABLE "public"."Territory"             ALTER COLUMN "expiryDate"   SET DATA TYPE DATE;
ALTER TABLE "public"."TerritoryOwner"        ALTER COLUMN "expiryDate"   SET DATA TYPE DATE;

-- =========================
-- CreateIndex
-- =========================
CREATE INDEX IF NOT EXISTS "CallSchedule_client_deleted_personId_callListId_callListPip_idx"
  ON "public"."CallSchedule"("client", "deleted", "personId", "callListId", "callListPipelineStageId");

CREATE INDEX IF NOT EXISTS "CallSchedule_client_deleted_callListPipelineStageId_schedul_idx"
  ON "public"."CallSchedule"("client", "deleted", "callListPipelineStageId", "scheduleDatetime");

CREATE INDEX IF NOT EXISTS "CompanyInTerritory_client_deleted_territoryId_companyId_exp_idx"
  ON "public"."CompanyInTerritory"("client", "deleted", "territoryId", "companyId", "expiryDate");

CREATE INDEX IF NOT EXISTS "Opportunity_pipelineId_deleted_createdAt_idx"
  ON "public"."Opportunity"("pipelineId", "deleted", "createdAt");

CREATE INDEX IF NOT EXISTS "Opportunity_statusId_deleted_idx"
  ON "public"."Opportunity"("statusId", "deleted");

-- =========================
-- RenameIndex (guarded)
-- Note: each rename only runs if the legacy name exists.
-- =========================
DO $$
BEGIN
  -- idx_client_client_deleted_company_contact -> Client_client_deleted_companyContactId_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'idx_client_client_deleted_company_contact'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."idx_client_client_deleted_company_contact"
             RENAME TO "Client_client_deleted_companyContactId_idx"';
  END IF;

  -- idx_client_client_deleted_opportunity -> Client_client_deleted_opportunityId_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'idx_client_client_deleted_opportunity'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."idx_client_client_deleted_opportunity"
             RENAME TO "Client_client_deleted_opportunityId_idx"';
  END IF;

  -- idx_cit_company_deleted -> CompanyInTerritory_companyId_deleted_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'idx_cit_company_deleted'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."idx_cit_company_deleted"
             RENAME TO "CompanyInTerritory_companyId_deleted_idx"';
  END IF;

  -- idx_cit_territory_deleted -> CompanyInTerritory_territoryId_deleted_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'idx_cit_territory_deleted'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."idx_cit_territory_deleted"
             RENAME TO "CompanyInTerritory_territoryId_deleted_idx"';
  END IF;

  -- idx_opportunity_influencer_company_contact_deleted -> OpportunityInfluencer_companyContactId_deleted_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'idx_opportunity_influencer_company_contact_deleted'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."idx_opportunity_influencer_company_contact_deleted"
             RENAME TO "OpportunityInfluencer_companyContactId_deleted_idx"';
  END IF;

  -- idx_opportunity_influencer_opportunity_deleted -> OpportunityInfluencer_opportunityId_deleted_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'idx_opportunity_influencer_opportunity_deleted'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."idx_opportunity_influencer_opportunity_deleted"
             RENAME TO "OpportunityInfluencer_opportunityId_deleted_idx"';
  END IF;

  -- PipelineStage_pipeline_deleted_order_idx -> PipelineStage_pipelineId_deleted_order_idx
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i'
      AND n.nspname = 'public'
      AND c.relname = 'PipelineStage_pipeline_deleted_order_idx'
  ) THEN
    EXECUTE 'ALTER INDEX "public"."PipelineStage_pipeline_deleted_order_idx"
             RENAME TO "PipelineStage_pipelineId_deleted_order_idx"';
  END IF;
END
$$ LANGUAGE plpgsql;
