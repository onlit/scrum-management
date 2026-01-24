/**
 * CREATED BY: Kiro AI
 * CREATION DATE: 21/07/2025
 *
 * DESCRIPTION:
 * ------------------
 * Tests for the errorHandler middleware that formats and returns error responses
 * according to the API error handling standards.
 */

const errorHandler = require('#middlewares/errorHandler.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');

jest.mock('#configs/constants.js', () => ({
  DEV_ENV_NAME: 'development',
  ERROR_TYPES: {
    INTERNAL: 'internal',
    VALIDATION: 'validation',
  },
  ERROR_SEVERITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  },
  ERROR_MESSAGES: {
    internal: 'Internal server error',
    validation: 'Validation failed',
  },
  STATUS_CODES: {
    internal: 500,
    validation: 422,
  },
}));

jest.mock('#utils/shared/loggingUtils.js', () => ({
  logEvent: jest.fn(),
}));

describe('errorHandler middleware', () => {
  // Tests how the middleware handles a general error
  it('responds with 500 and the standard error format for a general error', () => {
    // Creates a new general error for testing
    const error = new Error('General error');
    const req = { traceId: '123e4567-e89b-12d3-a456-426614174000' };
    const next = jest.fn();
    // Mocks the response object to simulate Express.js behavior
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    // Executes the error handler with the simulated error and mocks
    errorHandler(error, req, res, next);

    // Verifies that the response status is set to 500 (Internal Server Error)
    expect(res.status).toHaveBeenCalledWith(500);

    // Verifies that the response body follows the standard error format
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        status: 500,
        title: 'Internal Server Error',
        code: ERROR_TYPES.INTERNAL,
        detail: 'General error',
      })
    );

    // Verifies that an event logging function was called
    expect(logEvent).toHaveBeenCalled();
  });

  // Verifies that error messages from Prisma are sanitized in a production environment
  it('sanitizes Prisma error messages outside of the development environment', () => {
    // Sets the environment to production to test error sanitization
    process.env.NODE_ENV = 'production';

    // Creates a Prisma error with a specific code for testing
    const error = new Error('prisma error');
    error.code = 'P001';

    // Mocks request with traceId and next function
    const req = { traceId: '123e4567-e89b-12d3-a456-426614174000' };
    const next = jest.fn();

    // Mocks the response object
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    // Executes the error handler
    errorHandler(error, req, res, next);

    // Verifies the response status is 500
    expect(res.status).toHaveBeenCalledWith(500);

    // Checks that the error message has been sanitized for production
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        detail: expect.stringContaining('Database operation failed'),
      })
    );

    // Reset environment for other tests
    process.env.NODE_ENV = 'development';
  });

  // Tests how the middleware handles validation errors from Joi
  it('handles Joi validation errors correctly with the standard format', () => {
    // Creates a mock Joi error object with details about failed validations
    const error = {
      isJoi: true,
      details: [
        {
          message: 'Field X is required.',
          context: { key: 'fieldX', value: null },
        },
        {
          message: 'Field Y is invalid.',
          context: { key: 'fieldY', value: 'invalid' },
        },
      ],
    };

    // Mocks request with traceId and next function
    const req = { traceId: '123e4567-e89b-12d3-a456-426614174000' };
    const next = jest.fn();

    // Mocks the response object
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    // Executes the error handler
    errorHandler(error, req, res, next);

    // Verifies the response status is 422 (Unprocessable Entity)
    expect(res.status).toHaveBeenCalledWith(422);

    // Checks that the response body follows the standard validation error format
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: '123e4567-e89b-12d3-a456-426614174000',
        status: 422,
        title: 'Validation Failed',
        code: ERROR_TYPES.VALIDATION,
        detail: 'One or more fields did not pass validation.',
        errors: expect.arrayContaining([
          expect.objectContaining({
            field: 'fieldX',
            message: 'Field X is required.',
            value: null,
          }),
          expect.objectContaining({
            field: 'fieldY',
            message: 'Field Y is invalid.',
            value: 'invalid',
          }),
        ]),
      })
    );
  });

  // Tests that the traceId is included in the response
  it('includes the traceId in the error response', () => {
    const error = new Error('Test error');
    const traceId = '123e4567-e89b-12d3-a456-426614174000';
    const req = { traceId };
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId,
      })
    );
  });

  // Tests that a default traceId is used if none is provided
  it('uses a default traceId if none is provided in the request', () => {
    const error = new Error('Test error');
    const req = {}; // No traceId
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'unknown-trace-id',
      })
    );
  });
});
