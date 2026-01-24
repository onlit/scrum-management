/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to client. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new client. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all client. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific client by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific client by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific client by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific client by ID. It requires authentication and protection middleware.
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
  clientCreate,
  clientUpdate,
} = require('#core/schemas/client.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createClient,
  getAllClient,
  getClient,
  updateClient,
  deleteClient,
  getClientBarChartData,
  bulkUpdateClientVisibility,
} = require('#core/controllers/client.controller.core.js');

// Filter fields for Client (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['opportunityId', 'companyContactId', 'notes'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/client.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CLIENT_FILTER_FIELDS = [...CORE_FILTER_FIELDS, ...DOMAIN_FILTER_FIELDS];

/**
 * Creates Client routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createClientRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createClient, 'client_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({ schema: clientUpdate, filterFields: CLIENT_FILTER_FIELDS }),
    wrapExpressAsync(getAllClient, 'client_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateClientVisibility,
      'client_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getClientBarChartData, 'client_bar_chart'),
  );

  router.get('/:id', auth, wrapExpressAsync(getClient, 'client_get_by_id'));

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateClient, 'client_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateClient, 'client_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteClient, 'client_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createClientRoutes;
module.exports.router = createClientRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/clients',
  buildOptionsResponse({
    schemas: { create: clientCreate, update: clientUpdate },
    filterFields: CLIENT_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/clients/:id',
  buildOptionsResponse({
    schemas: { create: clientCreate, update: clientUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
