/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to companyHistory. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on companyHistory.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new companyHistory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all companyHistory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific companyHistory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific companyHistory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific companyHistory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific companyHistory by ID. It requires authentication and protection middleware.
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
  createCompanyHistory,
  getAllCompanyHistory,
  getCompanyHistory,
  updateCompanyHistory,
  deleteCompanyHistory,
  getCompanyHistoryBarChartData,
} = require('#controllers/companyHistory.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createCompanyHistory, 'company_history_create'),
);

router.get(
  '/',
  auth,
  wrapExpressAsync(getAllCompanyHistory, 'company_history_get_all'),
);

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getCompanyHistoryBarChartData, 'company_history_bar_chart'),
);

router.get(
  '/:id',
  auth,
  wrapExpressAsync(getCompanyHistory, 'company_history_get_by_id'),
);

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateCompanyHistory, 'company_history_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateCompanyHistory, 'company_history_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteCompanyHistory, 'company_history_delete'),
);

module.exports = router;
