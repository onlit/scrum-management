/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to prospectCategory. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on prospectCategory.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new prospectCategory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all prospectCategory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific prospectCategory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific prospectCategory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific prospectCategory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific prospectCategory by ID. It requires authentication and protection middleware.
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
  createProspectCategory,
  getAllProspectCategory,
  getProspectCategory,
  updateProspectCategory,
  deleteProspectCategory,
  getProspectCategoryBarChartData,
} = require('#controllers/prospectCategory.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createProspectCategory, 'prospect_category_create'),
);

router.get('/', auth, wrapExpressAsync(getAllProspectCategory, 'prospect_category_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getProspectCategoryBarChartData, 'prospect_category_bar_chart'),
);

router.get('/:id', auth, wrapExpressAsync(getProspectCategory, 'prospect_category_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateProspectCategory, 'prospect_category_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateProspectCategory, 'prospect_category_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteProspectCategory, 'prospect_category_delete'),
);

module.exports = router;
