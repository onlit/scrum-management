/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2024-12-24
 *
 * DESCRIPTION:
 * ------------------
 * This module defines routes for widget date config management.
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  getAllWidgetDateConfigs,
  createWidgetDateConfig,
  getWidgetDateConfig,
  updateWidgetDateConfig,
  deleteWidgetDateConfig,
} = require('#controllers/widgetDateConfig.controller.js');

const router = Router();

router.post('/', auth, protect, wrapExpressAsync(createWidgetDateConfig, 'widget_date_config_create'));

router.get('/', auth, wrapExpressAsync(getAllWidgetDateConfigs, 'widget_date_config_get_all'));

router.get('/:id', auth, wrapExpressAsync(getWidgetDateConfig, 'widget_date_config_get_by_id'));

router.patch('/:id', auth, protect, wrapExpressAsync(updateWidgetDateConfig, 'widget_date_config_update_patch'));

router.delete('/:id', auth, protect, wrapExpressAsync(deleteWidgetDateConfig, 'widget_date_config_delete'));

module.exports = router;
