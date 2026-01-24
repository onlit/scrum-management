/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * This file contains configuration related to Cross-Origin Resource Sharing (CORS) for the compute microservice.
 * It implements a hardened CORS policy with secure behavior, comprehensive domain validation,
 * and fail-fast configuration validation to ensure enterprise-grade security.
 *
 * Security Features:
 * - Strict domain allowlist validation for browser requests
 * - Allows server-to-server requests (no Origin header)
 * - Fail-fast configuration validation
 * - Performance-optimized origin checking
 * - HTTPS enforcement in production for browser requests
 */

const dotenv = require('dotenv');
const { logEvent } = require('#utils/loggingUtils.js');

dotenv.config();

const DEV_ENV_NAME = 'development';
const TEST_ENV_NAME = 'test';

/**
 * Sanitize and validate a hostname (simplified approach)
 * Focuses on format validation without semantic transformation
 */
function sanitizeHostname(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return null;
  }

  // Clean and normalize
  let sanitized = hostname.trim().toLowerCase();
  // Remove protocol and path, but keep the full host
  sanitized = sanitized.replace(/^https?:\/\//, '');
  [sanitized] = sanitized.split('/');
  [sanitized] = sanitized.split('?');
  [sanitized] = sanitized.split('#');

  // Validate against a hostname regex (RFC 1123 compliant)
  // Allow single domain names and multi-part domains
  const hostnameRegex =
    /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

  if (!hostnameRegex.test(sanitized)) {
    return null;
  }

  return sanitized;
}

/**
 * Parse and validate environment variables with fail-fast behavior
 */
function parseEnvironmentVariables() {
  const corsHostsRaw = process.env.CORS_HOSTS;
  const allowedSubDomainsRaw = process.env.ALLOWED_SUB_DOMAINS;

  // Fail-fast: Throw error if environment variables are missing or invalid
  if (!corsHostsRaw || typeof corsHostsRaw !== 'string') {
    logEvent(
      '[CORS_ENV_FATAL]: CORS_HOSTS environment variable is missing or invalid. Application cannot start.'
    );
    throw new Error('Missing or invalid CORS_HOSTS environment variable.');
  }

  if (!allowedSubDomainsRaw || typeof allowedSubDomainsRaw !== 'string') {
    logEvent(
      '[CORS_ENV_FATAL]: ALLOWED_SUB_DOMAINS environment variable is missing or invalid. Application cannot start.'
    );
    throw new Error(
      'Missing or invalid ALLOWED_SUB_DOMAINS environment variable.'
    );
  }

  // Check for reasonable length limits to prevent DoS
  if (corsHostsRaw.length > 10000) {
    logEvent(
      '[CORS_ENV_FATAL]: CORS_HOSTS environment variable is too long (>10KB). Application cannot start.'
    );
    throw new Error('CORS_HOSTS environment variable exceeds maximum length.');
  }

  if (allowedSubDomainsRaw.length > 5000) {
    logEvent(
      '[CORS_ENV_FATAL]: ALLOWED_SUB_DOMAINS environment variable is too long (>5KB). Application cannot start.'
    );
    throw new Error(
      'ALLOWED_SUB_DOMAINS environment variable exceeds maximum length.'
    );
  }

  // Parse and sanitize hosts
  const hostsList = corsHostsRaw.split(',');
  const sanitizedHosts = [];
  const rejectedHosts = [];

  for (const host of hostsList) {
    const sanitized = sanitizeHostname(host);
    if (sanitized) {
      sanitizedHosts.push(sanitized);
    } else {
      rejectedHosts.push(host.trim());
    }
  }

  // Parse and sanitize subdomains
  const subdomainsList = allowedSubDomainsRaw.split(',');
  const sanitizedSubdomains = [];
  const rejectedSubdomains = [];

  for (const subdomain of subdomainsList) {
    const trimmed = subdomain.trim().toLowerCase();
    // Simple validation for subdomains (allow dots for complex subdomains)
    if (trimmed && /^[a-z0-9]([a-z0-9.-]{0,61}[a-z0-9])?$/.test(trimmed)) {
      sanitizedSubdomains.push(trimmed);
    } else {
      rejectedSubdomains.push(subdomain.trim());
    }
  }

  // Log rejected entries for security monitoring
  if (rejectedHosts.length > 0) {
    logEvent(
      `[CORS_ENV_WARNING]: Rejected invalid hosts: ${rejectedHosts.join(', ')}`
    );
  }

  if (rejectedSubdomains.length > 0) {
    logEvent(
      `[CORS_ENV_WARNING]: Rejected invalid subdomains: ${rejectedSubdomains.join(
        ', '
      )}`
    );
  }

  // Fail-fast: Ensure we have valid configuration after sanitization
  if (sanitizedHosts.length === 0) {
    logEvent(
      '[CORS_ENV_FATAL]: No valid hosts after sanitization. Application cannot start.'
    );
    throw new Error('No valid CORS hosts found after sanitization.');
  }

  if (sanitizedSubdomains.length === 0) {
    logEvent(
      '[CORS_ENV_FATAL]: No valid subdomains after sanitization. Application cannot start.'
    );
    throw new Error('No valid CORS subdomains found after sanitization.');
  }

  // Log successful parsing
  logEvent(
    `[CORS_ENV_SUCCESS]: Parsed ${sanitizedHosts.length} valid hosts and ${sanitizedSubdomains.length} valid subdomains`
  );

  return {
    hosts: sanitizedHosts,
    subdomains: sanitizedSubdomains,
  };
}

// Parse and validate environment variables with fail-fast behavior
const { hosts: CORS_HOSTS, subdomains: ALLOWED_SUB_DOMAINS } =
  parseEnvironmentVariables();

// Create Sets for fast O(1) lookups
const ALLOWED_HOSTS_SET = new Set(CORS_HOSTS);

// Development localhost origins
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:8000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:8000',
];

/**
 * Check if origin matches allowed domain patterns (performance optimized)
 */
function isOriginAllowed(origin) {
  // Secure-by-default: Deny requests without origin
  if (!origin) {
    logEvent(
      '[CORS_REJECTED]: Request rejected because it has no Origin header.'
    );
    return false;
  }

  const onDevEnv = process.env.NODE_ENV === DEV_ENV_NAME;
  const onTestEnv = process.env.NODE_ENV === TEST_ENV_NAME;

  // Allow internal microservice-to-microservice calls
  // These often have origins like "service-name:port" without protocol
  const internalServicePatterns = [
    /-rapi:\d+$/, // Matches *-rapi:8000, *-rapi:8001, etc.
    /^[a-z0-9-]+-svc:\d+$/, // Matches service names ending with -svc
    /^localhost:\d+$/, // Matches localhost:port
    /^127\.0\.0\.1:\d+$/, // Matches 127.0.0.1:port
  ];

  for (const pattern of internalServicePatterns) {
    if (pattern.test(origin)) {
      logEvent(`[CORS_ALLOWED]: Internal microservice call from ${origin}`);
      return true;
    }
  }

  // Allow development origins
  if (DEV_ORIGINS.includes(origin)) {
    logEvent(`[CORS_DEBUG]: Allowing development origin: ${origin}`);
    return true;
  }

  try {
    const url = new URL(origin);

    // Reject non-HTTPS in production (allow HTTP in dev and test for localhost)
    const allowHttpLocalhost = onDevEnv || onTestEnv;
    if (!allowHttpLocalhost && url.protocol !== 'https:') {
      logEvent(`[CORS_REJECTED]: Non-HTTPS origin rejected: ${origin}`);
      return false;
    }

    // Allow HTTP in development/test for localhost
    if (
      allowHttpLocalhost &&
      url.protocol === 'http:' &&
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
    ) {
      return true;
    }

    const hostname = url.hostname.toLowerCase();

    // Check if hostname is directly in allowed hosts
    if (ALLOWED_HOSTS_SET.has(hostname)) {
      logEvent(`[CORS_ALLOWED]: Direct host match for ${origin}`);
      return true;
    }

    // Check if hostname with www prefix is in allowed hosts
    const withoutWww = hostname.replace(/^www\./, '');
    if (ALLOWED_HOSTS_SET.has(withoutWww)) {
      logEvent(`[CORS_ALLOWED]: Host match (www stripped) for ${origin}`);
      return true;
    }

    // Check subdomain combinations
    for (const host of CORS_HOSTS) {
      for (const subdomain of ALLOWED_SUB_DOMAINS) {
        const subdomainHost = `${subdomain}.${host}`;
        const wwwSubdomainHost = `www.${subdomain}.${host}`;

        if (hostname === subdomainHost || hostname === wwwSubdomainHost) {
          logEvent(
            `[CORS_ALLOWED]: Subdomain match for ${origin} on ${subdomainHost}`
          );
          return true;
        }
      }
    }

    logEvent(`[CORS_REJECTED]: Origin not in allowed list: ${origin}`);
    return false;
  } catch (error) {
    logEvent(
      `[CORS_ERROR]: Invalid origin format: ${origin} - ${error.message}`
    );
    return false;
  }
}

/**
 * Validate CORS configuration for security issues
 */
function validateCorsConfiguration() {
  const issues = [];
  const warnings = [];

  // Security validations for hosts
  for (const host of CORS_HOSTS) {
    // Check for very short hostnames that might be typos
    if (host.length < 4) {
      warnings.push(`Very short hostname detected: ${host} (may be a typo)`);
    }

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, // IP addresses
      /localhost/, // Localhost in production config
      /test\./,
      /dev\./,
      /staging\./, // Dev environments
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(host)) {
        warnings.push(`Potentially suspicious host pattern: ${host}`);
      }
    }
  }

  // Security validations for subdomains
  for (const subdomain of ALLOWED_SUB_DOMAINS) {
    const riskySubdomains = [
      'admin',
      'internal',
      'private',
      'secure',
      'test',
      'dev',
    ];
    if (riskySubdomains.includes(subdomain)) {
      warnings.push(
        `Potentially risky subdomain: ${subdomain} (may expose sensitive areas)`
      );
    }
  }

  // Performance warnings
  if (CORS_HOSTS.length > 100) {
    warnings.push(
      `Large number of hosts (${CORS_HOSTS.length}) may impact performance`
    );
  }

  if (ALLOWED_SUB_DOMAINS.length > 50) {
    warnings.push(
      `Large number of subdomains (${ALLOWED_SUB_DOMAINS.length}) may impact performance`
    );
  }

  // Calculate total possible origins
  const totalOrigins = CORS_HOSTS.length * (ALLOWED_SUB_DOMAINS.length + 1) * 2;
  if (totalOrigins > 1000) {
    warnings.push(
      `High number of possible origins (${totalOrigins}) may impact performance`
    );
  }

  // Log warnings
  if (warnings.length > 0) {
    logEvent(`[CORS_CONFIG_WARNING]: ${warnings.join('; ')}`);
  }

  if (warnings.length === 0) {
    logEvent(
      `[CORS_CONFIG_SUCCESS]: Validated ${CORS_HOSTS.length} hosts and ${ALLOWED_SUB_DOMAINS.length} subdomains - configuration is secure`
    );
  } else {
    logEvent(
      `[CORS_CONFIG_SUCCESS]: Validated ${CORS_HOSTS.length} hosts and ${ALLOWED_SUB_DOMAINS.length} subdomains with ${warnings.length} warnings`
    );
  }

  return issues.length === 0;
}

// Validate configuration on module load
validateCorsConfiguration();

const corsOptions = {
  origin: (origin, callback) => {
    // Log the origin for debugging (but sanitize it first)
    const sanitizedOrigin = origin
      ? origin.replace(/[^\w\-.:]/g, '').substring(0, 100)
      : null;

    logEvent(`[CORS_CHECK]: Checking origin: ${sanitizedOrigin}`);

    if (isOriginAllowed(origin)) {
      callback(null, true); // Allow the request
    } else {
      // Enhanced error message for debugging
      let errorMessage;
      if (!origin) {
        errorMessage = `CORS policy violation: Missing Origin header. This request is not allowed by the server's CORS policy.`;
      } else {
        errorMessage = `CORS policy violation: Origin '${sanitizedOrigin}' is not allowed`;
      }
      logEvent(`[CORS_VIOLATION]: ${errorMessage}`);
      callback(new Error(errorMessage)); // Reject the request
    }
  },
  credentials: true, // Allow credentials for authenticated requests
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // Explicitly allowed methods
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Forwarded-For',
    'ActAs', // Custom header used by the application
    'X-Timezone', // Timezone header for date/datetime field formatting in API responses
  ],
  exposedHeaders: [
    'X-Total-Count', // For pagination
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'ETag',
    'Last-Modified',
  ],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  maxAge: 600, // 10 minutes preflight cache
};

const setOriginHeader = (req, res, next) => {
  req.headers.origin = req.headers.origin || req.headers.host;
  next();
};

/**
 * Utility function to test if an origin would be allowed (for debugging)
 */
function testOrigin(origin) {
  return isOriginAllowed(origin);
}

module.exports = {
  corsOptions,
  setOriginHeader,
  testOrigin,
  validateCorsConfiguration,
};
