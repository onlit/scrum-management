# Error Handling Standards & Guidelines

## Overview
The codebase uses a **standardized error handling system** with three main files providing different levels of error functionality:

- `src/utils/shared/errorHandlingUtils.js` - Primary error handling utilities (USE THIS)
- `src/utils/shared/generalUtils.js` - Legacy error creation (internal use only)
- `src/configs/constants.js` - Error constants (being phased out)

## Error Handling Convention

### 1. Primary Error Creation Functions

**✅ RECOMMENDED: Use `createStandardError()` from errorHandlingUtils.js for ALL new error handling:**

```javascript
const { createStandardError, ERROR_TYPES, ERROR_SEVERITY } = require('#src/utils/shared/errorHandlingUtils.js');

// Standard usage
throw createStandardError(ERROR_TYPES.VALIDATION, 'Custom message', {
  severity: ERROR_SEVERITY.LOW,
  context: 'user_registration',
  details: { field: 'email' }
});
```

**❌ DEPRECATED: Legacy `createError()` from generalUtils.js should only be used internally by errorHandlingUtils.js**

### 2. Async Function Wrapping

**Express Routes - Use `wrapExpressAsync()`:**

```javascript
const { wrapExpressAsync } = require('#src/utils/shared/errorHandlingUtils.js');

router.get('/users', wrapExpressAsync(async (req, res) => {
  const users = await userService.getAllUsers();
  res.json(users);
}, 'get_users_route'));
```

**General Async Functions - Use `withErrorHandling()`:**

```javascript
const { withErrorHandling } = require('#src/utils/shared/errorHandlingUtils.js');

const processUserData = withErrorHandling(async (userData) => {
  // Processing logic here
  return await validateAndProcessUser(userData);
}, 'user_data_processing');
```

### 3. Specialized Error Handlers

**Database Errors:**

```javascript
const { handleDatabaseError } = require('#src/utils/shared/errorHandlingUtils.js');

try {
  const user = await prisma.user.create(userData);
  return user;
} catch (error) {
  throw handleDatabaseError(error, 'create_user_db');
}
```

**Validation Errors:**

```javascript
const { handleValidationError } = require('#src/utils/shared/errorHandlingUtils.js');

const { error, value } = userSchema.validate(req.body);
if (error) {
  throw handleValidationError(error, 'user_input_validation');
}
```

## Error Types & When to Use

| Error Type | HTTP Status | Use Case | Example |
|------------|-------------|----------|---------|
| `VALIDATION` | 422 | Input validation failures | Invalid email format, missing required fields |
| `AUTHENTICATION` | 401 | Missing/invalid auth | No token provided, expired JWT |
| `AUTHORIZATION` | 403 | Insufficient permissions | User lacks role for operation |
| `NOT_FOUND` | 404 | Resource doesn't exist | User ID not found, endpoint doesn't exist |
| `CONFLICT` | 409 | Duplicate resources | Email already exists, unique constraint violation |
| `BAD_REQUEST` | 400 | Malformed requests | Invalid JSON, wrong data types |
| `INTERNAL` | 500 | Unexpected system errors | Database connection failed, third-party API down |
| `SERVICE_UNAVAILABLE` | 503 | Temporary outages | Database maintenance, rate limit exceeded |
| `RATE_LIMIT` | 429 | Too many requests | API rate limiting |

## Error Severity Levels

- **`LOW`**: Expected errors that don't indicate system problems
  - Validation errors, not found resources, user input errors
- **`MEDIUM`**: Errors that need attention but aren't critical
  - Authentication issues, bad requests, permission errors
- **`HIGH`**: Serious errors that indicate system problems
  - Database failures, internal errors, external service failures
- **`CRITICAL`**: System-wide failures requiring immediate attention
  - Security breaches, data corruption, complete system outages

## Context Naming Convention

**Use descriptive, snake_case context names for better readability and consistency:**

### Why snake_case over camelCase?

1. **Log Readability**: Error contexts appear in logs and monitoring systems where snake_case is more readable
   ```
   // More readable in logs
   [ERROR] validation: Input validation failed in user_registration
   
   // vs harder to scan
   [ERROR] validation: Input validation failed in userRegistration
   ```

2. **Database/System Consistency**: Most database columns, environment variables, and system identifiers use snake_case
3. **Grep-ability**: Easier to search logs with underscores as word separators
4. **International Standards**: Many logging and monitoring systems default to snake_case conventions

### Context Naming Patterns:

**Controller Actions:**
```javascript
// Pattern: {action}_{resource}
'create_user', 'update_microservice', 'delete_model', 'get_field_definitions'
```

**Database Operations:**
```javascript
// Pattern: {resource}_db_{operation}  
'user_db_create', 'model_db_update', 'field_db_delete', 'microservice_db_query'
```

**External Service Calls:**
```javascript
// Pattern: {service}_{operation}
'git_api_create_repo', 'auth_service_verify', 'email_service_send'
```

**Utility Functions:**
```javascript
// Pattern: {domain}_{operation}
'file_processing', 'data_validation', 'schema_generation', 'template_rendering'
```

**Background Jobs:**
```javascript
// Pattern: {job_type}_{operation}
'import_csv_processing', 'export_data_generation', 'notification_dispatch'
```

## Complete Usage Examples

### Controller Error Handling

```javascript
const { wrapExpressAsync, createStandardError, ERROR_TYPES, ERROR_SEVERITY } = require('#src/utils/shared/errorHandlingUtils.js');

// Good: Using wrapExpressAsync with proper context
const createUser = wrapExpressAsync(async (req, res) => {
  const { email, name } = req.body;
  
  // Validate input
  if (!email || !name) {
    throw createStandardError(ERROR_TYPES.VALIDATION, 'Email and name are required', {
      severity: ERROR_SEVERITY.LOW,
      context: 'create_user_validation',
      details: { missingFields: !email ? ['email'] : ['name'] }
    });
  }

  // Check if user exists
  const existingUser = await userService.findByEmail(email);
  if (existingUser) {
    throw createStandardError(ERROR_TYPES.CONFLICT, 'User with this email already exists', {
      severity: ERROR_SEVERITY.LOW,
      context: 'create_user_duplicate_check',
      details: { email }
    });
  }

  const user = await userService.create({ email, name });
  res.status(201).json(user);
}, 'create_user_controller');
```

### Service Layer Error Handling

```javascript
const { withErrorHandling, handleDatabaseError } = require('#src/utils/shared/errorHandlingUtils.js');

const userService = {
  create: withErrorHandling(async (userData) => {
    try {
      return await prisma.user.create({
        data: userData
      });
    } catch (error) {
      throw handleDatabaseError(error, 'user_service_create');
    }
  }, 'user_service_create'),

  findByEmail: withErrorHandling(async (email) => {
    try {
      return await prisma.user.findUnique({
        where: { email }
      });
    } catch (error) {
      throw handleDatabaseError(error, 'user_service_find_by_email');
    }
  }, 'user_service_find_by_email')
};
```

## Best Practices

### DO ✅

1. **Always provide meaningful context** when creating errors
2. **Use appropriate severity levels** for proper logging and alerting
3. **Include relevant details** for debugging without exposing sensitive data
4. **Use specialized handlers** (database, validation) for automatic error conversion
5. **Wrap all async operations** with appropriate error handling
6. **Use snake_case for context names** for consistency and readability
7. **Be specific with error types** rather than defaulting to INTERNAL

### DON'T ❌

1. **Don't use generic Error objects** - always use createStandardError
2. **Don't expose sensitive information** in error messages or details
3. **Don't use camelCase for context names** - breaks log readability patterns
4. **Don't ignore error context** - always provide meaningful context strings
5. **Don't mix error handling patterns** - stick to the standardized approach
6. **Don't catch and re-throw without adding value** - let specialized handlers work

## Migration Guide

### Updating Existing Code

**Before (Legacy):**
```javascript
const { createError } = require('#src/utils/shared/generalUtils.js');

throw createError({
  status: 404,
  message: 'User not found'
});
```

**After (Standardized):**
```javascript
const { createStandardError, ERROR_TYPES, ERROR_SEVERITY } = require('#src/utils/shared/errorHandlingUtils.js');

throw createStandardError(ERROR_TYPES.NOT_FOUND, 'User not found', {
  severity: ERROR_SEVERITY.LOW,
  context: 'user_lookup'
});
```