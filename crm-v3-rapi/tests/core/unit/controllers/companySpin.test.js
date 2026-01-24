/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
const { getVisibilityFilters } = require('#utils/visibilityUtils.js');
const { objectKeysToCamelCase } = require('#utils/generalUtils.js');
// Import the createCompanySpin function from the controller to be tested
const {
  createCompanySpin,
  getAllCompanySpin,
  getCompanySpin,
  updateCompanySpin,
  deleteCompanySpin,
} = require('#core/controllers/companySpin.controller.core.js');
const { getPaginatedList } = require('#utils/databaseUtils.js');

// Mock the Prisma client's companySpin model to prevent actual database operations during testing
jest.mock('#configs/prisma.js', () => ({
  companySpin: {
    create: jest.fn().mockResolvedValue({}), // Mock the create function to always return a resolved promise
    findFirst: jest.fn(), // Mock the findFirst function
    update: jest.fn(), // Mock the update function
    updateMany: jest.fn(), // Mock the updateMany function (used for update and soft delete)
    deleteMany: jest.fn(), // Mock the deleteMany function
  },
  opportunity: {
    updateMany: jest.fn(), // Mock for related table updates during delete
  },
}));

// This mock replaces the `lodash` module with a custom implementation for testing purposes.
jest.mock('lodash', () => ({
  // Specifically, it mocks the `camelCase` function to simply return the key it receives.
  // This simplification is useful for tests that rely on `camelCase` behavior but do not need its full implementation.
  camelCase: jest.fn().mockImplementation((key) => key),
  // Mock isPlainObject to return true for objects (used by controller for data transformation)
  isPlainObject: jest
    .fn()
    .mockImplementation(
      (obj) => obj !== null && typeof obj === 'object' && !Array.isArray(obj),
    ),
  // Mock mapValues for nested object transformation
  mapValues: jest.fn().mockImplementation((obj, fn) => {
    const result = {};
    for (const key in obj) {
      result[key] = fn(obj[key], key);
    }
    return result;
  }),
}));

// Mocks a custom module located at `#utils/visibilityUtils.js`.
jest.mock('#utils/visibilityUtils.js', () => ({
  // `getVisibilityFilters` and `buildCreateRecordPayload` are utility functions being mocked.
  // The mock implementations are left undefined, meaning they will need to be specified in each test.
  getVisibilityFilters: jest.fn(),
  buildCreateRecordPayload: jest.fn(),
}));

// Mocks another custom module for general utilities.
jest.mock('#utils/generalUtils.js', () => ({
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
jest.mock('#utils/databaseUtils.js', () => ({
  // Mocks `getPaginatedList`, a function presumably used for fetching lists of records with pagination.
  // The mock implementation is not defined here, allowing it to be configured within individual tests.
  getPaginatedList: jest.fn(),
}));

// Mock the interceptor registry to prevent lifecycle hooks from interfering with tests
jest.mock('#domain/interceptors/interceptor.registry.js', () => ({
  getRegistry: jest.fn(() => ({
    resolve: jest.fn(() => ({
      extendSchema: jest.fn((schema) => schema),
      beforeValidate: jest
        .fn()
        .mockImplementation((data) => ({ halt: false, data })),
      afterValidate: jest
        .fn()
        .mockImplementation((data) => ({ halt: false, data })),
      beforeList: jest.fn().mockResolvedValue({ halt: false }),
      afterList: jest.fn().mockImplementation((data) => ({ data })),
      beforeRead: jest.fn().mockResolvedValue({ halt: false }),
      afterRead: jest.fn().mockImplementation((data) => ({ data })),
      beforeCreate: jest
        .fn()
        .mockImplementation((data) => ({ halt: false, data })),
      afterCreate: jest.fn().mockImplementation((data) => ({ data })),
      beforeUpdate: jest
        .fn()
        .mockImplementation((data) => ({ halt: false, data })),
      afterUpdate: jest.fn().mockImplementation((data) => ({ data })),
      beforeDelete: jest.fn().mockResolvedValue({ halt: false }),
      afterDelete: jest.fn().mockImplementation((data) => ({ data })),
      onError: jest.fn().mockResolvedValue({ data: { handled: false } }),
    })),
  })),
}));

// Mock API and display value utilities
jest.mock('#utils/apiUtils.js', () => ({
  getDetailsFromAPI: jest
    .fn()
    .mockImplementation(({ results }) => Promise.resolve(results)),
}));

jest.mock('#utils/displayValueUtils.js', () => ({
  computeDisplayValue: jest.fn().mockReturnValue('Display Value'),
  DISPLAY_VALUE_PROP: '__displayValue',
  attachNestedDisplayValues: jest.fn(),
}));

jest.mock('#utils/nestedHydrationUtils.js', () => ({
  batchHydrateRelationsInList: jest.fn().mockResolvedValue([]),
  hydrateRelationsOnRecord: jest.fn().mockResolvedValue({}),
}));

// Define a test suite for the createCompanySpin functionality
describe('createCompanySpin', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test case: successfully creating a companySpin
  it('should successfully create a companySpin and return status 201 with the created object', async () => {
    // Define mock data for the companySpin to be created
    const mockCompanySpinData = {
      companyId: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
      situation: 'd_compute_test_situation',
      implication: 'd_compute_test_implication',
      need: 'd_compute_test_need',
      buyerInfluence: 'USER',
      problem: 'd_compute_test_problem',
    };

    // Mock the HTTP request and response objects for the test
    const req = {
      user: {
        id: 'user-123',
        client: { id: 'client-123', name: 'Test Client' },
        isAuthenticated: true, // Simulate an authenticated user
        accessToken: 'mock-token',
      },
      body: mockCompanySpinData, // Body contains the mock companySpin data
    };
    const res = {
      status: jest.fn().mockReturnThis(), // Mock the status method to allow chaining
      json: jest.fn(), // Mock the json method to assert its call later
    };
    const next = jest.fn(); // Mock the next function for error handling

    // Mock the Prisma create method to return the mock companySpin data
    prisma.companySpin.create.mockResolvedValue(mockCompanySpinData);

    // Execute the createCompanySpin function with the mocked request and response
    await createCompanySpin(req, res, next);

    // Assert that the companySpin was created successfully
    expect(res.status).toHaveBeenCalledWith(201); // Check if response status was set to 201
    // Controller enriches response with __displayValue and details, so use objectContaining
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining(mockCompanySpinData),
    ); // Check if the created companySpin data was returned in the response
    expect(next).not.toHaveBeenCalled(); // Ensure that the next function was not called, indicating no errors
  });

  // Test case: validation failure
  it('throws an error if validation fails', async () => {
    // Define invalid companySpin data to simulate a validation failure
    const invalidCompanySpinData = {
      name: '', // Invalid because it's required and cannot be empty
    };

    // Mock the HTTP request object with invalid data and a simulated authenticated user
    const req = {
      user: {
        id: 'user-123',
        client: { id: 'client-123' },
        isAuthenticated: true,
      },
      body: invalidCompanySpinData,
    };
    const res = {}; // Mock response object not used in this test
    const next = jest.fn(); // Mock the next function to capture errors

    // Execute the createCompanySpin function and expect it to throw an error due to validation failure
    await expect(createCompanySpin(req, res, next)).rejects.toThrow();
  });

  // Test case: database operation failure
  it('throws an error if the database operation fails', async () => {
    // Simulate a database operation failure by mocking the Prisma create method to reject
    prisma.companySpin.create.mockRejectedValue(new Error('Database error'));

    // Mock the HTTP request object with valid data and a simulated authenticated user
    const req = {
      user: {
        id: 'user-123',
        client: { id: 'client-123' },
        isAuthenticated: true,
      },
      body: {
        companyId: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
        situation: 'd_compute_test_situation',
        implication: 'd_compute_test_implication',
        need: 'd_compute_test_need',
        buyerInfluence: 'USER',
        problem: 'd_compute_test_problem',
      },
    };
    const res = {}; // Mock response object not directly involved in this test
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Execute the createCompanySpin function and expect it to throw an error due to database operation failure
    await expect(createCompanySpin(req, res, next)).rejects.toThrow(); // Controller wraps errors, so just check that it throws
  });
});

// Defines a test suite for the `getAllCompanySpin` function.
describe('getAllCompanySpin', () => {
  // `beforeEach` is a Jest lifecycle hook that runs before each test case in this block.
  // It's used to reset the testing environment to a clean state before each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a test case that verifies the successful retrieval of companySpins.
  it('successfully retrieves companySpins', async () => {
    // Mock request object with parameters and user details.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: { isAuthenticated: true },
      query: {},
    };
    // Mock response object with `status` and `json` methods, chaining `status` to return `this`.
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Mock response data representing what the `getPaginatedList` function should return
    // when it successfully fetches companySpins from the database.
    const mockResponseData = {
      totalCount: 1,
      pageCount: 1,
      currentPage: 1,
      perPage: 10,
      results: [
        {
          id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
          name: 'CompanySpin One',
          description: 'Description for CompanySpin One',
          tags: 'tag1, tag2',
        },
      ],
    };

    // Mock the `getPaginatedList` function to resolve with `mockResponseData`,
    // simulating a successful fetch operation.
    getPaginatedList.mockResolvedValue(mockResponseData);

    // Invoke the `getAllCompanySpin` function with the mocked request and response objects.
    await getAllCompanySpin(req, res, next);

    // Verify that the response status is set to 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify that the response body contains the mock response data (controller enriches with displayValue).
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        totalCount: mockResponseData.totalCount,
        pageCount: mockResponseData.pageCount,
        currentPage: mockResponseData.currentPage,
        perPage: mockResponseData.perPage,
      }),
    );
  });
});

// Describe block defines a test suite for the `getCompanySpin` function.
describe('getCompanySpin', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // First test case: it checks if the function successfully retrieves a companySpin
  // and returns the correct HTTP status and data.
  it('should successfully retrieve a companySpin and return status 200 with the companySpin data', async () => {
    // Mock data representing a companySpin returned from the database.
    const mockCompanySpinData = {
      id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
      name: 'Test CompanySpin',
    };

    // Mock the Prisma call to find the first companySpin that matches criteria.
    // It's resolved with `mockCompanySpinData`.
    prisma.companySpin.findFirst.mockResolvedValue(mockCompanySpinData);
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
    await getCompanySpin(req, res, next);

    // Assert the response status was called with 200.
    expect(res.status).toHaveBeenCalledWith(200);
    // Assert the response body contains the mock companySpin data.
    // Controller enriches response with __displayValue and details, so use objectContaining.
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining(mockCompanySpinData),
    );
  });

  // Second test case: it checks the behavior when a companySpin is not found.
  // The expected behavior is to throw an error, indicating the companySpin is not found.
  it('should return a 404 error if the companySpin is not found', async () => {
    // Mock the Prisma call to return null, simulating not finding the companySpin.
    prisma.companySpin.findFirst.mockResolvedValue(null);
    // Again, mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with a non-existent companySpin ID.
    const req = { params: { id: 'nonexistent-id' }, user: {} };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with an error.
    await expect(getCompanySpin(req, res, next)).rejects.toThrow();
  });

  // Third test case: it checks the behavior when a database operation fails.
  // The expected behavior is to throw a database error.
  it('throws an error if the database operation fails', async () => {
    // Mock the Prisma call to reject with an error, simulating a database error.
    prisma.companySpin.findFirst.mockRejectedValue(new Error('Database error'));
    // Mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with any companySpin ID.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: {},
    };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with an error (controller wraps errors).
    await expect(getCompanySpin(req, res, next)).rejects.toThrow();
  });
});

describe('updateCompanySpin', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // This test verifies that the `updateCompanySpin` function can successfully update a companySpin
  // in the database and return the updated companySpin data with a 200 HTTP status code.
  it('should successfully update a companySpin and return status 200 with the updated companySpin data', async () => {
    // Mock data for the test, including the companySpin ID and request body.
    const mockParamsId = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    const mockRequestBody = {
      situation: 'd_compute_update_situation',
    };
    // The expected result after updating the companySpin.
    const mockUpdatedCompanySpin = {
      ...mockRequestBody,
      id: mockParamsId,
    };

    // Mock the Prisma updateMany operation to resolve with count indicating success.
    prisma.companySpin.updateMany.mockResolvedValue({
      count: 1,
    });
    // Mock findFirst to return the updated record after updateMany.
    prisma.companySpin.findFirst.mockResolvedValue(mockUpdatedCompanySpin);

    // Mock request and response objects, mimicking Express.js behavior.
    const req = {
      params: { id: mockParamsId },
      body: mockRequestBody,
      user: { id: 'user-123', client: { id: 'client-123' } },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    // Mock the `next` function for error handling.
    const next = jest.fn();

    // Invoke the function under test with the mocked request and response.
    await updateCompanySpin(req, res, next);

    // Assert that the response status and body are correct.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify that the Prisma updateMany method was called.
    expect(prisma.companySpin.updateMany).toHaveBeenCalled();
  });

  // This test ensures that the `updateCompanySpin` function correctly handles and throws errors
  // when the database operation fails.
  it('throws an error if the database operation fails', async () => {
    // Mock an error that would be thrown by the Prisma updateMany operation.
    const databaseError = new Error('Database error');
    prisma.companySpin.updateMany.mockRejectedValue(databaseError);

    // Mock the request object with valid parameters and body.
    const req = {
      params: { id: '2454006f-fb48-4b56-b70b-48f92596fe4f' },
      body: {
        situation: 'd_compute_update_situation',
      },
      user: { id: 'user-123', client: { id: 'client-123' } },
    };
    // Mock the `next` function for error handling.
    const next = jest.fn();

    // Assert that invoking the function under test with a failing database operation
    // results in an error being thrown.
    await expect(updateCompanySpin(req, {}, next)).rejects.toThrow();
  });

  // This test checks that the `updateCompanySpin` function transforms the keys of the request body
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

    // Mock the Prisma updateMany operation to resolve with count indicating success.
    prisma.companySpin.updateMany.mockResolvedValue({
      count: 1,
    });
    // Mock findFirst to return the updated record.
    prisma.companySpin.findFirst.mockResolvedValue({
      id,
      ...transformedRequestBody,
    });

    // Mock request and response objects.
    const req = {
      params: { id },
      body: requestBody,
      user: { id: 'user-123', client: { id: 'client-123' } },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    // Invoke the function under test.
    await updateCompanySpin(req, res);

    // Verify that the keys transformation utility function was called with the original request body.
    expect(objectKeysToCamelCase).toHaveBeenCalledWith(requestBody);
    // Assert that the Prisma updateMany method was called.
    expect(prisma.companySpin.updateMany).toHaveBeenCalled();
  });
});

// This describes a test suite for the `deleteCompanySpin` function.
describe('deleteCompanySpin', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a single test case within the suite.
  it('should successfully delete a companySpin and return status 200 with the deleted ID', async () => {
    // Mock ID of the companySpin to be deleted.
    const mockId = '5610eb16-c1dd-4be0-b940-76d1b6a8dd2c';
    prisma.opportunity.updateMany.mockResolvedValue({ count: 0 });
    // Mocks the behavior of Prisma's `updateMany` method to simulate successful soft deletion.
    // The controller uses updateMany to set the `deleted` field (soft delete pattern).
    prisma.companySpin.updateMany.mockResolvedValue({
      count: 1,
    });

    // Mocks the HTTP request object, including the companySpin ID to delete and user authentication status.
    const req = {
      params: { id: mockId },
      user: {
        id: 'user-123',
        client: { id: 'client-123' },
        isAuthenticated: true,
      },
    };
    // Mocks the HTTP response object, including methods for setting the response status and JSON body.
    const res = {
      status: jest.fn().mockReturnThis(), // Allows chaining of the `json` method after `status`.
      json: jest.fn(),
    };
    // Mocks the `next` function used for error handling in Express middleware.
    const next = jest.fn();

    // Calls the function under test with the mocked request and response objects.
    await deleteCompanySpin(req, res, next);

    // Verifies that the response status method was called with 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verifies that the response JSON method was called with the expected object,
    // containing the ID of the deleted companySpin.
    expect(res.json).toHaveBeenCalledWith({ deleted: mockId });
    // Verifies that the `updateMany` method of Prisma was called (soft delete).
    expect(prisma.companySpin.updateMany).toHaveBeenCalled();
  });
});
