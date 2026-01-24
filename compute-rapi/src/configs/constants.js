/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to the compute microservice.
 * It sets up environment variables using dotenv, including the microservice name.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 *
 *
 * REVISION 3:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 01/03/2024
 * REVISION REASON: Add bullQueues in COMPUTE_API_SRC_FOLDERS
 *
 *
 * REVISION 4:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 15/03/2024
 * REVISION REASON: Add default values to fix type errors
 *
 *
 * REVISION 5:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 25/03/2024
 * REVISION REASON: Add error codes constant
 */

const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const {
  MICROSERVICE_POSTGRES_USER = '',
  MICROSERVICE_POSTGRES_PASSWORD = '',
  GIT_HOST = '',
} = process.env;

// hosts
const ACCOUNTS_HOST = process?.env?.ACCOUNTS_HOST;
const DRIVE_HOST = process?.env?.DRIVE_HOST;
const HR_HOST = process?.env?.HR_HOST;
const CRM_HOST = process?.env?.CRM_HOST;
const LOGS_HOST = process?.env?.LOGS_HOST;
const SYSTEM_HOST = process?.env?.SYSTEM_HOST;
const GIT_HOST_WITHOUT_HTTP_AND_HTTPS = GIT_HOST.replace(/^https?:\/\//, '');

// Helper function to encode values to base64
const encodeToBase64 = (value) => Buffer.from(value).toString('base64');

// DevOps environment configuration with base64 encoded values
const DEVOPS_ENV = {
  MICROSERVICE_POSTGRES_USER: encodeToBase64(MICROSERVICE_POSTGRES_USER),
  MICROSERVICE_POSTGRES_PASSWORD: encodeToBase64(
    MICROSERVICE_POSTGRES_PASSWORD
  ),
  MICROSERVICE_POSTGRES_DB: (microservice) => encodeToBase64(microservice),
  MICROSERVICE_POSTGRES_DATABASE_URL: (microservice) => {
    const databaseUrl = `postgresql://${MICROSERVICE_POSTGRES_USER}:${MICROSERVICE_POSTGRES_PASSWORD}@${microservice}-db-svc:5432/${microservice}?schema=public`;
    return encodeToBase64(databaseUrl);
  },
  MICROSERVICE_PGBOUNCER_DATABASE_URL: (microservice) => {
    const databaseUrl = `postgresql://${MICROSERVICE_POSTGRES_USER}:${MICROSERVICE_POSTGRES_PASSWORD}@${microservice}-pgbouncer-svc:5432/${microservice}?schema=public&pgbouncer=true`;
    return encodeToBase64(databaseUrl);
  },
};

const DEVOPS_DEFAULT_TYPES = ['dev', 'prod'];

const MS_NAME = 'Compute';

const DEV_ENV_NAME = 'development';

const DISPLAY_VALUE_PROP = '__displayValue';

const DJANGO_DETAILS_ROUTE = '/api/get-bulk-details/';
const NODE_DETAILS_ROUTE = '/api/v1/get-bulk-details/';

const UUID_KEY_VALUE_PAIRS = {
  [ACCOUNTS_HOST]: {
    route: NODE_DETAILS_ROUTE,
    models: {
      microservice: {
        externalMicroserviceId: true,
      },
      model: {
        externalModelId: true,
      },
      modelField: {
        externalDisplayValueId: true,
      },
    },
  },
  [SYSTEM_HOST]: {
    route: DJANGO_DETAILS_ROUTE,
    models: {
      Menu: {
        systemMenuId: true,
      },
    },
  },
};

// Error severity levels
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Standard error types
// Uses SCREAMING_SNAKE_CASE values matching keys for consistency with events-rapi
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  INTERNAL: 'INTERNAL',
  BAD_REQUEST: 'BAD_REQUEST',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  MIGRATION_ISSUES: 'MIGRATION_ISSUES',
  TIMEOUT: 'TIMEOUT',
};

// Standard error messages
const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION]:
    'Validation failed: One or more fields did not meet the required criteria. Please review your input and try again.',
  [ERROR_TYPES.AUTHENTICATION]:
    'Authentication required: Please log in to access this resource.',
  [ERROR_TYPES.AUTHORIZATION]:
    'Insufficient permissions: You do not have the necessary rights to perform this action.',
  [ERROR_TYPES.NOT_FOUND]:
    'Resource not found: The requested item does not exist or may have been removed.',
  [ERROR_TYPES.CONFLICT]:
    'Resource conflict: The operation could not be completed due to a conflict with existing data (e.g., duplicate entry).',
  [ERROR_TYPES.RATE_LIMIT]:
    'Rate limit exceeded: Too many requests. Please wait and try again later.',
  [ERROR_TYPES.INTERNAL]:
    'Internal server error: An unexpected error occurred. Please try again or contact support if the issue persists.',
  [ERROR_TYPES.BAD_REQUEST]:
    'Bad request: The server could not process your request due to invalid input or parameters.',
  [ERROR_TYPES.SERVICE_UNAVAILABLE]:
    'Service temporarily unavailable: The server is currently unable to handle the request. Please try again shortly.',
  [ERROR_TYPES.MIGRATION_ISSUES]:
    'Migration issues detected. Review and confirm to proceed.',
};

// Error titles for responses
const ERROR_TITLES = {
  [ERROR_TYPES.VALIDATION]: 'Validation Failed',
  [ERROR_TYPES.AUTHENTICATION]: 'Unauthorized',
  [ERROR_TYPES.AUTHORIZATION]: 'Forbidden',
  [ERROR_TYPES.NOT_FOUND]: 'Not Found',
  [ERROR_TYPES.CONFLICT]: 'Conflict',
  [ERROR_TYPES.RATE_LIMIT]: 'Rate Limited',
  [ERROR_TYPES.INTERNAL]: 'Internal Server Error',
  [ERROR_TYPES.BAD_REQUEST]: 'Bad Request',
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [ERROR_TYPES.MIGRATION_ISSUES]: 'Migration Issues Detected',
};

// Status codes mapping
const STATUS_CODES = {
  [ERROR_TYPES.VALIDATION]: 422,
  [ERROR_TYPES.AUTHENTICATION]: 401,
  [ERROR_TYPES.AUTHORIZATION]: 403,
  [ERROR_TYPES.NOT_FOUND]: 404,
  [ERROR_TYPES.CONFLICT]: 409,
  [ERROR_TYPES.RATE_LIMIT]: 429,
  [ERROR_TYPES.INTERNAL]: 500,
  [ERROR_TYPES.BAD_REQUEST]: 400,
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_TYPES.MIGRATION_ISSUES]: 409,
};

const DELETE_BEHAVIORS = ['Cascade', 'Restrict'];

const FOREIGN_KEY_TARGETS = ['Internal', 'External'];

const FOREIGN_KEY_TYPES = ['OneToOne', 'OneToMany'];

// Role-based access control for compute microservice operations
const ALLOWED_COMPUTE_ROLES = ['System Administrator', 'Compute Admin'];

const COMPUTE_API_MIDDLEWARES = [
  'auth',
  'notFound',
  'errorHandler',
  'protect',
  'wrapAsync',
  'errorBoundary',
  'inputSanitizer',
  'protectOrInternal',
  'rateLimiter',
  'securityLogger',
  'schemaOptionsHandler',
  'traceId',
  'internalRequestHandler',
  'conditionalCors',
  'parseFilters',
];

const COMPUTE_API_UTILS = [
  'apiUtils',
  'appRegUtils',
  'automataUtils',
  'basicLoggingUtils',
  'controllerUtils',
  'displayValueUtils',
  'databaseUtils',
  'dateUtils',
  'errorHandlingUtils',
  'fileUtils',
  'filterSchemaUtils',
  'generalUtils',
  'importExportUtils',
  'loggingUtils',
  'optionsBuilder',
  'schemaRegistry',
  'shellUtils',
  'stringUtils',
  'traceUtils',
  'visibilityUtils',
  'dateValidationUtils',
  'nestedHydrationUtils',
];

const COMPUTE_API_SECURITY_UTILS = [
  'inputSanitizer',
  'ipValidator',
  'lruCache',
  'threatDetectors',
];

const COMPUTE_API_SRC_FOLDERS = [
  // Core layer (generated, overwritten on each generation)
  'core/configs',
  'core/middlewares',
  'core/controllers',
  'core/routes/v1',
  'core/schemas',
  'core/utils',
  'core/repositories',
  'core/bullQueues/workers',
  'core/bullQueues/queues',
  // Domain layer (protected, scaffolded once, never overwritten)
  'domain/controllers',
  'domain/routes/v1',
  'domain/schemas',
  'domain/interceptors',
  'domain/constants',
];

const COMPUTE_API_DOCKER_FILE_TYPES = ['dev', 'prod', 'staging'];

const MODEL_FIELD_TYPES = [
  'String',
  'Email',
  'Int',
  'Boolean',
  'Json',
  'DateTime',
  'Date',
  'UUID',
  'Enum',
  'Float',
  'Decimal',
  'URL',
  'IPAddress',
  'StringArray',
  'IntArray',
  'Upload',
  'Phone',
  'Latitude',
  'Longitude',
  'Percentage',
  'Slug',
  'Vector',
];

const RESERVED_FIELD_NAMES = [
  'id',
  'everyoneCanSeeIt',
  'anonymousCanSeeIt',
  'everyoneInObjectCompanyCanSeeIt',
  'onlyTheseRolesCanSeeIt',
  'onlyTheseUsersCanSeeIt',
  'client',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
  'deleted',
  'isSystemTemplate',
  'workflowInstanceId',
  'workflowId',
  'tags',
  'details',
  'color',
];

const ROOT_DIR = __dirname;
const COMPUTE_PATH = path.join(ROOT_DIR, '..', 'computeOutput');
const CONSTRUCTORS_PATH = path.join(ROOT_DIR, '..', 'computeConstructors');

// Main App repo details
const MAIN_APP_REPO_NAME = 'Ps Admin Microfe';
const MAIN_APP_REPO_PATH = 'ps-admin/ps-admin-microfe';

const FE_DATA_TYPE_MAP = {
  String: 'text',
  Json: 'text',
  URL: 'text',
  IPAddress: 'text',
  Int: 'number',
  Float: 'number',
  Decimal: 'number',
  Date: 'date',
  DateTime: 'dateTime',
  Boolean: 'boolean',
  Enum: 'singleSelect',
  Upload: 'upload',
  Phone: 'text',
  Latitude: 'number',
  Longitude: 'number',
  Percentage: 'number',
  Slug: 'text',
};

const ENUM_DEFN_DETAIL = {
  include: {
    enumValues: true,
  },
};

// Build nested DISPLAY_VALUE_DETAIL to support chains up to 9 levels deep
// e.g., Model1 → Model2 → Model3 → ... → Model9 → scalarField
const DISPLAY_VALUE_DETAIL_LEVEL_9 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: true, // Terminal level - just load the field
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_8 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_9,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_7 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_8,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_6 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_7,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_5 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_6,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_4 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_5,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_3 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_4,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL_LEVEL_2 = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_3,
      },
    },
  },
};

const DISPLAY_VALUE_DETAIL = {
  include: {
    model: true,
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL_LEVEL_2,
      },
    },
  },
};

// Nested fieldDefns include - needed for template-based nested includes
// Must include foreignKeyModel to allow isInternalForeignKey() checks
const NESTED_FIELD_DEFN_DETAIL = {
  include: {
    foreignKeyModel: {
      include: {
        microservice: true,
      },
    },
  },
};

const FIELD_DEFN_DETAIL = {
  include: {
    foreignKeyModel: {
      include: {
        microservice: true,
        displayValue: DISPLAY_VALUE_DETAIL,
        fieldDefns: NESTED_FIELD_DEFN_DETAIL, // Include FK info for nested fields
      },
    },
    enumDefn: ENUM_DEFN_DETAIL,
    dependsOnField: {
      include: {
        foreignKeyModel: {
          include: {
            microservice: true,
          },
        },
      },
    },
  },
};

const MODEL_DEFN_DETAIL = {
  include: {
    fieldDefns: FIELD_DEFN_DETAIL,
    displayValue: DISPLAY_VALUE_DETAIL,
    dashboardStageField: FIELD_DEFN_DETAIL,
    microservice: {
      select: {
        name: true,
      },
    },
  },
};

const COMMIT_WAY = 'sandbox_to_production'; // (sandbox_to_production, production)

const COMPUTE_GENERATED_APPS_GROUP_ID = '802';

// Dependency Rules System Constants
const DEPENDENCY_ACTION_TYPES = [
  'Show',
  'Hide',
  'Require',
  'Optional',
  'Enable',
  'Disable',
];

const DEPENDENCY_CONDITION_OPERATORS = [
  'Equals',
  'NotEquals',
  'In',
  'NotIn',
  'IsSet',
  'IsNotSet',
];

const DEPENDENCY_LOGIC_OPERATORS = ['And', 'Or'];

const GROUP_REQUIREMENT_TYPES = ['AtLeastOne', 'ExactlyOne', 'All', 'None'];

// Dashboard widget types
const WIDGET_TYPES = [
  'KpiCard',
  'FunnelChart',
  'BarChart',
  'LineChart',
  'AreaChart',
  'PieChart',
  'DonutChart',
];

// Dashboard aggregation types
const AGGREGATION_TYPES = ['Count', 'Sum', 'Average', 'Min', 'Max'];

// Dashboard widget sizes
const WIDGET_SIZES = ['Small', 'Medium', 'Large', 'Full'];

// Date range presets
const DATE_RANGE_PRESETS = [
  'Today',
  'Yesterday',
  'Last7Days',
  'Last30Days',
  'ThisMonth',
  'LastMonth',
  'Last90Days',
  'ThisYear',
  'AllTime',
];

// Metric output types
const METRIC_OUTPUT_TYPES = ['Number', 'Currency', 'Percentage', 'Duration'];

/**
 * Directories that are NEVER deleted during regeneration.
 * These contain custom business logic that must survive code generation.
 *
 * Note: Only domain-specific directories are protected. Core directories
 * (src/core, tests/core, tests/factories, docs) are regenerated as schema evolves.
 */
const PROTECTED_DIRECTORIES = ['src/domain', 'tests/domain'];

/**
 * Files that are NEVER deleted during regeneration.
 * These contain environment-specific or dependency configurations.
 */
const PROTECTED_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.test',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.generated-manifest.json',
];

/**
 * Check if a path is protected from deletion during regeneration.
 * @param {string} relativePath - Path relative to microservice root
 * @returns {boolean} True if path should be protected
 */
function isProtectedPath(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // Check if path matches or is inside a protected directory
  for (const dir of PROTECTED_DIRECTORIES) {
    if (normalizedPath === dir || normalizedPath.startsWith(dir + '/')) {
      return true;
    }
  }

  // Check if path matches a protected file
  const filename = normalizedPath.split('/').pop();
  return (
    PROTECTED_FILES.includes(filename) ||
    PROTECTED_FILES.includes(normalizedPath)
  );
}

module.exports = {
  DEVOPS_ENV,
  DEVOPS_DEFAULT_TYPES,
  MS_NAME,
  DEV_ENV_NAME,
  UUID_KEY_VALUE_PAIRS,
  ERROR_SEVERITY,
  ERROR_TYPES,
  ERROR_MESSAGES,
  ERROR_TITLES,
  STATUS_CODES,
  COMPUTE_API_MIDDLEWARES,
  COMPUTE_API_UTILS,
  COMPUTE_API_SECURITY_UTILS,
  COMPUTE_API_SRC_FOLDERS,
  COMPUTE_API_DOCKER_FILE_TYPES,
  MODEL_FIELD_TYPES,
  RESERVED_FIELD_NAMES,
  COMPUTE_PATH,
  CONSTRUCTORS_PATH,
  MAIN_APP_REPO_NAME,
  MAIN_APP_REPO_PATH,
  FE_DATA_TYPE_MAP,
  ENUM_DEFN_DETAIL,
  FIELD_DEFN_DETAIL,
  MODEL_DEFN_DETAIL,
  // hosts
  ACCOUNTS_HOST,
  HR_HOST,
  CRM_HOST,
  LOGS_HOST,
  SYSTEM_HOST,
  GIT_HOST,
  GIT_HOST_WITHOUT_HTTP_AND_HTTPS,
  DELETE_BEHAVIORS,
  DRIVE_HOST,
  FOREIGN_KEY_TARGETS,
  FOREIGN_KEY_TYPES,
  COMMIT_WAY,
  COMPUTE_GENERATED_APPS_GROUP_ID,
  ALLOWED_COMPUTE_ROLES,
  DISPLAY_VALUE_PROP,
  DEPENDENCY_ACTION_TYPES,
  DEPENDENCY_CONDITION_OPERATORS,
  DEPENDENCY_LOGIC_OPERATORS,
  GROUP_REQUIREMENT_TYPES,
  WIDGET_TYPES,
  AGGREGATION_TYPES,
  WIDGET_SIZES,
  DATE_RANGE_PRESETS,
  METRIC_OUTPUT_TYPES,
  PROTECTED_DIRECTORIES,
  PROTECTED_FILES,
  isProtectedPath,
};
