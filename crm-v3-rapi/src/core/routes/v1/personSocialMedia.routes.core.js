/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to personSocialMedia. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new personSocialMedia. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all personSocialMedia. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific personSocialMedia by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific personSocialMedia by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific personSocialMedia by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific personSocialMedia by ID. It requires authentication and protection middleware.
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
  personSocialMediaCreate,
  personSocialMediaUpdate,
} = require('#core/schemas/personSocialMedia.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createPersonSocialMedia,
  getAllPersonSocialMedia,
  getPersonSocialMedia,
  updatePersonSocialMedia,
  deletePersonSocialMedia,
  getPersonSocialMediaBarChartData,
  bulkUpdatePersonSocialMediaVisibility,
} = require('#core/controllers/personSocialMedia.controller.core.js');

// Filter fields for PersonSocialMedia (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['personId', 'socialMediaId', 'url', 'username'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/personSocialMedia.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PERSON_SOCIAL_MEDIA_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates PersonSocialMedia routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createPersonSocialMediaRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createPersonSocialMedia, 'person_social_media_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: personSocialMediaUpdate,
      filterFields: PERSON_SOCIAL_MEDIA_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllPersonSocialMedia, 'person_social_media_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdatePersonSocialMediaVisibility,
      'person_social_media_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getPersonSocialMediaBarChartData,
      'person_social_media_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getPersonSocialMedia, 'person_social_media_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updatePersonSocialMedia, 'person_social_media_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updatePersonSocialMedia,
      'person_social_media_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deletePersonSocialMedia, 'person_social_media_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createPersonSocialMediaRoutes;
module.exports.router = createPersonSocialMediaRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/person-social-medias',
  buildOptionsResponse({
    schemas: {
      create: personSocialMediaCreate,
      update: personSocialMediaUpdate,
    },
    filterFields: PERSON_SOCIAL_MEDIA_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/person-social-medias/:id',
  buildOptionsResponse({
    schemas: {
      create: personSocialMediaCreate,
      update: personSocialMediaUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
