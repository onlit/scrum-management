/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to opportunity. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new opportunity. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all opportunity. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific opportunity by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific opportunity by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific opportunity by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific opportunity by ID. It requires authentication and protection middleware.
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
  opportunityCreate,
  opportunityUpdate,
} = require('#core/schemas/opportunity.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOpportunity,
  getAllOpportunity,
  getOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityBarChartData,
  bulkUpdateOpportunityVisibility,
} = require('#core/controllers/opportunity.controller.core.js');

// Filter fields for Opportunity (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'companyId',
  'personId',
  'companyContactId',
  'actualValue',
  'probability',
  'ownerId',
  'salesPersonId',
  'channelId',
  'dataSource',
  'sentiment',
  'economicBuyerInfluenceId',
  'technicalBuyerInfluenceId',
  'customerPriority',
  'notes',
  'name',
  'description',
  'pipelineId',
  'estimatedValue',
  'userBuyerInfluenceId',
  'estimatedCloseDate',
  'categoryId',
  'statusId',
  'statusAssignedDate',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/opportunity.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const OPPORTUNITY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates Opportunity routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOpportunityRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createOpportunity, 'opportunity_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: opportunityUpdate,
      filterFields: OPPORTUNITY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllOpportunity, 'opportunity_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOpportunityVisibility,
      'opportunity_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getOpportunityBarChartData, 'opportunity_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getOpportunity, 'opportunity_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateOpportunity, 'opportunity_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateOpportunity, 'opportunity_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteOpportunity, 'opportunity_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOpportunityRoutes;
module.exports.router = createOpportunityRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/opportunities',
  buildOptionsResponse({
    schemas: { create: opportunityCreate, update: opportunityUpdate },
    filterFields: OPPORTUNITY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/opportunities/:id',
  buildOptionsResponse({
    schemas: { create: opportunityCreate, update: opportunityUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
