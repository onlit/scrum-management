/**
 * Tests for Protected Path Constants
 *
 * These constants define directories and files that should never be deleted
 * during microservice regeneration to preserve custom business logic.
 *
 * Protection follows core/domain separation:
 * - src/domain/ and tests/domain/ are protected (custom code)
 * - src/core/, tests/core/, tests/factories/, docs/ are regenerated
 */

const {
  PROTECTED_DIRECTORIES,
  PROTECTED_FILES,
  isProtectedPath,
} = require('#configs/constants.js');

describe('Protected Path Constants', () => {
  describe('PROTECTED_DIRECTORIES', () => {
    it('should include src/domain directory', () => {
      expect(PROTECTED_DIRECTORIES).toContain('src/domain');
    });

    it('should include tests/domain directory', () => {
      expect(PROTECTED_DIRECTORIES).toContain('tests/domain');
    });

    it('should NOT include entire tests directory (only tests/domain)', () => {
      expect(PROTECTED_DIRECTORIES).not.toContain('tests');
    });

    it('should NOT include docs directory (regenerated)', () => {
      expect(PROTECTED_DIRECTORIES).not.toContain('docs');
    });

    it('should NOT include src/core directory (regenerated)', () => {
      expect(PROTECTED_DIRECTORIES).not.toContain('src/core');
    });

    it('should have exactly 2 protected directories', () => {
      expect(PROTECTED_DIRECTORIES).toHaveLength(2);
    });
  });

  describe('PROTECTED_FILES', () => {
    it('should include .env files', () => {
      expect(PROTECTED_FILES).toContain('.env');
      expect(PROTECTED_FILES).toContain('.env.local');
      expect(PROTECTED_FILES).toContain('.env.production');
    });

    it('should include lock files', () => {
      expect(PROTECTED_FILES).toContain('package-lock.json');
      expect(PROTECTED_FILES).toContain('yarn.lock');
      expect(PROTECTED_FILES).toContain('pnpm-lock.yaml');
    });
  });

  describe('isProtectedPath', () => {
    describe('protected domain paths', () => {
      it('should return true for src/domain directory', () => {
        expect(isProtectedPath('src/domain')).toBe(true);
      });

      it('should return true for files inside src/domain', () => {
        expect(isProtectedPath('src/domain/interceptors')).toBe(true);
        expect(
          isProtectedPath('src/domain/interceptors/user.interceptor.js')
        ).toBe(true);
        expect(isProtectedPath('src/domain/routes/v1/custom.routes.js')).toBe(
          true
        );
        expect(isProtectedPath('src/domain/schemas/custom.schema.js')).toBe(
          true
        );
      });

      it('should return true for tests/domain directory', () => {
        expect(isProtectedPath('tests/domain')).toBe(true);
      });

      it('should return true for files inside tests/domain', () => {
        expect(isProtectedPath('tests/domain/unit/interceptors')).toBe(true);
        expect(
          isProtectedPath(
            'tests/domain/unit/interceptors/user.interceptor.test.js'
          )
        ).toBe(true);
        expect(
          isProtectedPath('tests/domain/integration/routes/custom.test.js')
        ).toBe(true);
      });
    });

    describe('unprotected core paths (should be regenerated)', () => {
      it('should return false for src/core paths', () => {
        expect(isProtectedPath('src/core')).toBe(false);
        expect(isProtectedPath('src/core/controllers')).toBe(false);
        expect(
          isProtectedPath('src/core/controllers/user.controller.core.js')
        ).toBe(false);
        expect(isProtectedPath('src/core/schemas')).toBe(false);
        expect(isProtectedPath('src/core/routes/v1')).toBe(false);
      });

      it('should return false for tests/core paths', () => {
        expect(isProtectedPath('tests/core')).toBe(false);
        expect(isProtectedPath('tests/core/unit/controllers')).toBe(false);
        expect(
          isProtectedPath('tests/core/unit/controllers/user.test.js')
        ).toBe(false);
        expect(isProtectedPath('tests/core/integration')).toBe(false);
        expect(isProtectedPath('tests/core/setup/helpers.js')).toBe(false);
      });

      it('should return false for tests/factories paths', () => {
        expect(isProtectedPath('tests/factories')).toBe(false);
        expect(isProtectedPath('tests/factories/user.factory.js')).toBe(false);
      });

      it('should return false for docs paths', () => {
        expect(isProtectedPath('docs')).toBe(false);
        expect(isProtectedPath('docs/ARCHITECTURE.md')).toBe(false);
        expect(isProtectedPath('docs/EXTENSION_GUIDE.md')).toBe(false);
      });
    });

    describe('protected files', () => {
      it('should return true for .env files', () => {
        expect(isProtectedPath('.env')).toBe(true);
        expect(isProtectedPath('.env.local')).toBe(true);
        expect(isProtectedPath('.env.production')).toBe(true);
        expect(isProtectedPath('.env.test')).toBe(true);
      });

      it('should return true for lock files', () => {
        expect(isProtectedPath('package-lock.json')).toBe(true);
        expect(isProtectedPath('yarn.lock')).toBe(true);
        expect(isProtectedPath('pnpm-lock.yaml')).toBe(true);
      });

      it('should return true for generated manifest', () => {
        expect(isProtectedPath('.generated-manifest.json')).toBe(true);
      });
    });

    describe('path normalization', () => {
      it('should handle Windows-style paths', () => {
        expect(isProtectedPath('src\\domain\\interceptors')).toBe(true);
        expect(isProtectedPath('tests\\domain\\unit')).toBe(true);
        expect(isProtectedPath('tests\\core\\unit')).toBe(false);
      });
    });
  });
});
