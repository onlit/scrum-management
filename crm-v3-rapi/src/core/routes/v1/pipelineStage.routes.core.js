/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to pipelineStage. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new pipelineStage. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all pipelineStage. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific pipelineStage by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific pipelineStage by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific pipelineStage by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific pipelineStage by ID. It requires authentication and protection middleware.
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
  pipelineStageCreate,
  pipelineStageUpdate,
} = require('#core/schemas/pipelineStage.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createPipelineStage,
  getAllPipelineStage,
  getPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  getPipelineStageBarChartData,
  bulkUpdatePipelineStageVisibility,
} = require('#core/controllers/pipelineStage.controller.core.js');

// Filter fields for PipelineStage (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'stage',
  'conversion',
  'confidence',
  'rottingDays',
  'pipelineId',
  'parentPipelineStageId',
  'description',
  'immediateNextAction',
  'order',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/pipelineStage.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PIPELINE_STAGE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates PipelineStage routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createPipelineStageRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createPipelineStage, 'pipeline_stage_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: pipelineStageUpdate,
      filterFields: PIPELINE_STAGE_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllPipelineStage, 'pipeline_stage_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdatePipelineStageVisibility,
      'pipeline_stage_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getPipelineStageBarChartData, 'pipeline_stage_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getPipelineStage, 'pipeline_stage_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updatePipelineStage, 'pipeline_stage_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updatePipelineStage, 'pipeline_stage_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deletePipelineStage, 'pipeline_stage_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createPipelineStageRoutes;
module.exports.router = createPipelineStageRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/pipeline-stages',
  buildOptionsResponse({
    schemas: { create: pipelineStageCreate, update: pipelineStageUpdate },
    filterFields: PIPELINE_STAGE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/pipeline-stages/:id',
  buildOptionsResponse({
    schemas: { create: pipelineStageCreate, update: pipelineStageUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
