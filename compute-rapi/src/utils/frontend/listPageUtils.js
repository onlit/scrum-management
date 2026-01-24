const path = require('path');
const {
  toStartCaseNoSpaces,
  toCamelCase,
  toStartCaseUpperUnderscore,
} = require('#utils/shared/stringUtils.js');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');
const {
  ensureDirExists,
  createFileFromTemplate,
} = require('#utils/shared/fileUtils.js');
const {
  getModelName,
  getModelFields,
  isValidModel,
  generateModelPagesDirPath,
  escapeStringForJSX,
  getReminderEntityModelKey,
} = require('#utils/frontend/commonUtils.js');
const {
  createCoreListComponent,
  createCorePageIndex,
} = require('./corePageUtils.js');

async function createListPageFile({
  frontend,
  pagePath,
  modelName,
  model,
  microserviceSlug,
  user,
  microserviceName,
}) {
  const camelCased = toCamelCase(modelName);
  const startCased = toStartCaseNoSpaces(modelName);

  await createFileFromTemplate({
    destinationPathSegments: [...pagePath, 'index.tsx'],
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'pages',
      'list-page.template.tsx',
    ],
    templateReplacements: {
      '@gen{MODEL_NAME|camel}': camelCased,
      '@gen{MODEL_NAME|Pascal}': startCased,
      '@gen{MODEL_NAME|kebab}': resolveModelSlug(model),
      '@gen{MICROSERVICE_NAME}': toStartCaseUpperUnderscore(microserviceName),
      '@gen{MODEL_NAME}': getReminderEntityModelKey(
        microserviceName,
        modelName
      ),
      '@gen{MODEL_HINT}': escapeStringForJSX(model?.helpfulHint ?? ''),
      '@gen{MODEL_LABEL}': model?.label ?? startCased,
      '@gen{APP_NAME}': microserviceSlug,
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
    },
    user,
  });
}

async function createListPage({
  model,
  frontend,
  microserviceSlug,
  user,
  microserviceName,
} = {}) {
  // Get model name and fields
  const modelName = getModelName({ model });

  const modelFields = getModelFields({ model });

  // Validate the model name and fields
  if (!isValidModel({ modelName, modelFields })) return;

  // Create core list component first
  await createCoreListComponent({
    model,
    frontend,
    microserviceSlug,
    user,
  });

  // Create/update core page index (only exports what exists)
  await createCorePageIndex({
    model,
    frontend,
  });

  // Generate paths for the model's page directory
  const pagePath = generateModelPagesDirPath({ model, frontend });

  await ensureDirExists(path.join(...pagePath));

  await createListPageFile({
    frontend,
    pagePath,
    modelName,
    model,
    microserviceSlug,
    user,
    microserviceName,
  });
}

module.exports = { createListPage };
