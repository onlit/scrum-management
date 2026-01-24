/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing models in a database using Prisma.
 * It includes functions for retrieving all models, creating a new model, creating multiple models
 * in batch, retrieving a single model, updating an existing model, and deleting a model.
 *
 * The `getAllModels` function retrieves a paginated list of models based on query parameters such
 * as search fields and filter fields, with support for user-specific visibility filters. It includes
 * additional metadata such as children models, parent model, and associated microservice.
 *
 * The `createModel` function validates the request body using a Joi schema and creates a new model
 * in the database with additional metadata.
 *
 * The `createModelsBatch` function validates the request body for multiple models using a Joi schema
 * and creates the models in batch in the database with additional metadata.
 *
 * The `getModel` function retrieves a single model based on the provided model ID, with visibility
 * filters applied to ensure the model is accessible to the requesting user. It includes additional
 * metadata such as children models, parent model, and associated microservice.
 *
 * The `updateModel` function updates an existing model in the database based on the provided model ID
 * and request body.
 *
 * The `deleteModel` function deletes a model from the database based on the provided model ID, with
 * visibility filters applied to ensure the model is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 */
const axios = require('axios');
const prisma = require('#configs/prisma.js');
const {
  modelCreate,
  modelBatchCreate,
  modelBatchCreateWithMeta,
  modelUpdate,
} = require('#schemas/model.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
  parseAndAssignVisibilityAttributes,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const { getSystemMenusURL } = require('#configs/routes.js');
const { convertToSlug } = require('#utils/shared/stringUtils.js');
const { resolveModelSlug } = require('#utils/api/commonUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  getClientLanguages,
  syncModelTranslations,
} = require('#utils/api/translationSyncUtils.js');

async function getAllModels(req, res) {
  const { user, query } = req;

  logOperationStart('getAllModels', req, { user: user?.id, query });
  const searchFields = [
    'name',
    'label',
    'description',
    'helpfulHint',
    'tags',
    'labelTranslationCode',
    'helpfulHintTranslationCode',
  ];
  const filterFields = [
    ...searchFields,
    'order',
    'useFormFlow',
    'displayValueId',
    'microserviceId',
    'systemMenuId',
    'dashboardStageFieldId',
    'addToDashboard',
    'lookup',
  ];

  let response;
  try {
    logDatabaseStart('get_paginated_models', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: modelUpdate,
      filterFields,
      searchFields,
      model: 'modelDefn',
      include: {
        microservice: true,
        displayValue: true,
        dashboardStageField: true,
      },
    });
    logDatabaseSuccess('get_paginated_models', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllModels', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch models',
      req,
      {
        context: 'get_all_models',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  res.status(200).json(response);
}

async function createModel(req, res) {
  const { user, body } = req;

  logOperationStart('createModel', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });
  let values;
  try {
    values = await modelCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createModel', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_model',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createModel', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_model',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let found;
  try {
    found = await prisma.modelDefn.findFirst({
      where: {
        name: values?.name,
        microserviceId: values?.microserviceId,
      },
    });
    logDatabaseSuccess('find_model_defn', req, { found: !!found });
  } catch (error) {
    logOperationError('createModel', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_model',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (found) {
    const error = createErrorWithTrace(
      ERROR_TYPES.CONFLICT,
      'Name must be unique.',
      req,
      {
        context: 'create_model',
        severity: ERROR_SEVERITY.LOW,
        details: { name: values?.name, microserviceId: values?.microserviceId },
      }
    );
    logOperationError('createModel', req, error);
    throw error;
  }

  let model;
  try {
    logDatabaseStart('create_model_defn', req, {
      name: values?.name,
      microserviceId: values?.microserviceId,
    });
    model = await prisma.modelDefn.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
      include: { microservice: true },
    });
    logDatabaseSuccess('create_model_defn', req, { id: model.id });
  } catch (error) {
    logOperationError('createModel', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_model',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (values?.systemMenuId) {
    try {
      await axios.post(
        getSystemMenusURL(),
        {
          is_group: false,
          label: model?.label,
          href: `/${convertToSlug(model?.microservice?.name)}/${resolveModelSlug(model)}`,
          compute_microservice: model?.microserviceId,
          compute_model: model?.id,
          anonymous_can_see_it: true,
          everyone_can_see_it: true,
          is_published: true,
          parent: values?.systemMenuId,
          delete_existing: true,
        },
        { headers: { Authorization: user?.accessToken } }
      );
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MENU_ERROR] Failed to create menu:', error?.message);
      }
    }
  }

  // Sync translations for label and helpfulHint
  let translationSyncWarning = null;
  try {
    const languages = await getClientLanguages(prisma, user?.client?.id);
    if (languages.length > 0) {
      await prisma.$transaction(async (tx) => {
        await syncModelTranslations({
          tx,
          model,
          languages,
          clientId: user?.client?.id,
          userId: user?.id,
          generateMissingCodes: true, // Generate codes if missing
          dryRun: false,
        });
      });

      // Re-fetch model to get the newly generated translation codes
      const modelWithCodes = await prisma.modelDefn.findFirst({
        where: { id: model.id },
        include: { microservice: true },
      });
      if (modelWithCodes) {
        model.labelTranslationCode = modelWithCodes.labelTranslationCode;
        model.helpfulHintTranslationCode = modelWithCodes.helpfulHintTranslationCode;
      }
    } else {
      translationSyncWarning = 'No languages configured for client - translation sync skipped';
      logEvent(`[TranslationSync] ${translationSyncWarning} for model ${model.id}`);
    }
  } catch (syncError) {
    // Log but don't fail - sync can be run manually later
    translationSyncWarning = `Translation sync failed: ${syncError.message}`;
    logOperationError('createModel:translationSync', req, syncError);
  }

  logOperationSuccess('createModel', req, { id: model.id });

  const response = { ...model };
  if (translationSyncWarning) {
    response._translationSyncWarning = translationSyncWarning;
  }

  res.status(201).json(response);
}

async function createModelsBatch(req, res) {
  const { user, body } = req;

  let createdBy;
  let client;
  let microserviceId;
  let models;
  let batchCreateWithMeta;

  // Case 1: wrapped format (new internal calls)
  if (body.models && Array.isArray(body.models)) {
    const validated = await modelBatchCreateWithMeta.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    createdBy = validated.createdBy;
    client = validated.client;
    microserviceId = validated.microserviceId;
    models = validated.models;
    batchCreateWithMeta = true;
  } else if (Array.isArray(body)) {
    models = await modelBatchCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } else {
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Invalid payload format. Expected an array or an object with a "models" key.',
      {
        context: 'createModelsBatch',
      }
    );
  }

  const isInternal = !user.isAuthenticated && user.internalRequest;

  if (isInternal) {
    if (!createdBy || !client) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'For internal requests, both client and createdBy fields are required.',
        {
          context: 'createModelsBatch',
        }
      );
    }

    user.client = { id: client };
    user.id = createdBy;
  }

  const queries = models.map((model) => {
    if (batchCreateWithMeta) {
      return prisma.modelDefn.create({
        data: {
          id: model?.id,
          name: model?.name,
          label: model?.label,
          description: model?.description,
          helpfulHint: model?.helpfulHint,
          lookup: model?.lookup,
          useFormFlow: model?.useFormFlow,
          showAutomataSelector: model?.showAutomataSelector,
          microserviceId,
          ...parseAndAssignVisibilityAttributes({ body: model, user }),
        },
      });
    }

    return prisma.modelDefn.create({
      data: {
        id: model?.id,
        name: model?.name,
        label: model?.label,
        description: model?.description,
        helpfulHint: model?.helpfulHint,
        labelTranslationCode: model?.labelTranslationCode,
        helpfulHintTranslationCode: model?.helpfulHintTranslationCode,
        useFormFlow: model?.useFormFlow,
        displayValueId: model?.displayValueId,
        addToDashboard: model?.addToDashboard,
        lookup: model?.lookup,
        showAutomataSelector: model?.showAutomataSelector,
        dashboardStageFieldId: model?.dashboardStageFieldId,
        tags: model?.tags,
        microserviceId: model?.microserviceId,
        ...parseAndAssignVisibilityAttributes({ body: model, user }),
        fieldDefns: {
          create: model?.fields?.map((field) => ({
            ...parseAndAssignVisibilityAttributes({ body: field, user }),
            id: field?.id,
            name: field?.name,
            label: field?.label,
            helpfulHint: field?.helpfulHint,
            labelTranslationCode: field?.labelTranslationCode,
            helpfulHintTranslationCode: field?.helpfulHintTranslationCode,
            dataType: field?.dataType,
            isForeignKey: field?.isForeignKey,
            foreignKeyType: field?.foreignKeyType,
            foreignKeyTarget: field?.foreignKeyTarget,
            foreignKeyModelId: field?.foreignKeyModelId,
            isOptional: field?.isOptional,
            isUnique: field?.isUnique,
            isIndex: field?.isIndex,
            onDelete: field?.onDelete,
            order: field?.order,
            minLength: field?.minLength,
            maxLength: field?.maxLength,
            tags: field?.tags,
            description: field?.description,
            showInTable: field?.showInTable,
            showInDetailCard: field?.showInDetailCard,
            externalIsOptional: field?.externalIsOptional,
            isEditable: field?.isEditable,
            isClickableLink: field?.isClickableLink,
            isMultiline: field?.isMultiline,
            externalMicroserviceId: field?.externalMicroserviceId,
            externalModelId: field?.externalModelId,
            enumDefnId: field?.enumDefnId,
            // Vector field configuration (only applicable when dataType = Vector)
            vectorDimension: field?.vectorDimension,
            vectorDistanceMetric: field?.vectorDistanceMetric,
            vectorIndexType: field?.vectorIndexType,
            // Nested VectorIndexConfig creation (only for Vector fields with config)
            ...(field?.dataType === 'Vector' &&
            field?.vectorIndexConfigs?.length > 0
              ? {
                  vectorIndexConfigs: {
                    create: field.vectorIndexConfigs.map((config) => ({
                      hnswM: config?.hnswM,
                      hnswEfConstruct: config?.hnswEfConstruct,
                      ivfLists: config?.ivfLists,
                      ...parseAndAssignVisibilityAttributes({ body: field, user }),
                    })),
                  },
                }
              : {}),
          })),
        },
      },
    });
  });

  const result = await prisma.$transaction(queries);

  res.status(201).json(result);
}

async function getModel(req, res) {
  const { params, user } = req;

  const model = await prisma.modelDefn.findFirst({
    where: {
      id: params?.id,
      ...getVisibilityFilters(user),
    },
    include: {
      microservice: true,
      displayValue: true,
      dashboardStageField: true,
    },
  });

  if (!model) {
    throw createStandardError(ERROR_TYPES.NOT_FOUND, 'Model not found', {
      context: 'getModel',
    });
  }

  const [modelWithDetails] = await getDetailsFromAPI({
    results: [model],
    token: user?.accessToken,
  });

  res.status(200).json(modelWithDetails);
}

async function updateModel(req, res) {
  const { params, body, user } = req;

  const values = await modelUpdate.validateAsync(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  // When displayValueId is set, update the field's order and isClickableLink
  if (values?.displayValueId) {
    // First, reset isClickableLink for all other fields in this model
    await prisma.fieldDefn.updateMany({
      where: {
        modelId: params?.id,
        isClickableLink: true,
      },
      data: {
        isClickableLink: false,
      },
    });

    // Then, update the display value field
    await prisma.fieldDefn.update({
      where: { id: values.displayValueId },
      data: {
        order: 1,
        isClickableLink: true,
      },
    });
  }

  const updated = await prisma.modelDefn.update({
    where: { id: params?.id },
    data: {
      ...objectKeysToCamelCase(values),
    },
  });

  const model = await prisma.modelDefn.findFirst({
    where: { id: params?.id, ...getVisibilityFilters(user) },
    include: { microservice: true },
  });

  if (model?.systemMenuId) {
    try {
      await axios.post(
        getSystemMenusURL(),
        {
          is_group: false,
          label: model?.label,
          href: `/${convertToSlug(model?.microservice?.name)}/${resolveModelSlug(model)}`,
          compute_microservice: model?.microserviceId,
          compute_model: model?.id,
          anonymous_can_see_it: true,
          everyone_can_see_it: true,
          is_published: true,
          parent: model?.systemMenuId,
          delete_existing: true,
        },
        { headers: { Authorization: user?.accessToken } }
      );
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[MENU_ERROR] Failed to create menu:', error?.message);
      }
    }
  }

  // Sync translations when label or helpfulHint are updated
  let translationSyncWarning = null;
  if (values.label !== undefined || values.helpfulHint !== undefined) {
    try {
      const modelWithCodes = await prisma.modelDefn.findFirst({
        where: { id: params?.id },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      if (modelWithCodes) {
        const languages = await getClientLanguages(prisma, user?.client?.id);
        if (languages.length > 0) {
          await prisma.$transaction(async (tx) => {
            await syncModelTranslations({
              tx,
              model: modelWithCodes,
              languages,
              clientId: user?.client?.id,
              userId: user?.id,
              generateMissingCodes: true, // Generate codes if missing
              dryRun: false,
            });
          });

          // Re-fetch model to get the newly generated translation codes
          const updatedWithCodes = await prisma.modelDefn.findFirst({
            where: { id: params?.id },
          });
          if (updatedWithCodes) {
            // Merge the new translation codes into the response
            updated.labelTranslationCode = updatedWithCodes.labelTranslationCode;
            updated.helpfulHintTranslationCode = updatedWithCodes.helpfulHintTranslationCode;
          }
        } else {
          translationSyncWarning = 'No languages configured for client - translation sync skipped';
          logEvent(`[TranslationSync] ${translationSyncWarning} for model ${params?.id}`);
        }
      }
    } catch (syncError) {
      translationSyncWarning = `Translation sync failed: ${syncError.message}`;
      logOperationError('updateModel:translationSync', req, syncError);
      // Continue with update response even if sync fails
    }
  }

  const response = { ...updated };
  if (translationSyncWarning) {
    response._translationSyncWarning = translationSyncWarning;
  }

  res.status(200).json(response);
}

async function deleteModel(req, res) {
  const { params, user } = req;

  const visibilityFilters = getVisibilityFilters(user);

  await prisma.$transaction(async (tx) => {
    // 1) Find all fields that will be affected:
    //    - Foreign key fields in other models pointing to this model
    //    - Fields that belong to this model itself
    const [fkFields, ownFields] = await Promise.all([
      tx.fieldDefn.findMany({
        where: { foreignKeyModelId: params?.id, ...visibilityFilters },
        select: { id: true },
      }),
      tx.fieldDefn.findMany({
        where: { modelId: params?.id, ...visibilityFilters },
        select: { id: true },
      }),
    ]);

    const fieldIdsToNull = [...fkFields, ...ownFields].map((f) => f.id);

    // 2) Null any references to these fields from ModelDefn
    if (fieldIdsToNull.length > 0) {
      await tx.modelDefn.updateMany({
        where: {
          ...visibilityFilters,
          OR: [
            { displayValueId: { in: fieldIdsToNull } },
            { dashboardStageFieldId: { in: fieldIdsToNull } },
          ],
        },
        data: {
          displayValueId: null,
          dashboardStageFieldId: null,
        },
      });
    }

    // 3) Delete all foreign key fields in other models referencing the deleted model
    await tx.fieldDefn.deleteMany({
      where: { foreignKeyModelId: params?.id, ...visibilityFilters },
    });

    // 4) Delete menus associated with the model
    await tx.menuDefn.deleteMany({
      where: { modelId: params?.id, ...visibilityFilters },
    });

    // 5) Delete fields that belong to the model
    await tx.fieldDefn.deleteMany({
      where: { modelId: params?.id, ...visibilityFilters },
    });

    // 6) Finally delete the model
    await tx.modelDefn.deleteMany({
      where: { id: params?.id, ...visibilityFilters },
    });
  });

  res.status(200).json({ deleted: params?.id });
}

module.exports = {
  getAllModels,
  createModel,
  createModelsBatch,
  getModel,
  updateModel,
  deleteModel,
};
