/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to prospectPipeline. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new prospectPipeline. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all prospectPipeline. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific prospectPipeline by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific prospectPipeline by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific prospectPipeline by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific prospectPipeline by ID. It requires authentication and protection middleware.
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
  prospectPipelineCreate,
  prospectPipelineUpdate,
} = require('#core/schemas/prospectPipeline.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createProspectPipeline,
  getAllProspectPipeline,
  getProspectPipeline,
  updateProspectPipeline,
  deleteProspectPipeline,
  getProspectPipelineBarChartData,
  bulkUpdateProspectPipelineVisibility,
} = require('#core/controllers/prospectPipeline.controller.core.js');

// Filter fields for ProspectPipeline (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['name', 'description'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/prospectPipeline.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PROSPECT_PIPELINE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates ProspectPipeline routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createProspectPipelineRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createProspectPipeline, 'prospect_pipeline_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: prospectPipelineUpdate,
      filterFields: PROSPECT_PIPELINE_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllProspectPipeline, 'prospect_pipeline_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateProspectPipelineVisibility,
      'prospect_pipeline_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getProspectPipelineBarChartData,
      'prospect_pipeline_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getProspectPipeline, 'prospect_pipeline_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateProspectPipeline, 'prospect_pipeline_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateProspectPipeline, 'prospect_pipeline_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteProspectPipeline, 'prospect_pipeline_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createProspectPipelineRoutes;
module.exports.router = createProspectPipelineRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/prospect-pipelines',
  buildOptionsResponse({
    schemas: { create: prospectPipelineCreate, update: prospectPipelineUpdate },
    filterFields: PROSPECT_PIPELINE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/prospect-pipelines/:id',
  buildOptionsResponse({
    schemas: { create: prospectPipelineCreate, update: prospectPipelineUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
