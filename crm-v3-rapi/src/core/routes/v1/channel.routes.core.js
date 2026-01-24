/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to channel. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new channel. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all channel. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific channel by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific channel by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific channel by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific channel by ID. It requires authentication and protection middleware.
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
  channelCreate,
  channelUpdate,
} = require('#core/schemas/channel.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createChannel,
  getAllChannel,
  getChannel,
  updateChannel,
  deleteChannel,
  getChannelBarChartData,
  bulkUpdateChannelVisibility,
} = require('#core/controllers/channel.controller.core.js');

// Filter fields for Channel (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['description', 'name'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/channel.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CHANNEL_FILTER_FIELDS = [...CORE_FILTER_FIELDS, ...DOMAIN_FILTER_FIELDS];

/**
 * Creates Channel routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createChannelRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createChannel, 'channel_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: channelUpdate,
      filterFields: CHANNEL_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllChannel, 'channel_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateChannelVisibility,
      'channel_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getChannelBarChartData, 'channel_bar_chart'),
  );

  router.get('/:id', auth, wrapExpressAsync(getChannel, 'channel_get_by_id'));

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateChannel, 'channel_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateChannel, 'channel_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteChannel, 'channel_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createChannelRoutes;
module.exports.router = createChannelRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/channels',
  buildOptionsResponse({
    schemas: { create: channelCreate, update: channelUpdate },
    filterFields: CHANNEL_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/channels/:id',
  buildOptionsResponse({
    schemas: { create: channelCreate, update: channelUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
