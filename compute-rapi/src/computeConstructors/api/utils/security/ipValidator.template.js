/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * IP Address Validation and Extraction Utilities
 *
 * Provides secure IP address validation and extraction with anti-spoofing measures
 */

const net = require('net');
const crypto = require('crypto');
const ipRangeCheck = require('ip-range-check');
const { CONFIG } = require('#configs/securityConfig.js');

/**
 * Validates if a string is a valid IP address (IPv4 or IPv6)
 * @param {string} ip - IP address to validate
 * @returns {boolean} - True if valid IP address
 */
function isValidIP(ip) {
  if (!ip || typeof ip !== 'string') {
    return false;
  }

  // Remove any whitespace
  ip = ip.trim();

  // Use Node.js built-in validator which properly handles IPv4, IPv6,
  // compressed zero groups (::1), and IPv4-mapped addresses (::ffff:192.0.2.128)
  // net.isIP() returns 4 for IPv4, 6 for IPv6, and 0 for invalid
  return net.isIP(ip) !== 0;
}

/**
 * Checks if an IP address is in a private range
 * @param {string} ip - IP address to check
 * @returns {boolean} - True if private IP
 */
function isPrivateIP(ip) {
  if (!isValidIP(ip)) {
    return false;
  }

  // IPv4 private ranges
  const privateRanges = [
    /^10\./, // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./, // 192.168.0.0/16
    /^127\./, // 127.0.0.0/8 (loopback)
    /^169\.254\./, // 169.254.0.0/16 (link-local)
  ];

  return privateRanges.some((range) => range.test(ip));
}

/**
 * Extracts the real client IP address with anti-spoofing measures
 * @param {Object} req - Express request object
 * @returns {Object} - Object containing IP information and validation status
 */
function extractClientIP(req) {
  const result = {
    ip: 'unknown',
    source: 'unknown',
    isValid: false,
    isTrusted: false,
    forwardedFor: null,
    warning: null,
  };

  try {
    // Get forwarded headers
    const xForwardedFor = req.get('X-Forwarded-For');
    const xRealIP = req.get('X-Real-IP');
    const cfConnectingIP = req.get('CF-Connecting-IP'); // Cloudflare

    // Get direct connection IP
    const directIP =
      req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

    // If we trust proxies and have forwarded headers
    if (CONFIG.TRUST_PROXY && (xForwardedFor || xRealIP || cfConnectingIP)) {
      // Validate that the direct IP is from a trusted proxy
      if (directIP && CONFIG.TRUSTED_PROXIES.length > 0) {
        const isTrustedProxy = CONFIG.TRUSTED_PROXIES.some((proxy) => {
          if (proxy.includes('/')) {
            // Use proper CIDR validation to prevent IP spoofing vulnerability
            return ipRangeCheck(directIP, proxy);
          }
          return directIP === proxy;
        });

        if (!isTrustedProxy) {
          result.warning = 'Request from untrusted proxy';
          result.ip = directIP;
          result.source = 'direct_untrusted';
          result.isValid = isValidIP(directIP);
          return result;
        }

        result.isTrusted = true;
      }

      // Parse X-Forwarded-For (leftmost is the original client)
      if (xForwardedFor) {
        const ips = xForwardedFor.split(',').map((ip) => ip.trim());
        const clientIP = ips[0];

        if (isValidIP(clientIP)) {
          result.ip = clientIP;
          result.source = 'x-forwarded-for';
          result.isValid = true;
          result.forwardedFor = xForwardedFor.substring(
            0,
            CONFIG.MAX_HEADER_LENGTH
          );
          return result;
        }
      }

      // Try X-Real-IP
      if (xRealIP && isValidIP(xRealIP)) {
        result.ip = xRealIP;
        result.source = 'x-real-ip';
        result.isValid = true;
        return result;
      }

      // Try CF-Connecting-IP (Cloudflare)
      if (cfConnectingIP && isValidIP(cfConnectingIP)) {
        result.ip = cfConnectingIP;
        result.source = 'cf-connecting-ip';
        result.isValid = true;
        return result;
      }
    }

    // Fall back to direct connection IP
    if (directIP && isValidIP(directIP)) {
      result.ip = directIP;
      result.source = 'direct';
      result.isValid = true;

      // Warn if we expected forwarded headers but didn't get valid ones
      if (CONFIG.TRUST_PROXY && (xForwardedFor || xRealIP)) {
        result.warning = 'Invalid forwarded headers detected';
      }

      return result;
    }

    // If we get here, we couldn't extract a valid IP
    result.warning = 'No valid IP address found';
    result.ip = directIP || 'unknown';
  } catch (error) {
    result.warning = `IP extraction error: ${error.message}`;
  }

  return result;
}

/**
 * Sanitizes and validates IP address for logging
 * @param {string} ip - IP address to sanitize
 * @returns {string} - Sanitized IP address
 */
function sanitizeIP(ip) {
  if (!ip || typeof ip !== 'string') {
    return 'unknown';
  }

  // Remove any non-IP characters and limit length
  const cleaned = ip.trim().substring(0, 45); // IPv6 max length is 39, add some buffer

  if (isValidIP(cleaned)) {
    return cleaned;
  }

  return 'invalid';
}

/**
 * Creates a hash of IP address for privacy-compliant logging
 * @param {string} ip - IP address to hash
 * @returns {string} - Hashed IP address
 */
function hashIP(ip) {
  if (!ip || !isValidIP(ip)) {
    return 'unknown';
  }

  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

module.exports = {
  isValidIP,
  isPrivateIP,
  extractClientIP,
  sanitizeIP,
  hashIP,
};
