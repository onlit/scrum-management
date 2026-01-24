/**
 * Generation Manifest Utilities
 *
 * Tracks what files were generated and what paths are protected.
 * The manifest file (.generated-manifest.json) is written to each
 * generated microservice root directory.
 *
 * @module utils/api/manifestUtils
 */

const fs = require('fs');
const path = require('path');
const { PROTECTED_DIRECTORIES } = require('#configs/constants.js');

const MANIFEST_FILENAME = '.generated-manifest.json';
const GENERATOR_VERSION = '2.5.0';

/**
 * @typedef {Object} ModelManifestEntry
 * @property {string} name - Model name (PascalCase)
 * @property {string} id - Model UUID
 * @property {number} fieldCount - Number of fields in model
 */

/**
 * @typedef {Object} GenerationManifest
 * @property {string} generatedAt - ISO timestamp of generation
 * @property {string} generatorVersion - Version of the generator
 * @property {string} microserviceId - UUID of the microservice
 * @property {string} microserviceName - Name of the microservice
 * @property {string[]} protectedPaths - Paths that are never deleted
 * @property {ModelManifestEntry[]} models - Models included in generation
 * @property {string[]} generatedFiles - List of generated file paths
 */

/**
 * Create a generation manifest object.
 *
 * @param {Object} params
 * @param {string} params.microserviceId - UUID of the microservice
 * @param {string} params.microserviceName - Name of the microservice
 * @param {ModelManifestEntry[]} params.models - Array of model metadata
 * @param {string[]} params.generatedFiles - Array of generated file paths
 * @returns {GenerationManifest}
 */
function createGenerationManifest({
  microserviceId,
  microserviceName,
  models,
  generatedFiles,
}) {
  return {
    generatedAt: new Date().toISOString(),
    generatorVersion: GENERATOR_VERSION,
    microserviceId,
    microserviceName,
    protectedPaths: [...PROTECTED_DIRECTORIES],
    models,
    generatedFiles,
  };
}

/**
 * Write manifest to the microservice output directory.
 *
 * @param {string} outputDir - Path to microservice root
 * @param {GenerationManifest} manifest - Manifest to write
 * @returns {Promise<void>}
 */
async function writeManifest(outputDir, manifest) {
  const manifestPath = path.join(outputDir, MANIFEST_FILENAME);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
}

/**
 * Read existing manifest from microservice directory.
 *
 * @param {string} outputDir - Path to microservice root
 * @returns {Promise<GenerationManifest|null>} Manifest or null if not found
 */
async function readManifest(outputDir) {
  const manifestPath = path.join(outputDir, MANIFEST_FILENAME);

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(content);
}

module.exports = {
  createGenerationManifest,
  writeManifest,
  readManifest,
  MANIFEST_FILENAME,
  GENERATOR_VERSION,
};
