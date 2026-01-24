// Mock the modules that cause ESM issues before requiring the module under test
jest.mock('#utils/shared/fileUtils.js', () => ({
  createFileFromTemplate: jest.fn(),
  formatFile: jest.fn(),
}));

const {
  generateFormValuesInterface,
  formatFieldsForAPIPayload,
} = require('#utils/frontend/validationSchemaUtils.js');

describe('generateFormValuesInterface', () => {
  it('should exclude Vector fields from interface', () => {
    const fields = [
      { dataType: 'String', name: 'title', isOptional: false },
      { dataType: 'Vector', name: 'embedding', isOptional: false },
    ];
    const result = generateFormValuesInterface(fields);
    expect(result).toContain('title');
    expect(result).not.toContain('embedding');
  });

  it('should generate correct types for common field types', () => {
    const fields = [
      { dataType: 'String', name: 'name', isOptional: false },
      { dataType: 'Int', name: 'count', isOptional: false },
      { dataType: 'Boolean', name: 'active', isOptional: false },
      { dataType: 'Date', name: 'startDate', isOptional: false },
      { dataType: 'Upload', name: 'file', isOptional: false },
    ];
    const result = generateFormValuesInterface(fields);
    expect(result).toContain('name: string');
    expect(result).toContain('count: number');
    expect(result).toContain('active: boolean');
    expect(result).toContain('startDate: Moment');
    expect(result).toContain('file: File | string');
  });

  it('should handle optional fields correctly', () => {
    const fields = [
      { dataType: 'String', name: 'nickname', isOptional: true },
    ];
    const result = generateFormValuesInterface(fields);
    expect(result).toContain('nickname?');
    expect(result).toContain('| null');
  });

  it('should handle foreign key fields correctly', () => {
    const fields = [
      { dataType: 'UUID', name: 'category', isForeignKey: true, isOptional: false },
    ];
    const result = generateFormValuesInterface(fields);
    expect(result).toContain('categoryId');
    expect(result).toContain('AutocompleteOption');
  });
});

describe('formatFieldsForAPIPayload', () => {
  it('should exclude Vector fields from payload formatting', () => {
    const fields = [
      { dataType: 'DateTime', name: 'createdAt', isOptional: false },
      { dataType: 'Vector', name: 'embedding', isOptional: false },
    ];
    const result = formatFieldsForAPIPayload(fields);
    expect(result.customFieldNames).toContain('createdAt');
    expect(result.customFieldNames).not.toContain('embedding');
    expect(result.customAssignments.join('')).not.toContain('embedding');
  });

  it('should format DateTime fields correctly', () => {
    const fields = [
      { dataType: 'DateTime', name: 'scheduledAt', isOptional: false },
    ];
    const result = formatFieldsForAPIPayload(fields);
    expect(result.customFieldNames).toContain('scheduledAt');
    expect(result.customAssignments.join('')).toContain('formatToUTCDateTime');
  });

  it('should format Date fields correctly', () => {
    const fields = [
      { dataType: 'Date', name: 'birthDate', isOptional: false },
    ];
    const result = formatFieldsForAPIPayload(fields);
    expect(result.customFieldNames).toContain('birthDate');
    expect(result.customAssignments.join('')).toContain('formatToUTCDate');
  });

  it('should format Upload fields correctly', () => {
    const fields = [
      { dataType: 'Upload', name: 'avatar', isOptional: false },
    ];
    const result = formatFieldsForAPIPayload(fields);
    expect(result.customFieldNames).toContain('avatar');
    expect(result.customAssignments.join('')).toContain('resolveFileOrUrl');
  });

  it('should format foreign key fields correctly', () => {
    const fields = [
      { dataType: 'UUID', name: 'category', isForeignKey: true, isOptional: false },
    ];
    const result = formatFieldsForAPIPayload(fields);
    expect(result.customFieldNames).toContain('categoryId');
    expect(result.customAssignments.join('')).toContain('categoryId?.id');
  });

  it('should return empty arrays for fields that need no custom handling', () => {
    const fields = [
      { dataType: 'String', name: 'title', isOptional: false },
      { dataType: 'Int', name: 'count', isOptional: false },
    ];
    const result = formatFieldsForAPIPayload(fields);
    expect(result.customFieldNames).toEqual([]);
    expect(result.customAssignments).toEqual([]);
  });
});
