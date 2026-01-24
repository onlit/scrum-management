/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to prospectProduct. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new prospectProduct. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all prospectProduct. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific prospectProduct by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific prospectProduct by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific prospectProduct by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific prospectProduct by ID. It requires authentication and protection middleware.
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
  prospectProductCreate,
  prospectProductUpdate,
} = require('#core/schemas/prospectProduct.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createProspectProduct,
  getAllProspectProduct,
  getProspectProduct,
  updateProspectProduct,
  deleteProspectProduct,
  getProspectProductBarChartData,
  bulkUpdateProspectProductVisibility,
} = require('#core/controllers/prospectProduct.controller.core.js');

// Filter fields for ProspectProduct (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'amount',
  'estimatedValue',
  'productVariantId',
  'prospectId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/prospectProduct.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PROSPECT_PRODUCT_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates ProspectProduct routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createProspectProductRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createProspectProduct, 'prospect_product_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: prospectProductUpdate,
      filterFields: PROSPECT_PRODUCT_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllProspectProduct, 'prospect_product_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateProspectProductVisibility,
      'prospect_product_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getProspectProductBarChartData,
      'prospect_product_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getProspectProduct, 'prospect_product_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateProspectProduct, 'prospect_product_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateProspectProduct, 'prospect_product_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteProspectProduct, 'prospect_product_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createProspectProductRoutes;
module.exports.router = createProspectProductRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/prospect-products',
  buildOptionsResponse({
    schemas: { create: prospectProductCreate, update: prospectProductUpdate },
    filterFields: PROSPECT_PRODUCT_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/prospect-products/:id',
  buildOptionsResponse({
    schemas: { create: prospectProductCreate, update: prospectProductUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
