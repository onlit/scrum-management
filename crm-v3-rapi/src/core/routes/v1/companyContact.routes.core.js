/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to companyContact. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new companyContact. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all companyContact. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific companyContact by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific companyContact by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific companyContact by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific companyContact by ID. It requires authentication and protection middleware.
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
  companyContactCreate,
  companyContactUpdate,
} = require('#core/schemas/companyContact.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCompanyContact,
  getAllCompanyContact,
  getCompanyContact,
  updateCompanyContact,
  deleteCompanyContact,
  getCompanyContactBarChartData,
  bulkUpdateCompanyContactVisibility,
} = require('#core/controllers/companyContact.controller.core.js');

// Filter fields for CompanyContact (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'personId',
  'companyId',
  'workEmail',
  'endDate',
  'accounts',
  'startDate',
  'jobTitle',
  'workPhone',
  'workMobile',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/companyContact.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const COMPANY_CONTACT_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CompanyContact routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCompanyContactRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCompanyContact, 'company_contact_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: companyContactUpdate,
      filterFields: COMPANY_CONTACT_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCompanyContact, 'company_contact_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCompanyContactVisibility,
      'company_contact_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCompanyContactBarChartData,
      'company_contact_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCompanyContact, 'company_contact_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCompanyContact, 'company_contact_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCompanyContact, 'company_contact_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCompanyContact, 'company_contact_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCompanyContactRoutes;
module.exports.router = createCompanyContactRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/company-contacts',
  buildOptionsResponse({
    schemas: { create: companyContactCreate, update: companyContactUpdate },
    filterFields: COMPANY_CONTACT_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/company-contacts/:id',
  buildOptionsResponse({
    schemas: { create: companyContactCreate, update: companyContactUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
