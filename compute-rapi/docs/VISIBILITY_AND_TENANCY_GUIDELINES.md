## Prisma visibility and tenancy guidelines

These rules define how to apply per-tenant visibility and soft-delete logic consistently across all Prisma queries and writes in this codebase. Follow them for every model that has the standard visibility fields.

### Scope and fields
- **Tenant key**: `client: String @db.Uuid()`
- **Ownership**: `createdBy`, `updatedBy`
- **Soft delete**: `deleted: DateTime?` (null means active)
- **Visibility attributes**:
  - `everyoneCanSeeIt: Boolean` — globally visible across tenants (public)
  - `anonymousCanSeeIt: Boolean` — visible to unauthenticated (and authenticated) users
  - `everyoneInObjectCompanyCanSeeIt: Boolean` — visible to everyone in the same tenant/company
  - `onlyTheseUsersCanSeeIt: Json` — array of strings `${userId}|${userEmail}`
  - `onlyTheseRolesCanSeeIt: Json` — array of strings `${userId}|${roleName}`

### Core principles
1. Always filter out soft-deleted rows: add `deleted: null` in read queries.
2. Global/public records must remain cross-tenant:
   - `everyoneCanSeeIt: true` and `anonymousCanSeeIt: true` are NOT scoped by `client`.
3. All other visibility branches are tenant-scoped by `client`.
4. Integrity queries (uniqueness checks, foreign-key validation, derivations) must be strictly tenant-scoped and must NOT use OR-based visibility; they should ignore public flags.
5. Never trust input for `client`, `createdBy`, `updatedBy` if `user.isAuthenticated === true`.

### Standard helper usage
Use `getVisibilityFilters(user, options)` to compose read-time visibility. Its logical shape should be:
- `AND`: always includes `{ deleted: null }`.
- `OR` branches:
  - Public (unscoped): `{ everyoneCanSeeIt: true }`, `{ anonymousCanSeeIt: true }` (toggle via option if needed)
  - Tenant-scoped: `{ client: user.client.id, createdBy: user.id }`, `{ client: user.client.id, everyoneInObjectCompanyCanSeeIt: true }`, `{ client: user.client.id, onlyTheseUsersCanSeeIt: { array_contains: ["${user.id}|${user.email}"] } }`, role branches with `{ client: user.client.id, onlyTheseRolesCanSeeIt: { array_contains: ["${userId}|${roleName}"] } }`.

Recommended extension:
```js
// visibilityUtils.js
function getVisibilityFilters(user, { includeGlobal = true } = {}) {
  const client = user?.client?.id;
  const baseAnd = [{ deleted: null }];
  const or = [];

  if (includeGlobal) {
    or.push({ everyoneCanSeeIt: true }, { anonymousCanSeeIt: true });
  }

  if (user?.isAuthenticated) {
    or.push(
      { client, createdBy: user.id },
      { client, everyoneInObjectCompanyCanSeeIt: true },
      { client, onlyTheseUsersCanSeeIt: { array_contains: [`${user.id}|${user.email}`] } },
      ...transform(user?.roles).map((roleTag) => ({
        client,
        onlyTheseRolesCanSeeIt: { array_contains: [roleTag] },
      })),
    );
  } else {
    // anonymous users should still see anonymous/public content
    if (!includeGlobal) {
      or.push({ anonymousCanSeeIt: true });
    }
  }

  return { AND: [...baseAnd, { OR: or }] };
}
```

### Write-time helpers
- Use `buildCreateRecordPayload({ validatedValues, requestBody, user, relations })` for all creates. It sets `client`, `createdBy`, `updatedBy` from `user` for authenticated requests and sanitizes relation connects.
- On updates, always set `updatedBy = user.id`.
- Soft delete by setting `deleted = new Date()` (and `updatedBy`). Avoid hard deletes.

### Controller-level conventions
- For user-facing reads (list/detail), pass `getVisibilityFilters(user)` into `where.AND`.
- For integrity checks (e.g., uniqueness, FK existence, deriving defaults), use strict tenant scope: `{ client: user.client.id, deleted: null, ... }` without `OR` visibility.
- When switching pipelines/status, validate in tenant scope and update `statusAssignedDate` if status changes.

---

## Query patterns by Prisma method

Use these patterns to ensure consistent visibility and tenancy across the app. Replace `Model` with your model name and merge any additional business filters.

### findMany (lists)
```js
const results = await prisma.model.findMany({
  where: {
    AND: [
      getVisibilityFilters(user, { includeGlobal: true }),
      // add business filters here (e.g., deleted: null not needed; already in helper)
      extraWhere,
    ],
  },
  include,
  orderBy,
  take,
  skip,
});
```

### findFirst / findUnique (detail)
```js
const record = await prisma.model.findFirst({
  where: {
    id: params.id,
    AND: [getVisibilityFilters(user, { includeGlobal: true })],
  },
  include,
});
```

### count / aggregate / groupBy
```js
const total = await prisma.model.count({
  where: { AND: [getVisibilityFilters(user, { includeGlobal: true }), extraWhere] },
});

const agg = await prisma.model.aggregate({
  where: { AND: [getVisibilityFilters(user, { includeGlobal: true }), extraWhere] },
  _sum: { estimatedValue: true },
});

const grouped = await prisma.model.groupBy({
  by: ['statusId'],
  where: { AND: [getVisibilityFilters(user, { includeGlobal: true }), extraWhere] },
  _count: { _all: true },
});
```

### create
```js
const created = await prisma.model.create({
  data: buildCreateRecordPayload({
    user,
    validatedValues,
    requestBody: req.body,
    relations: ['companyId', 'personId', /* ... */],
  }),
  include,
});
```

### update / updateMany
```js
// Guard: fetch current in visibility scope
const current = await prisma.model.findFirst({
  where: { id: params.id, ...getVisibilityFilters(user).AND[0] },
  select: { id: true, client: true },
});
if (!current) throw notFound();

const updated = await prisma.model.update({
  where: { id: params.id },
  data: { ...values, updatedBy: user.id },
});

// For bulk updates, combine tenant scope and business filters explicitly as needed
await prisma.model.updateMany({
  where: { client: user.client.id, deleted: null, ...filters },
  data: { ...bulkValues, updatedBy: user.id },
});
```

### upsert
Avoid OR-based visibility here. Resolve the target strictly within tenant scope.
```js
const whereTenant = { client: user.client.id, deleted: null };
const existing = await prisma.model.findFirst({ where: { ...whereTenant, uniqueKey: value } });

const upserted = await prisma.model.upsert({
  where: { id: existing?.id ?? '00000000-0000-0000-0000-000000000000' },
  create: buildCreateRecordPayload({ user, validatedValues, requestBody: req.body, relations }),
  update: { ...values, updatedBy: user.id },
});
```

### delete (soft) / deleteMany (soft)
```js
// Soft delete dependents first if needed
await prisma.dependent.updateMany({
  where: { parentId: params.id, client: user.client.id, deleted: null },
  data: { deleted: new Date(), updatedBy: user.id },
});

// Soft delete the main record
const result = await prisma.model.updateMany({
  where: { id: params.id, client: user.client.id, deleted: null },
  data: { deleted: new Date(), updatedBy: user.id },
});
```

### Integrity queries (strict tenant scope)
Do NOT use `getVisibilityFilters` here. These are not user-facing visibility checks.
```js
// Uniqueness
const existsByName = await prisma.model.findFirst({
  where: {
    client: user.client.id,
    deleted: null,
    id: excludeId ? { not: excludeId } : undefined,
    name: { equals: trimmedName, mode: 'insensitive' },
  },
  select: { id: true },
});

// FK existence (soft-delete aware, tenant scoped)
const fk = await prisma.related.findFirst({
  where: { id: fkId, client: user.client.id, deleted: null },
  select: { id: true },
});
```

---

## Relational filters and includes
- When including related models, apply business filters sparingly; relations are already restricted at top-level by visibility. If you must filter inside an `include`, prefer strict tenant scope (`client`, `deleted: null`) to avoid cross-tenant leakage.
- For relational search (e.g., search by `person.email`), compose it as an additional `customWhere` that will be AND-ed with the standard visibility filter.

Example:
```js
const rawSearch = (req.query.search || '').trim();
const customWhere = rawSearch
  ? {
      OR: [
        { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
        { companyContact: { person: { email: { contains: rawSearch, mode: 'insensitive' } } } },
      ],
    }
  : {};

const list = await prisma.opportunity.findMany({
  where: { AND: [getVisibilityFilters(user), customWhere, extraWhere] },
  include,
});
```

---

## Anonymous vs authenticated
- Anonymous users: may only see records with `anonymousCanSeeIt: true` (and `everyoneCanSeeIt: true` if you opt-in), always with `deleted: null`.
- Authenticated users: see public records across tenants, plus tenant-scoped records per the OR branches.

If an endpoint must be tenant-only, call `getVisibilityFilters(user, { includeGlobal: false })`.

---

## Anti-patterns to avoid
- Missing `deleted: null` in ANY read query.
- Relying on `getVisibilityFilters` for uniqueness, FK, or derivation queries.
- Trusting body values for `client`, `createdBy`, `updatedBy` when authenticated.
- Adding `{ client: user.client.id }` to public (`everyoneCanSeeIt` / `anonymousCanSeeIt`) branches — it defeats cross-tenant public behavior.

---

## Performance notes
- Most models include a composite index on the visibility fields, `client`, and `deleted`. The OR visibility pattern is supported by these indexes.
- Prefer adding `{ client: user.client.id }` in tenant branches early to reduce scanned rows.
- Keep public content pathways minimal and intentional; if public content grows large, consider a dedicated flag/index (e.g., `isGlobalTemplate`) and endpoints that explicitly include/exclude it via the `includeGlobal` option.


