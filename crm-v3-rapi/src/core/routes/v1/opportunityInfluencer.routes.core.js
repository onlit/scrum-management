/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to opportunityInfluencer. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunityInfluencer. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunityInfluencer. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunityInfluencer by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunityInfluencer by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunityInfluencer by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunityInfluencer by ID. It requires authentication and protection middleware.
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
  opportunityInfluencerCreate,
  opportunityInfluencerUpdate,
} = require('#core/schemas/opportunityInfluencer.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOpportunityInfluencer,
  getAllOpportunityInfluencer,
  getOpportunityInfluencer,
  updateOpportunityInfluencer,
  deleteOpportunityInfluencer,
  getOpportunityInfluencerBarChartData,
  bulkUpdateOpportunityInfluencerVisibility,
} = require('#core/controllers/opportunityInfluencer.controller.core.js');

// Filter fields for OpportunityInfluencer (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'role',
  'companyContactId',
  'opportunityId',
  'desireForCompany',
  'desireForSelf',
  'rating',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/opportunityInfluencer.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const OPPORTUNITY_INFLUENCER_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates OpportunityInfluencer routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOpportunityInfluencerRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createOpportunityInfluencer,
      'opportunity_influencer_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: opportunityInfluencerUpdate,
      filterFields: OPPORTUNITY_INFLUENCER_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllOpportunityInfluencer,
      'opportunity_influencer_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOpportunityInfluencerVisibility,
      'opportunity_influencer_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getOpportunityInfluencerBarChartData,
      'opportunity_influencer_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getOpportunityInfluencer,
      'opportunity_influencer_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityInfluencer,
      'opportunity_influencer_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateOpportunityInfluencer,
      'opportunity_influencer_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deleteOpportunityInfluencer,
      'opportunity_influencer_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOpportunityInfluencerRoutes;
module.exports.router = createOpportunityInfluencerRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/opportunity-influencers',
  buildOptionsResponse({
    schemas: {
      create: opportunityInfluencerCreate,
      update: opportunityInfluencerUpdate,
    },
    filterFields: OPPORTUNITY_INFLUENCER_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/opportunity-influencers/:id',
  buildOptionsResponse({
    schemas: {
      create: opportunityInfluencerCreate,
      update: opportunityInfluencerUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
