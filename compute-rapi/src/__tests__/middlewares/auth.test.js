const axios = require('axios');
const auth = require('#middlewares/auth.js');
const { createError } = require('#utils/shared/generalUtils.js');

jest.mock('axios');
jest.mock('#utils/shared/generalUtils.js', () => ({
  createError: jest.fn(
    (errorInfo) => new Error(`${errorInfo.status}: ${errorInfo.message}`)
  ),
  isRequestInternal: jest.fn(() => false),
}));

describe('auth middleware', () => {
  // This test verifies that if no authentication token is provided in the request, the middleware
  // sets the user as not authenticated and allows the request to proceed without interruption.
  it('sets user as not authenticated if no token provided', async () => {
    // Mocks the request object. The `header` method is mocked to return `undefined`,
    // simulating the absence of an authentication token in the request headers.
    const req = {
      header: jest.fn().mockReturnValue(undefined),
      headers: {},
    };
    const res = {};
    // Mocks the `next` function, which Express middleware use to pass control to the next middleware.
    const next = jest.fn();

    // Executes the authentication middleware with the mocked request, response, and next function.
    await auth(req, res, next);

    // Asserts that the `user` object is attached to the request object, marking the user as not authenticated.
    expect(req.user).toEqual({ isAuthenticated: false, internalRequest: false });
    // Asserts that the middleware calls the `next` function without any arguments, indicating no errors.
    expect(next).toHaveBeenCalledWith();
  });

  // This test checks that the middleware successfully authenticates the user when a valid token is provided.
  it('successfully authenticates the user and sets req.user', async () => {
    // Mock user data as it would be returned from an external authentication service.
    const mockUserData = {
      id: '123',
      username: 'testuser',
      // Additional user details are mocked for completeness.
    };
    // Mocks axios (or a similar HTTP client) to simulate a successful response from the authentication service.
    axios.get.mockResolvedValue({ data: mockUserData });

    // Mocks the request object with an authorization header containing a bearer token.
    const req = {
      header: jest.fn().mockReturnValue(undefined),
      headers: {
        authorization: 'Bearer token',
      },
    };
    const res = {};
    // Mocks the `next` function.
    const next = jest.fn();

    // Executes the authentication middleware.
    await auth(req, res, next);

    // Asserts that the user is successfully authenticated and the relevant user details are attached to the request object.
    expect(req.user).toMatchObject({
      id: mockUserData.id,
      username: mockUserData.username,
      isAuthenticated: true,
    });
    // Asserts that the middleware progresses to the next in the chain without error.
    expect(next).toHaveBeenCalledWith();
  });

  // This test ensures that the middleware correctly handles errors from the external authentication service.
  it('handles external service errors and calls next with an error', async () => {
    // Mocks axios to simulate an error response from the authentication service.
    axios.get.mockRejectedValue(new Error('Service Unavailable'));

    // Mocks the request object with an authorization header.
    const req = {
      header: jest.fn().mockReturnValue(undefined),
      headers: {
        authorization: 'Bearer token',
      },
    };
    const res = {};
    // Mocks the `next` function.
    const next = jest.fn();

    // Executes the authentication middleware.
    await auth(req, res, next);

    // Asserts that the `createError` function is called with a 401 status and an appropriate error message.
    expect(createError).toHaveBeenCalledWith({
      status: 401,
      message: 'Invalid authentication token. Please provide a valid token.',
    });
    // Asserts that the middleware forwards an error to the next middleware in the chain.
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
