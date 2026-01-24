const {
  isStringType,
  isIntType,
  validateFieldType,
} = require('#utils/api/fieldTypeValidationUtils.js');

describe('Field Type Classification', () => {
  describe('isStringType', () => {
    it('should return true for Phone', () => {
      expect(isStringType('Phone')).toBe(true);
    });
    it('should return true for Slug', () => {
      expect(isStringType('Slug')).toBe(true);
    });
  });

  describe('isIntType (numeric types)', () => {
    it('should return true for Latitude', () => {
      expect(isIntType('Latitude')).toBe(true);
    });
    it('should return true for Longitude', () => {
      expect(isIntType('Longitude')).toBe(true);
    });
    it('should return true for Percentage', () => {
      expect(isIntType('Percentage')).toBe(true);
    });
  });

  describe('validateFieldType', () => {
    it('should accept Phone as valid', () => {
      expect(() => validateFieldType('Phone', 'testField')).not.toThrow();
    });
    it('should accept Latitude as valid', () => {
      expect(() => validateFieldType('Latitude', 'testField')).not.toThrow();
    });
    it('should accept Longitude as valid', () => {
      expect(() => validateFieldType('Longitude', 'testField')).not.toThrow();
    });
    it('should accept Percentage as valid', () => {
      expect(() => validateFieldType('Percentage', 'testField')).not.toThrow();
    });
    it('should accept Slug as valid', () => {
      expect(() => validateFieldType('Slug', 'testField')).not.toThrow();
    });
  });
});
