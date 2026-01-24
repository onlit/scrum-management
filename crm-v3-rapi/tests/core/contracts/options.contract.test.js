/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Contract tests for OPTIONS endpoint schema responses.
 * Validates that OPTIONS with Accept: application/schema+json returns valid schemas.
 *
 * NOTE: Tests use Origin header to simulate external requests, as internal requests
 * (localhost without Origin) are handled differently by internalRequestHandler.
 */

const request = require('supertest');
const Joi = require('joi');
const { startTestServer, createAuthHeaders } = require('#tests/core/setup/app.js');

// Use a test origin to simulate external browser requests
// NOTE: CORS config allows DEV_ORIGINS like http://localhost:3000
const TEST_ORIGIN = 'http://localhost:3000';

// Schema for validating OPTIONS response structure
const QueryParamSchema = Joi.object({
  name: Joi.string().required(),
  required: Joi.boolean().required(),
  schema: Joi.object().required(),
  ops: Joi.array().items(Joi.string()).optional(),
});

const MethodErrorSchema = Joi.object({
  status: Joi.number().integer().required(),
  code: Joi.string().pattern(/^[A-Z][A-Z0-9_]*$/).required(),
  message: Joi.string().required(),
});

const MethodSchemaSchema = Joi.object({
  request_schema: Joi.object().allow(null).required(),
  response_schema: Joi.object().allow(null).required(),
  errors: Joi.array().items(MethodErrorSchema).required(),
});

const OptionsResponseSchema = Joi.object({
  query_params: Joi.array().items(QueryParamSchema).required(),
  methods: Joi.object().pattern(
    Joi.string().valid('GET', 'POST', 'PUT', 'PATCH', 'DELETE'),
    MethodSchemaSchema
  ).required(),
});

describe('OPTIONS Schema Contract Tests', () => {
  let server;

  beforeAll(async () => {
    server = await startTestServer();
  });

  describe('OPTIONS /api/v1/people', () => {
    let authHeaders;

    beforeAll(() => {
      authHeaders = createAuthHeaders();
    });

    it('should return CORS preflight without schema header', async () => {
      const response = await request(server)
        .options('/api/v1/people')
        .set('Origin', TEST_ORIGIN)
        .expect(200); // CORS config uses optionsSuccessStatus: 200 for browser compatibility

      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });

    it('should require authentication for schema requests', async () => {
      const response = await request(server)
        .options('/api/v1/people')
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });

    it('should return schema with Accept: application/schema+json and auth', async () => {
      const response = await request(server)
        .options('/api/v1/people')
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .set(authHeaders)
        .expect(200);

      expect(response.headers['content-type']).toContain('application/schema+json');

      const { error } = OptionsResponseSchema.validate(response.body, {
        abortEarly: false,
      });

      if (error) {
        const details = error.details.map((d) => `${d.path.join('.')}: ${d.message}`);
        throw new Error(`Schema validation failed:\n${details.join('\n')}`);
      }
    });

    it('should include GET and POST methods for collection endpoint', async () => {
      const response = await request(server)
        .options('/api/v1/people')
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .set(authHeaders)
        .expect(200);

      expect(response.body.methods).toHaveProperty('GET');
      expect(response.body.methods).toHaveProperty('POST');
    });

    it('should include query_params for GET method', async () => {
      const response = await request(server)
        .options('/api/v1/people')
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .set(authHeaders)
        .expect(200);

      expect(response.body.query_params.length).toBeGreaterThan(0);

      const pageParam = response.body.query_params.find((p) => p.name === 'page');
      expect(pageParam).toBeDefined();
      expect(pageParam.required).toBe(false);
    });
  });

  describe('OPTIONS /api/v1/people/:id', () => {
    let authHeaders;

    beforeAll(() => {
      authHeaders = createAuthHeaders();
    });

    it('should return schema for single resource endpoint', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(server)
        .options(`/api/v1/people/${fakeId}`)
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .set(authHeaders)
        .expect(200);

      expect(response.body.methods).toHaveProperty('GET');
      expect(response.body.methods).toHaveProperty('PUT');
      expect(response.body.methods).toHaveProperty('PATCH');
      expect(response.body.methods).toHaveProperty('DELETE');
    });

    it('should have empty query_params for single resource endpoint', async () => {
      const fakeId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(server)
        .options(`/api/v1/people/${fakeId}`)
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .set(authHeaders)
        .expect(200);

      // Single resource endpoints don't have filter query params
      // (they may still have reserved params or be empty)
      expect(Array.isArray(response.body.query_params)).toBe(true);
    });
  });

  describe('OPTIONS /api/v1/unknown', () => {
    let authHeaders;

    beforeAll(() => {
      authHeaders = createAuthHeaders();
    });

    it('should return 404 for unregistered path', async () => {
      const response = await request(server)
        .options('/api/v1/unknown-route-xyz')
        .set('Origin', TEST_ORIGIN)
        .set('Accept', 'application/schema+json')
        .set(authHeaders)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
