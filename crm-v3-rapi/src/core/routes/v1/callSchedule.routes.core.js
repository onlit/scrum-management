/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to callSchedule. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new callSchedule. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all callSchedule. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific callSchedule by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific callSchedule by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific callSchedule by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific callSchedule by ID. It requires authentication and protection middleware.
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
  callScheduleCreate,
  callScheduleUpdate,
} = require('#core/schemas/callSchedule.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCallSchedule,
  getAllCallSchedule,
  getCallSchedule,
  updateCallSchedule,
  deleteCallSchedule,
  getCallScheduleBarChartData,
  bulkUpdateCallScheduleVisibility,
} = require('#core/controllers/callSchedule.controller.core.js');

// Filter fields for CallSchedule (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'callListPipelineStageId',
  'scheduleDatetime',
  'callListId',
  'personId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/callSchedule.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CALL_SCHEDULE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CallSchedule routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCallScheduleRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCallSchedule, 'call_schedule_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: callScheduleUpdate,
      filterFields: CALL_SCHEDULE_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCallSchedule, 'call_schedule_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCallScheduleVisibility,
      'call_schedule_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getCallScheduleBarChartData, 'call_schedule_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCallSchedule, 'call_schedule_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCallSchedule, 'call_schedule_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCallSchedule, 'call_schedule_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCallSchedule, 'call_schedule_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCallScheduleRoutes;
module.exports.router = createCallScheduleRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/call-schedules',
  buildOptionsResponse({
    schemas: { create: callScheduleCreate, update: callScheduleUpdate },
    filterFields: CALL_SCHEDULE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/call-schedules/:id',
  buildOptionsResponse({
    schemas: { create: callScheduleCreate, update: callScheduleUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
