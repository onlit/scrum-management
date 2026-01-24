# Routes & Controllers Design Standards & Best Practices

## Overview

This document establishes comprehensive design standards for routes and controllers to ensure consistency, maintainability, scalability, and observability across the entire application. These standards build upon existing conventions for trace IDs, error handling, and Prisma enums.

## Core Design Principles

1. **Consistency Above All** - Every route and controller follows identical patterns
2. **Comprehensive Logging** - Full traceability with structured logging
3. **Standardized Error Handling** - Unified error responses and handling
4. **Security by Default** - Proper authentication and authorization
5. **Validation First** - Input validation before any processing
6. **Separation of Concerns** - Clear boundaries between routing, validation, and business logic

## File Organization & Naming Conventions

### File Structure
```
src/
├── routes/
│   └── v1/
│       ├── {resource}.routes.js     # One file per resource
│       ├── {resource}History.routes.js
│       └── {resource}Attachment.routes.js
├── controllers/
│   ├── {resource}.controller.js     # Matches route file name
│   ├── {resource}History.controller.js
│   └── {resource}Attachment.controller.js
└── schemas/
    ├── {resource}.schemas.js        # Validation schemas
    └── {resource}History.schemas.js
```

### Naming Standards

**✅ CORRECT Naming:**
- Route files: `company.routes.js`, `accountManagerInCompany.routes.js`
- Controller files: `company.controller.js`, `accountManagerInCompany.controller.js`
- Schema files: `company.schemas.js`, `accountManagerInCompany.schemas.js`

**❌ INCORRECT Naming:**
- `companiesRoutes.js` (plural + mixed case)
- `Company.controller.js` (PascalCase)
- `companySchema.js` (singular schema)

### Function Naming Conventions

**Controller Functions - Use camelCase with descriptive verbs:**
- `getAllCompany` - Retrieve all records with pagination
- `getCompany` - Retrieve single record by ID
- `createCompany` - Create new record
- `updateCompany` - Update existing record (handles both PUT/PATCH)
- `deleteCompany` - Soft delete record
- `getCompanyBarChartData` - Specialized data endpoints

**Route Context Names - Use snake_case for tracing:**
- `company_create`, `company_get_all`, `company_get_by_id`
- `company_update_put`, `company_update_patch`, `company_delete`
- `account_manager_in_company_create` (for compound resources)

## Route File Standards

### File Header & Documentation

**✅ REQUIRED File Header:**

```javascript
/**
 * CREATED BY: [Developer Name]
 * CREATOR EMAIL: [email@pullstream.com]
 * CREATION DATE: [DD/MM/YYYY]
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to {resource}. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on {resource}.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new {resource}. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all {resource}. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific {resource} by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific {resource} by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific {resource} by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific {resource} by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 */
```

### Required Imports

**✅ STANDARD Import Order:**

```javascript
const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createResource,
  getAllResource,
  getResource,
  updateResource,
  deleteResource,
  getResourceBarChartData,
} = require('#controllers/resource.controller.js');
```

### Route Definition Standards

**✅ STANDARD Route Patterns:**

```javascript
const router = Router();

// CREATE - Requires auth + protect
router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createResource, 'resource_create'),
);

// READ ALL - Requires auth only
router.get(
  '/',
  auth,
  wrapExpressAsync(getAllResource, 'resource_get_all'),
);

// SPECIAL ENDPOINTS - Before parameterized routes
router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getResourceBarChartData, 'resource_bar_chart'),
);

// READ ONE - Requires auth only
router.get(
  '/:id',
  auth,
  wrapExpressAsync(getResource, 'resource_get_by_id'),
);

// UPDATE (PUT) - Requires auth + protect
router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateResource, 'resource_update_put'),
);

// UPDATE (PATCH) - Requires auth + protect
router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateResource, 'resource_update_patch'),
);

// DELETE - Requires auth + protect
router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteResource, 'resource_delete'),
);

module.exports = router;
```

### Route Ordering Rules

1. **POST routes** - Create operations first
2. **GET collection routes** - List operations
3. **GET special routes** - Custom endpoints (bar-chart, reports, etc.)
4. **GET single item routes** - Parameterized routes last
5. **PUT/PATCH routes** - Update operations
6. **DELETE routes** - Delete operations last

### Middleware Application Standards

| Route Type | Auth Required | Protect Required | Rationale |
|------------|---------------|------------------|-----------|
| POST (Create) | ✅ | ✅ | Modifies data, requires permissions |
| GET (Read All) | ✅ | ❌ | Read-only, user context needed |
| GET (Read One) | ✅ | ❌ | Read-only, user context needed |
| PUT (Update) | ✅ | ✅ | Modifies data, requires permissions |
| PATCH (Update) | ✅ | ✅ | Modifies data, requires permissions |
| DELETE | ✅ | ✅ | Destructive operation, requires permissions |

## Controller File Standards

### File Header & Documentation

**✅ REQUIRED Controller Header:**

```javascript
/**
 * CREATED BY: [Developer Name]
 * CREATOR EMAIL: [email@pullstream.com]
 * CREATION DATE: [DD/MM/YYYY]
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing {resource} using Prisma.
 * It includes functions for retrieving all {resource}, creating a new {resource}, retrieving a single {resource},
 * updating an existing {resource}, and deleting a {resource}.
 *
 * The `getAll{Resource}` function retrieves a paginated list of {resource} based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `create{Resource}` function validates the request body using a Joi schema, generates a unique code
 * for the {resource}, and creates a new {resource} in the database with additional metadata.
 *
 * The `get{Resource}` function retrieves a single {resource} based on the provided {resource} ID, with visibility
 * filters applied to ensure the {resource} is accessible to the requesting user.
 *
 * The `update{Resource}` function updates an existing {resource} in the database based on the provided {resource} ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `delete{Resource}` function deletes a {resource} from the database based on the provided {resource} ID, with
 * visibility filters applied to ensure the {resource} is deletable by the requesting user.
 *
 */
```

### Required Imports

**✅ STANDARD Import Order:**

```javascript
const prisma = require('#configs/prisma.js');
const { resourceCreate, resourceUpdate } = require('#schemas/resource.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  // verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
```

### Controller Function Standards

#### 1. GET ALL Function Pattern

**✅ STANDARD getAllResource Implementation:**

```javascript
async function getAllResource(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllResource', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'name',
      'description',
      'email',
      // ... other searchable text fields
    ];
    const filterFields = [
      ...searchFields,
      'status',
      'categoryId',
      'ownerId',
      // ... other filterable fields including relations
    ];

    const include = {
      category: true,
      owner: true,
      // ... other required relations
    };

    // Log database operation start
    logDatabaseStart('get_all_resource', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: resourceUpdate,
      filterFields,
      searchFields,
      model: 'resource',
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_resource', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllResource', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllResource', req, error);
    throw handleDatabaseError(error, 'get_all_resource');
  }
}
```

#### 2. CREATE Function Pattern

**✅ STANDARD createResource Implementation:**

```javascript
async function createResource(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createResource', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await resourceCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createResource', req, error);
        throw handleValidationError(error, 'resource_creation');
      }
      logOperationError('createResource', req, error);
      throw error;
    }

    const modelRelationFields = ['categoryId', 'ownerId'];

    const include = {
      category: true,
      owner: true,
    };

    // Foreign key access verification (when enabled)
    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_resource', req, {
      name: values.name,
      userId: user?.id,
    });

    const newResource = await prisma.resource.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_resource', req, {
      id: newResource.id,
      code: newResource.code,
    });

    const [newResourceWithDetails] = await getDetailsFromAPI({
      results: [newResource],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('createResource', req, {
      id: newResource.id,
      code: newResource.code,
    });

    res.status(201).json(newResourceWithDetails);
  } catch (error) {
    logOperationError('createResource', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_resource');
  }
}
```

#### 3. GET SINGLE Function Pattern

**✅ STANDARD getResource Implementation:**

```javascript
async function getResource(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getResource', req, {
    user: user?.id,
    resourceId: params?.id,
  });

  try {
    const include = {
      category: true,
      owner: true,
    };

    // Log database operation start
    logDatabaseStart('get_resource', req, {
      resourceId: params?.id,
      userId: user?.id,
    });

    const foundResource = await prisma.resource.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_resource', req, {
      found: !!foundResource,
      resourceId: params?.id,
    });

    if (!foundResource) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Resource not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_resource',
          details: { resourceId: params?.id },
        },
      );
      logOperationError('getResource', req, error);
      throw error;
    }

    const [foundResourceWithDetails] = await getDetailsFromAPI({
      results: [foundResource],
      token: user?.accessToken,
    });

    // Log operation success
    logOperationSuccess('getResource', req, {
      id: foundResource.id,
      code: foundResource.code,
    });

    res.status(200).json(foundResourceWithDetails);
  } catch (error) {
    logOperationError('getResource', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_resource');
  }
}
```

#### 4. UPDATE Function Pattern

**✅ STANDARD updateResource Implementation:**

```javascript
async function updateResource(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateResource', req, {
    resourceId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await resourceUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateResource', req, error);
        throw handleValidationError(error, 'resource_update');
      }
      logOperationError('updateResource', req, error);
      throw error;
    }

    // Foreign key access verification (when enabled)
    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_resource', req, {
      resourceId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedResource = await prisma.resource.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_resource', req, {
      id: updatedResource.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateResource', req, {
      id: updatedResource.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedResource);
  } catch (error) {
    logOperationError('updateResource', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_resource');
  }
}
```

#### 5. DELETE Function Pattern

**✅ STANDARD deleteResource Implementation:**

```javascript
async function deleteResource(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteResource', req, {
    user: user?.id,
    resourceId: params?.id,
  });

  try {
    // Cascade delete related records first (when applicable)
    await prisma.resourceHistory.updateMany({
      where: { resourceId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.resourceAttachment.updateMany({
      where: { resourceId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_resource', req, {
      resourceId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.resource.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_resource', req, {
      deletedCount: result.count,
      resourceId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Resource not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_resource',
          details: { resourceId: params?.id },
        },
      );
      logOperationError('deleteResource', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteResource', req, {
      deletedCount: result.count,
      resourceId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteResource', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_resource');
  }
}
```

#### 6. BAR CHART Function Pattern

**✅ STANDARD getResourceBarChartData Implementation:**

```javascript
async function getResourceBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for resource',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}
```

### Function Export Standards

**✅ REQUIRED Module Exports:**

```javascript
module.exports = {
  getAllResource,
  createResource,
  getResource,
  updateResource,
  deleteResource,
  getResourceBarChartData,
};
```

## Validation Schema Standards

### Schema File Structure

**✅ STANDARD Schema File Pattern:**

```javascript
/**
 * CREATED BY: [Developer Name]
 * CREATOR EMAIL: [email@pullstream.com]
 * CREATION DATE: [DD/MM/YYYY]
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to {resource}.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - {resource}Create.
 * - {resource}Update.
 *
 */

const Joi = require('joi');
const { isValid: isDateValid } = require('date-fns');
const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const resourceBase = visibilityCreate.keys({
  id: Joi.string().uuid().allow(''),
  name: Joi.string().max(150).allow('', null).optional(),
  description: Joi.string().allow('', null).optional(),
  email: Joi.string().email().allow('', null).optional(),
  website: Joi.string().uri().allow('', null).optional(),
  phone: Joi.string().max(25).allow('', null).optional(),
  color: Joi.string().max(40).allow('', null).optional(),
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED')
    .allow('', null)
    .optional(),
  categoryId: Joi.string().uuid().allow(null).optional(),
  ownerId: Joi.string().uuid().allow(null).optional(),
});

const resourceCreate = resourceBase.keys({
  name: Joi.string().max(150).required(),
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'PENDING')
    .default('ACTIVE')
    .required(),
});

const resourceUpdate = resourceBase.keys({
  name: Joi.string().max(150).optional(),
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED')
    .optional(),
});

module.exports = { resourceCreate, resourceUpdate };
```

### Validation Patterns

**Field Type Patterns:**
- **UUIDs**: `Joi.string().uuid().allow(null).optional()`
- **Emails**: `Joi.string().email().allow('', null).optional()`
- **URLs**: `Joi.string().uri().allow('', null).optional()`
- **Text Fields**: `Joi.string().max(150).allow('', null).optional()`
- **Long Text**: `Joi.string().allow('', null).optional()`
- **Phone Numbers**: `Joi.string().max(25).allow('', null).optional()`
- **Enums**: `Joi.string().valid('VALUE1', 'VALUE2').allow('', null).optional()`
- **Booleans**: `Joi.boolean().required()` or `Joi.boolean().optional()`
- **Dates**: `Joi.string().isoDate().allow('', null).optional()`

## Error Handling Integration

### Validation Error Handling

**✅ STANDARD Validation Pattern:**

```javascript
let values;
try {
  values = await resourceSchema.validateAsync(body, {
    abortEarly: false,
    stripUnknown: true,
  });
} catch (error) {
  if (error.isJoi) {
    logOperationError('functionName', req, error);
    throw handleValidationError(error, 'context_name');
  }
  logOperationError('functionName', req, error);
  throw error;
}
```

### Database Error Handling

**✅ STANDARD Database Error Pattern:**

```javascript
try {
  // Database operations
} catch (error) {
  logOperationError('functionName', req, error);
  
  // Re-throw if it's already a standardized error
  if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
    throw error;
  }
  
  throw handleDatabaseError(error, 'context_name');
}
```

### Not Found Error Handling

**✅ STANDARD Not Found Pattern:**

```javascript
if (!foundResource) {
  const error = createErrorWithTrace(
    ERROR_TYPES.NOT_FOUND,
    'Resource not found',
    req,
    {
      severity: ERROR_SEVERITY.LOW,
      context: 'get_resource',
      details: { resourceId: params?.id },
    },
  );
  logOperationError('getResource', req, error);
  throw error;
}
```

## Trace ID Integration

### Operation Logging

**✅ REQUIRED Logging Pattern:**

```javascript
// Start of every controller function
logOperationStart('functionName', req, {
  user: user?.id,
  relevantParams: params?.id,
  bodyKeys: Object.keys(body || {}),
});

// Before database operations
logDatabaseStart('database_operation_name', req, {
  operationParams: 'relevant values',
  userId: user?.id,
});

// After successful database operations
logDatabaseSuccess('database_operation_name', req, {
  resultMetrics: 'relevant values',
  count: results.length,
});

// End of successful operations
logOperationSuccess('functionName', req, {
  id: result.id,
  resultMetrics: 'relevant values',
});

// In catch blocks
logOperationError('functionName', req, error);
```

### Context Naming Standards

**Database Operations:**
- `get_all_{resource}` - List operations
- `get_{resource}` - Single record retrieval
- `create_{resource}` - Create operations
- `update_{resource}` - Update operations
- `delete_{resource}` - Delete operations

**Controller Operations:**
- `getAll{Resource}` - camelCase controller function names
- `get{Resource}`, `create{Resource}`, `update{Resource}`, `delete{Resource}`

## Security & Authorization Standards

### Middleware Requirements

**Authentication Rules:**
- ✅ ALL routes require `auth` middleware
- ✅ CREATE, UPDATE, DELETE routes require `protect` middleware
- ✅ READ-only routes (GET) only require `auth` middleware

**Visibility Filtering:**
- ✅ ALL database queries MUST include `getVisibilityFilters(user)`
- ✅ UPDATE/DELETE operations use `updateMany` with visibility filters
- ✅ Single record queries use `findFirst` with visibility filters

### Foreign Key Validation

**Foreign Key Access Control (when enabled):**

```javascript
// Uncomment and configure when foreign key validation is implemented
// await verifyForeignKeyAccessBatch({
//   user,
//   validations: [
//     // { model: 'category', id: values.categoryId },
//     // { model: 'owner', id: values.ownerId },
//   ],
// });
```

## Performance & Optimization Standards

### Database Query Optimization

**Include Patterns:**
```javascript
const include = {
  category: true,
  owner: true,
  // Only include what's needed
};

// Use conditional includes
include: Object.keys(include).length ? include : undefined,
```

**Search and Filter Fields:**
```javascript
const searchFields = [
  'name',
  'description',
  'email',
  // Text fields that support search
];

const filterFields = [
  ...searchFields,
  'status',
  'categoryId',
  'ownerId',
  // Add all filterable fields including relations
];
```

### Pagination Standards

**✅ Use getPaginatedList utility:**
```javascript
const response = await getPaginatedList({
  query,
  user,
  prisma,
  schema: resourceUpdate,
  filterFields,
  searchFields,
  model: 'resource',
  include: Object.keys(include).length ? include : undefined,
});
```

## Response Format Standards

### Success Responses

**Create Operations:**
- Status: `201 Created`
- Body: Full resource object with includes

**Read Operations:**
- Status: `200 OK`
- Body: Resource object or paginated list

**Update Operations:**
- Status: `200 OK`
- Body: Updated resource object

**Delete Operations:**
- Status: `200 OK`
- Body: `{ deleted: resourceId }`

### Pagination Response Format

**✅ STANDARD Pagination Response:**
```json
{
  "data": [/* array of resources */],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

```

## New Development

**For New Resources:**

1. **Copy template files** from existing standardized resources
2. **Update resource names** throughout templates
3. **Configure search and filter fields** appropriately
4. **Define proper includes** for relations
5. **Add foreign key validations** when ready
6. **Test thoroughly** with required test coverage

## Common Anti-Patterns

### ❌ AVOID These Patterns

**Missing Trace Integration:**
```javascript
// DON'T DO THIS
async function createResource(req, res) {
  console.log('Creating resource'); // Manual logging
  const resource = await prisma.resource.create(data);
  res.json(resource); // No operation tracking
}
```

**Inconsistent Error Handling:**
```javascript
// DON'T DO THIS
catch (error) {
  console.error(error); // No trace correlation
  res.status(500).json({ error: error.message }); // Manual error response
}
```

**Missing Visibility Filters:**
```javascript
// DON'T DO THIS
const resource = await prisma.resource.findFirst({
  where: { id: params.id } // Missing visibility filters
});
```

**Inconsistent Validation:**
```javascript
// DON'T DO THIS
if (!req.body.name) {
  throw new Error('Name is required'); // Manual validation
}
```

**Mixed Route Patterns:**
```javascript
// DON'T DO THIS - Inconsistent middleware usage
router.get('/', getAllResource); // Missing auth
router.post('/', auth, createResource); // Missing protect
router.put('/:id', auth, protect, wrapExpressAsync(updateResource)); // Inconsistent wrapping
```

## Troubleshooting

### Common Issues

**Missing TraceId in Logs:**
- Ensure all functions use trace utility functions
- Verify request object is passed to all utility functions
- Check that middleware is applied correctly

**Authentication Errors:**
- Verify auth middleware is applied to all routes
- Check protect middleware on data-modifying operations
- Ensure visibility filters are applied to database queries

**Validation Issues:**
- Use handleValidationError for Joi validation failures
- Ensure schemas extend visibilityCreate base schema
- Check required vs optional field definitions

**Database Errors:**
- Use handleDatabaseError for database operation failures
- Ensure proper error re-throwing for standardized errors
- Check foreign key relationships and constraints

## Compliance Checklist

### Route File Checklist
- [ ] Proper file header with documentation
- [ ] Standard import order and required imports
- [ ] Consistent route ordering and patterns
- [ ] Proper middleware application (auth/protect)
- [ ] All routes wrapped with wrapExpressAsync
- [ ] Meaningful context names for tracing

### Controller File Checklist
- [ ] Proper file header with documentation
- [ ] Standard import order and required imports
- [ ] Comprehensive operation logging throughout
- [ ] Proper validation with error handling
- [ ] Visibility filters on all database queries
- [ ] Standardized error handling patterns
- [ ] Consistent response formats and status codes
- [ ] Foreign key validation (when enabled)

### Schema File Checklist
- [ ] Proper file header with documentation
- [ ] Extends visibilityCreate base schema
- [ ] Separate create and update schemas
- [ ] Proper field validation patterns
- [ ] Enum validation with proper values
- [ ] Required vs optional field distinction
