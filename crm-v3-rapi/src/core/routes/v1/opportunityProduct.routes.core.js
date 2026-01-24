/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to opportunityProduct. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunityProduct. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunityProduct. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunityProduct by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunityProduct by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunityProduct by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunityProduct by ID. It requires authentication and protection middleware.
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
  opportunityProductCreate,
  opportunityProductUpdate,
} = require('#core/schemas/opportunityProduct.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOpportunityProduct,
  getAllOpportunityProduct,
  getOpportunityProduct,
  updateOpportunityProduct,
  deleteOpportunityProduct,
  getOpportunityProductBarChartData,
  bulkUpdateOpportunityProductVisibility,
} = require('#core/controllers/opportunityProduct.controller.core.js');

// Filter fields for OpportunityProduct (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'opportunityId',
  'amount',
  'estimatedValue',
  'productVariantId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/opportunityProduct.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const OPPORTUNITY_PRODUCT_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates OpportunityProduct routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOpportunityProductRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createOpportunityProduct, 'opportunity_product_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: opportunityProductUpdate,
      filterFields: OPPORTUNITY_PRODUCT_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllOpportunityProduct, 'opportunity_product_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOpportunityProductVisibility,
      'opportunity_product_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getOpportunityProductBarChartData,
      'opportunity_product_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getOpportunityProduct, 'opportunity_product_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityProduct,
      'opportunity_product_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityProduct,
      'opportunity_product_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteOpportunityProduct, 'opportunity_product_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOpportunityProductRoutes;
module.exports.router = createOpportunityProductRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/opportunity-products',
  buildOptionsResponse({
    schemas: {
      create: opportunityProductCreate,
      update: opportunityProductUpdate,
    },
    filterFields: OPPORTUNITY_PRODUCT_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/opportunity-products/:id',
  buildOptionsResponse({
    schemas: {
      create: opportunityProductCreate,
      update: opportunityProductUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
