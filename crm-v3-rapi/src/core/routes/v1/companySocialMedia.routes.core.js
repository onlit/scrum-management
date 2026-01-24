/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to companySocialMedia. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new companySocialMedia. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all companySocialMedia. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific companySocialMedia by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific companySocialMedia by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific companySocialMedia by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific companySocialMedia by ID. It requires authentication and protection middleware.
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
  companySocialMediaCreate,
  companySocialMediaUpdate,
} = require('#core/schemas/companySocialMedia.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCompanySocialMedia,
  getAllCompanySocialMedia,
  getCompanySocialMedia,
  updateCompanySocialMedia,
  deleteCompanySocialMedia,
  getCompanySocialMediaBarChartData,
  bulkUpdateCompanySocialMediaVisibility,
} = require('#core/controllers/companySocialMedia.controller.core.js');

// Filter fields for CompanySocialMedia (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['url', 'companyId', 'socialMediaId'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/companySocialMedia.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const COMPANY_SOCIAL_MEDIA_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CompanySocialMedia routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCompanySocialMediaRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCompanySocialMedia, 'company_social_media_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: companySocialMediaUpdate,
      filterFields: COMPANY_SOCIAL_MEDIA_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCompanySocialMedia, 'company_social_media_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCompanySocialMediaVisibility,
      'company_social_media_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCompanySocialMediaBarChartData,
      'company_social_media_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCompanySocialMedia, 'company_social_media_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCompanySocialMedia,
      'company_social_media_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCompanySocialMedia,
      'company_social_media_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCompanySocialMedia, 'company_social_media_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCompanySocialMediaRoutes;
module.exports.router = createCompanySocialMediaRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/company-social-medias',
  buildOptionsResponse({
    schemas: {
      create: companySocialMediaCreate,
      update: companySocialMediaUpdate,
    },
    filterFields: COMPANY_SOCIAL_MEDIA_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/company-social-medias/:id',
  buildOptionsResponse({
    schemas: {
      create: companySocialMediaCreate,
      update: companySocialMediaUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
