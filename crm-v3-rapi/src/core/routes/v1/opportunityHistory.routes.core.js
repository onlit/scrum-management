/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to opportunityHistory. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunityHistory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunityHistory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunityHistory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunityHistory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunityHistory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunityHistory by ID. It requires authentication and protection middleware.
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
  opportunityHistoryCreate,
  opportunityHistoryUpdate,
} = require('#core/schemas/opportunityHistory.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOpportunityHistory,
  getAllOpportunityHistory,
  getOpportunityHistory,
  updateOpportunityHistory,
  deleteOpportunityHistory,
  getOpportunityHistoryBarChartData,
  bulkUpdateOpportunityHistoryVisibility,
} = require('#core/controllers/opportunityHistory.controller.core.js');

// Filter fields for OpportunityHistory (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['opportunityId', 'notes', 'url'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/opportunityHistory.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const OPPORTUNITY_HISTORY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates OpportunityHistory routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOpportunityHistoryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createOpportunityHistory, 'opportunity_history_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: opportunityHistoryUpdate,
      filterFields: OPPORTUNITY_HISTORY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllOpportunityHistory, 'opportunity_history_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOpportunityHistoryVisibility,
      'opportunity_history_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getOpportunityHistoryBarChartData,
      'opportunity_history_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getOpportunityHistory, 'opportunity_history_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityHistory,
      'opportunity_history_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityHistory,
      'opportunity_history_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteOpportunityHistory, 'opportunity_history_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOpportunityHistoryRoutes;
module.exports.router = createOpportunityHistoryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/opportunity-histories',
  buildOptionsResponse({
    schemas: {
      create: opportunityHistoryCreate,
      update: opportunityHistoryUpdate,
    },
    filterFields: OPPORTUNITY_HISTORY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/opportunity-histories/:id',
  buildOptionsResponse({
    schemas: {
      create: opportunityHistoryCreate,
      update: opportunityHistoryUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
