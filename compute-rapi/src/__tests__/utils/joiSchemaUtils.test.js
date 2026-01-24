// Mock the modules that cause ESM issues before requiring the module under test
jest.mock('#utils/shared/fileUtils.js', () => ({
  modifyFile: jest.fn(),
  formatFile: jest.fn(),
}));

const { mapFieldTypeToJoi } = require('#utils/api/joiSchemaUtils.js');

describe('mapFieldTypeToJoi', () => {
  describe('Phone field type', () => {
    it('should generate E.164 phone validation', () => {
      const field = { dataType: 'Phone', isOptional: false };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('Joi.string()');
      expect(result).toContain('pattern');
      expect(result).toContain('+14155552671');
      expect(result).toContain('.required()');
    });
  });

  describe('Latitude field type', () => {
    it('should generate latitude range validation', () => {
      const field = { dataType: 'Latitude', isOptional: false };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('Joi.number()');
      expect(result).toContain('min(-90)');
      expect(result).toContain('max(90)');
    });
  });

  describe('Longitude field type', () => {
    it('should generate longitude range validation', () => {
      const field = { dataType: 'Longitude', isOptional: false };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('Joi.number()');
      expect(result).toContain('min(-180)');
      expect(result).toContain('max(180)');
    });
  });

  describe('Percentage field type', () => {
    it('should generate 0-100 range validation', () => {
      const field = { dataType: 'Percentage', isOptional: false };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('Joi.number()');
      expect(result).toContain('min(0)');
      expect(result).toContain('max(100)');
    });
  });

  describe('Slug field type', () => {
    it('should generate URL-safe slug validation', () => {
      const field = { dataType: 'Slug', isOptional: false };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('Joi.string()');
      expect(result).toContain('pattern');
    });
  });

  describe('Vector field type', () => {
    it('should generate array validation with correct dimension', () => {
      const field = {
        dataType: 'Vector',
        vectorDimension: 1536,
        name: 'embedding',
        isOptional: false,
      };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('Joi.array()');
      expect(result).toContain('.items(Joi.number())');
      expect(result).toContain('.length(1536)');
      expect(result).toContain('.required()');
    });

    it('should use default dimension 1536 when not specified', () => {
      const field = { dataType: 'Vector', name: 'embedding', isOptional: false };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('.length(1536)');
    });

    it('should allow optional Vector fields', () => {
      const field = {
        dataType: 'Vector',
        vectorDimension: 768,
        name: 'embedding',
        isOptional: true,
      };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('.optional()');
    });

    it('should include custom error messages for array validation', () => {
      const field = {
        dataType: 'Vector',
        vectorDimension: 384,
        name: 'embedding',
        isOptional: false,
      };
      const result = mapFieldTypeToJoi(field);
      expect(result).toContain('array.length');
      expect(result).toContain('array.base');
      expect(result).toContain('number.base');
    });
  });
});
