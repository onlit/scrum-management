/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to dataNeeded. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new dataNeeded. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all dataNeeded. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific dataNeeded by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific dataNeeded by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific dataNeeded by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific dataNeeded by ID. It requires authentication and protection middleware.
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
  dataNeededCreate,
  dataNeededUpdate,
} = require('#core/schemas/dataNeeded.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createDataNeeded,
  getAllDataNeeded,
  getDataNeeded,
  updateDataNeeded,
  deleteDataNeeded,
  getDataNeededBarChartData,
  bulkUpdateDataNeededVisibility,
} = require('#core/controllers/dataNeeded.controller.core.js');

// Filter fields for DataNeeded (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['whoFrom', 'opportunityId', 'infoNeeded', 'notes'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/dataNeeded.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const DATA_NEEDED_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates DataNeeded routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createDataNeededRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createDataNeeded, 'data_needed_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: dataNeededUpdate,
      filterFields: DATA_NEEDED_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllDataNeeded, 'data_needed_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateDataNeededVisibility,
      'data_needed_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getDataNeededBarChartData, 'data_needed_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getDataNeeded, 'data_needed_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateDataNeeded, 'data_needed_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateDataNeeded, 'data_needed_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteDataNeeded, 'data_needed_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createDataNeededRoutes;
module.exports.router = createDataNeededRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/data-neededs',
  buildOptionsResponse({
    schemas: { create: dataNeededCreate, update: dataNeededUpdate },
    filterFields: DATA_NEEDED_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/data-neededs/:id',
  buildOptionsResponse({
    schemas: { create: dataNeededCreate, update: dataNeededUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
