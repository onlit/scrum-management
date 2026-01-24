# Domain Schemas

This directory contains domain-specific validation schemas that persist across code regeneration.

## Core vs Domain Schemas

| Type | Location | Purpose | Overwritten |
|------|----------|---------|-------------|
| Core Schemas | `src/core/schemas/*.core.js` | Auto-generated Joi schemas from model definitions | Yes |
| Domain Schemas | `src/domain/schemas/*.js` | Custom validation rules and extensions | Never |

## Architecture

```
src/
├── core/schemas/
│   ├── candidate.schema.core.js    # Auto-generated: base Joi schema
│   ├── employee.schema.core.js     # Auto-generated: base Joi schema
│   └── ...
│
└── domain/schemas/
    ├── base.schema.js              # Custom Joi extensions and utilities
    ├── candidate.schema.js         # Domain-specific candidate rules (example)
    └── README.md                   # This file
```

## Using base.schema.js

The `base.schema.js` file provides:

1. **Custom Joi Extensions** - Add domain-specific validation rules
2. **Validation Utilities** - Helper functions for common patterns
3. **Common Schemas** - Reusable schema fragments

### Example: Custom Joi Extension

```javascript
const { Joi } = require('./base.schema.js');

// Use custom rules from base.schema.js
const schema = Joi.object({
  phone: Joi.string().phone(),              // Custom phone validation
  code: Joi.string().alphanumeric(),        // Custom alphanumeric
});
```

### Example: Using CommonSchemas

```javascript
const { CommonSchemas } = require('./base.schema.js');

const mySchema = Joi.object({
  id: CommonSchemas.uuid,                    // UUID v4
  email: CommonSchemas.email,                // Lowercase, trimmed email
  count: CommonSchemas.positiveInt,          // Positive integer
});
```

## Extending Core Schemas via Interceptors

The recommended way to extend core schemas is through the `extendSchema` interceptor hook:

### Example: Add Domain Validation to Core Schema

```javascript
// src/domain/interceptors/candidate.interceptor.js

const Joi = require('joi');

module.exports = {
  extendSchema(schema, context) {
    // Add stricter email validation for candidates
    return schema.append({
      email: Joi.string().email().pattern(/@company\.com$/i).messages({
        'string.pattern.base': 'Email must be from @company.com domain',
      }),
    });
  },
};
```

### Example: Conditional Validation

```javascript
// src/domain/interceptors/employee.interceptor.js

const Joi = require('joi');

module.exports = {
  extendSchema(schema, context) {
    // Different rules for create vs update
    if (context.operation === 'create') {
      return schema.append({
        startDate: Joi.date().min('now').required(),
      });
    }
    return schema;
  },

  async afterValidate(data, context) {
    // Cross-field validation
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

### Example: Make Optional Field Required

```javascript
// src/domain/interceptors/order.interceptor.js

const Joi = require('joi');

module.exports = {
  extendSchema(schema, context) {
    // Core schema has optional 'notes', but we require it for high-value orders
    // Note: We handle this in afterValidate since we need access to data
    return schema;
  },

  async afterValidate(data, context) {
    if (data.amount > 10000 && !data.notes) {
      return {
        halt: true,
        response: {
          status: 400,
          body: { error: 'Notes required for orders over $10,000' },
        },
      };
    }
    return { data };
  },
};
```

## Creating Domain-Specific Schemas

For complex validation that doesn't fit in interceptors, create dedicated schema files:

```javascript
// src/domain/schemas/address.schema.js

const { Joi, CommonSchemas } = require('./base.schema.js');

const AddressSchema = Joi.object({
  street: CommonSchemas.requiredString,
  city: CommonSchemas.requiredString,
  state: Joi.string().length(2).uppercase(),
  zip: Joi.string().pattern(/^\d{5}(-\d{4})?$/),
  country: Joi.string().default('US'),
});

const validateAddress = async (address) => {
  return AddressSchema.validateAsync(address, { abortEarly: false });
};

module.exports = {
  AddressSchema,
  validateAddress,
};
```

Then use in your interceptor:

```javascript
// src/domain/interceptors/employee.interceptor.js

const { validateAddress } = require('#domain/schemas/address.schema.js');

module.exports = {
  async afterValidate(data, context) {
    if (data.address) {
      try {
        await validateAddress(data.address);
      } catch (error) {
        return {
          halt: true,
          response: { status: 400, body: { error: error.details } },
        };
      }
    }
    return { data };
  },
};
```

## Limitations

1. **Cannot remove core fields** - You can only add rules, not remove existing ones
2. **Order matters** - extendSchema runs after core schema is constructed
3. **Synchronous only** - extendSchema must be synchronous; use afterValidate for async
4. **No field type changes** - Cannot change a field from string to number

## Protected Files

All files in `src/domain/schemas/` are protected and never overwritten by the generator.
