/**
 * CREATED BY: Kiro AI
 * CREATION DATE: 21/07/2025
 *
 * DESCRIPTION:
 * ------------------
 * Tests for the traceId middleware that adds a unique trace identifier
 * to each request for tracking and correlation purposes.
 */

const { validate: validateUUID } = require('uuid');
const traceId = require('#middlewares/traceId.js');

describe('traceId middleware', () => {
  it('should add a valid UUID v4 traceId to the request object', () => {
    // Mock request and response objects
    const req = {};
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    // Call the middleware
    traceId(req, res, next);

    // Check that a traceId was added to the request
    expect(req.traceId).toBeDefined();

    // Verify the traceId is a valid UUID v4
    expect(validateUUID(req.traceId)).toBe(true);

    // Verify the traceId was added to response headers
    expect(res.setHeader).toHaveBeenCalledWith('X-Trace-ID', req.traceId);

    // Verify next was called
    expect(next).toHaveBeenCalled();
  });

  it('should generate unique traceIds for different requests', () => {
    // Mock request and response objects for two different requests
    const req1 = {};
    const res1 = { setHeader: jest.fn() };
    const next1 = jest.fn();

    const req2 = {};
    const res2 = { setHeader: jest.fn() };
    const next2 = jest.fn();

    // Call the middleware for both requests
    traceId(req1, res1, next1);
    traceId(req2, res2, next2);

    // Verify that different traceIds were generated
    expect(req1.traceId).not.toEqual(req2.traceId);
  });
});
