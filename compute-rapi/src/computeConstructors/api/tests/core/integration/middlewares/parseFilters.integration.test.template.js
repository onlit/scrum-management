/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * Integration tests for parseFilters middleware.
 * Tests full HTTP request/response cycle with Express app.
 *
 *
 */

const request = require('supertest');
const express = require('express');
const Joi = require('joi');
const { parseFilters } = require('#core/middlewares/parseFilters.js');

describe('parseFilters Integration Tests', () => {
  const testSchema = Joi.object({
    amount: Joi.number(),
    status: Joi.string().allow('open', 'closed', 'pending'),
    isActive: Joi.boolean(),
    createdAt: Joi.date(),
    name: Joi.string(),
  });
  const filterFields = ['amount', 'status', 'isActive', 'createdAt', 'name'];

  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Test endpoint that returns the transformed query
    app.get(
      '/test',
      parseFilters({ schema: testSchema, filterFields }),
      (req, res) => {
        res.json({ query: req.query });
      }
    );

    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 400).json({
        success: false,
        error: {
          type: err.type,
          message: err.message,
          filterErrors: err.filterErrors,
        },
      });
    });
  });

  describe('Successful filter parsing', () => {
    it('should parse simple equality filter', async () => {
      const response = await request(app)
        .get('/test?status=open')
        .expect(200);

      expect(response.body.query.status).toEqual({ equals: 'open' });
    });

    it('should parse explicit eq operator', async () => {
      const response = await request(app)
        .get('/test?status__eq=open')
        .expect(200);

      expect(response.body.query.status).toEqual({ equals: 'open' });
    });

    it('should parse in operator', async () => {
      const response = await request(app)
        .get('/test?status__in=open,closed,pending')
        .expect(200);

      expect(response.body.query.status).toEqual({ in: ['open', 'closed', 'pending'] });
    });

    it('should parse gte operator with number', async () => {
      const response = await request(app)
        .get('/test?amount__gte=10000')
        .expect(200);

      expect(response.body.query.amount).toEqual({ gte: 10000 });
    });

    it('should parse between operator', async () => {
      const response = await request(app)
        .get('/test?amount__between=1000,5000')
        .expect(200);

      expect(response.body.query.amount).toEqual({ gte: 1000, lte: 5000 });
    });

    it('should parse date filters', async () => {
      const response = await request(app)
        .get('/test?createdAt__gte=2025-01-01')
        .expect(200);

      expect(response.body.query.createdAt).toEqual({ gte: '2025-01-01T00:00:00.000Z' });
    });

    it('should parse boolean filters', async () => {
      const response = await request(app)
        .get('/test?isActive=true')
        .expect(200);

      expect(response.body.query.isActive).toEqual({ equals: true });
    });

    it('should preserve pagination params', async () => {
      const response = await request(app)
        .get('/test?page=2&pageSize=20&status=open')
        .expect(200);

      expect(response.body.query.page).toBe('2');
      expect(response.body.query.pageSize).toBe('20');
      expect(response.body.query.status).toEqual({ equals: 'open' });
    });

    it('should handle snake_case to camelCase conversion', async () => {
      const response = await request(app)
        .get('/test?created_at__gte=2025-01-01')
        .expect(200);

      expect(response.body.query.createdAt).toBeDefined();
      expect(response.body.query.created_at).toBeUndefined();
    });
  });

  describe('Error responses', () => {
    it('should return 400 for unknown field', async () => {
      const response = await request(app)
        .get('/test?unknown__eq=value')
        .expect(400);

      expect(response.body.error.type).toBe('BAD_REQUEST');
      expect(response.body.error.filterErrors).toContainEqual(
        expect.objectContaining({ field: 'unknown', reason: 'unknown field' })
      );
    });

    it('should return 400 for unsupported operator', async () => {
      const response = await request(app)
        .get('/test?name__gt=test')
        .expect(400);

      expect(response.body.error.filterErrors[0].reason).toContain('not supported');
    });

    it('should return 400 for invalid number value', async () => {
      const response = await request(app)
        .get('/test?amount__eq=not-a-number')
        .expect(400);

      expect(response.body.error.filterErrors[0].reason).toBe('expected number');
    });

    it('should return 400 for invalid date value', async () => {
      const response = await request(app)
        .get('/test?createdAt__eq=not-a-date')
        .expect(400);

      expect(response.body.error.filterErrors[0].reason).toContain('expected valid date');
    });

    it('should return 400 for invalid boolean value', async () => {
      const response = await request(app)
        .get('/test?isActive=yes')
        .expect(400);

      expect(response.body.error.filterErrors[0].reason).toBe('expected true or false');
    });

    it('should collect multiple errors', async () => {
      const response = await request(app)
        .get('/test?unknown=value&amount=abc')
        .expect(400);

      expect(response.body.error.filterErrors).toHaveLength(2);
    });

    it('should return 400 for empty in list', async () => {
      const response = await request(app)
        .get('/test?status__in=')
        .expect(400);

      expect(response.body.error.filterErrors[0].reason).toBe('list cannot be empty');
    });

    it('should return 400 for invalid between format', async () => {
      const response = await request(app)
        .get('/test?amount__between=1000')
        .expect(400);

      expect(response.body.error.filterErrors[0].reason).toBe('requires exactly 2 comma-separated values');
    });
  });
});
