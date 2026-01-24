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
// Import the createProspectCategory function from the controller to be tested
const {
  createProspectCategory,
  getAllProspectCategory,
  getProspectCategory,
  updateProspectCategory,
  deleteProspectCategory,
} = require('#core/controllers/prospectCategory.controller.core.js');
const { getPaginatedList } = require('#utils/databaseUtils.js');

// Mock the Prisma client's prospectCategory model to prevent actual database operations during testing
jest.mock('#configs/prisma.js', () => ({
  prospectCategory: {
    create: jest.fn().mockResolvedValue({}), // Mock the create function to always return a resolved promise
    findFirst: jest.fn(), // Mock the findFirst function
    update: jest.fn(), // Mock the update function
    updateMany: jest.fn(), // Mock the updateMany function (used for update and soft delete)
    deleteMany: jest.fn(), // Mock the deleteMany function
  },
  prospect: {
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

// Define a test suite for the createProspectCategory functionality
describe('createProspectCategory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test case: successfully creating a prospectCategory
  it('should successfully create a prospectCategory and return status 201 with the created object', async () => {
    // Define mock data for the prospectCategory to be created
    const mockProspectCategoryData = {
      name: 'd_compute_test_name',
    };

    // Mock the HTTP request and response objects for the test
    const req = {
      user: {
        id: 'user-123',
        client: { id: 'client-123', name: 'Test Client' },
        isAuthenticated: true, // Simulate an authenticated user
        accessToken: 'mock-token',
      },
      body: mockProspectCategoryData, // Body contains the mock prospectCategory data
    };
    const res = {
      status: jest.fn().mockReturnThis(), // Mock the status method to allow chaining
      json: jest.fn(), // Mock the json method to assert its call later
    };
    const next = jest.fn(); // Mock the next function for error handling

    // Mock the Prisma create method to return the mock prospectCategory data
    prisma.prospectCategory.create.mockResolvedValue(mockProspectCategoryData);

    // Execute the createProspectCategory function with the mocked request and response
    await createProspectCategory(req, res, next);

    // Assert that the prospectCategory was created successfully
    expect(res.status).toHaveBeenCalledWith(201); // Check if response status was set to 201
    // Controller enriches response with __displayValue and details, so use objectContaining
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining(mockProspectCategoryData),
    ); // Check if the created prospectCategory data was returned in the response
    expect(next).not.toHaveBeenCalled(); // Ensure that the next function was not called, indicating no errors
  });

  // Test case: validation failure
  it('throws an error if validation fails', async () => {
    // Define invalid prospectCategory data to simulate a validation failure
    const invalidProspectCategoryData = {
      name: '', // Invalid because it's required and cannot be empty
    };

    // Mock the HTTP request object with invalid data and a simulated authenticated user
    const req = {
      user: {
        id: 'user-123',
        client: { id: 'client-123' },
        isAuthenticated: true,
      },
      body: invalidProspectCategoryData,
    };
    const res = {}; // Mock response object not used in this test
    const next = jest.fn(); // Mock the next function to capture errors

    // Execute the createProspectCategory function and expect it to throw an error due to validation failure
    await expect(createProspectCategory(req, res, next)).rejects.toThrow();
  });

  // Test case: database operation failure
  it('throws an error if the database operation fails', async () => {
    // Simulate a database operation failure by mocking the Prisma create method to reject
    prisma.prospectCategory.create.mockRejectedValue(
      new Error('Database error'),
    );

    // Mock the HTTP request object with valid data and a simulated authenticated user
    const req = {
      user: {
        id: 'user-123',
        client: { id: 'client-123' },
        isAuthenticated: true,
      },
      body: {
        name: 'd_compute_test_name',
      },
    };
    const res = {}; // Mock response object not directly involved in this test
    const next = jest.fn(); // Mock the next function to capture and handle errors

    // Execute the createProspectCategory function and expect it to throw an error due to database operation failure
    await expect(createProspectCategory(req, res, next)).rejects.toThrow(); // Controller wraps errors, so just check that it throws
  });
});

// Defines a test suite for the `getAllProspectCategory` function.
describe('getAllProspectCategory', () => {
  // `beforeEach` is a Jest lifecycle hook that runs before each test case in this block.
  // It's used to reset the testing environment to a clean state before each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a test case that verifies the successful retrieval of prospectCategorys.
  it('successfully retrieves prospectCategorys', async () => {
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
    // when it successfully fetches prospectCategorys from the database.
    const mockResponseData = {
      totalCount: 1,
      pageCount: 1,
      currentPage: 1,
      perPage: 10,
      results: [
        {
          id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
          name: 'ProspectCategory One',
          description: 'Description for ProspectCategory One',
          tags: 'tag1, tag2',
        },
      ],
    };

    // Mock the `getPaginatedList` function to resolve with `mockResponseData`,
    // simulating a successful fetch operation.
    getPaginatedList.mockResolvedValue(mockResponseData);

    // Invoke the `getAllProspectCategory` function with the mocked request and response objects.
    await getAllProspectCategory(req, res, next);

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

// Describe block defines a test suite for the `getProspectCategory` function.
describe('getProspectCategory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // First test case: it checks if the function successfully retrieves a prospectCategory
  // and returns the correct HTTP status and data.
  it('should successfully retrieve a prospectCategory and return status 200 with the prospectCategory data', async () => {
    // Mock data representing a prospectCategory returned from the database.
    const mockProspectCategoryData = {
      id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89',
      name: 'Test ProspectCategory',
    };

    // Mock the Prisma call to find the first prospectCategory that matches criteria.
    // It's resolved with `mockProspectCategoryData`.
    prisma.prospectCategory.findFirst.mockResolvedValue(
      mockProspectCategoryData,
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
    await getProspectCategory(req, res, next);

    // Assert the response status was called with 200.
    expect(res.status).toHaveBeenCalledWith(200);
    // Assert the response body contains the mock prospectCategory data.
    // Controller enriches response with __displayValue and details, so use objectContaining.
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining(mockProspectCategoryData),
    );
  });

  // Second test case: it checks the behavior when a prospectCategory is not found.
  // The expected behavior is to throw an error, indicating the prospectCategory is not found.
  it('should return a 404 error if the prospectCategory is not found', async () => {
    // Mock the Prisma call to return null, simulating not finding the prospectCategory.
    prisma.prospectCategory.findFirst.mockResolvedValue(null);
    // Again, mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with a non-existent prospectCategory ID.
    const req = { params: { id: 'nonexistent-id' }, user: {} };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with an error.
    await expect(getProspectCategory(req, res, next)).rejects.toThrow();
  });

  // Third test case: it checks the behavior when a database operation fails.
  // The expected behavior is to throw a database error.
  it('throws an error if the database operation fails', async () => {
    // Mock the Prisma call to reject with an error, simulating a database error.
    prisma.prospectCategory.findFirst.mockRejectedValue(
      new Error('Database error'),
    );
    // Mock visibility filters with no restrictions.
    getVisibilityFilters.mockReturnValue({});

    // Mock request object with any prospectCategory ID.
    const req = {
      params: { id: 'd8d47913-1b54-4f21-87bc-1f72d1d89f89' },
      user: {},
    };
    // The response object is not used in this test.
    const res = {};
    // Mock the next function for error handling.
    const next = jest.fn();

    // The function call is expected to reject with an error (controller wraps errors).
    await expect(getProspectCategory(req, res, next)).rejects.toThrow();
  });
});

describe('updateProspectCategory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // This test verifies that the `updateProspectCategory` function can successfully update a prospectCategory
  // in the database and return the updated prospectCategory data with a 200 HTTP status code.
  it('should successfully update a prospectCategory and return status 200 with the updated prospectCategory data', async () => {
    // Mock data for the test, including the prospectCategory ID and request body.
    const mockParamsId = '2454006f-fb48-4b56-b70b-48f92596fe4f';
    const mockRequestBody = {
      name: 'd_compute_update_name',
    };
    // The expected result after updating the prospectCategory.
    const mockUpdatedProspectCategory = {
      ...mockRequestBody,
      id: mockParamsId,
    };

    // Mock the Prisma updateMany operation to resolve with count indicating success.
    prisma.prospectCategory.updateMany.mockResolvedValue({
      count: 1,
    });
    // Mock findFirst to return the updated record after updateMany.
    prisma.prospectCategory.findFirst.mockResolvedValue(
      mockUpdatedProspectCategory,
    );

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
    await updateProspectCategory(req, res, next);

    // Assert that the response status and body are correct.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify that the Prisma updateMany method was called.
    expect(prisma.prospectCategory.updateMany).toHaveBeenCalled();
  });

  // This test ensures that the `updateProspectCategory` function correctly handles and throws errors
  // when the database operation fails.
  it('throws an error if the database operation fails', async () => {
    // Mock an error that would be thrown by the Prisma updateMany operation.
    const databaseError = new Error('Database error');
    prisma.prospectCategory.updateMany.mockRejectedValue(databaseError);

    // Mock the request object with valid parameters and body.
    const req = {
      params: { id: '2454006f-fb48-4b56-b70b-48f92596fe4f' },
      body: {
        name: 'd_compute_update_name',
      },
      user: { id: 'user-123', client: { id: 'client-123' } },
    };
    // Mock the `next` function for error handling.
    const next = jest.fn();

    // Assert that invoking the function under test with a failing database operation
    // results in an error being thrown.
    await expect(updateProspectCategory(req, {}, next)).rejects.toThrow();
  });

  // This test checks that the `updateProspectCategory` function transforms the keys of the request body
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
    prisma.prospectCategory.updateMany.mockResolvedValue({
      count: 1,
    });
    // Mock findFirst to return the updated record.
    prisma.prospectCategory.findFirst.mockResolvedValue({
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
    await updateProspectCategory(req, res);

    // Verify that the keys transformation utility function was called with the original request body.
    expect(objectKeysToCamelCase).toHaveBeenCalledWith(requestBody);
    // Assert that the Prisma updateMany method was called.
    expect(prisma.prospectCategory.updateMany).toHaveBeenCalled();
  });
});

// This describes a test suite for the `deleteProspectCategory` function.
describe('deleteProspectCategory', () => {
  // `beforeEach` is a Jest hook that runs before each test in this suite.
  // It's used here to clear all mocks to ensure a clean environment for each test.
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Defines a single test case within the suite.
  it('should successfully delete a prospectCategory and return status 200 with the deleted ID', async () => {
    // Mock ID of the prospectCategory to be deleted.
    const mockId = '5610eb16-c1dd-4be0-b940-76d1b6a8dd2c';
    prisma.prospect.updateMany.mockResolvedValue({ count: 0 });
    // Mocks the behavior of Prisma's `updateMany` method to simulate successful soft deletion.
    // The controller uses updateMany to set the `deleted` field (soft delete pattern).
    prisma.prospectCategory.updateMany.mockResolvedValue({
      count: 1,
    });

    // Mocks the HTTP request object, including the prospectCategory ID to delete and user authentication status.
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
    await deleteProspectCategory(req, res, next);

    // Verifies that the response status method was called with 200, indicating success.
    expect(res.status).toHaveBeenCalledWith(200);
    // Verifies that the response JSON method was called with the expected object,
    // containing the ID of the deleted prospectCategory.
    expect(res.json).toHaveBeenCalledWith({ deleted: mockId });
    // Verifies that the `updateMany` method of Prisma was called (soft delete).
    expect(prisma.prospectCategory.updateMany).toHaveBeenCalled();
  });
});
