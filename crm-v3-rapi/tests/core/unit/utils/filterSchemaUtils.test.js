/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * Unit tests for filterSchemaUtils utility.
 * Tests extractTypesFromSchema function and TYPE_OPERATORS mapping.
 *
 *
 */

const Joi = require('joi');
const { extractTypesFromSchema, TYPE_OPERATORS } = require('#core/utils/filterSchemaUtils.js');

describe('filterSchemaUtils', () => {
  describe('extractTypesFromSchema', () => {
    it('should extract number type with correct operators', () => {
      const schema = Joi.object({
        amount: Joi.number(),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.amount).toEqual({
        type: 'number',
        operators: ['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between'],
      });
    });

    it('should extract date type with correct operators', () => {
      const schema = Joi.object({
        createdAt: Joi.date(),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.createdAt).toEqual({
        type: 'date',
        operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'],
      });
    });

    it('should extract boolean type with eq only', () => {
      const schema = Joi.object({
        isActive: Joi.boolean(),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.isActive).toEqual({
        type: 'boolean',
        operators: ['eq'],
      });
    });

    it('should detect enum type from allow() values', () => {
      const schema = Joi.object({
        status: Joi.string().allow('open', 'closed', 'pending'),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.status).toEqual({
        type: 'enum',
        values: ['open', 'closed', 'pending'],
        operators: ['eq', 'in'],
      });
    });

    it('should default string fields to eq and in operators', () => {
      const schema = Joi.object({
        name: Joi.string(),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.name).toEqual({
        type: 'string',
        operators: ['eq', 'in'],
      });
    });

    it('should convert snake_case field names to camelCase', () => {
      const schema = Joi.object({
        created_at: Joi.date(),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.createdAt).toBeDefined();
      expect(result.created_at).toBeUndefined();
    });

    it('should return empty object for null schema', () => {
      const result = extractTypesFromSchema(null);
      expect(result).toEqual({});
    });

    it('should return empty object for schema without describe method', () => {
      const result = extractTypesFromSchema({});
      expect(result).toEqual({});
    });

    it('should filter out empty string from enum values', () => {
      const schema = Joi.object({
        status: Joi.string().allow('', 'open', 'closed'),
      });

      const result = extractTypesFromSchema(schema);

      expect(result.status.values).toEqual(['open', 'closed']);
    });
  });

  describe('TYPE_OPERATORS', () => {
    it('should export correct operator lists', () => {
      expect(TYPE_OPERATORS.number).toEqual(['eq', 'in', 'gt', 'gte', 'lt', 'lte', 'between']);
      expect(TYPE_OPERATORS.date).toEqual(['eq', 'gt', 'gte', 'lt', 'lte', 'between']);
      expect(TYPE_OPERATORS.boolean).toEqual(['eq']);
      expect(TYPE_OPERATORS.enum).toEqual(['eq', 'in']);
      expect(TYPE_OPERATORS.string).toEqual(['eq', 'in']);
    });
  });
});
