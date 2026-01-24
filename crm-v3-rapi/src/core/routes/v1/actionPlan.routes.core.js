/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to actionPlan. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new actionPlan. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all actionPlan. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific actionPlan by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific actionPlan by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific actionPlan by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific actionPlan by ID. It requires authentication and protection middleware.
 *
 * All routes are wrapped with the wrapExpressAsync middleware to handle asynchronous operations and
 * properly catch and propagate errors to the error handling middleware.
 *
 *
 */

const { Router } = require('express');

const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');
const { parseFilters } = require('#core/middlewares/parseFilters.js');
const {
  actionPlanCreate,
  actionPlanUpdate,
} = require('#core/schemas/actionPlan.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createActionPlan,
  getAllActionPlan,
  getActionPlan,
  updateActionPlan,
  deleteActionPlan,
  getActionPlanBarChartData,
  bulkUpdateActionPlanVisibility,
} = require('#core/controllers/actionPlan.controller.core.js');

// Filter fields for ActionPlan (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['what', 'opportunityId', 'who', 'when'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/actionPlan.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const ACTION_PLAN_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates ActionPlan routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createActionPlanRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createActionPlan, 'action_plan_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: actionPlanUpdate,
      filterFields: ACTION_PLAN_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllActionPlan, 'action_plan_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateActionPlanVisibility,
      'action_plan_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getActionPlanBarChartData, 'action_plan_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getActionPlan, 'action_plan_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateActionPlan, 'action_plan_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateActionPlan, 'action_plan_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteActionPlan, 'action_plan_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createActionPlanRoutes;
module.exports.router = createActionPlanRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/action-plans',
  buildOptionsResponse({
    schemas: { create: actionPlanCreate, update: actionPlanUpdate },
    filterFields: ACTION_PLAN_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/action-plans/:id',
  buildOptionsResponse({
    schemas: { create: actionPlanCreate, update: actionPlanUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
