/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to callHistory. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new callHistory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all callHistory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific callHistory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific callHistory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific callHistory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific callHistory by ID. It requires authentication and protection middleware.
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
  callHistoryCreate,
  callHistoryUpdate,
} = require('#core/schemas/callHistory.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCallHistory,
  getAllCallHistory,
  getCallHistory,
  updateCallHistory,
  deleteCallHistory,
  getCallHistoryBarChartData,
  bulkUpdateCallHistoryVisibility,
} = require('#core/controllers/callHistory.controller.core.js');

// Filter fields for CallHistory (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'outcome',
  'callListPipelineStageId',
  'callScheduleId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/callHistory.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CALL_HISTORY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CallHistory routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCallHistoryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCallHistory, 'call_history_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: callHistoryUpdate,
      filterFields: CALL_HISTORY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCallHistory, 'call_history_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCallHistoryVisibility,
      'call_history_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getCallHistoryBarChartData, 'call_history_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCallHistory, 'call_history_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCallHistory, 'call_history_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCallHistory, 'call_history_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCallHistory, 'call_history_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCallHistoryRoutes;
module.exports.router = createCallHistoryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/call-histories',
  buildOptionsResponse({
    schemas: { create: callHistoryCreate, update: callHistoryUpdate },
    filterFields: CALL_HISTORY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/call-histories/:id',
  buildOptionsResponse({
    schemas: { create: callHistoryCreate, update: callHistoryUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
