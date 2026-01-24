/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to companyInTerritory. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new companyInTerritory. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all companyInTerritory. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific companyInTerritory by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific companyInTerritory by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific companyInTerritory by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific companyInTerritory by ID. It requires authentication and protection middleware.
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
  companyInTerritoryCreate,
  companyInTerritoryUpdate,
} = require('#core/schemas/companyInTerritory.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCompanyInTerritory,
  getAllCompanyInTerritory,
  getCompanyInTerritory,
  updateCompanyInTerritory,
  deleteCompanyInTerritory,
  getCompanyInTerritoryBarChartData,
  bulkUpdateCompanyInTerritoryVisibility,
} = require('#core/controllers/companyInTerritory.controller.core.js');

// Filter fields for CompanyInTerritory (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['companyId', 'territoryId', 'expiryDate'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/companyInTerritory.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const COMPANY_IN_TERRITORY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CompanyInTerritory routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCompanyInTerritoryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCompanyInTerritory, 'company_in_territory_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: companyInTerritoryUpdate,
      filterFields: COMPANY_IN_TERRITORY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCompanyInTerritory, 'company_in_territory_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCompanyInTerritoryVisibility,
      'company_in_territory_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCompanyInTerritoryBarChartData,
      'company_in_territory_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCompanyInTerritory, 'company_in_territory_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCompanyInTerritory,
      'company_in_territory_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCompanyInTerritory,
      'company_in_territory_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCompanyInTerritory, 'company_in_territory_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCompanyInTerritoryRoutes;
module.exports.router = createCompanyInTerritoryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/company-in-territories',
  buildOptionsResponse({
    schemas: {
      create: companyInTerritoryCreate,
      update: companyInTerritoryUpdate,
    },
    filterFields: COMPANY_IN_TERRITORY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/company-in-territories/:id',
  buildOptionsResponse({
    schemas: {
      create: companyInTerritoryCreate,
      update: companyInTerritoryUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
