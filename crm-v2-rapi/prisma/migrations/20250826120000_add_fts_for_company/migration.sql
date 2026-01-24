-- PostgreSQL Full-Text Search (FTS) and Indexes for Company

-- 1) Add FTS column
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 2) Trigger function to compute weighted tsvector
CREATE OR REPLACE FUNCTION update_company_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    /* Weight A: primary name */
    setweight(to_tsvector('english', COALESCE(NEW."name", '')), 'A') ||
    /* Weight B: keywords */
    setweight(to_tsvector('english', COALESCE(NEW."keywords", '')), 'B') ||
    /* Weight C: descriptive/supporting text */
    setweight(to_tsvector('english', COALESCE(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."notes", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."companyIntelligence", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."city", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."industry", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."address1", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."address2", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."email", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."website", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."contactUrl", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."newsUrl", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."phone", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."fax", '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW."staffUrl", '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Trigger on relevant columns
DROP TRIGGER IF EXISTS company_search_vector_update ON "Company";
CREATE TRIGGER company_search_vector_update
  BEFORE INSERT OR UPDATE OF "name", "keywords", "description", "notes", "companyIntelligence", "city", "industry", "address1", "address2", "email", "website", "contactUrl", "newsUrl", "phone", "fax", "staffUrl"
  ON "Company"
  FOR EACH ROW
  EXECUTE FUNCTION update_company_search_vector();

-- 4) Backfill existing rows
UPDATE "Company"
SET search_vector =
  setweight(to_tsvector('english', COALESCE("name", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("keywords", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("description", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("notes", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("companyIntelligence", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("city", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("industry", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("address1", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("address2", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("email", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("website", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("contactUrl", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("newsUrl", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("phone", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("fax", '')), 'C') ||
  setweight(to_tsvector('english', COALESCE("staffUrl", '')), 'C')
WHERE search_vector IS NULL;

-- 5) Partial GIN index for FTS (non-concurrent inside migration; use CONCURRENTLY manually in prod if needed)
CREATE INDEX IF NOT EXISTS idx_company_search_vector ON "Company" USING GIN (search_vector) WHERE deleted IS NULL;

-- 6) Visibility compound index to speed up tenant + visibility filters
CREATE INDEX IF NOT EXISTS idx_company_visibility_search ON "Company" (
  "client",
  "deleted",
  "everyoneCanSeeIt",
  "anonymousCanSeeIt",
  "everyoneInObjectCompanyCanSeeIt"
) WHERE deleted IS NULL;

-- 7) Sorting index to help common ordering patterns
CREATE INDEX IF NOT EXISTS idx_company_sorting ON "Company" (
  "createdAt" DESC,
  "updatedAt" DESC,
  "id"
) WHERE deleted IS NULL;

-- 8) Update table stats
ANALYZE "Company";


