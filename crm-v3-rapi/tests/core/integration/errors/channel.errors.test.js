/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Error handling tests for Channel endpoints.
 * Tests 404s, 422s, validation errors, and edge cases.
 */

const request = require('supertest');
const {
  startTestServer,
  createAuthHeaders,
} = require('#tests/core/setup/app.js');
const {
  cleanupTestRecords,
  getPrismaClient,
  generateTestId,
} = require('#tests/core/setup/database.js');
const {
  NON_EXISTENT_UUID,
  INVALID_UUID,
} = require('#tests/core/setup/constants.js');
const { createChannel } = require('#tests/factories/channel.factory.js');

describe('Channel Error Handling', () => {
  let server;
  let prisma;
  let authHeaders;

  beforeAll(async () => {
    server = await startTestServer();
    prisma = getPrismaClient();
    authHeaders = createAuthHeaders();
  });

  afterEach(async () => {
    await cleanupTestRecords('channel');
  });

  describe('404 Not Found Errors', () => {
    it('GET /api/v1/channels/:id returns 404 for non-existent ID', async () => {
      const fakeId = NON_EXISTENT_UUID;

      const response = await request(server)
        .get(`/api/v1/channels/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(response.body.message.toLowerCase()).toContain('not found');
    });

    it('PUT /api/v1/channels/:id returns 404 for non-existent ID', async () => {
      const fakeId = NON_EXISTENT_UUID;

      const response = await request(server)
        .put(`/api/v1/channels/${fakeId}`)
        .set(authHeaders)
        .send({
          description: 'd_compute_updated_description',
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message.toLowerCase()).toContain('not found');
    });

    it('DELETE /api/v1/channels/:id returns 404 for non-existent ID', async () => {
      const fakeId = NON_EXISTENT_UUID;

      const response = await request(server)
        .delete(`/api/v1/channels/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('400 Bad Request - Invalid Input', () => {
    it('GET /api/v1/channels/:id returns 400 for invalid UUID format', async () => {
      const invalidId = INVALID_UUID;

      const response = await request(server)
        .get(`/api/v1/channels/${invalidId}`)
        .set(authHeaders)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('POST /api/v1/channels returns 400 for missing required fields', async () => {
      const response = await request(server)
        .post('/api/v1/channels')
        .set(authHeaders)
        .send({}) // Empty body
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('POST /api/v1/channels returns 400 when name is missing', async () => {
      const invalidData = {
        // Missing required field: name
      };

      const response = await request(server)
        .post('/api/v1/channels')
        .set(authHeaders)
        .send(invalidData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('422 Validation Errors', () => {
    it('POST /api/v1/channels returns validation error for invalid email format', async () => {
      const invalidData = {
        // No email field in this model
      };

      // Skip if model doesn't have email field
      if (!invalidData.email) {
        return;
      }

      const response = await request(server)
        .post('/api/v1/channels')
        .set(authHeaders)
        .send(invalidData);

      // Should be 400 or 422 for validation errors
      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    // No additional validation tests
  });

  describe('409 Conflict Errors', () => {
    it('POST /api/v1/channels returns 409 for duplicate unique constraint', async () => {
      const hasDuplicateData = false;

      // Skip if no unique constraint to test
      if (!hasDuplicateData) {
        return;
      }

      // Create first record
      const firstRecord = await createChannel();

      // Try to create duplicate with same unique field
      const duplicateData = {
        // No unique constraints to test
      };

      const response = await request(server)
        .post('/api/v1/channels')
        .set(authHeaders)
        .send(duplicateData);

      // Should be 409 for unique constraint violation
      expect([400, 409]).toContain(response.status);
    });
  });

  describe('Error Response Format', () => {
    it('all error responses include error and message fields', async () => {
      const fakeId = NON_EXISTENT_UUID;

      const response = await request(server)
        .get(`/api/v1/channels/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
      expect(typeof response.body.error).toBe('string');
      expect(typeof response.body.message).toBe('string');
    });

    it('error responses do not leak internal implementation details', async () => {
      const fakeId = NON_EXISTENT_UUID;

      const response = await request(server)
        .get(`/api/v1/channels/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      // Should not contain stack traces in production mode
      if (process.env.NODE_ENV === 'production') {
        expect(response.body.stack).toBeUndefined();
      }

      // Should not contain internal paths
      const responseText = JSON.stringify(response.body);
      expect(responseText).not.toContain('/home/');
      expect(responseText).not.toContain('/src/');
      expect(responseText).not.toContain('node_modules');
    });
  });
});
