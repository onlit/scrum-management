const fs = require('fs');
const path = require('path');

const {
  loadManifest,
  updateManifest,
  markMigrationApplied,
  generateChecksum,
  generateModelChecksum,
  generateSchemaChecksum,
  MANIFEST_FILENAME,
  MANIFEST_VERSION,
} = require('#utils/api/migrationManifestUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');

describe('migrationManifestUtils', () => {
  const testDir = '/tmp/test-migration-manifest';

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('MANIFEST_FILENAME', () => {
    it('should be migration-manifest.json', () => {
      expect(MANIFEST_FILENAME).toBe('migration-manifest.json');
    });
  });

  describe('MANIFEST_VERSION', () => {
    it('should be 1.0.0', () => {
      expect(MANIFEST_VERSION).toBe('1.0.0');
    });
  });

  describe('loadManifest', () => {
    it('should return null for first generation (no manifest exists)', async () => {
      const result = await loadManifest(testDir);
      expect(result).toBeNull();
    });

    it('should load and parse existing manifest', async () => {
      const manifest = {
        version: '1.0.0',
        microserviceId: 'test-uuid',
        models: { Employee: { checksum: 'sha256:abc' } },
      };
      fs.writeFileSync(
        path.join(testDir, MANIFEST_FILENAME),
        JSON.stringify(manifest),
        'utf-8'
      );

      const result = await loadManifest(testDir);
      expect(result.microserviceId).toBe('test-uuid');
      expect(result.models.Employee.checksum).toBe('sha256:abc');
    });

    it('should handle corrupted manifest gracefully', async () => {
      fs.writeFileSync(
        path.join(testDir, MANIFEST_FILENAME),
        'invalid json {{{',
        'utf-8'
      );

      await expect(loadManifest(testDir)).rejects.toMatchObject({
        type: ERROR_TYPES.MIGRATION_ISSUES,
      });
    });

    it('should reject unsupported manifest version', async () => {
      const manifest = {
        version: '0.9.0',
        microserviceId: 'test-uuid',
        models: {},
      };
      fs.writeFileSync(
        path.join(testDir, MANIFEST_FILENAME),
        JSON.stringify(manifest),
        'utf-8'
      );

      await expect(loadManifest(testDir)).rejects.toMatchObject({
        type: ERROR_TYPES.MIGRATION_ISSUES,
      });
    });

    it('should reject manifest missing version', async () => {
      const manifest = {
        microserviceId: 'test-uuid',
        models: {},
      };
      fs.writeFileSync(
        path.join(testDir, MANIFEST_FILENAME),
        JSON.stringify(manifest),
        'utf-8'
      );

      await expect(loadManifest(testDir)).rejects.toMatchObject({
        type: ERROR_TYPES.MIGRATION_ISSUES,
      });
    });
  });

  describe('updateManifest', () => {
    it('should create new manifest on first generation', async () => {
      const models = [
        {
          id: 'model-1',
          name: 'Employee',
          fieldDefns: [
            { name: 'firstName', dataType: 'String', isOptional: false },
          ],
        },
      ];

      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'hr-rapi' },
        models,
        user: { email: 'test@example.com' },
        appliedFixes: [],
      });

      const manifestPath = path.join(testDir, MANIFEST_FILENAME);
      expect(fs.existsSync(manifestPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(content.microserviceId).toBe('ms-1');
      expect(content.microserviceName).toBe('hr-rapi');
      expect(content.models.Employee).toBeDefined();
    });

    it('should track applied auto-fixes', async () => {
      const appliedFixes = [
        {
          appliedAt: '2024-03-19T14:25:30Z',
          model: 'Employee',
          field: 'middleName',
          fix: 'made_optional',
          reason: 'New required field on existing model',
        },
      ];

      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'hr-rapi' },
        models: [],
        user: { email: 'test@example.com' },
        appliedFixes,
      });

      const content = JSON.parse(
        fs.readFileSync(path.join(testDir, MANIFEST_FILENAME), 'utf-8')
      );
      expect(content.autoFixesApplied).toHaveLength(1);
      expect(content.autoFixesApplied[0].field).toBe('middleName');
    });

    it('should reject when existing manifest version is unsupported', async () => {
      const manifest = {
        version: '0.9.0',
        microserviceId: 'test-uuid',
        models: {},
      };
      fs.writeFileSync(
        path.join(testDir, MANIFEST_FILENAME),
        JSON.stringify(manifest),
        'utf-8'
      );

      await expect(
        updateManifest({
          restAPIPath: testDir,
          microservice: { id: 'ms-1', name: 'hr-rapi' },
          models: [],
          user: { id: 'user-1' },
          appliedFixes: [],
        })
      ).rejects.toMatchObject({
        type: ERROR_TYPES.MIGRATION_ISSUES,
      });
    });
  });

  describe('generateChecksum', () => {
    it('should return consistent sha256 hash for same input', () => {
      const hash1 = generateChecksum('test content');
      const hash2 = generateChecksum('test content');
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should return different hash for different input', () => {
      const hash1 = generateChecksum('content A');
      const hash2 = generateChecksum('content B');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateModelChecksum', () => {
    it('should include all field properties in checksum', () => {
      const model = {
        name: 'Employee',
        fieldDefns: [
          { name: 'firstName', dataType: 'String', isOptional: false },
          { name: 'salary', dataType: 'Decimal', isOptional: true },
        ],
      };

      const checksum = generateModelChecksum(model);
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should produce different checksums for different field configurations', () => {
      const model1 = {
        name: 'Employee',
        fieldDefns: [{ name: 'firstName', dataType: 'String', isOptional: false }],
      };
      const model2 = {
        name: 'Employee',
        fieldDefns: [{ name: 'firstName', dataType: 'String', isOptional: true }],
      };

      expect(generateModelChecksum(model1)).not.toBe(generateModelChecksum(model2));
    });

    it('should be stable regardless of field order', () => {
      const model1 = {
        name: 'Employee',
        fieldDefns: [
          { name: 'firstName', dataType: 'String', isOptional: false },
          { name: 'lastName', dataType: 'String', isOptional: false },
        ],
      };
      const model2 = {
        name: 'Employee',
        fieldDefns: [
          { name: 'lastName', dataType: 'String', isOptional: false },
          { name: 'firstName', dataType: 'String', isOptional: false },
        ],
      };

      expect(generateModelChecksum(model1)).toBe(generateModelChecksum(model2));
    });
  });

  describe('generateSchemaChecksum', () => {
    it('should combine all model checksums into single schema checksum', () => {
      const models = [
        { name: 'Employee', fieldDefns: [{ name: 'id', dataType: 'UUID' }] },
        { name: 'Department', fieldDefns: [{ name: 'id', dataType: 'UUID' }] },
      ];

      const checksum = generateSchemaChecksum(models);
      expect(checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('should change when model name changes with identical fields', () => {
      const modelsA = [
        { name: 'Employee', fieldDefns: [{ name: 'id', dataType: 'UUID' }] },
      ];
      const modelsB = [
        { name: 'EmployeeRenamed', fieldDefns: [{ name: 'id', dataType: 'UUID' }] },
      ];

      expect(generateSchemaChecksum(modelsA)).not.toBe(
        generateSchemaChecksum(modelsB)
      );
    });
  });

  describe('markMigrationApplied', () => {
    it('should record production state in manifest', async () => {
      await updateManifest({
        restAPIPath: testDir,
        microservice: { id: 'ms-1', name: 'hr-rapi' },
        models: [],
        user: { id: 'user-1' },
        appliedFixes: [],
      });

      await markMigrationApplied(testDir, '20240319142530_init', 'pipeline');

      const manifest = await loadManifest(testDir);
      expect(manifest.productionState).toBeDefined();
      expect(manifest.productionState.lastAppliedMigration).toBe(
        '20240319142530_init'
      );
      expect(manifest.productionState.markedBy).toBe('pipeline');
    });

    it('should reject updates when manifest version is unsupported', async () => {
      const manifest = {
        version: '0.9.0',
        microserviceId: 'test-uuid',
        models: {},
      };
      fs.writeFileSync(
        path.join(testDir, MANIFEST_FILENAME),
        JSON.stringify(manifest),
        'utf-8'
      );

      await expect(
        markMigrationApplied(testDir, '20240319142530_init', 'pipeline')
      ).rejects.toMatchObject({
        type: ERROR_TYPES.MIGRATION_ISSUES,
      });
    });
  });
});
