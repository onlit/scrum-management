const fs = require('fs-extra');
const path = require('path');

// Directories that are NEVER deleted during frontend regeneration
const PROTECTED_FRONTEND_DIRECTORIES = [
  'src/domain', // User customizations for app-level domain extensions
];

// Directories that contain regenerated dynamic route files
// These directories are regenerated but the architecture is preserved
const DYNAMIC_ROUTE_DIRECTORIES = [
  'src/config',      // Contains entityRegistry.ts
  'src/components',  // Contains GenericListPage.tsx, GenericDetailPage.tsx
  'src/pages/[listType]', // Dynamic route pages
];

// Files that are NEVER deleted during frontend regeneration
const PROTECTED_FRONTEND_FILES = [
  '.env',
  '.env.local',
  '.env.production',
  '.env.test',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  '.frontend-manifest.json',
];

/**
 * Check if a path is protected from deletion during frontend regeneration.
 * @param {string} relativePath - Path relative to frontend app root
 * @returns {boolean} True if path should be protected
 */
function isProtectedFrontendPath(relativePath) {
  const normalizedPath = relativePath.replace(/\\/g, '/');

  // Check if path matches or is inside a protected directory
  for (const dir of PROTECTED_FRONTEND_DIRECTORIES) {
    if (normalizedPath === dir || normalizedPath.startsWith(dir + '/')) {
      return true;
    }
  }

  // Check if path matches a protected file
  const filename = normalizedPath.split('/').pop();
  return (
    PROTECTED_FRONTEND_FILES.includes(filename) ||
    PROTECTED_FRONTEND_FILES.includes(normalizedPath)
  );
}

/**
 * Selectively delete frontend app contents, preserving protected files.
 * @param {string} appPath - Absolute path to frontend app root
 * @returns {Promise<{deleted: string[], preserved: string[]}>} Summary of actions
 */
async function selectiveFrontendDelete(appPath) {
  const deleted = [];
  const preserved = [];

  async function processDirectory(dirPath, relativePath = '') {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

      if (isProtectedFrontendPath(entryRelativePath)) {
        preserved.push(entryRelativePath);
        continue;
      }

      if (entry.isDirectory()) {
        await processDirectory(fullPath, entryRelativePath);
        // Remove directory if empty after processing
        const remaining = await fs.readdir(fullPath);
        if (remaining.length === 0) {
          await fs.remove(fullPath);
          deleted.push(entryRelativePath);
        }
      } else {
        await fs.remove(fullPath);
        deleted.push(entryRelativePath);
      }
    }
  }

  await processDirectory(appPath);
  return { deleted, preserved };
}

module.exports = {
  selectiveFrontendDelete,
  isProtectedFrontendPath,
  PROTECTED_FRONTEND_DIRECTORIES,
  PROTECTED_FRONTEND_FILES,
  DYNAMIC_ROUTE_DIRECTORIES,
};
