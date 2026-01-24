/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to companySpin. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new companySpin. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all companySpin. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific companySpin by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific companySpin by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific companySpin by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific companySpin by ID. It requires authentication and protection middleware.
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
  companySpinCreate,
  companySpinUpdate,
} = require('#core/schemas/companySpin.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCompanySpin,
  getAllCompanySpin,
  getCompanySpin,
  updateCompanySpin,
  deleteCompanySpin,
  getCompanySpinBarChartData,
  bulkUpdateCompanySpinVisibility,
} = require('#core/controllers/companySpin.controller.core.js');

// Filter fields for CompanySpin (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'situation',
  'implication',
  'companyId',
  'need',
  'buyerInfluence',
  'notes',
  'problem',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/companySpin.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const COMPANY_SPIN_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CompanySpin routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCompanySpinRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCompanySpin, 'company_spin_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: companySpinUpdate,
      filterFields: COMPANY_SPIN_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCompanySpin, 'company_spin_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCompanySpinVisibility,
      'company_spin_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getCompanySpinBarChartData, 'company_spin_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCompanySpin, 'company_spin_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCompanySpin, 'company_spin_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCompanySpin, 'company_spin_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCompanySpin, 'company_spin_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCompanySpinRoutes;
module.exports.router = createCompanySpinRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/company-spins',
  buildOptionsResponse({
    schemas: { create: companySpinCreate, update: companySpinUpdate },
    filterFields: COMPANY_SPIN_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/company-spins/:id',
  buildOptionsResponse({
    schemas: { create: companySpinCreate, update: companySpinUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
