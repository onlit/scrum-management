/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to salesPersonTarget. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on salesPersonTarget.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new salesPersonTarget. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all salesPersonTarget. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific salesPersonTarget by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific salesPersonTarget by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific salesPersonTarget by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific salesPersonTarget by ID. It requires authentication and protection middleware.
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
  createSalesPersonTarget,
  getAllSalesPersonTarget,
  getSalesPersonTarget,
  updateSalesPersonTarget,
  deleteSalesPersonTarget,
  getSalesPersonTargetBarChartData,
} = require('#controllers/salesPersonTarget.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createSalesPersonTarget, 'sales_person_target_create'),
);

router.get(
  '/',
  auth,
  wrapExpressAsync(getAllSalesPersonTarget, 'sales_person_target_get_all'),
);

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(
    getSalesPersonTargetBarChartData,
    'sales_person_target_bar_chart',
  ),
);

router.get(
  '/:id',
  auth,
  wrapExpressAsync(getSalesPersonTarget, 'sales_person_target_get_by_id'),
);

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateSalesPersonTarget, 'sales_person_target_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateSalesPersonTarget, 'sales_person_target_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteSalesPersonTarget, 'sales_person_target_delete'),
);

module.exports = router;
