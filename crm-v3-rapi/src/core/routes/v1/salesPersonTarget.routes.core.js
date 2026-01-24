/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to salesPersonTarget. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new salesPersonTarget. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all salesPersonTarget. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific salesPersonTarget by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific salesPersonTarget by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific salesPersonTarget by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific salesPersonTarget by ID. It requires authentication and protection middleware.
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
  salesPersonTargetCreate,
  salesPersonTargetUpdate,
} = require('#core/schemas/salesPersonTarget.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createSalesPersonTarget,
  getAllSalesPersonTarget,
  getSalesPersonTarget,
  updateSalesPersonTarget,
  deleteSalesPersonTarget,
  getSalesPersonTargetBarChartData,
  bulkUpdateSalesPersonTargetVisibility,
} = require('#core/controllers/salesPersonTarget.controller.core.js');

// Filter fields for SalesPersonTarget (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'pipelineId',
  'targetUnit',
  'target',
  'notes',
  'expiryDate',
  'pipelineStageId',
  'salesPersonId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/salesPersonTarget.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const SALES_PERSON_TARGET_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates SalesPersonTarget routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createSalesPersonTargetRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createSalesPersonTarget, 'sales_person_target_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: salesPersonTargetUpdate,
      filterFields: SALES_PERSON_TARGET_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllSalesPersonTarget, 'sales_person_target_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateSalesPersonTargetVisibility,
      'sales_person_target_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getSalesPersonTargetBarChartData,
      'sales_person_target_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getSalesPersonTarget, 'sales_person_target_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateSalesPersonTarget, 'sales_person_target_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateSalesPersonTarget,
      'sales_person_target_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteSalesPersonTarget, 'sales_person_target_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createSalesPersonTargetRoutes;
module.exports.router = createSalesPersonTargetRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/sales-person-targets',
  buildOptionsResponse({
    schemas: {
      create: salesPersonTargetCreate,
      update: salesPersonTargetUpdate,
    },
    filterFields: SALES_PERSON_TARGET_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/sales-person-targets/:id',
  buildOptionsResponse({
    schemas: {
      create: salesPersonTargetCreate,
      update: salesPersonTargetUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
