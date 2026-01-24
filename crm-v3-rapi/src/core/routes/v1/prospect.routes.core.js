/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to prospect. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new prospect. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all prospect. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific prospect by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific prospect by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific prospect by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific prospect by ID. It requires authentication and protection middleware.
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
  prospectCreate,
  prospectUpdate,
} = require('#core/schemas/prospect.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createProspect,
  getAllProspect,
  getProspect,
  updateProspect,
  deleteProspect,
  getProspectBarChartData,
  bulkUpdateProspectVisibility,
} = require('#core/controllers/prospect.controller.core.js');

// Filter fields for Prospect (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'disqualificationReason',
  'sourceCampaign',
  'interestSummary',
  'ownerId',
  'categoryId',
  'personId',
  'qualificationScore',
  'temperature',
  'prospectPipelineId',
  'statusId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/prospect.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PROSPECT_FILTER_FIELDS = [...CORE_FILTER_FIELDS, ...DOMAIN_FILTER_FIELDS];

/**
 * Creates Prospect routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createProspectRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createProspect, 'prospect_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: prospectUpdate,
      filterFields: PROSPECT_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllProspect, 'prospect_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateProspectVisibility,
      'prospect_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getProspectBarChartData, 'prospect_bar_chart'),
  );

  router.get('/:id', auth, wrapExpressAsync(getProspect, 'prospect_get_by_id'));

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateProspect, 'prospect_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateProspect, 'prospect_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteProspect, 'prospect_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createProspectRoutes;
module.exports.router = createProspectRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/prospects',
  buildOptionsResponse({
    schemas: { create: prospectCreate, update: prospectUpdate },
    filterFields: PROSPECT_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/prospects/:id',
  buildOptionsResponse({
    schemas: { create: prospectCreate, update: prospectUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
