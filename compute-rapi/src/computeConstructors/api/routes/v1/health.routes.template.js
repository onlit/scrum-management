const { Router } = require('express');

const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

const {
  getLiveness,
  getReadiness,
} = require('#core/controllers/health.controller.js');

const router = Router();

// Root health check: no auth, for basic health endpoint
router.get('/', wrapExpressAsync(getLiveness, 'health_root'));

// Liveness: no auth, must be accessible by kubelet/infra
router.get('/live', wrapExpressAsync(getLiveness, 'health_live'));

// Readiness: no auth, kubelet must access without credentials
router.get('/ready', wrapExpressAsync(getReadiness, 'health_ready'));

module.exports = router;
