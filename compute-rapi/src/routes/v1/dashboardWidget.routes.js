/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines routes for dashboard widget management.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getAllDashboardWidgets,
  createDashboardWidget,
  getDashboardWidget,
  updateDashboardWidget,
  deleteDashboardWidget,
} = require('#controllers/dashboardWidget.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createDashboardWidget, 'dashboard_widget_create'));

router.get('/', auth, wrapExpressAsync(getAllDashboardWidgets, 'dashboard_widget_get_all'));

router.get('/:id', auth, wrapExpressAsync(getDashboardWidget, 'dashboard_widget_get_by_id'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateDashboardWidget, 'dashboard_widget_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteDashboardWidget, 'dashboard_widget_delete'));

module.exports = router;
