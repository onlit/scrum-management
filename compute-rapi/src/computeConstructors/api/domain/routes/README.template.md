# Domain Routes

This directory contains custom API routes that persist across code regeneration.

## Directory Structure

```
src/domain/routes/
├── route-loader.js     # Auto-discovery and loading
├── v1/                 # Version 1 routes
│   └── *.routes.js     # Custom route files
└── README.md           # This file
```

## How Route Auto-Discovery Works

1. The `route-loader.js` scans `v1/` for files matching `*.routes.js`
2. Route prefix is extracted from filename:
   - `reports.routes.js` → `/api/v1/reports`
   - `employee-reports.routes.js` → `/api/v1/employee-reports`
3. Routes are automatically mounted at application startup

## Creating Routes

### Basic Route File

```javascript
// src/domain/routes/v1/reports.routes.js

const express = require('express');
const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const router = express.Router();

// GET /api/v1/reports
router.get('/', auth, protect, wrapExpressAsync(async (req, res) => {
  res.json({ reports: [] });
}, 'reports_list'));

module.exports = router;
```

### Route with Factory Pattern

For testability, export a factory function:

```javascript
// src/domain/routes/v1/analytics.routes.js

const express = require('express');
const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

function createAnalyticsRoutes({ auth = defaultAuth } = {}) {
  const router = express.Router();

  router.get('/summary', auth, protect, wrapExpressAsync(async (req, res) => {
    // Handler
  }, 'analytics_summary'));

  return router;
}

// Export both factory and default instance
module.exports = createAnalyticsRoutes;
module.exports.router = createAnalyticsRoutes();
```

## Adding Sub-Routes to Core Resources

To add custom endpoints to an auto-generated resource (e.g., `/api/v1/candidates/export`), create a route file with the resource name:

```javascript
// src/domain/routes/v1/candidates.routes.js
// This adds routes UNDER /api/v1/candidates

const express = require('express');
const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');
const prisma = require('#configs/prisma.js');

const router = express.Router();

// GET /api/v1/candidates/export
router.get('/export', auth, protect, wrapExpressAsync(async (req, res) => {
  // Export candidates to CSV
}, 'candidates_export'));

// POST /api/v1/candidates/:id/archive
router.post('/:id/archive', auth, protect, wrapExpressAsync(async (req, res) => {
  // Archive a candidate
}, 'candidates_archive'));

module.exports = router;
```

**Note:** Domain routes are mounted AFTER core routes, so domain route handlers take precedence for overlapping paths.

## Accessing Shared Services

### Prisma Client

```javascript
const prisma = require('#configs/prisma.js');

router.get('/', async (req, res) => {
  const records = await prisma.yourModel.findMany();
  res.json(records);
});
```

### Current User

```javascript
router.get('/', auth, protect, async (req, res) => {
  const { user } = req;
  console.log(user.id, user.email, user.client?.id);
});
```

### Interceptor Registry

```javascript
const { getRegistry } = require('#domain/interceptors/interceptor.registry.js');

router.post('/', auth, protect, async (req, res) => {
  const interceptor = getRegistry().resolve('YourModel');
  const result = await interceptor.beforeCreate(req.body, { req, user: req.user });

  if (result.halt) {
    return res.status(result.response.status).json(result.response.body);
  }

  // Continue with creation
});
```

### Domain Queues

```javascript
const { getQueue } = require('#domain/bullQueues/queue-loader.js');

router.post('/process', auth, protect, async (req, res) => {
  const queue = getQueue('myQueue');

  const job = await queue.add('processJob', {
    userId: req.user.id,
    data: req.body,
  });

  res.json({ jobId: job.id, status: 'queued' });
});
```

## Route Middleware Patterns

### Apply to All Routes

```javascript
const router = express.Router();

// Apply to all routes in this router
router.use(auth);
router.use(myCustomMiddleware);

router.get('/', async (req, res) => { /* ... */ });
router.post('/', async (req, res) => { /* ... */ });
```

### Apply to Specific Routes

```javascript
const router = express.Router();

router.get('/', auth, async (req, res) => { /* ... */ });
router.post('/', auth, protect, audit, async (req, res) => { /* ... */ });
```

### Per-Method Middleware

```javascript
const router = express.Router();

router.route('/:id')
  .get(auth, getHandler)
  .put(auth, protect, updateHandler)
  .delete(auth, protect, audit, deleteHandler);
```

## Testing Domain Routes

```javascript
// tests/domain/routes/reports.routes.test.js

const request = require('supertest');
const { initializeApp } = require('#app.js');

describe('Reports Routes', () => {
  let app;

  beforeAll(async () => {
    app = await initializeApp({
      authMiddleware: (req, res, next) => {
        req.user = { id: 'test-user', isAuthenticated: true };
        next();
      },
    });
  });

  it('GET /api/v1/reports returns 200', async () => {
    const res = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
  });
});
```

## Protected Files

All files in `src/domain/routes/` are protected and never overwritten by the generator.
