/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to prospectCategory. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
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

const defaultAuth = require('#middlewares/auth.js');
const protect = require('#middlewares/protect.js');
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');
const { parseFilters } = require('#core/middlewares/parseFilters.js');
const {
  prospectCategoryCreate,
  prospectCategoryUpdate,
} = require('#core/schemas/prospectCategory.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createProspectCategory,
  getAllProspectCategory,
  getProspectCategory,
  updateProspectCategory,
  deleteProspectCategory,
  getProspectCategoryBarChartData,
  bulkUpdateProspectCategoryVisibility,
} = require('#core/controllers/prospectCategory.controller.core.js');

// Filter fields for ProspectCategory (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['description', 'name'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/prospectCategory.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PROSPECT_CATEGORY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates ProspectCategory routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createProspectCategoryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createProspectCategory, 'prospect_category_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: prospectCategoryUpdate,
      filterFields: PROSPECT_CATEGORY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllProspectCategory, 'prospect_category_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateProspectCategoryVisibility,
      'prospect_category_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getProspectCategoryBarChartData,
      'prospect_category_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getProspectCategory, 'prospect_category_get_by_id'),
  );

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

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createProspectCategoryRoutes;
module.exports.router = createProspectCategoryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/prospect-categories',
  buildOptionsResponse({
    schemas: { create: prospectCategoryCreate, update: prospectCategoryUpdate },
    filterFields: PROSPECT_CATEGORY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/prospect-categories/:id',
  buildOptionsResponse({
    schemas: { create: prospectCategoryCreate, update: prospectCategoryUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
