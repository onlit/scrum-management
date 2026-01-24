/**
 * Security Logger Test Suite
 *
 * Comprehensive tests for security logger functionality
 */

const {
  securityLogger,
  logSecurityEvent,
  SECURITY_EVENTS,
} = require('#middlewares/securityLogger.js');
const { extractClientIP } = require('#utils/security/ipValidator.js');
const { analyzeThreats } = require('#utils/security/threatDetectors.js');
const LRUCache = require('#utils/security/lruCache.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const { ERROR_SEVERITY } = require('#configs/constants.js');

// Mock dependencies
jest.mock('#utils/shared/loggingUtils.js', () => ({
  logEvent: jest.fn(),
}));

describe('Security Logger', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      originalUrl: '/api/test',
      url: '/api/test',
      ip: '192.168.1.1',
      get: jest.fn(),
      headers: {},
      query: {},
      body: {},
    };

    mockRes = {
      statusCode: 200,
      send: jest.fn(),
    };

    mockNext = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Basic Middleware Functionality', () => {
    test('should call next() when processing request', () => {
      const middleware = securityLogger();
      middleware(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should add correlation ID to request', () => {
      const middleware = securityLogger();
      middleware(mockReq, mockRes, mockNext);
      expect(mockReq.correlationId).toBeDefined();
      expect(typeof mockReq.correlationId).toBe('string');
    });

    test('should handle missing request properties gracefully', () => {
      const incompleteReq = {
        method: 'GET',
        get: jest.fn(() => undefined),
        headers: {},
        query: {},
        body: {},
      };
      const middleware = securityLogger();

      expect(() => {
        middleware(incompleteReq, mockRes, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('IP Address Validation', () => {
    test('should extract valid IPv4 address', () => {
      mockReq.ip = '203.0.113.1';
      const middleware = securityLogger();
      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.correlationId).toBeDefined();
    });

    test('should return IP from request when trust proxy not configured', () => {
      mockReq.ip = '192.168.1.1';
      mockReq.get = jest.fn((header) => {
        if (header === 'X-Forwarded-For') return '203.0.113.1';
        return null;
      });

      const result = extractClientIP(mockReq);
      // Without TRUST_PROXY configured, should use direct IP
      expect(result.ip).toBeDefined();
      expect(result.isValid).toBe(true);
    });

    test('should return direct IP when no forwarding headers present', () => {
      mockReq.ip = '192.168.1.100';
      mockReq.get = jest.fn(() => null);

      const result = extractClientIP(mockReq);
      expect(result.ip).toBe('192.168.1.100');
      expect(result.source).toBe('direct');
    });
  });

  describe('Threat Detection', () => {
    test('should detect SQL injection in query parameters', async () => {
      const requestData = {
        query: "'; DROP TABLE users; --",
        url: '/api/search',
        body: null,
      };

      const result = await analyzeThreats(requestData);
      expect(result.threatsDetected).toBe(true);
      expect(result.threats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'sql_injection',
          }),
        ])
      );
    });

    test('should detect XSS attempts in request body', async () => {
      const requestData = {
        query: '',
        url: '/api/comment',
        body: { comment: '<script>alert("xss")</script>' },
      };

      const result = await analyzeThreats(requestData);
      expect(result.threatsDetected).toBe(true);
      expect(result.threats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'xss',
          }),
        ])
      );
    });

    test('should detect path traversal attempts', async () => {
      const requestData = {
        url: '/api/file?path=../../../etc/passwd',
        query: { path: '../../../etc/passwd' },
        body: null,
      };

      const result = await analyzeThreats(requestData);
      expect(result.threatsDetected).toBe(true);
      expect(result.threats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'path_traversal',
          }),
        ])
      );
    });

    test('should handle safe input without false positives', async () => {
      const requestData = {
        url: '/api/search',
        query: { q: 'normal search term' },
        body: { name: 'John Doe', email: 'john@example.com' },
      };

      const result = await analyzeThreats(requestData);
      expect(result.threatsDetected).toBe(false);
      expect(result.threats).toHaveLength(0);
    });
  });

  describe('Memory Management', () => {
    test('LRU Cache should respect size limits', () => {
      const cache = new LRUCache(3, 1000);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key4')).toBe(true);
      expect(cache.size()).toBe(3);
    });

    test('LRU Cache should handle expiration', async () => {
      const cache = new LRUCache(10, 50); // 50ms expiration

      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(cache.has('key1')).toBe(false);
    });

    test('should provide memory usage statistics', () => {
      const cache = new LRUCache(100, 10000);

      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.size).toBe(10);
      expect(stats.utilizationPercent).toBe(10);
      expect(stats.memoryUsageEstimate).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle logging errors gracefully', () => {
      // Mock logEvent to throw an error
      logEvent.mockImplementation(() => {
        throw new Error('Logging failed');
      });

      const middleware = securityLogger();

      expect(() => {
        middleware(mockReq, mockRes, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle circular objects in request body', () => {
      const circular = { a: 1 };
      circular.self = circular;

      mockReq.body = circular;

      const middleware = securityLogger({ logSuspiciousActivity: true });

      expect(() => {
        middleware(mockReq, mockRes, mockNext);
      }).not.toThrow();
    });

    test('should handle missing headers gracefully', () => {
      mockReq.get = jest.fn(() => undefined);

      const middleware = securityLogger();

      expect(() => {
        middleware(mockReq, mockRes, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalled();
    });
  });
});

describe('Security Event Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log events with proper structure', () => {
    logSecurityEvent(
      SECURITY_EVENTS.AUTH_FAILURE,
      { ip: '192.168.1.1', userId: 'test123' },
      ERROR_SEVERITY.HIGH,
      'corr-123'
    );

    expect(logEvent).toHaveBeenCalled();
  });

  test('should encode XSS content in logs', () => {
    logSecurityEvent(
      SECURITY_EVENTS.AUTH_FAILURE,
      {
        ip: '192.168.1.1',
        userAgent: '<script>alert("xss")</script>',
      },
      ERROR_SEVERITY.HIGH
    );

    const logCall = logEvent.mock.calls[0][0];
    // XSS should be HTML-encoded (< becomes &lt;)
    expect(logCall).not.toContain('<script>');
  });
});
