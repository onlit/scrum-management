/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to onlineSignup. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new onlineSignup. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all onlineSignup. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific onlineSignup by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific onlineSignup by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific onlineSignup by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific onlineSignup by ID. It requires authentication and protection middleware.
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
  onlineSignupCreate,
  onlineSignupUpdate,
} = require('#core/schemas/onlineSignup.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createOnlineSignup,
  getAllOnlineSignup,
  getOnlineSignup,
  updateOnlineSignup,
  deleteOnlineSignup,
  getOnlineSignupBarChartData,
  bulkUpdateOnlineSignupVisibility,
} = require('#core/controllers/onlineSignup.controller.core.js');

// Filter fields for OnlineSignup (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['source', 'fields', 'owner', 'emailconfirmed'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/onlineSignup.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const ONLINE_SIGNUP_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates OnlineSignup routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createOnlineSignupRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createOnlineSignup, 'online_signup_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: onlineSignupUpdate,
      filterFields: ONLINE_SIGNUP_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllOnlineSignup, 'online_signup_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateOnlineSignupVisibility,
      'online_signup_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getOnlineSignupBarChartData, 'online_signup_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getOnlineSignup, 'online_signup_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateOnlineSignup, 'online_signup_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateOnlineSignup, 'online_signup_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteOnlineSignup, 'online_signup_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createOnlineSignupRoutes;
module.exports.router = createOnlineSignupRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/online-signups',
  buildOptionsResponse({
    schemas: { create: onlineSignupCreate, update: onlineSignupUpdate },
    filterFields: ONLINE_SIGNUP_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/online-signups/:id',
  buildOptionsResponse({
    schemas: { create: onlineSignupCreate, update: onlineSignupUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
