## Display Value Utilities Guidelines

### Overview

This service standardizes human-friendly labels for records using:

- **`computeDisplayValue(record, modelName)`** – computes a single display string for a record.
- **`enrichRecordDisplayValues(record, modelNameLike)`** – computes the record's display value **and** decorates nested relations with their own `__displayValue`.

The reserved display value property key is `__displayValue` (from `DISPLAY_VALUE_PROP`).

---

## Core Config: `DISPLAY_VALUE_TEMPLATES` and `DISPLAY_VALUE_FALLBACK_FIELDS`

In `constants.js`:

- **`DISPLAY_VALUE_TEMPLATES`**: model → template string, e.g.:

```javascript
Person: '{firstName} {lastName}',
PersonRelationship: '{person}',
ProspectProduct: '{prospect} - {productVariant}',
```

- **`DISPLAY_VALUE_FALLBACK_FIELDS`**: model → fallback field, e.g.:

```javascript
Person: 'email',
CustomerEnquiry: 'person',
PersonRelationship: 'person',
TerritoryOwner: 'salesPerson',
```

Resolution rules:

1. If a template exists and templates are enabled:
   - Use `interpolateTemplate(template, record)`.
2. If that fails or returns blank, fall back to:
   - `record[fallbackField]`.
   - If the direct field doesn't exist, check `record.details[fallbackField + 'Id']` (for relations populated via `getDetailsFromAPI`).
   - If that value is an object and has `__displayValue`, return that instead.

---

## When to Use `computeDisplayValue`

**Use `computeDisplayValue` when you only need the top-level display string and the model is "flat" (primitive fields).**

Example characteristics:

- Template and fallback field are **primitive**: `name`, `code`, `email`, etc.
- You are **not** exposing nested relations or you don't care about `relation.__displayValue`.

Example usage:

```javascript
const { computeDisplayValue } = require('#utils/displayValueUtils.js');
const { DISPLAY_VALUE_PROP } = require('#configs/constants.js');

const itemWithDisplay = {
  ...record,
  [DISPLAY_VALUE_PROP]: computeDisplayValue(record, 'ProspectCategory'),
};
```

**Good fits:**

- Models like `ProspectCategory`, `SocialMediaType`, `ProspectPipeline` where display configs only reference `name` or similar primitive fields.

---

## When to Use `enrichRecordDisplayValues`

**Use `enrichRecordDisplayValues` whenever:**

- The model's display config references a **relation** (e.g. fallback is `person`, `salesPerson`, etc.), **or**
- The API response includes related models and you want **nested `__displayValue`** fields (e.g. `item.person.__displayValue`, `item.status.__displayValue`).

**Note:** Relations can be populated in two ways:

1. **Prisma includes**: Direct relation objects loaded via `include: { person: true, ... }`
2. **API details**: Relations fetched via `getDetailsFromAPI()` and populated in the `details` object

`enrichRecordDisplayValues` works with both patterns automatically.

This utility:

1. Normalizes the model name (e.g. `'customerEnquiry'` → `CustomerEnquiry`).
2. Computes the main record's `__displayValue`.
3. Detects nested relations that have display config (via `DISPLAY_VALUE_FALLBACK_FIELDS`).
4. Attaches `__displayValue` to each such nested relation.

### Patterns to Look For

Use `enrichRecordDisplayValues` in controllers where **all of the following apply**:

- `DISPLAY_VALUE_FALLBACK_FIELDS` entry points to a relation object:

  - Examples:
    - `PersonRelationship: 'person'`
    - `CustomerEnquiry: 'person'`
    - `PersonInMarketingList: 'person'`
    - `TerritoryOwner: 'salesPerson'`
    - `Prospect: 'person'`

- The controller uses Prisma `include` to load related models:

  ```javascript
  const include = {
    person: true,
    status: true,
    purpose: true,
  };
  ```

- Clients expect nested display values, e.g.:

  ```json
  {
    "person": { "id": "...", "__displayValue": "Person Name" },
    "status": { "id": "...", "__displayValue": "Open" }
  }
  ```

### Controller Usage Pattern

**Recommended pattern for list endpoints:**

```javascript
const {
  enrichRecordDisplayValues,
} = require('#utils/displayValueUtils.js');

if (response?.results) {
  response.results = response.results.map((record) =>
    enrichRecordDisplayValues(record, 'CustomerEnquiry')
  );
}
```

**Recommended pattern for create/get/update endpoints:**

```javascript
const itemWithDisplayValue = enrichRecordDisplayValues(
  dbRecordWithDetails,
  'CustomerEnquiry'
);

res.status(200).json(itemWithDisplayValue);
```

### Example: Fixing `[object Object]` Displays

Problem pattern:

- Template: `PersonRelationship: '{person}'`.
- Fallback: `PersonRelationship: 'person'`.
- `person` is a nested object **without** `__displayValue`.
- `computeDisplayValue` is called on the parent only.

Result: template resolves `{person}` → object → `String(object)` → `"[object Object]"`.

**Corrected pattern:**

Use `enrichRecordDisplayValues(record, 'PersonRelationship')` instead of manually adding `__displayValue` via `computeDisplayValue`. This:

- Computes a meaningful top-level display string.
- Adds `person.__displayValue` and `relationship.__displayValue` if configured.

### Working with Models That Use API Details

Some models reference relations that aren't defined as Prisma relations (e.g., `SalesPersonTarget.salesPerson`, `TerritoryOwner.salesPerson`). For these models:

1. The relation data is fetched via `getDetailsFromAPI()` and placed in the `details` object
2. `enrichRecordDisplayValues` automatically checks `details[fallbackField + 'Id']` when the direct field doesn't exist
3. Controllers should call `getDetailsFromAPI()` before `enrichRecordDisplayValues()`

**Example pattern:**

```javascript
const [recordWithDetails] = await getDetailsFromAPI({
  results: [dbRecord],
  token: user?.accessToken,
});

const recordWithDisplayValue = enrichRecordDisplayValues(
  recordWithDetails,
  'SalesPersonTarget'
);
```

This pattern ensures:

- `details.salesPersonId` contains the sales person data with `__displayValue`
- The main record's `__displayValue` uses `details.salesPersonId.__displayValue` as fallback

---

## Migration Guidelines

When creating or modifying a controller:

- **Default choice**: if the model has relations and you're including them, or its display config references a relation, **use `enrichRecordDisplayValues`**.
- **Keep `computeDisplayValue`** only for:
  - Simple models where both template and fallback field are primitive.
  - Use-cases where you explicitly do **not** want nested `__displayValue` decorations.

When migrating existing controllers:

1. **Search** for `computeDisplayValue` in controllers.
2. For each usage, check:
   - Does `DISPLAY_VALUE_FALLBACK_FIELDS[Model]` point to a relation?
   - Does the controller include relations (`include: { ... }`) that would benefit from `__displayValue`?
3. If yes to either, **swap to `enrichRecordDisplayValues`** following the patterns above.

---

## Summary

- **`computeDisplayValue`** → top-level display only; use for simple, flat models.
- **`enrichRecordDisplayValues`** → top-level + nested relation display values; use for models whose display depends on relations or where nested `__displayValue` is desired.
- For consistency and fewer bugs (like `"[object Object]"`), prefer `enrichRecordDisplayValues` in "rich" controllers that load related models.
