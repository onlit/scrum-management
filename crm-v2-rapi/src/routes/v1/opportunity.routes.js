/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports an Express Router instance that defines routes for handling
 * CRUD operations related to opportunity. It imports middleware functions for authentication,
 * authorization, and error handling, as well as controller functions for handling specific
 * CRUD operations on opportunity.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunity. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunity. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunity by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunity by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunity by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunity by ID. It requires authentication and protection middleware.
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
  createOpportunity,
  getAllOpportunity,
  getOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityBarChartData,
  getOpportunityStages,
  bulkUpdateOpportunityVisibility,
} = require('#controllers/opportunity.controller.js');

const router = Router();

router.post(
  '/',
  auth,
  protect,
  wrapExpressAsync(createOpportunity, 'opportunity_create'),
);

router.get(
  '/',
  auth,
  wrapExpressAsync(getAllOpportunity, 'opportunity_get_all'),
);

// BULK: Visibility update
router.patch(
  '/bulk/visibility',
  auth,
  protect,
  wrapExpressAsync(
    bulkUpdateOpportunityVisibility,
    'opportunity_bulk_visibility_update'
  ),
);

router.get(
  '/bar-chart',
  auth,
  wrapExpressAsync(getOpportunityBarChartData, 'opportunity_bar_chart'),
);

// SPECIAL ENDPOINTS - Opportunity stages (kanban-like)
router.get(
  '/stages',
  auth,
  wrapExpressAsync(getOpportunityStages, 'opportunity_stages'),
);

router.get(
  '/:id',
  auth,
  wrapExpressAsync(getOpportunity, 'opportunity_get_by_id'),
);

router.put(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateOpportunity, 'opportunity_update_put'),
);

router.patch(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(updateOpportunity, 'opportunity_update_patch'),
);

router.delete(
  '/:id',
  auth,
  protect,
  wrapExpressAsync(deleteOpportunity, 'opportunity_delete'),
);

module.exports = router;
