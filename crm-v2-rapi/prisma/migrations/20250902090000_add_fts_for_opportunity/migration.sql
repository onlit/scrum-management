-- PostgreSQL FTS for Opportunity

-- 1) (Optional) Extensions for accent-insensitive mode
-- CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Add FTS column
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 3) Trigger function to compute weighted tsvector
CREATE OR REPLACE FUNCTION update_Opportunity_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    /* Weight A: primary name */
    setweight(to_tsvector('english', COALESCE(NEW."name", '')), 'A') ||
    /* Weight B: short identifiers/labels */
    setweight(to_tsvector('english',
      COALESCE(NEW."customerPriority", '') || ' ' ||
      COALESCE(NEW."dataSource", '') || ' ' ||
      COALESCE(NEW."sentiment", '')
    ), 'B') ||
    /* Weight C: long-form text/others */
    setweight(to_tsvector('english',
      COALESCE(NEW."description", '') || ' ' ||
      COALESCE(NEW."notes", '') || ' ' ||
      COALESCE(NEW."color", '')
    ), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger on relevant columns
DROP TRIGGER IF EXISTS Opportunity_search_vector_update ON "Opportunity";
CREATE TRIGGER Opportunity_search_vector_update
  BEFORE INSERT OR UPDATE OF "name", "customerPriority", "dataSource", "sentiment", "description", "notes", "color"
  ON "Opportunity"
  FOR EACH ROW
  EXECUTE FUNCTION update_Opportunity_search_vector();

-- 5) Backfill existing rows
UPDATE "Opportunity"
SET search_vector =
  setweight(to_tsvector('english', COALESCE("name", '')), 'A') ||
  setweight(to_tsvector('english',
    COALESCE("customerPriority", '') || ' ' || COALESCE("dataSource", '') || ' ' || COALESCE("sentiment", '')
  ), 'B') ||
  setweight(to_tsvector('english',
    COALESCE("description", '') || ' ' || COALESCE("notes", '') || ' ' || COALESCE("color", '')
  ), 'C')
WHERE search_vector IS NULL;

-- 6) Partial GIN index on search_vector (non-concurrent for dev/CI)
CREATE INDEX IF NOT EXISTS idx_opportunity_search_vector ON "Opportunity" USING GIN (search_vector) WHERE deleted IS NULL;

-- 7) Optional compound/sorting indexes aligned with query patterns
CREATE INDEX IF NOT EXISTS idx_opportunity_visibility_search ON "Opportunity" (
  "client",
  "deleted",
  "everyoneCanSeeIt",
  "anonymousCanSeeIt",
  "everyoneInObjectCompanyCanSeeIt"
) WHERE deleted IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunity_sorting ON "Opportunity" (
  "createdAt" DESC,
  "updatedAt" DESC,
  "id"
) WHERE deleted IS NULL;

-- 8) Update table stats
ANALYZE "Opportunity";


