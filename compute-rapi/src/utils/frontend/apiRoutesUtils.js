const path = require('path');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');
const {
  generateMicroserviceSubdomains,
} = require('#utils/frontend/commonUtils.js');
const {
  toStartCaseUpperUnderscore,
  toStartCaseNoSpaces,
  toCamelCase,
  convertToSlug,
} = require('#utils/shared/stringUtils.js');
const {
  createFileFromTemplate,
  formatFile,
  modifyFile,
  ensureDirExists,
} = require('#utils/shared/fileUtils.js');
const { updateOrAddEnvVarInDockerfile } = require('./devopsUtils.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

/**
 * Generate a route entry for the new object-based format.
 * Used for internal routes (same microservice).
 */
function generateNodeRouteEntry(model) {
  const modelName = model?.name;
  if (!modelName) {
    return null;
  }

  const slug = resolveModelSlug(model);
  const startCased = toStartCaseNoSpaces(modelName);

  return `get${startCased}URL: ({ query = '' } = {}) => \`\${HOST}/api/v1/${slug}/\${query}\``;
}

/**
 * Generate a route entry for external routes (different microservice).
 * These use process.env directly instead of HOST const.
 */
function generateExternalRouteEntry({ modelName, envHost, slug, isNode }) {
  if (!modelName) {
    return null;
  }

  const startCased = toStartCaseNoSpaces(modelName);
  const apiPath = isNode ? 'api/v1' : 'api';

  return `get${startCased}URL: ({ query = '' } = {}) => \`\${process.env.${envHost}}/${apiPath}/${slug}/\${query}\``;
}

/**
 * Create routes definition file in entity-core/routes/definitions/{slug}.ts
 * and register it in entity-core/routes/index.ts
 */
async function createEntityCoreRoutes({
  entityCore,
  frontend,
  models,
  microserviceName,
  user,
  mainApp,
  context,
} = {}) {
  const microserviceSlug = convertToSlug(microserviceName);
  const msNameUpper = toStartCaseUpperUnderscore(microserviceName);
  const msNamePascal = toStartCaseNoSpaces(microserviceName);
  const msNameCamel = toCamelCase(microserviceName);

  // Generate internal route entries for all models (deduplicated by function name)
  const seenRouteKeys = new Set();
  const internalRouteEntries = models
    .filter((model) => !model?.deleted)
    .map((model) => {
      const entry = generateNodeRouteEntry(model);
      if (!entry) return null;

      // Extract function name (e.g., "getOrderURL" from "getOrderURL: ({ query...")
      const keyMatch = entry.match(/^(get\w+URL):/);
      const key = keyMatch ? keyMatch[1] : null;

      if (key && seenRouteKeys.has(key)) {
        logWithTrace('Duplicate route key skipped in createEntityCoreRoutes', context, {
          key,
          modelName: model?.name,
        });
        return null;
      }

      if (key) {
        seenRouteKeys.add(key);
      }

      return entry;
    })
    .filter(Boolean);

  // Create routes/definitions directory
  const definitionsPath = path.join(entityCore.routesPath, 'definitions');
  await ensureDirExists(definitionsPath);

  // Create the route definition file
  await createFileFromTemplate({
    templatePathSegments: [
      frontend?.constructorPath,
      'entity-core',
      'routes',
      'routeDefinition.template.ts',
    ],
    destinationPathSegments: [definitionsPath, `${microserviceSlug}.ts`],
    user,
    templateReplacements: {
      '@gen{MS_NAME_UPPER}': msNameUpper,
      '@gen{MS_NAME_PASCAL}': msNamePascal,
      '@gen{MS_NAME_CAMEL}': msNameCamel,
      '// @gen:ROUTE_ENTRIES': internalRouteEntries.join(',\n  '),
    },
  });

  await formatFile(path.join(definitionsPath, `${microserviceSlug}.ts`));

  // Register in routes/index.ts
  const routesIndexPath = path.join(entityCore.routesPath, 'index.ts');

  modifyFile(routesIndexPath, (content) => {
    let modifiedContent = content;

    // Check if import already exists using regex to handle quote variations
    const importPattern = new RegExp(
      `import\\s*\\{\\s*${msNameCamel}Routes\\s*\\}\\s*from\\s*['"]\\./definitions/${microserviceSlug}['"];?`
    );
    if (!importPattern.test(modifiedContent)) {
      // Add import at the top (after existing imports)
      const importStatement = `import { ${msNameCamel}Routes } from './definitions/${microserviceSlug}';`;
      const importInsertPoint = modifiedContent.lastIndexOf("import { ");
      if (importInsertPoint !== -1) {
        const endOfImport = modifiedContent.indexOf('\n', importInsertPoint);
        modifiedContent =
          modifiedContent.slice(0, endOfImport + 1) +
          importStatement +
          '\n' +
          modifiedContent.slice(endOfImport + 1);
      }
    }

    // Check if route registry entry already exists using regex
    // Handles: 'slug': routes, "slug": routes, or slug: routes (no quotes for valid identifiers)
    const registryPattern = new RegExp(
      `['"]?${microserviceSlug.replace(/-/g, '\\-')}['"]?\\s*:\\s*${msNameCamel}Routes`
    );
    if (!registryPattern.test(modifiedContent)) {
      // Add to route registry
      const registryEntry = `'${microserviceSlug}': ${msNameCamel}Routes,`;
      modifiedContent = modifiedContent.replace(
        '// @gen:ROUTE_REGISTRY',
        `${registryEntry}\n  // @gen:ROUTE_REGISTRY`
      );
    }

    return modifiedContent;
  });

  await formatFile(routesIndexPath);

  // Update Dockerfile env vars
  const subdomains = generateMicroserviceSubdomains(microserviceName);

  for (const [env, domain] of Object.entries(subdomains)) {
    modifyFile(path.join(mainApp?.path, `Dockerfile.${env}`), (content) => {
      return updateOrAddEnvVarInDockerfile(
        content,
        `NEXT_PUBLIC_${msNameUpper}_HOST`,
        `'${domain}'`
      );
    });
  }
}

/**
 * Register validation schemas in entity-core/validationSchemas/index.ts
 * Adds import and registry entry while preserving the @gen:VALIDATION_SCHEMA_REGISTRY placeholder
 */
async function registerValidationSchemas({ entityCore, microserviceName } = {}) {
  const microserviceSlug = convertToSlug(microserviceName);
  const msNameCamel = toCamelCase(microserviceName);

  const validationSchemasIndexPath = path.join(
    entityCore.path,
    'validationSchemas',
    'index.ts'
  );

  modifyFile(validationSchemasIndexPath, (content) => {
    let modifiedContent = content;

    // Check if import already exists using regex to handle quote variations
    // Matches: '../{slug}/validationSchemas', '../{slug}/core/configs/validationSchemas', or '../{slug}' (barrel export)
    const importPattern = new RegExp(
      `import\\s*\\{\\s*validationSchemas\\s+as\\s+${msNameCamel}ValidationSchemas\\s*\\}\\s*from\\s*['"]\\.\\./${microserviceSlug}(/validationSchemas|/core/configs/validationSchemas)?['"];?`
    );
    if (!importPattern.test(modifiedContent)) {
      // Add import using path to core/configs/validationSchemas (where generator creates them)
      const importStatement = `import { validationSchemas as ${msNameCamel}ValidationSchemas } from '../${microserviceSlug}/core/configs/validationSchemas';`;
      const importInsertPoint = modifiedContent.lastIndexOf(
        'import { validationSchemas as '
      );
      if (importInsertPoint !== -1) {
        const endOfImport = modifiedContent.indexOf('\n', importInsertPoint);
        modifiedContent =
          modifiedContent.slice(0, endOfImport + 1) +
          importStatement +
          '\n' +
          modifiedContent.slice(endOfImport + 1);
      }
    }

    // Check if registry entry already exists using regex
    // Handles: 'slug': schemas, "slug": schemas, or slug: schemas (no quotes for valid identifiers)
    const registryPattern = new RegExp(
      `['"]?${microserviceSlug.replace(/-/g, '\\-')}['"]?\\s*:\\s*${msNameCamel}ValidationSchemas`
    );
    if (!registryPattern.test(modifiedContent)) {
      // Add to validation schema registry, preserving the placeholder
      const registryEntry = `'${microserviceSlug}': ${msNameCamel}ValidationSchemas,`;
      modifiedContent = modifiedContent.replace(
        '// @gen:VALIDATION_SCHEMA_REGISTRY',
        `${registryEntry}\n  // @gen:VALIDATION_SCHEMA_REGISTRY`
      );
    }

    return modifiedContent;
  });

  await formatFile(validationSchemasIndexPath);
}

module.exports = {
  generateNodeRouteEntry,
  generateExternalRouteEntry,
  createEntityCoreRoutes,
  registerValidationSchemas,
};
