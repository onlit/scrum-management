/**
 * Tests for apiSetupUtils.js - Nested Include Clause Generation
 */

const {
  toCamelCase,
  extractTemplateFields,
} = require('#utils/shared/stringUtils.js');
const {
  isInternalForeignKey,
} = require('#utils/api/fieldTypeValidationUtils.js');

// Mock field data matching what FIELD_DEFN_DETAIL with `fieldDefns: true` produces
const mockFieldWithBasicFieldDefns = {
  name: 'bankStatementId',
  dataType: 'UUID',
  isForeignKey: true,
  foreignKeyTarget: 'Internal',
  foreignKeyModel: {
    id: 'model-bank-statement-uuid',
    name: 'BankStatement',
    microserviceId: 'microservice-uuid',
    displayValueTemplate: '{bankAccount} - {statementDate}',
    displayValue: null,
    fieldDefns: [
      // These fields only have basic data because `fieldDefns: true`
      {
        id: 'field-bank-account-id-uuid',
        name: 'bankAccountId',
        dataType: 'UUID',
        isForeignKey: true,
        foreignKeyTarget: 'Internal',
        foreignKeyModelId: 'model-bank-account-uuid',
        // NOTE: foreignKeyModel is NOT included with `fieldDefns: true`
        // foreignKeyModel: undefined
      },
      {
        id: 'field-statement-date-uuid',
        name: 'statementDate',
        dataType: 'Date',
        isForeignKey: false,
      },
    ],
  },
};

// Mock field data with full FK details (what we should have)
const mockFieldWithFullFieldDefns = {
  name: 'bankStatementId',
  dataType: 'UUID',
  isForeignKey: true,
  foreignKeyTarget: 'Internal',
  foreignKeyModel: {
    id: 'model-bank-statement-uuid',
    name: 'BankStatement',
    microserviceId: 'microservice-uuid',
    displayValueTemplate: '{bankAccount} - {statementDate}',
    displayValue: null,
    fieldDefns: [
      {
        id: 'field-bank-account-id-uuid',
        name: 'bankAccountId',
        dataType: 'UUID',
        isForeignKey: true,
        foreignKeyTarget: 'Internal',
        foreignKeyModelId: 'model-bank-account-uuid',
        foreignKeyModel: {
          id: 'model-bank-account-uuid',
          name: 'BankAccount',
          microserviceId: 'microservice-uuid',
        },
      },
      {
        id: 'field-statement-date-uuid',
        name: 'statementDate',
        dataType: 'Date',
        isForeignKey: false,
      },
    ],
  },
};

describe('Nested Include Clause Generation', () => {
  describe('extractTemplateFields', () => {
    it('should extract field names from template string', () => {
      const template = '{bankAccount} - {statementDate}';
      const fields = extractTemplateFields(template);
      expect(fields).toEqual(['bankAccount', 'statementDate']);
    });

    it('should return empty array for non-template strings', () => {
      expect(extractTemplateFields(null)).toEqual([]);
      expect(extractTemplateFields('')).toEqual([]);
      expect(extractTemplateFields('no placeholders')).toEqual([]);
    });
  });

  describe('isInternalForeignKey check with basic fieldDefns', () => {
    it('should fail isInternalForeignKey when foreignKeyModel is missing', () => {
      // This simulates what happens with `fieldDefns: true`
      const basicField = mockFieldWithBasicFieldDefns.foreignKeyModel.fieldDefns[0];

      // The issue: foreignKeyModel is not included
      expect(basicField.foreignKeyModel).toBeUndefined();

      // Therefore, isInternalForeignKey returns false
      const result = isInternalForeignKey(basicField);
      expect(result).toBe(false);
    });

    it('should pass isInternalForeignKey when foreignKeyModel is included', () => {
      // This simulates what should happen with proper include
      const fullField = mockFieldWithFullFieldDefns.foreignKeyModel.fieldDefns[0];

      // foreignKeyModel is included
      expect(fullField.foreignKeyModel).toBeDefined();
      expect(fullField.foreignKeyModel.name).toBe('BankAccount');

      // Therefore, isInternalForeignKey returns true
      const result = isInternalForeignKey(fullField);
      expect(result).toBe(true);
    });
  });

  describe('buildTemplateNestedIncludes simulation', () => {
    const currentMicroserviceId = 'microservice-uuid';

    it('should NOT find internal FK fields with basic fieldDefns (CURRENT BUG)', () => {
      const displayValueTemplate =
        mockFieldWithBasicFieldDefns.foreignKeyModel.displayValueTemplate;
      const targetModelFieldDefns =
        mockFieldWithBasicFieldDefns.foreignKeyModel.fieldDefns;

      const templateFieldNames = extractTemplateFields(displayValueTemplate);
      const nameSet = new Set(templateFieldNames.map((n) => toCamelCase(n)));

      const getRelationName = (fieldName) => {
        const camel = toCamelCase(fieldName);
        return camel.endsWith('Id') ? camel.slice(0, -2) : camel;
      };

      // This is what happens in buildTemplateNestedIncludes
      const internalFkFieldsFromTemplate = targetModelFieldDefns.filter(
        (f) =>
          nameSet.has(getRelationName(f.name)) &&
          isInternalForeignKey(f) &&
          f.foreignKeyModel?.microserviceId === currentMicroserviceId
      );

      // BUG: No fields found because foreignKeyModel is undefined
      expect(internalFkFieldsFromTemplate.length).toBe(0);
    });

    it('should find internal FK fields with full fieldDefns (FIXED)', () => {
      const displayValueTemplate =
        mockFieldWithFullFieldDefns.foreignKeyModel.displayValueTemplate;
      const targetModelFieldDefns =
        mockFieldWithFullFieldDefns.foreignKeyModel.fieldDefns;

      const templateFieldNames = extractTemplateFields(displayValueTemplate);
      const nameSet = new Set(templateFieldNames.map((n) => toCamelCase(n)));

      const getRelationName = (fieldName) => {
        const camel = toCamelCase(fieldName);
        return camel.endsWith('Id') ? camel.slice(0, -2) : camel;
      };

      // This is what should happen with fixed fieldDefns include
      const internalFkFieldsFromTemplate = targetModelFieldDefns.filter(
        (f) =>
          nameSet.has(getRelationName(f.name)) &&
          isInternalForeignKey(f) &&
          f.foreignKeyModel?.microserviceId === currentMicroserviceId
      );

      // FIXED: bankAccountId field is found
      expect(internalFkFieldsFromTemplate.length).toBe(1);
      expect(internalFkFieldsFromTemplate[0].name).toBe('bankAccountId');
    });
  });
});
