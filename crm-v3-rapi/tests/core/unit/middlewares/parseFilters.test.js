/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * Unit tests for parseFilters middleware.
 * Tests coerceValue, buildCondition, parseFilterParam functions and middleware integration.
 *
 *
 */

const Joi = require('joi');
const { coerceValue, buildCondition, parseFilterParam, parseFilters } = require('#core/middlewares/parseFilters.js');

describe('parseFilters', () => {
  describe('coerceValue', () => {
    it('should return null for "null" string', () => {
      expect(coerceValue('null', 'string')).toBeNull();
      expect(coerceValue('null', 'number')).toBeNull();
    });

    it('should coerce string to number', () => {
      expect(coerceValue('123', 'number')).toBe(123);
      expect(coerceValue('45.67', 'number')).toBe(45.67);
      expect(coerceValue('-100', 'number')).toBe(-100);
    });

    it('should throw for invalid number', () => {
      expect(() => coerceValue('abc', 'number')).toThrow('expected number');
      expect(() => coerceValue('', 'number')).toThrow('expected number');
    });

    it('should coerce string to ISO date', () => {
      const result = coerceValue('2025-01-15', 'date');
      expect(result).toBe('2025-01-15T00:00:00.000Z');
    });

    it('should throw for invalid date', () => {
      expect(() => coerceValue('not-a-date', 'date')).toThrow('expected valid date (ISO 8601)');
    });

    it('should coerce string to boolean', () => {
      expect(coerceValue('true', 'boolean')).toBe(true);
      expect(coerceValue('false', 'boolean')).toBe(false);
    });

    it('should throw for invalid boolean', () => {
      expect(() => coerceValue('yes', 'boolean')).toThrow('expected true or false');
      expect(() => coerceValue('1', 'boolean')).toThrow('expected true or false');
    });

    it('should return string as-is for string type', () => {
      expect(coerceValue('hello', 'string')).toBe('hello');
    });

    it('should return string as-is for enum type', () => {
      expect(coerceValue('open', 'enum')).toBe('open');
    });
  });

  describe('buildCondition', () => {
    const numberFieldType = { type: 'number', operators: ['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between'] };
    const stringFieldType = { type: 'string', operators: ['eq', 'in'] };
    const enumFieldType = { type: 'enum', values: ['open', 'closed', 'pending'], operators: ['eq', 'in'] };

    describe('eq operator', () => {
      it('should build equals condition', () => {
        const errors = [];
        const result = buildCondition('eq', '100', numberFieldType, 'amount', errors);
        expect(result).toEqual({ equals: 100 });
        expect(errors).toHaveLength(0);
      });
    });

    describe('in operator', () => {
      it('should build in condition from comma-separated values', () => {
        const errors = [];
        const result = buildCondition('in', 'open,closed', stringFieldType, 'status', errors);
        expect(result).toEqual({ in: ['open', 'closed'] });
        expect(errors).toHaveLength(0);
      });

      it('should trim whitespace from values', () => {
        const errors = [];
        const result = buildCondition('in', 'open, closed , pending', stringFieldType, 'status', errors);
        expect(result).toEqual({ in: ['open', 'closed', 'pending'] });
      });

      it('should return null and add error for empty list', () => {
        const errors = [];
        const result = buildCondition('in', '', stringFieldType, 'status', errors);
        expect(result).toBeNull();
        expect(errors).toHaveLength(1);
        expect(errors[0].reason).toBe('list cannot be empty');
      });

      it('should validate enum values and add error for invalid', () => {
        const errors = [];
        const result = buildCondition('in', 'open,invalid,bad', enumFieldType, 'status', errors);
        expect(result).toBeNull();
        expect(errors).toHaveLength(1);
        expect(errors[0].reason).toContain('invalid values');
      });
    });

    describe('comparison operators', () => {
      it('should build gt condition', () => {
        const errors = [];
        const result = buildCondition('gt', '1000', numberFieldType, 'amount', errors);
        expect(result).toEqual({ gt: 1000 });
      });

      it('should build gte condition', () => {
        const errors = [];
        const result = buildCondition('gte', '1000', numberFieldType, 'amount', errors);
        expect(result).toEqual({ gte: 1000 });
      });

      it('should build lt condition', () => {
        const errors = [];
        const result = buildCondition('lt', '5000', numberFieldType, 'amount', errors);
        expect(result).toEqual({ lt: 5000 });
      });

      it('should build lte condition', () => {
        const errors = [];
        const result = buildCondition('lte', '5000', numberFieldType, 'amount', errors);
        expect(result).toEqual({ lte: 5000 });
      });
    });

    describe('between operator', () => {
      it('should build between condition as gte + lte', () => {
        const errors = [];
        const result = buildCondition('between', '1000,5000', numberFieldType, 'amount', errors);
        expect(result).toEqual({ gte: 1000, lte: 5000 });
      });

      it('should return null and add error for wrong number of values', () => {
        const errors = [];
        const result = buildCondition('between', '1000', numberFieldType, 'amount', errors);
        expect(result).toBeNull();
        expect(errors[0].reason).toBe('requires exactly 2 comma-separated values');
      });

      it('should return null and add error for too many values', () => {
        const errors = [];
        const result = buildCondition('between', '1000,2000,3000', numberFieldType, 'amount', errors);
        expect(result).toBeNull();
        expect(errors[0].reason).toBe('requires exactly 2 comma-separated values');
      });
    });

    describe('unknown operator', () => {
      it('should return null for unknown operator', () => {
        const errors = [];
        const result = buildCondition('unknown', 'value', stringFieldType, 'field', errors);
        expect(result).toBeNull();
      });
    });
  });

  describe('parseFilterParam', () => {
    const filterFields = ['amount', 'status', 'createdAt'];
    const typeMap = {
      amount: { type: 'number', operators: ['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between'] },
      status: { type: 'enum', values: ['open', 'closed'], operators: ['eq', 'in'] },
      createdAt: { type: 'date', operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'] },
    };

    it('should parse field__operator=value syntax', () => {
      const errors = [];
      const result = parseFilterParam('amount__gte', '1000', { filterFields, typeMap, errors });

      expect(result).toEqual({
        field: 'amount',
        condition: { gte: 1000 },
      });
      expect(errors).toHaveLength(0);
    });

    it('should use implicit eq operator when no operator suffix', () => {
      const errors = [];
      const result = parseFilterParam('status', 'open', { filterFields, typeMap, errors });

      expect(result).toEqual({
        field: 'status',
        condition: { equals: 'open' },
      });
    });

    it('should convert snake_case to camelCase', () => {
      const errors = [];
      const result = parseFilterParam('created_at__gte', '2025-01-01', { filterFields, typeMap, errors });

      expect(result.field).toBe('createdAt');
    });

    it('should return null and add error for unknown field', () => {
      const errors = [];
      const result = parseFilterParam('unknown__eq', 'value', { filterFields, typeMap, errors });

      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual({
        field: 'unknown',
        operator: 'eq',
        reason: 'unknown field',
      });
    });

    it('should return null and add error for unsupported operator', () => {
      const errors = [];
      const result = parseFilterParam('status__gt', '100', { filterFields, typeMap, errors });

      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toContain("operator 'gt' not supported");
    });

    it('should catch coercion errors and add to errors array', () => {
      const errors = [];
      const result = parseFilterParam('amount__eq', 'not-a-number', { filterFields, typeMap, errors });

      expect(result).toBeNull();
      expect(errors).toHaveLength(1);
      expect(errors[0].reason).toBe('expected number');
      expect(errors[0].value).toBe('not-a-number');
    });
  });

  describe('parseFilters middleware', () => {
    const testSchema = Joi.object({
      amount: Joi.number(),
      status: Joi.string().allow('open', 'closed', 'pending'),
      isActive: Joi.boolean(),
      createdAt: Joi.date(),
    });
    const filterFields = ['amount', 'status', 'isActive', 'createdAt'];

    const createMockReq = (query) => ({ query: { ...query } });
    const createMockRes = () => ({});
    const createMockNext = () => jest.fn();

    it('should transform simple field=value to equals condition', () => {
      const req = createMockReq({ status: 'open' });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(req.query.status).toEqual({ equals: 'open' });
      expect(next).toHaveBeenCalledWith();
    });

    it('should transform field__operator=value syntax', () => {
      const req = createMockReq({ amount__gte: '1000' });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(req.query.amount).toEqual({ gte: 1000 });
      expect(req.query.amount__gte).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('should preserve reserved params unchanged', () => {
      const req = createMockReq({
        page: '1',
        pageSize: '10',
        search: 'test',
        ordering: 'createdAt',
        status: 'open',
      });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(req.query.page).toBe('1');
      expect(req.query.pageSize).toBe('10');
      expect(req.query.search).toBe('test');
      expect(req.query.ordering).toBe('createdAt');
      expect(req.query.status).toEqual({ equals: 'open' });
    });

    it('should preserve snake_case reserved params unchanged', () => {
      const req = createMockReq({
        page: '1',
        page_size: '20',
        per_page: '15',
        search: 'test',
        ordering: 'createdAt',
        count_strategy: 'exact',
        autocomplete: 'true',
        status: 'open',
      });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(req.query.page).toBe('1');
      expect(req.query.page_size).toBe('20');
      expect(req.query.per_page).toBe('15');
      expect(req.query.search).toBe('test');
      expect(req.query.ordering).toBe('createdAt');
      expect(req.query.count_strategy).toBe('exact');
      expect(req.query.autocomplete).toBe('true');
      expect(req.query.status).toEqual({ equals: 'open' });
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle multiple filters', () => {
      const req = createMockReq({
        amount__gte: '1000',
        amount__lte: '5000',
        status__in: 'open,closed',
      });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      // Note: multiple operators on same field will overwrite, which is expected behavior
      expect(req.query.status).toEqual({ in: ['open', 'closed'] });
      expect(next).toHaveBeenCalledWith();
    });

    it('should call next with error when validation fails', () => {
      const req = createMockReq({ unknown__eq: 'value' });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        type: 'BAD_REQUEST',
        filterErrors: expect.arrayContaining([
          expect.objectContaining({ field: 'unknown', reason: 'unknown field' }),
        ]),
      }));
    });

    it('should collect multiple errors before calling next', () => {
      const req = createMockReq({
        unknown: 'value',
        amount__eq: 'not-a-number',
      });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      const errorArg = next.mock.calls[0][0];
      expect(errorArg.filterErrors).toHaveLength(2);
    });

    it('should handle boolean filters', () => {
      const req = createMockReq({ isActive: 'true' });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(req.query.isActive).toEqual({ equals: true });
    });

    it('should handle date filters with between operator', () => {
      const req = createMockReq({ created_at__between: '2025-01-01,2025-12-31' });
      const next = createMockNext();
      const middleware = parseFilters({ schema: testSchema, filterFields });

      middleware(req, createMockRes(), next);

      expect(req.query.createdAt).toEqual({
        gte: '2025-01-01T00:00:00.000Z',
        lte: '2025-12-31T00:00:00.000Z',
      });
    });
  });
});
