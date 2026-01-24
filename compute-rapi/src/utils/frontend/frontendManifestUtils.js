const fs = require('fs-extra');
const path = require('path');

const MANIFEST_FILENAME = '.frontend-manifest.json';
const MANIFEST_VERSION = '1.0.0';

/**
 * Create a new frontend manifest object.
 * @param {string[]} generatedFiles - List of generated file paths (relative to app root)
 * @param {string} microservice - Name of the microservice
 * @returns {object} Manifest object
 */
function createFrontendManifest(generatedFiles, microservice) {
  return {
    version: MANIFEST_VERSION,
    microservice,
    generatedAt: new Date().toISOString(),
    generatedFiles: generatedFiles.sort(),
  };
}

/**
 * Get the manifest file path for a frontend app.
 * @param {string} appPath - Absolute path to frontend app root
 * @returns {string} Path to manifest file
 */
function getManifestPath(appPath) {
  return path.join(appPath, 'src/core', MANIFEST_FILENAME);
}

/**
 * Save manifest to disk.
 * @param {string} appPath - Absolute path to frontend app root
 * @param {object} manifest - Manifest object to save
 */
async function saveFrontendManifest(appPath, manifest) {
  const manifestPath = getManifestPath(appPath);
  await fs.ensureDir(path.dirname(manifestPath));
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
}

/**
 * Load manifest from disk.
 * @param {string} appPath - Absolute path to frontend app root
 * @returns {Promise<object|null>} Manifest object or null if not found
 */
async function loadFrontendManifest(appPath) {
  const manifestPath = getManifestPath(appPath);
  if (await fs.pathExists(manifestPath)) {
    return fs.readJson(manifestPath);
  }
  return null;
}

/**
 * Check if a file is generated (in manifest).
 * @param {string} appPath - Absolute path to frontend app root
 * @param {string} relativePath - Path relative to app root
 * @returns {Promise<boolean>} True if file is in manifest
 */
async function isGeneratedFile(appPath, relativePath) {
  const manifest = await loadFrontendManifest(appPath);
  if (!manifest) return false;
  const normalizedPath = relativePath.replace(/\\/g, '/');
  return manifest.generatedFiles.includes(normalizedPath);
}

module.exports = {
  createFrontendManifest,
  saveFrontendManifest,
  loadFrontendManifest,
  isGeneratedFile,
  getManifestPath,
  MANIFEST_FILENAME,
};
