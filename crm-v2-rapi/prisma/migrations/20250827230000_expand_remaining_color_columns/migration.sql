-- Expand remaining color column lengths to store full RGBA values like 'rgba(255, 235, 59, 0.25)'
-- This migration covers all models with color fields except Company and PipelineStage (already migrated)
-- Safe to run repeatedly; uses standard ALTER COLUMN statements

-- Relationship.color
ALTER TABLE "Relationship"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- SocialMediaType.color
ALTER TABLE "SocialMediaType"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- Territory.color
ALTER TABLE "Territory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- Channel.color
ALTER TABLE "Channel"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CustomerEnquiryPurpose.color
ALTER TABLE "CustomerEnquiryPurpose"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CustomerEnquiryStatus.color
ALTER TABLE "CustomerEnquiryStatus"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- Pipeline.color
ALTER TABLE "Pipeline"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CallListPipeline.color
ALTER TABLE "CallListPipeline"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CallListPipelineStage.color
ALTER TABLE "CallListPipelineStage"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- Person.color
ALTER TABLE "Person"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- MarketingList.color
ALTER TABLE "MarketingList"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CompanyHistory.color
ALTER TABLE "CompanyHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CompanySocialMedia.color
ALTER TABLE "CompanySocialMedia"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CompanySpin.color
ALTER TABLE "CompanySpin"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- AccountManagerInCompany.color
ALTER TABLE "AccountManagerInCompany"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CompanyInTerritory.color
ALTER TABLE "CompanyInTerritory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- PersonHistory.color
ALTER TABLE "PersonHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- PersonSocialMedia.color
ALTER TABLE "PersonSocialMedia"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- PersonInMarketingList.color
ALTER TABLE "PersonInMarketingList"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- PersonRelationship.color
ALTER TABLE "PersonRelationship"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- TerritoryOwner.color
ALTER TABLE "TerritoryOwner"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CompanyContact.color
ALTER TABLE "CompanyContact"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CustomerEnquiry.color
ALTER TABLE "CustomerEnquiry"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CallList.color
ALTER TABLE "CallList"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- PersonRelationshipHistory.color
ALTER TABLE "PersonRelationshipHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- SalesPersonTarget.color
ALTER TABLE "SalesPersonTarget"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- Opportunity.color
ALTER TABLE "Opportunity"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CallSchedule.color
ALTER TABLE "CallSchedule"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- Client.color
ALTER TABLE "Client"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- TargetActualHistory.color
ALTER TABLE "TargetActualHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- OpportunityInfluencer.color
ALTER TABLE "OpportunityInfluencer"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- OpportunityProduct.color
ALTER TABLE "OpportunityProduct"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- OpportunityHistory.color
ALTER TABLE "OpportunityHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- ActionPlan.color
ALTER TABLE "ActionPlan"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- DataNeeded.color
ALTER TABLE "DataNeeded"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- CallHistory.color
ALTER TABLE "CallHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- ClientHistory.color
ALTER TABLE "ClientHistory"
  ALTER COLUMN "color" TYPE VARCHAR(40);

-- OnlineSignup.color
ALTER TABLE "OnlineSignup"
  ALTER COLUMN "color" TYPE VARCHAR(40);
