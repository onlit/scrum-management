## PostgreSQL Full‑Text Search (FTS) + GIN Migration Guide

Audience: Human developer or LLM agent

Goal: For any Prisma model that participates in list search, add production‑safe PostgreSQL FTS using a `tsvector` column, trigger, and partial GIN index; then verify the application switches to the optimized code path in `src/utils/shared/databaseUtils.js`.

### Why this matters
- Our pagination/search code auto‑detects a `search_vector` column to enable fast FTS queries using `to_tsquery` + GIN.
- Without it, we fall back to ILIKE‑based search, which is slower and less relevant for large datasets.

### Pre‑requisites
- Postgres 12+ (GIN/tsvector are built‑in).
- Prisma migrations enabled (`prisma migrate dev` / `prisma migrate deploy`).
- DB role can create functions, triggers, and indexes.

### How the app switches to FTS
`databaseUtils.checkFullTextSearchSupport()` checks if the table has a `search_vector` column. If present, `getOptimizedPaginatedList()` builds a `to_tsquery` and executes an FTS query with ranking; otherwise it falls back to regular search.

#### Safer query builder for user input
- Prefer `websearch_to_tsquery('english', $1)` (Google-like syntax) or `plainto_tsquery` for free‑text user input. These are more forgiving than raw `to_tsquery` and reduce syntax errors from special characters.
- If you enable accent-insensitive search, wrap the term as `websearch_to_tsquery('english', unaccent($1))` and ensure your index uses `unaccent(...)` in the trigger.
- If you switch from `to_tsquery` to `websearch_to_tsquery`, update the raw SQL used by the runtime FTS path accordingly.

### Per‑model checklist
1) Identify searchable models and fields
   - Inspect controllers for `getPaginatedList` / `getOptimizedPaginatedList` calls and read `searchFields` used for that model.
   - Typical candidates: name/title, code/sku, description/notes.

2) Choose FTS weights
   - Use weights A > B > C for importance:
     - A: title/name
     - B: code/identifier
     - C: description/notes/other text

3) Create a migration with SQL that:
   - Adds a `search_vector` column (`tsvector`).
   - Creates `update_<table>_search_vector()` trigger function that builds the vector from chosen fields with weights.
   - Creates a BEFORE INSERT/UPDATE trigger on those fields.
   - Backfills `search_vector` for existing rows.
   - Creates a partial GIN index on `search_vector` (WHERE `deleted IS NULL`). Use CONCURRENTLY in prod.
   - Optionally creates composite/sorting indexes for filters (see template below or `generateSearchIndexes(model)`).
   - ANALYZE the table.

4) Apply migration
   - Dev: `prisma migrate dev`
   - CI/Prod: `prisma migrate deploy`

5) Verify
   - SQL: check column/trigger/index existence; `EXPLAIN ANALYZE` on a query using `search_vector @@ to_tsquery(...)` shows GIN index usage.
   - App: hit the list API with `search` param; verify results + performance. The FTS path will run automatically if `search_vector` exists.

6) Monitor and iterate
   - Review slow query logs. Adjust weights/fields if needed.
   - Consider optional accent‑insensitive mode (see below) if your users commonly omit diacritics.

### Field selection by Prisma type (searchFields vs filterFields)

Use this policy to keep search semantics, validation, and indexing aligned with runtime behavior in `src/utils/shared/databaseUtils.js`.

- **searchFields (free‑text relevance, OR’ed; FTS/ILIKE path)**
  - Include: human‑authored `String` columns intended for text search.
    - Examples: name/title (weight A), code/identifier (weight B), notes/description (weight C).
  - Exclude: IDs/FKs (`id`, `uuid`, `cuid`, `...Id`), `Enum`, numeric (`Int`/`BigInt`/`Float`/`Decimal`), `DateTime`, `Boolean`, `Json`/`Bytes`/composites, relation objects.
  - Reason: Only text should participate in FTS/ILIKE; non‑text harms relevance or fails.

- **filterFields (typed AND predicates; also the sort whitelist)**
  - Include: scalar fields you want clients to filter on (equals/in/range) and are OK to sort by.
    - Examples: IDs/FKs (`...Id`), `Enum`, numeric, `DateTime`, `Boolean`, and short text (e.g., name/code) if sortable.
  - Exclude: very long text (e.g., `notes`) if you don’t want it sortable or used in exact equality filters.
  - Note: allowed ordering = `filterFields ∪ {createdAt, updatedAt, id}`. If a field shouldn’t be orderable, don’t include it in `filterFields`.

This separation ensures:
- Search uses GIN‑accelerated `search_vector` on text only.
- Filters use schema‑validated, type‑aware conditions (equals/in/range) benefiting from B‑tree/compound indexes.
- Stable and safe sorting behavior tied to an explicit whitelist.

### Migration template (replace placeholders)

Placeholders:
- <TABLE> = exact Postgres table name (Prisma model `X` maps to table `"X"` by default)
- <model> = lowerCamel Prisma delegate name used by Prisma client (e.g., `account`)
- <A_FIELDS>, <B_FIELDS>, <C_FIELDS> = list of text columns to weight
- <TRIGGER_NAME> = `<table>_search_vector_update`
- <FUNC_NAME> = `update_<table>_search_vector`

Notes:
- Use `CREATE INDEX CONCURRENTLY` in production to avoid long locks. (Prisma regular migrations run inside a transaction which forbids CONCURRENTLY; for prod you can break this into two migrations or run a one‑off SQL script following your release procedures.)
- Keep the column name exactly `search_vector` so the app detects FTS automatically.

```sql
-- 1) (Optional) Enable extensions if you plan accent-insensitive search later
-- CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Add FTS column
ALTER TABLE "<TABLE>" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- 3) Trigger function to compute weighted tsvector
CREATE OR REPLACE FUNCTION <FUNC_NAME>() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    /* Weight A */ (
      /* Replace fields as needed, wrap with unaccent(...) if using that mode */
      setweight(to_tsvector('english', COALESCE(NEW."<A_FIELDS>", '')), 'A')
    ) ||
    /* Weight B */ (
      setweight(to_tsvector('english', COALESCE(NEW."<B_FIELDS>", '')), 'B')
    ) ||
    /* Weight C */ (
      setweight(to_tsvector('english', COALESCE(NEW."<C_FIELDS>", '')), 'C')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4) Trigger on relevant columns
DROP TRIGGER IF EXISTS <TRIGGER_NAME> ON "<TABLE>";
CREATE TRIGGER <TRIGGER_NAME>
  BEFORE INSERT OR UPDATE OF "<A_FIELDS>", "<B_FIELDS>", "<C_FIELDS>"
  ON "<TABLE>"
  FOR EACH ROW
  EXECUTE FUNCTION <FUNC_NAME>();

-- 5) Backfill existing rows (single statement is fine for small/medium tables)
UPDATE "<TABLE>"
SET search_vector =
  setweight(to_tsvector('english', COALESCE("<A_FIELDS>", '')), 'A') ||
  setweight(to_tsvector('english', COALESCE("<B_FIELDS>", '')), 'B') ||
  setweight(to_tsvector('english', COALESCE("<C_FIELDS>", '')), 'C')
WHERE search_vector IS NULL;

-- 6) Partial GIN index on search_vector (use CONCURRENTLY in prod)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_<model>_search_vector ON "<TABLE>" USING GIN (search_vector) WHERE deleted IS NULL;
CREATE INDEX IF NOT EXISTS idx_<model>_search_vector ON "<TABLE>" USING GIN (search_vector) WHERE deleted IS NULL;

-- 7) Optional composite/sorting indexes based on our query patterns
-- Visibility/filter compound index
CREATE INDEX IF NOT EXISTS idx_<model>_visibility_search ON "<TABLE>" (
  "client",
  "deleted",
  "everyoneCanSeeIt",
  "anonymousCanSeeIt",
  "everyoneInObjectCompanyCanSeeIt"
) WHERE deleted IS NULL;

-- Type/tenant compound index (adjust to your model)
-- CREATE INDEX IF NOT EXISTS idx_<model>_type_tenant ON "<TABLE>" (
--   "<someTypeId>",
--   "tenantId",
--   "isActive",
--   "deleted"
-- ) WHERE deleted IS NULL;

-- Sorting index
CREATE INDEX IF NOT EXISTS idx_<model>_sorting ON "<TABLE>" (
  "createdAt" DESC,
  "updatedAt" DESC,
  "id"
) WHERE deleted IS NULL;

Note: If results are ordered by relevance (rank) then `createdAt` as a tiebreaker in the app, this index helps Postgres avoid repeated sorts on the filtered set.

-- 8) Update table stats
ANALYZE "<TABLE>";
```

For very large tables, prefer a batched backfill (example approach):
1) Create the column and trigger first (trigger keeps new/changed rows updated).
2) Backfill in batches using primary key ranges or `ctid` pagination.
3) Create the GIN index CONCURRENTLY after or during backfill.

Operational tips for large rollouts:
- Consider temporarily lowering autovacuum thresholds for the table during heavy backfill, or run an explicit `VACUUM (ANALYZE)` after backfill completes.
- Use `CREATE INDEX CONCURRENTLY` in a separate, non-transactional migration to avoid long locks in production.
- Monitor lock waits during index creation and schedule during low traffic windows.

### Example: `Account` (already implemented)
See `prisma/migrations/20250821_add_fulltext_search/migration.sql` for a concrete reference with `accountName`, `accountCode`, and `notes`.

### Commands to generate/apply the migration
- Create an empty migration and edit the SQL file:
  - Dev: `npx prisma migrate dev --create-only --name add_fts_<model>`
  - Edit the generated `migration.sql` using the template above.
- Apply:
  - Dev: `npx prisma migrate dev`
  - CI/Prod: `npx prisma migrate deploy`

### Verification steps
SQL checks:
```sql
-- Column exists
SELECT column_name FROM information_schema.columns WHERE table_name = '<table>' AND column_name = 'search_vector';

-- Trigger exists
SELECT tgname FROM pg_trigger WHERE tgrelid = '"<TABLE>"'::regclass AND tgname = '<TRIGGER_NAME>';

-- Index in place
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '<table>' AND indexname = 'idx_<model>_search_vector';

-- Execution plan uses GIN
EXPLAIN ANALYZE
SELECT id
FROM "<TABLE>"
WHERE deleted IS NULL
  AND search_vector @@ to_tsquery('english', 'foo:* & bar:*')
LIMIT 10;
```

Application checks:
- Hit the list endpoint with a `search` term; confirm responses and latency improved.
- The system auto‑switches to FTS when `search_vector` exists; no app code change needed.
- Check app logs for `[FTS_SUPPORTED] Model: <model>, Supported: true` and a `[PROF]` line showing reduced `items=` time compared to baseline.
- Optionally, run `EXPLAIN (ANALYZE, BUFFERS)` for a representative search query in a staging environment to confirm GIN usage and reasonable I/O.

### Monitoring after deploy
- Sample `EXPLAIN (ANALYZE, BUFFERS)` for representative queries; ensure `Bitmap Index Scan` or `Index Scan using idx_<model>_search_vector` is present.
- Watch `pg_stat_user_indexes` and `pg_stat_all_tables` for index hit ratios and sequential scans.
- Track slow query logs and adjust weights/fields if residual slow searches appear.

### Optional: Accent‑insensitive FTS
If your users often omit accents, consider stripping diacritics at both index and query time.

1) Enable extension once per DB:
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```
2) Wrap fields with `unaccent(...)` in the trigger function and backfill SQL.
3) Update the query to also unaccent the search term. If you choose this mode, adjust the raw SQL used by `executeFullTextSearchQuery` to:
```sql
... search_vector @@ to_tsquery('english', unaccent($1))
```
Note: Keep the same tsconfig (`english`) unless you have a multilingual strategy.

### Multilingual considerations
- Choose the most relevant text search configuration (`english`, `simple`, or locale‑specific) per table. Mixed‑language data may work best with `simple` unless you segment by language.
- For truly multilingual search, consider storing multiple weighted vectors per language or a denormalized combined vector with the `simple` config.

### Fallback: Fast ILIKE with trigram
If you must retain `%term%` semantics without FTS, add trigram support and index the most searched fields.

1) Enable extension once:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```
2) Create indexes on `lower(...)` of common fields (e.g., `name`, `email`). For many columns, consider a concatenated column maintained by trigger.
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_name_trgm
  ON "Company" USING gin (lower("name") gin_trgm_ops) WHERE deleted IS NULL;
```
3) Query using `lower(field) ILIKE lower($1)` or `ILIKE '%' || $1 || '%'` and ensure the planner uses the trigram index.

This avoids wide `OR` trees and keeps scans fast for ILIKE paths.

### Parameterization with Prisma v6
- Use tagged templates with `Prisma.sql` for `$queryRaw` to retain plan caching and safety.
- Avoid passing plain strings with positional placeholders directly to `$queryRaw`.

Example:
```js
const { Prisma } = require('@prisma/client');

const result = await prisma.$queryRaw(Prisma.sql`
  SELECT id
  FROM "Company"
  WHERE deleted IS NULL
    AND search_vector @@ websearch_to_tsquery('english', ${searchTerm})
  LIMIT ${take} OFFSET ${skip}
`);
```

### Naming conventions
- Column: `search_vector`
- Trigger function: `update_<table>_search_vector`
- Trigger: `<table>_search_vector_update`
- Indexes:
  - `idx_<model>_search_vector`
  - `idx_<model>_visibility_search`
  - `idx_<model>_sorting`
  - Add model‑specific compound index names as needed

### Rollback guidance (manual)
Order matters:
```sql
DROP INDEX IF EXISTS idx_<model>_search_vector;
DROP TRIGGER IF EXISTS <TRIGGER_NAME> ON "<TABLE>";
DROP FUNCTION IF EXISTS <FUNC_NAME>();
ALTER TABLE "<TABLE>" DROP COLUMN IF EXISTS "search_vector";
```

### Prisma schema notes
- `schema.prisma` does not support `tsvector`, triggers, or GIN/partial indexes. Keep using SQL migrations for these.
- You can (and should) keep B‑Tree indexes for common filters/sorts in `schema.prisma` with `@@index` to complement FTS.

### Automating model analysis (LLM agent checklist)
1) Parse `prisma/schema.prisma` for models; for each model, locate controllers/services that call `getPaginatedList`/`getOptimizedPaginatedList` with that model.
2) Extract `searchFields` used for the model. If none, skip FTS for that model.
3) Assign weights: prefer `name/title` → A, `code/identifier` → B, `notes/description` → C.
4) Generate a migration using the template; fill placeholders with exact table name and fields.
5) If the model has soft delete (`deleted`), ensure the GIN index is partial with `WHERE deleted IS NULL`.
6) Include suitable compound/sorting indexes informed by `filterFields` for that model.
7) Add an ANALYZE statement.
8) Emit verification SQL and a brief testing checklist.

This guide ensures consistency and safe rollouts of FTS across models, and aligns with the runtime behavior in `src/utils/shared/databaseUtils.js`.



### Copy‑paste LLM prompt to generate/update migrations

You can hand this prompt to any capable LLM together with your current `prisma/schema.prisma` and the controller files that declare `searchFields`/`filterFields`.

```
You are assisting with adding PostgreSQL Full‑Text Search (FTS) support to a Prisma app.

Inputs I will provide:
- prisma/schema.prisma
- One or more controller/service files that call getPaginatedList/getOptimizedPaginatedList and define searchFields/filterFields per model

Your tasks per model that participates in list search:
1) Determine searchFields and filterFields
   - searchFields: only human‑authored String columns intended for free‑text search
     - Weight A: name/title; Weight B: code/identifier; Weight C: notes/description
   - filterFields: scalar fields allowed for equals/in/range filters and ordering (IDs/FKs, enums, numerics, DateTime, booleans, and short text)
   - Do not include very long text in filterFields if we do not want it sortable

2) Emit a migration SQL for each model adding FTS and indexes, following exactly this template:
   - Add column: ALTER TABLE "<TABLE>" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;
   - Create function: update_<table>_search_vector()
     - Build weighted tsvector from chosen searchFields
   - Create trigger: <table>_search_vector_update BEFORE INSERT OR UPDATE OF <fields>
   - Backfill search_vector for existing rows
   - Create partial GIN index on search_vector (WHERE deleted IS NULL)
   - Create optional compound/sorting indexes informed by filterFields and visibility patterns
   - ANALYZE the table

3) Keep the column name exactly search_vector so runtime code auto‑detects FTS via checkFullTextSearchSupport().

4) Output for each model:
   - The filled SQL migration section with <TABLE>, <model>, <A_FIELDS>/<B_FIELDS>/<C_FIELDS>, trigger/function names resolved
   - A brief note of which searchFields and filterFields you used and why (by Prisma type)
   - Verification SQL snippets (column/trigger/index existence, EXPLAIN ANALYZE using to_tsquery)

5) Do not modify schema.prisma for tsvector/trigger/indexes (Prisma does not support these); keep it in raw SQL migrations.

6) For production rollouts, mention that CREATE INDEX CONCURRENTLY may require a separate non-transactional migration.

Now analyze the provided schema and controllers and generate the migration SQL per model.
```