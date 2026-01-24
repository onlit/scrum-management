// src/__tests__/integration/migrationIssuesHandler.integration.test.js
const fs = require('fs');
const path = require('path');
const {
  loadManifest,
  updateManifest,
  MANIFEST_FILENAME,
} = require('#utils/api/migrationManifestUtils.js');
const {
  analyzeMigrationIssues,
  createEmptyReport,
} = require('#utils/api/migrationIssuesHandler.js');

describe('migrationIssuesHandler integration', () => {
  const testDir = '/tmp/test-migration-integration';

  beforeEach(() => {
    fs.mkdirSync(path.join(testDir, 'prisma'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('full flow: first generation', () => {
    it('should skip analysis and return isFirstGeneration=true', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [{ id: 'm1', name: 'Employee', fieldDefns: [] }],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      expect(result.isFirstGeneration).toBe(true);
      expect(result.hasIssues).toBe(false);
    });

    it('should create manifest after updateManifest call', async () => {
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { name: 'firstName', dataType: 'String', isOptional: false },
            ],
          },
        ],
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });

      const manifest = await loadManifest(testDir);
      expect(manifest).not.toBeNull();
      expect(manifest.microserviceName).toBe('test-service');
      expect(manifest.models.Employee).toBeDefined();
    });
  });

  describe('full flow: regeneration with changes', () => {
    beforeEach(async () => {
      // Create initial manifest
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { name: 'firstName', dataType: 'String', isOptional: false },
            ],
          },
        ],
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });
    });

    it('should detect new required field as dangerous', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { id: 'f1', name: 'firstName', dataType: 'String', isOptional: false },
              { id: 'f2', name: 'lastName', dataType: 'String', isOptional: false },
            ],
          },
        ],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      // requiredFieldOnExistingModel is auto-fixable (made optional), not dangerous
      expect(result.hasDangerousChanges).toBe(false);
      expect(result.hasFixableChanges).toBe(true);
      expect(result.issues.requiredFieldOnExistingModel).toHaveLength(1);
      expect(result.issues.requiredFieldOnExistingModel[0].field).toBe('lastName');
    });

    it('should detect field removal as informational (not blocking)', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [{ id: 'm1', name: 'Employee', fieldDefns: [] }],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      // Field removals are now informational, not blocking
      expect(result.hasDangerousChanges).toBe(false);
      expect(result.hasNonSafeIssues).toBe(false);
      expect(result.issues.fieldRemovals).toHaveLength(1);
      expect(result.issues.fieldRemovals[0].field).toBe('firstName');
      expect(result.issues.fieldRemovals[0].severity).toBe('info');
      expect(result.summary.infoCount).toBe(1);
    });

    it('should detect new model as safe', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { id: 'f1', name: 'firstName', dataType: 'String', isOptional: false },
            ],
          },
          { id: 'm2', name: 'Department', fieldDefns: [] },
        ],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      expect(result.issues.safeChanges).toHaveLength(1);
      expect(result.issues.safeChanges[0].model).toBe('Department');
    });

    it('should detect model removal as informational (not blocking)', async () => {
      // Add a second model to the manifest first
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { name: 'firstName', dataType: 'String', isOptional: false },
            ],
          },
          {
            id: 'm2',
            name: 'Department',
            fieldDefns: [{ name: 'name', dataType: 'String', isOptional: false }],
          },
        ],
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });

      // Now regenerate without Department
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { id: 'f1', name: 'firstName', dataType: 'String', isOptional: false },
            ],
          },
        ],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      // Model removals are now informational, not blocking
      expect(result.hasDangerousChanges).toBe(false);
      expect(result.hasNonSafeIssues).toBe(false);
      expect(result.issues.modelRemovals).toHaveLength(1);
      expect(result.issues.modelRemovals[0].model).toBe('Department');
      expect(result.issues.modelRemovals[0].severity).toBe('info');
      expect(result.summary.infoCount).toBe(1);
    });
  });

  describe('manifest persistence', () => {
    it('should track auto-fix history across regenerations', async () => {
      // First generation
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [],
        user: { email: 'test@example.com' },
        appliedFixes: [
          { model: 'Employee', field: 'middleName', fix: 'made_optional' },
        ],
      });

      // Second generation with another fix
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [],
        user: { email: 'test@example.com' },
        appliedFixes: [
          { model: 'Employee', field: 'suffix', fix: 'made_optional' },
        ],
      });

      const manifest = await loadManifest(testDir);
      expect(manifest.autoFixesApplied).toHaveLength(2);
    });

    it('should preserve checksum consistency across updates', async () => {
      const models = [
        {
          id: 'm1',
          name: 'Employee',
          fieldDefns: [
            { name: 'firstName', dataType: 'String', isOptional: false },
          ],
        },
      ];

      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models,
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });

      const manifest1 = await loadManifest(testDir);
      const checksum1 = manifest1.models.Employee.checksum;

      // Update again with same models
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models,
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });

      const manifest2 = await loadManifest(testDir);
      const checksum2 = manifest2.models.Employee.checksum;

      expect(checksum1).toBe(checksum2);
    });
  });

  describe('type change detection', () => {
    beforeEach(async () => {
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { name: 'salary', dataType: 'Decimal', isOptional: false },
            ],
          },
        ],
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });
    });

    it('should detect warning-level type changes', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { id: 'f1', name: 'salary', dataType: 'Float', isOptional: false },
            ],
          },
        ],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      expect(result.issues.typeChangeWarnings).toHaveLength(1);
      expect(result.issues.typeChangeWarnings[0].fromType).toBe('Decimal');
      expect(result.issues.typeChangeWarnings[0].toType).toBe('Float');
    });

    it('should detect blocking type changes', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { id: 'f1', name: 'salary', dataType: 'String', isOptional: false },
            ],
          },
        ],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      expect(result.issues.destructiveTypeChanges).toHaveLength(1);
      expect(result.issues.destructiveTypeChanges[0].fromType).toBe('Decimal');
      expect(result.issues.destructiveTypeChanges[0].toType).toBe('String');
    });
  });

  describe('optional to required detection', () => {
    beforeEach(async () => {
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { name: 'middleName', dataType: 'String', isOptional: true },
            ],
          },
        ],
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });
    });

    it('should detect optional to required as blocking', async () => {
      const result = await analyzeMigrationIssues({
        microservice: { id: 'ms-1', name: 'test-service' },
        models: [
          {
            id: 'm1',
            name: 'Employee',
            fieldDefns: [
              { id: 'f1', name: 'middleName', dataType: 'String', isOptional: false },
            ],
          },
        ],
        restAPI: { path: testDir },
        req: { traceId: 'test-trace' },
      });

      expect(result.hasDangerousChanges).toBe(true);
      expect(result.issues.optionalToRequired).toHaveLength(1);
      expect(result.issues.optionalToRequired[0].field).toBe('middleName');
    });
  });
});
