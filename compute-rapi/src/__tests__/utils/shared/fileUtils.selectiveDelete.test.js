/**
 * Tests for selectiveDeleteDirContents in fileUtils.js
 *
 * Verifies that protected paths are preserved during directory cleanup
 * while non-protected content is deleted.
 *
 * Protection follows core/domain separation:
 * - src/domain/ and tests/domain/ are protected (custom code)
 * - src/core/, tests/core/, tests/factories/, docs/ are regenerated
 */

// Mock prettier to avoid dynamic import issues in Jest
jest.mock('prettier', () => ({
  format: jest.fn((content) => content),
}));

const fs = require('fs');
const path = require('path');
const { selectiveDeleteDirContents } = require('#utils/shared/fileUtils.js');

describe('selectiveDeleteDirContents', () => {
  const testDir = '/tmp/test-selective-delete';

  beforeEach(() => {
    // Create test directory structure
    fs.mkdirSync(testDir, { recursive: true });
    // Core directories (should be deleted)
    fs.mkdirSync(path.join(testDir, 'src/core/controllers'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(testDir, 'src/core/schemas'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'tests/core/unit/controllers'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(testDir, 'tests/core/integration'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(testDir, 'tests/factories'), { recursive: true });
    fs.mkdirSync(path.join(testDir, 'docs'), { recursive: true });

    // Domain directories (should be preserved)
    fs.mkdirSync(path.join(testDir, 'src/domain/interceptors'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(testDir, 'tests/domain/unit/interceptors'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(testDir, 'tests/domain/integration'), {
      recursive: true,
    });

    // Create test files in core (should be deleted)
    fs.writeFileSync(
      path.join(testDir, 'src/core/controllers/user.controller.core.js'),
      'generated'
    );
    fs.writeFileSync(
      path.join(testDir, 'tests/core/unit/controllers/user.test.js'),
      'generated test'
    );
    fs.writeFileSync(
      path.join(testDir, 'tests/factories/user.factory.js'),
      'generated factory'
    );
    fs.writeFileSync(
      path.join(testDir, 'docs/ARCHITECTURE.md'),
      'generated doc'
    );

    // Create test files in domain (should be preserved)
    fs.writeFileSync(
      path.join(testDir, 'src/domain/interceptors/user.interceptor.js'),
      'custom interceptor'
    );
    fs.writeFileSync(
      path.join(
        testDir,
        'tests/domain/unit/interceptors/user.interceptor.test.js'
      ),
      'custom test'
    );

    // Create protected files
    fs.writeFileSync(path.join(testDir, '.env'), 'SECRET=value');
    fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(testDir, 'README.md'), '# Readme');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('core directories (should be deleted)', () => {
    it('should delete src/core directory', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'src/core'))).toBe(false);
    });

    it('should delete tests/core directory', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'tests/core'))).toBe(false);
    });

    it('should delete tests/factories directory', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'tests/factories'))).toBe(false);
    });

    it('should delete docs directory', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'docs'))).toBe(false);
    });
  });

  describe('domain directories (should be preserved)', () => {
    it('should preserve src/domain directory and contents', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'src/domain'))).toBe(true);
      expect(
        fs.existsSync(
          path.join(testDir, 'src/domain/interceptors/user.interceptor.js')
        )
      ).toBe(true);
    });

    it('should preserve tests/domain directory and contents', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'tests/domain'))).toBe(true);
      expect(
        fs.existsSync(
          path.join(
            testDir,
            'tests/domain/unit/interceptors/user.interceptor.test.js'
          )
        )
      ).toBe(true);
    });
  });

  describe('protected files', () => {
    it('should preserve .env files', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, '.env'))).toBe(true);
    });

    it('should preserve lock files', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'package-lock.json'))).toBe(true);
    });
  });

  describe('non-protected files', () => {
    it('should delete non-protected files', async () => {
      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, 'README.md'))).toBe(false);
    });
  });

  describe('result tracking', () => {
    it('should return deleted and preserved lists', async () => {
      const result = await selectiveDeleteDirContents(testDir);
      expect(result.deleted.length).toBeGreaterThan(0);
      expect(result.preserved.length).toBeGreaterThan(0);
    });

    it('should include src/domain in preserved list', async () => {
      const result = await selectiveDeleteDirContents(testDir);
      expect(result.preserved).toContain('src/domain');
    });

    it('should include tests/domain in preserved list', async () => {
      const result = await selectiveDeleteDirContents(testDir);
      expect(result.preserved).toContain('tests/domain');
    });

    it('should include .env in preserved list', async () => {
      const result = await selectiveDeleteDirContents(testDir);
      expect(result.preserved).toContain('.env');
    });
  });

  describe('.git directory', () => {
    it('should preserve .git directory', async () => {
      fs.mkdirSync(path.join(testDir, '.git'), { recursive: true });
      fs.writeFileSync(path.join(testDir, '.git/config'), 'git config');

      await selectiveDeleteDirContents(testDir);
      expect(fs.existsSync(path.join(testDir, '.git'))).toBe(true);
    });
  });

  describe('empty directories after deletion', () => {
    it('should remove empty parent directories after content deletion', async () => {
      // Create a nested unprotected structure
      fs.mkdirSync(path.join(testDir, 'src/generated/nested'), {
        recursive: true,
      });
      fs.writeFileSync(
        path.join(testDir, 'src/generated/nested/file.js'),
        'content'
      );

      await selectiveDeleteDirContents(testDir);

      // The nested structure should be completely removed
      expect(fs.existsSync(path.join(testDir, 'src/generated'))).toBe(false);
    });

    it('should keep tests directory if tests/domain has content', async () => {
      await selectiveDeleteDirContents(testDir);

      // tests directory should still exist because tests/domain is preserved
      expect(fs.existsSync(path.join(testDir, 'tests'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'tests/domain'))).toBe(true);
    });
  });
});
