/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 09/10/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to opportunityCategory. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on opportunityCategory.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunityCategory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunityCategory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunityCategory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunityCategory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunityCategory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunityCategory by ID. It requires authentication and protection middleware.
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
  createOpportunityCategory,
  getAllOpportunityCategory,
  getOpportunityCategory,
  updateOpportunityCategory,
  deleteOpportunityCategory,
  getOpportunityCategoryBarChartData,
} = require('#controllers/opportunityCategory.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createOpportunityCategory, 'opportunity_category_create'),
);

router.get('/', auth, wrapExpressAsync(getAllOpportunityCategory, 'opportunity_category_get_all'));

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getOpportunityCategoryBarChartData, 'opportunity_category_bar_chart'),
);

router.get('/:id', auth, wrapExpressAsync(getOpportunityCategory, 'opportunity_category_get_by_id'));

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateOpportunityCategory, 'opportunity_category_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateOpportunityCategory, 'opportunity_category_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteOpportunityCategory, 'opportunity_category_delete'),
);

module.exports = router;
