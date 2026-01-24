/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to customerEnquiry. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new customerEnquiry. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all customerEnquiry. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific customerEnquiry by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific customerEnquiry by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific customerEnquiry by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific customerEnquiry by ID. It requires authentication and protection middleware.
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
  customerEnquiryCreate,
  customerEnquiryUpdate,
} = require('#core/schemas/customerEnquiry.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCustomerEnquiry,
  getAllCustomerEnquiry,
  getCustomerEnquiry,
  updateCustomerEnquiry,
  deleteCustomerEnquiry,
  getCustomerEnquiryBarChartData,
  bulkUpdateCustomerEnquiryVisibility,
} = require('#core/controllers/customerEnquiry.controller.core.js');

// Filter fields for CustomerEnquiry (used by parseFilters middleware)
const CORE_FILTER_FIELDS = [
  'personId',
  'firstName',
  'lastName',
  'sourceNotes',
  'statusId',
  'message',
  'purposeId',
  'source',
  'phone',
];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/customerEnquiry.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CUSTOMER_ENQUIRY_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CustomerEnquiry routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCustomerEnquiryRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(createCustomerEnquiry, 'customer_enquiry_create'),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: customerEnquiryUpdate,
      filterFields: CUSTOMER_ENQUIRY_FILTER_FIELDS,
    }),
    wrapExpressAsync(getAllCustomerEnquiry, 'customer_enquiry_get_all'),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCustomerEnquiryVisibility,
      'customer_enquiry_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCustomerEnquiryBarChartData,
      'customer_enquiry_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(getCustomerEnquiry, 'customer_enquiry_get_by_id'),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCustomerEnquiry, 'customer_enquiry_update_put'),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(updateCustomerEnquiry, 'customer_enquiry_update_patch'),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(deleteCustomerEnquiry, 'customer_enquiry_delete'),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCustomerEnquiryRoutes;
module.exports.router = createCustomerEnquiryRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/customer-enquiries',
  buildOptionsResponse({
    schemas: { create: customerEnquiryCreate, update: customerEnquiryUpdate },
    filterFields: CUSTOMER_ENQUIRY_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/customer-enquiries/:id',
  buildOptionsResponse({
    schemas: { create: customerEnquiryCreate, update: customerEnquiryUpdate },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
