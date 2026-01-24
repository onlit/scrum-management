/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines routes for dashboard filter management.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getAllDashboardFilters,
  createDashboardFilter,
  getDashboardFilter,
  updateDashboardFilter,
  deleteDashboardFilter,
} = require('#controllers/dashboardFilter.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createDashboardFilter, 'dashboard_filter_create'));

router.get('/', auth, wrapExpressAsync(getAllDashboardFilters, 'dashboard_filter_get_all'));

router.get('/:id', auth, wrapExpressAsync(getDashboardFilter, 'dashboard_filter_get_by_id'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateDashboardFilter, 'dashboard_filter_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteDashboardFilter, 'dashboard_filter_delete'));

module.exports = router;
