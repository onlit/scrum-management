/**
 * Security Configuration
 *
 * Centralized configuration for security logging and monitoring
 */

const { ERROR_SEVERITY } = require('#configs/constants.js');

// Security event types
const SECURITY_EVENTS = {
  AUTH_SUCCESS: 'auth_success',
  AUTH_FAILURE: 'auth_failure',
  AUTH_TOKEN_MISSING: 'auth_token_missing',
  PERMISSION_DENIED: 'permission_denied',
  SUSPICIOUS_REQUEST: 'suspicious_request',
  FILE_UPLOAD: 'file_upload',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  INPUT_VALIDATION_FAILED: 'input_validation_failed',
  LARGE_PAYLOAD: 'large_payload',
  MULTIPLE_FAILED_ATTEMPTS: 'multiple_failed_attempts',
  SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
  XSS_ATTEMPT: 'xss_attempt',
  PATH_TRAVERSAL_ATTEMPT: 'path_traversal_attempt',
  CLEANUP_ERROR: 'cleanup_error',
  IP_VALIDATION_FAILED: 'ip_validation_failed',
};

// Configuration constants
const CONFIG = {
  // Failed attempts tracking
  FAILED_ATTEMPT_WINDOW:
    parseInt(process.env.SECURITY_FAILED_ATTEMPT_WINDOW, 10) || 15 * 60 * 1000, // 15 minutes
  MAX_FAILED_ATTEMPTS:
    parseInt(process.env.SECURITY_MAX_FAILED_ATTEMPTS, 10) || 5,
  MAX_TRACKED_IPS: parseInt(process.env.SECURITY_MAX_TRACKED_IPS, 10) || 1000,
  MAX_ATTEMPTS_PER_IP:
    parseInt(process.env.SECURITY_MAX_ATTEMPTS_PER_IP, 10) || 50,

  // Cleanup intervals
  CLEANUP_INTERVAL:
    parseInt(process.env.SECURITY_CLEANUP_INTERVAL, 10) || 5 * 60 * 1000, // 5 minutes
  CLEANUP_BATCH_SIZE:
    parseInt(process.env.SECURITY_CLEANUP_BATCH_SIZE, 10) || 100,

  // Input validation
  MAX_USER_AGENT_LENGTH:
    parseInt(process.env.SECURITY_MAX_USER_AGENT_LENGTH, 10) || 500,
  MAX_URL_LENGTH: parseInt(process.env.SECURITY_MAX_URL_LENGTH, 10) || 2000,
  MAX_HEADER_LENGTH:
    parseInt(process.env.SECURITY_MAX_HEADER_LENGTH, 10) || 1000,
  MAX_BODY_SIZE_FOR_SCANNING:
    parseInt(process.env.SECURITY_MAX_BODY_SIZE_FOR_SCANNING, 10) ||
    1024 * 1024, // 1MB

  // Content size limits
  LARGE_PAYLOAD_THRESHOLD:
    parseInt(process.env.SECURITY_LARGE_PAYLOAD_THRESHOLD, 10) ||
    50 * 1024 * 1024, // 50MB

  // Trusted proxy configuration
  TRUSTED_PROXIES: (process.env.SECURITY_TRUSTED_PROXIES || '')
    .split(',')
    .filter(Boolean),
  TRUST_PROXY: process.env.SECURITY_TRUST_PROXY === 'true',

  // Regex timeout protection
  REGEX_TIMEOUT: parseInt(process.env.SECURITY_REGEX_TIMEOUT, 10) || 100, // milliseconds

  // Rate limiting for security events
  MAX_EVENTS_PER_MINUTE:
    parseInt(process.env.SECURITY_MAX_EVENTS_PER_MINUTE, 10) || 100,

  // Logging configuration
  ENABLE_STRUCTURED_LOGGING:
    process.env.SECURITY_ENABLE_STRUCTURED_LOGGING !== 'false',
  ENABLE_CORRELATION_ID: process.env.SECURITY_ENABLE_CORRELATION_ID !== 'false',
  LOG_LEVEL: process.env.SECURITY_LOG_LEVEL || 'info',

  // Memory management
  MEMORY_CHECK_INTERVAL:
    parseInt(process.env.SECURITY_MEMORY_CHECK_INTERVAL, 10) || 60000, // 1 minute
  MAX_MEMORY_USAGE_MB:
    parseInt(process.env.SECURITY_MAX_MEMORY_USAGE_MB, 10) || 100,
};

// Risk level mappings for different events
const EVENT_RISK_MAPPING = {
  [SECURITY_EVENTS.AUTH_SUCCESS]: ERROR_SEVERITY.LOW,
  [SECURITY_EVENTS.AUTH_FAILURE]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.AUTH_TOKEN_MISSING]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.PERMISSION_DENIED]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.SUSPICIOUS_REQUEST]: ERROR_SEVERITY.HIGH,
  [SECURITY_EVENTS.FILE_UPLOAD]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.RATE_LIMIT_EXCEEDED]: ERROR_SEVERITY.HIGH,
  [SECURITY_EVENTS.INPUT_VALIDATION_FAILED]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.LARGE_PAYLOAD]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.MULTIPLE_FAILED_ATTEMPTS]: ERROR_SEVERITY.HIGH,
  [SECURITY_EVENTS.SQL_INJECTION_ATTEMPT]: ERROR_SEVERITY.CRITICAL,
  [SECURITY_EVENTS.XSS_ATTEMPT]: ERROR_SEVERITY.HIGH,
  [SECURITY_EVENTS.PATH_TRAVERSAL_ATTEMPT]: ERROR_SEVERITY.HIGH,
  [SECURITY_EVENTS.CLEANUP_ERROR]: ERROR_SEVERITY.MEDIUM,
  [SECURITY_EVENTS.IP_VALIDATION_FAILED]: ERROR_SEVERITY.MEDIUM,
};

// Validation schemas
const VALIDATION_SCHEMAS = {
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  ipv6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

module.exports = {
  SECURITY_EVENTS,
  CONFIG,
  EVENT_RISK_MAPPING,
  VALIDATION_SCHEMAS,
};
