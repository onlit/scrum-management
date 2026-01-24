# Extension Guide

This guide explains how to add custom business logic to your generated microservice without modifying generated code.

## Architecture Overview

```
src/
├── core/                    # AUTO-GENERATED - Do not modify
│   ├── controllers/         # CRUD operations
│   ├── schemas/             # Joi validation
│   ├── routes/              # Express routing
│   ├── interfaces/          # QueryBuilder, interceptor contracts
│   └── exceptions/          # Domain exception types
│
└── domain/                  # PROTECTED - Your custom code goes here
    ├── controllers/         # Custom controllers
    ├── interceptors/        # Lifecycle hooks
    ├── schemas/             # Custom Joi rules
    └── routes/v1/           # Custom domain routes
```

## Creating an Interceptor

1. Open `src/domain/interceptors/{model}.interceptor.js`
2. Uncomment and implement the hooks you need
3. Your changes survive regeneration

## Available Lifecycle Hooks

| Hook | When | Use For |
|------|------|---------|
| `beforeValidate` | Before Joi validation | Data transformation, normalization |
| `extendSchema` | During validation | Custom Joi rules |
| `afterValidate` | After validation passes | Cross-field validation |
| `beforeCreate` | Before DB insert | Computed fields, external API calls |
| `afterCreate` | After DB insert | Notifications, audit logging |
| `beforeUpdate` | Before DB update | Immutable field protection |
| `afterUpdate` | After DB update | Change notifications |
| `beforeDelete` | Before soft delete | Dependency checks |
| `afterDelete` | After soft delete | Cleanup, cascade operations |
| `beforeList` | Before list query | Additional filters |
| `afterList` | After list returns | Response transformation |
| `beforeRead` | Before single read | Access control |
| `afterRead` | After single read | Field redaction |
| `onError` | On any error | Error transformation, recovery |

## Hook Signature

Each hook receives:
- `data` - The current data being processed
- `context` - Request context with user, modelName, operation

Each hook should return:
```javascript
{
  data: { ... },           // Transformed data to continue with
  halt: false,             // Set to true to stop processing
  response: {              // Only if halt is true
    status: 200,
    body: { ... }
  }
}
```

## Example: Email Normalization

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  async beforeValidate(data, context) {
    return {
      data: {
        ...data,
        email: data.email?.toLowerCase()?.trim(),
      },
    };
  },
};
```

## Example: Custom Validation

```javascript
// src/domain/interceptors/employee.interceptor.js
const Joi = require('joi');

module.exports = {
  extendSchema(schema, context) {
    return schema.keys({
      salary: Joi.number().positive().max(10000000),
    });
  },
};
```

## Example: Cross-Field Validation

```javascript
// src/domain/interceptors/employee.interceptor.js
const { createDomainError, ERROR_TYPES } = require('#core/exceptions/domain.exception.js');

module.exports = {
  async afterValidate(data, context) {
    if (data.endDate && data.startDate && data.endDate < data.startDate) {
      return {
        halt: true,
        response: {
          status: 400,
          body: { error: 'End date must be after start date' },
        },
      };
    }
    return { data };
  },
};
```

## Example: Halt Processing

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  async beforeCreate(data, context) {
    if (data.status === 'invalid') {
      return {
        data,
        halt: true,
        response: {
          status: 400,
          body: { error: 'Invalid status' },
        },
      };
    }
    return { data };
  },
};
```

## Example: Computed Fields

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  async beforeCreate(data, context) {
    return {
      data: {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`,
        slug: data.name.toLowerCase().replace(/\s+/g, '-'),
      },
    };
  },
};
```

## Example: Notifications

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  async afterCreate(record, context) {
    // Send notification (implement your own email service)
    console.log(`[NOTIFY] Welcome email for: ${record.email}`);
    return { data: record };
  },
};
```

## Example: Field Redaction

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  async afterRead(record, context) {
    // Remove sensitive fields for non-admin users
    if (!context.user.isAdmin) {
      const { salary, ssn, ...safe } = record;
      return { data: safe };
    }
    return { data: record };
  },
};
```

## Global Interceptors

Register interceptors that apply to all models:

```javascript
// src/domain/interceptors/global.interceptor.js
const { getRegistry } = require('#domain/interceptors/interceptor.registry.js');

const registry = getRegistry();

registry.registerGlobal({
  async afterCreate(record, context) {
    console.log(`[AUDIT] ${context.model} created: ${record.id}`);
    return { data: record };
  },
});
```

## Regeneration Safety

When you regenerate the microservice:

**Regenerated (deleted and recreated):**
- `src/core/` - completely replaced
- `tests/core/` - completely replaced
- `tests/factories/` - completely replaced
- `docs/` - completely replaced

**Protected (NEVER deleted):**
- `src/domain/` - preserved
- `tests/domain/` - preserved

Your interceptors, custom routes, and business logic in domain folders are preserved.

## Using QueryBuilder in Interceptors

Modify list queries using the immutable QueryBuilder:

```javascript
// src/domain/interceptors/employee.interceptor.js
module.exports = {
  async beforeList(queryBuilder, context) {
    // Add additional filters
    const modified = queryBuilder
      .where({ status: 'active' })
      .andWhere({ departmentId: context.user.departmentId })
      .orderBy('createdAt', 'desc');

    return { data: modified };
  },
};
```

QueryBuilder methods:
- `.where(conditions)` - Add where conditions
- `.andWhere(...conditions)` - Add AND conditions
- `.orWhere(...conditions)` - Add OR conditions
- `.include(relation, options)` - Include relations
- `.orderBy(field, direction)` - Add ordering
- `.paginate({ page, pageSize })` - Set pagination

## Adding Custom Domain Routes

Create custom endpoints preserved across regeneration:

```javascript
// src/domain/routes/v1/reports.routes.js
const express = require('express');
const { protect } = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const router = express.Router();

// GET /api/v1/reports/sales
router.get('/sales', protect, wrapExpressAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  const report = await req.prisma.order.aggregate({
    where: {
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
    },
    _sum: { total: true },
    _count: { id: true },
  });

  res.json(report);
}, 'reports_sales'));

// GET /api/v1/reports/inventory
router.get('/inventory', protect, wrapExpressAsync(async (req, res) => {
  const inventory = await req.prisma.product.findMany({
    where: { quantity: { lte: 10 } },
    orderBy: { quantity: 'asc' },
  });

  res.json(inventory);
}, 'reports_inventory'));

module.exports = router;
```

Domain routes are automatically loaded from `src/domain/routes/v1/` on startup.

## Custom Validators

Use custom Joi extensions for domain-specific validation:

```javascript
// src/domain/interceptors/employee.interceptor.js
const { Joi, validateSafe, CommonSchemas } = require('#domain/schemas/base.schema.js');

module.exports = {
  extendSchema(schema, context) {
    return schema.keys({
      // Use custom Joi extensions
      employeeCode: Joi.string().alphanumeric().length(6),
      phone: Joi.string().phone(),

      // Use common schemas
      email: CommonSchemas.email.required(),
      startDate: CommonSchemas.isoDate,
    });
  },

  async afterValidate(data, context) {
    // Use validateSafe for additional validation without throwing
    const customSchema = Joi.object({
      salary: Joi.number().positive().max(data.maxSalary || 1000000),
    });

    const { errors } = validateSafe(customSchema, data);

    if (errors) {
      return {
        halt: true,
        response: {
          status: 400,
          body: { errors },
        },
      };
    }

    return { data };
  },
};
```

Available custom Joi extensions:
- `.alphanumeric()` - Only alphanumeric characters
- `.phone()` - Basic phone number format

Available CommonSchemas:
- `uuid` - UUID v4 format
- `requiredString` - Non-empty trimmed string
- `optionalString` - Optional trimmed string
- `positiveInt` - Positive integer
- `email` - Email address (lowercase, trimmed)
- `isoDate` - ISO date string
- `booleanish` - Boolean with string coercion ('true'/'false')

## Testing Custom Code

Write tests in the `tests/` directory - they're preserved across regeneration.

### Test Setup Utilities

```javascript
const { getTestApp, createAuthHeaders } = require('#tests/core/setup/app.js');
const { generateTestId, cleanupTestRecords, getPrismaClient } = require('#tests/core/setup/database.js');
```

### Using Test Factories

Create test data with the `d_compute_` prefix for automatic cleanup:

```javascript
const { buildEmployee, createEmployee } = require('#tests/factories/employee.factory.js');

describe('Employee Interceptor Tests', () => {
  afterEach(async () => {
    await cleanupTestRecords('employee');
  });

  it('should normalize email in beforeValidate', async () => {
    const data = buildEmployee({ email: 'TEST@Example.COM' });
    // Test your interceptor logic...
  });
});
```

### Testing Contract Schemas

Validate API responses match expected schemas:

```javascript
const { EmployeeResponseSchema } = require('#tests/core/contracts/schemas/employee.schema.js');

it('should return valid schema', async () => {
  const response = await request(app)
    .get('/api/v1/employees/123')
    .set(authHeaders);

  const { error } = EmployeeResponseSchema.validate(response.body);
  expect(error).toBeUndefined();
});
```

### Running Tests

```bash
yarn test                  # All tests (boot → unit → integration → contracts)
yarn test:boot             # Boot/smoke tests - verify app initialization
yarn test:unit             # Unit tests - fast, isolated with mocks
yarn test:integration      # Real database tests
yarn test:contracts        # Schema validation tests
yarn test:ci               # CI/CD mode (sequential, force exit)
```

### Test Authentication

Integration tests use local JWT signing instead of calling accounts service:

```javascript
const { createTestToken, createAuthHeaders, DEFAULT_TEST_USER } = require('#tests/core/setup/testTokenUtils.js');

describe('Employee API', () => {
  it('should create employee as authenticated user', async () => {
    // Default user with 'Recruiter' role
    const headers = createAuthHeaders();

    const response = await request(app)
      .post('/api/v1/employees')
      .set(headers)
      .send(employeeData);

    expect(response.status).toBe(201);
  });

  it('should require admin role for delete', async () => {
    // Custom user with Admin role
    const adminHeaders = createAuthHeaders({ roleNames: ['Admin'] });

    const response = await request(app)
      .delete('/api/v1/employees/123')
      .set(adminHeaders);

    expect(response.status).toBe(200);
  });

  it('should test with different client', async () => {
    const headers = createAuthHeaders({
      clientId: 'other-client-uuid',
      clientDomain: 'other.pullstream.com',
    });

    // Test cross-client isolation
  });
});
```

Default test user properties (override as needed):
- `id`: Test user UUID
- `email`: d_compute_user@test.example.com
- `roles`: ['recruiter']
- `roleNames`: ['Recruiter']
- `clientId`: Test client UUID
- `clientDomain`: test.pullstream.com

## Best Practices

1. **Keep interceptors focused** - One interceptor per model, single responsibility per hook
2. **Use domain exceptions** - Throw `DomainException` for business rule violations
3. **Don't duplicate core logic** - Interceptors extend, not replace, core behavior
4. **Test your interceptors** - Write integration tests for custom business logic
5. **Document complex rules** - Add comments explaining business requirements
