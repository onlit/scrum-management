/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Unit tests for optionsBuilder utility.
 */

const Joi = require('joi');
const {
  joiToJsonSchema,
  buildQueryParams,
  buildResponseSchema,
  buildMethodSchema,
  buildOptionsResponse,
  METHOD_ERRORS,
} = require('#core/utils/optionsBuilder.js');

describe('optionsBuilder', () => {
  describe('joiToJsonSchema', () => {
    it('should convert Joi schema to JSON Schema', () => {
      const joiSchema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().integer(),
      });

      const result = joiToJsonSchema(joiSchema);

      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('name');
      expect(result.properties).toHaveProperty('age');
      expect(result.additionalProperties).toBe(false);
    });

    it('should return null for null input', () => {
      expect(joiToJsonSchema(null)).toBeNull();
    });

    it('should remove required when allOptional is true', () => {
      const joiSchema = Joi.object({
        name: Joi.string().required(),
      });

      const result = joiToJsonSchema(joiSchema, { allOptional: true });

      expect(result.required).toBeUndefined();
    });
  });

  describe('buildQueryParams', () => {
    it('should build query params from schema and filter fields', () => {
      const joiSchema = Joi.object({
        name: Joi.string(),
        amount: Joi.number(),
        isActive: Joi.boolean(),
      });

      const result = buildQueryParams(joiSchema, ['name', 'amount', 'isActive']);

      expect(result).toContainEqual(
        expect.objectContaining({ name: 'name', required: false })
      );
      expect(result).toContainEqual(
        expect.objectContaining({
          name: 'amount',
          ops: expect.arrayContaining(['eq', 'gt', 'gte', 'lt', 'lte', 'between']),
        })
      );
    });

    it('should include reserved params', () => {
      const joiSchema = Joi.object({ name: Joi.string() });
      const result = buildQueryParams(joiSchema, ['name']);

      const names = result.map((p) => p.name);
      expect(names).toContain('page');
      expect(names).toContain('pageSize');
      expect(names).toContain('search');
      expect(names).toContain('ordering');
    });
  });

  describe('buildResponseSchema', () => {
    it('should add standard fields to response schema', () => {
      const joiSchema = Joi.object({
        name: Joi.string(),
      });

      const result = buildResponseSchema(joiSchema, 'POST');

      expect(result.properties).toHaveProperty('id');
      expect(result.properties).toHaveProperty('created_at');
      expect(result.properties).toHaveProperty('updated_at');
      expect(result.required).toContain('id');
    });

    it('should wrap in items array for GET method', () => {
      const joiSchema = Joi.object({ name: Joi.string() });

      const result = buildResponseSchema(joiSchema, 'GET');

      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('items');
      expect(result.properties.items.type).toBe('array');
    });
  });

  describe('buildMethodSchema', () => {
    it('should build schema for POST method', () => {
      const schemas = {
        create: Joi.object({ name: Joi.string().required() }),
      };

      const result = buildMethodSchema('POST', schemas);

      expect(result.request_schema).not.toBeNull();
      expect(result.response_schema).not.toBeNull();
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ status: 400, code: 'BAD_REQUEST' }),
      ]));
    });

    it('should build schema for GET method with null request_schema', () => {
      const schemas = {
        create: Joi.object({ name: Joi.string() }),
      };

      const result = buildMethodSchema('GET', schemas);

      expect(result.request_schema).toBeNull();
    });
  });

  describe('buildOptionsResponse', () => {
    it('should build complete OPTIONS response', () => {
      const schemas = {
        create: Joi.object({ name: Joi.string().required() }),
      };

      const result = buildOptionsResponse({
        schemas,
        filterFields: ['name'],
        methods: ['GET', 'POST'],
      });

      expect(result).toHaveProperty('query_params');
      expect(result).toHaveProperty('methods');
      expect(result.methods).toHaveProperty('GET');
      expect(result.methods).toHaveProperty('POST');
    });
  });

  describe('METHOD_ERRORS', () => {
    it('should have errors defined for all standard methods', () => {
      expect(METHOD_ERRORS).toHaveProperty('GET');
      expect(METHOD_ERRORS).toHaveProperty('POST');
      expect(METHOD_ERRORS).toHaveProperty('PATCH');
      expect(METHOD_ERRORS).toHaveProperty('DELETE');
    });

    it('should use SCREAMING_SNAKE_CASE for error codes', () => {
      for (const [, errors] of Object.entries(METHOD_ERRORS)) {
        for (const error of errors) {
          expect(error.code).toMatch(/^[A-Z][A-Z0-9_]*$/);
        }
      }
    });
  });
});
