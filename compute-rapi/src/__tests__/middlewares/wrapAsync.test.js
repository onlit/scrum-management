const wrapAsync = require('#middlewares/wrapAsync.js');

describe('wrapAsync middleware', () => {
  // This test verifies that `wrapAsync` correctly invokes the async handler with the expected arguments (request, response, and next function).
  it('calls the async handler correctly', async () => {
    // Mock objects and functions to simulate Express.js request, response, and next.
    const mockReq = {};
    const mockRes = {};
    const next = jest.fn();
    // Mock handler function that resolves, simulating successful async operation.
    const handler = jest.fn().mockResolvedValue('handler called');

    // Wraps the handler with `wrapAsync`, creating a new function.
    const wrappedHandler = wrapAsync(handler);

    // Calls the wrapped handler with mocked request, response, and next.
    await wrappedHandler(mockReq, mockRes, next);

    // Verifies that the original handler was called with the correct arguments.
    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, next);
    // Ensures that `next` was not called, indicating no errors occurred.
    expect(next).not.toHaveBeenCalled();
  });

  // This test ensures that `wrapAsync` forwards any errors from the async handler to the next middleware.
  // Note: wrapAsync now uses wrapExpressAsync which wraps errors with standardized error handling.
  it('forwards errors to the next middleware', async () => {
    // Mock error to be thrown by the handler.
    const mockError = new Error('Test error');
    // Mock request, response, and next function.
    const mockReq = {};
    const mockRes = {};
    const next = jest.fn();
    // Mock handler function that rejects, simulating an async operation that fails.
    const handler = jest.fn().mockRejectedValue(mockError);

    // Wrap the handler function.
    const wrappedHandler = wrapAsync(handler);

    // Invoke the wrapped handler.
    await wrappedHandler(mockReq, mockRes, next);

    // Verify the handler was called.
    expect(handler).toHaveBeenCalledWith(mockReq, mockRes, next);
    // Check that `next` was called with a standardized error (wraps original with "Route handler failed")
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('Route handler failed');
  });

  // Tests `wrapAsync`'s ability to handle functions that perform asynchronous operations without throwing errors.
  it('works with asynchronous handlers', async () => {
    // Mock request, response, and next function.
    const mockReq = {};
    const mockRes = {};
    const next = jest.fn();
    // Mock asynchronous handler that simulates a delayed operation.
    const handler = jest.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // Wraps the asynchronous handler.
    const wrappedHandler = wrapAsync(handler);

    // Executes the wrapped handler.
    await wrappedHandler(mockReq, mockRes, next);

    // Verifies the handler was indeed called.
    expect(handler).toHaveBeenCalled();
    // Ensures that no error was forwarded to `next`, indicating the async operation completed without issue.
    expect(next).not.toHaveBeenCalled();
  });
});
