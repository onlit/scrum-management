-- Indexes to optimize controller-level uniqueness checks and common filters

-- MarketingList: support case-insensitive name duplicate checks under tenant and soft-delete
CREATE INDEX IF NOT EXISTS idx_marketing_list_client_deleted_lower_name
ON "MarketingList" ("client", "deleted", lower("name"));

-- PersonInMarketingList: support duplicate pair checks and FK-targeted filters
CREATE INDEX IF NOT EXISTS idx_person_in_marketing_list_client_deleted_ml_person
ON "PersonInMarketingList" ("client", "deleted", "marketingListId", "personId");

CREATE INDEX IF NOT EXISTS idx_person_in_marketing_list_ml_deleted
ON "PersonInMarketingList" ("marketingListId", "deleted");

CREATE INDEX IF NOT EXISTS idx_person_in_marketing_list_person_deleted
ON "PersonInMarketingList" ("personId", "deleted");


