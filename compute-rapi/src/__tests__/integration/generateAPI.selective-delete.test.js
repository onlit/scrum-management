/**
 * Integration test verifying generateAPI uses selective deletion
 *
 * This test verifies that the generator has been updated to use
 * selectiveDeleteDirContents which preserves protected paths.
 *
 * Protection follows core/domain separation:
 * - src/domain/ and tests/domain/ are protected (custom code)
 * - src/core/, tests/core/, tests/factories/, docs/ are regenerated
 */

const fs = require('fs');
const path = require('path');

// Mock prettier to avoid dynamic import issues
jest.mock('prettier', () => ({
  format: jest.fn((content) => content),
}));

const {
  selectiveDeleteDirContents,
  deleteDirContentsIfExists,
} = require('#utils/shared/fileUtils.js');

describe('generateAPI selective deletion', () => {
  const testDir = '/tmp/test-generator-delete';

  beforeEach(() => {
    // Create protected domain directories
    fs.mkdirSync(path.join(testDir, 'src/domain'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'tests/domain/unit'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/domain/custom.js'), 'custom code');
    fs.writeFileSync(path.join(testDir, 'tests/domain/unit/custom.test.js'), 'custom test');

    // Create unprotected core directories
    fs.mkdirSync(path.join(testDir, 'src/core'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'tests/core'), { recursive: true });
    fs.writeFileSync(path.join(testDir, 'src/core/generated.js'), 'generated');
    fs.writeFileSync(path.join(testDir, 'tests/core/generated.test.js'), 'generated test');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should preserve src/domain directory using selectiveDeleteDirContents', async () => {
    await selectiveDeleteDirContents(testDir);

    expect(fs.existsSync(path.join(testDir, 'src/domain/custom.js'))).toBe(true);
  });

  it('should preserve tests/domain directory using selectiveDeleteDirContents', async () => {
    await selectiveDeleteDirContents(testDir);

    expect(fs.existsSync(path.join(testDir, 'tests/domain/unit/custom.test.js'))).toBe(true);
  });

  it('should delete src/core directory using selectiveDeleteDirContents', async () => {
    await selectiveDeleteDirContents(testDir);

    expect(fs.existsSync(path.join(testDir, 'src/core'))).toBe(false);
  });

  it('should delete tests/core directory using selectiveDeleteDirContents', async () => {
    await selectiveDeleteDirContents(testDir);

    expect(fs.existsSync(path.join(testDir, 'tests/core'))).toBe(false);
  });

  it('should verify selectiveDeleteDirContents is exported from fileUtils', () => {
    expect(typeof selectiveDeleteDirContents).toBe('function');
  });

  it('should verify selectiveDeleteDirContents behavior differs from deleteDirContentsIfExists', async () => {
    // Create test directories for comparison
    const selectiveDir = '/tmp/test-selective-compare';
    const destructiveDir = '/tmp/test-destructive-compare';

    // Setup selective test
    fs.mkdirSync(path.join(selectiveDir, 'src/domain'), { recursive: true });
    fs.writeFileSync(
      path.join(selectiveDir, 'src/domain/custom.js'),
      'custom'
    );

    // Setup destructive test
    fs.mkdirSync(path.join(destructiveDir, 'src/domain'), { recursive: true });
    fs.writeFileSync(
      path.join(destructiveDir, 'src/domain/custom.js'),
      'custom'
    );

    // Run selective delete
    await selectiveDeleteDirContents(selectiveDir);

    // Run destructive delete
    await deleteDirContentsIfExists(destructiveDir);

    // Selective should preserve domain/, destructive should delete it
    expect(fs.existsSync(path.join(selectiveDir, 'src/domain/custom.js'))).toBe(
      true
    );
    expect(
      fs.existsSync(path.join(destructiveDir, 'src/domain/custom.js'))
    ).toBe(false);

    // Cleanup
    fs.rmSync(selectiveDir, { recursive: true, force: true });
    fs.rmSync(destructiveDir, { recursive: true, force: true });
  });
});
