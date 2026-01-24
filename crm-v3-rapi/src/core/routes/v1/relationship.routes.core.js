/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to relationship. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new relationship. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all relationship. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific relationship by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific relationship by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific relationship by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific relationship by ID. It requires authentication and protection middleware.
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
  relationshipCreate,
  relationshipUpdate,
} = require('#core/schemas/relationship.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createRelationship,
  getAllRelationship,
  getRelationship,
  updateRelationship,
  deleteRelationship,
  getRelationshipBarChartData,
  bulkUpdateRelationshipVisibility,
} = require('#core/controllers/relationship.controller.core.js');

// Filter fields for Relationship (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['name', 'description'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/relationship.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const RELATIONSHIP_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates Relationship routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createRelationshipRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createRelationship, 'relationship_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: relationshipUpdate,
      filterFields: RELATIONSHIP_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllRelationship, 'relationship_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateRelationshipVisibility,
      'relationship_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getRelationshipBarChartData, 'relationship_bar_chart'),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getRelationship, 'relationship_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateRelationship, 'relationship_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateRelationship, 'relationship_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteRelationship, 'relationship_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createRelationshipRoutes;
module.exports.router = createRelationshipRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/relationships',
  buildOptionsResponse({
    schemas: { create: relationshipCreate, update: relationshipUpdate },
    filterFields: RELATIONSHIP_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/relationships/:id',
  buildOptionsResponse({
    schemas: { create: relationshipCreate, update: relationshipUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
