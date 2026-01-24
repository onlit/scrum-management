/**
 * Tests for Domain Layer Scaffolding Utilities
 *
 * Creates protected domain layer structure on first generation.
 * Never overwrites existing files to preserve custom business logic.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  scaffoldDomainLayer,
  scaffoldModelInterceptor,
  scaffoldModelInterceptorTest,
  scaffoldAllInterceptors,
  DOMAIN_DIRECTORIES,
} = require('../../../utils/api/domainScaffoldUtils.js');

describe('domainScaffoldUtils', () => {
  let testDir;

  beforeEach(() => {
    // Create unique temp directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'domain-scaffold-test-'));
  });

  afterEach(() => {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('DOMAIN_DIRECTORIES', () => {
    it('should export the list of domain directories', () => {
      expect(Array.isArray(DOMAIN_DIRECTORIES)).toBe(true);
      expect(DOMAIN_DIRECTORIES).toContain('src/domain/interceptors');
      expect(DOMAIN_DIRECTORIES).toContain('src/domain/schemas');
    });

    it('should include domain routes directory', () => {
      expect(DOMAIN_DIRECTORIES).toContain('src/domain/routes/v1');
    });

    it('should include test directory paths', () => {
      expect(DOMAIN_DIRECTORIES).toContain('tests/domain/unit/interceptors');
      expect(DOMAIN_DIRECTORIES).toContain('tests/domain/unit/routes');
      expect(DOMAIN_DIRECTORIES).toContain('tests/domain/unit/schemas');
      expect(DOMAIN_DIRECTORIES).toContain(
        'tests/domain/integration/interceptors'
      );
      expect(DOMAIN_DIRECTORIES).toContain('tests/domain/setup');
    });

    it('should include errors and contracts/schemas directories (matching core structure)', () => {
      expect(DOMAIN_DIRECTORIES).toContain('tests/domain/integration/errors');
      expect(DOMAIN_DIRECTORIES).toContain('tests/domain/contracts/schemas');
    });
  });

  describe('PROTECTED_TEMPLATES', () => {
    it('should export the list of protected templates', () => {
      const {
        PROTECTED_TEMPLATES,
      } = require('../../../utils/api/domainScaffoldUtils.js');
      expect(Array.isArray(PROTECTED_TEMPLATES)).toBe(true);
      expect(PROTECTED_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    });

    it('should include all domain layer templates', () => {
      const {
        PROTECTED_TEMPLATES,
      } = require('../../../utils/api/domainScaffoldUtils.js');
      const templatePaths = PROTECTED_TEMPLATES.map((t) => t.template);

      expect(templatePaths).toContain('domain/routes/route-loader.template.js');
      expect(templatePaths).toContain('domain/schemas/base.schema.template.js');
    });

    it('should include all core infrastructure templates', () => {
      const {
        PROTECTED_TEMPLATES,
      } = require('../../../utils/api/domainScaffoldUtils.js');
      const templatePaths = PROTECTED_TEMPLATES.map((t) => t.template);

      expect(templatePaths).toContain(
        'core/interfaces/query-builder.interface.template.js'
      );
      expect(templatePaths).toContain(
        'core/exceptions/domain.exception.template.js'
      );
    });
  });

  describe('transformTemplateContent', () => {
    it('should convert relative template imports to path aliases', () => {
      const {
        transformTemplateContent,
      } = require('../../../utils/api/domainScaffoldUtils.js');

      const input = `const { QueryBuilder } = require('../../core/interfaces/query-builder.interface.template.js');`;
      const expected = `const { QueryBuilder } = require('#core/interfaces/query-builder.interface.js');`;

      expect(transformTemplateContent(input)).toBe(expected);
    });

    it('should handle multiple require statements', () => {
      const {
        transformTemplateContent,
      } = require('../../../utils/api/domainScaffoldUtils.js');

      const input = `
const { QueryBuilder } = require('../../core/interfaces/query-builder.interface.template.js');
const { DomainException } = require('../../core/exceptions/domain.exception.template.js');
`;
      const result = transformTemplateContent(input);

      expect(result).toContain(
        `require('#core/interfaces/query-builder.interface.js')`
      );
      expect(result).toContain(
        `require('#core/exceptions/domain.exception.js')`
      );
    });

    it('should remove .template from output filenames', () => {
      const {
        transformTemplateContent,
      } = require('../../../utils/api/domainScaffoldUtils.js');

      const input = `require('../core/interfaces/interceptor.interface.template.js')`;
      const expected = `require('#core/interfaces/interceptor.interface.js')`;

      expect(transformTemplateContent(input)).toBe(expected);
    });

    it('should handle domain layer paths', () => {
      const {
        transformTemplateContent,
      } = require('../../../utils/api/domainScaffoldUtils.js');

      const input = `require('../domain/interceptors/interceptor.registry.template.js')`;
      const expected = `require('#domain/interceptors/interceptor.registry.js')`;

      expect(transformTemplateContent(input)).toBe(expected);
    });

    it('should preserve non-template require statements', () => {
      const {
        transformTemplateContent,
      } = require('../../../utils/api/domainScaffoldUtils.js');

      const input = `const express = require('express');`;
      expect(transformTemplateContent(input)).toBe(input);
    });

    it('should handle commented require statements', () => {
      const {
        transformTemplateContent,
      } = require('../../../utils/api/domainScaffoldUtils.js');

      const input = `// const { protect } = require('#middlewares/protect.js');`;
      expect(transformTemplateContent(input)).toBe(input);
    });
  });

  describe('scaffoldDomainLayer', () => {
    it('should transform template imports to path aliases in generated files', async () => {
      await scaffoldDomainLayer(testDir);

      const routeLoaderPath = path.join(
        testDir,
        'src/domain/routes/route-loader.js'
      );

      // Skip if file doesn't exist yet (will fail until we implement)
      if (!fs.existsSync(routeLoaderPath)) {
        throw new Error(
          'route-loader.js not generated - implementation needed'
        );
      }

      const content = fs.readFileSync(routeLoaderPath, 'utf-8');

      // Should use path aliases, not relative imports
      expect(content).not.toContain('.template.js');
      expect(content).not.toContain("require('../..");
    });
    it('should create domain directory structure', async () => {
      await scaffoldDomainLayer(testDir);

      expect(fs.existsSync(path.join(testDir, 'src/domain/interceptors'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(testDir, 'src/domain/schemas'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(testDir, 'src/domain/routes/v1'))).toBe(
        true
      );
    });

    it('should create interceptor registry', async () => {
      await scaffoldDomainLayer(testDir);

      const registryPath = path.join(
        testDir,
        'src/domain/interceptors/interceptor.registry.js'
      );
      expect(fs.existsSync(registryPath)).toBe(true);

      // Verify content includes the registry class
      const content = fs.readFileSync(registryPath, 'utf-8');
      expect(content).toContain('InterceptorRegistry');
    });

    it('should create interceptor interface', async () => {
      await scaffoldDomainLayer(testDir);

      const interfacePath = path.join(
        testDir,
        'src/core/interfaces/interceptor.interface.js'
      );
      expect(fs.existsSync(interfacePath)).toBe(true);

      // Verify content includes lifecycle hooks
      const content = fs.readFileSync(interfacePath, 'utf-8');
      expect(content).toContain('LIFECYCLE_HOOKS');
    });

    it('should create route loader', async () => {
      await scaffoldDomainLayer(testDir);

      const loaderPath = path.join(
        testDir,
        'src/domain/routes/route-loader.js'
      );
      expect(fs.existsSync(loaderPath)).toBe(true);

      const content = fs.readFileSync(loaderPath, 'utf-8');
      expect(content).toContain('loadDomainRoutes');
    });

    it('should create query builder interface', async () => {
      await scaffoldDomainLayer(testDir);

      const builderPath = path.join(
        testDir,
        'src/core/interfaces/query-builder.interface.js'
      );
      expect(fs.existsSync(builderPath)).toBe(true);

      const content = fs.readFileSync(builderPath, 'utf-8');
      expect(content).toContain('QueryBuilder');
    });

    it('should create domain exception', async () => {
      await scaffoldDomainLayer(testDir);

      const exceptionPath = path.join(
        testDir,
        'src/core/exceptions/domain.exception.js'
      );
      expect(fs.existsSync(exceptionPath)).toBe(true);

      const content = fs.readFileSync(exceptionPath, 'utf-8');
      expect(content).toContain('DomainException');
      expect(content).toContain('ERROR_TYPES');
    });

    it('should NOT overwrite existing domain files', async () => {
      // Create existing custom file
      const customPath = path.join(
        testDir,
        'src/domain/interceptors/custom.js'
      );
      fs.mkdirSync(path.dirname(customPath), { recursive: true });
      fs.writeFileSync(customPath, 'custom code');

      await scaffoldDomainLayer(testDir);

      expect(fs.readFileSync(customPath, 'utf-8')).toBe('custom code');
    });

    it('should NOT overwrite existing registry', async () => {
      // Create existing registry
      const registryPath = path.join(
        testDir,
        'src/domain/interceptors/interceptor.registry.js'
      );
      fs.mkdirSync(path.dirname(registryPath), { recursive: true });
      fs.writeFileSync(registryPath, 'custom registry');

      await scaffoldDomainLayer(testDir);

      expect(fs.readFileSync(registryPath, 'utf-8')).toBe('custom registry');
    });

    it('should return created and skipped arrays', async () => {
      const result = await scaffoldDomainLayer(testDir);

      expect(Array.isArray(result.created)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(result.created.length).toBeGreaterThan(0);
    });

    it('should create tests/domain directory structure', async () => {
      await scaffoldDomainLayer(testDir);

      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/unit/interceptors'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/unit/routes'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/unit/schemas'))
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(testDir, 'tests/domain/integration/interceptors')
        )
      ).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'tests/domain/setup'))).toBe(
        true
      );
    });

    it('should create tests/domain/integration/errors directory for domain error tests', async () => {
      await scaffoldDomainLayer(testDir);

      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/integration/errors'))
      ).toBe(true);
    });

    it('should create tests/domain/contracts/schemas directory for domain contract schemas', async () => {
      await scaffoldDomainLayer(testDir);

      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/contracts/schemas'))
      ).toBe(true);
    });

    it('should create .gitkeep files in empty directories for Git tracking', async () => {
      await scaffoldDomainLayer(testDir);

      // Verify .gitkeep files exist in directories that would otherwise be empty
      expect(
        fs.existsSync(
          path.join(testDir, 'tests/domain/integration/errors/.gitkeep')
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(testDir, 'tests/domain/contracts/schemas/.gitkeep')
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(testDir, 'tests/domain/contracts/routes/.gitkeep')
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(testDir, 'tests/domain/unit/middleware/.gitkeep')
        )
      ).toBe(true);
      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/unit/routes/.gitkeep'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(testDir, 'tests/domain/unit/queues/.gitkeep'))
      ).toBe(true);
    });

    it('should create README.md in tests/domain explaining test organization', async () => {
      await scaffoldDomainLayer(testDir);

      const readmePath = path.join(testDir, 'tests/domain/README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Domain Tests');
      expect(content).toContain('interceptors');
    });

    it('should create interceptor lifecycle integration test template', async () => {
      await scaffoldDomainLayer(testDir);

      const testPath = path.join(
        testDir,
        'tests/domain/integration/interceptors/lifecycle.test.js'
      );
      expect(fs.existsSync(testPath)).toBe(true);

      const content = fs.readFileSync(testPath, 'utf-8');
      expect(content).toContain('Interceptor Lifecycle Integration');
      expect(content).toContain('beforeCreate');
      expect(content).toContain('afterCreate');
    });

    it('should create schema README explaining core vs domain separation', async () => {
      await scaffoldDomainLayer(testDir);

      const readmePath = path.join(testDir, 'src/domain/schemas/README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Core Schemas');
      expect(content).toContain('Domain Schemas');
      expect(content).toContain('extendSchema');
    });

    it('should create domain Bull queue directory structure', async () => {
      await scaffoldDomainLayer(testDir);

      expect(fs.existsSync(path.join(testDir, 'src/domain/bullQueues'))).toBe(
        true
      );
      expect(
        fs.existsSync(path.join(testDir, 'src/domain/bullQueues/queues'))
      ).toBe(true);
      expect(
        fs.existsSync(path.join(testDir, 'src/domain/bullQueues/workers'))
      ).toBe(true);
    });

    it('should create queue-loader.js for auto-discovery', async () => {
      await scaffoldDomainLayer(testDir);

      const loaderPath = path.join(
        testDir,
        'src/domain/bullQueues/queue-loader.js'
      );
      expect(fs.existsSync(loaderPath)).toBe(true);

      const content = fs.readFileSync(loaderPath, 'utf-8');
      expect(content).toContain('loadDomainQueues');
      expect(content).toContain('loadDomainWorkers');
    });

    it('should create Bull queues README explaining queue patterns', async () => {
      await scaffoldDomainLayer(testDir);

      const readmePath = path.join(testDir, 'src/domain/bullQueues/README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Domain Queues');
      expect(content).toContain('Worker');
    });

    it('should create domain middlewares directory', async () => {
      await scaffoldDomainLayer(testDir);

      expect(fs.existsSync(path.join(testDir, 'src/domain/middlewares'))).toBe(
        true
      );
    });

    it('should create middleware-loader.js', async () => {
      await scaffoldDomainLayer(testDir);

      const loaderPath = path.join(
        testDir,
        'src/domain/middlewares/middleware-loader.js'
      );
      expect(fs.existsSync(loaderPath)).toBe(true);

      const content = fs.readFileSync(loaderPath, 'utf-8');
      expect(content).toContain('loadDomainMiddleware');
    });

    it('should create middleware README explaining middleware patterns', async () => {
      await scaffoldDomainLayer(testDir);

      const readmePath = path.join(testDir, 'src/domain/middlewares/README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Domain Middlewares');
    });

    it('should create example route stub', async () => {
      await scaffoldDomainLayer(testDir);

      const stubPath = path.join(
        testDir,
        'src/domain/routes/v1/example.routes.js'
      );
      expect(fs.existsSync(stubPath)).toBe(true);

      const content = fs.readFileSync(stubPath, 'utf-8');
      expect(content).toContain('express.Router');
      expect(content).toContain('protect');
      expect(content).toContain('wrapExpressAsync');
    });

    it('should create routes README', async () => {
      await scaffoldDomainLayer(testDir);

      const readmePath = path.join(testDir, 'src/domain/routes/README.md');
      expect(fs.existsSync(readmePath)).toBe(true);

      const content = fs.readFileSync(readmePath, 'utf-8');
      expect(content).toContain('Domain Routes');
      expect(content).toContain('Auto-Discovery');
    });
  });

  describe('scaffoldModelInterceptor', () => {
    beforeEach(async () => {
      // Scaffold domain layer first
      await scaffoldDomainLayer(testDir);
    });

    it('should create interceptor stub for new model', async () => {
      const result = await scaffoldModelInterceptor(testDir, 'Employee');

      const interceptorPath = path.join(
        testDir,
        'src/domain/interceptors/employee.interceptor.js'
      );
      expect(fs.existsSync(interceptorPath)).toBe(true);
      expect(result.created).toBe(true);
      expect(result.path).toBe(interceptorPath);
    });

    it('should replace template placeholders', async () => {
      await scaffoldModelInterceptor(testDir, 'Employee');

      const interceptorPath = path.join(
        testDir,
        'src/domain/interceptors/employee.interceptor.js'
      );
      const content = fs.readFileSync(interceptorPath, 'utf-8');

      // Should have replaced @gen{MODEL_NAME|Pascal} with Employee
      expect(content).toContain('Employee');
      expect(content).not.toContain('@gen{MODEL_NAME|Pascal}');
    });

    it('should NOT overwrite existing interceptor', async () => {
      const interceptorPath = path.join(
        testDir,
        'src/domain/interceptors/employee.interceptor.js'
      );
      fs.writeFileSync(interceptorPath, 'custom interceptor');

      const result = await scaffoldModelInterceptor(testDir, 'Employee');

      expect(fs.readFileSync(interceptorPath, 'utf-8')).toBe(
        'custom interceptor'
      );
      expect(result.created).toBe(false);
    });

    it('should handle PascalCase model names correctly', async () => {
      await scaffoldModelInterceptor(testDir, 'UserProfile');

      const interceptorPath = path.join(
        testDir,
        'src/domain/interceptors/userProfile.interceptor.js'
      );
      expect(fs.existsSync(interceptorPath)).toBe(true);
    });
  });

  describe('scaffoldModelInterceptorTest', () => {
    let tempDir;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-test-'));
      // Create required directory structure
      fs.mkdirSync(path.join(tempDir, 'tests/domain/unit/interceptors'), {
        recursive: true,
      });
    });

    afterEach(() => {
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should create interceptor test stub for a model', async () => {
      const result = await scaffoldModelInterceptorTest(tempDir, 'Candidate');

      expect(result.created).toBe(true);
      expect(fs.existsSync(result.path)).toBe(true);

      const content = fs.readFileSync(result.path, 'utf-8');
      expect(content).toContain('Candidate Interceptor');
      expect(content).toContain('candidate.interceptor.js');
    });

    it('should not overwrite existing test file', async () => {
      const testPath = path.join(
        tempDir,
        'tests/domain/unit/interceptors/candidate.interceptor.test.js'
      );
      fs.writeFileSync(testPath, '// custom test');

      const result = await scaffoldModelInterceptorTest(tempDir, 'Candidate');

      expect(result.created).toBe(false);
      expect(fs.readFileSync(testPath, 'utf-8')).toBe('// custom test');
    });
  });

  describe('scaffoldAllInterceptors', () => {
    beforeEach(async () => {
      await scaffoldDomainLayer(testDir);
    });

    it('should create interceptors for all models', async () => {
      const models = [{ name: 'Employee' }, { name: 'Department' }];

      const result = await scaffoldAllInterceptors(testDir, models);

      expect(result.created.length).toBe(6); // 2 interceptors + 2 tests + 2 filter extensions
      expect(
        fs.existsSync(
          path.join(testDir, 'src/domain/interceptors/employee.interceptor.js')
        )
      ).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            testDir,
            'src/domain/interceptors/department.interceptor.js'
          )
        )
      ).toBe(true);
    });

    it('should skip existing interceptors', async () => {
      // Create one interceptor manually
      const existingPath = path.join(
        testDir,
        'src/domain/interceptors/employee.interceptor.js'
      );
      fs.writeFileSync(existingPath, 'custom');

      const models = [{ name: 'Employee' }, { name: 'Department' }];
      const result = await scaffoldAllInterceptors(testDir, models);

      // Employee: interceptor skipped (1), test + filters created (2)
      // Department: interceptor + test + filters created (3)
      // Total: 5 created, 1 skipped
      expect(result.created.length).toBe(5);
      expect(result.skipped.length).toBe(1);
    });

    it('should handle empty models array', async () => {
      const result = await scaffoldAllInterceptors(testDir, []);

      expect(result.created).toEqual([]);
      expect(result.skipped).toEqual([]);
    });

  });
});
