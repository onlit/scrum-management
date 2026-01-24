const { logEvent } = require('#utils/shared/loggingUtils.js');
const {
  CONFIG,
  SECURITY_EVENTS,
  EVENT_RISK_MAPPING,
} = require('#configs/securityConfig.js');
const {
  extractClientIP,
  sanitizeIP,
} = require('#utils/security/ipValidator.js');
const { analyzeThreats } = require('#utils/security/threatDetectors.js');
const LRUCache = require('#utils/security/lruCache.js');
const {
  sanitizeClientInfo,
  generateCorrelationId,
  toSafeString,
  sanitizeRequestBody,
} = require('#utils/security/inputSanitizer.js');
const { ERROR_SEVERITY } = require('#configs/constants.js');

// Health route prefix used to suppress noisy logs for kube probes
const HEALTH_PREFIX = '/api/v1/health';

// Thread-safe failed attempts tracking using LRU cache
const failedAttempts = new LRUCache(
  CONFIG.MAX_TRACKED_IPS,
  CONFIG.FAILED_ATTEMPT_WINDOW
);

// Global cleanup interval and signal handlers
let cleanupInterval = null;
let signalHandlersRegistered = false;
let memoryMonitorInterval = null;

// Event rate limiting
const eventRateLimiter = new LRUCache(1000, 60000); // 1000 events per minute

/**
 * Cleanup expired entries and monitor memory usage
 * @returns {Object} - Cleanup statistics
 */
function cleanupFailedAttempts() {
  try {
    const removedCount = failedAttempts.cleanup();
    const stats = failedAttempts.getStats();

    // Log cleanup statistics if significant activity
    if (removedCount > 0 || stats.size > CONFIG.MAX_TRACKED_IPS * 0.8) {
      logSecurityEvent(
        'CLEANUP_PERFORMED',
        {
          removedCount,
          currentSize: stats.size,
          utilizationPercent: stats.utilizationPercent,
          memoryEstimateMB: Math.round(stats.memoryUsageEstimate / 1024 / 1024),
        },
        ERROR_SEVERITY.LOW
      );
    }

    return { success: true, removedCount, stats };
  } catch (error) {
    logSecurityEvent(
      SECURITY_EVENTS.CLEANUP_ERROR,
      { error: toSafeString(error) },
      ERROR_SEVERITY.MEDIUM
    );
    return { success: false, error: error.message };
  }
}

/**
 * Monitor memory usage and trigger cleanup if needed
 */
function monitorMemoryUsage() {
  try {
    const stats = failedAttempts.getStats();
    const memoryMB = stats.memoryUsageEstimate / 1024 / 1024;

    if (memoryMB > CONFIG.MAX_MEMORY_USAGE_MB) {
      logSecurityEvent(
        'HIGH_MEMORY_USAGE',
        {
          memoryUsageMB: Math.round(memoryMB),
          thresholdMB: CONFIG.MAX_MEMORY_USAGE_MB,
          cacheSize: stats.size,
        },
        ERROR_SEVERITY.MEDIUM
      );

      // Force cleanup
      cleanupFailedAttempts();
    }
  } catch (error) {
    logSecurityEvent(
      SECURITY_EVENTS.CLEANUP_ERROR,
      { error: toSafeString(error), context: 'memory_monitoring' },
      ERROR_SEVERITY.MEDIUM
    );
  }
}

/**
 * Start cleanup and memory monitoring processes with proper signal handling
 */
function startCleanup() {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => {
      cleanupFailedAttempts();
    }, CONFIG.CLEANUP_INTERVAL);

    // Start memory monitoring
    if (!memoryMonitorInterval) {
      memoryMonitorInterval = setInterval(() => {
        monitorMemoryUsage();
      }, CONFIG.MEMORY_CHECK_INTERVAL);
    }

    // Register signal handlers only once
    if (!signalHandlersRegistered) {
      registerSignalHandlers();
      signalHandlersRegistered = true;
    }
  }
}

/**
 * Register process signal handlers for graceful shutdown
 */
function registerSignalHandlers() {
  const gracefulShutdown = () => {
    stopCleanup();
    process.exit(0);
  };

  // Use once() to prevent multiple handlers
  process.once('SIGINT', gracefulShutdown);
  process.once('SIGTERM', gracefulShutdown);

  // Note: 'exit' event cannot perform async operations
  process.once('exit', () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    if (memoryMonitorInterval) {
      clearInterval(memoryMonitorInterval);
    }
  });
}

/**
 * Stop cleanup and monitoring intervals
 */
function stopCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }

  if (memoryMonitorInterval) {
    clearInterval(memoryMonitorInterval);
    memoryMonitorInterval = null;
  }
}

/**
 * Extract and validate client information with anti-spoofing measures
 * @param {Object} req - Express request object
 * @returns {Object} - Validated client information
 */
function getClientInfo(req) {
  try {
    const ipInfo = extractClientIP(req);
    const clientInfo = sanitizeClientInfo(req);
    const correlationId = generateCorrelationId(req);

    return {
      ...clientInfo,
      ip: ipInfo.ip,
      ipSource: ipInfo.source,
      ipValid: ipInfo.isValid,
      ipTrusted: ipInfo.isTrusted,
      ipWarning: ipInfo.warning,
      forwardedFor: ipInfo.forwardedFor,
      correlationId,
    };
  } catch (error) {
    logSecurityEvent(
      SECURITY_EVENTS.IP_VALIDATION_FAILED,
      { error: toSafeString(error) },
      ERROR_SEVERITY.MEDIUM
    );

    // Fallback to basic client info
    return {
      ip: sanitizeIP(req.ip || 'unknown'),
      userAgent: 'error_extracting',
      method: req.method || 'unknown',
      url: req.originalUrl || 'unknown',
      timestamp: new Date().toISOString(),
      correlationId: generateCorrelationId(req),
      error: 'client_info_extraction_failed',
    };
  }
}

/**
 * Log security events with structured logging and rate limiting
 * @param {string} eventType - Type of security event
 * @param {Object} details - Event details
 * @param {string} riskLevel - Risk level (defaults to event mapping)
 * @param {string} correlationId - Request correlation ID
 */
function logSecurityEvent(
  eventType,
  details = {},
  riskLevel = null,
  correlationId = null
) {
  try {
    // Apply rate limiting to prevent log flooding
    const rateLimitKey = `${eventType}_${details.ip || 'unknown'}`;
    const rateLimitCount = eventRateLimiter.get(rateLimitKey) || 0;

    if (rateLimitCount >= CONFIG.MAX_EVENTS_PER_MINUTE) {
      return; // Skip logging if rate limit exceeded
    }

    eventRateLimiter.set(rateLimitKey, rateLimitCount + 1);

    // Use event-specific risk level if not provided
    const finalRiskLevel =
      riskLevel || EVENT_RISK_MAPPING[eventType] || ERROR_SEVERITY.MEDIUM;

    // Create structured log entry
    const securityLog = {
      service: 'compute-rapi',
      version: process.env.APP_VERSION || 'unknown',
      event: eventType,
      riskLevel: finalRiskLevel,
      details: toSafeString(details),
      correlationId: correlationId || 'unknown',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
    };

    if (CONFIG.ENABLE_STRUCTURED_LOGGING) {
      // Structured JSON logging
      logEvent(JSON.stringify(securityLog), details.traceId || correlationId);
    } else {
      // Legacy string format
      const logMessage = `[SECURITY][${finalRiskLevel.toUpperCase()}] ${eventType}: ${JSON.stringify(securityLog)}`;
      logEvent(logMessage, details.traceId || correlationId);
    }

    // Development logging
    if (process.env.NODE_ENV === 'development') {
      logEvent(
        `[DEV_SECURITY]: ${eventType} - ${toSafeString(details)}`,
        details.traceId || correlationId
      );
    }
  } catch (error) {
    // Fallback logging to prevent infinite loops
    try {
      logEvent(
        `[SECURITY_LOG_ERROR]: Failed to log event ${eventType}: ${error.message}`,
        details.traceId || correlationId
      );
    } catch (fallbackError) {
      console.error(
        'Critical: Security logging completely failed',
        fallbackError
      );
    }
  }
}

/**
 * Track failed authentication attempts with thread-safe operations
 * @param {string} ip - IP address to track
 * @param {string} correlationId - Request correlation ID
 * @returns {number} - Current number of failed attempts
 */
function trackFailedAttempt(ip, correlationId = null) {
  try {
    // Validate and sanitize IP
    const sanitizedIP = sanitizeIP(ip);
    if (sanitizedIP === 'unknown' || sanitizedIP === 'invalid') {
      return 0;
    }

    // Get current attempts (LRU cache handles expiration automatically)
    let attempts = failedAttempts.get(sanitizedIP) || [];
    const now = Date.now();

    // Add new attempt
    attempts.push(now);

    // Limit attempts per IP to prevent memory exhaustion
    if (attempts.length > CONFIG.MAX_ATTEMPTS_PER_IP) {
      attempts = attempts.slice(-CONFIG.MAX_ATTEMPTS_PER_IP);
    }

    // Store back in cache
    failedAttempts.set(sanitizedIP, attempts);

    // Filter to recent attempts
    const recentAttempts = attempts.filter(
      (timestamp) => now - timestamp < CONFIG.FAILED_ATTEMPT_WINDOW
    );

    // Update with only recent attempts
    failedAttempts.set(sanitizedIP, recentAttempts);

    // Log if threshold exceeded
    if (recentAttempts.length >= CONFIG.MAX_FAILED_ATTEMPTS) {
      logSecurityEvent(
        SECURITY_EVENTS.MULTIPLE_FAILED_ATTEMPTS,
        {
          ip: sanitizedIP,
          attemptCount: recentAttempts.length,
          timeWindowMinutes: CONFIG.FAILED_ATTEMPT_WINDOW / 1000 / 60,
          lastAttempts: recentAttempts
            .slice(-5)
            .map((t) => new Date(t).toISOString()),
        },
        ERROR_SEVERITY.HIGH,
        correlationId
      );
    }

    return recentAttempts.length;
  } catch (error) {
    logSecurityEvent(
      SECURITY_EVENTS.CLEANUP_ERROR,
      {
        error: toSafeString(error),
        context: 'track_failed_attempt',
        ip: sanitizeIP(ip),
      },
      ERROR_SEVERITY.MEDIUM,
      correlationId
    );
    return 0;
  }
}

/**
 * Enhanced security logger middleware with comprehensive threat detection
 * @param {Object} options - Configuration options
 * @returns {Function} - Express middleware function
 */
function securityLogger(options = {}) {
  const {
    logAllRequests = false,
    logFailedAuth = true,
    logSuccessfulAuth = false,
    logSuspiciousActivity = true,
    logFileUploads = true,
    enableThreatDetection = true,
  } = options;

  // Start global cleanup process
  startCleanup();

  return (req, res, next) => {
    // Skip security logging entirely for health endpoints
    const requestUrl = req.originalUrl || req.url || '';
    if (requestUrl.startsWith(HEALTH_PREFIX)) {
      return next();
    }

    let clientInfo;

    try {
      clientInfo = getClientInfo(req);

      // Add correlation ID to request for downstream use
      req.correlationId = clientInfo.correlationId;

      // Log request start for lifecycle tracking
      logEvent(`[REQUEST_START] ${req.method} ${req.originalUrl}`, req.traceId);

      // Log IP validation warnings
      if (clientInfo.ipWarning) {
        logSecurityEvent(
          SECURITY_EVENTS.IP_VALIDATION_FAILED,
          {
            ...clientInfo,
            warning: clientInfo.ipWarning,
          },
          ERROR_SEVERITY.MEDIUM,
          clientInfo.correlationId
        );
      }

      // Log all requests if enabled
      if (logAllRequests) {
        logSecurityEvent(
          'REQUEST_LOG',
          clientInfo,
          ERROR_SEVERITY.LOW,
          clientInfo.correlationId
        );
      }

      // Enhanced threat detection (async, but don't block the request)
      if (logSuspiciousActivity && enableThreatDetection) {
        performThreatDetection(req, clientInfo).catch((error) => {
          logSecurityEvent(
            'THREAT_DETECTION_ERROR',
            { error: toSafeString(error), context: 'async_threat_detection' },
            ERROR_SEVERITY.MEDIUM,
            clientInfo.correlationId
          );
        });
      }

      // Check for large payloads
      const contentLength = parseInt(req.get('Content-Length'), 10);
      if (
        !Number.isNaN(contentLength) &&
        contentLength > CONFIG.LARGE_PAYLOAD_THRESHOLD
      ) {
        logSecurityEvent(
          SECURITY_EVENTS.LARGE_PAYLOAD,
          {
            ...clientInfo,
            contentLength,
            thresholdMB: CONFIG.LARGE_PAYLOAD_THRESHOLD / 1024 / 1024,
          },
          contentLength > CONFIG.LARGE_PAYLOAD_THRESHOLD * 2
            ? ERROR_SEVERITY.HIGH
            : ERROR_SEVERITY.MEDIUM,
          clientInfo.correlationId
        );
      }

      // Log file uploads with enhanced detection
      if (logFileUploads) {
        detectAndLogFileUploads(req, clientInfo);
      }
    } catch (error) {
      // Fallback client info if extraction fails
      clientInfo = {
        ip: sanitizeIP(req.ip || 'unknown'),
        method: req.method || 'unknown',
        url: req.originalUrl || 'unknown',
        timestamp: new Date().toISOString(),
        correlationId: generateCorrelationId(req),
        error: 'client_info_failed',
      };

      logSecurityEvent(
        'MIDDLEWARE_ERROR',
        { error: toSafeString(error), context: 'client_info_extraction' },
        ERROR_SEVERITY.MEDIUM,
        clientInfo.correlationId
      );
    }

    // Enhanced response interception with error handling
    interceptResponse(req, res, clientInfo, {
      logFailedAuth,
      logSuccessfulAuth,
    });

    next();
  };
}

/**
 * Perform comprehensive threat detection on request
 * @param {Object} req - Express request object
 * @param {Object} clientInfo - Client information
 */
async function performThreatDetection(req, clientInfo) {
  try {
    // Prepare request data for analysis
    const requestData = {
      url: req.originalUrl,
      query: req.query,
      body:
        req.body && Object.keys(req.body).length > 0
          ? sanitizeRequestBody(req.body, false)
          : null,
      headers: req.headers,
    };

    // Analyze threats using safe detection (now async)
    const threatAnalysis = await analyzeThreats(requestData);

    if (threatAnalysis.threatsDetected) {
      for (const threat of threatAnalysis.threats) {
        const eventType = getEventTypeForThreat(threat.type);
        const riskLevel = getRiskLevelForThreat(
          threat,
          threatAnalysis.threatCount
        );

        logSecurityEvent(
          eventType,
          {
            ...clientInfo,
            threatType: threat.type,
            source: threat.source,
            details: threat.details,
            totalThreats: threatAnalysis.threatCount,
          },
          riskLevel,
          clientInfo.correlationId
        );
      }
    }
  } catch (error) {
    logSecurityEvent(
      'THREAT_DETECTION_ERROR',
      { error: toSafeString(error) },
      ERROR_SEVERITY.MEDIUM,
      clientInfo.correlationId
    );
  }
}

/**
 * Detect and log file uploads with enhanced checks
 * @param {Object} req - Express request object
 * @param {Object} clientInfo - Client information
 */
function detectAndLogFileUploads(req, clientInfo) {
  try {
    const isFileUpload =
      req.file ||
      req.files ||
      (req.headers['content-type'] &&
        req.headers['content-type'].includes('multipart/form-data'));

    if (isFileUpload) {
      const fileDetails = req.file
        ? {
            originalName: toSafeString(req.file.originalname),
            mimeType: toSafeString(req.file.mimetype),
            size: req.file.size,
            fieldName: toSafeString(req.file.fieldname),
          }
        : 'multipart_detected';

      logSecurityEvent(
        SECURITY_EVENTS.FILE_UPLOAD,
        {
          ...clientInfo,
          fileDetails,
        },
        ERROR_SEVERITY.MEDIUM,
        clientInfo.correlationId
      );
    }
  } catch (error) {
    logSecurityEvent(
      'FILE_UPLOAD_LOG_ERROR',
      { error: toSafeString(error) },
      ERROR_SEVERITY.MEDIUM,
      clientInfo.correlationId
    );
  }
}

/**
 * Intercept response to log authentication and authorization events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Object} clientInfo - Client information
 * @param {Object} options - Logging options
 */
function interceptResponse(req, res, clientInfo, options) {
  const originalSend = res.send;

  res.send = function logResponse(data) {
    try {
      // Log authentication failures
      if (options.logFailedAuth && res.statusCode === 401) {
        const failedAttemptCount = trackFailedAttempt(
          clientInfo.ip,
          clientInfo.correlationId
        );

        logSecurityEvent(
          SECURITY_EVENTS.AUTH_FAILURE,
          {
            ...clientInfo,
            failedAttemptCount,
            userId: req.user?.id || 'unknown',
            statusCode: res.statusCode,
          },
          failedAttemptCount >= CONFIG.MAX_FAILED_ATTEMPTS
            ? ERROR_SEVERITY.HIGH
            : ERROR_SEVERITY.MEDIUM,
          clientInfo.correlationId
        );
      }

      // Log successful authentication
      if (options.logSuccessfulAuth && res.statusCode === 200 && req.user?.id) {
        logSecurityEvent(
          SECURITY_EVENTS.AUTH_SUCCESS,
          {
            ...clientInfo,
            userId: toSafeString(req.user.id),
            userEmail: req.user.email
              ? toSafeString(req.user.email)
              : 'unknown',
            statusCode: res.statusCode,
          },
          ERROR_SEVERITY.LOW,
          clientInfo.correlationId
        );
      }

      // Log permission denied
      if (res.statusCode === 403) {
        logSecurityEvent(
          SECURITY_EVENTS.PERMISSION_DENIED,
          {
            ...clientInfo,
            userId: req.user?.id ? toSafeString(req.user.id) : 'unknown',
            statusCode: res.statusCode,
          },
          ERROR_SEVERITY.MEDIUM,
          clientInfo.correlationId
        );
      }
    } catch (error) {
      // Log response interception errors but don't break the response
      logSecurityEvent(
        'RESPONSE_LOG_ERROR',
        { error: toSafeString(error) },
        ERROR_SEVERITY.MEDIUM,
        clientInfo.correlationId
      );
    }

    // Log request completion for lifecycle tracking
    logEvent(
      `[REQUEST_END] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`,
      req.traceId
    );

    return originalSend.call(this, data);
  };
}

/**
 * Map threat types to security event types
 * @param {string} threatType - Type of threat detected
 * @returns {string} - Security event type
 */
function getEventTypeForThreat(threatType) {
  const mapping = {
    sql_injection: SECURITY_EVENTS.SQL_INJECTION_ATTEMPT,
    xss: SECURITY_EVENTS.XSS_ATTEMPT,
    path_traversal: SECURITY_EVENTS.PATH_TRAVERSAL_ATTEMPT,
    suspicious_path: SECURITY_EVENTS.SUSPICIOUS_REQUEST,
    analysis_error: 'THREAT_ANALYSIS_ERROR',
  };

  return mapping[threatType] || SECURITY_EVENTS.SUSPICIOUS_REQUEST;
}

/**
 * Determine risk level based on threat details
 * @param {Object} threat - Threat details
 * @param {number} totalThreats - Total number of threats detected
 * @returns {string} - Risk level
 */
function getRiskLevelForThreat(threat, totalThreats) {
  if (totalThreats > 2) return ERROR_SEVERITY.CRITICAL;
  if (threat.type === 'sql_injection') return ERROR_SEVERITY.CRITICAL;
  if (threat.details?.confidence === 'high') return ERROR_SEVERITY.HIGH;
  return ERROR_SEVERITY.MEDIUM;
}

module.exports = {
  securityLogger,
  logSecurityEvent,
  trackFailedAttempt,
  getClientInfo,
  startCleanup,
  stopCleanup,
  SECURITY_EVENTS,
};
