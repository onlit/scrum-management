const path = require('path');
const {
  getModelName,
  getModelFields,
  isValidModel,
  generateModelPagesDirPath,
} = require('./commonUtils.js');
const {
  ensureDirExists,
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const { toStartCaseNoSpaces } = require('#utils/shared/stringUtils.js');
const {
  findChildrenForModel,
  resolveModelSlug,
  hasClickableLinkInModel,
} = require('#utils/api/commonUtils.js');
const {
  createCoreDetailComponent,
  createCorePageIndex,
} = require('./corePageUtils.js');

async function createDetailPage({
  model,
  frontend,
  user,
  children,
  microserviceSlug,
  microserviceName,
} = {}) {
  // Get model name and fields
  const modelName = getModelName({ model });

  const modelFields = getModelFields({ model });

  // Validate the model name and fields
  if (!isValidModel({ modelName, modelFields })) return;

  // Create core detail component (now includes related tabs)
  await createCoreDetailComponent({
    model,
    frontend,
    microserviceSlug,
    microserviceName,
    children,
    user,
  });

  // Create core page index
  await createCorePageIndex({
    model,
    frontend,
  });

  // Get path for the model's page directory
  const pagePath = generateModelPagesDirPath({ model, frontend });

  await ensureDirExists(path.join(...pagePath));

  const startCased = toStartCaseNoSpaces(modelName);
  const modelSlug = resolveModelSlug(model);

  const destinationPathSegments = [...pagePath, '[id].tsx'];

  // Create simplified wrapper page (tabs are now in Core)
  await createFileFromTemplate({
    destinationPathSegments,
    templatePathSegments: [
      frontend?.constructorPath,
      'app',
      'pages',
      'detail-page.template.tsx',
    ],
    templateReplacements: {
      '@gen{MODEL_NAME|kebab}': modelSlug,
      '@gen{MODEL_NAME|Pascal}': startCased,
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
    },
    user,
  });

  await formatFile(path.join(...destinationPathSegments));
}

function getDetailPageInfo({ models, model, microserviceSlug } = {}) {
  if (!model || !microserviceSlug) {
    return {
      shouldCreateDetailPage: false,
      detailPageLink: null,
      children: [],
    };
  }

  const hasClickableLink = hasClickableLinkInModel(model.fieldDefns);
  const children = findChildrenForModel(models, model.id);

  if (!hasClickableLink) {
    return { shouldCreateDetailPage: false, detailPageLink: null, children };
  }

  const detailPageLink = `\${getRootDomainClient()}/${microserviceSlug}/${resolveModelSlug(model)}`;

  return { shouldCreateDetailPage: true, detailPageLink, children };
}

module.exports = { getDetailPageInfo, createDetailPage };
