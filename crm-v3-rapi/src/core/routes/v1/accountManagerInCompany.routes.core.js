/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to accountManagerInCompany. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new accountManagerInCompany. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all accountManagerInCompany. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific accountManagerInCompany by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific accountManagerInCompany by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific accountManagerInCompany by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific accountManagerInCompany by ID. It requires authentication and protection middleware.
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
  accountManagerInCompanyCreate,
  accountManagerInCompanyUpdate,
} = require('#core/schemas/accountManagerInCompany.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createAccountManagerInCompany,
  getAllAccountManagerInCompany,
  getAccountManagerInCompany,
  updateAccountManagerInCompany,
  deleteAccountManagerInCompany,
  getAccountManagerInCompanyBarChartData,
  bulkUpdateAccountManagerInCompanyVisibility,
} = require('#core/controllers/accountManagerInCompany.controller.core.js');

// Filter fields for AccountManagerInCompany (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['companyId', 'expiryDate', 'accountManagerId'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/accountManagerInCompany.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const ACCOUNT_MANAGER_IN_COMPANY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates AccountManagerInCompany routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createAccountManagerInCompanyRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createAccountManagerInCompany,
      'account_manager_in_company_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: accountManagerInCompanyUpdate,
      filterFields: ACCOUNT_MANAGER_IN_COMPANY_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllAccountManagerInCompany,
      'account_manager_in_company_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateAccountManagerInCompanyVisibility,
      'account_manager_in_company_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getAccountManagerInCompanyBarChartData,
      'account_manager_in_company_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getAccountManagerInCompany,
      'account_manager_in_company_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateAccountManagerInCompany,
      'account_manager_in_company_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateAccountManagerInCompany,
      'account_manager_in_company_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deleteAccountManagerInCompany,
      'account_manager_in_company_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createAccountManagerInCompanyRoutes;
module.exports.router = createAccountManagerInCompanyRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/account-manager-in-companies',
  buildOptionsResponse({
    schemas: {
      create: accountManagerInCompanyCreate,
      update: accountManagerInCompanyUpdate,
    },
    filterFields: ACCOUNT_MANAGER_IN_COMPANY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/account-manager-in-companies/:id',
  buildOptionsResponse({
    schemas: {
      create: accountManagerInCompanyCreate,
      update: accountManagerInCompanyUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
