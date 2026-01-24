/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to socialMediaType. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new socialMediaType. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all socialMediaType. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific socialMediaType by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific socialMediaType by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific socialMediaType by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific socialMediaType by ID. It requires authentication and protection middleware.
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
  socialMediaTypeCreate,
  socialMediaTypeUpdate,
} = require('#core/schemas/socialMediaType.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createSocialMediaType,
  getAllSocialMediaType,
  getSocialMediaType,
  updateSocialMediaType,
  deleteSocialMediaType,
  getSocialMediaTypeBarChartData,
  bulkUpdateSocialMediaTypeVisibility,
} = require('#core/controllers/socialMediaType.controller.core.js');

// Filter fields for SocialMediaType (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['description', 'name'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/socialMediaType.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const SOCIAL_MEDIA_TYPE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates SocialMediaType routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createSocialMediaTypeRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createSocialMediaType, 'social_media_type_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: socialMediaTypeUpdate,
      filterFields: SOCIAL_MEDIA_TYPE_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllSocialMediaType, 'social_media_type_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateSocialMediaTypeVisibility,
      'social_media_type_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getSocialMediaTypeBarChartData,
      'social_media_type_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getSocialMediaType, 'social_media_type_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateSocialMediaType, 'social_media_type_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateSocialMediaType, 'social_media_type_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteSocialMediaType, 'social_media_type_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createSocialMediaTypeRoutes;
module.exports.router = createSocialMediaTypeRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/social-media-types',
  buildOptionsResponse({
    schemas: { create: socialMediaTypeCreate, update: socialMediaTypeUpdate },
    filterFields: SOCIAL_MEDIA_TYPE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/social-media-types/:id',
  buildOptionsResponse({
    schemas: { create: socialMediaTypeCreate, update: socialMediaTypeUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
