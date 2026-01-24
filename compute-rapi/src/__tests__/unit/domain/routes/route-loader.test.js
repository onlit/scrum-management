/**
 * Tests for Domain Route Loader
 *
 * Auto-discovers and loads custom routes from domain/routes directory.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const express = require('express');

const {
  loadDomainRoutes,
  createDomainRouteStub,
  listDomainRoutes,
} = require('../../../../computeConstructors/api/domain/routes/route-loader.template.js');

describe('Route Loader', () => {
  let tempDir;

  beforeEach(() => {
    // Create temp directory for test routes
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'routes-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('loadDomainRoutes', () => {
    it('should return empty router for non-existent directory', () => {
      const router = loadDomainRoutes('/non/existent/path');

      expect(router).toBeDefined();
      // Router should have no routes
      expect(router.stack.length).toBe(0);
    });

    it('should return router instance', () => {
      const router = loadDomainRoutes(tempDir);

      expect(router).toBeDefined();
      expect(typeof router.use).toBe('function');
      expect(typeof router.get).toBe('function');
    });

    it('should ignore non-route files', () => {
      fs.writeFileSync(path.join(tempDir, 'helper.js'), 'module.exports = {}');
      fs.writeFileSync(path.join(tempDir, 'readme.md'), '# Test');

      const router = loadDomainRoutes(tempDir);

      // Only route files should be loaded
      expect(router.stack.length).toBe(0);
    });

    it('should load route files with function exports', () => {
      // Create a simple middleware function (not requiring express)
      const routeCode = `
        module.exports = function(req, res, next) {
          res.json({ loaded: true });
        };
      `;
      fs.writeFileSync(path.join(tempDir, 'simple.routes.js'), routeCode);

      const router = loadDomainRoutes(tempDir);

      // Should have mounted the route
      expect(router.stack.length).toBe(1);
    });

    it('should skip invalid route modules', () => {
      // Invalid module (exports a string)
      fs.writeFileSync(path.join(tempDir, 'invalid.routes.js'), `
        module.exports = 'not a router';
      `);

      // Should not throw
      const router = loadDomainRoutes(tempDir);
      expect(router).toBeDefined();
    });

    it('should skip files that fail to load', () => {
      // File with syntax error
      fs.writeFileSync(path.join(tempDir, 'broken.routes.js'), `
        module.exports = { this is not valid javascript
      `);

      // Should not throw
      const router = loadDomainRoutes(tempDir);
      expect(router).toBeDefined();
    });

    it('should load multiple valid route files', () => {
      // Create valid route functions
      fs.writeFileSync(path.join(tempDir, 'one.routes.js'), `
        module.exports = function(req, res, next) { next(); };
      `);
      fs.writeFileSync(path.join(tempDir, 'two.routes.js'), `
        module.exports = function(req, res, next) { next(); };
      `);

      const router = loadDomainRoutes(tempDir);

      expect(router.stack.length).toBe(2);
    });
  });

  describe('listDomainRoutes', () => {
    it('should return empty array for non-existent directory', () => {
      const routes = listDomainRoutes('/non/existent/path');
      expect(routes).toEqual([]);
    });

    it('should list only route files', () => {
      fs.writeFileSync(path.join(tempDir, 'employee.routes.js'), 'module.exports = {};');
      fs.writeFileSync(path.join(tempDir, 'department.routes.js'), 'module.exports = {};');
      fs.writeFileSync(path.join(tempDir, 'helper.js'), 'module.exports = {};');

      const routes = listDomainRoutes(tempDir);

      expect(routes).toContain('employee.routes.js');
      expect(routes).toContain('department.routes.js');
      expect(routes).not.toContain('helper.js');
      expect(routes.length).toBe(2);
    });
  });

  describe('createDomainRouteStub', () => {
    it('should create a route stub file', () => {
      const filePath = createDomainRouteStub(tempDir, 'employee-reports');

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toContain('employee-reports.routes.js');
    });

    it('should create directory if it does not exist', () => {
      const nestedDir = path.join(tempDir, 'nested', 'routes');
      const filePath = createDomainRouteStub(nestedDir, 'test');

      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should throw if file already exists', () => {
      createDomainRouteStub(tempDir, 'existing');

      expect(() => createDomainRouteStub(tempDir, 'existing')).toThrow(
        'Route file already exists'
      );
    });

    it('should include helpful comments in stub', () => {
      const filePath = createDomainRouteStub(tempDir, 'my-feature');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).toContain('my-feature Routes');
      expect(content).toContain('NEVER overwritten by the generator');
      expect(content).toContain('express.Router()');
    });

    it('should create syntactically valid JavaScript', () => {
      const filePath = createDomainRouteStub(tempDir, 'test-route');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Should not throw when parsing
      expect(() => {
        new Function(content);
      }).not.toThrow();
    });
  });
});
