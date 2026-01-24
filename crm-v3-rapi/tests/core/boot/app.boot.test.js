/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Application bootstrap and smoke tests.
 * Verify the application initializes correctly and all components wire together.
 * These tests run first and fail fast on initialization issues.
 */

const request = require('supertest');
const { getTestApp, startTestServer } = require('#tests/core/setup/app.js');
const { getPrismaClient } = require('#tests/core/setup/database.js');

describe('Application Bootstrap', () => {
  let app;
  let server;
  let prisma;

  beforeAll(async () => {
    app = await getTestApp();
    server = await startTestServer();
    prisma = getPrismaClient();
  });

  describe('App Initialization', () => {
    it('should export a valid Express application', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
      expect(app.listen).toBeDefined();
      expect(typeof app.listen).toBe('function');
    });

    it('should have request and response handlers', () => {
      expect(app.request).toBeDefined();
      expect(app.response).toBeDefined();
    });
  });

  describe('Database Connection', () => {
    it('should establish database connection successfully', async () => {
      // Simple query to verify connection
      const result = await prisma.$queryRaw`SELECT 1 as connected`;
      expect(result).toBeDefined();
      expect(result[0].connected).toBe(1);
    });

    it('should have Prisma client configured', () => {
      expect(prisma).toBeDefined();
      expect(prisma.$connect).toBeDefined();
      expect(prisma.$disconnect).toBeDefined();
    });
  });

  describe('Middleware Stack', () => {
    it('should have middleware stack configured', () => {
      // Express stores middleware in _router.stack
      const stack = app._router?.stack || [];
      expect(stack.length).toBeGreaterThan(0);
    });

    it('should have error handling middleware', () => {
      const stack = app._router?.stack || [];
      // Error handlers have 4 parameters (err, req, res, next)
      const errorHandlers = stack.filter(
        (layer) => layer.handle && layer.handle.length === 4
      );
      expect(errorHandlers.length).toBeGreaterThan(0);
    });
  });

  describe('Route Registration', () => {
    it('should have routes registered', () => {
      const stack = app._router?.stack || [];
      const routes = stack.filter((layer) => layer.route || layer.name === 'router');
      expect(routes.length).toBeGreaterThan(0);
    });

    it('should have health check endpoint available', async () => {
      const response = await request(server).get('/health');
      // Health endpoint should return 200
      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await request(server).get('/api/v1/non-existent-route-12345');
      expect(response.status).toBe(404);
    });
  });

  describe('Security Middleware', () => {
    it('should have security headers configured', async () => {
      const response = await request(server).get('/health');

      // Helmet should add security headers
      expect(response.headers).toBeDefined();

      // Verify specific Helmet security headers are present
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-dns-prefetch-control']).toBeDefined();
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should not expose server information', async () => {
      const response = await request(server).get('/health');

      // X-Powered-By should be removed by Helmet
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
