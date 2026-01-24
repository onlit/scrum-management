const path = require('path');
const fs = require('fs-extra');
const {
  createFrontendManifest,
  loadFrontendManifest,
  saveFrontendManifest,
  isGeneratedFile,
} = require('#src/utils/frontend/frontendManifestUtils');

describe('frontendManifestUtils', () => {
  const testDir = path.join(__dirname, 'test-manifest-app');
  const manifestPath = path.join(testDir, 'src/core/.frontend-manifest.json');

  beforeEach(async () => {
    await fs.ensureDir(path.join(testDir, 'src/core'));
  });

  afterEach(async () => {
    await fs.remove(testDir);
  });

  describe('createFrontendManifest', () => {
    it('should create manifest with generated files list', () => {
      const files = [
        'src/core/forms/UserCreate.tsx',
        'src/core/forms/UserDetail.tsx',
        'src/core/configs/tableColumns/userColumns.ts',
      ];
      const manifest = createFrontendManifest(files, 'payment');

      expect(manifest.microservice).toBe('payment');
      expect(manifest.generatedFiles).toEqual(files);
      expect(manifest.generatedAt).toBeDefined();
      expect(manifest.version).toBe('1.0.0');
    });
  });

  describe('saveFrontendManifest / loadFrontendManifest', () => {
    it('should save and load manifest correctly', async () => {
      const files = ['src/core/forms/Test.tsx'];
      const manifest = createFrontendManifest(files, 'payment');

      await saveFrontendManifest(testDir, manifest);
      const loaded = await loadFrontendManifest(testDir);

      expect(loaded.microservice).toBe('payment');
      expect(loaded.generatedFiles).toEqual(files);
    });
  });

  describe('isGeneratedFile', () => {
    it('should return true for files in manifest', async () => {
      const files = ['src/core/forms/UserCreate.tsx'];
      const manifest = createFrontendManifest(files, 'payment');
      await saveFrontendManifest(testDir, manifest);

      const result = await isGeneratedFile(testDir, 'src/core/forms/UserCreate.tsx');
      expect(result).toBe(true);
    });

    it('should return false for files not in manifest', async () => {
      const files = ['src/core/forms/UserCreate.tsx'];
      const manifest = createFrontendManifest(files, 'payment');
      await saveFrontendManifest(testDir, manifest);

      const result = await isGeneratedFile(testDir, 'src/domain/forms/Custom.tsx');
      expect(result).toBe(false);
    });
  });
});
