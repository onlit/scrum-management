# CRM

A generated microservice API built with Express.js and Prisma ORM, featuring a layered architecture that separates auto-generated code from custom business logic.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Security](#security)
- [Extending the API](#extending-the-api)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js >= 18.18.0
- PostgreSQL 14+
- Redis (optional, for distributed caching)

### Installation

```bash
# Install dependencies
yarn install

# Generate Prisma client
yarn prisma generate

# Run database migrations
yarn prisma migrate dev

# Start development server
yarn dev
```

### Running in Production

```bash
# Start production server
yarn start
```

The API will be available at `http://localhost:8000` (or configured `PORT`).

## Architecture

This microservice follows a layered architecture pattern with clear separation between auto-generated and custom code.

```
src/
├── core/                    # AUTO-GENERATED - Regenerated on each build
│   ├── controllers/         # CRUD controller functions
│   ├── schemas/             # Joi validation schemas
│   ├── routes/              # Express route definitions
│   ├── interfaces/          # QueryBuilder, interceptor contracts
│   └── exceptions/          # Domain exception types
│
├── domain/                  # PROTECTED - Custom business logic
│   ├── controllers/         # Custom controllers
│   ├── interceptors/        # Lifecycle hooks for CRUD operations
│   ├── schemas/             # Custom validation rules
│   └── routes/v1/           # Custom domain routes
│
├── middlewares/             # Express middleware chain
├── configs/                 # Application configuration
├── utils/                   # General utilities
└── bullQueues/              # Background job processing
```

### Layer Responsibilities

| Layer     | Regenerated | Purpose                                             |
| --------- | ----------- | --------------------------------------------------- |
| `core/`   | Yes         | Auto-generated CRUD operations, validation, routing, interfaces |
| `domain/` | No          | Custom business logic, interceptors, routes         |

See [ARCHITECTURE.md](docs/ARCHITECTURE.template.md) for detailed architecture documentation.

## Environment Variables

### Required

| Variable              | Description                        | Example                                                  |
| --------------------- | ---------------------------------- | -------------------------------------------------------- |
| `DATABASE_URL`        | PostgreSQL connection string       | `postgresql://user:pass@localhost:5432/db?schema=public` |
| `ACCOUNTS_HOST`       | Authentication service URL         | `https://sandbox.accounts.pullstream.com`                |
| `CORS_HOSTS`          | Comma-separated allowed domains    | `example.com,api.example.com`                            |
| `ALLOWED_SUB_DOMAINS` | Comma-separated allowed subdomains | `sandbox,staging,me,cms`                                 |

### Optional

| Variable     | Default       | Description                                          |
| ------------ | ------------- | ---------------------------------------------------- |
| `NODE_ENV`   | `development` | Environment (`development`, `staging`, `production`) |
| `PORT`       | `8000`        | Server port                                          |
| `APP_HOST`   | `127.0.0.1`   | Server bind address                                  |
| `CRM_HOST`   | -             | CRM service URL for relation hydration               |
| `REDIS_HOST` | -             | Redis host for distributed caching                   |
| `REDIS_PORT` | `6379`        | Redis port                                           |

### Security Configuration

| Variable                         | Default  | Description                        |
| -------------------------------- | -------- | ---------------------------------- |
| `SECURITY_FAILED_ATTEMPT_WINDOW` | `900000` | Failed auth tracking window (ms)   |
| `SECURITY_MAX_FAILED_ATTEMPTS`   | `5`      | Max failed attempts before alert   |
| `SECURITY_MAX_TRACKED_IPS`       | `1000`   | Max IPs to track for rate limiting |
| `SECURITY_TRUST_PROXY`           | `false`  | Trust X-Forwarded-For header       |

### Health Check Configuration

| Variable                       | Default | Description                     |
| ------------------------------ | ------- | ------------------------------- |
| `READINESS_DB_TIMEOUT_MS`      | `2000`  | Database health check timeout   |
| `READINESS_OVERALL_TIMEOUT_MS` | `5000`  | Overall readiness check timeout |

## API Reference

### Health Endpoints

| Endpoint              | Method | Description                                    |
| --------------------- | ------ | ---------------------------------------------- |
| `/api/v1/health`      | GET    | Root health check (liveness)                   |
| `/api/v1/health/live` | GET    | Kubernetes liveness probe                      |
| `/api/v1/health/ready`| GET    | Kubernetes readiness probe (includes DB check) |

### CRUD Endpoints

For each model, the following endpoints are auto-generated:

| Endpoint                         | Method | Description                          |
| -------------------------------- | ------ | ------------------------------------ |
| `/api/v1/{model}`                | GET    | List records (paginated, filterable) |
| `/api/v1/{model}`                | POST   | Create record                        |
| `/api/v1/{model}/:id`            | GET    | Get single record                    |
| `/api/v1/{model}/:id`            | PUT    | Update record                        |
| `/api/v1/{model}/:id`            | DELETE | Soft delete record                   |
| `/api/v1/{model}/:id/visibility` | PATCH  | Update visibility (bulk)             |

### Query Parameters

| Parameter   | Description                | Example             |
| ----------- | -------------------------- | ------------------- |
| `page`      | Page number (1-indexed)    | `?page=1`           |
| `limit`     | Records per page (max 100) | `?limit=20`         |
| `sortBy`    | Sort field                 | `?sortBy=createdAt` |
| `sortOrder` | Sort direction             | `?sortOrder=desc`   |
| `search`    | Full-text search           | `?search=john`      |
| `{field}`   | Field filter               | `?status=active`    |

### Import/Export

| Endpoint                       | Method | Description                 |
| ------------------------------ | ------ | --------------------------- |
| `/api/v1/imports/{model}`      | POST   | Import CSV/JSON data        |
| `/api/v1/exports/{model}`      | POST   | Export data to CSV/JSON     |
| `/api/v1/undelete/{model}/:id` | POST   | Restore soft-deleted record |

## Security

### Middleware Stack

The API applies security middleware in the following order:

1. **Trace ID** - Request correlation for distributed tracing
2. **Body Parser** - JSON/URL-encoded parsing (10MB limit)
3. **Security Logger** - Audit logging for security events
4. **Rate Limiter** - Tiered rate limiting by endpoint type
5. **Internal Request Handler** - Service-to-service authentication
6. **CORS** - Cross-origin resource sharing with allowlist
7. **Input Sanitizer** - XSS and injection prevention
8. **Helmet** - HTTP security headers

### Rate Limiting

| Endpoint Type    | Limit        | Window     |
| ---------------- | ------------ | ---------- |
| General API      | 100 requests | 5 minutes  |
| Authentication   | 10 requests  | 15 minutes |
| Write Operations | 30 requests  | 5 minutes  |
| File Uploads     | 10 uploads   | 10 minutes |
| Burst Protection | 20 requests  | 1 minute   |

### CORS Configuration

CORS is configured via environment variables with fail-fast validation:

- **HTTPS Required**: Production requires HTTPS origins
- **Domain Allowlist**: Only configured domains are allowed
- **Subdomain Support**: Configurable subdomain patterns
- **Credentials**: Enabled for authenticated requests

### Security Events

The API logs security-relevant events with severity levels:

| Event                  | Severity |
| ---------------------- | -------- |
| Authentication Failure | MEDIUM   |
| Rate Limit Exceeded    | HIGH     |
| SQL Injection Attempt  | CRITICAL |
| XSS Attempt            | HIGH     |
| Path Traversal Attempt | HIGH     |

## Extending the API

### Interceptors

Interceptors provide lifecycle hooks for CRUD operations. Create or modify interceptors in `src/domain/interceptors/`:

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  // Transform data before validation
  async beforeValidate(data, context) {
    return {
      data: {
        ...data,
        email: data.email?.toLowerCase()?.trim(),
      },
    };
  },

  // Add custom validation rules
  extendSchema(schema, context) {
    return schema.keys({
      salary: Joi.number().positive().max(10000000),
    });
  },

  // Pre-create logic
  async beforeCreate(data, context) {
    return {
      data: {
        ...data,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
      },
    };
  },

  // Post-create notifications
  async afterCreate(record, context) {
    await sendWelcomeEmail(record.email);
    return { data: record };
  },
};
```

### Available Hooks

| Hook             | When                  | Use Case                        |
| ---------------- | --------------------- | ------------------------------- |
| `beforeValidate` | Before Joi validation | Data normalization              |
| `extendSchema`   | During validation     | Custom Joi rules                |
| `afterValidate`  | After validation      | Cross-field validation          |
| `beforeCreate`   | Before DB insert      | Computed fields, external calls |
| `afterCreate`    | After DB insert       | Notifications, audit            |
| `beforeUpdate`   | Before DB update      | Immutable field protection      |
| `afterUpdate`    | After DB update       | Change notifications            |
| `beforeDelete`   | Before soft delete    | Dependency checks               |
| `afterDelete`    | After soft delete     | Cleanup operations              |
| `beforeList`     | Before list query     | Query modification              |
| `afterList`      | After list returns    | Response transformation         |
| `beforeRead`     | Before single read    | Access control                  |
| `afterRead`      | After single read     | Field redaction                 |
| `onError`        | On any error          | Custom error handling           |

### Custom Routes

Add custom endpoints in `src/domain/routes/v1/` (auto-discovered):

```javascript
// src/domain/routes/v1/reports.routes.js
const express = require('express');
const { protect } = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const router = express.Router();

router.get(
  '/sales',
  protect,
  wrapExpressAsync(async (req, res) => {
    const report = await req.prisma.order.aggregate({
      _sum: { total: true },
      _count: { id: true },
    });
    res.json(report);
  }, 'reports_sales')
);

module.exports = router;
```

See [EXTENSION_GUIDE.md](docs/EXTENSION_GUIDE.template.md) for detailed extension documentation.

## Testing

This API uses a multi-layered testing strategy with Jest multi-project configuration. Tests run in order: boot → unit → integration → contracts.

### Running Tests

```bash
# Run all tests (recommended)
yarn test

# Run specific test projects
yarn test:boot         # Boot/smoke tests - verify app initialization
yarn test:unit         # Unit tests - fast, isolated with mocks
yarn test:integration  # Integration tests - real database operations
yarn test:contracts    # Contract tests - API response schema validation

# Run for CI/CD (sequential, force exit)
yarn test:ci

# Run with coverage
yarn test --coverage
```

### Test Structure

```
tests/
├── core/
│   ├── setup/
│   │   ├── database.js          # Database utilities, d_compute_ prefix cleanup
│   │   ├── app.js               # Test app factory
│   │   ├── testTokenUtils.js    # JWT test token generation
│   │   └── helpers.js           # Common test helpers
│   ├── boot/
│   │   └── app.boot.test.js     # Application bootstrap tests
│   ├── unit/
│   │   ├── controllers/         # Controller unit tests (mocked)
│   │   └── utils/               # Utility function tests
│   ├── integration/
│   │   ├── {model}.integration.test.js # Real database CRUD tests
│   │   └── errors/
│   │       └── {model}.errors.test.js  # Error handling tests (404, 422, etc.)
│   └── contracts/
│       ├── schemas/
│       │   ├── common.schema.js     # Shared Joi response schemas
│       │   └── {model}.schema.js    # Model-specific response schemas
│       └── {model}.contract.test.js # Contract validation tests
├── domain/                      # Custom domain tests (never regenerated)
│   ├── unit/
│   ├── integration/
│   └── contracts/
└── factories/
    └── {model}.factory.js       # Test data factories
```

### Test Data Management

All test records use the `d_compute_` prefix for identification and cleanup:

```javascript
const { generateTestId, cleanupTestRecords } = require('#tests/core/setup/database.js');

// Generate test IDs
const testId = generateTestId('employee');  // d_compute_1234567890_abc123_employee

// Cleanup test records after tests
afterEach(async () => {
  await cleanupTestRecords('employee');
});
```

### Writing Integration Tests

```javascript
const request = require('supertest');
const { getTestApp, createAuthHeaders } = require('#tests/core/setup/app.js');
const { createEmployee } = require('#tests/factories/employee.factory.js');

describe('Employee Integration Tests', () => {
  let app;
  let authHeaders;

  beforeAll(() => {
    app = getTestApp();
    authHeaders = createAuthHeaders();
  });

  it('should create employee and persist to database', async () => {
    const response = await request(app)
      .post('/api/v1/employees')
      .set(authHeaders)
      .send({ name: 'd_compute_test_employee' })
      .expect(201);

    expect(response.body.id).toBeDefined();
  });
});
```

### Writing Contract Tests

```javascript
const { EmployeeResponseSchema } = require('#tests/core/contracts/schemas/employee.schema.js');

it('should return response matching schema', async () => {
  const response = await request(app)
    .get('/api/v1/employees')
    .set(authHeaders)
    .expect(200);

  const { error } = EmployeeResponseSchema.validate(response.body);
  expect(error).toBeUndefined();
});
```

## Deployment

### Docker

Build and run the container:

```bash
# Build
docker build -t CRM .

# Run
docker run -p 8000:8000 \
  -e DATABASE_URL="postgresql://..." \
  -e CORS_HOSTS="example.com" \
  -e ALLOWED_SUB_DOMAINS="sandbox,staging" \
  CRM
```

### Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: .
    ports:
      - '8000:8000'
    environment:
      DATABASE_URL: postgresql://postgres:password@db:5432/app
      CORS_HOSTS: example.com
      ALLOWED_SUB_DOMAINS: sandbox,staging
    depends_on:
      - db
      - pgbouncer

  db:
    image: postgres:14-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: password
```

### Kubernetes

The API includes health endpoints for Kubernetes probes:

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/liveness
    port: 8000
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/v1/health/readiness
    port: 8000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### CI/CD (GitLab)

The included `.gitlab-ci.yml` supports:

- Multi-environment builds (dev, staging, production)
- Docker layer caching
- Downstream pipeline triggers
- AMD64 architecture support

## Troubleshooting

### Database Connection Issues

```bash
# Check database connectivity
yarn prisma db execute --stdin <<< "SELECT 1"

# Reset database (development only)
yarn prisma migrate reset
```

### CORS Errors

1. Verify `CORS_HOSTS` includes your domain
2. Check `ALLOWED_SUB_DOMAINS` for subdomain access
3. Review logs for `[CORS_REJECTED]` entries

### Rate Limiting

If hitting rate limits:

- Check `[RATE_LIMIT_EXCEEDED]` log entries
- Internal requests skip rate limiting when `user.internalRequest === true`

### Interceptor Not Working

1. Verify file naming: `{model}.interceptor.js`
2. Check interceptor is in `src/domain/interceptors/`
3. Look for `[Interceptor] Discovered:` log on startup

## Path Aliases

The API uses Node.js subpath imports for cleaner imports:

| Alias            | Path                    |
| ---------------- | ----------------------- |
| `#src/*`         | `./src/*`               |
| `#core/*`        | `./src/core/*`          |
| `#domain/*`      | `./src/domain/*`        |
| `#utils/*`       | `./src/core/utils/*`    |
| `#configs/*`     | `./src/core/configs/*`  |
| `#middlewares/*` | `./src/core/middlewares/*` |
| `#bullQueues/*`  | `./src/core/bullQueues/*`  |
| `#tests/*`       | `./tests/*`             |
