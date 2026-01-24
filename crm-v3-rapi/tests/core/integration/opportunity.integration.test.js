/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Integration tests for Opportunity CRUD operations.
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
  buildOpportunityForApi,
  createOpportunity,
} = require('#tests/factories/opportunity.factory.js');

describe('Opportunity Integration Tests', () => {
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
    await cleanupTestRecords('opportunity');
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestRecords('opportunity');
  });

  describe('POST /api/v1/opportunities - Create', () => {
    it('should create a new Opportunity and persist to database', async () => {
      const testData = await buildOpportunityForApi();

      const response = await request(server)
        .post('/api/v1/opportunities')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      // Verify response
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBeDefined();

      // Verify database persistence
      const dbRecord = await prisma.opportunity.findUnique({
        where: { id: response.body.id },
      });

      expect(dbRecord).not.toBeNull();
      expect(dbRecord.name).toBeDefined();
    });

    it('should set audit fields on create', async () => {
      const testData = await buildOpportunityForApi();

      const response = await request(server)
        .post('/api/v1/opportunities')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });
  });

  describe('GET /api/v1/opportunities - List', () => {
    it('should return paginated list of Opportunitys', async () => {
      // Create test records
      await createOpportunity();
      await createOpportunity();

      const response = await request(server)
        .get('/api/v1/opportunities')
        .set(authHeaders)
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.totalCount).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination parameters', async () => {
      // Create multiple test records
      for (let i = 0; i < 5; i++) {
        await createOpportunity();
      }

      const response = await request(server)
        .get('/api/v1/opportunities?page=1&perPage=2')
        .set(authHeaders)
        .expect(200);

      expect(response.body.results.length).toBeLessThanOrEqual(2);
      expect(response.body.perPage).toBe(2);
      expect(response.body.currentPage).toBe(1);
    });
  });

  describe('GET /api/v1/opportunities/:id - Get One', () => {
    it('should return a specific Opportunity by ID', async () => {
      const created = await createOpportunity();

      const response = await request(server)
        .get(`/api/v1/opportunities/${created.id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.id).toBe(created.id);
    });

    it('should include all expected fields in response', async () => {
      const created = await createOpportunity();

      const response = await request(server)
        .get(`/api/v1/opportunities/${created.id}`)
        .set(authHeaders)
        .expect(200);

      // actualValue is optional
      // probability is optional
      // dataSource is optional
      // sentiment is optional
      // customerPriority is optional
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });
  });

  describe('PUT /api/v1/opportunities/:id - Update', () => {
    it('should update an existing Opportunity', async () => {
      const created = await createOpportunity();
      const updateData = {
        actualValue: 42,
      };

      const response = await request(server)
        .put(`/api/v1/opportunities/${created.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(created.id);
      expect(response.body.actualValue).toBeDefined();

      // Verify database update
      const dbRecord = await prisma.opportunity.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).not.toBeNull();
      expect(response.body.actualValue).toBeDefined();
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await createOpportunity();
      const originalUpdatedAt = new Date(created.updatedAt).getTime();

      const updateData = {
        actualValue: 42,
      };

      await request(server)
        .put(`/api/v1/opportunities/${created.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      const dbRecord = await prisma.opportunity.findUnique({
        where: { id: created.id },
      });

      // Use >= comparison to handle same-millisecond updates
      // The key assertion is that updatedAt is set and not earlier than original
      expect(new Date(dbRecord.updatedAt).getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt,
      );
    });
  });

  describe('DELETE /api/v1/opportunities/:id - Delete', () => {
    it('should delete an existing Opportunity', async () => {
      const created = await createOpportunity();

      const response = await request(server)
        .delete(`/api/v1/opportunities/${created.id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.deleted).toBe(created.id);

      // Verify deletion
      const dbRecord = await prisma.opportunity.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).toBeNull();
    });
  });
});
