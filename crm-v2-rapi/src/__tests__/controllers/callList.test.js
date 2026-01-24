/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines unit tests for all CRUD controllers
 *
 *
 */

// Import the Prisma client configured in the project for database operations
const prisma = require('#configs/prisma.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
// Import the createCallList function from the controller to be tested
const {
  createCallList,
  getAllCallLists,
  getCallList,
  updateCallList,
  deleteCallList,
} = require('#controllers/callList.controller.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');

// Mock the Prisma client's callList model to prevent actual database operations during testing
jest.mock('#configs/prisma.js', () => ({
  callList: {
    create: jest.fn().mockResolvedValue({}), // Mock the create function to always return a resolved promise
    findFirst: jest.fn(), // Mock the findFirst function
    update: jest.fn(), // Mock the update function
    deleteMany: jest.fn(), // Mock the deleteMany function
  },
}));

// This mock replaces the `lodash` module with a custom implementation for testing purposes.
jest.mock('lodash', () => ({
  // Specifically, it mocks the `camelCase` function to simply return the key it receives.
  // This simplification is useful for tests that rely on `camelCase` behavior but do not need its full implementation.
  camelCase: jest.fn().mockImplementation((key) => key),
}));

// Mocks a custom module located at `#utils/shared/visibilityUtils.js`.
jest.mock('#utils/shared/visibilityUtils.js', () => ({
  // `getVisibilityFilters` and `buildCreateRecordPayload` are utility functions being mocked.
  // The mock implementations are left undefined, meaning they will need to be specified in each test.
  getVisibilityFilters: jest.fn(),
  buildCreateRecordPayload: jest.fn(),
}));

// Mocks another custom module for general utilities.
jest.mock('#utils/shared/generalUtils.js', () => ({
  // Mocks `createError` to return an Error object with a custom `status` property.
  // This is useful for simulating API errors in a controlled test environment.
  createError: jest.fn().mockImplementation(({ status, message }) => {
    const error = new Error(message);
    error.status = status;
    return error;
  }),
  // Mocks `objectKeysToCamelCase` to simply return the object it receives.
  // This is a simplification for tests that depend on this function but do not require its transformation logic.
  objectKeysToCamelCase: jest.fn().mockImplementation((object) => object),
}));

// Mocks a module responsible for database utilities.
jest.mock('#utils/shared/databaseUtils.js', () => ({
  // Mocks `getPaginatedList`, a function presumably used for fetching lists of records with pagination.
  // The mock implementation is not defined here, allowing it to be configured within individual tests.
  getPaginatedList: jest.fn(),
}));

// Define a test suite for the createCallList functionality
describe('createCallList', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test case: successfully creating a callList
  it('should successfully create a callList and return status 201 with the created object', async () => {
    // Define mock data for the callList to be created
    const mockCallListData = {
      name: 'Test CallList',
      version: '1.0.0',
    };

    // Mock the HTTP request and response objects for the test
    const req = {
      user: {
        isAuthenticated: true, // Simulate an authenticated user
      },
      body: mockCallListData, // Body contains the mock callList data
    };
    const res = {
      status: jest.fn().mockReturnThis(), // Mock the status method to allow chaining
      json: jest.fn(), // Mock the json method to assert its call later
    };
    const next = jest.fn(); // Mock the next function for error handling

    // Mock the Prisma create method to return the mock callList data
    prisma.callList.create.mockResolvedValue(mockCallListData);

    // Execute the createCallList function with the mocked request and response
    await createCallList(req, res, next);

    // Assert that the callList was created successfully
    expect(res.status).toHaveBeenCalledWith(201); // Check if response status was set to 201
    expect(res.json).toHaveBeenCalledWith(mockCallListData); // Check if the created callList data was returned in the response
    expect(next).not.toHaveBeenCalled(); // Ensure that the next function was not called, indicating no errors
  });

  // Test case: validation failure
  it('throws an error if validation fails', async () => {
    // Define invalid callList data to simulate a validation failure
    const invalidCallListData = {
      name: '', // Invalid because it's required and cannot be empty
      version: 'invalid-version', // Invalid because it does not match semantic versioning
    };

    // Mock the HTTP request object with invalid data and a simulated authenticated user
    const req = {
      user: {
        isAuthenticated: true,
      },
      body: invalidCallListData,
    };
    const res = {}; // Mock response object not used in this test
    const next = jest.fn(); // Mock the next function to capture errors

    // Execute the createCallList function and expect it to throw an error due to validation failure
    await expect(createCallList(req, res, next)).rejects.toThrow();
  });

  // Test case: database operation failure
  it('throws an error if the database operation fails', async () => {
    // Simulate a database operation failure by mocking the Prisma create method to reject
    prisma.callList.create.mockRejectedValue(new Error('Database error'));

    // Mock the HTTP request object with valid data and a simulated authenticated user
    const req = {
      user: {
        isAuthenticated: true,
      },
      body: {
        name: 'Test CallList',
        version: '1.0.0',
      },
    };
    const res = {}; // Mock response object not directly involved in this test
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Execute the createCallList function and expect it to throw an error due to database operation failure
    await expect(createCallList(req, res, next)).rejects.toThrow(
      'Database error', // Assert that the specific error thrown matches the simulated database error
    );
  });
});

// Defines a test suite for the `getAllCallLists` function.
describe('getAllCallLists', () => {
  // `beforeEach` is a Jest lifecycle hook that runs before each test case in this block.
  // It's used to reset the testing environment to a clean state before each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a test case that verifies the successful retrieval of callLists.
  it('successfully retrieves callLists', async () => {
    // Mock request object with parameters and user details.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: { isAuthenticated: true },
    };
    // Mock response object with `status` and `json` methods, chaining `status` to return `this`.
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Mock response data representing what the `getPaginatedList` function should return
    // when it successfully fetches callLists from the database.
    const mockResponseData = {
      totalCount: 1,
      pageCount: 1,
      currentPage: 1,
      perPage: 10,
      results: [
        {
          id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
          name: 'CallList One',
          description: 'Description for CallList One',
          tags: 'tag1, tag2',
        },
      ],
    };

    // Mock the `getPaginatedList` function to resolve with `mockResponseData`,
    // simulating a successful fetch operation.
    getPaginatedList.mockResolvedValue(mockResponseData);

    // Invoke the `getAllCallLists` function with the mocked request and response objects.
    await getAllCallLists(req, res, next);

    // Verify that the response status is set to 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify that the response body is set to the mock response data.
    expect(res.json).toHaveBeenCalledWith(mockResponseData);
  });
});

// Describe block defines a test suite for the `getCallList` function.
describe('getCallList', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // First test case: it checks if the function successfully retrieves a callList
  // and returns the correct HTTP status and data.
  it('should successfully retrieve a callList and return status 200 with the callList data', async () => {
    // Mock data representing a callList returned from the database.
    const mockCallListData = {
      id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
      name: 'Test CallList',
      version: '1.0.0',
    };

    // Mock the Prisma call to find the first callList that matches criteria.
    // It's resolved with `mockCallListData`.
    prisma.callList.findFirst.mockResolvedValue(mockCallListData);
    // Mock a function that determines visibility filters, assuming no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with parameters and user details.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: { isAuthenticated: true },
    };
    // Mock response object with `status` and `json` methods, chaining `status` to return `this`.
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Call the function under test with mock request, response, and next.
    await getCallList(req, res, next);

    // Assert the response status was called with 200.
    expect(res.status).toHaveBeenCalledWith(200);
    // Assert the response body is the mock callList data.
    expect(res.json).toHaveBeenCalledWith(mockCallListData);
  });

  // Second test case: it checks the behavior when a callList is not found.
  // The expected behavior is to throw an error, indicating the callList is not found.
  it('should return a 404 error if the callList is not found', async () => {
    // Mock the Prisma call to return null, simulating not finding the callList.
    prisma.callList.findFirst.mockResolvedValue(null);
    // Again, mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with a non-existent callList ID.
    const req = { params: { id: 'nonexistent-id' }, user: {} };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with a specific error message.
    await expect(getCallList(req, res, next)).rejects.toThrow(
      'CallList not found',
    );
  });

  // Third test case: it checks the behavior when a database operation fails.
  // The expected behavior is to throw a database error.
  it('throws an error if the database operation fails', async () => {
    // Mock the Prisma call to reject with an error, simulating a database error.
    prisma.callList.findFirst.mockRejectedValue(new Error('Database error'));
    // Mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with any callList ID.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: {},
    };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with a specific database error.
    await expect(getCallList(req, res, next)).rejects.toThrow('Database error');
  });
});

describe('updateCallList', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // This test verifies that the `updateCallList` function can successfully update a callList
  // in the database and return the updated callList data with a 200 HTTP status code.
  it('should successfully update a callList and return status 200 with the updated callList data', async () => {
    // Mock data for the test, including the callList ID and request body.
    const mockParamsId = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    const mockRequestBody = { name: 'Updated CallList', version: '2.0.0' };
    // The expected result after updating the callList.
    const mockUpdatedCallList = { ...mockRequestBody, id: mockParamsId };

    // Mock the Prisma update operation to resolve with the updated callList data.
    prisma.callList.update.mockResolvedValue(mockUpdatedCallList);

    // Mock request and response objects, mimicking Express.js behavior.
    const req = {
      params: { id: mockParamsId },
      body: mockRequestBody,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    // Mock the `next` function for error handling.
    const next = jest.fn();

    // Invoke the function under test with the mocked request and response.
    await updateCallList(req, res, next);

    // Assert that the response status and body are correct.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockUpdatedCallList);
    // Verify that the Prisma update method was called with the correct parameters.
    expect(prisma.callList.update).toHaveBeenCalledWith({
      where: { id: mockParamsId },
      data: mockRequestBody,
    });
  });

  // This test ensures that the `updateCallList` function correctly handles and throws errors
  // when the database operation fails.
  it('throws an error if the database operation fails', async () => {
    // Mock an error that would be thrown by the Prisma update operation.
    const databaseError = new Error('Database error');
    prisma.callList.update.mockRejectedValue(databaseError);

    // Mock the request object with valid parameters and body.
    const req = {
      params: { id: '2454006f-fb48-4b56-b70b-48f92596fe4f' },
      body: { name: 'Valid Name', version: '1.0.1' },
    };
    // Mock the `next` function for error handling.
    const next = jest.fn();

    // Assert that invoking the function under test with a failing database operation
    // results in the expected error being thrown.
    await expect(updateCallList(req, {}, next)).rejects.toThrow(
      'Database error',
    );
  });

  // This test checks that the `updateCallList` function transforms the keys of the request body
  // from snake_case to camelCase before updating the database.
  it('transforms request body keys to camelCase before updating', async () => {
    // Mock request data with snake_case keys.
    const id = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    const requestBody = {
      everyone_can_see_it: false,
      everyone_in_object_company_can_see_it: true,
    };
    // The expected format of the request body after transformation to camelCase.
    const transformedRequestBody = {
      everyoneCanSeeIt: false,
      everyoneInObjectCompanyCanSeeIt: true,
    };

    // Mock a utility function that converts object keys to camelCase, to return the transformed request body.
    objectKeysToCamelCase.mockReturnValue(transformedRequestBody);

    // Mock the Prisma update operation to resolve with the updated callList data, including transformed keys.
    prisma.callList.update.mockResolvedValue({
      id,
      ...transformedRequestBody,
    });

    // Mock request and response objects.
    const req = {
      params: { id },
      body: requestBody,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Invoke the function under test.
    await updateCallList(req, res);

    // Verify that the keys transformation utility function was called with the original request body.
    expect(objectKeysToCamelCase).toHaveBeenCalledWith(requestBody);
    // Assert that the Prisma update method was called with the correctly transformed request data.
    expect(prisma.callList.update).toHaveBeenCalledWith({
      where: { id },
      data: transformedRequestBody,
    });
  });
});

// This describes a test suite for the `deleteCallList` function.
describe('deleteCallList', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a single test case within the suite.
  it('should successfully delete a callList and return status 200 with the deleted ID', async () => {
    // Mock ID of the callList to be deleted.
    const mockId = '5610eb16-c1dd-4be0-b940-76d1b6a8dd2c';
    // Mock ID representing the creator of the callList, used for authorization.
    const createdBy = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    // Mocks the behavior of Prisma's `deleteMany` method to simulate successful deletion.
    // The method is expected to return an object with a count of deleted records.
    prisma.callList.deleteMany.mockResolvedValue({ count: 1 });
    // Mocks a helper function that determines visibility filters based on the user,
    // in this case, filtering by the creator's ID.
    getVisibilityFilters.mockReturnValue({ createdBy });

    // Mocks the HTTP request object, including the callList ID to delete and user authentication status.
    const req = {
      params: { id: mockId },
      user: { isAuthenticated: true },
    };
    // Mocks the HTTP response object, including methods for setting the response status and JSON body.
    const res = {
      status: jest.fn().mockReturnThis(), // Allows chaining of the `json` method after `status`.
      json: jest.fn(),
    };
    // Mocks the `next` function used for error handling in Express middleware.
    const next = jest.fn();

    // Calls the function under test with the mocked request and response objects.
    await deleteCallList(req, res, next);

    // Verifies that the response status method was called with 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verifies that the response JSON method was called with the expected object,
    // containing the ID of the deleted callList.
    expect(res.json).toHaveBeenCalledWith({ deleted: mockId });
    // Verifies that the `deleteMany` method of Prisma was called with the correct arguments,
    // including the ID of the callList to delete and the creator's ID for authorization.
    expect(prisma.callList.deleteMany).toHaveBeenCalledWith({
      where: { id: mockId, createdBy },
    });
  });
});
