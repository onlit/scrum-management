/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to callList. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new callList. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all callList. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific callList by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific callList by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific callList by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific callList by ID. It requires authentication and protection middleware.
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
  callListCreate,
  callListUpdate,
} = require('#core/schemas/callList.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCallList,
  getAllCallList,
  getCallList,
  updateCallList,
  deleteCallList,
  getCallListBarChartData,
  bulkUpdateCallListVisibility,
} = require('#core/controllers/callList.controller.core.js');

// Filter fields for CallList (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['name', 'callListPipelineId', 'description'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/callList.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CALL_LIST_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CallList routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCallListRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCallList, 'call_list_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: callListUpdate,
      filterFields: CALL_LIST_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCallList, 'call_list_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCallListVisibility,
      'call_list_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getCallListBarChartData, 'call_list_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCallList, 'call_list_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCallList, 'call_list_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCallList, 'call_list_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCallList, 'call_list_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCallListRoutes;
module.exports.router = createCallListRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/call-lists',
  buildOptionsResponse({
    schemas: { create: callListCreate, update: callListUpdate },
    filterFields: CALL_LIST_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/call-lists/:id',
  buildOptionsResponse({
    schemas: { create: callListCreate, update: callListUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
