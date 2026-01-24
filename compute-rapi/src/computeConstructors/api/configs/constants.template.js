/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to the compute microservice.
 * It sets up environment variables using dotenv, including the microservice name.
 *
 * NOTE: Error constants (ERROR_TYPES, STATUS_CODES, ERROR_MESSAGES, ERROR_TITLES) are
 * imported from the canonical source at shared/exceptions/domain.exception.js to ensure
 * consistency between Core and Domain layers.
 *
 */

const dotenv = require('dotenv');

// Import error constants from canonical source
const {
  ERROR_TYPES,
  STATUS_CODES,
  ERROR_MESSAGES,
  ERROR_TITLES,
} = require('#core/exceptions/domain.exception.js');

dotenv.config();

const MS_NAME = '{{ APP_NAME }}';

const DEV_ENV_NAME = 'development';

// Reserved computed property for display labels to avoid user field collisions
const DISPLAY_VALUE_PROP = '__displayValue';

const DJANGO_DETAILS_ROUTE = '/api/get-bulk-details/';
const NODE_DETAILS_ROUTE = '/api/v1/get-bulk-details/';

// External service hosts
const { CALENDAR_HOST, BPA_HOST } = process.env;

const UUID_KEY_VALUE_PAIRS = {
  [BPA_HOST]: {
    route: DJANGO_DETAILS_ROUTE,
    models: {
      WorkflowDefn: {
        workflowId: true,
      },
      WorkflowInstance: {
        workflowInstanceId: true,
      },
    },
  },
  // KEY_VALUE_USES
};

// Display value configuration per model (generated)
const DISPLAY_VALUE_TEMPLATES = {
  // DISPLAY_VALUE_TEMPLATES
};

// Model name to URL slug mapping (generated)
// Allows custom slugs to override automatic pluralization (e.g., "persons" instead of "people")
const MODEL_SLUGS = {
  // MODEL_SLUGS
};

const DISPLAY_VALUE_FALLBACK_FIELDS = {
  // DISPLAY_VALUE_FALLBACK_FIELDS
};

// Error severity levels
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

module.exports = {
  MS_NAME,
  DEV_ENV_NAME,
  DJANGO_DETAILS_ROUTE,
  NODE_DETAILS_ROUTE,
  UUID_KEY_VALUE_PAIRS,
  DISPLAY_VALUE_TEMPLATES,
  DISPLAY_VALUE_FALLBACK_FIELDS,
  MODEL_SLUGS,
  ERROR_SEVERITY,
  ERROR_TYPES,
  ERROR_MESSAGES,
  ERROR_TITLES,
  STATUS_CODES,
  CALENDAR_HOST,
  DISPLAY_VALUE_PROP,
};
