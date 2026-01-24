const {
  toCamelCase,
  convertModelNameToSlug,
  resolveModelSlug,
} = require('#utils/shared/stringUtils.js');
const { filterDeleted } = require('#utils/shared/generalUtils.js');
const { DISPLAY_VALUE_PROP } = require('#configs/constants.js');

function determineDateFormatFunction(type) {
  const isDateOrDateTime = type === 'Date' || type === 'DateTime';
  const formatFn = type === 'DateTime' ? 'formatDateTime' : 'formatDate';
  return { isDateOrDateTime, formatFn };
}

/**
 * Resolves the display value field configuration for a foreign key model.
 * Handles nested internal foreign keys and external relationships using model lookup.
 *
 * @returns {{
 *   displayValueField: string,
 *   type: string
 * }} Display field path and data type
 */
function getDisplayValueField() {
  return { displayValueField: DISPLAY_VALUE_PROP, type: 'String' };
}

function getFormattedFieldName(name, isForeignKey) {
  const suffix = isForeignKey ? 'Id' : '';
  return `${toCamelCase(name)}${suffix}`;
}

function findChildrenForModel(models, modelId) {
  const children = []; // Array to store the children of the given model

  // Step 1: Loop through all model definitions using for...of
  for (const model of models) {
    if (modelId === model?.id) {
      continue;
    }

    const modelFields = filterDeleted(model.fieldDefns);

    // Loop through each field in the model to check if it references the given modelId
    for (const field of modelFields) {
      if (field?.isForeignKey && field?.foreignKeyModelId === modelId) {
        // Add the current model as a child if it has a foreign key pointing to the given modelId
        children.push({ model, relationFieldName: field?.name });
        break; // Break to avoid unnecessary iteration if a match is found
      }
    }
  }

  return children;
}

function hasClickableLinkInModel(modelFields) {
  const activeModelFields = filterDeleted(modelFields); // Filters out deleted fields
  const containsClickableLink = activeModelFields.some(
    ({ isClickableLink }) => !!isClickableLink // Checks if any field has a clickable link
  );
  return containsClickableLink;
}

module.exports = {
  determineDateFormatFunction,
  getDisplayValueField,
  getFormattedFieldName,
  findChildrenForModel,
  convertModelNameToSlug,
  resolveModelSlug,
  hasClickableLinkInModel,
  DISPLAY_VALUE_PROP,
};
