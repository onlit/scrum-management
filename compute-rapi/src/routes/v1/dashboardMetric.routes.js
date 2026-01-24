/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines routes for dashboard metric management.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getAllDashboardMetrics,
  createDashboardMetric,
  getDashboardMetric,
  updateDashboardMetric,
  deleteDashboardMetric,
} = require('#controllers/dashboardMetric.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createDashboardMetric, 'dashboard_metric_create'));

router.get('/', auth, wrapExpressAsync(getAllDashboardMetrics, 'dashboard_metric_get_all'));

router.get('/:id', auth, wrapExpressAsync(getDashboardMetric, 'dashboard_metric_get_by_id'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateDashboardMetric, 'dashboard_metric_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteDashboardMetric, 'dashboard_metric_delete'));

module.exports = router;
