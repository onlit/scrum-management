/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract tests for OpportunityProduct API endpoints.
 * Validates that API responses match expected schemas.
 */

const request = require('supertest');
const {
  startTestServer,
  createAuthHeaders,
} = require('#tests/core/setup/app.js');
const {
  cleanupTestRecords,
  getPrismaClient,
} = require('#tests/core/setup/database.js');
const {
  buildOpportunityProductForApi,
  createOpportunityProduct,
} = require('#tests/factories/opportunityProduct.factory.js');
const {
  OpportunityProductResponseSchema,
  OpportunityProductListResponseSchema,
} = require('#tests/core/contracts/schemas/opportunityProduct.schema.js');
const {
  NotFoundErrorSchema,
  DeleteResponseSchema,
} = require('#tests/core/contracts/schemas/common.schema.js');

describe('OpportunityProduct Contract Tests', () => {
  let server;
  let prisma;
  let authHeaders;
  let testRecord;

  beforeAll(async () => {
    server = await startTestServer();
    prisma = getPrismaClient();
    authHeaders = createAuthHeaders();

    // Clean ALL records to ensure no legacy data with incompatible formats
    // affects contract schema validation. This is safe for contract tests
    // since they need a completely fresh state.
    await prisma.opportunityProduct.deleteMany({});

    // Create a test record for GET/PUT/DELETE tests to ensure test independence
    testRecord = await createOpportunityProduct();
  });

  afterAll(async () => {
    await cleanupTestRecords('opportunityProduct');
  });

  describe('GET /api/v1/opportunity-products', () => {
    it('should return response matching list schema', async () => {
      const response = await request(server)
        .get('/api/v1/opportunity-products')
        .set(authHeaders)
        .expect(200);

      const { error } = OpportunityProductListResponseSchema.validate(
        response.body,
        {
          abortEarly: false,
        },
      );

      if (error) {
        const details = error.details.map(
          (d) => `${d.path.join('.')}: ${d.message}`,
        );
        throw new Error(`Schema validation failed:\n${details.join('\n')}`);
      }
    });

    it('should return pagination metadata', async () => {
      const response = await request(server)
        .get('/api/v1/opportunity-products')
        .set(authHeaders)
        .expect(200);

      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('pageCount');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('perPage');
      expect(response.body).toHaveProperty('results');
      expect(Array.isArray(response.body.results)).toBe(true);
    });
  });

  describe('POST /api/v1/opportunity-products', () => {
    it('should return created record matching response schema', async () => {
      // Use buildOpportunityProductForApi to ensure required relations exist
      const testData = await buildOpportunityProductForApi();

      const response = await request(server)
        .post('/api/v1/opportunity-products')
        .set(authHeaders)
        .send(testData)
        .expect(201);

      const { error } = OpportunityProductResponseSchema.validate(
        response.body,
        {
          abortEarly: false,
        },
      );

      if (error) {
        const details = error.details.map(
          (d) => `${d.path.join('.')}: ${d.message}`,
        );
        throw new Error(`Schema validation failed:\n${details.join('\n')}`);
      }
    });
  });

  describe('GET /api/v1/opportunity-products/:id', () => {
    it('should return record matching response schema', async () => {
      const response = await request(server)
        .get(`/api/v1/opportunity-products/${testRecord.id}`)
        .set(authHeaders)
        .expect(200);

      const { error } = OpportunityProductResponseSchema.validate(
        response.body,
        {
          abortEarly: false,
        },
      );

      if (error) {
        const details = error.details.map(
          (d) => `${d.path.join('.')}: ${d.message}`,
        );
        throw new Error(`Schema validation failed:\n${details.join('\n')}`);
      }
    });

    it('should return 404 for non-existent ID with error schema', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(server)
        .get(`/api/v1/opportunity-products/${fakeId}`)
        .set(authHeaders)
        .expect(404);

      const { error } = NotFoundErrorSchema.validate(response.body, {
        abortEarly: false,
      });

      if (error) {
        const details = error.details.map(
          (d) => `${d.path.join('.')}: ${d.message}`,
        );
        throw new Error(
          `Error schema validation failed:\n${details.join('\n')}`,
        );
      }
    });
  });

  describe('PUT /api/v1/opportunity-products/:id', () => {
    it('should return updated record matching response schema', async () => {
      // Use buildOpportunityProductForApi to ensure required relations exist
      const updateData = await buildOpportunityProductForApi();

      const response = await request(server)
        .put(`/api/v1/opportunity-products/${testRecord.id}`)
        .set(authHeaders)
        .send(updateData)
        .expect(200);

      const { error } = OpportunityProductResponseSchema.validate(
        response.body,
        {
          abortEarly: false,
        },
      );

      if (error) {
        const details = error.details.map(
          (d) => `${d.path.join('.')}: ${d.message}`,
        );
        throw new Error(`Schema validation failed:\n${details.join('\n')}`);
      }
    });
  });

  describe('DELETE /api/v1/opportunity-products/:id', () => {
    it('should return delete confirmation matching schema', async () => {
      // Create a dedicated record for delete test to avoid affecting other tests
      const recordToDelete = await createOpportunityProduct();

      const response = await request(server)
        .delete(`/api/v1/opportunity-products/${recordToDelete.id}`)
        .set(authHeaders)
        .expect(200);

      const { error } = DeleteResponseSchema.validate(response.body, {
        abortEarly: false,
      });

      if (error) {
        const details = error.details.map(
          (d) => `${d.path.join('.')}: ${d.message}`,
        );
        throw new Error(
          `Delete schema validation failed:\n${details.join('\n')}`,
        );
      }
    });
  });
});
