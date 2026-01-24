/**
 * Interceptor Lifecycle Integration Tests
 *
 * Tests the complete lifecycle flow through the interceptor system,
 * ensuring hooks are called in correct order and data flows properly.
 *
 * This file is PROTECTED - never overwritten by the generator.
 *
 * @module tests/integration/interceptor.lifecycle.test
 */

const { InterceptorRegistry } = require('#domain/interceptors/interceptor.registry.js');

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
    it('should execute hooks in correct order: beforeValidate -> extendSchema -> afterValidate -> beforeCreate -> afterCreate', async () => {
      registry.register('TestModel', {
        async beforeValidate(data, ctx) {
          callOrder.push('beforeValidate');
          return { data: { ...data, normalized: true } };
        },
        extendSchema(schema, ctx) {
          callOrder.push('extendSchema');
          return schema;
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

      const interceptor = registry.resolve('TestModel');
      const context = { operation: 'create', user: { id: 'test' } };

      // Simulate create lifecycle
      let data = { name: 'Test' };

      const v1 = await interceptor.beforeValidate(data, context);
      data = v1.data;

      interceptor.extendSchema({}, context);

      const v2 = await interceptor.afterValidate(data, context);
      data = v2.data;

      const v3 = await interceptor.beforeCreate(data, context);
      data = v3.data;

      const record = { id: '123', ...data };
      const v4 = await interceptor.afterCreate(record, context);

      expect(callOrder).toEqual([
        'beforeValidate',
        'extendSchema',
        'afterValidate',
        'beforeCreate',
        'afterCreate',
      ]);

      expect(v4.data).toEqual(expect.objectContaining({
        normalized: true,
        validated: true,
        computed: true,
        enriched: true,
      }));
    });
  });

  describe('Update Lifecycle', () => {
    it('should execute hooks: beforeValidate -> extendSchema -> afterValidate -> beforeUpdate -> afterUpdate', async () => {
      registry.register('TestModel', {
        async beforeValidate(data, ctx) {
          callOrder.push('beforeValidate');
          return { data };
        },
        extendSchema(schema, ctx) {
          callOrder.push('extendSchema');
          return schema;
        },
        async afterValidate(data, ctx) {
          callOrder.push('afterValidate');
          return { data };
        },
        async beforeUpdate(data, ctx) {
          callOrder.push('beforeUpdate');
          return { data };
        },
        async afterUpdate(record, ctx) {
          callOrder.push('afterUpdate');
          return { data: record };
        },
      });

      const interceptor = registry.resolve('TestModel');
      const context = { operation: 'update', user: { id: 'test' }, recordId: '123' };

      await interceptor.beforeValidate({}, context);
      interceptor.extendSchema({}, context);
      await interceptor.afterValidate({}, context);
      await interceptor.beforeUpdate({}, context);
      await interceptor.afterUpdate({}, context);

      expect(callOrder).toEqual([
        'beforeValidate',
        'extendSchema',
        'afterValidate',
        'beforeUpdate',
        'afterUpdate',
      ]);
    });
  });

  describe('Delete Lifecycle', () => {
    it('should execute hooks: beforeDelete -> afterDelete', async () => {
      registry.register('TestModel', {
        async beforeDelete(record, ctx) {
          callOrder.push('beforeDelete');
          return { data: record };
        },
        async afterDelete(record, ctx) {
          callOrder.push('afterDelete');
          return { data: record };
        },
      });

      const interceptor = registry.resolve('TestModel');
      const context = { operation: 'delete', user: { id: 'test' }, recordId: '123' };

      await interceptor.beforeDelete({ id: '123' }, context);
      await interceptor.afterDelete({ id: '123' }, context);

      expect(callOrder).toEqual(['beforeDelete', 'afterDelete']);
    });
  });

  describe('Query Lifecycle', () => {
    it('should execute list hooks: beforeList -> afterList', async () => {
      registry.register('TestModel', {
        async beforeList(query, ctx) {
          callOrder.push('beforeList');
          return { data: { ...query, filtered: true } };
        },
        async afterList(response, ctx) {
          callOrder.push('afterList');
          return { data: { ...response, transformed: true } };
        },
      });

      const interceptor = registry.resolve('TestModel');
      const context = { operation: 'list', user: { id: 'test' } };

      const q = await interceptor.beforeList({ page: 1 }, context);
      const r = await interceptor.afterList({ results: [] }, context);

      expect(callOrder).toEqual(['beforeList', 'afterList']);
      expect(q.data.filtered).toBe(true);
      expect(r.data.transformed).toBe(true);
    });

    it('should execute read hooks: beforeRead -> afterRead', async () => {
      registry.register('TestModel', {
        async beforeRead(id, ctx) {
          callOrder.push('beforeRead');
          return { data: id };
        },
        async afterRead(record, ctx) {
          callOrder.push('afterRead');
          return { data: { ...record, redacted: true } };
        },
      });

      const interceptor = registry.resolve('TestModel');
      const context = { operation: 'read', user: { id: 'test' } };

      await interceptor.beforeRead('123', context);
      const r = await interceptor.afterRead({ id: '123', secret: 'x' }, context);

      expect(callOrder).toEqual(['beforeRead', 'afterRead']);
      expect(r.data.redacted).toBe(true);
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

    it('should respect global interceptor priority (higher runs first)', async () => {
      registry.registerGlobal({ async beforeCreate(d) { callOrder.push('low'); return { data: d }; } }, 0);
      registry.registerGlobal({ async beforeCreate(d) { callOrder.push('high'); return { data: d }; } }, 10);
      registry.registerGlobal({ async beforeCreate(d) { callOrder.push('med'); return { data: d }; } }, 5);

      const interceptor = registry.resolve('AnyModel');
      await interceptor.beforeCreate({}, {});

      expect(callOrder).toEqual(['high', 'med', 'low']);
    });
  });

  describe('Halt Processing', () => {
    it('should stop processing when halt is true', async () => {
      registry.register('SecureModel', {
        async beforeCreate(data, ctx) {
          return {
            halt: true,
            response: { status: 403, body: { error: 'Not allowed' } },
          };
        },
      });

      const interceptor = registry.resolve('SecureModel');
      const result = await interceptor.beforeCreate({}, {});

      expect(result.halt).toBe(true);
      expect(result.response.status).toBe(403);
    });

    it('should skip model interceptor when global halts', async () => {
      registry.registerGlobal({
        async beforeCreate() {
          return { halt: true, response: { status: 401, body: { error: 'Auth required' } } };
        },
      });

      registry.register('SecureModel', {
        async beforeCreate(data) {
          callOrder.push('model-should-not-run');
          return { data };
        },
      });

      const interceptor = registry.resolve('SecureModel');
      const result = await interceptor.beforeCreate({}, {});

      expect(result.halt).toBe(true);
      expect(callOrder).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should call onError hook when available', async () => {
      registry.register('ErrorModel', {
        async onError(error, ctx) {
          return {
            data: {
              handled: true,
              response: { status: 400, body: { error: 'Custom error' } },
            },
          };
        },
      });

      const interceptor = registry.resolve('ErrorModel');
      const result = await interceptor.onError(new Error('Test'), {});

      expect(result.data.handled).toBe(true);
      expect(result.data.response.status).toBe(400);
    });
  });

  describe('Unregistered Models', () => {
    it('should use passthrough for unregistered models', async () => {
      const interceptor = registry.resolve('UnknownModel');
      const input = { name: 'Test' };

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
});
