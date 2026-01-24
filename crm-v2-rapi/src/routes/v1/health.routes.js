const { Router } = require('express');

const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getLiveness,
  getReadiness,
} = require('#controllers/health.controller.js');

const router = Router();

// Liveness: no auth, must be accessible by kubelet/infra
router.get('/live', wrapExpressAsync(getLiveness, 'health_live'));

// Readiness: no auth, kubelet must access without credentials
router.get('/ready', wrapExpressAsync(getReadiness, 'health_ready'));

module.exports = router;
