/**
 * Tests for Domain Exception Types
 *
 * Standardized error types for business logic exceptions.
 */

const {
  DomainException,
  createDomainError,
  isDomainException,
  ERROR_TYPES,
  STATUS_CODES,
} = require('../../../computeConstructors/api/core/exceptions/domain.exception.template.js');

describe('Domain Exception', () => {
  describe('ERROR_TYPES', () => {
    it('should define standard error types', () => {
      expect(ERROR_TYPES.VALIDATION).toBe('VALIDATION');
      expect(ERROR_TYPES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_TYPES.CONFLICT).toBe('CONFLICT');
      expect(ERROR_TYPES.AUTHORIZATION).toBe('AUTHORIZATION');
      expect(ERROR_TYPES.AUTHENTICATION).toBe('AUTHENTICATION');
      expect(ERROR_TYPES.BUSINESS_RULE).toBe('BUSINESS_RULE');
      expect(ERROR_TYPES.DEPENDENCY).toBe('DEPENDENCY');
      expect(ERROR_TYPES.INTERNAL).toBe('INTERNAL');
    });
  });

  describe('STATUS_CODES', () => {
    it('should map error types to HTTP status codes', () => {
      expect(STATUS_CODES[ERROR_TYPES.VALIDATION]).toBe(422);
      expect(STATUS_CODES[ERROR_TYPES.NOT_FOUND]).toBe(404);
      expect(STATUS_CODES[ERROR_TYPES.CONFLICT]).toBe(409);
      expect(STATUS_CODES[ERROR_TYPES.AUTHORIZATION]).toBe(403);
      expect(STATUS_CODES[ERROR_TYPES.AUTHENTICATION]).toBe(401);
      expect(STATUS_CODES[ERROR_TYPES.BUSINESS_RULE]).toBe(422);
      expect(STATUS_CODES[ERROR_TYPES.DEPENDENCY]).toBe(424);
      expect(STATUS_CODES[ERROR_TYPES.INTERNAL]).toBe(500);
    });
  });

  describe('DomainException', () => {
    it('should create exception with type, message, and details', () => {
      const error = new DomainException(
        ERROR_TYPES.VALIDATION,
        'Email is invalid',
        { field: 'email' }
      );

      expect(error.type).toBe('VALIDATION');
      expect(error.message).toBe('Email is invalid');
      expect(error.details).toEqual({ field: 'email' });
      expect(error.statusCode).toBe(422);
    });

    it('should be instance of Error', () => {
      const error = new DomainException(ERROR_TYPES.NOT_FOUND, 'Not found');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DomainException');
    });

    it('should include timestamp', () => {
      const before = new Date().toISOString();
      const error = new DomainException(ERROR_TYPES.INTERNAL, 'Error');
      const after = new Date().toISOString();

      expect(error.timestamp).toBeDefined();
      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });

    it('should map error types to correct HTTP status codes', () => {
      expect(
        new DomainException(ERROR_TYPES.VALIDATION, '').statusCode
      ).toBe(422);
      expect(
        new DomainException(ERROR_TYPES.NOT_FOUND, '').statusCode
      ).toBe(404);
      expect(
        new DomainException(ERROR_TYPES.CONFLICT, '').statusCode
      ).toBe(409);
      expect(
        new DomainException(ERROR_TYPES.AUTHORIZATION, '').statusCode
      ).toBe(403);
      expect(
        new DomainException(ERROR_TYPES.AUTHENTICATION, '').statusCode
      ).toBe(401);
      expect(
        new DomainException(ERROR_TYPES.BUSINESS_RULE, '').statusCode
      ).toBe(422);
    });

    it('should default to 500 for unknown error types', () => {
      const error = new DomainException('UNKNOWN_TYPE', 'Unknown');
      expect(error.statusCode).toBe(500);
    });

    it('should have toJSON method for API responses', () => {
      const error = new DomainException(
        ERROR_TYPES.VALIDATION,
        'Invalid email',
        { field: 'email' }
      );

      const json = error.toJSON();

      expect(json.success).toBe(false);
      expect(json.error.type).toBe('VALIDATION');
      expect(json.error.message).toBe('Invalid email');
      expect(json.error.details).toEqual({ field: 'email' });
      expect(json.error.timestamp).toBeDefined();
    });

    it('should capture stack trace', () => {
      const error = new DomainException(ERROR_TYPES.INTERNAL, 'Error');
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('DomainException');
    });
  });

  describe('createDomainError', () => {
    it('should be shorthand for new DomainException', () => {
      const error = createDomainError(ERROR_TYPES.VALIDATION, 'Invalid', {
        x: 1,
      });

      expect(error).toBeInstanceOf(DomainException);
      expect(error.type).toBe('VALIDATION');
      expect(error.message).toBe('Invalid');
      expect(error.details).toEqual({ x: 1 });
    });

    it('should work without details', () => {
      const error = createDomainError(ERROR_TYPES.NOT_FOUND, 'Not found');

      expect(error).toBeInstanceOf(DomainException);
      expect(error.details).toEqual({});
    });
  });

  describe('isDomainException', () => {
    it('should return true for DomainException', () => {
      const error = new DomainException(ERROR_TYPES.VALIDATION, 'Error');
      expect(isDomainException(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');
      expect(isDomainException(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isDomainException({})).toBe(false);
      expect(isDomainException(null)).toBe(false);
      expect(isDomainException('string')).toBe(false);
    });
  });
});
