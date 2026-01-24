/**
 * CREATED BY: Claude Code
 * CREATOR EMAIL: noreply@anthropic.com
 * CREATION DATE: 2026-01-05
 *
 * DESCRIPTION:
 * ------------------
 * This module provides utilities for resolving model and field names to their IDs.
 * Used by batch creation routes to support name-based references in addition to IDs.
 * Follows DRY principle - shared between model-field batch and dashboard batch routes.
 */

const prisma = require('#configs/prisma.js');

/**
 * Resolves model names to their IDs within a microservice.
 *
 * @param {string} microserviceId - The microservice ID to scope the lookup
 * @param {string[]} modelNames - Array of model names to resolve
 * @returns {Promise<Map<string, string>>} Map of model name -> model ID
 */
async function resolveModelNamesToIds(microserviceId, modelNames) {
  if (!modelNames || modelNames.length === 0) {
    return new Map();
  }

  const uniqueNames = [...new Set(modelNames.filter(Boolean))];
  if (uniqueNames.length === 0) {
    return new Map();
  }

  const models = await prisma.modelDefn.findMany({
    where: {
      microserviceId,
      name: { in: uniqueNames },
    },
    select: { id: true, name: true },
  });

  const nameToIdMap = new Map();
  models.forEach((model) => {
    nameToIdMap.set(model.name, model.id);
  });

  return nameToIdMap;
}

/**
 * Resolves field names to their IDs within specified models.
 *
 * @param {Array<{modelId: string, fieldNames: string[]}>} modelFieldRequests - Array of model IDs with their field names to resolve
 * @returns {Promise<Map<string, Map<string, string>>>} Map of modelId -> (fieldName -> fieldId)
 */
async function resolveFieldNamesToIds(modelFieldRequests) {
  if (!modelFieldRequests || modelFieldRequests.length === 0) {
    return new Map();
  }

  // Collect all model IDs and field names
  const modelIds = [];
  const allFieldNames = new Set();

  modelFieldRequests.forEach(({ modelId, fieldNames }) => {
    if (modelId && fieldNames && fieldNames.length > 0) {
      modelIds.push(modelId);
      fieldNames.filter(Boolean).forEach((name) => allFieldNames.add(name));
    }
  });

  if (modelIds.length === 0 || allFieldNames.size === 0) {
    return new Map();
  }

  // Fetch all fields for the requested models
  const fields = await prisma.fieldDefn.findMany({
    where: {
      modelId: { in: modelIds },
      name: { in: [...allFieldNames] },
    },
    select: { id: true, name: true, modelId: true },
  });

  // Build nested map: modelId -> (fieldName -> fieldId)
  const result = new Map();
  fields.forEach((field) => {
    if (!result.has(field.modelId)) {
      result.set(field.modelId, new Map());
    }
    result.get(field.modelId).set(field.name, field.id);
  });

  return result;
}

/**
 * Resolves all name-based references in dashboard batch data.
 * Returns resolved IDs for models, fields, aggregate fields, and group by fields.
 *
 * @param {string} microserviceId - The microservice ID
 * @param {Object} batchData - The batch data containing widgets and filters
 * @returns {Promise<Object>} Resolved references object
 */
async function resolveDashboardBatchReferences(microserviceId, { widgets, filters }) {
  // Step 1: Collect all model names that need resolution
  const modelNamesToResolve = [];

  widgets.forEach((widget) => {
    if (widget.modelName) modelNamesToResolve.push(widget.modelName);
  });

  filters.forEach((filter) => {
    if (filter.modelName) modelNamesToResolve.push(filter.modelName);
  });

  // Step 2: Resolve model names to IDs
  const modelNameToIdMap = await resolveModelNamesToIds(microserviceId, modelNamesToResolve);

  // Step 3: Build model ID to name mapping and collect field names per model
  const modelFieldRequests = [];
  const modelIdToNameMap = new Map();

  // For each widget, determine the model ID (either provided or resolved)
  widgets.forEach((widget) => {
    const { modelId: providedModelId, modelName } = widget;
    const modelId = providedModelId || (modelName ? modelNameToIdMap.get(modelName) : null);
    if (modelId) {
      if (modelName) {
        modelIdToNameMap.set(modelName, modelId);
      }
      const fieldNames = [];
      if (widget.aggregateFieldName) fieldNames.push(widget.aggregateFieldName);
      if (widget.groupByFieldName) fieldNames.push(widget.groupByFieldName);
      if (widget.dateConfig?.dateFieldName) fieldNames.push(widget.dateConfig.dateFieldName);
      if (fieldNames.length > 0) {
        modelFieldRequests.push({ modelId, fieldNames });
      }
    }
  });

  // For each filter, determine the model ID and field names
  filters.forEach((filter) => {
    const { modelId: providedModelId, modelName, fieldName } = filter;
    const modelId = providedModelId || (modelName ? modelNameToIdMap.get(modelName) : null);
    if (modelId && fieldName) {
      modelFieldRequests.push({ modelId, fieldNames: [fieldName] });
    }
  });

  // Step 4: Resolve field names to IDs
  const modelFieldMap = await resolveFieldNamesToIds(modelFieldRequests);

  return {
    modelNameToIdMap,
    modelFieldMap,
  };
}

/**
 * Gets missing model names that couldn't be resolved.
 *
 * @param {string[]} requestedNames - Array of requested model names
 * @param {Map<string, string>} resolvedMap - Map of resolved names to IDs
 * @returns {string[]} Array of missing model names
 */
function getMissingModelNames(requestedNames, resolvedMap) {
  return requestedNames.filter((name) => name && !resolvedMap.has(name));
}

/**
 * Gets missing field names that couldn't be resolved for a model.
 *
 * @param {string} modelId - The model ID
 * @param {string[]} requestedFieldNames - Array of requested field names
 * @param {Map<string, Map<string, string>>} modelFieldMap - The resolved field map
 * @returns {string[]} Array of missing field names
 */
function getMissingFieldNames(modelId, requestedFieldNames, modelFieldMap) {
  const fieldMap = modelFieldMap.get(modelId);
  if (!fieldMap) {
    return requestedFieldNames.filter(Boolean);
  }
  return requestedFieldNames.filter((name) => name && !fieldMap.has(name));
}

module.exports = {
  resolveModelNamesToIds,
  resolveFieldNamesToIds,
  resolveDashboardBatchReferences,
  getMissingModelNames,
  getMissingFieldNames,
};
