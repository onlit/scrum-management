/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * The router module exports a factory function that creates an Express Router instance
 * for handling CRUD operations related to customerEnquiryPurpose. It supports dependency injection
 * for the auth middleware, enabling testing with mock authentication.
 *
 * The router defines the following routes:
 * - POST '/': Route for creating a new customerEnquiryPurpose. It requires authentication and protection middleware.
 * - GET '/': Route for retrieving all customerEnquiryPurpose. It requires authentication middleware.
 * - GET '/:id': Route for retrieving a specific customerEnquiryPurpose by ID. It requires authentication middleware.
 * - PUT '/:id': Route for updating a specific customerEnquiryPurpose by ID. It requires authentication and protection middleware.
 * - PATCH '/:id': Alternate route for updating a specific customerEnquiryPurpose by ID. It requires authentication and protection middleware.
 * - DELETE '/:id': Route for deleting a specific customerEnquiryPurpose by ID. It requires authentication and protection middleware.
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
  customerEnquiryPurposeCreate,
  customerEnquiryPurposeUpdate,
} = require('#core/schemas/customerEnquiryPurpose.schema.core.js');
const { register } = require('#core/utils/schemaRegistry.js');
const { buildOptionsResponse } = require('#core/utils/optionsBuilder.js');

const {
  createCustomerEnquiryPurpose,
  getAllCustomerEnquiryPurpose,
  getCustomerEnquiryPurpose,
  updateCustomerEnquiryPurpose,
  deleteCustomerEnquiryPurpose,
  getCustomerEnquiryPurposeBarChartData,
  bulkUpdateCustomerEnquiryPurposeVisibility,
} = require('#core/controllers/customerEnquiryPurpose.controller.core.js');

// Filter fields for CustomerEnquiryPurpose (used by parseFilters middleware)
const CORE_FILTER_FIELDS = ['name', 'description'];

// Load domain filter extensions if available
let DOMAIN_FILTER_FIELDS = [];
try {
  const domainExtensions = require('#domain/extensions/customerEnquiryPurpose.filters.js');
  DOMAIN_FILTER_FIELDS = domainExtensions.filterFields || [];
} catch (e) {
  // No domain filter extensions for this model
}

// Merge core and domain filter fields
const CUSTOMER_ENQUIRY_PURPOSE_FILTER_FIELDS = [
  ...CORE_FILTER_FIELDS,
  ...DOMAIN_FILTER_FIELDS,
];

/**
 * Creates CustomerEnquiryPurpose routes with injected dependencies.
 *
 * @param {Object} dependencies
 * @param {Function} [dependencies.auth] - Auth middleware (defaults to production auth)
 * @returns {Router} Express router
 */
function createCustomerEnquiryPurposeRoutes({ auth = defaultAuth } = {}) {
  const router = Router();

  router.post(
    '/',
    auth,
    protect,
    wrapExpressAsync(
      createCustomerEnquiryPurpose,
      'customer_enquiry_purpose_create',
    ),
  );

  router.get(
    '/',
    auth,
    parseFilters({
      schema: customerEnquiryPurposeUpdate,
      filterFields: CUSTOMER_ENQUIRY_PURPOSE_FILTER_FIELDS,
    }),
    wrapExpressAsync(
      getAllCustomerEnquiryPurpose,
      'customer_enquiry_purpose_get_all',
    ),
  );

  // BULK: Visibility update
  router.patch(
    '/bulk/visibility',
    auth,
    protect,
    wrapExpressAsync(
      bulkUpdateCustomerEnquiryPurposeVisibility,
      'customer_enquiry_purpose_bulk_visibility_update',
    ),
  );

  router.get(
    '/bar-chart',
    auth,
    wrapExpressAsync(
      getCustomerEnquiryPurposeBarChartData,
      'customer_enquiry_purpose_bar_chart',
    ),
  );

  router.get(
    '/:id',
    auth,
    wrapExpressAsync(
      getCustomerEnquiryPurpose,
      'customer_enquiry_purpose_get_by_id',
    ),
  );

  router.put(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCustomerEnquiryPurpose,
      'customer_enquiry_purpose_update_put',
    ),
  );

  router.patch(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      updateCustomerEnquiryPurpose,
      'customer_enquiry_purpose_update_patch',
    ),
  );

  router.delete(
    '/:id',
    auth,
    protect,
    wrapExpressAsync(
      deleteCustomerEnquiryPurpose,
      'customer_enquiry_purpose_delete',
    ),
  );

  return router;
}

// Export factory for DI and default instance for backward compatibility
module.exports = createCustomerEnquiryPurposeRoutes;
module.exports.router = createCustomerEnquiryPurposeRoutes();

// Register OPTIONS schema for this route
register(
  '/api/v1/customer-enquiry-purposes',
  buildOptionsResponse({
    schemas: {
      create: customerEnquiryPurposeCreate,
      update: customerEnquiryPurposeUpdate,
    },
    filterFields: CUSTOMER_ENQUIRY_PURPOSE_FILTER_FIELDS,
    methods: ['GET', 'POST'],
  }),
);

register(
  '/api/v1/customer-enquiry-purposes/:id',
  buildOptionsResponse({
    schemas: {
      create: customerEnquiryPurposeCreate,
      update: customerEnquiryPurposeUpdate,
    },
    filterFields: [],
    methods: ['GET', 'PUT', 'PATCH', 'DELETE'],
  }),
);
