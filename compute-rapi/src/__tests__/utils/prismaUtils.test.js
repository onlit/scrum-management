// Mock the modules that cause ESM issues before requiring the module under test
jest.mock('#utils/shared/fileUtils.js', () => ({
  modifyFile: jest.fn(),
  formatFile: jest.fn(),
  createFileFromTemplate: jest.fn(),
}));

const { mapFieldTypeToPrisma } = require('#utils/api/prismaUtils.js');

describe('mapFieldTypeToPrisma', () => {
  it('should map Phone to String', () => {
    const field = { dataType: 'Phone', name: 'phone', isOptional: false };
    const result = mapFieldTypeToPrisma(field);
    expect(result).toContain('String');
  });

  it('should map Latitude to Float', () => {
    const field = { dataType: 'Latitude', name: 'latitude', isOptional: false };
    const result = mapFieldTypeToPrisma(field);
    expect(result).toContain('Float');
  });

  it('should map Longitude to Float', () => {
    const field = { dataType: 'Longitude', name: 'longitude', isOptional: false };
    const result = mapFieldTypeToPrisma(field);
    expect(result).toContain('Float');
  });

  it('should map Percentage to Float', () => {
    const field = { dataType: 'Percentage', name: 'discount', isOptional: false };
    const result = mapFieldTypeToPrisma(field);
    expect(result).toContain('Float');
  });

  it('should map Slug to String', () => {
    const field = { dataType: 'Slug', name: 'urlSlug', isOptional: false };
    const result = mapFieldTypeToPrisma(field);
    expect(result).toContain('String');
  });
});
