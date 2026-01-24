/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to customerEnquiryStatus. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new customerEnquiryStatus. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all customerEnquiryStatus. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific customerEnquiryStatus by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific customerEnquiryStatus by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific customerEnquiryStatus by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific customerEnquiryStatus by ID. It requires authentication and protection middleware.
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
  customerEnquiryStatusCreate,
  customerEnquiryStatusUpdate,
} = require('#core/schemas/customerEnquiryStatus.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCustomerEnquiryStatus,
  getAllCustomerEnquiryStatus,
  getCustomerEnquiryStatus,
  updateCustomerEnquiryStatus,
  deleteCustomerEnquiryStatus,
  getCustomerEnquiryStatusBarChartData,
  bulkUpdateCustomerEnquiryStatusVisibility,
} = require('#core/controllers/customerEnquiryStatus.controller.core.js');

// Filter fields for CustomerEnquiryStatus (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['description', 'name'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/customerEnquiryStatus.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CUSTOMER_ENQUIRY_STATUS_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CustomerEnquiryStatus routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCustomerEnquiryStatusRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createCustomerEnquiryStatus,
      'customer_enquiry_status_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: customerEnquiryStatusUpdate,
      filterFields: CUSTOMER_ENQUIRY_STATUS_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllCustomerEnquiryStatus,
      'customer_enquiry_status_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCustomerEnquiryStatusVisibility,
      'customer_enquiry_status_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCustomerEnquiryStatusBarChartData,
      'customer_enquiry_status_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getCustomerEnquiryStatus,
      'customer_enquiry_status_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCustomerEnquiryStatus,
      'customer_enquiry_status_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCustomerEnquiryStatus,
      'customer_enquiry_status_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deleteCustomerEnquiryStatus,
      'customer_enquiry_status_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCustomerEnquiryStatusRoutes;
module.exports.router = createCustomerEnquiryStatusRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/customer-enquiry-statuses',
  buildOptionsResponse({
    schemas: {
      create: customerEnquiryStatusCreate,
      update: customerEnquiryStatusUpdate,
    },
    filterFields: CUSTOMER_ENQUIRY_STATUS_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/customer-enquiry-statuses/:id',
  buildOptionsResponse({
    schemas: {
      create: customerEnquiryStatusCreate,
      update: customerEnquiryStatusUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
