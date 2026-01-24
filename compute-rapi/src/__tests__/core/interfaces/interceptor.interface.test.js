/**
 * Tests for Interceptor Interface
 *
 * Defines the contract for lifecycle interceptors that hook into
 * generated CRUD operations.
 */

const {
  LIFECYCLE_HOOKS,
  createNoOpInterceptor,
  validateInterceptor,
  mergeWithDefaults,
} = require('../../../computeConstructors/api/core/interfaces/interceptor.interface.template.js');

describe('Interceptor Interface', () => {
  describe('LIFECYCLE_HOOKS', () => {
    it('should define all lifecycle hooks', () => {
      expect(LIFECYCLE_HOOKS).toContain('beforeValidate');
      expect(LIFECYCLE_HOOKS).toContain('extendSchema');
      expect(LIFECYCLE_HOOKS).toContain('afterValidate');
      expect(LIFECYCLE_HOOKS).toContain('beforeCreate');
      expect(LIFECYCLE_HOOKS).toContain('afterCreate');
      expect(LIFECYCLE_HOOKS).toContain('beforeUpdate');
      expect(LIFECYCLE_HOOKS).toContain('afterUpdate');
      expect(LIFECYCLE_HOOKS).toContain('beforeDelete');
      expect(LIFECYCLE_HOOKS).toContain('afterDelete');
      expect(LIFECYCLE_HOOKS).toContain('beforeList');
      expect(LIFECYCLE_HOOKS).toContain('afterList');
      expect(LIFECYCLE_HOOKS).toContain('beforeRead');
      expect(LIFECYCLE_HOOKS).toContain('afterRead');
      expect(LIFECYCLE_HOOKS).toContain('onError');
    });

    it('should have exactly 14 hooks', () => {
      expect(LIFECYCLE_HOOKS).toHaveLength(14);
    });
  });

  describe('createNoOpInterceptor', () => {
    it('should return interceptor with all hooks as passthrough', async () => {
      const interceptor = createNoOpInterceptor();
      const testData = { foo: 'bar' };
      const context = { user: {}, modelName: 'Test' };

      const result = await interceptor.beforeValidate(testData, context);
      expect(result.data).toEqual(testData);
      expect(result.halt).toBeUndefined();
    });

    it('should have all lifecycle hooks defined', () => {
      const interceptor = createNoOpInterceptor();

      for (const hook of LIFECYCLE_HOOKS) {
        expect(typeof interceptor[hook]).toBe('function');
      }
    });

    it('should have extendSchema return schema unchanged', () => {
      const interceptor = createNoOpInterceptor();
      const schema = { validate: () => {} };

      const result = interceptor.extendSchema(schema);
      expect(result).toBe(schema);
    });
  });

  describe('validateInterceptor', () => {
    it('should return true for valid interceptor', () => {
      const valid = { beforeCreate: async () => ({ data: {} }) };
      expect(validateInterceptor(valid)).toBe(true);
    });

    it('should return true for empty interceptor', () => {
      expect(validateInterceptor({})).toBe(true);
    });

    it('should return false for non-function hooks', () => {
      const invalid = { beforeCreate: 'not a function' };
      expect(validateInterceptor(invalid)).toBe(false);
    });

    it('should return false for null', () => {
      expect(validateInterceptor(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(validateInterceptor('string')).toBe(false);
    });
  });

  describe('mergeWithDefaults', () => {
    it('should merge partial interceptor with defaults', async () => {
      const partial = {
        beforeCreate: async (data) => ({ data: { ...data, custom: true } }),
      };

      const merged = mergeWithDefaults(partial);

      // Custom hook should work
      const createResult = await merged.beforeCreate({ id: 1 });
      expect(createResult.data.custom).toBe(true);

      // Default hooks should be passthrough
      const readResult = await merged.afterRead({ id: 1 });
      expect(readResult.data).toEqual({ id: 1 });
    });
  });

  describe('InterceptorContext query support', () => {
    it('should support queryBuilder in list context', () => {
      const { createQueryBuilder } = require('../../../computeConstructors/api/core/interfaces/query-builder.interface.template.js');
      const context = {
        req: {},
        user: {},
        modelName: 'Employee',
        operation: 'list',
        queryBuilder: createQueryBuilder('Employee'),
      };

      expect(context.queryBuilder).toBeDefined();
      expect(context.queryBuilder.modelName).toBe('Employee');
    });

    it('should support transaction in context when provided', () => {
      const mockTx = { employee: { findMany: jest.fn() } };
      const context = {
        req: {},
        user: {},
        modelName: 'Employee',
        operation: 'create',
        transaction: mockTx,
      };

      expect(context.transaction).toBe(mockTx);
    });

    it('should allow interceptor to modify queryBuilder', async () => {
      const { createQueryBuilder } = require('../../../computeConstructors/api/core/interfaces/query-builder.interface.template.js');
      const interceptor = {
        beforeList: async (query, context) => {
          // Interceptor can modify the query builder
          const modifiedBuilder = context.queryBuilder.where({ status: 'active' });
          return { data: modifiedBuilder };
        },
      };

      const merged = mergeWithDefaults(interceptor);
      const queryBuilder = createQueryBuilder('Employee');
      const context = { queryBuilder, user: {}, modelName: 'Employee', operation: 'list' };

      const result = await merged.beforeList({}, context);
      const builtQuery = result.data.build();

      expect(builtQuery.where.status).toBe('active');
    });
  });
});
