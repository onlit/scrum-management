/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines routes for dashboard configuration management.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const protectOrInternal = require('#middlewares/protectOrInternal.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getAllDashboardConfigs,
  createDashboardConfig,
  getDashboardConfig,
  getDashboardConfigByMicroservice,
  updateDashboardConfig,
  deleteDashboardConfig,
  createDashboardBatch,
} = require('#controllers/dashboardConfig.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createDashboardConfig, 'dashboard_config_create'));

router.post('/batch', auth, protectOrInternal, wrapExpressAsync(createDashboardBatch, 'dashboard_batch_create'));

router.get('/', auth, wrapExpressAsync(getAllDashboardConfigs, 'dashboard_config_get_all'));

router.get('/microservice/:microserviceId', auth, wrapExpressAsync(getDashboardConfigByMicroservice, 'dashboard_config_get_by_microservice'));

router.get('/:id', auth, wrapExpressAsync(getDashboardConfig, 'dashboard_config_get_by_id'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateDashboardConfig, 'dashboard_config_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteDashboardConfig, 'dashboard_config_delete'));

module.exports = router;
