/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to companySpin. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on companySpin.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new companySpin. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all companySpin. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific companySpin by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific companySpin by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific companySpin by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific companySpin by ID. It requires authentication and protection middleware.
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
  createCompanySpin,
  getAllCompanySpin,
  getCompanySpin,
  updateCompanySpin,
  deleteCompanySpin,
  getCompanySpinBarChartData,
} = require('#controllers/companySpin.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createCompanySpin, 'company_spin_create'),
);

router.get(
  '/',
  auth,
  wrapExpressAsync(getAllCompanySpin, 'company_spin_get_all'),
);

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getCompanySpinBarChartData, 'company_spin_bar_chart'),
);

router.get(
  '/:id',
  auth,
  wrapExpressAsync(getCompanySpin, 'company_spin_get_by_id'),
);

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateCompanySpin, 'company_spin_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateCompanySpin, 'company_spin_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteCompanySpin, 'company_spin_delete'),
);

module.exports = router;
