/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to prospectPipelineStage. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new prospectPipelineStage. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all prospectPipelineStage. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific prospectPipelineStage by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific prospectPipelineStage by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific prospectPipelineStage by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific prospectPipelineStage by ID. It requires authentication and protection middleware.
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
  prospectPipelineStageCreate,
  prospectPipelineStageUpdate,
} = require('#core/schemas/prospectPipelineStage.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createProspectPipelineStage,
  getAllProspectPipelineStage,
  getProspectPipelineStage,
  updateProspectPipelineStage,
  deleteProspectPipelineStage,
  getProspectPipelineStageBarChartData,
  bulkUpdateProspectPipelineStageVisibility,
} = require('#core/controllers/prospectPipelineStage.controller.core.js');

// Filter fields for ProspectPipelineStage (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'order',
  'immediateNextAction',
  'description',
  'confidence',
  'rottingDays',
  'conversion',
  'stage',
  'parentPipelineStageId',
  'pipelineId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/prospectPipelineStage.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PROSPECT_PIPELINE_STAGE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates ProspectPipelineStage routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createProspectPipelineStageRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createProspectPipelineStage,
      'prospect_pipeline_stage_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: prospectPipelineStageUpdate,
      filterFields: PROSPECT_PIPELINE_STAGE_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllProspectPipelineStage,
      'prospect_pipeline_stage_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateProspectPipelineStageVisibility,
      'prospect_pipeline_stage_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getProspectPipelineStageBarChartData,
      'prospect_pipeline_stage_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getProspectPipelineStage,
      'prospect_pipeline_stage_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateProspectPipelineStage,
      'prospect_pipeline_stage_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateProspectPipelineStage,
      'prospect_pipeline_stage_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deleteProspectPipelineStage,
      'prospect_pipeline_stage_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createProspectPipelineStageRoutes;
module.exports.router = createProspectPipelineStageRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/prospect-pipeline-stages',
  buildOptionsResponse({
    schemas: {
      create: prospectPipelineStageCreate,
      update: prospectPipelineStageUpdate,
    },
    filterFields: PROSPECT_PIPELINE_STAGE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/prospect-pipeline-stages/:id',
  buildOptionsResponse({
    schemas: {
      create: prospectPipelineStageCreate,
      update: prospectPipelineStageUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
