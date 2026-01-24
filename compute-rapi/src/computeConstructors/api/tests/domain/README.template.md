# Domain Tests

This directory contains tests for domain-specific customizations that persist across code regeneration.

## Directory Structure

```
tests/domain/
├── unit/                  # Fast, isolated tests with mocked dependencies
│   ├── interceptors/      # Interceptor logic tests
│   ├── middleware/        # Custom middleware tests
│   ├── schemas/           # Joi validation schema tests
│   ├── routes/            # Route handler unit tests
│   └── queues/            # Queue processor unit tests
├── integration/           # Tests with real DB and dependencies
│   ├── interceptors/      # Interceptor integration tests
│   ├── errors/            # Domain-specific error handling tests
│   ├── middleware/        # Middleware with real services
│   ├── routes/            # Full request/response tests
│   └── queues/            # Queue processing tests
├── contracts/             # API response schema validation
│   ├── schemas/           # Domain-specific contract schemas
│   └── routes/            # Custom route contract tests
├── setup/
│   └── helpers.js         # Domain test helpers (extends core)
└── README.md              # This file
```

## Test Placement Guidelines

| Component | Unit Test | Integration Test | Contract Test |
|-----------|-----------|------------------|---------------|
| **Interceptors** | Pure transformations (lowercase email, compute fields) | Hooks with DB operations (check uniqueness, cascade updates) | - |
| **Middleware** | Auth logic with mocked deps | Middleware with real auth service | - |
| **Schemas** | Joi validation rules | - (schemas are pure) | - |
| **Routes** | Handler logic with mocked services | Full request/response with DB | Response shape validation |
| **Queues** | Processor logic with mocked deps | Queue processing with real Redis/DB | - |

## Naming Conventions

- Interceptor tests: `{modelName}.interceptor.test.js` (e.g., `candidate.interceptor.test.js`)
- Route tests: `{routeName}.routes.test.js` (e.g., `employee-reports.routes.test.js`)
- Schema tests: `{schemaName}.schema.test.js` (e.g., `email-validation.schema.test.js`)
- Middleware tests: `{middlewareName}.middleware.test.js` (e.g., `auth.middleware.test.js`)
- Queue tests: `{queueName}.queue.test.js` (e.g., `email-notification.queue.test.js`)

## Test Patterns

### Unit Test Example (Interceptor)

```javascript
const candidateInterceptor = require('#domain/interceptors/candidate.interceptor.js');

describe('Candidate Interceptor - Unit', () => {
  it('should transform email to lowercase before validation', async () => {
    const result = await candidateInterceptor.beforeValidate(
      { email: 'TEST@EXAMPLE.COM' },
      { operation: 'create' }
    );
    expect(result.data.email).toBe('test@example.com');
  });
});
```

### Integration Test Example (Interceptor)

```javascript
const request = require('supertest');
const { getTestApp, cleanDatabase } = require('#tests/domain/setup/helpers.js');

describe('Candidate Interceptor - Integration', () => {
  beforeEach(() => cleanDatabase());

  it('should reject duplicate emails', async () => {
    const app = await getTestApp();
    await request(app).post('/api/v1/candidates').send({ email: 'test@example.com' });
    const res = await request(app).post('/api/v1/candidates').send({ email: 'TEST@EXAMPLE.COM' });
    expect(res.status).toBe(409);
  });
});
```

### Route Test Example

```javascript
const request = require('supertest');
const { initializeApp } = require('#app.js');

describe('Employee Reports Routes', () => {
  let app;

  beforeAll(async () => {
    app = await initializeApp();
  });

  it('GET /api/v1/employee-reports returns report data', async () => {
    const res = await request(app)
      .get('/api/v1/employee-reports')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });
});
```

## Protected Files

All files in `tests/domain/` are protected and never overwritten by the generator.
