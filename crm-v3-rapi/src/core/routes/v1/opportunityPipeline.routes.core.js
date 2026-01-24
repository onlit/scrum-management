/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to opportunityPipeline. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunityPipeline. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunityPipeline. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunityPipeline by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunityPipeline by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunityPipeline by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunityPipeline by ID. It requires authentication and protection middleware.
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
  opportunityPipelineCreate,
  opportunityPipelineUpdate,
} = require('#core/schemas/opportunityPipeline.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOpportunityPipeline,
  getAllOpportunityPipeline,
  getOpportunityPipeline,
  updateOpportunityPipeline,
  deleteOpportunityPipeline,
  getOpportunityPipelineBarChartData,
  bulkUpdateOpportunityPipelineVisibility,
} = require('#core/controllers/opportunityPipeline.controller.core.js');

// Filter fields for OpportunityPipeline (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['description', 'name'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/opportunityPipeline.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const OPPORTUNITY_PIPELINE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates OpportunityPipeline routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOpportunityPipelineRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createOpportunityPipeline, 'opportunity_pipeline_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: opportunityPipelineUpdate,
      filterFields: OPPORTUNITY_PIPELINE_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllOpportunityPipeline, 'opportunity_pipeline_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOpportunityPipelineVisibility,
      'opportunity_pipeline_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getOpportunityPipelineBarChartData,
      'opportunity_pipeline_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getOpportunityPipeline, 'opportunity_pipeline_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityPipeline,
      'opportunity_pipeline_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityPipeline,
      'opportunity_pipeline_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteOpportunityPipeline, 'opportunity_pipeline_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOpportunityPipelineRoutes;
module.exports.router = createOpportunityPipelineRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/opportunity-pipelines',
  buildOptionsResponse({
    schemas: {
      create: opportunityPipelineCreate,
      update: opportunityPipelineUpdate,
    },
    filterFields: OPPORTUNITY_PIPELINE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/opportunity-pipelines/:id',
  buildOptionsResponse({
    schemas: {
      create: opportunityPipelineCreate,
      update: opportunityPipelineUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
