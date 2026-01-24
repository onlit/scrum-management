/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to person. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new person. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all person. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific person by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific person by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific person by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific person by ID. It requires authentication and protection middleware.
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
  personCreate,
  personUpdate,
} = require('#core/schemas/person.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createPerson,
  getAllPerson,
  getPerson,
  updatePerson,
  deletePerson,
  getPersonBarChartData,
  bulkUpdatePersonVisibility,
} = require('#core/controllers/person.controller.core.js');

// Filter fields for Person (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'firstName',
  'hasWhatsapp',
  'middleName',
  'preferredName',
  'username',
  'homePhone',
  'avatar',
  'address1',
  'address2',
  'dob',
  'personalMobile',
  'zip',
  'stateId',
  'parentId',
  'companyOwnerId',
  'source',
  'sourceNotes',
  'owner',
  'notes',
  'lastName',
  'email',
  'status',
  'countryId',
  'user',
  'cityId',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/person.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const PERSON_FILTER_FIELDS = [...CORE_FILTER_FIELDS, ...DOMAIN_FILTER_FIELDS];

/**
 * Creates Person routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createPersonRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createPerson, 'person_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({ schema: personUpdate, filterFields: PERSON_FILTER_FIELDS }),
    wrapExpressAsync(getAllPerson, 'person_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdatePersonVisibility,
      'person_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(getPersonBarChartData, 'person_bar_chart'),
  );

  router.get('/:id', auth, wrapExpressAsync(getPerson, 'person_get_by_id'));

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updatePerson, 'person_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updatePerson, 'person_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deletePerson, 'person_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createPersonRoutes;
module.exports.router = createPersonRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/people',
  buildOptionsResponse({
    schemas: { create: personCreate, update: personUpdate },
    filterFields: PERSON_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/people/:id',
  buildOptionsResponse({
    schemas: { create: personCreate, update: personUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
