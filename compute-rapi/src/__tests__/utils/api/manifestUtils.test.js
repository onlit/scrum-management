/**
 * Tests for manifestUtils.js
 *
 * Utilities for creating and managing generation manifests that track
 * what files were generated and what paths are protected.
 */

const fs = require('fs');
const path = require('path');
const {
  createGenerationManifest,
  writeManifest,
  readManifest,
} = require('#utils/api/manifestUtils.js');

describe('manifestUtils', () => {
  const testDir = '/tmp/test-manifest';

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('createGenerationManifest', () => {
    it('should create manifest with required fields', () => {
      const manifest = createGenerationManifest({
        microserviceId: 'test-uuid',
        microserviceName: 'hr-management',
        models: [
          { name: 'Employee', id: 'emp-uuid', fieldCount: 15 },
          { name: 'Department', id: 'dept-uuid', fieldCount: 8 },
        ],
        generatedFiles: [
          'src/core/controllers/employee.controller.core.js',
          'src/core/schemas/employee.schema.core.js',
        ],
      });

      expect(manifest.generatedAt).toBeDefined();
      expect(manifest.generatorVersion).toBeDefined();
      expect(manifest.microserviceId).toBe('test-uuid');
      expect(manifest.microserviceName).toBe('hr-management');
      expect(manifest.protectedPaths).toContain('src/domain');
      expect(manifest.models).toHaveLength(2);
      expect(manifest.generatedFiles).toHaveLength(2);
    });

    it('should include ISO timestamp', () => {
      const manifest = createGenerationManifest({
        microserviceId: 'test',
        microserviceName: 'test',
        models: [],
        generatedFiles: [],
      });

      expect(manifest.generatedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/
      );
    });
  });

  describe('writeManifest', () => {
    it('should write manifest to .generated-manifest.json', async () => {
      const manifest = createGenerationManifest({
        microserviceId: 'test',
        microserviceName: 'test',
        models: [],
        generatedFiles: [],
      });

      await writeManifest(testDir, manifest);

      const manifestPath = path.join(testDir, '.generated-manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const written = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      expect(written.microserviceId).toBe('test');
    });
  });

  describe('readManifest', () => {
    it('should read existing manifest', async () => {
      const manifest = { microserviceId: 'existing', models: [] };
      fs.writeFileSync(
        path.join(testDir, '.generated-manifest.json'),
        JSON.stringify(manifest)
      );

      const read = await readManifest(testDir);
      expect(read.microserviceId).toBe('existing');
    });

    it('should return null if manifest does not exist', async () => {
      const read = await readManifest(testDir);
      expect(read).toBeNull();
    });
  });
});
