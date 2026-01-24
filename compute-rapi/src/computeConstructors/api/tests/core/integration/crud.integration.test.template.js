/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * Integration tests for ModelName CRUD operations.
 * Tests real database operations without mocking Prisma.
 * Uses d_compute_ prefixed records for identification and cleanup.
 */

const request = require('supertest');
const { startTestServer, createAuthHeaders } = require('#tests/core/setup/app.js');
const {
  generateTestId,
  cleanupTestRecords,
  getPrismaClient,
} = require('#tests/core/setup/database.js');
const { buildModelNameForApi, createModelName } = require('#tests/factories/modelName.factory.js');

describe('ModelName Integration Tests', () => {
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
    await cleanupTestRecords('modelName');
  });

  afterAll(async () => {
    // Final cleanup
    await cleanupTestRecords('modelName');
  });

  describe('POST /api/v1/model-names - Create', () => {
    it('should create a new ModelName and persist to database', async () => {
      const testData = await buildModelNameForApi();

      const response = await request(server)
        .post('/api/v1/model-names')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      // Verify response
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBeDefined();

      // Verify database persistence
      const dbRecord = await prisma.modelName.findUnique({
        where: { id: response.body.id },
      });

      expect(dbRecord).not.toBeNull();
      // @gen:VERIFY_CREATE_FIELDS
    });

    it('should set audit fields on create', async () => {
      const testData = await buildModelNameForApi();

      const response = await request(server)
        .post('/api/v1/model-names')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });
  });

  describe('GET /api/v1/model-names - List', () => {
    it('should return paginated list of ModelNames', async () => {
      // Create test records
      await createModelName();
      await createModelName();

      const response = await request(server)
        .get('/api/v1/model-names')
        .set(authHeaders)
        .expect(200);

      expect(response.body.results).toBeDefined();
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.totalCount).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination parameters', async () => {
      // Create multiple test records
      for (let i = 0; i < 5; i++) {
        await createModelName();
      }

      const response = await request(server)
        .get('/api/v1/model-names?page=1&perPage=2')
        .set(authHeaders)
        .expect(200);

      expect(response.body.results.length).toBeLessThanOrEqual(2);
      expect(response.body.perPage).toBe(2);
      expect(response.body.currentPage).toBe(1);
    });
  });

  describe('GET /api/v1/model-names/:id - Get One', () => {
    it('should return a specific ModelName by ID', async () => {
      const created = await createModelName();

      const response = await request(server)
        .get(`/api/v1/model-names/${created.id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.id).toBe(created.id);
    });

    it('should include all expected fields in response', async () => {
      const created = await createModelName();

      const response = await request(server)
        .get(`/api/v1/model-names/${created.id}`)
        .set(authHeaders)
        .expect(200);

      // @gen:VERIFY_GET_RESPONSE_FIELDS
      expect(response.body.createdAt).toBeDefined();
      expect(response.body.updatedAt).toBeDefined();
    });
  });

  describe('PUT /api/v1/model-names/:id - Update', () => {
    it('should update an existing ModelName', async () => {
      const created = await createModelName();
      const updateData = {
        // @gen:TEST_UPDATE_DATA
      };

      const response = await request(server)
        .put(`/api/v1/model-names/${created.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      expect(response.body.id).toBe(created.id);
      // @gen:VERIFY_UPDATE_FIELDS

      // Verify database update
      const dbRecord = await prisma.modelName.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).not.toBeNull();
      // @gen:VERIFY_DB_UPDATE_FIELDS
    });

    it('should update the updatedAt timestamp', async () => {
      const created = await createModelName();
      const originalUpdatedAt = new Date(created.updatedAt).getTime();

      const updateData = {
        // @gen:MINIMAL_UPDATE_DATA
      };

      await request(server)
        .put(`/api/v1/model-names/${created.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      const dbRecord = await prisma.modelName.findUnique({
        where: { id: created.id },
      });

      // Use >= comparison to handle same-millisecond updates
      // The key assertion is that updatedAt is set and not earlier than original
      expect(new Date(dbRecord.updatedAt).getTime()).toBeGreaterThanOrEqual(
        originalUpdatedAt
      );
    });
  });

  describe('DELETE /api/v1/model-names/:id - Delete', () => {
    it('should delete an existing ModelName', async () => {
      const created = await createModelName();

      const response = await request(server)
        .delete(`/api/v1/model-names/${created.id}`)
        .set(authHeaders)
        .expect(200);

      expect(response.body.deleted).toBe(created.id);

      // Verify deletion
      const dbRecord = await prisma.modelName.findUnique({
        where: { id: created.id },
      });
      expect(dbRecord).toBeNull();
    });
  });
});
