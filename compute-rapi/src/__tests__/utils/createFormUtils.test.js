// Mock the modules that cause ESM issues before requiring the module under test
jest.mock('#utils/shared/fileUtils.js', () => ({
  ensureDirExists: jest.fn(),
  createFileFromTemplate: jest.fn(),
  formatFile: jest.fn(),
  copyFolder: jest.fn(),
}));

jest.mock('#utils/shared/dependencyRulesUtils.js', () => ({
  getDependencyRulesForModel: jest.fn().mockResolvedValue([]),
}));

const {
  generateFormikInitialValues,
  generateFormFields,
} = require('#utils/frontend/createFormUtils.js');

describe('generateFormikInitialValues', () => {
  it('should exclude Vector fields from initial values', () => {
    const fields = [
      { dataType: 'String', name: 'title' },
      { dataType: 'Vector', name: 'embedding' },
    ];
    const result = generateFormikInitialValues(fields);
    expect(result).toContain('title');
    expect(result).not.toContain('embedding');
  });

  it('should generate correct initial values for String fields', () => {
    const fields = [{ dataType: 'String', name: 'name' }];
    const result = generateFormikInitialValues(fields);
    expect(result).toContain("name: ''");
  });

  it('should generate correct initial values for number fields', () => {
    const fields = [
      { dataType: 'Int', name: 'count' },
      { dataType: 'Float', name: 'price' },
    ];
    const result = generateFormikInitialValues(fields);
    expect(result).toContain('count: 0');
    expect(result).toContain('price: 0');
  });

  it('should generate correct initial values for Boolean fields', () => {
    const fields = [{ dataType: 'Boolean', name: 'active' }];
    const result = generateFormikInitialValues(fields);
    expect(result).toContain('active: false');
  });

  it('should generate correct initial values for Date/DateTime fields', () => {
    const fields = [
      { dataType: 'Date', name: 'startDate' },
      { dataType: 'DateTime', name: 'createdAt' },
    ];
    const result = generateFormikInitialValues(fields);
    expect(result).toContain('startDate: moment()');
    expect(result).toContain('createdAt: moment()');
  });

  it('should generate correct initial values for foreign key fields', () => {
    const fields = [{ dataType: 'UUID', name: 'category', isForeignKey: true }];
    const result = generateFormikInitialValues(fields);
    expect(result).toContain('categoryId: undefined');
  });

  it('should use provided default values', () => {
    const fields = [{ dataType: 'String', name: 'status' }];
    const defaultValues = { status: "'active'" };
    const result = generateFormikInitialValues(fields, defaultValues);
    expect(result).toContain("status: 'active'");
  });
});

describe('generateFormFields', () => {
  it('should skip Vector fields in form generation', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'String', name: 'title', label: 'Title', order: 1, isOptional: false },
      { dataType: 'Vector', name: 'embedding', label: 'Embedding', order: 2, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('title');
    expect(result).not.toContain('embedding');
  });

  it('should generate TextField for String types', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'String', name: 'description', label: 'Description', order: 1, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('FormikTextField');
    expect(result).toContain("name='description'");
    expect(result).toContain("label='Description'");
  });

  it('should generate CheckboxField for Boolean types', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'Boolean', name: 'isActive', label: 'Is Active', order: 1, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('FormikCheckboxField');
    expect(result).toContain("name='isActive'");
  });

  it('should generate DatePickerField for Date types', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'Date', name: 'startDate', label: 'Start Date', order: 1, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('FormikDatePickerField');
    expect(result).toContain("name='startDate'");
  });

  it('should generate DateTimePickerField for DateTime types', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'DateTime', name: 'scheduledAt', label: 'Scheduled At', order: 1, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('FormikDateTimePickerField');
    expect(result).toContain("name='scheduledAt'");
  });

  it('should generate SelectField for Enum types', () => {
    const model = { name: 'TestModel' };
    const fields = [
      {
        dataType: 'Enum',
        name: 'status',
        label: 'Status',
        order: 1,
        isOptional: false,
        enumDefn: {
          enumValues: [
            { label: 'Active', value: 'ACTIVE' },
            { label: 'Inactive', value: 'INACTIVE' },
          ],
        },
      },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('FormikSelectField');
    expect(result).toContain("name='status'");
    expect(result).toContain("value: 'ACTIVE'");
  });

  it('should generate UploadField for Upload types', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'Upload', name: 'avatar', label: 'Avatar', order: 1, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    expect(result).toContain('FormikUploadField');
    expect(result).toContain("name='avatar'");
  });

  it('should sort fields by order', () => {
    const model = { name: 'TestModel' };
    const fields = [
      { dataType: 'String', name: 'second', label: 'Second', order: 2, isOptional: false },
      { dataType: 'String', name: 'first', label: 'First', order: 1, isOptional: false },
    ];
    const result = generateFormFields(model, fields, {});
    const firstIndex = result.indexOf('first');
    const secondIndex = result.indexOf('second');
    expect(firstIndex).toBeLessThan(secondIndex);
  });
});
