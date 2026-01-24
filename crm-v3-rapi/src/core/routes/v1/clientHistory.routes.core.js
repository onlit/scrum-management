/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to clientHistory. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new clientHistory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all clientHistory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific clientHistory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific clientHistory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific clientHistory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific clientHistory by ID. It requires authentication and protection middleware.
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
  clientHistoryCreate,
  clientHistoryUpdate,
} = require('#core/schemas/clientHistory.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createClientHistory,
  getAllClientHistory,
  getClientHistory,
  updateClientHistory,
  deleteClientHistory,
  getClientHistoryBarChartData,
  bulkUpdateClientHistoryVisibility,
} = require('#core/controllers/clientHistory.controller.core.js');

// Filter fields for ClientHistory (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['clientRefId', 'url'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/clientHistory.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CLIENT_HISTORY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates ClientHistory routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createClientHistoryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createClientHistory, 'client_history_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: clientHistoryUpdate,
      filterFields: CLIENT_HISTORY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllClientHistory, 'client_history_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateClientHistoryVisibility,
      'client_history_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getClientHistoryBarChartData, 'client_history_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getClientHistory, 'client_history_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateClientHistory, 'client_history_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateClientHistory, 'client_history_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteClientHistory, 'client_history_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createClientHistoryRoutes;
module.exports.router = createClientHistoryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/client-histories',
  buildOptionsResponse({
    schemas: { create: clientHistoryCreate, update: clientHistoryUpdate },
    filterFields: CLIENT_HISTORY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/client-histories/:id',
  buildOptionsResponse({
    schemas: { create: clientHistoryCreate, update: clientHistoryUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
