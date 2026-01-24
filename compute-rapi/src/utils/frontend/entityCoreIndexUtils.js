const path = require('path');
const fs = require('fs').promises;
const {
  toStartCaseNoSpaces,
  toCamelCase,
} = require('#utils/shared/stringUtils.js');
const {
  ensureDirExists,
  formatFile,
  createFileFromTemplate,
} = require('#utils/shared/fileUtils.js');

/**
 * Creates the core/index.ts barrel export for entity-core microservice
 */
async function createEntityCoreCoreIndex({
  entityCore,
  models,
  frontend,
  user,
} = {}) {
  const formExports = [];
  const columnExports = [];
  const dataMapperExports = [];
  const validationSchemaExports = [];

  for (const model of models) {
    if (model?.deleted) continue;

    const startCased = toStartCaseNoSpaces(model?.name);
    const camelCased = toCamelCase(model?.name);

    // Form exports
    formExports.push(
      `export { default as ${startCased}Create } from './forms/${startCased}Create/${startCased}Create';`
    );
    formExports.push(
      `export type { ${startCased}CreateFormValues } from './forms/${startCased}Create/${startCased}Create';`
    );
    formExports.push(
      `export { defaultFormValues as ${camelCased}DefaultFormValues } from './forms/${startCased}Create/${startCased}Create';`
    );
    formExports.push(
      `export { default as ${startCased}Detail } from './forms/${startCased}Detail/${startCased}Detail';`
    );

    // Column exports
    columnExports.push(
      `export { default as ${camelCased}Columns } from './configs/tableColumns/${camelCased}Columns';`
    );

    // Data mapper exports
    dataMapperExports.push(
      `export { default as ${camelCased}DataMapper } from './configs/dataMappers/${camelCased}DataMapper';`
    );

    // Validation schema exports
    validationSchemaExports.push(
      `export { default as ${camelCased}Schema } from './configs/validationSchemas/${camelCased}Schema';`
    );
  }

  const coreDir = path.join(entityCore.microservicePath, 'core');
  const coreIndexPath = path.join(coreDir, 'index.ts');
  await ensureDirExists(coreDir);

  const content = `// Core exports - these are regenerated on each generation run
// DO NOT add domain-specific customizations here

// Forms
${formExports.join('\n')}

// Table Columns
${columnExports.join('\n')}

// Data Mappers
${dataMapperExports.join('\n')}

// Validation Schemas
${validationSchemaExports.join('\n')}
`;

  await fs.writeFile(coreIndexPath, content, 'utf8');
  await formatFile(coreIndexPath);
}

/**
 * Creates the domain/index.ts placeholder for entity-core microservice
 */
async function createEntityCoreDomainIndex({
  entityCore,
  frontend,
  user,
} = {}) {
  const domainDir = path.join(entityCore.microservicePath, 'domain');
  const domainIndexPath = path.join(domainDir, 'index.ts');

  // Only create if it doesn't exist (protected file)
  try {
    await fs.access(domainIndexPath);
    console.log(`[EntityCore] Domain index already exists, skipping: ${domainIndexPath}`);
    return;
  } catch {
    // File doesn't exist, create it
  }

  await ensureDirExists(domainDir);

  await createFileFromTemplate({
    destinationPathSegments: [domainIndexPath],
    templatePathSegments: [
      frontend?.constructorPath,
      'entity-core',
      'domain',
      'index.template.ts',
    ],
    user,
  });

  await formatFile(domainIndexPath);
}

/**
 * Creates barrel export registries for forms, tableColumns, dataMappers, validationSchemas
 * These are the index.ts files that export registry objects used by the main index.ts
 */
async function createCoreBarrelExports({ entityCore, models } = {}) {
  const formsEntries = [];
  const columnsImports = [];
  const columnsEntries = [];
  const dataMappersImports = [];
  const dataMappersEntries = [];
  const validationSchemasImports = [];
  const validationSchemasEntries = [];

  for (const model of models) {
    if (model?.deleted) continue;

    const startCased = toStartCaseNoSpaces(model?.name);
    const camelCased = toCamelCase(model?.name);

    // Forms registry entries (lazy loading)
    formsEntries.push(`  '${startCased}Create': () => import('./${startCased}Create/${startCased}Create'),`);
    formsEntries.push(`  '${startCased}Detail': () => import('./${startCased}Detail/${startCased}Detail'),`);

    // Table columns registry
    columnsImports.push(`import ${camelCased}Columns from './${camelCased}Columns';`);
    columnsEntries.push(`  '${camelCased}': ${camelCased}Columns,`);

    // Data mappers registry
    dataMappersImports.push(`import ${camelCased}DataMapper from './${camelCased}DataMapper';`);
    dataMappersEntries.push(`  '${camelCased}': ${camelCased}DataMapper,`);

    // Validation schemas registry
    validationSchemasImports.push(`import ${camelCased}Schema from './${camelCased}Schema';`);
    validationSchemasEntries.push(`  '${camelCased}': ${camelCased}Schema,`);
  }

  const coreDir = path.join(entityCore.microservicePath, 'core');

  // Create forms/index.ts
  const formsIndexPath = path.join(coreDir, 'forms', 'index.ts');
  const formsContent = `// Forms registry - auto-generated
export const forms: Record<string, () => Promise<any>> = {
${formsEntries.join('\n')}
};

export async function loadForm(formName: string) {
  const loader = forms[formName];
  if (!loader) {
    throw new Error(\`Form "\${formName}" not found in registry\`);
  }
  const module = await loader();
  return module.default;
}
`;
  await fs.writeFile(formsIndexPath, formsContent, 'utf8');
  await formatFile(formsIndexPath);

  // Create configs/tableColumns/index.ts
  const columnsIndexPath = path.join(coreDir, 'configs', 'tableColumns', 'index.ts');
  const columnsContent = `// Table columns registry - auto-generated
${columnsImports.join('\n')}

export const tableColumns: Record<string, any> = {
${columnsEntries.join('\n')}
};
`;
  await fs.writeFile(columnsIndexPath, columnsContent, 'utf8');
  await formatFile(columnsIndexPath);

  // Create configs/dataMappers/index.ts
  const dataMappersIndexPath = path.join(coreDir, 'configs', 'dataMappers', 'index.ts');
  const dataMappersContent = `// Data mappers registry - auto-generated
${dataMappersImports.join('\n')}

export const dataMappers: Record<string, any> = {
${dataMappersEntries.join('\n')}
};
`;
  await fs.writeFile(dataMappersIndexPath, dataMappersContent, 'utf8');
  await formatFile(dataMappersIndexPath);

  // Create configs/validationSchemas/index.ts
  const validationSchemasIndexPath = path.join(coreDir, 'configs', 'validationSchemas', 'index.ts');
  const validationSchemasContent = `// Validation schemas registry - auto-generated
${validationSchemasImports.join('\n')}

export const validationSchemas: Record<string, any> = {
${validationSchemasEntries.join('\n')}
};
`;
  await fs.writeFile(validationSchemasIndexPath, validationSchemasContent, 'utf8');
  await formatFile(validationSchemasIndexPath);
}

module.exports = {
  createEntityCoreCoreIndex,
  createEntityCoreDomainIndex,
  createCoreBarrelExports,
};
