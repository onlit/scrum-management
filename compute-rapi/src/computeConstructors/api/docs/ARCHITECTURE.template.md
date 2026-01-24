# Architecture Overview

This document describes the layered architecture of generated microservices and how custom business logic integrates with auto-generated code.

## Layer Responsibilities

### Core Layer (`src/core/`)

- **Auto-generated** - Regenerated on each generator run
- Contains CRUD operations, validation schemas, routes
- Never modify these files directly - changes will be lost

```
src/core/
├── controllers/     # CRUD controller functions
│   └── {model}.controller.core.js
├── schemas/         # Joi validation schemas
│   └── {model}.schema.core.js
├── routes/
│   └── v1/          # Express route definitions
│       └── {model}.routes.core.js
├── middlewares/     # Core middleware
│   ├── parseFilters.js        # Query filter parsing
│   └── schemaOptionsHandler.js # OPTIONS schema responses
├── utils/           # Core utilities
│   ├── schemaRegistry.js      # Route-to-schema mapping
│   ├── optionsBuilder.js      # Joi-to-JSON-Schema conversion
│   └── filterSchemaUtils.js   # Filter type introspection
├── interfaces/      # Type definitions and contracts
│   ├── interceptor.interface.js
│   └── query-builder.interface.js
└── exceptions/      # Domain exception types
    └── domain.exception.js
```

### Domain Layer (`src/domain/`)

- **Protected** - Never touched by generator
- Contains custom business logic
- Interceptors hook into core layer lifecycle

```
src/domain/
├── interceptors/              # Lifecycle hooks per model
│   ├── interceptor.registry.js
│   └── {model}.interceptor.js
├── schemas/                   # Custom validation rules
├── constants/                 # Application-wide constants
├── routes/
│   └── v1/                    # Custom domain routes
│       └── {name}.routes.js
└── bullQueues/                # Custom background jobs
```

Note: Application-wide constants are in `src/domain/constants/domain.constants.js` (protected).

## Data Flow

```
Request
   │
   ▼
Routes (core)
   │
   ▼
Controller (core)
   │
   ├─► beforeValidate (interceptor)
   │
   ├─► extendSchema (interceptor)
   │
   ├─► Joi Validation
   │
   ├─► afterValidate (interceptor)
   │
   ├─► beforeCreate/Update/Delete (interceptor)
   │         │
   │         └─► QueryBuilder modification (for list operations)
   │
   ├─► Prisma Database Operation
   │
   ├─► afterCreate/Update/Delete (interceptor)
   │
   └─► onError (interceptor) ◄── if error occurs
   │
   ▼
Response
```

## Interceptor Lifecycle

Each CRUD operation calls lifecycle hooks at specific points:

| Operation | Before Hooks | After Hooks |
|-----------|--------------|-------------|
| Create | beforeValidate, extendSchema, afterValidate, beforeCreate | afterCreate |
| Read | beforeRead | afterRead |
| Update | beforeValidate, extendSchema, afterValidate, beforeUpdate | afterUpdate |
| Delete | beforeDelete | afterDelete |
| List | beforeList | afterList |

All operations call `onError` if an exception occurs.

## Regeneration Safety

### Protected Paths (never deleted)

- `src/domain/` - Custom business logic
- `tests/domain/` - Custom domain tests
- `.env`, `.env.local`, `.env.production`, `.env.test` - Environment files
- `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml` - Lock files
- `.generated-manifest.json` - Generation tracking

**Regenerated (deleted and recreated):**
- `src/core/` - CRUD controllers, schemas, routes
- `tests/core/` - Core layer tests
- `tests/factories/` - Test data factories
- `docs/` - Documentation files

### Regeneration Process

1. Generator reads model definitions from database
2. Selective deletion removes regenerated directories (preserving protected paths)
3. New core files are generated from templates
4. Domain layer scaffolding creates stubs (only if they don't exist)
5. Manifest is written tracking what was generated

## Naming Conventions

| Layer | Pattern | Example |
|-------|---------|---------|
| Core controllers | `{model}.controller.core.js` | `employee.controller.core.js` |
| Core schemas | `{model}.schema.core.js` | `employee.schema.core.js` |
| Core routes | `{model}.routes.core.js` | `employee.routes.core.js` |
| Interceptors | `{model}.interceptor.js` | `employee.interceptor.js` |
| Domain routes | `{name}.routes.js` | `reports.routes.js` |
| Domain schemas | `base.schema.js` | `base.schema.js` |
| Test factories | `{model}.factory.js` | `employee.factory.js` |

## Import Path Aliases

Node.js subpath imports for cleaner code:

```javascript
// Core layer
require('#core/controllers/employee.controller.core.js')
require('#core/routes/v1/employee.routes.core.js')
require('#core/schemas/employee.schema.core.js')
require('#core/exceptions/domain.exception.js')
require('#core/interfaces/interceptor.interface.js')

// Domain layer
require('#domain/interceptors/employee.interceptor.js')
require('#domain/schemas/base.schema.js')
require('#domain/constants/domain.constants.js')
require('#domain/routes/route-loader.js')

// Utilities
require('#utils/visibilityUtils.js')
require('#utils/errorHandlingUtils.js')  // wrapExpressAsync

// Middlewares
require('#middlewares/protect.js')

// Tests (only available in test environment)
require('#tests/core/setup/database.js')
require('#tests/core/setup/app.js')
require('#tests/factories/employee.factory.js')
```

## Key Files

### Interceptor Registry

`src/domain/interceptors/interceptor.registry.js`

Central registry for all model interceptors. Provides:
- Model-specific interceptor registration
- Global interceptor support with priority
- Hook composition and caching
- Singleton access via `getRegistry()`

### Interceptor Interface

`src/core/interfaces/interceptor.interface.js`

Defines the contract for interceptors:
- `LIFECYCLE_HOOKS` - All available hook names
- `createNoOpInterceptor()` - Default passthrough
- `validateInterceptor()` - Validation helper
- `mergeWithDefaults()` - Merge partial with defaults

### Base Schema

`src/domain/schemas/base.schema.js`

Custom Joi extensions and validation utilities:

```javascript
const { Joi, createValidator, validateSafe, CommonSchemas } = require('#domain/schemas/base.schema.js');

// Custom Joi extensions
Joi.string().alphanumeric()  // Only alphanumeric characters
Joi.string().phone()         // Basic phone number validation

// Create reusable validator function
const validateEmail = createValidator(Joi.string().email());
const result = await validateEmail('test@example.com');

// Non-throwing validation
const { value, errors } = validateSafe(schema, data);
if (errors) {
  // errors: [{ field: 'email', message: '...', type: '...' }]
}

// Common schemas
CommonSchemas.uuid           // UUID v4 format
CommonSchemas.requiredString // Non-empty trimmed string
CommonSchemas.optionalString // Optional trimmed string
CommonSchemas.positiveInt    // Positive integer
CommonSchemas.email          // Email address
CommonSchemas.isoDate        // ISO date string
CommonSchemas.booleanish     // Boolean with string coercion
```

### Domain Exceptions

`src/core/exceptions/domain.exception.js`

Standardized error types:
- `ERROR_TYPES` - VALIDATION, NOT_FOUND, CONFLICT, etc.
- `DomainException` - Exception class with HTTP status mapping
- `createDomainError()` - Factory function

## Domain Routes (Custom Endpoints)

Routes in `src/domain/routes/v1/` are automatically loaded:

```
src/domain/routes/v1/
├── reports.routes.js     → /api/v1/reports/*
├── exports.routes.js     → /api/v1/exports/*
└── webhooks.routes.js    → /api/v1/webhooks/*
```

## QueryBuilder (Query Modification)

Immutable fluent interface for Prisma queries:

```javascript
const { createQueryBuilder } = require('#core/interfaces/query-builder.interface.js');

const query = createQueryBuilder('Employee')
  .where({ status: 'active' })
  .andWhere({ departmentId: 'dept-1' }, { role: 'engineer' })
  .include('department', { select: { name: true } })
  .orderBy('createdAt', 'desc')
  .paginate({ page: 1, pageSize: 20 })
  .build();

// Result:
// {
//   where: { status: 'active', AND: [...] },
//   include: { department: { select: { name: true } } },
//   orderBy: [{ createdAt: 'desc' }],
//   skip: 0,
//   take: 20,
// }
```

## Domain Constants

`src/domain/constants/domain.constants.js`

Application-wide constants for domain logic:

```javascript
const {
  EntityStatus,
  OperationType,
  VisibilityScope,
  PaginationDefaults,
  DateFormats,
  CacheTTL,
  EventPriority,
} = require('#domain/constants/domain.constants.js');

// Entity status values
EntityStatus.ACTIVE    // 'active'
EntityStatus.INACTIVE  // 'inactive'
EntityStatus.PENDING   // 'pending'
EntityStatus.ARCHIVED  // 'archived'
EntityStatus.DELETED   // 'deleted'

// Operation types for audit logging and events
OperationType.CREATE      // 'create'
OperationType.READ        // 'read'
OperationType.UPDATE      // 'update'
OperationType.DELETE      // 'delete'
OperationType.LIST        // 'list'
OperationType.BULK_UPDATE // 'bulk_update'
OperationType.BULK_DELETE // 'bulk_delete'
OperationType.IMPORT      // 'import'
OperationType.EXPORT      // 'export'

// Visibility scopes for multi-tenant data
VisibilityScope.PRIVATE  // Visible only to creator
VisibilityScope.CLIENT   // Visible to same client/tenant
VisibilityScope.SHARED   // Visible to specific users
VisibilityScope.PUBLIC   // Visible to everyone

// Pagination defaults
PaginationDefaults.PAGE          // 1
PaginationDefaults.PAGE_SIZE     // 20
PaginationDefaults.MAX_PAGE_SIZE // 100

// Cache TTL in seconds
CacheTTL.SHORT  // 60 (1 minute)
CacheTTL.MEDIUM // 300 (5 minutes)
CacheTTL.LONG   // 3600 (1 hour)
CacheTTL.DAY    // 86400 (24 hours)

// Event priorities
EventPriority.CRITICAL // 0
EventPriority.HIGH     // 10
EventPriority.NORMAL   // 50
EventPriority.LOW      // 90
```

## Common Utilities

`src/core/utils/common.utils.js`

General-purpose utility functions:

```javascript
const {
  deepClone,
  pick,
  omit,
  isEmpty,
  get,
  groupBy,
  unique,
  chunk,
  sleep,
  retry,
} = require('#core/utils/common.utils.js');

// Deep clone (JSON-safe only)
const copy = deepClone(original);

// Pick specific keys from object
const subset = pick(user, ['id', 'email', 'name']);

// Omit specific keys from object
const safe = omit(user, ['password', 'ssn']);

// Check if value is empty
isEmpty(null)     // true
isEmpty('')       // true
isEmpty([])       // true
isEmpty({})       // true

// Safely get nested property
get(user, 'profile.address.city', 'Unknown');

// Group array by key
const byDept = groupBy(employees, 'departmentId');

// Remove duplicates
const uniqueEmails = unique(users, 'email');

// Chunk array into smaller arrays
const batches = chunk(items, 100);

// Sleep for specified duration
await sleep(1000); // 1 second

// Retry with exponential backoff
const result = await retry(fetchData, { maxRetries: 3, baseDelay: 100 });
```

## OPTIONS Schema Endpoint

Routes expose machine-readable JSON Schema contracts via OPTIONS requests with content negotiation. **Authentication is required** to access schema documentation.

### Usage

Request schema documentation with the `Accept: application/schema+json` header and a valid auth token:

```bash
curl -X OPTIONS http://localhost:3000/api/v1/events \
  -H "Accept: application/schema+json" \
  -H "Authorization: Bearer <your-token>"
```

Without authentication, requests return `401 Unauthorized`.

### Response Format

```json
{
  "query_params": [
    { "name": "page", "required": false, "schema": { "type": "integer", "minimum": 1, "default": 1 } },
    { "name": "pageSize", "required": false, "schema": { "type": "integer", "minimum": 1, "maximum": 100, "default": 20 } },
    { "name": "search", "required": false, "schema": { "type": "string" } },
    { "name": "ordering", "required": false, "schema": { "type": "string" } },
    { "name": "status", "required": false, "schema": { "type": "string", "enum": ["active", "inactive"] } }
  ],
  "methods": {
    "GET": {
      "request_schema": null,
      "response_schema": { "type": "object", "properties": { "items": { "type": "array" }, "totalCount": { "type": "integer" } } },
      "errors": [
        { "status": 400, "code": "BAD_REQUEST", "message": "Invalid request format" },
        { "status": 401, "code": "AUTHENTICATION", "message": "Authentication required" },
        { "status": 403, "code": "AUTHORIZATION", "message": "Insufficient permissions" }
      ]
    },
    "POST": {
      "request_schema": { "type": "object", "properties": { "name": { "type": "string" } }, "required": ["name"] },
      "response_schema": { "type": "object", "properties": { "id": { "type": "string" } } },
      "errors": [
        { "status": 400, "code": "BAD_REQUEST", "message": "Invalid request format" },
        { "status": 422, "code": "VALIDATION", "message": "Validation failed" }
      ]
    }
  }
}
```

### How It Works

1. **Schema Registry** (`schemaRegistry.js`) - Central map of normalized paths to schema configs
2. **Options Builder** (`optionsBuilder.js`) - Converts Joi schemas to JSON Schema using `joi-to-json`
3. **Handler Middleware** (`schemaOptionsHandler.js`) - Intercepts OPTIONS requests with schema header

### Registering Schemas

Routes register schemas at module load time:

```javascript
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');
const { modelCreate, modelUpdate } = require('#core/schemas/model.schema.core.js');

// At end of routes file
register('/api/v1/models', buildOptionsResponse({
  schemas: { create: modelCreate, update: modelUpdate },
  filterFields: ['status', 'name', 'createdAt'],
  methods: ['GET', 'POST'],
}));

register('/api/v1/models/:id', buildOptionsResponse({
  schemas: { create: modelCreate, update: modelUpdate },
  filterFields: [],
  methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
}));
```

### Content Negotiation

| Accept Header | Response |
|---------------|----------|
| `application/schema+json` | JSON Schema contract |
| `*/*` or omitted | Standard CORS preflight response |

## Auto-Discovery

### Interceptors

Files matching `*.interceptor.js` in `src/domain/interceptors/` are auto-discovered:

```
src/domain/interceptors/
├── employee.interceptor.js      → Model: Employee
├── sales-order.interceptor.js   → Model: SalesOrder
└── inventory.interceptor.js     → Model: Inventory
```

### Domain Routes

Files matching `*.routes.js` in `src/domain/routes/v1/` are auto-loaded:

```
src/domain/routes/v1/
├── custom.routes.js    → /api/v1/custom/*
└── admin.routes.js     → /api/v1/admin/*
```

## Testing Strategy

The API uses a multi-layered testing strategy with Jest multi-project configuration.

### Test Execution Order

Tests run in sequence via Jest multi-project configuration:

**Core Tests (generated code):**
1. **core:boot** (`tests/core/boot/`) - Fail fast on initialization issues
2. **core:unit** (`tests/core/unit/`) - Fast isolated tests with mocks
3. **core:integration** (`tests/core/integration/`) - Real database CRUD operations
4. **core:contracts** (`tests/core/contracts/`) - API response schema validation

**Domain Tests (custom code):**
5. **domain:unit** (`tests/domain/unit/`) - Interceptor, middleware, schema tests
6. **domain:integration** (`tests/domain/integration/`) - Custom route tests with real DB
7. **domain:contracts** (`tests/domain/contracts/`) - Custom route response validation

### Test Structure

```
tests/
├── core/                    # Generated code tests (regenerated)
│   ├── setup/
│   │   ├── database.js      # d_compute_ prefix utilities, cleanup
│   │   ├── app.js           # Test app factory
│   │   ├── testTokenUtils.js # JWT token generation
│   │   ├── mockTokenValidator.js # Mock token validation
│   │   └── helpers.js       # Common test helpers
│   ├── boot/
│   │   └── app.boot.test.js # App initialization tests
│   ├── unit/
│   │   └── controllers/     # Controller unit tests
│   ├── integration/
│   │   ├── {model}.integration.test.js # Real DB tests
│   │   └── errors/
│   │       └── {model}.errors.test.js  # Error handling tests
│   └── contracts/
│       ├── schemas/
│       │   ├── common.schema.js # Shared Joi schemas
│       │   └── {model}.schema.js # Model-specific schemas
│       └── {model}.contract.test.js # Schema validation tests
├── domain/                  # Custom code tests (protected)
│   ├── setup/
│   │   └── helpers.js       # Domain test helpers
│   ├── unit/
│   │   ├── interceptors/    # Interceptor unit tests
│   │   ├── middleware/      # Custom middleware tests
│   │   └── schemas/         # Custom schema tests
│   ├── integration/         # Domain integration tests
│   └── contracts/           # Domain contract tests
└── factories/
    └── {model}.factory.js   # Test data factories
```

### Test Data Management

All test records use the `d_compute_` prefix for identification and automated cleanup:

```javascript
const { generateTestId, cleanupTestRecords } = require('#tests/core/setup/database.js');

// Generates: d_compute_1234567890_abc123_employee
const testId = generateTestId('employee');

// Cleanup after tests
afterEach(async () => {
  await cleanupTestRecords('employee');
});
```

### Protected Test Paths

- `tests/domain/` - Protected, never deleted. Put custom tests here.
- `tests/core/` - Regenerated as schema evolves.
- `tests/factories/` - Regenerated with model factories.

### Test Authentication Utilities

Integration tests use mock JWT utilities instead of calling the accounts service:

```javascript
// tests/core/setup/testTokenUtils.js - Token generation
const { createTestToken, createAuthHeaders, DEFAULT_TEST_USER } = require('#tests/core/setup/testTokenUtils.js');

// Create a test token with default user
const token = createTestToken();

// Create a token with custom claims
const adminToken = createTestToken({ roleNames: ['Admin'] });

// Get headers for supertest
const headers = createAuthHeaders();
// Result: { Authorization: 'Bearer <token>' }
```

```javascript
// tests/core/setup/mockTokenValidator.js - Token validation
const { createMockTokenValidator } = require('#tests/core/setup/mockTokenValidator.js');

// Used by app.js to validate tokens in test environment
// SECURITY: Only works when NODE_ENV === 'test'
const validator = createMockTokenValidator();
```

Default test user properties:
- `id`: UUID for test user
- `email`: d_compute_user@test.example.com
- `roles`: ['recruiter']
- `clientId`: UUID for test client

## Best Practices

1. **Never modify core files** - They will be overwritten
2. **Use interceptors for business logic** - They're the extension point
3. **Keep interceptors focused** - One responsibility per hook
4. **Use domain exceptions** - For clear error semantics
5. **Write tests for custom code** - In `tests/` directory
6. **Document complex rules** - In interceptor comments
