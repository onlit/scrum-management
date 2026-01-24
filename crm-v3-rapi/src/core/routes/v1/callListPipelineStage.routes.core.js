/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to callListPipelineStage. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new callListPipelineStage. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all callListPipelineStage. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific callListPipelineStage by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific callListPipelineStage by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific callListPipelineStage by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific callListPipelineStage by ID. It requires authentication and protection middleware.
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
  callListPipelineStageCreate,
  callListPipelineStageUpdate,
} = require('#core/schemas/callListPipelineStage.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCallListPipelineStage,
  getAllCallListPipelineStage,
  getCallListPipelineStage,
  updateCallListPipelineStage,
  deleteCallListPipelineStage,
  getCallListPipelineStageBarChartData,
  bulkUpdateCallListPipelineStageVisibility,
} = require('#core/controllers/callListPipelineStage.controller.core.js');

// Filter fields for CallListPipelineStage (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'order',
  'rottingDays',
  'name',
  'description',
  'callListPipelineId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/callListPipelineStage.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CALL_LIST_PIPELINE_STAGE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CallListPipelineStage routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCallListPipelineStageRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createCallListPipelineStage,
      'call_list_pipeline_stage_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: callListPipelineStageUpdate,
      filterFields: CALL_LIST_PIPELINE_STAGE_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllCallListPipelineStage,
      'call_list_pipeline_stage_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCallListPipelineStageVisibility,
      'call_list_pipeline_stage_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCallListPipelineStageBarChartData,
      'call_list_pipeline_stage_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getCallListPipelineStage,
      'call_list_pipeline_stage_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCallListPipelineStage,
      'call_list_pipeline_stage_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCallListPipelineStage,
      'call_list_pipeline_stage_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deleteCallListPipelineStage,
      'call_list_pipeline_stage_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCallListPipelineStageRoutes;
module.exports.router = createCallListPipelineStageRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/call-list-pipeline-stages',
  buildOptionsResponse({
    schemas: {
      create: callListPipelineStageCreate,
      update: callListPipelineStageUpdate,
    },
    filterFields: CALL_LIST_PIPELINE_STAGE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/call-list-pipeline-stages/:id',
  buildOptionsResponse({
    schemas: {
      create: callListPipelineStageCreate,
      update: callListPipelineStageUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
