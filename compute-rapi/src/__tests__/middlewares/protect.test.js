// Import the middleware function to be tested
const protect = require('#middlewares/protect.js');
const { createError } = require('#utils/shared/generalUtils.js');

jest.mock('#utils/shared/generalUtils.js', () => ({
  createError: jest.fn(
    ({ status, message }) => new Error(`${status}: ${message}`)
  ),
}));

describe('protect middleware', () => {
  // Tests the middleware's behavior when the user is authenticated.
  it('should call next() without error when user is authenticated', async () => {
    // Mocks a request object with `user.isAuthenticated` set to true, simulating an authenticated request.
    const mockReq = { user: { isAuthenticated: true } };
    // Mock response object (unused in this test but necessary for middleware signature).
    const mockRes = {};
    // Mocks the `next` function to track its calls.
    const next = jest.fn();

    // Executes the middleware with the mocked request, response, and next function.
    await protect(mockReq, mockRes, next);

    // Asserts that `next` was called without any arguments, indicating no errors occurred.
    expect(next).toHaveBeenCalledWith();
    // Asserts that the `createError` function was not called, as no error should be generated for authenticated requests.
    expect(createError).not.toHaveBeenCalled();
  });

  // Tests the middleware's response when the user is not authenticated.
  it('should call next() with an error when user is not authenticated', async () => {
    // Mocks a request object with `user.isAuthenticated` set to false, simulating an unauthenticated request.
    const mockReq = { user: { isAuthenticated: false } };
    // Mock response object.
    const mockRes = {};
    // Mocks the `next` function.
    const next = jest.fn();

    // Executes the middleware.
    await protect(mockReq, mockRes, next);

    // Checks that `next` was called at least once.
    expect(next).toHaveBeenCalled();
    // Asserts that the `createError` function was called with specific error details.
    expect(createError).toHaveBeenCalledWith({
      status: 401, // HTTP status code for unauthorized access.
      message: 'Authentication required. Please provide a valid token.',
    });

    // Retrieves the error object passed to `next` to verify its properties.
    const errorPassedToNext = next.mock.calls[0][0];
    // Asserts that the error passed to `next` is an instance of Error.
    expect(errorPassedToNext).toBeInstanceOf(Error);
    // Checks that the error message contains the expected text, indicating the correct error was passed.
    expect(errorPassedToNext.message).toContain(
      '401: Authentication required. Please provide a valid token.'
    );
  });
});
