/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to personRelationship. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new personRelationship. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all personRelationship. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific personRelationship by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific personRelationship by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific personRelationship by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific personRelationship by ID. It requires authentication and protection middleware.
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
  personRelationshipCreate,
  personRelationshipUpdate,
} = require('#core/schemas/personRelationship.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createPersonRelationship,
  getAllPersonRelationship,
  getPersonRelationship,
  updatePersonRelationship,
  deletePersonRelationship,
  getPersonRelationshipBarChartData,
  bulkUpdatePersonRelationshipVisibility,
} = require('#core/controllers/personRelationship.controller.core.js');

// Filter fields for PersonRelationship (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['relationshipId', 'personId'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/personRelationship.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PERSON_RELATIONSHIP_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates PersonRelationship routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createPersonRelationshipRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createPersonRelationship, 'person_relationship_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: personRelationshipUpdate,
      filterFields: PERSON_RELATIONSHIP_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllPersonRelationship, 'person_relationship_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdatePersonRelationshipVisibility,
      'person_relationship_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getPersonRelationshipBarChartData,
      'person_relationship_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getPersonRelationship, 'person_relationship_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updatePersonRelationship,
      'person_relationship_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updatePersonRelationship,
      'person_relationship_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deletePersonRelationship, 'person_relationship_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createPersonRelationshipRoutes;
module.exports.router = createPersonRelationshipRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/person-relationships',
  buildOptionsResponse({
    schemas: {
      create: personRelationshipCreate,
      update: personRelationshipUpdate,
    },
    filterFields: PERSON_RELATIONSHIP_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/person-relationships/:id',
  buildOptionsResponse({
    schemas: {
      create: personRelationshipCreate,
      update: personRelationshipUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
