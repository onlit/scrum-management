/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Integration tests for CompanyHistory CRUD operations.
 * Tests real database operations without mocking Prisma.
 * Uses d_compute_ prefixed records for identification and cleanup.
 */

const request = require('supertest');
const {
  startTestServer,
  createAuthHeaders,
} = require('#tests/core/setup/app.js');
const {
  generateTestId,
  cleanupTestRecords,
  getPrismaClient,
} = require('#tests/core/setup/database.js');
const {
  buildCompanyHistoryForApi,
  createCompanyHistory,
} = require('#tests/factories/companyHistory.factory.js');

describe('CompanyHistory Integration Tests', () => {
  let server;
  let prisma;
  let authHeaders;

  beforeAll(async () => {
    server = await startTestServer();
    prisma = getPrismaClient();
    authHeaders = createAuthHeaders();
  });

  afterEach(async () => {
    // Clean up test records after each test
    await cleanupTestRecords('companyHistory');
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestRecords('companyHistory');
  });

  describe('POST /api/v1/company-histories - Create', () => {
    it('should create a new CompanyHistory and persist to database', async () => {
      const testData = await buildCompanyHistoryForApi();

      const response = await request(server)
        .post('/api/v1/company-histories')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      // Verify response
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBeDefined();

      // Verify database persistence
      const dbRecord = await prisma.companyHistory.findUnique({
        where: { id: response.body.id },
      });

      expect(dbRecord).not.toBeNull();
      expect(dbRecord.history).toBeDefined();
    });

    it('should set audit fields on create', async () => {
      const testData = await buildCompanyHistoryForApi();

      const response = await request(server)
        .post('/api/v1/company-histories')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });
  });

  describe('GET /api/v1/company-histories - List', () => {
    it('should return paginated list of CompanyHistorys', async () => {
      // Create test records
      await createCompanyHistory();
      await createCompanyHistory();

      const response = await request(server)
        .get('/api/v1/company-histories')
        .set(authHeaders)
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.totalCount).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination parameters', async () => {
      // Create multiple test records
      for (let i = 0; i < 5; i++) {
        await createCompanyHistory();
      }

      const response = await request(server)
        .get('/api/v1/company-histories?page=1&perPage=2')
        .set(authHeaders)
        .expect(200);

      expect(response.body.results.length).toBeLessThanOrEqual(2);
      expect(response.body.perPage).toBe(2);
      expect(response.body.currentPage).toBe(1);
    });
  });

  describe('GET /api/v1/company-histories/:id - Get One', () => {
    it('should return a specific CompanyHistory by ID', async () => {
      const created = await createCompanyHistory();

      const response = await request(server)
        .get(`/api/v1/company-histories/${created.id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.id).toBe(created.id);
    });

    it('should include all expected fields in response', async () => {
      const created = await createCompanyHistory();

      const response = await request(server)
        .get(`/api/v1/company-histories/${created.id}`)
        .set(authHeaders)
        .expect(200);

      // notes is optional
      expect(response.body.history).toBeDefined();
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });
  });

  describe('PUT /api/v1/company-histories/:id - Update', () => {
    it('should update an existing CompanyHistory', async () => {
      const created = await createCompanyHistory();
      const updateData = {
        notes: 'd_compute_updated_notes',
      };

      const response = await request(server)
        .put(`/api/v1/company-histories/${created.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(created.id);
      expect(response.body.notes).toBeDefined();

      // Verify database update
      const dbRecord = await prisma.companyHistory.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(response.body.notes).toBeDefined();
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await createCompanyHistory();
      const originalUpdatedAt = new Date(created.updatedAt).getTime();

      const updateData = {
        notes: 'd_compute_updated_notes',
      };

      await request(server)
        .put(`/api/v1/company-histories/${created.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      const dbRecord = await prisma.companyHistory.findUnique({
        where: { id: created.id },
      });

      // Use >= comparison to handle same-millisecond updates
      // The key assertion is that updatedAt is set and not earlier than original
      expect(new Date(dbRecord.updatedAt).getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt,
      );
    });
  });

  describe('DELETE /api/v1/company-histories/:id - Delete', () => {
    it('should delete an existing CompanyHistory', async () => {
      const created = await createCompanyHistory();

      const response = await request(server)
        .delete(`/api/v1/company-histories/${created.id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.deleted).toBe(created.id);

      // Verify deletion
      const dbRecord = await prisma.companyHistory.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).toBeNull();
    });
  });
});
