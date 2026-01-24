# Domain Middlewares

This directory contains domain-specific Express middleware that persists across code regeneration.

## Directory Structure

```
src/domain/middlewares/
├── middleware-loader.js    # Auto-discovery and loading
├── *.middleware.js         # Custom middleware files
└── README.md               # This file
```

## Creating Middleware

Create a file with the `.middleware.js` suffix:

```javascript
// src/domain/middlewares/audit.middleware.js

/**
 * Audit Middleware
 *
 * Logs all write operations for compliance.
 */

const prisma = require('#configs/prisma.js');

const auditMiddleware = async (req, res, next) => {
  // Only audit write operations
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const startTime = Date.now();

  // Capture original response
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    // Log after response is ready
    try {
      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          action: req.method,
          resource: req.originalUrl,
          duration: Date.now() - startTime,
          status: res.statusCode,
          traceId: req.traceId,
        },
      });
    } catch (error) {
      console.error('[AuditMiddleware] Failed to log:', error.message);
    }

    return originalJson(data);
  };

  next();
};

module.exports = auditMiddleware;
```

## Applying Middleware

### Option 1: Apply to Domain Routes

```javascript
// src/domain/routes/v1/sensitive.routes.js

const express = require('express');
const auditMiddleware = require('#domain/middlewares/audit.middleware.js');
const { protect } = require('#middlewares/protect.js');

const router = express.Router();

// Apply audit to all routes in this router
router.use(auditMiddleware);

router.get('/reports', protect, async (req, res) => {
  // Handler
});

module.exports = router;
```

### Option 2: Apply to Specific Routes

```javascript
// src/domain/routes/v1/admin.routes.js

const express = require('express');
const auditMiddleware = require('#domain/middlewares/audit.middleware.js');
const ipRestriction = require('#domain/middlewares/ip-restriction.middleware.js');
const { protect } = require('#middlewares/protect.js');

const router = express.Router();

// Apply middleware to specific routes only
router.delete('/users/:id', protect, auditMiddleware, ipRestriction, async (req, res) => {
  // Delete user handler
});

module.exports = router;
```

### Option 3: Inject into Core Routes via Interceptors

For applying middleware to auto-generated routes, use interceptors instead:

```javascript
// src/domain/interceptors/employee.interceptor.js

module.exports = {
  async beforeDelete(record, context) {
    const { req } = context;

    // Check if user has admin IP
    const adminIPs = ['192.168.1.0/24', '10.0.0.0/8'];
    const clientIP = req.ip;

    if (!isIPInRange(clientIP, adminIPs)) {
      return {
        halt: true,
        response: { status: 403, body: { error: 'Delete not allowed from this IP' } },
      };
    }

    return { data: record };
  },
};
```

## Common Middleware Patterns

### Rate Limiting by User

```javascript
// src/domain/middlewares/user-rate-limit.middleware.js

const rateLimit = require('express-rate-limit');

const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per window
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.user?.roleNames?.includes('Admin'),
});

module.exports = userRateLimiter;
```

### Request Validation

```javascript
// src/domain/middlewares/validate-content-type.middleware.js

const validateContentType = (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');

    if (!contentType || !contentType.includes('application/json')) {
      return res.status(415).json({
        error: 'Unsupported Media Type',
        message: 'Content-Type must be application/json',
      });
    }
  }

  next();
};

module.exports = validateContentType;
```

### IP Restriction

```javascript
// src/domain/middlewares/ip-restriction.middleware.js

const ALLOWED_IPS = process.env.ADMIN_IPS?.split(',') || [];

const ipRestriction = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  if (ALLOWED_IPS.length > 0 && !ALLOWED_IPS.includes(clientIP)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Access denied from this IP address',
    });
  }

  next();
};

module.exports = ipRestriction;
```

### Feature Flags

```javascript
// src/domain/middlewares/feature-flag.middleware.js

const createFeatureFlag = (featureName) => {
  return (req, res, next) => {
    const isEnabled = process.env[`FEATURE_${featureName.toUpperCase()}`] === 'true';

    if (!isEnabled) {
      return res.status(404).json({
        error: 'Feature Not Available',
        message: `The ${featureName} feature is not enabled`,
      });
    }

    req.features = req.features || {};
    req.features[featureName] = true;

    next();
  };
};

module.exports = createFeatureFlag;
```

## Testing Middleware

```javascript
// tests/domain/middlewares/audit.middleware.test.js

const httpMocks = require('node-mocks-http');
const auditMiddleware = require('#domain/middlewares/audit.middleware.js');

describe('Audit Middleware', () => {
  it('should skip GET requests', async () => {
    const req = httpMocks.createRequest({ method: 'GET' });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await auditMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should log POST requests', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      user: { id: 'test-user' },
      traceId: 'test-trace',
    });
    const res = httpMocks.createResponse();
    const next = jest.fn();

    await auditMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    // Additional assertions for audit log creation
  });
});
```

## Protected Files

All files in `src/domain/middlewares/` are protected and never overwritten by the generator.
