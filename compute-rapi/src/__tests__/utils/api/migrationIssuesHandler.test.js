// Mock dependencies before require
jest.mock('#configs/prisma.js', () => ({
  fieldDefn: { update: jest.fn() },
  $transaction: jest.fn((fn) =>
    fn({ fieldDefn: { update: jest.fn().mockResolvedValue({}) } })
  ),
}));

jest.mock('#utils/api/migrationManifestUtils.js', () => ({
  loadManifest: jest.fn(),
  generateModelChecksum: jest.fn(() => 'sha256:mock'),
}));

const prisma = require('#configs/prisma.js');
const { loadManifest } = require('#utils/api/migrationManifestUtils.js');

const {
  createEmptyReport,
  analyzeMigrationIssues,
  applyMigrationFixes,
  validateExplicitConfirmations,
} = require('#utils/api/migrationIssuesHandler.js');
const { ERROR_TYPES } = require('#configs/constants.js');

describe('migrationIssuesHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createEmptyReport', () => {
    it('should return report with isFirstGeneration true when specified', () => {
      const report = createEmptyReport(true);
      expect(report.isFirstGeneration).toBe(true);
      expect(report.hasIssues).toBe(false);
    });

    it('should have all issue categories initialized as empty arrays', () => {
      const report = createEmptyReport();
      expect(report.issues.safeChanges).toEqual([]);
      expect(report.issues.requiredFieldOnExistingModel).toEqual([]);
      expect(report.issues.fieldRemovals).toEqual([]);
      expect(report.issues.modelRemovals).toEqual([]);
    });

    it('should have summary with zero counts', () => {
      const report = createEmptyReport();
      expect(report.summary.totalIssues).toBe(0);
      expect(report.summary.safeCount).toBe(0);
      expect(report.summary.dangerousCount).toBe(0);
    });

    it('should have hasNonSafeIssues set to false', () => {
      const report = createEmptyReport();
      expect(report.hasNonSafeIssues).toBe(false);
    });
  });

  describe('analyzeMigrationIssues', () => {
    describe('first generation scenarios', () => {
      it('should return isFirstGeneration=true when no manifest exists', async () => {
        loadManifest.mockResolvedValue(null);

        const result = await analyzeMigrationIssues({
          microservice: { id: 'ms-1', name: 'test' },
          models: [],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        });

        expect(result.isFirstGeneration).toBe(true);
        expect(result.hasIssues).toBe(false);
      });
    });

    it('should reject when manifest microservice does not match', async () => {
      loadManifest.mockResolvedValue({
        version: '1.0.0',
        microserviceId: 'ms-1',
        models: {},
      });

      await expect(
        analyzeMigrationIssues({
          microservice: { id: 'ms-2', name: 'test' },
          models: [],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        })
      ).rejects.toMatchObject({
        type: ERROR_TYPES.MIGRATION_ISSUES,
      });
    });

    describe('new model detection', () => {
      it('should detect new models as safe changes', async () => {
        loadManifest.mockResolvedValue({
          models: {},
        });

        const result = await analyzeMigrationIssues({
          microservice: { id: 'ms-1', name: 'test' },
          models: [{ id: 'model-1', name: 'Employee', fieldDefns: [] }],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        });

        expect(result.issues.safeChanges).toHaveLength(1);
        expect(result.issues.safeChanges[0].type).toBe('new_model');
        expect(result.issues.safeChanges[0].model).toBe('Employee');
      });

      it('should NOT set hasNonSafeIssues for safe changes only', async () => {
        loadManifest.mockResolvedValue({
          models: {},
        });

        const result = await analyzeMigrationIssues({
          microservice: { id: 'ms-1', name: 'test' },
          models: [{ id: 'model-1', name: 'NewModel', fieldDefns: [] }],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        });

        expect(result.hasIssues).toBe(true); // Safe changes count as issues
        expect(result.hasNonSafeIssues).toBe(false); // But NOT as non-safe issues
        expect(result.issues.safeChanges).toHaveLength(1);
      });
    });

    describe('new required field on existing model', () => {
      it('should detect new required field as dangerous', async () => {
        loadManifest.mockResolvedValue({
          models: {
            Employee: {
              checksum: 'sha256:old',
              fields: {
                firstName: { dataType: 'String', isOptional: false },
              },
            },
          },
        });

        const result = await analyzeMigrationIssues({
          microservice: { id: 'ms-1', name: 'test' },
          models: [
            {
              id: 'model-1',
              name: 'Employee',
              fieldDefns: [
                { id: 'f1', name: 'firstName', dataType: 'String', isOptional: false },
                { id: 'f2', name: 'middleName', dataType: 'String', isOptional: false },
              ],
            },
          ],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        });

        // requiredFieldOnExistingModel is auto-fixable (made optional), not dangerous
        expect(result.hasDangerousChanges).toBe(false);
        expect(result.hasFixableChanges).toBe(true);
        expect(result.hasNonSafeIssues).toBe(false); // Fixable changes are NOT blocking
        expect(result.issues.requiredFieldOnExistingModel).toHaveLength(1);
        expect(result.issues.requiredFieldOnExistingModel[0].field).toBe('middleName');
        expect(result.issues.requiredFieldOnExistingModel[0].severity).toBe('error');
      });
    });

    describe('field removal detection', () => {
      it('should detect removed fields as informational (not blocking)', async () => {
        loadManifest.mockResolvedValue({
          models: {
            Employee: {
              checksum: 'sha256:old',
              fields: {
                firstName: { dataType: 'String', isOptional: false },
                legacyCode: { dataType: 'String', isOptional: true },
              },
            },
          },
        });

        const result = await analyzeMigrationIssues({
          microservice: { id: 'ms-1', name: 'test' },
          models: [
            {
              id: 'model-1',
              name: 'Employee',
              fieldDefns: [
                { id: 'f1', name: 'firstName', dataType: 'String', isOptional: false },
              ],
            },
          ],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        });

        // Field removals are now informational, not blocking
        expect(result.hasDangerousChanges).toBe(false);
        expect(result.hasNonSafeIssues).toBe(false);
        expect(result.issues.fieldRemovals).toHaveLength(1);
        expect(result.issues.fieldRemovals[0].field).toBe('legacyCode');
        expect(result.issues.fieldRemovals[0].severity).toBe('info');
        expect(result.issues.fieldRemovals[0].requiresExplicitConfirmation).toBeUndefined();
        expect(result.summary.infoCount).toBe(1);
      });
    });

    describe('model removal detection', () => {
      it('should detect removed models as informational (not blocking)', async () => {
        loadManifest.mockResolvedValue({
          models: {
            Employee: { checksum: 'sha256:old', fields: {} },
            Department: { checksum: 'sha256:old2', fields: {} },
          },
        });

        const result = await analyzeMigrationIssues({
          microservice: { id: 'ms-1', name: 'test' },
          models: [{ id: 'model-1', name: 'Employee', fieldDefns: [] }],
          restAPI: { path: '/tmp/test' },
          req: { traceId: 'trace-1' },
        });

        // Model removals are now informational, not blocking
        expect(result.hasDangerousChanges).toBe(false);
        expect(result.hasNonSafeIssues).toBe(false);
        expect(result.issues.modelRemovals).toHaveLength(1);
        expect(result.issues.modelRemovals[0].model).toBe('Department');
        expect(result.issues.modelRemovals[0].severity).toBe('info');
        expect(result.issues.modelRemovals[0].requiresExplicitConfirmation).toBeUndefined();
        expect(result.summary.infoCount).toBe(1);
      });
    });
  });

  describe('applyMigrationFixes', () => {
    it('should return empty fixes when no fixable issues', async () => {
      const report = createEmptyReport();
      const result = await applyMigrationFixes({ report, prisma, req: {} });
      expect(result.appliedFixes).toEqual([]);
      expect(result.success).toBe(true);
    });

    it('should update FieldDefn.isOptional to true for required fields', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({});
      prisma.$transaction.mockImplementation((fn) =>
        fn({ fieldDefn: { update: mockUpdate } })
      );

      const report = createEmptyReport();
      report.issues.requiredFieldOnExistingModel = [
        {
          fieldId: 'field-uuid',
          field: 'middleName',
          model: 'Employee',
          issue: 'New required field',
        },
      ];

      const result = await applyMigrationFixes({ report, prisma, req: {} });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'field-uuid' },
        data: { isOptional: true },
      });
      expect(result.appliedFixes).toHaveLength(1);
      expect(result.appliedFixes[0].fix).toBe('made_optional');
    });

    it('should reject when fieldId is missing', async () => {
      const report = createEmptyReport();
      report.issues.requiredFieldOnExistingModel = [
        {
          field: 'middleName',
          model: 'Employee',
          issue: 'New required field',
        },
      ];

      await expect(applyMigrationFixes({ report, prisma, req: {} })).rejects.toMatchObject(
        {
          type: ERROR_TYPES.MIGRATION_ISSUES,
        }
      );
    });
  });

  describe('validateExplicitConfirmations', () => {
    it('should return empty array when no dangerous changes requiring confirmation', () => {
      const report = createEmptyReport();
      // Field removals are now informational and don't require confirmation
      report.issues.fieldRemovals = [
        { fieldId: 'f1', model: 'Employee', field: 'legacyCode' },
      ];

      const confirmations = {};
      const missing = validateExplicitConfirmations(report, confirmations);

      // Field removals no longer require confirmation
      expect(missing).toEqual([]);
    });

    it('should return empty array for model removals (now informational)', () => {
      const report = createEmptyReport();
      // Model removals are now informational and don't require confirmation
      report.issues.modelRemovals = [{ modelId: 'm1', model: 'Department' }];

      const confirmations = {};
      const missing = validateExplicitConfirmations(report, confirmations);

      // Model removals no longer require confirmation
      expect(missing).toEqual([]);
    });

    it('should check optional to required changes require REQUIRE confirmation', () => {
      const report = createEmptyReport();
      report.issues.optionalToRequired = [
        { fieldId: 'f2', model: 'Employee', field: 'middleName' },
      ];

      const confirmations = { f2: 'REQUIRE "Employee"."middleName"' };
      const missing = validateExplicitConfirmations(report, confirmations);

      expect(missing).toEqual([]);
    });

    it('should return missing confirmations for optional to required without confirmation', () => {
      const report = createEmptyReport();
      report.issues.optionalToRequired = [
        { fieldId: 'f2', model: 'Employee', field: 'middleName' },
      ];

      const confirmations = {};
      const missing = validateExplicitConfirmations(report, confirmations);

      expect(missing).toHaveLength(1);
      expect(missing[0].expectedConfirmation).toBe(
        'REQUIRE "Employee"."middleName"'
      );
    });
  });
});
