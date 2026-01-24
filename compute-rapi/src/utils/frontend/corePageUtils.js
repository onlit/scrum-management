const path = require('path');
const fs = require('fs').promises;
const {
  toStartCaseNoSpaces,
  toCamelCase,
  toStartCaseUpperUnderscore,
  convertToSlug,
  resolveModelSlug,
} = require('#utils/shared/stringUtils.js');
const {
  ensureDirExists,
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  getModelName,
  getModelFields,
  isValidModel,
  escapeStringForJSX,
  consolidateImports,
  getReminderEntityModelKey,
} = require('#utils/frontend/commonUtils.js');
const { DISPLAY_VALUE_PROP } = require('#utils/api/commonUtils.js');

/**
 * Generates related tabs for the Core detail component
 * These tabs have access to recordData since they're inside the Core
 */
function generateRelatedTabsForCore({ children } = {}) {
  const importStatements = [];
  const relatedTabs = [];

  for (const { relationFieldName, model: childModel } of children) {
    const modelName = getModelName({ model: childModel });
    const camelCasedName = toCamelCase(modelName);
    const startCasedName = toStartCaseNoSpaces(modelName);
    const microserviceSlug = convertToSlug(childModel?.microservice?.name);
    const formValuesInterfaceName = `${startCasedName}CreateFormValues`;

    // Construct import statements using @ps/entity-core barrel export
    importStatements.push(
      `import { ${startCasedName}Create, type ${formValuesInterfaceName}, ${camelCasedName}Columns, ${camelCasedName}DataMapper } from '@ps/entity-core/${microserviceSlug}';`
    );

    // Sanitize and Escape Label
    const sanitizedTabLabel = childModel?.label
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'");

    // Construct tab components - these have access to recordData
    relatedTabs.push(`
      {
        key: '${camelCasedName}',
        label: \`${sanitizedTabLabel ?? modelName}\`,
        content: (
          <DataTableV2<${formValuesInterfaceName}>
            alternateStyling
            title=''
            helpfulHint=''
            key="${camelCasedName}ListPage"
            queryKey={['${camelCasedName}ListPage']}
            recordUrl={getRoute('${microserviceSlug}/get${startCasedName}URL')}
            CreateFormComponent={${startCasedName}Create}
            createFormComponentProps={{
               overrideInitialValues: {
                 ${relationFieldName}Id: {
                   id: recordId,
                   label: recordData?.__displayValue ?? '',
                 },
               },
               disabledFields: ['${relationFieldName}Id'],
             }}
            columns={${camelCasedName}Columns}
            renderRow={${camelCasedName}DataMapper}
            additionalQueryParams={{ ${relationFieldName}Id: recordId ?? '' }}
            importExportUrls={{
              import: getRoute('${microserviceSlug}/getImportURL')({ query: '${camelCasedName}' }),
              export: getRoute('${microserviceSlug}/getExportURL')({ query: '${camelCasedName}' }),
            }}
            importModel={\`${camelCasedName}\`}
          />
        )
      },
    `);
  }

  return { importStatements, relatedTabs };
}

/**
 * Creates the core list component for a model
 */
async function createCoreListComponent({
  model,
  frontend,
  microserviceSlug,
  user,
} = {}) {
  const modelName = getModelName({ model });
  const modelFields = getModelFields({ model });

  if (!isValidModel({ modelName, modelFields })) return;

  const startCased = toStartCaseNoSpaces(modelName);
  const modelSlug = resolveModelSlug(model);
  const camelCased = toCamelCase(modelName);

  const corePageDir = path.join(
    frontend?.path,
    'src',
    'core',
    'pages',
    modelSlug
  );

  await ensureDirExists(corePageDir);

  const destinationPath = [corePageDir, `${startCased}ListCore.tsx`];

  await createFileFromTemplate({
    destinationPathSegments: destinationPath,
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'core',
      'pages',
      'list-core.template.tsx',
    ],
    templateReplacements: {
      '@gen{MODEL_NAME|camel}': camelCased,
      '@gen{MODEL_NAME|Pascal}': startCased,
      '@gen{MODEL_NAME|kebab}': modelSlug,
      '@gen{MODEL_HINT}': escapeStringForJSX(model?.helpfulHint ?? ''),
      '@gen{MODEL_LABEL}': model?.label ?? startCased,
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
    },
    user,
  });

  await formatFile(path.join(...destinationPath));
}

/**
 * Creates the core detail component for a model
 */
async function createCoreDetailComponent({
  model,
  frontend,
  microserviceSlug,
  microserviceName,
  children = [],
  user,
} = {}) {
  const modelName = getModelName({ model });
  const modelFields = getModelFields({ model });

  if (!isValidModel({ modelName, modelFields })) return;

  const startCased = toStartCaseNoSpaces(modelName);
  const modelSlug = resolveModelSlug(model);
  const camelCased = toCamelCase(modelName);

  const corePageDir = path.join(
    frontend?.path,
    'src',
    'core',
    'pages',
    modelSlug
  );

  await ensureDirExists(corePageDir);

  // Generate related tabs for child models
  const { importStatements, relatedTabs } = generateRelatedTabsForCore({
    children,
  });

  const consolidatedImports = consolidateImports(importStatements).join('\n');

  const destinationPath = [corePageDir, `${startCased}DetailCore.tsx`];
  const labelPath = `recordData?.${DISPLAY_VALUE_PROP} ?? ''`;

  // Only include recordData in deps if related tabs exist (they use recordData.__displayValue)
  const baseTabsDeps =
    relatedTabs.length > 0
      ? 'inaSearchTerm, recordId, recordData'
      : 'inaSearchTerm, recordId';

  await createFileFromTemplate({
    destinationPathSegments: destinationPath,
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'core',
      'pages',
      'detail-core.template.tsx',
    ],
    templateReplacements: {
      '@gen{MODEL_NAME|camel}': camelCased,
      '@gen{MODEL_NAME|Pascal}': startCased,
      '@gen{MODEL_NAME|kebab}': modelSlug,
      '@gen{MODEL_LABEL}': model?.label ?? startCased,
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MICROSERVICE_NAME|UPPER_SNAKE}':
        toStartCaseUpperUnderscore(microserviceName),
      '@gen{MODEL_NAME|UPPER_SNAKE}': getReminderEntityModelKey(
        microserviceName,
        modelName
      ),
      '@gen{DISPLAY_VALUE_PATH}': labelPath,
      '@gen{BASETABS_DEPS}': baseTabsDeps,
      '// @gen:IMPORTS': consolidatedImports,
      '// @gen:RELATED_TABS': relatedTabs.join('\n'),
    },
    user,
  });

  await formatFile(path.join(...destinationPath));
}

/**
 * Creates the index.ts barrel export for core pages
 * Only exports components that exist
 */
async function createCorePageIndex({
  model,
  frontend,
} = {}) {
  const modelName = getModelName({ model });
  const startCased = toStartCaseNoSpaces(modelName);
  const modelSlug = resolveModelSlug(model);

  const corePageDir = path.join(
    frontend?.path,
    'src',
    'core',
    'pages',
    modelSlug
  );

  // Check which files exist
  const listCorePath = path.join(corePageDir, `${startCased}ListCore.tsx`);
  const detailCorePath = path.join(corePageDir, `${startCased}DetailCore.tsx`);

  let listCoreExists = false;
  let detailCoreExists = false;

  try {
    await fs.access(listCorePath);
    listCoreExists = true;
  } catch {
    // File doesn't exist
  }

  try {
    await fs.access(detailCorePath);
    detailCoreExists = true;
  } catch {
    // File doesn't exist
  }

  // Build exports based on what exists
  const exports = [];

  if (listCoreExists) {
    exports.push(`export { ${startCased}ListCore } from './${startCased}ListCore';`);
    exports.push(`export type { ${startCased}ListCoreProps, BulkAction } from './${startCased}ListCore';`);
  }

  if (detailCoreExists) {
    exports.push(`export { ${startCased}DetailCore } from './${startCased}DetailCore';`);
    exports.push(`export type { ${startCased}DetailCoreProps, TabConfig, HeaderAction } from './${startCased}DetailCore';`);
  }

  if (exports.length === 0) {
    // No components to export, skip creating index
    return;
  }

  const indexContent = `// Core page components - regenerated on each generation run
// DO NOT add domain-specific customizations here

${exports.join('\n')}
`;

  await fs.writeFile(path.join(corePageDir, 'index.ts'), indexContent, 'utf8');
  await formatFile(path.join(corePageDir, 'index.ts'));
}

/**
 * Creates the domain/index.ts placeholder for the app
 * This is a protected file - only created if it doesn't exist
 * @param {Object} params - Parameters
 * @param {string} params.appPath - Path to the main app folder
 * @param {Object} params.frontend - Frontend config with constructorPath
 * @param {Object} params.user - User context
 */
async function createAppDomainIndex({ appPath, frontend, user } = {}) {
  const domainDir = path.join(appPath, 'src', 'domain');
  const domainIndexPath = path.join(domainDir, 'index.ts');

  // Only create if it doesn't exist (protected file)
  try {
    await fs.access(domainIndexPath);
    console.log(
      `[App] Domain index already exists, skipping: ${domainIndexPath}`
    );
    return;
  } catch {
    // File doesn't exist, create it
  }

  await ensureDirExists(domainDir);

  await createFileFromTemplate({
    destinationPathSegments: [domainIndexPath],
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'domain',
      'index.template.ts',
    ],
    user,
  });

  await formatFile(domainIndexPath);
}

module.exports = {
  createCoreListComponent,
  createCoreDetailComponent,
  createCorePageIndex,
  createAppDomainIndex,
};
