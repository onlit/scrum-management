/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to personInMarketingList. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new personInMarketingList. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all personInMarketingList. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific personInMarketingList by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific personInMarketingList by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific personInMarketingList by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific personInMarketingList by ID. It requires authentication and protection middleware.
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
  personInMarketingListCreate,
  personInMarketingListUpdate,
} = require('#core/schemas/personInMarketingList.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createPersonInMarketingList,
  getAllPersonInMarketingList,
  getPersonInMarketingList,
  updatePersonInMarketingList,
  deletePersonInMarketingList,
  getPersonInMarketingListBarChartData,
  bulkUpdatePersonInMarketingListVisibility,
} = require('#core/controllers/personInMarketingList.controller.core.js');

// Filter fields for PersonInMarketingList (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['personId', 'marketingListId', 'expiryDate'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/personInMarketingList.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PERSON_IN_MARKETING_LIST_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates PersonInMarketingList routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createPersonInMarketingListRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createPersonInMarketingList,
      'person_in_marketing_list_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: personInMarketingListUpdate,
      filterFields: PERSON_IN_MARKETING_LIST_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllPersonInMarketingList,
      'person_in_marketing_list_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdatePersonInMarketingListVisibility,
      'person_in_marketing_list_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getPersonInMarketingListBarChartData,
      'person_in_marketing_list_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getPersonInMarketingList,
      'person_in_marketing_list_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updatePersonInMarketingList,
      'person_in_marketing_list_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updatePersonInMarketingList,
      'person_in_marketing_list_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deletePersonInMarketingList,
      'person_in_marketing_list_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createPersonInMarketingListRoutes;
module.exports.router = createPersonInMarketingListRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/person-in-marketing-lists',
  buildOptionsResponse({
    schemas: {
      create: personInMarketingListCreate,
      update: personInMarketingListUpdate,
    },
    filterFields: PERSON_IN_MARKETING_LIST_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/person-in-marketing-lists/:id',
  buildOptionsResponse({
    schemas: {
      create: personInMarketingListCreate,
      update: personInMarketingListUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
