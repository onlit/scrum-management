/**
 * Domain Layer Scaffolding Utilities
 *
 * Creates the protected domain layer structure on first generation.
 * Never overwrites existing files to preserve custom business logic.
 *
 * @module utils/api/domainScaffoldUtils
 */

const fs = require('fs');
const path = require('path');

/**
 * Directories to create in the domain layer.
 * These are protected from deletion during regeneration.
 */
const DOMAIN_DIRECTORIES = [
  'src/domain/controllers',
  'src/domain/routes/v1',
  'src/domain/schemas',
  'src/domain/interceptors',
  'src/domain/extensions',
  'src/domain/constants',
  'src/domain/bullQueues',
  'src/domain/bullQueues/queues',
  'src/domain/bullQueues/workers',
  'src/domain/middlewares',
  // Core test directories (generated code tests)
  'tests/core/boot',
  'tests/core/unit',
  'tests/core/integration',
  'tests/core/contracts',
  'tests/core/setup',
  // Domain test directories (custom code tests)
  'tests/domain/unit/interceptors',
  'tests/domain/unit/middleware',
  'tests/domain/unit/schemas',
  'tests/domain/unit/routes',
  'tests/domain/unit/queues',
  'tests/domain/integration/interceptors',
  'tests/domain/integration/errors',
  'tests/domain/integration/middleware',
  'tests/domain/integration/routes',
  'tests/domain/integration/queues',
  'tests/domain/contracts/schemas',
  'tests/domain/contracts/routes',
  'tests/domain/setup',
  // Core infrastructure (needed by domain layer)
  'src/core/interfaces',
  'src/core/exceptions',
];

/**
 * Protected template files to scaffold.
 * Each entry maps a template to its output path.
 * These files are never overwritten once created.
 */
const PROTECTED_TEMPLATES = [
  // Domain Layer
  {
    template: 'domain/routes/route-loader.template.js',
    output: 'src/domain/routes/route-loader.js',
  },
  {
    template: 'domain/schemas/base.schema.template.js',
    output: 'src/domain/schemas/base.schema.js',
  },
  {
    template: 'domain/schemas/README.template.md',
    output: 'src/domain/schemas/README.md',
  },
  // Interceptor registry
  {
    template: 'domain/interceptors/interceptor.registry.template.js',
    output: 'src/domain/interceptors/interceptor.registry.js',
  },
  // Core infrastructure
  {
    template: 'core/interfaces/interceptor.interface.template.js',
    output: 'src/core/interfaces/interceptor.interface.js',
  },
  {
    template: 'core/interfaces/query-builder.interface.template.js',
    output: 'src/core/interfaces/query-builder.interface.js',
  },
  {
    template: 'core/exceptions/domain.exception.template.js',
    output: 'src/core/exceptions/domain.exception.js',
  },
  {
    template: 'domain/constants/domain.constants.template.js',
    output: 'src/domain/constants/domain.constants.js',
  },
  // Domain Bull Queues
  {
    template: 'domain/bullQueues/queue-loader.template.js',
    output: 'src/domain/bullQueues/queue-loader.js',
  },
  {
    template: 'domain/bullQueues/README.template.md',
    output: 'src/domain/bullQueues/README.md',
  },
  // Domain Middlewares
  {
    template: 'domain/middlewares/middleware-loader.template.js',
    output: 'src/domain/middlewares/middleware-loader.js',
  },
  {
    template: 'domain/middlewares/README.template.md',
    output: 'src/domain/middlewares/README.md',
  },
  // Domain Routes
  {
    template: 'domain/routes/v1/example.routes.stub.template.js',
    output: 'src/domain/routes/v1/example.routes.js',
  },
  {
    template: 'domain/routes/README.template.md',
    output: 'src/domain/routes/README.md',
  },
  // Domain Test Documentation
  {
    template: 'tests/domain/README.template.md',
    output: 'tests/domain/README.md',
  },
  // Domain Setup Helpers
  {
    template: 'tests/domain/setup/helpers.template.js',
    output: 'tests/domain/setup/helpers.js',
  },
  // Interceptor lifecycle integration test (domain integration)
  {
    template: 'tests/domain/integration/interceptors/lifecycle.test.template.js',
    output: 'tests/domain/integration/interceptors/lifecycle.test.js',
  },
  // .gitkeep files for empty directories (ensures Git tracks them)
  {
    template: 'tests/domain/unit/middleware/.gitkeep',
    output: 'tests/domain/unit/middleware/.gitkeep',
  },
  // Domain Test Documentation
  {
    template: 'tests/domain/unit/schemas/.gitkeep',
    output: 'tests/domain/unit/schemas/.gitkeep',
  },
  {
    template: 'tests/domain/unit/routes/.gitkeep',
    output: 'tests/domain/unit/routes/.gitkeep',
  },
  {
    template: 'tests/domain/unit/queues/.gitkeep',
    output: 'tests/domain/unit/queues/.gitkeep',
  },
  {
    template: 'tests/domain/integration/errors/.gitkeep',
    output: 'tests/domain/integration/errors/.gitkeep',
  },
  {
    template: 'tests/domain/integration/middleware/.gitkeep',
    output: 'tests/domain/integration/middleware/.gitkeep',
  },
  {
    template: 'tests/domain/integration/routes/.gitkeep',
    output: 'tests/domain/integration/routes/.gitkeep',
  },
  {
    template: 'tests/domain/integration/queues/.gitkeep',
    output: 'tests/domain/integration/queues/.gitkeep',
  },
  {
    template: 'tests/domain/contracts/schemas/.gitkeep',
    output: 'tests/domain/contracts/schemas/.gitkeep',
  },
  {
    template: 'tests/domain/contracts/routes/.gitkeep',
    output: 'tests/domain/contracts/routes/.gitkeep',
  },
];

/**
 * Base path to template files.
 */
const TEMPLATE_BASE = path.resolve(__dirname, '../../computeConstructors/api');

/**
 * Copy a template file to destination with replacements.
 * Does NOT overwrite if destination exists.
 *
 * @param {string} templatePath - Path to template file
 * @param {string} destPath - Destination path
 * @param {Object} [options]
 * @param {Object} [options.replacements] - Key-value replacements to apply
 * @param {boolean} [options.transform] - Whether to transform imports to path aliases
 * @returns {boolean} true if file was created, false if skipped
 */
function copyTemplateIfNotExists(templatePath, destPath, options = {}) {
  if (fs.existsSync(destPath)) {
    return false;
  }

  // Ensure parent directory exists
  const parentDir = path.dirname(destPath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Read template
  let content = fs.readFileSync(templatePath, 'utf-8');

  // Transform imports if requested
  if (options.transform) {
    content = transformTemplateContent(content);
  }

  // Apply replacements
  const replacements = options.replacements || options;
  if (
    typeof replacements === 'object' &&
    !Array.isArray(replacements) &&
    !replacements.transform
  ) {
    for (const [search, replaceWith] of Object.entries(replacements)) {
      if (search === 'transform' || search === 'replacements') continue;
      // Escape special regex characters in search string
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      content = content.replace(regex, replaceWith);
    }
  }

  // Write to destination
  fs.writeFileSync(destPath, content, 'utf-8');
  return true;
}

/**
 * Transform template content for production use.
 * - Converts relative imports to path aliases (#domain, #core)
 * - Removes .template suffix from filenames
 *
 * @param {string} content - Template file content
 * @returns {string} Transformed content
 */
function transformTemplateContent(content) {
  // Pattern to match require statements with relative paths to domain or core directories
  // Matches: require('../domain/...'), require('../core/...'), etc.
  const requirePattern =
    /require\(['"]\.\.\/?(?:\.\.\/)*(?:(domain|core)\/[^'"]+\.template\.js)['"]\)/g;

  return content.replace(requirePattern, (match) => {
    // Extract the path after the relative prefix
    const pathMatch = match.match(/(?:domain|core)\/[^'"]+\.template\.js/);
    if (!pathMatch) return match;

    // Convert to alias path and remove .template suffix
    const aliasPath = `#${pathMatch[0].replace('.template.js', '.js')}`;
    return `require('${aliasPath}')`;
  });
}

/**
 * Scaffold the domain layer directory structure.
 * Creates directories and base files if they don't exist.
 *
 * @param {string} outputDir - Microservice root directory
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function scaffoldDomainLayer(outputDir) {
  const created = [];
  const skipped = [];

  // Create directory structure
  for (const dir of DOMAIN_DIRECTORIES) {
    const fullPath = path.join(outputDir, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      created.push(dir);
    } else {
      skipped.push(dir);
    }
  }

  // Copy all protected templates
  for (const { template, output } of PROTECTED_TEMPLATES) {
    const templatePath = path.join(TEMPLATE_BASE, template);
    const destPath = path.join(outputDir, output);

    if (copyTemplateIfNotExists(templatePath, destPath, { transform: true })) {
      created.push(output);
    } else {
      skipped.push(output);
    }
  }

  return { created, skipped };
}

/**
 * Scaffold an interceptor stub for a model.
 * Only creates if interceptor doesn't already exist.
 *
 * @param {string} outputDir - Microservice root directory
 * @param {string} modelName - Model name (PascalCase)
 * @returns {Promise<{created: boolean, path: string}>}
 */
async function scaffoldModelInterceptor(outputDir, modelName) {
  // Convert PascalCase to camelCase for filename
  const camelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

  const interceptorPath = path.join(
    outputDir,
    `src/domain/interceptors/${camelName}.interceptor.js`
  );

  if (fs.existsSync(interceptorPath)) {
    return { created: false, path: interceptorPath };
  }

  const templatePath = path.join(
    TEMPLATE_BASE,
    'domain/interceptors/model.interceptor.stub.template.js'
  );

  const replacements = {
    '@gen{MODEL_NAME|Pascal}': modelName,
    '@gen{MODEL_NAME|camel}': camelName,
  };

  copyTemplateIfNotExists(templatePath, interceptorPath, replacements);

  return { created: true, path: interceptorPath };
}

/**
 * Scaffold an interceptor test stub for a model.
 * Only creates if test doesn't already exist.
 *
 * @param {string} outputDir - Microservice root directory
 * @param {string} modelName - Model name (PascalCase)
 * @returns {Promise<{created: boolean, path: string}>}
 */
async function scaffoldModelInterceptorTest(outputDir, modelName) {
  // Convert PascalCase to camelCase for filename
  const camelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

  const testPath = path.join(
    outputDir,
    `tests/domain/unit/interceptors/${camelName}.interceptor.test.js`
  );

  if (fs.existsSync(testPath)) {
    return { created: false, path: testPath };
  }

  // Ensure directory exists
  const testDir = path.dirname(testPath);
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  const templatePath = path.join(
    TEMPLATE_BASE,
    'tests/domain/unit/interceptors/model.interceptor.test.stub.template.js'
  );

  const replacements = {
    '@gen{MODEL_NAME|Pascal}': modelName,
    '@gen{MODEL_NAME|camel}': camelName,
  };

  copyTemplateIfNotExists(templatePath, testPath, replacements);

  return { created: true, path: testPath };
}

/**
 * Scaffold a filter extensions stub for a model.
 * Only creates if filter extensions file doesn't already exist.
 *
 * @param {string} outputDir - Microservice root directory
 * @param {string} modelName - Model name (PascalCase)
 * @returns {Promise<{created: boolean, path: string}>}
 */
async function scaffoldModelFilters(outputDir, modelName) {
  // Convert PascalCase to camelCase for filename
  const camelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);

  const filtersPath = path.join(
    outputDir,
    `src/domain/extensions/${camelName}.filters.js`
  );

  if (fs.existsSync(filtersPath)) {
    return { created: false, path: filtersPath };
  }

  // Ensure directory exists
  const filtersDir = path.dirname(filtersPath);
  if (!fs.existsSync(filtersDir)) {
    fs.mkdirSync(filtersDir, { recursive: true });
  }

  const templatePath = path.join(
    TEMPLATE_BASE,
    'domain/extensions/modelName.filters.stub.template.js'
  );

  const replacements = {
    '@gen{MODEL_NAME|Pascal}': modelName,
    '@gen{MODEL_NAME|camel}': camelName,
  };

  copyTemplateIfNotExists(templatePath, filtersPath, replacements);

  return { created: true, path: filtersPath };
}

/**
 * Scaffold interceptors and test stubs for all models.
 *
 * @param {string} outputDir - Microservice root directory
 * @param {Array<{name: string}>} models - Array of model objects
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function scaffoldAllInterceptors(outputDir, models) {
  const created = [];
  const skipped = [];

  for (const model of models) {
    // Create interceptor
    const interceptorResult = await scaffoldModelInterceptor(outputDir, model.name);
    if (interceptorResult.created) {
      created.push(interceptorResult.path);
    } else {
      skipped.push(interceptorResult.path);
    }

    // Create test stub
    const testResult = await scaffoldModelInterceptorTest(outputDir, model.name);
    if (testResult.created) {
      created.push(testResult.path);
    } else {
      skipped.push(testResult.path);
    }

    // Create filter extensions stub
    const filtersResult = await scaffoldModelFilters(outputDir, model.name);
    if (filtersResult.created) {
      created.push(filtersResult.path);
    } else {
      skipped.push(filtersResult.path);
    }
  }

  return { created, skipped };
}

module.exports = {
  DOMAIN_DIRECTORIES,
  PROTECTED_TEMPLATES,
  transformTemplateContent,
  scaffoldDomainLayer,
  scaffoldModelInterceptor,
  scaffoldModelInterceptorTest,
  scaffoldModelFilters,
  scaffoldAllInterceptors,
};
