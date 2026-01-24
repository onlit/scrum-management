/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to modelName. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new modelName. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all modelName. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific modelName by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific modelName by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific modelName by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific modelName by ID. It requires authentication and protection middleware.
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
const { modelNameCreate, modelNameUpdate } = require('#core/schemas/modelName.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createModelName,
  getAllModelName,
  getModelName,
  updateModelName,
  deleteModelName,
  getModelNameBarChartData,
  bulkUpdateModelNameVisibility,
} = require('#core/controllers/modelName.controller.core.js');

// Filter fields for ModelName (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  // @gen:FILTER_FIELDS_LIST
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/modelName.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const @gen{MODEL_NAME_UPPER}_FILTER_FIELDS = [...CORE_FILTER_FIELDS, ...DOMAIN_FILTER_FIELDS];

/**
 * Creates ModelName routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createModelNameRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createModelName, 'model_name_create')
  );

  router.get(
    '/',
    auth,
    parseFilters({ schema: modelNameUpdate, filterFields: @gen{MODEL_NAME_UPPER}_FILTER_FIELDS }),
    wrapExpressAsync(getAllModelName, 'model_name_get_all')
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateModelNameVisibility,
      'model_name_bulk_visibility_update'
    )
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getModelNameBarChartData, 'model_name_bar_chart')
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getModelName, 'model_name_get_by_id')
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateModelName, 'model_name_update_put')
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateModelName, 'model_name_update_patch')
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteModelName, 'model_name_delete')
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createModelNameRoutes;
module.exports.router = createModelNameRoutes();

// Register OPTIONS schema for this route
register('/api/v1/@gen{ROUTE_PATH}', buildOptionsResponse({
  schemas: { create: modelNameCreate, update: modelNameUpdate },
  filterFields: @gen{MODEL_NAME_UPPER}_FILTER_FIELDS,
  methods: ['GET', 'POST'],
}));

register('/api/v1/@gen{ROUTE_PATH}/:id', buildOptionsResponse({
  schemas: { create: modelNameCreate, update: modelNameUpdate },
  filterFields: [],
  methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
}));
