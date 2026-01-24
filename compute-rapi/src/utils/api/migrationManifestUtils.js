/**
 * Migration Manifest Utilities
 *
 * Handles CRUD operations for migration-manifest.json which tracks
 * schema state, migration history, and auto-fixes applied during
 * Prisma schema regeneration.
 *
 * @module utils/api/migrationManifestUtils
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const {
  withErrorHandling,
  createStandardError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  COMPUTE_PATH,
} = require('#configs/constants.js');

const MANIFEST_FILENAME = 'migration-manifest.json';
const MANIFEST_VERSION = '1.0.0';

/**
 * Generate SHA-256 checksum for content
 * @param {string} content - Content to hash
 * @returns {string} Checksum prefixed with "sha256:"
 */
function generateChecksum(content) {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Generate checksum for a model based on field definitions
 * @param {Object} model - Model with fieldDefns array
 * @returns {string} Model checksum
 */
function generateModelChecksum(model) {
  const fieldData = (model.fieldDefns || [])
    .map((f) => ({
      name: f.name,
      dataType: f.dataType,
      isOptional: f.isOptional,
      isForeignKey: f.isForeignKey,
    }))
    .sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
  return generateChecksum(
    JSON.stringify({ modelName: model.name, fields: fieldData })
  );
}

/**
 * Generate combined schema checksum from all models
 * @param {Array} models - Array of model objects
 * @returns {string} Schema checksum
 */
function generateSchemaChecksum(models) {
  const checksums = models.map((m) => generateModelChecksum(m)).sort();
  return generateChecksum(checksums.join(':'));
}

function isPathInside(basePath, targetPath) {
  const normalizedBase = path.resolve(basePath);
  const normalizedTarget = path.resolve(targetPath);
  if (normalizedBase === normalizedTarget) return true;
  return normalizedTarget.startsWith(`${normalizedBase}${path.sep}`);
}

function resolveManifestPath(restAPIPath) {
  if (typeof restAPIPath !== 'string' || restAPIPath.trim() === '') {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid rest API path for migration manifest',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'resolve_migration_manifest_path',
        details: { restAPIPath },
      }
    );
  }

  if (restAPIPath.includes('\0')) {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid rest API path for migration manifest',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'resolve_migration_manifest_path',
        details: { restAPIPath },
      }
    );
  }

  const resolvedRestAPIPath = path.resolve(restAPIPath);
  const isTestEnv =
    process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
  const allowedRoots = [COMPUTE_PATH];

  if (isTestEnv) {
    allowedRoots.push(os.tmpdir());
  }

  const isAllowed = allowedRoots.some((root) =>
    isPathInside(root, resolvedRestAPIPath)
  );

  if (!isAllowed) {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Rest API path is outside allowed roots for migration manifest',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'resolve_migration_manifest_path',
        details: { restAPIPath: resolvedRestAPIPath, allowedRoots },
      }
    );
  }

  const manifestPath = path.resolve(resolvedRestAPIPath, MANIFEST_FILENAME);
  if (!isPathInside(resolvedRestAPIPath, manifestPath)) {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid migration manifest path resolution',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'resolve_migration_manifest_path',
        details: { restAPIPath: resolvedRestAPIPath, manifestPath },
      }
    );
  }

  return { resolvedRestAPIPath, manifestPath };
}

function writeJsonFileAtomic(filePath, data) {
  const directory = path.dirname(filePath);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(data, null, 2);

  let existingMode = null;
  try {
    existingMode = fs.statSync(filePath).mode;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  fs.writeFileSync(tempPath, payload, {
    encoding: 'utf-8',
    mode: existingMode || 0o600,
  });

  if (existingMode) {
    fs.chmodSync(tempPath, existingMode);
  }

  fs.renameSync(tempPath, filePath);
}

/**
 * Load migration manifest from generated API directory
 * @param {string} restAPIPath - Path to generated REST API directory
 * @returns {Promise<Object|null>} Manifest object or null if not found
 */
const loadManifest = withErrorHandling(async (restAPIPath) => {
  const { resolvedRestAPIPath, manifestPath } =
    resolveManifestPath(restAPIPath);

  if (!fs.existsSync(resolvedRestAPIPath)) {
    return null;
  }

  let content;
  try {
    content = fs.readFileSync(manifestPath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw createStandardError(
      ERROR_TYPES.MIGRATION_ISSUES,
      'Migration manifest is corrupted or unreadable',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'load_migration_manifest',
        details: { manifestPath },
        originalError: error,
      }
    );
  }

  if (!parsed.version) {
    throw createStandardError(
      ERROR_TYPES.MIGRATION_ISSUES,
      'Migration manifest is missing a version',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'load_migration_manifest',
        details: { manifestPath },
      }
    );
  }

  if (parsed.version !== MANIFEST_VERSION) {
    throw createStandardError(
      ERROR_TYPES.MIGRATION_ISSUES,
      'Unsupported migration manifest version',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'load_migration_manifest',
        details: {
          manifestPath,
          manifestVersion: parsed.version,
          expectedVersion: MANIFEST_VERSION,
        },
      }
    );
  }

  return parsed;
}, 'load_migration_manifest');

/**
 * Update or create migration manifest
 * @param {Object} params
 * @param {string} params.restAPIPath - Path to REST API directory
 * @param {Object} params.microservice - Microservice metadata
 * @param {Array} params.models - Current model definitions
 * @param {Object} params.user - User who triggered generation
 * @param {Array} params.appliedFixes - Auto-fixes applied in this generation
 * @returns {Promise<void>}
 */
const updateManifest = withErrorHandling(
  async ({ restAPIPath, microservice, models, user, appliedFixes = [] }) => {
    const { resolvedRestAPIPath, manifestPath } =
      resolveManifestPath(restAPIPath);

    fs.mkdirSync(resolvedRestAPIPath, { recursive: true });

    const existingManifest = await loadManifest(restAPIPath);
    const existingAutoFixes = existingManifest?.autoFixesApplied || [];

    // Build models snapshot
    const modelsSnapshot = {};
    for (const model of models) {
      modelsSnapshot[model.name] = {
        checksum: generateModelChecksum(model),
        fields: (model.fieldDefns || []).reduce((acc, f) => {
          acc[f.name] = {
            dataType: f.dataType,
            isOptional: f.isOptional,
            isForeignKey: f.isForeignKey || false,
          };
          return acc;
        }, {}),
      };
    }

    const manifest = {
      version: MANIFEST_VERSION,
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      currentGeneration: {
        generatedAt: new Date().toISOString(),
        schemaChecksum: generateSchemaChecksum(models),
        generatedBy: user?.id || 'unknown',
      },
      models: modelsSnapshot,
      autoFixesApplied: [...existingAutoFixes, ...appliedFixes],
    };

    writeJsonFileAtomic(manifestPath, manifest);
  },
  'update_migration_manifest'
);

/**
 * Mark a migration as applied to production
 * @param {string} restAPIPath - Path to REST API directory
 * @param {string} migrationName - Name of applied migration
 * @param {string} markedBy - Who/what marked it (e.g., "deploy-pipeline")
 * @returns {Promise<void>}
 */
const markMigrationApplied = withErrorHandling(
  async (restAPIPath, migrationName, markedBy = 'manual') => {
    const manifest = await loadManifest(restAPIPath);
    if (!manifest) return;

    manifest.productionState = {
      lastAppliedMigration: migrationName,
      appliedAt: new Date().toISOString(),
      markedBy,
    };

    const { manifestPath } = resolveManifestPath(restAPIPath);
    writeJsonFileAtomic(manifestPath, manifest);
  },
  'mark_migration_applied'
);

module.exports = {
  loadManifest,
  updateManifest,
  markMigrationApplied,
  generateChecksum,
  generateModelChecksum,
  generateSchemaChecksum,
  MANIFEST_FILENAME,
  MANIFEST_VERSION,
};
