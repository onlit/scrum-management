/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 20/09/2025
 *
 * DESCRIPTION:
 * ------------------
 * Express Router for health probes.
 * - GET '/live': liveness probe (no dependencies).
 * - GET '/ready': readiness probe (checks DB and Redis readiness).
 */

const { Router } = require('express');

const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');
const {
  getLiveness,
  getReadiness,
} = require('#controllers/health.controller.js');

const router = Router();

// Liveness: no auth, must be accessible by kubelet/infra
router.get('/live', wrapExpressAsync(getLiveness, 'health_liveness'));

// Readiness: no auth, kubelet must access without credentials
router.get('/ready', wrapExpressAsync(getReadiness, 'health_readiness'));

module.exports = router;


