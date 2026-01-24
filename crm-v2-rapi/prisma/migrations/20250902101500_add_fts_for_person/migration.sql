-- PostgreSQL FTS for Person

-- 1) (Optional) Enable extensions if you plan accent-insensitive search later
-- CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Add FTS column
ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 3) Trigger function to compute weighted tsvector
CREATE OR REPLACE FUNCTION update_Person_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    /* Weight A: person names */ (
      setweight(
        to_tsvector(
          'english',
          COALESCE(NEW."firstName", '') || ' ' ||
          COALESCE(NEW."lastName", '') || ' ' ||
          COALESCE(NEW."preferredName", '') || ' ' ||
          COALESCE(NEW."middleName", '')
        ), 'A'
      )
    ) ||
    /* Weight B: identifiers */ (
      setweight(
        to_tsvector(
          'english',
          COALESCE(NEW."email", '') || ' ' ||
          COALESCE(NEW."username", '')
        ), 'B'
      )
    ) ||
    /* Weight C: other descriptive fields */ (
      setweight(
        to_tsvector(
          'english',
          COALESCE(NEW."notes", '') || ' ' ||
          COALESCE(NEW."sourceNotes", '') || ' ' ||
          COALESCE(NEW."city", '') || ' ' ||
          COALESCE(NEW."state", '') || ' ' ||
          COALESCE(NEW."address1", '') || ' ' ||
          COALESCE(NEW."address2", '') || ' ' ||
          COALESCE(NEW."owner", '') || ' ' ||
          COALESCE(NEW."source", '') || ' ' ||
          COALESCE(NEW."color", '') || ' ' ||
          COALESCE(NEW."zip", '') || ' ' ||
          COALESCE(NEW."homePhone", '') || ' ' ||
          COALESCE(NEW."personalMobile", '')
        ), 'C'
      )
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger on relevant columns
DROP TRIGGER IF EXISTS Person_search_vector_update ON "Person";
CREATE TRIGGER Person_search_vector_update
  BEFORE INSERT OR UPDATE OF "firstName", "lastName", "preferredName", "middleName",
                                 "email", "username",
                                 "notes", "sourceNotes", "city", "state", "address1", "address2",
                                 "owner", "source", "color", "zip", "homePhone", "personalMobile"
  ON "Person"
  FOR EACH ROW
  EXECUTE FUNCTION update_Person_search_vector();

-- 5) Backfill existing rows (single statement is fine for small/medium tables)
UPDATE "Person"
SET search_vector =
  setweight(to_tsvector('english', COALESCE("firstName", '') || ' ' || COALESCE("lastName", '') || ' ' || COALESCE("preferredName", '') || ' ' || COALESCE("middleName", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("email", '') || ' ' || COALESCE("username", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("notes", '') || ' ' || COALESCE("sourceNotes", '') || ' ' || COALESCE("city", '') || ' ' || COALESCE("state", '') || ' ' || COALESCE("address1", '') || ' ' || COALESCE("address2", '') || ' ' || COALESCE("owner", '') || ' ' || COALESCE("source", '') || ' ' || COALESCE("color", '') || ' ' || COALESCE("zip", '') || ' ' || COALESCE("homePhone", '') || ' ' || COALESCE("personalMobile", '')), 'C')
WHERE search_vector IS NULL;

-- 6) Partial GIN index on search_vector (use CONCURRENTLY in prod if needed)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_person_search_vector ON "Person" USING GIN (search_vector) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_person_search_vector ON "Person" USING GIN (search_vector) WHERE deleted IS NULL;

-- 7) Optional composite/sorting indexes based on our query patterns
-- Visibility/filter compound index
CREATE INDEX IF NOT EXISTS idx_person_visibility_search ON "Person" (
  "client",
  "deleted",
  "everyoneCanSeeIt",
  "anonymousCanSeeIt",
  "everyoneInObjectCompanyCanSeeIt"
) WHERE deleted IS NULL;

-- Sorting index
CREATE INDEX IF NOT EXISTS idx_person_sorting ON "Person" (
  "createdAt" DESC,
  "updatedAt" DESC,
  "id"
) WHERE deleted IS NULL;

-- 8) Update table stats
ANALYZE "Person";


