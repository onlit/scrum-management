/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to personHistory. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on personHistory.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new personHistory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all personHistory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific personHistory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific personHistory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific personHistory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific personHistory by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const auth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const protectOrInternal = require('#middlewares/protectOrInternal.js');
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

const {
  createPersonHistory,
  getAllPersonHistory,
  getPersonHistory,
  updatePersonHistory,
  deletePersonHistory,
  getPersonHistoryBarChartData,
} = require('#controllers/personHistory.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protectOrInternal,
  wrapExpressAsync(createPersonHistory, 'person_history_create'),
);

router.get(
  '/',
  auth,
  wrapExpressAsync(getAllPersonHistory, 'person_history_get_all'),
);

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getPersonHistoryBarChartData, 'person_history_bar_chart'),
);

router.get(
  '/:id',
  auth,
  wrapExpressAsync(getPersonHistory, 'person_history_get_by_id'),
);

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updatePersonHistory, 'person_history_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updatePersonHistory, 'person_history_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deletePersonHistory, 'person_history_delete'),
);

module.exports = router;
