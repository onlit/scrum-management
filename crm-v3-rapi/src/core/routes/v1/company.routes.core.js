/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to company. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new company. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all company. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific company by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific company by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific company by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific company by ID. It requires authentication and protection middleware.
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
  companyCreate,
  companyUpdate,
} = require('#core/schemas/company.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCompany,
  getAllCompany,
  getCompany,
  updateCompany,
  deleteCompany,
  getCompanyBarChartData,
  bulkUpdateCompanyVisibility,
} = require('#core/controllers/company.controller.core.js');

// Filter fields for Company (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'name',
  'description',
  'email',
  'fax',
  'staffUrl',
  'contactUrl',
  'address1',
  'address2',
  'stateId',
  'zip',
  'size',
  'industryId',
  'keywords',
  'notes',
  'branchOfId',
  'ownerId',
  'betaPartners',
  'website',
  'newsUrl',
  'phone',
  'countryId',
  'cityId',
  'companyIntelligence',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/company.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const COMPANY_FILTER_FIELDS = [...CORE_FILTER_FIELDS, ...DOMAIN_FILTER_FIELDS];

/**
 * Creates Company routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCompanyRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCompany, 'company_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: companyUpdate,
      filterFields: COMPANY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCompany, 'company_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCompanyVisibility,
      'company_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getCompanyBarChartData, 'company_bar_chart'),
  );

  router.get('/:id', auth, wrapExpressAsync(getCompany, 'company_get_by_id'));

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCompany, 'company_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCompany, 'company_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCompany, 'company_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCompanyRoutes;
module.exports.router = createCompanyRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/companies',
  buildOptionsResponse({
    schemas: { create: companyCreate, update: companyUpdate },
    filterFields: COMPANY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/companies/:id',
  buildOptionsResponse({
    schemas: { create: companyCreate, update: companyUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
