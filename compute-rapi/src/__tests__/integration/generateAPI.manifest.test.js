/**
 * Integration test for manifest generation in generateAPI
 *
 * Verifies that the generator writes a manifest file with model metadata.
 */

const fs = require('fs');
const path = require('path');
const {
  createGenerationManifest,
  writeManifest,
  readManifest,
} = require('#utils/api/manifestUtils.js');

describe('generateAPI manifest generation', () => {
  const testDir = '/tmp/test-manifest-gen';

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should track models during manifest creation', () => {
    const models = [
      { name: 'Employee', id: 'emp-uuid', fieldDefns: [{}, {}, {}] },
      { name: 'Department', id: 'dept-uuid', fieldDefns: [{}, {}] },
    ];

    const manifest = createGenerationManifest({
      microserviceId: 'ms-uuid',
      microserviceName: 'hr-management',
      models: models.map((m) => ({
        name: m.name,
        id: m.id,
        fieldCount: m.fieldDefns?.length || 0,
      })),
      generatedFiles: [],
    });

    expect(manifest.models).toHaveLength(2);
    expect(manifest.models[0].name).toBe('Employee');
    expect(manifest.models[0].fieldCount).toBe(3);
    expect(manifest.models[1].name).toBe('Department');
    expect(manifest.models[1].fieldCount).toBe(2);
  });

  it('should write and read manifest from disk', async () => {
    const manifest = createGenerationManifest({
      microserviceId: 'test-uuid',
      microserviceName: 'test-service',
      models: [{ name: 'TestModel', id: 'model-uuid', fieldCount: 5 }],
      generatedFiles: [],
    });

    await writeManifest(testDir, manifest);

    const manifestPath = path.join(testDir, '.generated-manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const read = await readManifest(testDir);
    expect(read.microserviceId).toBe('test-uuid');
    expect(read.microserviceName).toBe('test-service');
    expect(read.models[0].name).toBe('TestModel');
  });

  it('should include protected paths in manifest', () => {
    const manifest = createGenerationManifest({
      microserviceId: 'test',
      microserviceName: 'test',
      models: [],
      generatedFiles: [],
    });

    expect(manifest.protectedPaths).toContain('src/domain');
  });
});
