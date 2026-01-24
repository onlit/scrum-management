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
// Import the createOpportunityHistory function from the controller to be tested
const {
  createOpportunityHistory,
  getAllOpportunityHistorys,
  getOpportunityHistory,
  updateOpportunityHistory,
  deleteOpportunityHistory,
} = require('#controllers/opportunityHistory.controller.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');

// Mock the Prisma client's opportunityHistory model to prevent actual database operations during testing
jest.mock('#configs/prisma.js', () => ({
  opportunityHistory: {
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

// Define a test suite for the createOpportunityHistory functionality
describe('createOpportunityHistory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test case: successfully creating a opportunityHistory
  it('should successfully create a opportunityHistory and return status 201 with the created object', async () => {
    // Define mock data for the opportunityHistory to be created
    const mockOpportunityHistoryData = {
      name: 'Test OpportunityHistory',
      version: '1.0.0',
    };

    // Mock the HTTP request and response objects for the test
    const req = {
      user: {
        isAuthenticated: true, // Simulate an authenticated user
      },
      body: mockOpportunityHistoryData, // Body contains the mock opportunityHistory data
    };
    const res = {
      status: jest.fn().mockReturnThis(), // Mock the status method to allow chaining
      json: jest.fn(), // Mock the json method to assert its call later
    };
    const next = jest.fn(); // Mock the next function for error handling

    // Mock the Prisma create method to return the mock opportunityHistory data
    prisma.opportunityHistory.create.mockResolvedValue(
      mockOpportunityHistoryData,
    );

    // Execute the createOpportunityHistory function with the mocked request and response
    await createOpportunityHistory(req, res, next);

    // Assert that the opportunityHistory was created successfully
    expect(res.status).toHaveBeenCalledWith(201); // Check if response status was set to 201
    expect(res.json).toHaveBeenCalledWith(mockOpportunityHistoryData); // Check if the created opportunityHistory data was returned in the response
    expect(next).not.toHaveBeenCalled(); // Ensure that the next function was not called, indicating no errors
  });

  // Test case: validation failure
  it('throws an error if validation fails', async () => {
    // Define invalid opportunityHistory data to simulate a validation failure
    const invalidOpportunityHistoryData = {
      name: '', // Invalid because it's required and cannot be empty
      version: 'invalid-version', // Invalid because it does not match semantic versioning
    };

    // Mock the HTTP request object with invalid data and a simulated authenticated user
    const req = {
      user: {
        isAuthenticated: true,
      },
      body: invalidOpportunityHistoryData,
    };
    const res = {}; // Mock response object not used in this test
    const next = jest.fn(); // Mock the next function to capture errors

    // Execute the createOpportunityHistory function and expect it to throw an error due to validation failure
    await expect(createOpportunityHistory(req, res, next)).rejects.toThrow();
  });

  // Test case: database operation failure
  it('throws an error if the database operation fails', async () => {
    // Simulate a database operation failure by mocking the Prisma create method to reject
    prisma.opportunityHistory.create.mockRejectedValue(
      new Error('Database error'),
    );

    // Mock the HTTP request object with valid data and a simulated authenticated user
    const req = {
      user: {
        isAuthenticated: true,
      },
      body: {
        name: 'Test OpportunityHistory',
        version: '1.0.0',
      },
    };
    const res = {}; // Mock response object not directly involved in this test
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Execute the createOpportunityHistory function and expect it to throw an error due to database operation failure
    await expect(createOpportunityHistory(req, res, next)).rejects.toThrow(
      'Database error', // Assert that the specific error thrown matches the simulated database error
    );
  });
});

// Defines a test suite for the `getAllOpportunityHistorys` function.
describe('getAllOpportunityHistorys', () => {
  // `beforeEach` is a Jest lifecycle hook that runs before each test case in this block.
  // It's used to reset the testing environment to a clean state before each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a test case that verifies the successful retrieval of opportunityHistorys.
  it('successfully retrieves opportunityHistorys', async () => {
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
    // when it successfully fetches opportunityHistorys from the database.
    const mockResponseData = {
      totalCount: 1,
      pageCount: 1,
      currentPage: 1,
      perPage: 10,
      results: [
        {
          id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
          name: 'OpportunityHistory One',
          description: 'Description for OpportunityHistory One',
          tags: 'tag1, tag2',
        },
      ],
    };

    // Mock the `getPaginatedList` function to resolve with `mockResponseData`,
    // simulating a successful fetch operation.
    getPaginatedList.mockResolvedValue(mockResponseData);

    // Invoke the `getAllOpportunityHistorys` function with the mocked request and response objects.
    await getAllOpportunityHistorys(req, res, next);

    // Verify that the response status is set to 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify that the response body is set to the mock response data.
    expect(res.json).toHaveBeenCalledWith(mockResponseData);
  });
});

// Describe block defines a test suite for the `getOpportunityHistory` function.
describe('getOpportunityHistory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // First test case: it checks if the function successfully retrieves a opportunityHistory
  // and returns the correct HTTP status and data.
  it('should successfully retrieve a opportunityHistory and return status 200 with the opportunityHistory data', async () => {
    // Mock data representing a opportunityHistory returned from the database.
    const mockOpportunityHistoryData = {
      id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
      name: 'Test OpportunityHistory',
      version: '1.0.0',
    };

    // Mock the Prisma call to find the first opportunityHistory that matches criteria.
    // It's resolved with `mockOpportunityHistoryData`.
    prisma.opportunityHistory.findFirst.mockResolvedValue(
      mockOpportunityHistoryData,
    );
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
    await getOpportunityHistory(req, res, next);

    // Assert the response status was called with 200.
    expect(res.status).toHaveBeenCalledWith(200);
    // Assert the response body is the mock opportunityHistory data.
    expect(res.json).toHaveBeenCalledWith(mockOpportunityHistoryData);
  });

  // Second test case: it checks the behavior when a opportunityHistory is not found.
  // The expected behavior is to throw an error, indicating the opportunityHistory is not found.
  it('should return a 404 error if the opportunityHistory is not found', async () => {
    // Mock the Prisma call to return null, simulating not finding the opportunityHistory.
    prisma.opportunityHistory.findFirst.mockResolvedValue(null);
    // Again, mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with a non-existent opportunityHistory ID.
    const req = { params: { id: 'nonexistent-id' }, user: {} };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with a specific error message.
    await expect(getOpportunityHistory(req, res, next)).rejects.toThrow(
      'OpportunityHistory not found',
    );
  });

  // Third test case: it checks the behavior when a database operation fails.
  // The expected behavior is to throw a database error.
  it('throws an error if the database operation fails', async () => {
    // Mock the Prisma call to reject with an error, simulating a database error.
    prisma.opportunityHistory.findFirst.mockRejectedValue(
      new Error('Database error'),
    );
    // Mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with any opportunityHistory ID.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: {},
    };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with a specific database error.
    await expect(getOpportunityHistory(req, res, next)).rejects.toThrow(
      'Database error',
    );
  });
});

describe('updateOpportunityHistory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // This test verifies that the `updateOpportunityHistory` function can successfully update a opportunityHistory
  // in the database and return the updated opportunityHistory data with a 200 HTTP status code.
  it('should successfully update a opportunityHistory and return status 200 with the updated opportunityHistory data', async () => {
    // Mock data for the test, including the opportunityHistory ID and request body.
    const mockParamsId = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    const mockRequestBody = {
      name: 'Updated OpportunityHistory',
      version: '2.0.0',
    };
    // The expected result after updating the opportunityHistory.
    const mockUpdatedOpportunityHistory = {
      ...mockRequestBody,
      id: mockParamsId,
    };

    // Mock the Prisma update operation to resolve with the updated opportunityHistory data.
    prisma.opportunityHistory.update.mockResolvedValue(
      mockUpdatedOpportunityHistory,
    );

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
    await updateOpportunityHistory(req, res, next);

    // Assert that the response status and body are correct.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockUpdatedOpportunityHistory);
    // Verify that the Prisma update method was called with the correct parameters.
    expect(prisma.opportunityHistory.update).toHaveBeenCalledWith({
      where: { id: mockParamsId },
      data: mockRequestBody,
    });
  });

  // This test ensures that the `updateOpportunityHistory` function correctly handles and throws errors
  // when the database operation fails.
  it('throws an error if the database operation fails', async () => {
    // Mock an error that would be thrown by the Prisma update operation.
    const databaseError = new Error('Database error');
    prisma.opportunityHistory.update.mockRejectedValue(databaseError);

    // Mock the request object with valid parameters and body.
    const req = {
      params: { id: '2454006f-fb48-4b56-b70b-48f92596fe4f' },
      body: { name: 'Valid Name', version: '1.0.1' },
    };
    // Mock the `next` function for error handling.
    const next = jest.fn();

    // Assert that invoking the function under test with a failing database operation
    // results in the expected error being thrown.
    await expect(updateOpportunityHistory(req, {}, next)).rejects.toThrow(
      'Database error',
    );
  });

  // This test checks that the `updateOpportunityHistory` function transforms the keys of the request body
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

    // Mock the Prisma update operation to resolve with the updated opportunityHistory data, including transformed keys.
    prisma.opportunityHistory.update.mockResolvedValue({
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
    await updateOpportunityHistory(req, res);

    // Verify that the keys transformation utility function was called with the original request body.
    expect(objectKeysToCamelCase).toHaveBeenCalledWith(requestBody);
    // Assert that the Prisma update method was called with the correctly transformed request data.
    expect(prisma.opportunityHistory.update).toHaveBeenCalledWith({
      where: { id },
      data: transformedRequestBody,
    });
  });
});

// This describes a test suite for the `deleteOpportunityHistory` function.
describe('deleteOpportunityHistory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a single test case within the suite.
  it('should successfully delete a opportunityHistory and return status 200 with the deleted ID', async () => {
    // Mock ID of the opportunityHistory to be deleted.
    const mockId = '5610eb16-c1dd-4be0-b940-76d1b6a8dd2c';
    // Mock ID representing the creator of the opportunityHistory, used for authorization.
    const createdBy = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    // Mocks the behavior of Prisma's `deleteMany` method to simulate successful deletion.
    // The method is expected to return an object with a count of deleted records.
    prisma.opportunityHistory.deleteMany.mockResolvedValue({ count: 1 });
    // Mocks a helper function that determines visibility filters based on the user,
    // in this case, filtering by the creator's ID.
    getVisibilityFilters.mockReturnValue({ createdBy });

    // Mocks the HTTP request object, including the opportunityHistory ID to delete and user authentication status.
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
    await deleteOpportunityHistory(req, res, next);

    // Verifies that the response status method was called with 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verifies that the response JSON method was called with the expected object,
    // containing the ID of the deleted opportunityHistory.
    expect(res.json).toHaveBeenCalledWith({ deleted: mockId });
    // Verifies that the `deleteMany` method of Prisma was called with the correct arguments,
    // including the ID of the opportunityHistory to delete and the creator's ID for authorization.
    expect(prisma.opportunityHistory.deleteMany).toHaveBeenCalledWith({
      where: { id: mockId, createdBy },
    });
  });
});
