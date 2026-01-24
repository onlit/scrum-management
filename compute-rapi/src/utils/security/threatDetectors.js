/**
 * Security Threat Detection Utilities
 *
 * Provides safe and efficient detection of various security threats
 */

const { CONFIG } = require('#configs/securityConfig.js');
const { logWithTrace, getTraceId } = require('#utils/shared/traceUtils.js');

/**
 * Timeout wrapper for regex operations to prevent ReDoS attacks
 * @param {RegExp} regex - Regular expression to execute
 * @param {string} input - Input string to test
 * @param {number} timeout - Timeout in milliseconds
 * @returns {boolean} - True if pattern matches, false if no match or timeout
 */
function safeRegexTest(regex, input, timeout = CONFIG.REGEX_TIMEOUT) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeout);

    try {
      const result = regex.test(input);
      clearTimeout(timer);
      resolve(result);
    } catch (error) {
      clearTimeout(timer);
      resolve(false);
    }
  });
}

/**
 * Synchronous safe regex test with basic protection
 * @param {RegExp} regex - Regular expression to execute
 * @param {string} input - Input string to test
 * @param {number} maxLength - Maximum input length to process
 * @returns {boolean} - True if pattern matches, false otherwise
 */
function safeSyncRegexTest(regex, input, maxLength = 1000) {
  if (!input || typeof input !== 'string' || input.length > maxLength) {
    return false;
  }

  try {
    return regex.test(input);
  } catch (error) {
    return false;
  }
}

/**
 * Detects potential SQL injection attempts using safe patterns
 * @param {string} input - Input string to analyze
 * @returns {Promise<Object>} - Detection result with details
 */
async function detectSQLInjection(input) {
  if (!input || typeof input !== 'string') {
    return { detected: false, patterns: [] };
  }

  // Limit input length for performance
  if (input.length > CONFIG.MAX_BODY_SIZE_FOR_SCANNING) {
    return { detected: false, patterns: [], reason: 'input_too_large' };
  }

  const detectedPatterns = [];

  // Safe SQL injection patterns (non-backtracking)
  const sqlPatterns = [
    {
      name: 'sql_comments',
      pattern: /(?:--|#|\/\*)/i,
      description: 'SQL comment syntax'
    },
    {
      name: 'union_select',
      pattern: /\bunion\s+(?:all\s+)?select\b/i,
      description: 'UNION SELECT statement'
    },
    {
      name: 'sql_keywords',
      pattern: /\b(?:select|insert|update|delete|drop|alter|create|truncate)\s+/i,
      description: 'SQL keywords'
    },
    {
      name: 'boolean_injection',
      pattern: /\b(?:or|and)\s+(?:\d+\s*[=<>!]\s*\d+|true|false)\b/i,
      description: 'Boolean-based injection'
    },
    {
      name: 'time_based',
      pattern: /\b(?:sleep|pg_sleep|waitfor\s+delay|benchmark)\s*\(/i,
      description: 'Time-based injection'
    },
    {
      name: 'file_operations',
      pattern: /\b(?:load_file|into\s+(?:outfile|dumpfile))\b/i,
      description: 'File operation functions'
    },
    {
      name: 'information_schema',
      pattern: /\binformation_schema\b/i,
      description: 'Information schema access'
    }
  ];

  // Test each pattern safely with timeout protection
  for (const { name, pattern, description } of sqlPatterns) {
    if (await safeRegexTest(pattern, input, 50)) { // 50ms timeout for ReDoS protection
      detectedPatterns.push({ name, description });
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    confidence: (() => {
      if (detectedPatterns.length > 2) return 'high';
      if (detectedPatterns.length > 0) return 'medium';
      return 'low';
    })()
  };
}

/**
 * Detects potential XSS attempts
 * @param {string} input - Input string to analyze
 * @returns {Promise<Object>} - Detection result with details
 */
async function detectXSS(input) {
  if (!input || typeof input !== 'string') {
    return { detected: false, patterns: [] };
  }

  if (input.length > CONFIG.MAX_BODY_SIZE_FOR_SCANNING) {
    return { detected: false, patterns: [], reason: 'input_too_large' };
  }

  const detectedPatterns = [];

  const xssPatterns = [
    {
      name: 'script_tags',
      pattern: /<script[^>]*>/i,
      description: 'Script tag detected'
    },
    {
      name: 'javascript_protocol',
      pattern: /javascript\s*:/i,
      description: 'JavaScript protocol'
    },
    {
      name: 'event_handlers',
      pattern: /\bon(?:load|click|error|mouseover|focus|blur)\s*=/i,
      description: 'Event handler attributes'
    },
    {
      name: 'iframe_tags',
      pattern: /<iframe[^>]*>/i,
      description: 'Iframe tag detected'
    },
    {
      name: 'object_embed',
      pattern: /<(?:object|embed)[^>]*>/i,
      description: 'Object or embed tag'
    }
  ];

  for (const { name, pattern, description } of xssPatterns) {
    if (await safeRegexTest(pattern, input, 50)) { // 50ms timeout for ReDoS protection
      detectedPatterns.push({ name, description });
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    confidence: detectedPatterns.length > 1 ? 'high' : 'medium'
  };
}

/**
 * Detects path traversal attempts
 * @param {string} input - Input string to analyze (usually URL path)
 * @returns {Promise<Object>} - Detection result with details
 */
async function detectPathTraversal(input) {
  if (!input || typeof input !== 'string') {
    return { detected: false, patterns: [] };
  }

  const detectedPatterns = [];

  // Simple, safe patterns for path traversal
  const pathTraversalPatterns = [
    {
      name: 'dot_dot_slash',
      pattern: /\.\.[/\\]/,
      description: 'Directory traversal sequence'
    },
    {
      name: 'encoded_traversal',
      pattern: /%2e%2e[%2f%5c]/i,
      description: 'URL-encoded traversal'
    },
    {
      name: 'unix_paths',
      pattern: /\/etc\/passwd|\/proc\/|\/sys\//,
      description: 'Unix system paths'
    },
    {
      name: 'windows_paths',
      pattern: /\\windows\\|\\system32\\|boot\.ini/i,
      description: 'Windows system paths'
    }
  ];

  for (const { name, pattern, description } of pathTraversalPatterns) {
    if (await safeRegexTest(pattern, input, 50)) { // 50ms timeout for ReDoS protection
      detectedPatterns.push({ name, description });
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
    confidence: detectedPatterns.length > 0 ? 'high' : 'low'
  };
}

/**
 * Detects suspicious paths that are commonly probed by attackers
 * @param {string} path - URL path to analyze
 * @returns {Object} - Detection result with details
 */
function detectSuspiciousPaths(path) {
  if (!path || typeof path !== 'string') {
    return { detected: false, paths: [] };
  }

  const suspiciousPaths = [
    { pattern: '/.env', description: 'Environment file access' },
    { pattern: '/.git', description: 'Git repository access' },
    { pattern: '/wp-admin', description: 'WordPress admin access' },
    { pattern: '/phpmyadmin', description: 'phpMyAdmin access' },
    { pattern: '/admin/config.php', description: 'Admin config access' },
    { pattern: '/xmlrpc.php', description: 'XML-RPC access' },
    { pattern: '/wp-login.php', description: 'WordPress login' },
    { pattern: '/manager/html', description: 'Tomcat manager' },
    { pattern: '/solr/', description: 'Apache Solr access' },
    { pattern: '/elasticsearch/', description: 'Elasticsearch access' },
  ];

  const detectedPaths = suspiciousPaths
    .filter(({ pattern }) => path.toLowerCase().includes(pattern.toLowerCase()))
    .map(({ pattern, description }) => ({ pattern, description }));

  return {
    detected: detectedPaths.length > 0,
    paths: detectedPaths,
    confidence: 'high'
  };
}

/**
 * Safe object traversal function to extract strings without JSON.stringify
 * @param {any} obj - Object to traverse
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {Array<string>} - Array of strings found in the object
 */
function extractStringsFromObject(obj, maxDepth = 3) {
  const strings = [];

  function traverse(item, depth) {
    if (depth <= 0 || strings.length > 100) { // Limit to prevent DoS
      return;
    }

    if (typeof item === 'string') {
      strings.push(item);
    } else if (Array.isArray(item)) {
      for (let i = 0; i < Math.min(item.length, 50); i++) { // Limit array size
        traverse(item[i], depth - 1);
      }
    } else if (typeof item === 'object' && item !== null) {
      const keys = Object.keys(item);
      for (let i = 0; i < Math.min(keys.length, 50); i++) { // Limit object keys
        traverse(item[keys[i]], depth - 1);
      }
    }
  }

  traverse(obj, maxDepth);
  return strings;
}

/**
 * Comprehensive threat analysis of input
 * @param {Object} requestData - Request data to analyze
 * @returns {Promise<Object>} - Comprehensive threat analysis result
 */
async function analyzeThreats(requestData) {
  const { url, query, body, req } = requestData;
  const threats = [];

  try {
    // Analyze URL for path traversal and suspicious paths
    if (url) {
      const pathTraversal = await detectPathTraversal(url);
      if (pathTraversal.detected) {
        threats.push({
          type: 'path_traversal',
          source: 'url',
          details: pathTraversal
        });
      }

      const suspiciousPaths = detectSuspiciousPaths(url);
      if (suspiciousPaths.detected) {
        threats.push({
          type: 'suspicious_path',
          source: 'url',
          details: suspiciousPaths
        });
      }
    }

    // Analyze query parameters safely without JSON.stringify
    if (query) {
      const queryStrings = typeof query === 'string' ? [query] : extractStringsFromObject(query);

      for (const queryString of queryStrings) {
        const sqlInjection = await detectSQLInjection(queryString);
        if (sqlInjection.detected) {
          threats.push({
            type: 'sql_injection',
            source: 'query',
            details: sqlInjection
          });
          break; // Avoid duplicate detections
        }

        const xss = await detectXSS(queryString);
        if (xss.detected) {
          threats.push({
            type: 'xss',
            source: 'query',
            details: xss
          });
          break; // Avoid duplicate detections
        }
      }
    }

    // Analyze request body safely without JSON.stringify
    if (body) {
      const bodyStrings = typeof body === 'string' ? [body] : extractStringsFromObject(body);

      for (const bodyString of bodyStrings) {
        const sqlInjection = await detectSQLInjection(bodyString);
        if (sqlInjection.detected) {
          threats.push({
            type: 'sql_injection',
            source: 'body',
            details: sqlInjection
          });
          break; // Avoid duplicate detections
        }

        const xss = await detectXSS(bodyString);
        if (xss.detected) {
          threats.push({
            type: 'xss',
            source: 'body',
            details: xss
          });
          break; // Avoid duplicate detections
        }
      }
    }
  } catch (error) {
    const traceId = req ? getTraceId(req) : undefined;
    if (req) {
      logWithTrace('Threat analysis error in analyzeThreats', req, { error: error.message, context: 'analyze_threats' });
    }
    threats.push({
      type: 'analysis_error',
      source: 'analyzer',
      details: {
        error: error.message,
        context: 'analyze_threats',
        ...(traceId ? { traceId } : {}),
      }
    });
  }

  return {
    threatsDetected: threats.length > 0,
    threatCount: threats.length,
    threats,
    riskLevel: (() => {
      if (threats.length > 2) return 'critical';
      if (threats.length > 0) return 'high';
      return 'low';
    })()
  };
}

module.exports = {
  detectSQLInjection,
  detectXSS,
  detectPathTraversal,
  detectSuspiciousPaths,
  analyzeThreats,
  safeRegexTest,
  safeSyncRegexTest,
};
