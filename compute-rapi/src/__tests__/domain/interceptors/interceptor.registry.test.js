/**
 * Tests for Interceptor Registry
 *
 * Manages model-specific and global interceptors with hook composition.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  InterceptorRegistry,
  getRegistry,
  resetRegistry,
  discoverInterceptors,
  initializeRegistry,
} = require('../../../computeConstructors/api/domain/interceptors/interceptor.registry.template.js');

describe('InterceptorRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new InterceptorRegistry();
  });

  describe('register', () => {
    it('should register an interceptor for a model', () => {
      const interceptor = { beforeCreate: async () => ({ data: {} }) };
      registry.register('Employee', interceptor);

      const resolved = registry.resolve('Employee');
      expect(typeof resolved.beforeCreate).toBe('function');
    });

    it('should throw error for invalid interceptor', () => {
      const invalid = { beforeCreate: 'not a function' };
      expect(() => registry.register('Model', invalid)).toThrow(
        'Invalid interceptor'
      );
    });
  });

  describe('resolve', () => {
    it('should return no-op interceptor for unregistered model', () => {
      const resolved = registry.resolve('Unknown');
      expect(resolved).toBeDefined();
      expect(typeof resolved.beforeCreate).toBe('function');
    });

    it('should merge registered interceptor with defaults', async () => {
      const interceptor = {
        beforeCreate: async () => ({ data: { custom: true } }),
      };
      registry.register('Employee', interceptor);

      const resolved = registry.resolve('Employee');

      // Custom hook should work
      const createResult = await resolved.beforeCreate({});
      expect(createResult.data.custom).toBe(true);

      // Unset hooks should be passthrough
      const readResult = await resolved.afterRead({ id: 1 });
      expect(readResult.data).toEqual({ id: 1 });
    });

    it('should cache resolved interceptors', () => {
      const interceptor = { beforeCreate: async () => ({ data: {} }) };
      registry.register('Employee', interceptor);

      const resolved1 = registry.resolve('Employee');
      const resolved2 = registry.resolve('Employee');

      expect(resolved1).toBe(resolved2);
    });

    it('should invalidate cache on register', () => {
      const interceptor1 = { beforeCreate: async () => ({ data: { v: 1 } }) };
      registry.register('Employee', interceptor1);
      const resolved1 = registry.resolve('Employee');

      const interceptor2 = { beforeCreate: async () => ({ data: { v: 2 } }) };
      registry.register('Employee', interceptor2);
      const resolved2 = registry.resolve('Employee');

      expect(resolved1).not.toBe(resolved2);
    });
  });

  describe('registerGlobal', () => {
    it('should apply global interceptor to all models', async () => {
      const globalInterceptor = {
        afterCreate: async (data) => ({ data: { ...data, audited: true } }),
      };
      registry.registerGlobal(globalInterceptor);

      const resolved = registry.resolve('AnyModel');
      const result = await resolved.afterCreate({ id: 1 });
      expect(result.data.audited).toBe(true);
    });

    it('should run global interceptors before model interceptors', async () => {
      const order = [];

      const globalInterceptor = {
        beforeCreate: async (data) => {
          order.push('global');
          return { data };
        },
      };

      const modelInterceptor = {
        beforeCreate: async (data) => {
          order.push('model');
          return { data };
        },
      };

      registry.registerGlobal(globalInterceptor);
      registry.register('Employee', modelInterceptor);

      const resolved = registry.resolve('Employee');
      await resolved.beforeCreate({});

      expect(order).toEqual(['global', 'model']);
    });

    it('should respect priority order for globals', async () => {
      const order = [];

      registry.registerGlobal(
        {
          beforeCreate: async (data) => {
            order.push('low');
            return { data };
          },
        },
        0
      );

      registry.registerGlobal(
        {
          beforeCreate: async (data) => {
            order.push('high');
            return { data };
          },
        },
        10
      );

      const resolved = registry.resolve('Model');
      await resolved.beforeCreate({});

      expect(order).toEqual(['high', 'low']);
    });

    it('should halt processing if global interceptor returns halt', async () => {
      const globalInterceptor = {
        beforeCreate: async () => ({
          halt: true,
          response: { status: 403, body: { error: 'Forbidden' } },
        }),
      };

      const modelInterceptor = {
        beforeCreate: async () => ({ data: { reached: true } }),
      };

      registry.registerGlobal(globalInterceptor);
      registry.register('Employee', modelInterceptor);

      const resolved = registry.resolve('Employee');
      const result = await resolved.beforeCreate({});

      expect(result.halt).toBe(true);
      expect(result.response.status).toBe(403);
      expect(result.data).toBeUndefined();
    });
  });

  describe('extendSchema hook', () => {
    it('should compose schema extensions synchronously', () => {
      const globalInterceptor = {
        extendSchema: (schema) => ({ ...schema, global: true }),
      };

      const modelInterceptor = {
        extendSchema: (schema) => ({ ...schema, model: true }),
      };

      registry.registerGlobal(globalInterceptor);
      registry.register('Employee', modelInterceptor);

      const resolved = registry.resolve('Employee');
      const result = resolved.extendSchema({ base: true });

      expect(result.base).toBe(true);
      expect(result.global).toBe(true);
      expect(result.model).toBe(true);
    });
  });

  describe('getRegisteredModels', () => {
    it('should return list of registered model names', () => {
      registry.register('Employee', {});
      registry.register('Department', {});

      const models = registry.getRegisteredModels();
      expect(models).toContain('Employee');
      expect(models).toContain('Department');
    });

    it('should return empty array when no models registered', () => {
      const models = registry.getRegisteredModels();
      expect(models).toEqual([]);
    });
  });

  describe('hasInterceptor', () => {
    it('should return true for registered models', () => {
      registry.register('Employee', {});
      expect(registry.hasInterceptor('Employee')).toBe(true);
    });

    it('should return false for unregistered models', () => {
      expect(registry.hasInterceptor('Unknown')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all registrations', () => {
      registry.register('Employee', {});
      registry.registerGlobal({});

      registry.clear();

      expect(registry.getRegisteredModels()).toEqual([]);
      expect(registry.hasInterceptor('Employee')).toBe(false);
    });
  });
});

describe('Singleton Registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  afterEach(() => {
    resetRegistry();
  });

  it('should return same instance on multiple calls', () => {
    const registry1 = getRegistry();
    const registry2 = getRegistry();
    expect(registry1).toBe(registry2);
  });

  it('should return new instance after reset', () => {
    const registry1 = getRegistry();
    registry1.register('Test', {});

    resetRegistry();
    const registry2 = getRegistry();

    expect(registry2.hasInterceptor('Test')).toBe(false);
  });
});

describe('Auto-Discovery', () => {
  let tempDir;

  beforeEach(() => {
    resetRegistry();
    // Create temp directory for test interceptors
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'interceptor-test-'));
  });

  afterEach(() => {
    resetRegistry();
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('discoverInterceptors', () => {
    it('should return empty map for non-existent directory', async () => {
      const discovered = await discoverInterceptors('/non/existent/path');
      expect(discovered.size).toBe(0);
    });

    it('should discover interceptor files matching *.interceptor.js', async () => {
      // Create test interceptor file
      const interceptorCode = `
        module.exports = {
          beforeCreate: async (data) => ({ data }),
        };
      `;
      fs.writeFileSync(path.join(tempDir, 'employee.interceptor.js'), interceptorCode);

      const discovered = await discoverInterceptors(tempDir);

      expect(discovered.size).toBe(1);
      expect(discovered.has('Employee')).toBe(true);
    });

    it('should convert kebab-case filenames to PascalCase', async () => {
      const interceptorCode = `
        module.exports = {
          beforeCreate: async (data) => ({ data }),
        };
      `;
      fs.writeFileSync(path.join(tempDir, 'sales-order.interceptor.js'), interceptorCode);

      const discovered = await discoverInterceptors(tempDir);

      expect(discovered.has('SalesOrder')).toBe(true);
    });

    it('should ignore non-interceptor files', async () => {
      fs.writeFileSync(path.join(tempDir, 'helper.js'), 'module.exports = {}');
      fs.writeFileSync(path.join(tempDir, 'readme.md'), '# Test');

      const interceptorCode = `
        module.exports = {
          beforeCreate: async (data) => ({ data }),
        };
      `;
      fs.writeFileSync(path.join(tempDir, 'employee.interceptor.js'), interceptorCode);

      const discovered = await discoverInterceptors(tempDir);

      expect(discovered.size).toBe(1);
      expect(discovered.has('Employee')).toBe(true);
    });

    it('should skip invalid interceptors', async () => {
      // Invalid interceptor (not a valid object)
      fs.writeFileSync(path.join(tempDir, 'invalid.interceptor.js'), `
        module.exports = { beforeCreate: 'not a function' };
      `);

      // Valid interceptor
      fs.writeFileSync(path.join(tempDir, 'valid.interceptor.js'), `
        module.exports = { beforeCreate: async (data) => ({ data }) };
      `);

      const discovered = await discoverInterceptors(tempDir);

      expect(discovered.size).toBe(1);
      expect(discovered.has('Valid')).toBe(true);
      expect(discovered.has('Invalid')).toBe(false);
    });

    it('should handle files that fail to load', async () => {
      // File with syntax error
      fs.writeFileSync(path.join(tempDir, 'broken.interceptor.js'), `
        module.exports = { this is not valid javascript
      `);

      // Should not throw, just skip the broken file
      const discovered = await discoverInterceptors(tempDir);
      expect(discovered.has('Broken')).toBe(false);
    });

    it('should handle default exports', async () => {
      fs.writeFileSync(path.join(tempDir, 'modern.interceptor.js'), `
        module.exports.default = {
          beforeCreate: async (data) => ({ data }),
        };
      `);

      const discovered = await discoverInterceptors(tempDir);

      expect(discovered.has('Modern')).toBe(true);
    });
  });

  describe('initializeRegistry', () => {
    it('should initialize registry with discovered interceptors', async () => {
      const interceptorCode = `
        module.exports = {
          beforeCreate: async (data) => ({ data: { ...data, initialized: true } }),
        };
      `;
      fs.writeFileSync(path.join(tempDir, 'employee.interceptor.js'), interceptorCode);

      const registry = await initializeRegistry(tempDir);

      expect(registry.hasInterceptor('Employee')).toBe(true);
    });

    it('should return registry even with no interceptors', async () => {
      const registry = await initializeRegistry(tempDir);

      expect(registry).toBeDefined();
      expect(registry.getRegisteredModels()).toEqual([]);
    });

    it('should use singleton registry', async () => {
      const interceptorCode = `
        module.exports = {
          beforeCreate: async (data) => ({ data }),
        };
      `;
      fs.writeFileSync(path.join(tempDir, 'employee.interceptor.js'), interceptorCode);

      await initializeRegistry(tempDir);
      const registry = getRegistry();

      expect(registry.hasInterceptor('Employee')).toBe(true);
    });
  });
});
