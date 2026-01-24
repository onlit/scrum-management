/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to territoryOwner. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new territoryOwner. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all territoryOwner. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific territoryOwner by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific territoryOwner by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific territoryOwner by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific territoryOwner by ID. It requires authentication and protection middleware.
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
  territoryOwnerCreate,
  territoryOwnerUpdate,
} = require('#core/schemas/territoryOwner.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createTerritoryOwner,
  getAllTerritoryOwner,
  getTerritoryOwner,
  updateTerritoryOwner,
  deleteTerritoryOwner,
  getTerritoryOwnerBarChartData,
  bulkUpdateTerritoryOwnerVisibility,
} = require('#core/controllers/territoryOwner.controller.core.js');

// Filter fields for TerritoryOwner (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['salesPersonId', 'territoryId', 'expiryDate'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/territoryOwner.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const TERRITORY_OWNER_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates TerritoryOwner routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createTerritoryOwnerRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createTerritoryOwner, 'territory_owner_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: territoryOwnerUpdate,
      filterFields: TERRITORY_OWNER_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllTerritoryOwner, 'territory_owner_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateTerritoryOwnerVisibility,
      'territory_owner_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getTerritoryOwnerBarChartData,
      'territory_owner_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getTerritoryOwner, 'territory_owner_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateTerritoryOwner, 'territory_owner_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateTerritoryOwner, 'territory_owner_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteTerritoryOwner, 'territory_owner_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createTerritoryOwnerRoutes;
module.exports.router = createTerritoryOwnerRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/territory-owners',
  buildOptionsResponse({
    schemas: { create: territoryOwnerCreate, update: territoryOwnerUpdate },
    filterFields: TERRITORY_OWNER_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/territory-owners/:id',
  buildOptionsResponse({
    schemas: { create: territoryOwnerCreate, update: territoryOwnerUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
