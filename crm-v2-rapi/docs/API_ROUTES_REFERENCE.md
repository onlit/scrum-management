## API Routes Reference
### Internal Bulk Details (Legacy parity)

- Method: GET, POST
- Path: `/api/v1/get-internal-bulk-details/`
- Description: Internal-only bulk details fetch to mirror Django `/api/get-internal-bulk-details/`. Accepts same payload as bulk details and returns id->record maps per requested model. For GET, pass JSON string in `payload` query param.
- Auth: Required
- Protect: Not required
- Request (body for POST, `payload` query for GET):
```
{ data: [ { field_name: string, model: string, get_path?: string, set_path?: string, inner_field?: boolean, ids: uuid[] } ] }
```
- Response: `200 OK` with array of entries, each including `details` map keyed by id.
- Visibility: Matches `GetBulkDetailsAPIView`; for internal requests, `Person` model bypasses visibility filters to match Django parity.
- Uniqueness/DB constraints: Not applicable (read-only). No DB constraints required.
- Performance: Batched using Prisma `$transaction` with filtered `findMany`. Ensure indexes on `(client, deleted, id)` where applicable. GIN/BTREE on commonly filtered fields recommended.

Notes:
- For POST, send the standard payload in body. For GET, provide a JSON-encoded `payload` query param to maintain idempotent reads while supporting internal callers that prefer GET.
- Non-supported methods (PUT/PATCH/DELETE) respond with 405 and a clear message.


- Base path: `/api/v1`
- All endpoints return JSON
- Authentication: Bearer token required; write operations also require protect middleware

### Conventions
## Bulk: Person Relationships

Controller: `src/controllers/createBulkPersonRelationships.controller.js`

Base path: `/api/v1/create-bulk-person-relationships`

- POST `/preview` or GET `/preview`: Returns counts for selection and duplicates for the specified `relationshipId`.
- POST `/`: Creates `PersonRelationship` for selection. Skips already existing `(personId, relationshipId)` pairs (soft-delete aware).
- PUT/PATCH `/`: Same as POST (idempotent apply semantics).
- DELETE `/`: Soft-deletes `PersonRelationship` rows matching the selection and `relationshipId`.

Request envelope (body for POST/PUT/PATCH/DELETE; query for GET preview):
```
{ all?: boolean, ids?: string[]|csv, exclude?: string[]|csv, filters?: object, search_query?: string, relationship: { relationshipId: uuid }, relationshipNotes?: string }
```

Uniqueness handling (controller-level):
- Duplicate pair `(personId, relationshipId)` under the same tenant (`client`) and non-deleted is pre-checked and skipped (no DB constraint).

Foreign keys validated (soft-delete aware):
- `relationshipId` validated using `verifyForeignKeyAccessBatch`.

Soft-delete:
- DELETE updates `deleted` timestamp via `updateMany`.

Workflow and histories:
- No workflow trigger for this bulk route (matches Django). If `relationshipNotes` is present, a `PersonRelationshipHistory` entry is created per created relationship asynchronously.

Performance notes:
- Uses `createMany` with pre-checked duplicates.
- Backed by indexes: `idx_person_relationship_client_deleted_person_relationship` and `idx_person_relationship_relationshipId_deleted`.

## Bulk: Person in Marketing Lists

Controller: `src/controllers/createBulkPersonInMarketingLists.controller.js`

Base path: `/api/v1/create-bulk-person-in-marketing-lists`

- POST `/preview`: Returns counts for selection, and duplicates for the specified `marketingListId`.
- POST `/`: Creates `PersonInMarketingList` for selection. Skips any already existing `(marketingListId, personId)` pairs; creates only new ones (matches Django behavior). Use with `all`, `ids`, `exclude`, `filters`, `search_query`, and `marketingList` object: `{ marketingListId, expiryDate?, color? }`.
- PUT/PATCH `/`: Same as POST (idempotent apply semantics).
- DELETE `/`: Soft-deletes `PersonInMarketingList` rows matching the selection.

Uniqueness handling (controller-level):
- Duplicate pair `(marketingListId, personId)` under the same tenant (`client`) and non-deleted is pre-checked and skipped (no error). Response indicates `createdCount` only for newly created rows.

Foreign keys validated (soft-delete aware):
- `marketingListId` validated with tenant visibility using `verifyForeignKeyAccessBatch`.

Soft-delete:
- DELETE updates `deleted` timestamp via `updateMany` following the soft-delete conventions.

Workflow triggers:
- Create-time triggers are deferred (fire-and-forget) after the response for lower latency.

Performance notes:
- Uses `createMany` with pre-checked duplicates to avoid DB constraint reliance.
- Backed by indexes: `idx_person_in_marketing_list_client_deleted_ml_person` to accelerate duplicate checks and selection deletes.

- See `docs/ROUTES_CONTROLLERS_DESIGN_STANDARDS.md` for route patterns and logging
- See `docs/TRACE_ID_CONVENTIONS.md` for trace ID behavior
- See `docs/ERROR_HANDLING_GUIDELINES.md` for standardized errors

---

## Get Or Create Person (POST-only, Django parity)

- Base path: `/api/v1/get-or-create-person`
- Controller: `src/controllers/getOrCreatePerson.controller.js`
- Auth: Required; `protectOrInternal` allows internal callers.

#### POST /get-or-create-person
- Parity with Django `GetOrCreatePersonAPIView`.
- Body validated by `personCreate` plus runtime checks:
  - Requires `personalMobile`; drops `model` and `company_owner` if present.
  - For unauthenticated internal calls, requires `createdBy` and `client` in body.
- Behavior:
  - If exists by `(client, parentId, personalMobile)`: returns existing and sets `hasWhatsapp=true` if needed.
  - Else creates a new Person.
- Controller-level uniqueness (no DB constraints):
  - Pre-check duplicates within same `(client, parentId)` for `homePhone`, `personalMobile`, `email` (case-insensitive for email) and returns `422 VALIDATION` with actionable message.
- FK validation: Uses `verifyForeignKeyAccessBatch` for `parentId`, `companyOwnerId`.
- Workflow: Not triggered here (matches Django parity for this endpoint).
- Performance: Indexed lookups on `(client, deleted, parentId[, personalMobile|lower(email)])`. See migration `20250827120000_person_indexes`.

Notes:
- Visibility filters applied to reads behind any reuse checks.
- Uniqueness handled in controller to avoid DB-level constraints; error messages are specific and actionable.
- Indexes optimize pre-checks; ensure Postgres has these from the migration listed above.


## Call List Pipeline Stages

Controller: `src/controllers/callListPipelineStage.controller.js`

Base path: `/api/v1/call-list-pipeline-stages`

#### GET /call-list-pipeline-stages
Returns a paginated list of CallListPipelineStages with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `name`, `description`, `color`, `order`, `rottingDays`, `callListPipelineId`

Includes: `callListPipeline`

#### POST /call-list-pipeline-stages
Creates a CallListPipelineStage. Body validated by `callListPipelineStageCreate`.

Uniqueness/validation:
- Parity with Django: no controller-level uniqueness pre-checks; rely on consumer behavior and downstream logic. FK visibility is enforced by general visibility filters.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency.

#### GET /call-list-pipeline-stages/:id
Fetch a single stage by UUID. 404 if not found or not visible.

#### PUT/PATCH /call-list-pipeline-stages/:id
Update a stage. Body validated by `callListPipelineStageUpdate`.

Uniqueness on update:
- Parity with Django: no additional controller-level duplicate pre-checks.

#### DELETE /call-list-pipeline-stages/:id
Soft-deletes a CallListPipelineStage. Also soft-deletes related `CallSchedule` and `CallHistory` rows referencing this stage, matching soft-delete conventions.

Performance notes:
- Uses standard list pagination and filters with visibility constraints.

Uniqueness handling documentation:
- Parity with Django: no explicit controller-level uniqueness enforcement for this resource.


## Bulk: Person In Call Schedules

Controller: `src/controllers/createBulkPersonInCallSchedules.controller.js`

Base path: `/api/v1/bulk-person-in-call-schedules`

- POST `/`: Creates `CallSchedule` rows from an explicit array.

Request body:
```
{ call_schedules: [ { personId: uuid, callListId: uuid, scheduleDatetime: ISO8601, color?: string, callListPipelineStageId?: uuid } ] }
```

Behavior (Django parity):
- If `callListPipelineStageId` is omitted for an item, the first stage (by `order`) of the `callList`’s pipeline is used.
- No controller-level duplicate pre-checks; creates directly.
- FKs (`personId`, `callListId`, and any provided `callListPipelineStageId`) are validated via `verifyForeignKeyAccessBatch` with visibility.

Performance notes:
- Uses `createMany` in batch.
- Indexes to aid related list/filters exist on `CallSchedule`.

No preview or delete routes for this bulk endpoint (parity with Django).

---

## Bulk: Opportunities

Controller: `src/controllers/createBulkOpportunities.controller.js`

Base path: `/api/v1/create-bulk-opportunities`

- POST `/preview`: Returns counts for selection and duplicates for the specified `pipelineId`.
- POST `/`: Creates `Opportunity` for a selection of Companies with the first stage of the pipeline. Skips existing `(pipelineId, companyId)` pairs (soft-delete aware).
- PUT/PATCH `/`: Same as POST (idempotent apply semantics).
- DELETE `/`: Soft-deletes `Opportunity` rows matching the selection and `pipelineId`.

Request envelope (body for POST/PUT/PATCH/DELETE; query for GET preview):
```
{ all?: boolean, ids?: string[]|csv, exclude?: string[]|csv, filters?: object, search_query?: string, pipeline: { pipelineId: uuid } }
```

Uniqueness handling (controller-level):
- Duplicate pair `(pipelineId, companyId)` under the same tenant (`client`) and non-deleted is pre-checked and skipped (no DB constraint). Clear duplicate list is returned by preview.

Foreign keys validated (soft-delete aware):
- `pipelineId` validated using `verifyForeignKeyAccessBatch`.

Soft-delete:
- DELETE updates `deleted` timestamp via `updateMany`.

Workflow triggers:
- No workflow trigger for this bulk route (parity with Django).

Performance notes:
- Uses `createMany` with pre-checked duplicates.
- Backed by indexes: `(client, deleted, pipelineId, companyId)` and `(pipelineId, deleted)` to accelerate duplicate checks and listings.

Uniqueness handling documentation:
- Uniqueness is enforced in controllers for soft-delete awareness and per-tenant semantics; do not add DB unique constraints on `(pipelineId, companyId)`.

## Companies

## Clients

Controller: `src/controllers/client.controller.js`

Base path: `/api/v1/clients`

#### GET /clients
Returns a paginated list of Clients with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `notes`, `color`, `opportunityId`, `companyContactId`

Includes: `opportunity`, `companyContact.person`

#### POST /clients
Creates a Client. Body validated by `clientCreate`.

Controller-level uniqueness (no DB unique constraints):
- Duplicate for the same `opportunityId` within the same tenant (soft-delete aware) is rejected.
- Duplicate for the same `companyContactId` within the same tenant (soft-delete aware) is rejected.

Example errors:
- 422 VALIDATION: "A client for this opportunity already exists."
- 422 VALIDATION: "This company contact already has a client."

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `opportunityId` and `companyContactId` within tenant visibility.

Workflow triggers:
- None for Clients (matches Django behavior for this resource).

#### GET /clients/:id
Fetch a single Client by UUID. 404 if not found or not visible.

#### PUT /clients/:id
#### PATCH /clients/:id
Update a Client. Body validated by `clientUpdate`.

Uniqueness on update:
- Checks are applied to the effective next values for `opportunityId` and `companyContactId` and rejected with the same messages as create.

#### DELETE /clients/:id
Soft-deletes a Client and cascades soft-deletes to `clientHistory` per controller where applicable.

Performance notes:
- Indexes added to accelerate duplicate checks and filters:
  - `(client, deleted, opportunityId)`
  - `(client, deleted, companyContactId)`

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and per-tenant. Avoid DB unique constraints for these combinations.

## Customer Enquiries

Controller: `src/controllers/customerEnquiry.controller.js`

Base path: `/api/v1/customer-enquiries`

#### GET /customer-enquiries
Returns a paginated list of Customer Enquiries with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `firstName`, `lastName`, `phone`, `message`, `source`, `sourceNotes`, `personId`, `statusId`, `purposeId`
- Search also matches related `person.email` for parity with Django

Notes:
- Visibility filters applied to all queries

#### POST /customer-enquiries
Creates a Customer Enquiry. Body validated by `customerEnquiryCreate`.
If `personId` is not provided, the system will find-or-create a `Person` by `email` (case-insensitive) within the tenant, matching Django behavior.

Uniqueness handling (controller-level, not DB constraints):
- Duplicate `message` (case-insensitive) for the same `personId` within the same tenant (non-deleted) is rejected.

Error example:
- 422 VALIDATION: "A customer enquiry with this message already exists for this person."

Foreign keys validated (soft-delete aware):
- `personId`, `statusId`, `purposeId`

Workflow triggers:
- None for Opportunity Influencers (parity with Django).

#### GET /customer-enquiries/:id
Fetch a single Customer Enquiry by UUID. 404 if not found or not visible.

#### PUT /customer-enquiries/:id
#### PATCH /customer-enquiries/:id
Update a Customer Enquiry. Body validated by `customerEnquiryUpdate`.

Uniqueness on update:
- Checks applied to effective next values; duplicates are rejected with the same message as create.

#### DELETE /customer-enquiries/:id
Soft-deletes a Customer Enquiry.

Performance notes:
- Indexes to support controller-level uniqueness checks and frequent lookups:
  - `(client, deleted, personId, lower(message))`

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and customizable per tenant.

Controller: `src/controllers/company.controller.js`

#### GET /companies

Returns a paginated list of Companies with optional search and filters.

Query params:
- `page` (number, optional) – Default 1
- `pageSize` (number, optional) – Default 10, max 100
- `search` (string, optional) – Free-text search over name, keywords, description, notes, intelligence, urls, phone/fax, address, city, industry, email, website
- `ordering` (string, optional) – Any of allowed fields; prefix with '-' for desc. Defaults to createdAt
- Filter fields (equals/in/range supported): `size`, `branchOfId`, `betaPartners`, `ownerId`, `countryId`
- Additional filters:
  - `company_contact_person` (uuid, optional) – only companies having a contact for this person
  - `exclude_company_contact_person` (uuid, optional) – exclude companies having a contact for this person
  - `territory` (uuid, optional) – companies in this territory
  - `sales_person` (uuid, optional) – companies in territories owned by this sales person
  - `without_company_office` (boolean, optional) – accepted for parity; no-op currently
- `autocomplete` (boolean, optional) – if true, search is restricted to name field for performance

Response: 200 OK
```json
{
  "currentPage": 1,
  "perPage": 10,
  "totalCount": 1234,
  "pageCount": 124,
  "results": [ { "id": "<uuid>", "name": "Acme", "branchOfId": null, "ownerId": "<uuid>", "...": "..." } ],
  "_meta": { "hasNextPage": true, "hasPreviousPage": false, "isTotalUnknown": false }
}
```

Notes:
- Visibility filters applied to all queries
- Search uses FTS automatically when `search_vector` exists on `Company`; falls back to ILIKE otherwise
- Performance: FTS GIN index on `Company.search_vector`; compound indexes on visibility and sorting

---

## Account Manager In Companies (Legacy: Company Account Managers)

Controller: `src/controllers/accountManagerInCompany.controller.js`

Base paths:
- `/api/v1/account-manager-in-companies`
- Alias (legacy Django parity): `/api/v1/company-account-managers`

#### GET /account-manager-in-companies
Paginated list with filters and search.

Filter fields: `color`, `expiryDate`, `companyId`, `accountManagerId`
Includes: `company`

#### POST /account-manager-in-companies
Creates an AccountManagerInCompany. Body validated by `accountManagerInCompanyCreate`.

Uniqueness handling (controller-level, no DB constraints):
- Prevents active duplicate assignment for the same `(companyId, accountManagerId)` within the same tenant.
- “Active” means `expiryDate IS NULL OR expiryDate >= today` and row not soft-deleted.

Example error:
- 422 VALIDATION: "This account manager is already assigned to the company (active assignment exists). End the current assignment or set an earlier expiry date."

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `companyId`.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency.

#### GET /account-manager-in-companies/:id
Fetch a single record by UUID. 404 if not found or not visible.

#### PUT/PATCH /account-manager-in-companies/:id
Update with `accountManagerInCompanyUpdate`.

Uniqueness on update:
- Checks apply to the effective next values; active duplicates are rejected with the same message as create.

#### DELETE /account-manager-in-companies/:id
Soft-deletes via `updateMany` per soft-delete conventions.

Performance notes:
- Index added: `(client, deleted, companyId, accountManagerId, expiryDate)` to speed duplicate checks and list filters.

---

## Territory Owners

Controller: `src/controllers/territoryOwner.controller.js`

Base path: `/api/v1/territory-owners`

#### GET /territory-owners
Paginated list with filters and search.

Filter fields: `color`, `expiryDate`, `territoryId`, `salesPersonId`
Includes: `territory`

#### POST /territory-owners
Creates a TerritoryOwner. Body validated by `territoryOwnerCreate`.

Uniqueness handling (controller-level):
- Prevents active duplicate ownership for the same `(territoryId, salesPersonId)` within the same tenant.
- “Active” means `expiryDate IS NULL OR expiryDate >= today` and row not soft-deleted.

Example error:
- 422 VALIDATION: "This salesperson already has an active ownership for the selected territory. End the current assignment or set an earlier expiry date."

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `territoryId`.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget).

#### GET /territory-owners/:id
Fetch a single record by UUID. 404 if not found or not visible.

#### PUT/PATCH /territory-owners/:id
Update with `territoryOwnerUpdate`.

Uniqueness on update:
- Checks apply to the effective next values; active duplicates are rejected with the same message as create.

#### DELETE /territory-owners/:id
Soft-deletes via `updateMany` per soft-delete conventions.

Performance notes:
- Index added: `(client, deleted, territoryId, salesPersonId, expiryDate)` to speed duplicate checks and list filters.

---

## Sales Person Targets

Controller: `src/controllers/salesPersonTarget.controller.js`

Base path: `/api/v1/sales-person-targets`

#### GET /sales-person-targets
Paginated list with filters and search.

Filter fields: `target`, `targetUnit`, `pipelineStageId`, `salesPersonId`, `pipelineId`, `expiryDate`, `color`, `notes`
Includes: `pipelineStage`, `pipeline`

#### POST /sales-person-targets
Creates a SalesPersonTarget. Body validated by `salesPersonTargetCreate`.

Controller-level validation:
- Ensures selected `pipelineStageId` belongs to `pipelineId`.
- Prevents active duplicate for `(pipelineStageId, salesPersonId)` within the same tenant.
- “Active” means `expiryDate IS NULL OR expiryDate >= today` and row not soft-deleted.

Example errors:
- 422 VALIDATION: "Selected stage does not belong to the specified pipeline."
- 422 VALIDATION: "This salesperson already has an active target for the selected stage. End the current target or set an earlier expiry date."

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `pipelineId`, `pipelineStageId`.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget).

#### GET /sales-person-targets/:id
Fetch a single record by UUID. 404 if not found or not visible.

#### PUT/PATCH /sales-person-targets/:id
Update with `salesPersonTargetUpdate`.

Uniqueness on update:
- Checks apply to the effective next values; active duplicates are rejected with the same messages as create.

#### DELETE /sales-person-targets/:id
Soft-deletes via `updateMany` per soft-delete conventions.

Performance notes:
- Index added: `(client, deleted, pipelineStageId, salesPersonId, expiryDate)` to speed duplicate checks and list filters.


## Persons

## Person Relationships

Controller: `src/controllers/personRelationship.controller.js`

Base path: `/api/v1/person-relationships`

#### GET /person-relationships
Returns a paginated list of PersonRelationships with filters and search.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `color`, `personId`, `relationshipId`

Notes:
- Visibility filters applied to all queries

#### POST /person-relationships
Creates a PersonRelationship. Body validated by `personRelationshipCreate`.

Uniqueness handling (controller-level, not DB constraints):
- Duplicate pair `(personId, relationshipId)` within the same tenant (soft-delete aware) is rejected.
- Error: 422 VALIDATION with message "This person already has this relationship."

Foreign key validation:
- Uses `verifyForeignKeyAccessBatch` for `personId` and `relationshipId` within visibility constraints.

Workflow triggers:
- Fire-and-forget after response using Automata integration; does not impact latency.

#### GET /person-relationships/:id
Fetch a single PersonRelationship. 404 if not found or not visible.

#### PUT /person-relationships/:id
#### PATCH /person-relationships/:id
Update a PersonRelationship. Body validated by `personRelationshipUpdate`.

Uniqueness on update:
- Checks apply to effective next values for `(personId, relationshipId)` within tenant; duplicates are rejected with the same message as create.

#### DELETE /person-relationships/:id
Soft-deletes a PersonRelationship and cascades soft-deletes to `personRelationshipHistory` records.

Performance notes:
- Indexes to support list and uniqueness checks:
  - `(client, deleted, personId, relationshipId)`
  - `(client, deleted, createdAt)`

## Person Relationship Histories

Controller: `src/controllers/personRelationshipHistory.controller.js`

Base path: `/api/v1/person-relationship-histories`

#### GET /person-relationship-histories
Returns a paginated list of PersonRelationshipHistories with filters and search.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `notes`, `color`, `personRelationshipId`

Includes: `personRelationship.person`

#### POST /person-relationship-histories
Creates a PersonRelationshipHistory. Body validated by `personRelationshipHistoryCreate`.

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `personRelationshipId` within visibility constraints.

Uniqueness: none (parity with Django). Notes can repeat.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency.

#### GET /person-relationship-histories/:id
Fetch a single PersonRelationshipHistory. 404 if not found or not visible.

#### PUT /person-relationship-histories/:id
#### PATCH /person-relationship-histories/:id
Update a PersonRelationshipHistory. Body validated by `personRelationshipHistoryUpdate`.

Uniqueness on update: none (parity with Django). Notes can repeat.

#### DELETE /person-relationship-histories/:id
Soft-deletes a PersonRelationshipHistory.

Performance notes:
- Indexes to support frequent lookups:
  - `(client, deleted, personRelationshipId, createdAt)`

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and customizable per tenant. Database unique constraints are intentionally not used.

Uniqueness handling documentation:
- Enforced in controllers (soft-delete aware). DB unique constraints intentionally avoided to allow tenant-specific logic and restores.

Controller: `src/controllers/person.controller.js`

#### GET /persons

Returns a paginated list of Persons with optional search and filters.

Query params:
- `page` (number, optional) – Default 1
- `pageSize` (number, optional) – Default 10, max 100
- `search` (string, optional) – Free-text search over firstName, lastName, email, address fields, notes, etc.
- `ordering` (string, optional) – Any of allowed fields; prefix with '-' for desc. Defaults to createdAt
- Filter fields: `dob`, `countryId`, `parentId`, `companyOwnerId`, `hasWhatsapp`, `status` and all searchable fields

Response: 200 OK (standard pagination envelope per design standards)

Notes:
- Visibility filters applied to all queries
- Performance: compound index recommended on `(client, deleted, lower(email))`; see migration

#### POST /persons
Creates a Person. Body validated by `personCreate`.

Response: 201 Created, returns created Person with relations.

Notes:
- Create-time workflow trigger is fired after response in a fire-and-forget task for lower latency.

#### GET /persons/:id
Fetch a single Person by UUID. 404 if not found or not visible.

#### GET /persons/email/:email
Fetch a single Person by email (case-insensitive). 404 if not found or not visible.

Validation:
- Email validated using `validator.isEmail`.

#### PUT /persons/:id
#### PATCH /persons/:id
Update a Person. Body validated by `personUpdate`. Visibility is enforced via updateMany + follow-up fetch.

#### DELETE /persons/:id
Soft-deletes a Person and cascades soft-deletes to related records where applicable.

Performance notes:
- Index on `lower(email)` and `client` to speed GET-by-email and prevent seq scans under tenant filters.
- Keep includes minimal on list endpoints; leveraged visibility compound indexes.


#### POST /companies
Creates a Company. Body validated by `companyCreate`.

Response: 201 Created, returns created Company with relations.

#### GET /companies/:id
Fetch a single Company. 404 if not found or not visible.

#### PUT /companies/:id
#### PATCH /companies/:id
Update a Company. Body validated by `companyUpdate`.

#### DELETE /companies/:id
Soft-deletes a Company and cascades soft-deletes to related records where applicable.

## Reset Rotting Days (Opportunities)

Controller: `src/controllers/resetRottingDaysOpportunities.controller.js`

Base path: `/api/v1/reset-rotting-days-opportunities`

#### GET /reset-rotting-days-opportunities
- Preview how many Opportunities would be affected for a given stage.

Query params:
- `stageId` (uuid, required)

Response: 200 OK
```json
{ "stageId": "<uuid>", "affectedCount": 42 }
```

#### POST /reset-rotting-days-opportunities
- Apply reset by updating `statusAssignedDate` for all Opportunities in the given stage.

Body:
```json
{ "stageId": "<uuid>", "statusAssignedDate": "2025-08-01T00:00:00.000Z" }
```

Notes:
- If `statusAssignedDate` is omitted, it will be set to null (strict parity with Django view).
- Requires auth + protect. Uses visibility filters on `Opportunity`.
- FK validation uses `verifyForeignKeyAccessBatch` for `stageId` (PipelineStage).

Response: 200 OK
```json
{ "stageId": "<uuid>", "updatedCount": 42 }
```

#### PUT /reset-rotting-days-opportunities
#### PATCH /reset-rotting-days-opportunities
- Same as POST; idempotent apply with optional `statusAssignedDate` (omission sets it to null).

#### DELETE /reset-rotting-days-opportunities
- Revert by setting `statusAssignedDate` to null for all Opportunities in the given stage.

Query params:
- `stageId` (uuid, required)

Response: 200 OK
```json
{ "stageId": "<uuid>", "revertedCount": 42 }
```

Performance notes:
- Uses `@@index([statusId, deleted])` on `Opportunity` for fast stage scans.
- Operation uses `updateMany` scoped by tenant visibility filters (soft-delete aware).

Uniqueness handling documentation:
- No DB unique constraints are used. Controller validates FK visibility. Any potential duplicates (e.g., stage mismatches) are handled pre-update and return actionable messages.

---

## Opportunities
## Company Territories

## Marketing Lists

Controller: `src/controllers/marketingList.controller.js`

Base path: `/api/v1/marketing-lists`

- Alias (legacy): `/api/v1/marketing-lists` (same), no additional alias required

#### GET /marketing-lists
Returns a paginated list of Marketing Lists with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `name`, `color`, `description`, `expiryDate`

Notes:
- Visibility filters applied to all queries

#### POST /marketing-lists
Creates a Marketing List. Body validated by `marketingListCreate`.

Uniqueness handling (controller-level, not DB constraints):
- Duplicate `name` (case-insensitive) within the same tenant is rejected.

Error example:
- 422 VALIDATION: "A marketing list with this name already exists for your account."

Workflow triggers:
- Create-time workflow trigger is designed to fire after the response (fire-and-forget) for lower latency. Disabled by default until configured.

#### GET /marketing-lists/:id
Fetch a single Marketing List. 404 if not found or not visible.

#### PUT /marketing-lists/:id
#### PATCH /marketing-lists/:id
Update a Marketing List. Body validated by `marketingListUpdate`.

Uniqueness on update:
- Checks applied to effective next values; duplicates are rejected with the same messages as create.

#### DELETE /marketing-lists/:id
Soft-deletes a Marketing List and cascades soft-deletes to related `personInMarketingList` items.

Performance notes:
- Indexes to support duplicate checks and frequent lookups:
  - `(client, deleted, lower(name))`

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and customizable per tenant.

## Person In Marketing Lists

Controller: `src/controllers/personInMarketingList.controller.js`

Base path: `/api/v1/person-in-marketing-lists`

- Alias (legacy): `/api/v1/person-marketing-lists`

#### GET /person-in-marketing-lists
Returns a paginated list of PersonInMarketingList with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `color`, `expiryDate`, `marketingListId`, `personId`

Includes: `marketingList`, `person`

#### POST /person-in-marketing-lists
Creates a PersonInMarketingList. Body validated by `personInMarketingListCreate`.

 FK validation:
- Uses `verifyForeignKeyAccessBatch` for `marketingListId`, `personId`.

Uniqueness handling (controller-level, not DB constraints):
- Duplicate pair `(marketingListId, personId)` (soft-delete aware) within the same tenant is rejected.

Error example:
- 422 VALIDATION: "This person is already in the selected marketing list."

#### GET /person-in-marketing-lists/:id
Fetch a single PersonInMarketingList by UUID. 404 if not found or not visible.

#### PUT /person-in-marketing-lists/:id
#### PATCH /person-in-marketing-lists/:id
Update a PersonInMarketingList. Body validated by `personInMarketingListUpdate`.

Uniqueness on update:
- Checks applied to effective next values; duplicates are rejected with the same message as create.

#### DELETE /person-in-marketing-lists/:id
Soft-deletes a PersonInMarketingList.

Performance notes:
- Indexes to support duplicate checks and frequent lookups:
  - `(client, deleted, marketingListId, personId)`
  - `(marketingListId, deleted)` and `(personId, deleted)` for targeted queries

Controller: `src/controllers/companyInTerritory.controller.js`

Base path: `/api/v1/company-in-territories`

#### GET /company-in-territories
Returns a paginated list of Company Territory assignments with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `companyId`, `territoryId`, `expiryDate`, `color`

Notes:
- Visibility filters applied to all queries
- Includes: `company`, `territory`

#### POST /company-in-territories
Creates a CompanyInTerritory. Body validated by `companyInTerritoryCreate`.

Controller-level uniqueness handling (no DB unique constraints):
- Duplicate active assignment for the same `(companyId, territoryId)` within the same tenant is rejected.
- “Active” means `expiryDate IS NULL OR expiryDate >= today` (soft-delete aware).

Example error:
- 422 VALIDATION: "Company territory must be unique (no overlapping active assignment)."

FK validation:
- Uses `verifyForeignKeyAccessBatch` to ensure `companyId` and `territoryId` are visible to the user.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency.

#### GET /company-in-territories/:id
Fetch a single CompanyInTerritory by UUID. 404 if not found or not visible.

#### PUT /company-in-territories/:id
#### PATCH /company-in-territories/:id
Update a CompanyInTerritory. Body validated by `companyInTerritoryUpdate`.

Uniqueness handling on update:
- Checks use the effective next values. If another non-deleted record for the same `(companyId, territoryId)` has a later `expiryDate` that is still active (greater than today), the update is rejected when it would overlap.

#### DELETE /company-in-territories/:id
Soft-deletes a CompanyInTerritory.

Performance notes:
- Indexes to support duplicate checks and frequent lookups:
  - `(client, deleted, companyId, territoryId, expiryDate)`
  - `(companyId, deleted)` and `(territoryId, deleted)` for targeted queries
- Prefer covering filters with `(client, deleted, ...)` to avoid seq scans under tenant isolation.

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and customizable per tenant.
- Database unique constraints are intentionally not used to allow restoring soft-deleted records and tenant-specific rules.

### Bulk: Create CompanyInTerritories

Controller: `src/controllers/createBulkCompanyInTerritories.controller.js`

Base path: `/api/v1/create-bulk-company-in-territories`

- Preview: `POST /create-bulk-company-in-territories/preview`
  - Body: `{ all?: boolean, ids?: uuid[], exclude?: uuid[], filters?: object, search_query?: string, territory: { territoryId: uuid, color?: string, expiryDate?: ISOString } }`
  - Returns counts and which companies already have an active assignment in the territory.

- Create: `POST /create-bulk-company-in-territories`
  - Same body as Preview. If any selected company already has an assignment in the territory with `expiryDate >= now`, the request fails and returns the duplicate list (Django parity). Otherwise creates for all selected.
  - Idempotent: `PUT` and `PATCH` behave the same as `POST`.

- Delete (revert): `DELETE /create-bulk-company-in-territories`
  - Same selection envelope; soft-deletes matching `CompanyInTerritory` rows.

Controller-level uniqueness (soft-delete aware):
- Duplicate check equals Django: duplicate when `expiryDate >= now` for same `(companyId, territoryId)`. Any duplicates cause the entire create to fail with details.

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `territoryId`.

Workflow triggers:
- Create-time triggers fire after the response (fire-and-forget) to reduce latency.

Performance notes:
- Indexes to support selection and duplicate checks:
  - `@@index([client, deleted, territoryId, companyId, expiryDate])`
  - `@@index([territoryId, deleted])`, `@@index([companyId, deleted])`
- Selection uses the same filtering/search mechanics as `GET /companies` via `getListFiltersAndQueries`.

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and customizable per tenant. Clear error messages are returned when all selected companies are duplicates; otherwise duplicates are skipped.

## Company Contacts
## Opportunity Histories

Controller: `src/controllers/opportunityHistory.controller.js`

Base path: `/api/v1/opportunity-histories`

#### GET /opportunity-histories
Returns a paginated list of Opportunity Histories with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `notes`, `url`, `color`, `opportunityId`

Response: 200 OK (standard pagination envelope)

Notes:
- Visibility filters applied to all queries
- Includes: `opportunity`

#### POST /opportunity-histories
Creates an Opportunity History entry. Body validated by `opportunityHistoryCreate`.

Controller-level uniqueness handling (no DB unique constraints):
- Duplicate `url` (case-insensitive) for the same `opportunityId` within the same tenant is rejected
- Duplicate `notes` (case-insensitive) for the same `opportunityId` within the same tenant is rejected

Example errors:
- 422 VALIDATION: "A history entry with this URL already exists for this opportunity."
- 422 VALIDATION: "A history entry with the same notes already exists for this opportunity."

FK validation:
- Uses `verifyForeignKeyAccessBatch` to ensure `opportunityId` is visible to the user

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency

#### GET /opportunity-histories/:id
Fetch a single Opportunity History by UUID. 404 if not found or not visible.

#### PUT /opportunity-histories/:id
#### PATCH /opportunity-histories/:id
Update an Opportunity History. Body validated by `opportunityHistoryUpdate`.

Uniqueness handling on update:
- Checks are applied to the effective next values; duplicates are rejected with the same messages as create

#### DELETE /opportunity-histories/:id
Soft-deletes an Opportunity History.

Performance notes:
- Indexes to support controller-level uniqueness checks and frequent lookups:
  - `(client, deleted, opportunityId, lower(url))`
  - `(client, deleted, opportunityId, lower(notes))`
  - `(opportunityId, deleted, createdAt)`

Uniqueness handling documentation:
- Uniqueness is enforced in controllers (soft-delete aware) to allow restoring soft-deleted rows and per-tenant logic.


Controller: `src/controllers/companyContact.controller.js`

Base path: `/api/v1/company-contacts`

#### GET /company-contacts
Returns a paginated list of Company Contacts with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `workPhone`, `jobTitle`, `workMobile`, `workEmail`, `accounts`, `personId`, `companyId`, `startDate`, `endDate`

Response: 200 OK (standard pagination envelope)

Notes:
- Visibility filters applied to all queries
- Performance: indexes on `(client, deleted, personId, companyId)` and `(client, deleted, lower(workEmail))`

#### POST /company-contacts
Creates a Company Contact. Body validated by `companyContactCreate`.

Uniqueness handling (controller-level, not DB constraints):
- Duplicate pair: a `(personId, companyId)` contact within the same tenant is rejected.
- Duplicate workEmail (case-insensitive) within the same tenant is rejected.

Errors (examples):
- 422 VALIDATION: "This person is already a contact for the selected company."
- 422 VALIDATION: "A company contact with this work email already exists."

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency.

#### GET /company-contacts/:id
Fetch a single Company Contact. 404 if not found or not visible.

#### PUT /company-contacts/:id
#### PATCH /company-contacts/:id
Update a Company Contact. Body validated by `companyContactUpdate`.

Uniqueness handling on update:
- Checks are applied to the effective next values; duplicates are rejected with the same error messages as create.

#### DELETE /company-contacts/:id
Soft-deletes a Company Contact and cascades soft-deletes to related records where applicable.

Performance notes:
- Indexes to support duplicate checks and frequent lookups:
  - `(client, deleted, personId, companyId)`
  - `(client, deleted, lower(workEmail))`
  - `(companyId, deleted)` and `(personId, deleted)` for targeted queries


Controller: `src/controllers/opportunity.controller.js`

#### GET /opportunities/stages
Alias: `GET /opportunity-stages/stages`

Returns kanban-style stage buckets for Opportunities in a Pipeline with optional owner and date filters.

Query params:
- `pipeline` (uuid, required) – Pipeline ID to aggregate by
- `owner` (uuid, optional) – Filter by `ownerId`
- `start_date` (ISO string, optional) – Filter `createdAt >= start_date`
- `end_date` (ISO string, optional) – Filter `createdAt <= end_date`

Response: 200 OK, array of stage buckets

Stage object:
```json
{
  "id": "<stageId>",
  "stage": "Qualification",
  "name": "Qualification",
  "description": "...",
  "order": 1,
  "pipelineStageFullOrder": "1.",
  "conversion": 20,
  "confidence": 60,
  "rottingDays": 14,
  "immediateNextAction": "Follow up",
  "totalEstimatedValue": 350000,
  "discountedValue": 210000,
  "items": [
    {
      "id": "<opportunityId>",
      "name": "Deal A",
      "description": "...",
      "companyId": "<uuid>",
      "companyContactId": "<uuid>",
      "pipelineId": "<uuid>",
      "statusId": "<stageId>",
      "estimatedCloseDate": "2025-12-31T00:00:00.000Z",
      "estimatedValue": 100000,
      "probability": 50,
      "statusAssignedDate": "2025-08-01T00:00:00.000Z",
      "rotting": false,
      "details": { "company": { "id": "<uuid>", "name": "Acme Corp" } }
    }
  ]
}
```

Example:
```
GET /api/v1/opportunities/stages?pipeline=6c7a0d8f-2a1b-4f0b-8c98-8bfef5e1a9f0&owner=9b9b2d36-4f20-4c1c-8f45-0d4d2b2f0a11&start_date=2025-08-01&end_date=2025-08-31
Authorization: Bearer <token>
```

Notes:
- Visibility rules apply to both Pipeline and Opportunities
- Performance: optimized by indexes on `PipelineStage(pipelineId, deleted, order)` and `Opportunity(pipelineId, deleted, createdAt)` and `Opportunity(statusId, deleted)`; see Prisma schema and migrations

## Opportunities
## Opportunity Influencers

Controller: `src/controllers/opportunityInfluencer.controller.js`

Base path: `/api/v1/opportunity-influencers`

#### GET /opportunity-influencers
Returns a paginated list of OpportunityInfluencers with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `role`, `desireForSelf`, `color`, `desireForCompany`, `rating`, `companyContactId`, `opportunityId`

Includes: `companyContact.person`, `opportunity`

#### POST /opportunity-influencers
Creates an OpportunityInfluencer. Body validated by `opportunityInfluencerCreate`.

Controller-level uniqueness (no DB unique constraints):
- Duplicate pair `(opportunityId, companyContactId)` within the same tenant (soft-delete aware) is rejected.

Example error:
- 422 VALIDATION: "This contact is already an influencer on the selected opportunity."

FK validation:
- Uses `verifyForeignKeyAccessBatch` for `companyContactId` and `opportunityId` (when provided), within tenant visibility.

Workflow triggers:
- Create-time workflow trigger is fired after the response (fire-and-forget) for lower latency.

#### GET /opportunity-influencers/:id
Fetch a single OpportunityInfluencer by UUID. 404 if not found or not visible.

#### PUT /opportunity-influencers/:id
#### PATCH /opportunity-influencers/:id
Update an OpportunityInfluencer. Body validated by `opportunityInfluencerUpdate`.

Uniqueness on update:
- Checks apply to the effective next values for `(opportunityId, companyContactId)`; duplicates are rejected with the same message as create.

#### DELETE /opportunity-influencers/:id
Soft-deletes an OpportunityInfluencer via `updateMany` with visibility filters.

Performance notes:
- Indexes added to support duplicate checks and frequent lookups:
  - `(client, deleted, opportunityId, companyContactId)`
  - `(opportunityId, deleted)` and `(companyContactId, deleted)`

Uniqueness handling documentation:
- Uniqueness is enforced in controllers to remain soft-delete aware and per-tenant. Avoid DB unique constraints on these combinations.


Controller: `src/controllers/opportunity.controller.js`

Base path: `/api/v1/opportunities`

#### GET /opportunities
Returns a paginated list of Opportunities with search and filters.

Query params:
- `page`, `pageSize`, `search`, `ordering`
- Filter fields: `companyId`, `personId`, `statusId`, `actualValue`, `probability`, `economicBuyerInfluenceId`, `salesPersonId`, `ownerId`, `companyContactId`, `technicalBuyerInfluenceId`, `statusAssignedDate`, `pipelineId`, `estimatedValue`, `estimatedCloseDate`, `userBuyerInfluenceId`, `channelId`

Response: 200 OK (standard pagination envelope)

Notes:
- Visibility filters applied to all queries
- Includes limited related data: `company`, `person`, `status`, `