/**
 * Integration Test for Interceptor Lifecycle
 *
 * Tests the complete lifecycle flow through the interceptor system,
 * ensuring hooks are called in correct order and data flows properly.
 */

const {
  InterceptorRegistry,
} = require('../../computeConstructors/api/domain/interceptors/interceptor.registry.template.js');

describe('Interceptor Lifecycle Integration', () => {
  let registry;
  let callOrder;

  beforeEach(() => {
    registry = new InterceptorRegistry();
    callOrder = [];
  });

  afterEach(() => {
    registry.clear();
  });

  describe('Create Lifecycle', () => {
    beforeEach(() => {
      // Register test interceptor that tracks call order
      registry.register('TestModel', {
        async beforeValidate(data, ctx) {
          callOrder.push('beforeValidate');
          return { data: { ...data, normalized: true } };
        },
        extendSchema(schema, ctx) {
          callOrder.push('extendSchema');
          return { ...schema, extended: true };
        },
        async afterValidate(data, ctx) {
          callOrder.push('afterValidate');
          return { data: { ...data, validated: true } };
        },
        async beforeCreate(data, ctx) {
          callOrder.push('beforeCreate');
          return { data: { ...data, computed: true } };
        },
        async afterCreate(record, ctx) {
          callOrder.push('afterCreate');
          return { data: { ...record, enriched: true } };
        },
      });
    });

    it('should execute hooks in correct order', async () => {
      const interceptor = registry.resolve('TestModel');
      const context = {
        user: { id: 1 },
        modelName: 'TestModel',
        operation: 'create',
      };

      // Simulate create lifecycle
      let data = { name: 'Test' };

      // Phase 1: Before validation
      const v1 = await interceptor.beforeValidate(data, context);
      data = v1.data;

      // Phase 2: Schema extension
      const schema = interceptor.extendSchema({}, context);

      // Phase 3: After validation
      const v2 = await interceptor.afterValidate(data, context);
      data = v2.data;

      // Phase 4: Before create
      const v3 = await interceptor.beforeCreate(data, context);
      data = v3.data;

      // Simulate DB operation
      const record = { id: 1, ...data };

      // Phase 5: After create
      const v4 = await interceptor.afterCreate(record, context);
      const final = v4.data;

      expect(callOrder).toEqual([
        'beforeValidate',
        'extendSchema',
        'afterValidate',
        'beforeCreate',
        'afterCreate',
      ]);

      expect(final.normalized).toBe(true);
      expect(final.validated).toBe(true);
      expect(final.computed).toBe(true);
      expect(final.enriched).toBe(true);
    });

    it('should pass data through the chain correctly', async () => {
      const interceptor = registry.resolve('TestModel');
      const context = { user: {}, modelName: 'TestModel', operation: 'create' };

      let data = { name: 'Original' };

      const v1 = await interceptor.beforeValidate(data, context);
      expect(v1.data.name).toBe('Original');
      expect(v1.data.normalized).toBe(true);

      const v2 = await interceptor.afterValidate(v1.data, context);
      expect(v2.data.normalized).toBe(true);
      expect(v2.data.validated).toBe(true);

      const v3 = await interceptor.beforeCreate(v2.data, context);
      expect(v3.data.validated).toBe(true);
      expect(v3.data.computed).toBe(true);
    });
  });

  describe('Halt Processing', () => {
    it('should support halt to stop processing', async () => {
      registry.register('HaltModel', {
        async beforeCreate(data, ctx) {
          return {
            data,
            halt: true,
            response: { status: 403, body: { error: 'Not allowed' } },
          };
        },
      });

      const interceptor = registry.resolve('HaltModel');
      const result = await interceptor.beforeCreate({ name: 'Test' }, {});

      expect(result.halt).toBe(true);
      expect(result.response.status).toBe(403);
      expect(result.response.body.error).toBe('Not allowed');
    });

    it('should halt in global interceptor before model interceptor runs', async () => {
      const modelCalled = [];

      registry.registerGlobal({
        async beforeCreate(data, ctx) {
          return {
            halt: true,
            response: { status: 401, body: { error: 'Unauthorized' } },
          };
        },
      });

      registry.register('SecureModel', {
        async beforeCreate(data, ctx) {
          modelCalled.push('beforeCreate');
          return { data };
        },
      });

      const interceptor = registry.resolve('SecureModel');
      const result = await interceptor.beforeCreate({ name: 'Test' }, {});

      expect(result.halt).toBe(true);
      expect(result.response.status).toBe(401);
      expect(modelCalled).toEqual([]); // Model interceptor should NOT be called
    });
  });

  describe('Unregistered Models', () => {
    it('should fall back to passthrough for unregistered models', async () => {
      const interceptor = registry.resolve('UnknownModel');
      const input = { name: 'Test', value: 42 };

      const result = await interceptor.beforeCreate(input, {});

      expect(result.data).toEqual(input);
      expect(result.halt).toBeUndefined();
    });

    it('should have all lifecycle hooks available', async () => {
      const interceptor = registry.resolve('UnknownModel');

      expect(typeof interceptor.beforeValidate).toBe('function');
      expect(typeof interceptor.extendSchema).toBe('function');
      expect(typeof interceptor.afterValidate).toBe('function');
      expect(typeof interceptor.beforeCreate).toBe('function');
      expect(typeof interceptor.afterCreate).toBe('function');
      expect(typeof interceptor.beforeUpdate).toBe('function');
      expect(typeof interceptor.afterUpdate).toBe('function');
      expect(typeof interceptor.beforeDelete).toBe('function');
      expect(typeof interceptor.afterDelete).toBe('function');
      expect(typeof interceptor.beforeList).toBe('function');
      expect(typeof interceptor.afterList).toBe('function');
      expect(typeof interceptor.beforeRead).toBe('function');
      expect(typeof interceptor.afterRead).toBe('function');
      expect(typeof interceptor.onError).toBe('function');
    });
  });

  describe('Global Interceptors', () => {
    it('should run global interceptors before model interceptors', async () => {
      registry.registerGlobal({
        async beforeCreate(data, ctx) {
          callOrder.push('global');
          return { data: { ...data, global: true } };
        },
      });

      registry.register('TestModel', {
        async beforeCreate(data, ctx) {
          callOrder.push('model');
          return { data: { ...data, model: true } };
        },
      });

      const interceptor = registry.resolve('TestModel');
      const result = await interceptor.beforeCreate({ name: 'Test' }, {});

      expect(callOrder).toEqual(['global', 'model']);
      expect(result.data.global).toBe(true);
      expect(result.data.model).toBe(true);
    });

    it('should respect global interceptor priority', async () => {
      registry.registerGlobal(
        {
          async beforeCreate(data, ctx) {
            callOrder.push('low');
            return { data };
          },
        },
        0
      );

      registry.registerGlobal(
        {
          async beforeCreate(data, ctx) {
            callOrder.push('high');
            return { data };
          },
        },
        10
      );

      registry.registerGlobal(
        {
          async beforeCreate(data, ctx) {
            callOrder.push('medium');
            return { data };
          },
        },
        5
      );

      const interceptor = registry.resolve('AnyModel');
      await interceptor.beforeCreate({}, {});

      expect(callOrder).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('Schema Extension', () => {
    it('should compose schema extensions from global and model', () => {
      registry.registerGlobal({
        extendSchema(schema, ctx) {
          return { ...schema, globalRule: true };
        },
      });

      registry.register('TestModel', {
        extendSchema(schema, ctx) {
          return { ...schema, modelRule: true };
        },
      });

      const interceptor = registry.resolve('TestModel');
      const result = interceptor.extendSchema({ baseRule: true }, {});

      expect(result.baseRule).toBe(true);
      expect(result.globalRule).toBe(true);
      expect(result.modelRule).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should call onError hook when available', async () => {
      registry.register('ErrorModel', {
        async onError(error, ctx) {
          return {
            data: {
              handled: true,
              response: {
                status: 400,
                body: { error: 'Custom error message' },
              },
            },
          };
        },
      });

      const interceptor = registry.resolve('ErrorModel');
      const error = new Error('Test error');
      const result = await interceptor.onError(error, {});

      expect(result.data.handled).toBe(true);
      expect(result.data.response.status).toBe(400);
    });
  });

  describe('Full CRUD Lifecycle', () => {
    beforeEach(() => {
      registry.register('CrudModel', {
        async beforeList(query, ctx) {
          callOrder.push('beforeList');
          return { data: { ...query, filtered: true } };
        },
        async afterList(response, ctx) {
          callOrder.push('afterList');
          return { data: { ...response, transformed: true } };
        },
        async beforeRead(id, ctx) {
          callOrder.push('beforeRead');
          return { data: id };
        },
        async afterRead(record, ctx) {
          callOrder.push('afterRead');
          return { data: { ...record, redacted: true } };
        },
        async beforeUpdate(data, ctx) {
          callOrder.push('beforeUpdate');
          return { data: { ...data, validated: true } };
        },
        async afterUpdate(record, ctx) {
          callOrder.push('afterUpdate');
          return { data: { ...record, notified: true } };
        },
        async beforeDelete(record, ctx) {
          callOrder.push('beforeDelete');
          return { data: record };
        },
        async afterDelete(record, ctx) {
          callOrder.push('afterDelete');
          return { data: { ...record, cleaned: true } };
        },
      });
    });

    it('should handle list lifecycle', async () => {
      const interceptor = registry.resolve('CrudModel');

      const v1 = await interceptor.beforeList({ page: 1 }, {});
      expect(v1.data.filtered).toBe(true);

      const v2 = await interceptor.afterList({ results: [] }, {});
      expect(v2.data.transformed).toBe(true);

      expect(callOrder).toEqual(['beforeList', 'afterList']);
    });

    it('should handle read lifecycle', async () => {
      const interceptor = registry.resolve('CrudModel');

      await interceptor.beforeRead('123', {});
      const v2 = await interceptor.afterRead({ id: '123', secret: 'x' }, {});

      expect(v2.data.redacted).toBe(true);
      expect(callOrder).toEqual(['beforeRead', 'afterRead']);
    });

    it('should handle update lifecycle', async () => {
      const interceptor = registry.resolve('CrudModel');

      const v1 = await interceptor.beforeUpdate({ name: 'New' }, {});
      expect(v1.data.validated).toBe(true);

      const v2 = await interceptor.afterUpdate({ id: 1, name: 'New' }, {});
      expect(v2.data.notified).toBe(true);

      expect(callOrder).toEqual(['beforeUpdate', 'afterUpdate']);
    });

    it('should handle delete lifecycle', async () => {
      const interceptor = registry.resolve('CrudModel');

      await interceptor.beforeDelete({ id: 1 }, {});
      const v2 = await interceptor.afterDelete({ id: 1 }, {});

      expect(v2.data.cleaned).toBe(true);
      expect(callOrder).toEqual(['beforeDelete', 'afterDelete']);
    });
  });
});
