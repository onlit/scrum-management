/**
 * Dynamic Route Utilities for Frontend Generation
 *
 * This module handles the generation of dynamic route architecture files,
 * which consolidates hundreds of static entity pages into a single pair of
 * dynamic routes using an entity registry pattern.
 *
 * Benefits:
 * - Reduces file count (e.g., 790 static pages → 2 dynamic routes)
 * - Centralizes component logic for easier maintenance
 * - Enables automatic propagation of fixes across all entities
 * - Significantly reduces build times and memory usage
 */

const path = require('path');
const {
  toStartCaseNoSpaces,
  toCamelCase,
  toStartCaseUpperUnderscore,
  toStartCase,
  resolveModelSlug,
} = require('#utils/shared/stringUtils.js');
const {
  ensureDirExists,
  createFileFromTemplate,
  formatFile,
  copyFile,
} = require('#utils/shared/fileUtils.js');
const { getModelName, isValidModel } = require('#utils/frontend/commonUtils.js');

/**
 * Generate the entity registry file with all model slugs and labels.
 * The registry maps slugs to entity configurations including forms, columns, and data mappers.
 *
 * @param {Object} params
 * @param {Object} params.frontend - Frontend path configuration
 * @param {Array} params.models - Array of model definitions
 * @param {string} params.microserviceSlug - Kebab-case microservice slug
 * @param {string} params.microserviceName - Original microservice name
 * @param {Object} params.user - User object for file generation
 */
async function createEntityRegistry({
  frontend,
  models,
  microserviceSlug,
  microserviceName,
  user,
  modelsWithDetailPages = [],
}) {
  // Helper to escape single quotes in strings for JS output
  const escapeQuotes = (str) => (str || '').replace(/'/g, "\\'");

  // Generate entity entries from models with all naming variants pre-computed
  const entityEntries = models
    .filter((model) => !model?.deleted)
    .map((model) => {
      const modelName = getModelName({ model });

      // All naming variants computed directly from model data
      const slug = resolveModelSlug(model);
      const pascalSingular = toStartCaseNoSpaces(modelName); // "AssetPropertyType"
      const camelSingular = toCamelCase(modelName); // "assetPropertyType"

      // Label: use model.label as-is if set, otherwise derive from model name
      const label = model?.label || toStartCase(modelName); // "Asset Property Type"

      const helpfulHint = model?.helpfulHint || null;

      // Build the entry object as a string
      const parts = [
        `slug: '${slug}'`,
        `pascalSingular: '${pascalSingular}'`,
        `camelSingular: '${camelSingular}'`,
        `label: '${escapeQuotes(label)}'`,
      ];

      if (helpfulHint) {
        parts.push(`helpfulHint: '${escapeQuotes(helpfulHint)}'`);
      }

      return `  { ${parts.join(', ')} },`;
    })
    .sort((a, b) => a.localeCompare(b))
    .join('\n');

  // Generate DetailCore imports for models that have detail pages
  const detailCoreImports = modelsWithDetailPages
    .map((model) => {
      const modelName = getModelName({ model });
      const slug = resolveModelSlug(model);
      const pascalSingular = toStartCaseNoSpaces(modelName);
      return `import { ${pascalSingular}DetailCore } from '@/core/pages/${slug}';`;
    })
    .sort()
    .join('\n');

  // Generate detailCoreMap entries
  const detailCoreMapEntries = modelsWithDetailPages
    .map((model) => {
      const modelName = getModelName({ model });
      const slug = resolveModelSlug(model);
      const pascalSingular = toStartCaseNoSpaces(modelName);
      return `  '${slug}': ${pascalSingular}DetailCore,`;
    })
    .sort()
    .join('\n');

  const configDir = path.join(frontend?.path, 'src', 'config');
  await ensureDirExists(configDir);

  await createFileFromTemplate({
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'config',
      'entityRegistry.template.ts',
    ],
    destinationPathSegments: [configDir, 'entityRegistry.ts'],
    templateReplacements: {
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MICROSERVICE_NAME|Pascal}': toStartCaseNoSpaces(microserviceName),
      '@gen{MICROSERVICE_NAME|UPPER_SNAKE}': toStartCaseUpperUnderscore(
        microserviceName
      ),
      '  // @gen:ENTITY_ENTRIES': entityEntries,
      '// @gen:DETAIL_CORE_IMPORTS': detailCoreImports,
      '  // @gen:DETAIL_CORE_MAP': detailCoreMapEntries,
    },
    user,
  });

  await formatFile(path.join(configDir, 'entityRegistry.ts'));

  console.log(
    `[DynamicRoutes] Created entity registry with ${models.filter((m) => !m?.deleted).length} entities (${modelsWithDetailPages.length} with detail pages)`
  );
}

/**
 * Generate the GenericListPage component.
 * This reusable component dynamically loads entity-specific forms, columns, and data mappers.
 *
 * @param {Object} params
 * @param {Object} params.frontend - Frontend path configuration
 * @param {string} params.microserviceSlug - Kebab-case microservice slug
 * @param {string} params.microserviceName - Original microservice name
 * @param {Object} params.user - User object for file generation
 */
async function createGenericListPage({
  frontend,
  microserviceSlug,
  microserviceName,
  user,
}) {
  const componentsDir = path.join(frontend?.path, 'src', 'components');
  await ensureDirExists(componentsDir);

  await createFileFromTemplate({
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'components',
      'GenericListPage.template.tsx',
    ],
    destinationPathSegments: [componentsDir, 'GenericListPage.tsx'],
    templateReplacements: {
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MICROSERVICE_NAME|Pascal}': toStartCaseNoSpaces(microserviceName),
      '@gen{MICROSERVICE_NAME|UPPER_SNAKE}': toStartCaseUpperUnderscore(
        microserviceName
      ),
    },
    user,
  });

  await formatFile(path.join(componentsDir, 'GenericListPage.tsx'));

  console.log('[DynamicRoutes] Created GenericListPage component');
}

/**
 * Generate the GenericDetailPage component.
 * This reusable component dynamically loads detail forms and handles related tabs.
 *
 * @param {Object} params
 * @param {Object} params.frontend - Frontend path configuration
 * @param {string} params.microserviceSlug - Kebab-case microservice slug
 * @param {string} params.microserviceName - Original microservice name
 * @param {Object} params.user - User object for file generation
 */
async function createGenericDetailPage({
  frontend,
  microserviceSlug,
  microserviceName,
  user,
}) {
  const componentsDir = path.join(frontend?.path, 'src', 'components');
  await ensureDirExists(componentsDir);

  await createFileFromTemplate({
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'components',
      'GenericDetailPage.template.tsx',
    ],
    destinationPathSegments: [componentsDir, 'GenericDetailPage.tsx'],
    templateReplacements: {
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MICROSERVICE_NAME|Pascal}': toStartCaseNoSpaces(microserviceName),
      '@gen{MICROSERVICE_NAME|UPPER_SNAKE}': toStartCaseUpperUnderscore(
        microserviceName
      ),
    },
    user,
  });

  await formatFile(path.join(componentsDir, 'GenericDetailPage.tsx'));

  console.log('[DynamicRoutes] Created GenericDetailPage component');
}

/**
 * Generate the dynamic route files [listType]/index.tsx and [listType]/[id].tsx.
 * These routes handle all entity types through the entity registry.
 *
 * @param {Object} params
 * @param {Object} params.frontend - Frontend path configuration
 * @param {string} params.microserviceSlug - Kebab-case microservice slug
 * @param {Object} params.user - User object for file generation
 */
async function createDynamicRouteFiles({ frontend, microserviceSlug, user }) {
  // Create [listType] directory in pages
  const listTypeDir = path.join(frontend?.path, 'src', 'pages', '[listType]');
  await ensureDirExists(listTypeDir);

  // Create index.tsx (list page route)
  await createFileFromTemplate({
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'pages',
      '[listType]',
      'index.template.tsx',
    ],
    destinationPathSegments: [listTypeDir, 'index.tsx'],
    templateReplacements: {
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
    },
    user,
  });

  // Create [id].tsx (detail page route)
  await createFileFromTemplate({
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'pages',
      '[listType]',
      '[id].template.tsx',
    ],
    destinationPathSegments: [listTypeDir, '[id].tsx'],
    templateReplacements: {
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
    },
    user,
  });

  await formatFile(path.join(listTypeDir, 'index.tsx'));
  await formatFile(path.join(listTypeDir, '[id].tsx'));

  console.log('[DynamicRoutes] Created dynamic route files');
}

/**
 * Main orchestrator function for generating all dynamic route architecture files.
 * Call this instead of generating individual static pages for each model.
 *
 * @param {Object} params
 * @param {Object} params.frontend - Frontend path configuration
 * @param {Array} params.models - Array of model definitions
 * @param {string} params.microserviceSlug - Kebab-case microservice slug
 * @param {string} params.microserviceName - Original microservice name
 * @param {Object} params.user - User object for file generation
 * @param {Array} params.modelsWithDetailPages - Models that have detail pages (with clickable links)
 */
async function generateDynamicRouteFiles({
  frontend,
  models,
  microserviceSlug,
  microserviceName,
  user,
  modelsWithDetailPages = [],
}) {
  console.log('[DynamicRoutes] Starting dynamic route generation...');

  // 1. Create entity registry with all model slugs and DetailCore mappings
  await createEntityRegistry({
    frontend,
    models,
    microserviceSlug,
    microserviceName,
    user,
    modelsWithDetailPages,
  });

  // 2. Create GenericListPage component
  await createGenericListPage({
    frontend,
    microserviceSlug,
    microserviceName,
    user,
  });

  // 3. Create GenericDetailPage component
  await createGenericDetailPage({
    frontend,
    microserviceSlug,
    microserviceName,
    user,
  });

  // 4. Create dynamic route files
  await createDynamicRouteFiles({
    frontend,
    microserviceSlug,
    user,
  });

  console.log('[DynamicRoutes] Dynamic route generation complete');
}

/**
 * Get the list of files generated by dynamic routes for manifest tracking.
 *
 * @returns {string[]} Array of relative file paths
 */
function getDynamicRouteGeneratedFiles() {
  return [
    'src/config/entityRegistry.ts',
    'src/components/GenericListPage.tsx',
    'src/components/GenericDetailPage.tsx',
    'src/pages/[listType]/index.tsx',
    'src/pages/[listType]/[id].tsx',
  ];
}

module.exports = {
  createEntityRegistry,
  createGenericListPage,
  createGenericDetailPage,
  createDynamicRouteFiles,
  generateDynamicRouteFiles,
  getDynamicRouteGeneratedFiles,
};
