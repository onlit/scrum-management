/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to callHistory. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on callHistory.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new callHistory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all callHistory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific callHistory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific callHistory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific callHistory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific callHistory by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createCallHistory,
  getAllCallHistory,
  getCallHistory,
  updateCallHistory,
  deleteCallHistory,
  getCallHistoryBarChartData,
} = require('#controllers/callHistory.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createCallHistory, 'call_history_create'),
);

router.get(
  '/',
  auth,
  wrapExpressAsync(getAllCallHistory, 'call_history_get_all'),
);

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getCallHistoryBarChartData, 'call_history_bar_chart'),
);

router.get(
  '/:id',
  auth,
  wrapExpressAsync(getCallHistory, 'call_history_get_by_id'),
);

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateCallHistory, 'call_history_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateCallHistory, 'call_history_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteCallHistory, 'call_history_delete'),
);

module.exports = router;
