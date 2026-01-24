/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to opportunityCategory. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
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

const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');
const { parseFilters } = require('#core/middlewares/parseFilters.js');
const {
  opportunityCategoryCreate,
  opportunityCategoryUpdate,
} = require('#core/schemas/opportunityCategory.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOpportunityCategory,
  getAllOpportunityCategory,
  getOpportunityCategory,
  updateOpportunityCategory,
  deleteOpportunityCategory,
  getOpportunityCategoryBarChartData,
  bulkUpdateOpportunityCategoryVisibility,
} = require('#core/controllers/opportunityCategory.controller.core.js');

// Filter fields for OpportunityCategory (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['name', 'description'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/opportunityCategory.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const OPPORTUNITY_CATEGORY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates OpportunityCategory routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOpportunityCategoryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createOpportunityCategory, 'opportunity_category_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: opportunityCategoryUpdate,
      filterFields: OPPORTUNITY_CATEGORY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllOpportunityCategory, 'opportunity_category_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOpportunityCategoryVisibility,
      'opportunity_category_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getOpportunityCategoryBarChartData,
      'opportunity_category_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getOpportunityCategory, 'opportunity_category_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityCategory,
      'opportunity_category_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityCategory,
      'opportunity_category_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteOpportunityCategory, 'opportunity_category_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOpportunityCategoryRoutes;
module.exports.router = createOpportunityCategoryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/opportunity-categories',
  buildOptionsResponse({
    schemas: {
      create: opportunityCategoryCreate,
      update: opportunityCategoryUpdate,
    },
    filterFields: OPPORTUNITY_CATEGORY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/opportunity-categories/:id',
  buildOptionsResponse({
    schemas: {
      create: opportunityCategoryCreate,
      update: opportunityCategoryUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
