/**
 * CORS Configuration Test Suite
 * 
 * Comprehensive tests for the hardened CORS configuration including:
 * - Environment variable validation and parsing
 * - Origin validation logic 
 * - Security features (fail-fast, secure-by-default)
 * - All allowed domains and subdomains
 */

const { logEvent } = require('#utils/shared/loggingUtils.js');

// Mock environment variables before importing the module
const originalEnv = process.env;

// Mock logging to prevent console spam during tests
jest.mock('#utils/shared/loggingUtils.js', () => ({
  logEvent: jest.fn()
}));

// Mock constants
jest.mock('#configs/constants.js', () => ({
  DEV_ENV_NAME: 'development'
}));

// Mock dotenv to prevent it from loading .env file during tests
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

describe('CORS Configuration', () => {
  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    
    // Set test environment variables
    process.env.CORS_HOSTS = 'finance-equation.co.uk,mathfinancialgroup.com,innovative.org.za,amantherapy.com,pullstream.com,evchargingsolutions.co.uk,mazards.com,dastrum.com,inosanctum.com,supersymmetrysoftware.com,phtang.com,growthiq.co,lolagrange.com,pst.bz,gressmann.gallery,gressmanngallery.com,mondonovis.ae';
    process.env.ALLOWED_SUB_DOMAINS = 'sandbox,staging,sandbox.me,me.staging,me,sandbox.me-v2,me-v2.staging,me-v2,sandbox.cms,cms.staging,cms,sandbox.chat,chat.staging,chat,sandbox.lms,lms.staging,lms';
    process.env.NODE_ENV = 'test';
    
    // Clear module cache to get fresh instance
    jest.resetModules();
    logEvent.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Parsing', () => {
    it('should successfully parse valid environment variables', () => {
      const { validateCorsConfiguration } = require('#configs/cors.js');
      expect(validateCorsConfiguration()).toBe(true);
    });

    it('should fail-fast when CORS_HOSTS is missing', () => {
      delete process.env.CORS_HOSTS;
      
      expect(() => {
        require('#configs/cors.js');
      }).toThrow('Missing or invalid CORS_HOSTS environment variable.');
    });

    it('should fail-fast when ALLOWED_SUB_DOMAINS is missing', () => {
      delete process.env.ALLOWED_SUB_DOMAINS;
      
      expect(() => {
        require('#configs/cors.js');
      }).toThrow('Missing or invalid ALLOWED_SUB_DOMAINS environment variable.');
    });

    it('should fail-fast when CORS_HOSTS is too long', () => {
      process.env.CORS_HOSTS = 'a'.repeat(10001);
      
      expect(() => {
        require('#configs/cors.js');
      }).toThrow('CORS_HOSTS environment variable exceeds maximum length.');
    });

    it('should fail-fast when no valid hosts after sanitization', () => {
      process.env.CORS_HOSTS = 'invalid..host,another..bad..host';
      
      expect(() => {
        require('#configs/cors.js');
      }).toThrow('No valid CORS hosts found after sanitization.');
    });
  });

  describe('Origin Validation Logic', () => {
    let testOrigin;

    beforeEach(() => {
      const corsModule = require('#configs/cors.js');
      testOrigin = corsModule.testOrigin;
    });

    describe('Secure-by-Default Behavior', () => {
      it('should reject requests with no Origin header', () => {
        expect(testOrigin(null)).toBe(false);
        expect(testOrigin(undefined)).toBe(false);
        expect(testOrigin('')).toBe(false);
      });
    });

    describe('Development Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'development';
        jest.resetModules();
        const corsModule = require('#configs/cors.js');
        testOrigin = corsModule.testOrigin;
      });

      it('should allow localhost origins in development', () => {
        const devOrigins = [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001',
          'http://127.0.0.1:3002'
        ];

        devOrigins.forEach(origin => {
          expect(testOrigin(origin)).toBe(true);
        });
      });

      it('should allow HTTP for localhost in development', () => {
        expect(testOrigin('http://localhost:3000')).toBe(true);
        expect(testOrigin('http://127.0.0.1:3000')).toBe(true);
      });
    });

    describe('Production Environment', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        jest.resetModules();
        const corsModule = require('#configs/cors.js');
        testOrigin = corsModule.testOrigin;
      });

      it('should reject HTTP origins in production', () => {
        expect(testOrigin('http://pullstream.com')).toBe(false);
        expect(testOrigin('http://sandbox.pullstream.com')).toBe(false);
      });

      it('should require HTTPS for all origins in production', () => {
        expect(testOrigin('https://pullstream.com')).toBe(true);
        expect(testOrigin('http://pullstream.com')).toBe(false);
      });
    });

    describe('Valid Origins - Direct Hosts', () => {
      const validHosts = [
        'finance-equation.co.uk',
        'mathfinancialgroup.com', 
        'innovative.org.za',
        'amantherapy.com',
        'pullstream.com',
        'evchargingsolutions.co.uk',
        'mazards.com',
        'dastrum.com',
        'inosanctum.com',
        'supersymmetrysoftware.com',
        'phtang.com',
        'growthiq.co',
        'lolagrange.com',
        'pst.bz',
        'gressmann.gallery',
        'gressmanngallery.com',
        'mondonovis.ae'
      ];

      it('should allow all configured host domains', () => {
        validHosts.forEach(host => {
          const origin = `https://${host}`;
          expect(testOrigin(origin)).toBe(true);
        });
      });

      it('should allow www variants of host domains', () => {
        validHosts.forEach(host => {
          const origin = `https://www.${host}`;
          expect(testOrigin(origin)).toBe(true);
        });
      });
    });

    describe('Valid Origins - Subdomains', () => {
      const validSubdomains = [
        'sandbox',
        'staging', 
        'sandbox.me',
        'me.staging',
        'me',
        'sandbox.me-v2',
        'me-v2.staging',
        'me-v2',
        'sandbox.cms',
        'cms.staging',
        'cms',
        'sandbox.chat',
        'chat.staging',
        'chat',
        'sandbox.lms',
        'lms.staging',
        'lms'
      ];

      const sampleHosts = ['pullstream.com', 'mazards.com', 'dastrum.com'];

      it('should allow all subdomain combinations with sample hosts', () => {
        validSubdomains.forEach(subdomain => {
          sampleHosts.forEach(host => {
            const origin = `https://${subdomain}.${host}`;
            expect(testOrigin(origin)).toBe(true);
          });
        });
      });

      it('should allow www variants of subdomain combinations', () => {
        validSubdomains.forEach(subdomain => {
          sampleHosts.forEach(host => {
            const origin = `https://www.${subdomain}.${host}`;
            expect(testOrigin(origin)).toBe(true);
          });
        });
      });
    });

    describe('Invalid Origins', () => {
      it('should reject unknown domains', () => {
        const invalidOrigins = [
          'https://evil.com',
          'https://attacker.net',
          'https://phishing-site.org',
          'https://malicious.pullstream.com.evil.com',
          'https://pullstream.com.evil.com'
        ];

        invalidOrigins.forEach(origin => {
          expect(testOrigin(origin)).toBe(false);
        });
      });

      it('should reject invalid subdomains', () => {
        const invalidOrigins = [
          'https://admin.pullstream.com',
          'https://internal.pullstream.com', 
          'https://private.pullstream.com',
          'https://evil.pullstream.com',
          'https://not-allowed.pullstream.com'
        ];

        invalidOrigins.forEach(origin => {
          expect(testOrigin(origin)).toBe(false);
        });
      });

      it('should reject malformed origins', () => {
        const malformedOrigins = [
          'not-a-url',
          'ftp://pullstream.com',
          'javascript:alert(1)',
          'data:text/html,<script>alert(1)</script>'
        ];

        malformedOrigins.forEach(origin => {
          expect(testOrigin(origin)).toBe(false);
        });
      });

      it('should handle URL parsing errors gracefully', () => {
        const invalidUrls = [
          'https://[invalid-ipv6',
          'https://domain..com',
          'https://domain-.com',
          'https://-domain.com'
        ];

        invalidUrls.forEach(origin => {
          expect(testOrigin(origin)).toBe(false);
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle ports correctly', () => {
        expect(testOrigin('https://pullstream.com:443')).toBe(true);
        expect(testOrigin('https://pullstream.com:8080')).toBe(true);
        expect(testOrigin('https://sandbox.pullstream.com:3000')).toBe(true);
      });

      it('should be case insensitive', () => {
        expect(testOrigin('https://PULLSTREAM.COM')).toBe(true);
        expect(testOrigin('https://PullStream.Com')).toBe(true);
        expect(testOrigin('https://SANDBOX.PULLSTREAM.COM')).toBe(true);
      });

      it('should handle international domains correctly', () => {
        expect(testOrigin('https://innovative.org.za')).toBe(true);
        expect(testOrigin('https://mondonovis.ae')).toBe(true);
        expect(testOrigin('https://sandbox.innovative.org.za')).toBe(true);
      });
    });
  });

  describe('CORS Options Configuration', () => {
    let corsOptions;

    beforeEach(() => {
      const corsModule = require('#configs/cors.js');
      corsOptions = corsModule.corsOptions;
    });

    it('should have correct configuration structure', () => {
      expect(corsOptions).toHaveProperty('origin');
      expect(corsOptions).toHaveProperty('credentials', true);
      expect(corsOptions).toHaveProperty('methods');
      expect(corsOptions).toHaveProperty('allowedHeaders');
      expect(corsOptions).toHaveProperty('exposedHeaders');
      expect(corsOptions).toHaveProperty('optionsSuccessStatus', 200);
      expect(corsOptions).toHaveProperty('maxAge', 600);
    });

    it('should include all required headers', () => {
      const expectedHeaders = [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Forwarded-For',
        'ActAs'
      ];

      expectedHeaders.forEach(header => {
        expect(corsOptions.allowedHeaders).toContain(header);
      });
    });

    it('should expose performance and security headers', () => {
      const expectedExposedHeaders = [
        'X-Total-Count',
        'X-Rate-Limit-Limit',
        'X-Rate-Limit-Remaining', 
        'X-Rate-Limit-Reset',
        'ETag',
        'Last-Modified'
      ];

      expectedExposedHeaders.forEach(header => {
        expect(corsOptions.exposedHeaders).toContain(header);
      });
    });

    describe('Origin Callback Function', () => {
      it('should call callback with true for valid origins', (done) => {
        corsOptions.origin('https://pullstream.com', (error, allowed) => {
          expect(error).toBeNull();
          expect(allowed).toBe(true);
          done();
        });
      });

      it('should call callback with error for invalid origins', (done) => {
        corsOptions.origin('https://evil.com', (error, allowed) => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain('CORS policy violation');
          expect(allowed).toBeUndefined();
          done();
        });
      });

      it('should call callback with error for null origin (secure-by-default)', (done) => {
        corsOptions.origin(null, (error, allowed) => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain('CORS policy violation');
          expect(allowed).toBeUndefined();
          done();
        });
      });

      it('should sanitize origin in error messages', (done) => {
        const maliciousOrigin = 'https://evil.com<script>alert(1)</script>';
        corsOptions.origin(maliciousOrigin, (error, allowed) => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).not.toContain('<script>');
          expect(error.message).not.toContain('alert(1)');
          done();
        });
      });
    });
  });

  describe('Performance Characteristics', () => {
    let testOrigin;

    beforeEach(() => {
      const corsModule = require('#configs/cors.js');
      testOrigin = corsModule.testOrigin;
    });

    it('should handle large numbers of validation requests efficiently', () => {
      const startTime = process.hrtime.bigint();
      
      // Test 1000 origin validations
      for (let i = 0; i < 1000; i++) {
        testOrigin('https://pullstream.com');
        testOrigin('https://evil.com');
        testOrigin('https://sandbox.pullstream.com');
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      
      // Should complete 3000 validations in under 100ms (performance baseline)
      expect(duration).toBeLessThan(100);
    });

    it('should have O(1) lookup performance for direct hosts', () => {
      // Direct host lookups should be very fast (Set.has() is O(1))
      const iterations = 10000;
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        testOrigin('https://pullstream.com');
      }
      
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000;
      
      // 10000 iterations should complete in under 50ms
      expect(duration).toBeLessThan(50);
    });
  });

  describe('Integration with Express CORS', () => {
    it('should be compatible with express cors middleware', () => {
      const cors = require('cors');
      const { corsOptions } = require('#configs/cors.js');
      
      expect(() => {
        const corsMiddleware = cors(corsOptions);
        expect(corsMiddleware).toBeInstanceOf(Function);
      }).not.toThrow();
    });
  });

  describe('Comprehensive Domain Testing', () => {
    let testOrigin;

    beforeEach(() => {
      const corsModule = require('#configs/cors.js');
      testOrigin = corsModule.testOrigin;
    });

    it('should allow all specified hosts with https', () => {
      const allHosts = [
        'finance-equation.co.uk',
        'mathfinancialgroup.com',
        'innovative.org.za', 
        'amantherapy.com',
        'pullstream.com',
        'evchargingsolutions.co.uk',
        'mazards.com',
        'dastrum.com',
        'inosanctum.com',
        'supersymmetrysoftware.com',
        'phtang.com',
        'growthiq.co',
        'lolagrange.com',
        'pst.bz',
        'gressmann.gallery',
        'gressmanngallery.com',
        'mondonovis.ae'
      ];

      allHosts.forEach(host => {
        expect(testOrigin(`https://${host}`)).toBe(true);
        expect(testOrigin(`https://www.${host}`)).toBe(true);
      });
    });

    it('should allow all specified subdomains with all hosts', () => {
      const allSubdomains = [
        'sandbox',
        'staging',
        'sandbox.me',
        'me.staging', 
        'me',
        'sandbox.me-v2',
        'me-v2.staging',
        'me-v2',
        'sandbox.cms',
        'cms.staging',
        'cms',
        'sandbox.chat',
        'chat.staging',
        'chat',
        'sandbox.lms',
        'lms.staging',
        'lms'
      ];

      const sampleHosts = ['pullstream.com', 'mazards.com', 'dastrum.com', 'pst.bz'];

      allSubdomains.forEach(subdomain => {
        sampleHosts.forEach(host => {
          expect(testOrigin(`https://${subdomain}.${host}`)).toBe(true);
          expect(testOrigin(`https://www.${subdomain}.${host}`)).toBe(true);
        });
      });
    });

    it('should validate complex multi-level subdomains', () => {
      // Test the complex subdomains like 'sandbox.me', 'me.staging', 'sandbox.me-v2'
      const complexSubdomains = [
        'sandbox.me',
        'me.staging',
        'sandbox.me-v2',
        'me-v2.staging',
        'sandbox.cms',
        'cms.staging',
        'sandbox.chat',
        'chat.staging',
        'sandbox.lms',
        'lms.staging'
      ];

      complexSubdomains.forEach(subdomain => {
        expect(testOrigin(`https://${subdomain}.pullstream.com`)).toBe(true);
        expect(testOrigin(`https://www.${subdomain}.pullstream.com`)).toBe(true);
      });
    });
  });
});