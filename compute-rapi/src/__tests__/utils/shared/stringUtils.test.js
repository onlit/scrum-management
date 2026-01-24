const {
  resolveModelSlug,
  convertModelNameToSlug,
} = require('#utils/shared/stringUtils.js');

describe('stringUtils', () => {
  describe('resolveModelSlug', () => {
    it('should return custom slug when provided', () => {
      const model = { name: 'Person', slug: 'persons' };
      expect(resolveModelSlug(model)).toBe('persons');
    });

    it('should return computed slug when custom slug is not provided', () => {
      const model = { name: 'Person' };
      // pluralize converts Person -> people
      expect(resolveModelSlug(model)).toBe('people');
    });

    it('should return computed slug when slug is null', () => {
      const model = { name: 'BankAccount', slug: null };
      expect(resolveModelSlug(model)).toBe('bank-accounts');
    });

    it('should return computed slug when slug is empty string', () => {
      const model = { name: 'BankAccount', slug: '' };
      expect(resolveModelSlug(model)).toBe('bank-accounts');
    });

    it('should return computed slug when slug is whitespace only', () => {
      const model = { name: 'BankAccount', slug: '   ' };
      expect(resolveModelSlug(model)).toBe('bank-accounts');
    });

    it('should trim whitespace from custom slug', () => {
      const model = { name: 'Person', slug: '  persons  ' };
      expect(resolveModelSlug(model)).toBe('persons');
    });

    it('should handle model with no name and no slug', () => {
      const model = {};
      expect(resolveModelSlug(model)).toBe('');
    });

    it('should handle null model', () => {
      expect(resolveModelSlug(null)).toBe('');
    });

    it('should handle undefined model', () => {
      expect(resolveModelSlug(undefined)).toBe('');
    });

    it('should prefer custom slug over pluralize rules', () => {
      // This is the main use case - override "people" with "persons"
      const model = { name: 'Person', slug: 'persons' };
      expect(resolveModelSlug(model)).toBe('persons');

      // Without custom slug, pluralize would give "people"
      const modelWithoutSlug = { name: 'Person' };
      expect(resolveModelSlug(modelWithoutSlug)).toBe('people');
    });
  });

  describe('convertModelNameToSlug', () => {
    it('should convert model name to kebab-case plural', () => {
      expect(convertModelNameToSlug('BankAccount')).toBe('bank-accounts');
      expect(convertModelNameToSlug('User')).toBe('users');
      expect(convertModelNameToSlug('OrderItem')).toBe('order-items');
    });

    it('should handle null/undefined input', () => {
      expect(convertModelNameToSlug(null)).toBe('');
      expect(convertModelNameToSlug(undefined)).toBe('');
    });

    it('should apply English pluralization rules', () => {
      expect(convertModelNameToSlug('Person')).toBe('people');
      expect(convertModelNameToSlug('Child')).toBe('children');
      expect(convertModelNameToSlug('Category')).toBe('categories');
    });
  });
});
