/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * Unit tests for handleFilterValidationError function in errorHandlingUtils.
 * Tests filter error creation and formatting.
 *
 *
 */

const {
  handleFilterValidationError,
} = require('#core/utils/errorHandlingUtils.js');

describe('handleFilterValidationError', () => {
  it('should create error with BAD_REQUEST type', () => {
    const filterErrors = [
      { field: 'status', operator: 'eq', reason: 'unknown field' },
    ];

    const error = handleFilterValidationError(filterErrors);

    expect(error.type).toBe('BAD_REQUEST');
    expect(error.statusCode).toBe(400);
  });

  it('should include filter errors in error details', () => {
    const filterErrors = [
      { field: 'status', operator: 'eq', reason: 'unknown field' },
      {
        field: 'amount',
        operator: 'gt',
        reason: 'expected number',
        value: 'abc',
      },
    ];

    const error = handleFilterValidationError(filterErrors);

    expect(error.details.filterErrors).toEqual(filterErrors);
    expect(error.filterErrors).toEqual(filterErrors);
  });

  it('should set default context to filter_parsing', () => {
    const filterErrors = [{ field: 'test', operator: 'eq', reason: 'error' }];

    const error = handleFilterValidationError(filterErrors);

    expect(error.context).toBe('filter_parsing');
  });

  it('should use custom context when provided', () => {
    const filterErrors = [{ field: 'test', operator: 'eq', reason: 'error' }];

    const error = handleFilterValidationError(filterErrors, 'custom_context');

    expect(error.context).toBe('custom_context');
  });

  it('should set error message to Invalid query filters', () => {
    const filterErrors = [{ field: 'test', operator: 'eq', reason: 'error' }];

    const error = handleFilterValidationError(filterErrors);

    expect(error.message).toBe('Invalid query filters');
  });

  it('should handle empty filter errors array', () => {
    const error = handleFilterValidationError([]);

    expect(error.type).toBe('BAD_REQUEST');
    expect(error.statusCode).toBe(400);
    expect(error.filterErrors).toEqual([]);
  });

  it('should handle multiple filter errors', () => {
    const filterErrors = [
      { field: 'field1', operator: 'eq', reason: 'unknown field' },
      {
        field: 'field2',
        operator: 'in',
        reason: 'list cannot be empty',
        value: '',
      },
      {
        field: 'field3',
        operator: 'between',
        reason: 'requires exactly 2 comma-separated values',
      },
    ];

    const error = handleFilterValidationError(filterErrors);

    expect(error.filterErrors).toHaveLength(3);
    expect(error.filterErrors[0].field).toBe('field1');
    expect(error.filterErrors[1].field).toBe('field2');
    expect(error.filterErrors[2].field).toBe('field3');
  });
});
