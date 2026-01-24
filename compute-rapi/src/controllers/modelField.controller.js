/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing model fields in a database using Prisma.
 * It includes functions for retrieving all model fields, creating a new model field, retrieving
 * a single model field, updating an existing model field, and deleting a model field.
 *
 * The `getAllModelFields` function retrieves a paginated list of model fields based on query parameters
 * such as search fields and filter fields, with support for including the foreign key model associated
 * with each field.
 *
 * The `createModelField` function validates the request body using a Joi schema and creates a new model
 * field in the database with additional metadata.
 *
 * The `getModelField` function retrieves a single model field based on the provided field ID, with visibility
 * filters applied to ensure the field is accessible to the requesting user. It includes the foreign key model
 * associated with the field.
 *
 * The `updateModelField` function updates an existing model field in the database based on the provided field ID
 * and request body.
 *
 * The `deleteModelField` function deletes a model field from the database based on the provided field ID, with
 * visibility filters applied to ensure the field is deletable by the requesting user.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 */

const prisma = require('#configs/prisma.js');
const {
  modelFieldCreate,
  modelFieldUpdate,
  modelFieldBatchCreateWithMeta,
  modelFieldBatchUpdateWithMeta,
} = require('#schemas/modelField.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
// MODIFY the original line to look like this
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
  parseAndAssignVisibilityAttributes,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const {
  getClientLanguages,
  syncFieldTranslations,
} = require('#utils/api/translationSyncUtils.js');

async function getAllModelFields(req, res) {
  const { user, query } = req;

  logOperationStart('getAllModelFields', req, { user: user?.id, query });
  // Define fields
  const searchFields = [
    'name',
    'defaultValue',
    'helpfulHint',
    'tags',
    'label',
    'labelTranslationCode',
    'helpfulHintTranslationCode',
  ];
  const filterFields = [
    ...searchFields,
    'isForeignKey',
    'isPrimaryKey',
    'isOptional',
    'isUnique',
    'isIndex',
    'order',
    'isClickableLink',
    'isMultiline',
    'modelId',
    'foreignKeyModelId',
    'onDelete',
    'showInTable',
    'showInCreateForm',
    'minLength',
    'maxLength',
    'dataType',
    'isEditable',
    'showInDetailCard',
    'foreignKeyTarget',
    'externalModelId',
    'externalMicroserviceId',
    'externalIsOptional',
    'foreignKeyType',
    'dependsOnFieldId',
  ];

  let response;
  try {
    logDatabaseStart('get_paginated_model_fields', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: modelFieldUpdate,
      filterFields,
      searchFields,
      model: 'fieldDefn',
      include: {
        foreignKeyModel: true,
        enumDefn: true,
        model: {
          include: {
            microservice: true,
          },
        },
        dependsOnField: true,
      },
    });
    logDatabaseSuccess('get_paginated_model_fields', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllModelFields', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch model fields',
      req,
      {
        context: 'get_all_model_fields',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  res.status(200).json(response);
}

async function createModelField(req, res) {
  const { user, body } = req;

  logOperationStart('createModelField', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });
  let values;
  try {
    values = await modelFieldCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createModelField', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'create_model_field',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createModelField', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'create_model_field',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  let found;
  try {
    found = await prisma.fieldDefn.findFirst({
      where: {
        name: values?.name,
        modelId: values?.modelId,
      },
    });
    logDatabaseSuccess('find_field_defn', req, { found: !!found });
  } catch (error) {
    logOperationError('createModelField', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_model_field',
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
        context: 'create_model_field',
        severity: ERROR_SEVERITY.LOW,
        details: { name: values?.name, modelId: values?.modelId },
      }
    );
    logOperationError('createModelField', req, error);
    throw error;
  }

  // Removed order rebasing on create per requirements

  // Validate dependsOnFieldId: must reference a different FK field within the same model
  if (values?.dependsOnFieldId) {
    if (values?.id && values.dependsOnFieldId === values.id) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'A field cannot depend on itself.',
        { context: 'create_model_field' }
      );
    }

    let target;
    try {
      target = await prisma.fieldDefn.findUnique({
        where: { id: values.dependsOnFieldId },
        select: { id: true, modelId: true, isForeignKey: true },
      });
    } catch (error) {
      logOperationError('createModelField', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Database operation failed',
        req,
        {
          context: 'create_model_field',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }

    if (!target || target.modelId !== values.modelId || !target.isForeignKey) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'dependsOnFieldId must reference a foreign key field within the same model.',
        { context: 'create_model_field' }
      );
    }
  }

  if (values?.isClickableLink) {
    try {
      await prisma.fieldDefn.updateMany({
        where: {
          modelId: values.modelId,
          isClickableLink: true,
        },
        data: {
          isClickableLink: false,
        },
      });
      logDatabaseSuccess('update_clickable_link', req, {
        modelId: values.modelId,
      });
    } catch (error) {
      logOperationError('createModelField', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Clickable link update failed',
        req,
        {
          context: 'create_model_field',
          severity: ERROR_SEVERITY.HIGH,
          originalError: error,
        }
      );
    }
  }

  let modelField;
  try {
    logDatabaseStart('create_field_defn', req, {
      name: values?.name,
      modelId: values?.modelId,
    });
    modelField = await prisma.fieldDefn.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_field_defn', req, { id: modelField.id });
  } catch (error) {
    logOperationError('createModelField', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'create_model_field',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  // Sync translations for label and helpfulHint
  let translationSyncWarning = null;
  try {
    const languages = await getClientLanguages(prisma, user?.client?.id);
    if (languages.length > 0) {
      await prisma.$transaction(async (tx) => {
        await syncFieldTranslations({
          tx,
          field: modelField,
          languages,
          clientId: user?.client?.id,
          userId: user?.id,
          generateMissingCodes: true, // Generate codes if missing
          dryRun: false,
        });
      });

      // Re-fetch field to get the newly generated translation codes
      const fieldWithCodes = await prisma.fieldDefn.findFirst({
        where: { id: modelField.id },
      });
      if (fieldWithCodes) {
        modelField.labelTranslationCode = fieldWithCodes.labelTranslationCode;
        modelField.helpfulHintTranslationCode = fieldWithCodes.helpfulHintTranslationCode;
      }
    } else {
      translationSyncWarning = 'No languages configured for client - translation sync skipped';
      logEvent(`[TranslationSync] ${translationSyncWarning} for field ${modelField.id}`);
    }
  } catch (syncError) {
    translationSyncWarning = `Translation sync failed: ${syncError.message}`;
    logOperationError('createModelField:translationSync', req, syncError);
  }

  let modelFieldWithDetails;
  try {
    [modelFieldWithDetails] = await getDetailsFromAPI({
      results: [modelField],
      token: user.accessToken,
    });
    logOperationSuccess('createModelField', req, { id: modelField.id });
  } catch (error) {
    logOperationError('createModelField', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to enrich model field details',
      req,
      {
        context: 'create_model_field',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  const response = { ...modelFieldWithDetails };
  if (translationSyncWarning) {
    response._translationSyncWarning = translationSyncWarning;
  }

  res.status(201).json(response);
}

async function createModelFieldsBatch(req, res) {
  const { user, body } = req;

  const validated = await modelFieldBatchCreateWithMeta.validateAsync(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  const { createdBy, client, modelId, modelFields } = validated;

  const isInternal = !user.isAuthenticated && user.internalRequest;

  if (isInternal) {
    if (!createdBy || !client) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'For internal requests, both client and createdBy fields are required.',
        {
          context: 'createModelFieldsBatch',
        }
      );
    }

    user.client = { id: client };
    user.id = createdBy;
  }

  const existingModel = await prisma.modelDefn.findUnique({
    where: {
      id: modelId,
    },
    select: {
      id: true,
      microserviceId: true,
    },
  });

  if (!existingModel) {
    throw createStandardError(
      ERROR_TYPES.NOT_FOUND,
      `The parent model with ID '${modelId}' does not exist.`,
      {
        context: 'createModelFieldsBatch',
      }
    );
  }

  const parentModelMicroserviceId = existingModel.microserviceId;

  // Collect unique foreignKeyModel names from the fields that are marked as foreign keys
  const foreignKeyModelNamesToValidate = [
    ...new Set(
      modelFields
        .filter((field) => field.isForeignKey && field.foreignKeyModel)
        .map((field) => field.foreignKeyModel)
        .filter(Boolean) // Filter out any empty strings
    ),
  ];

  const foreignKeyModelNameToIdMap = new Map();
  const missingForeignKeyModelsSet = new Set(); // Use a Set for efficient lookup of missing models

  if (foreignKeyModelNamesToValidate.length > 0) {
    // Find existing foreign key models within the same microservice
    const existingForeignKeyModels = await prisma.modelDefn.findMany({
      where: {
        name: {
          in: foreignKeyModelNamesToValidate,
        },
        microserviceId: parentModelMicroserviceId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Populate the map with found foreign key models
    existingForeignKeyModels.forEach((model) => {
      foreignKeyModelNameToIdMap.set(model.name, model.id);
    });

    // Identify which requested foreignKeyModels are actually missing
    foreignKeyModelNamesToValidate.forEach((name) => {
      if (!foreignKeyModelNameToIdMap.has(name)) {
        missingForeignKeyModelsSet.add(name);
      }
    });

    // Log the missing models (optional, for debugging/information)
    if (missingForeignKeyModelsSet.size > 0) {
      console.warn(
        `Warning: The following foreign key models were requested but not found in microservice ${parentModelMicroserviceId} and will be ignored: ${[
          ...missingForeignKeyModelsSet,
        ].join(', ')}`
      );
    }
  }

  // Prepare Prisma create queries for each valid field (omit dependsOn for first pass)
  const queries = modelFields.map((field) => {
    // Resolve the foreignKeyModelId using the map.
    // If foreignKeyModel is provided and found in the map, use its ID.
    // Otherwise, if foreignKeyModelId was explicitly provided (and not foreignKeyModel), use that.
    // If neither, or if foreignKeyModel was missing, it will be undefined/null,
    // which correctly prevents the foreignKeyModel connect clause.
    const resolvedForeignKeyModelId =
      field.isForeignKey && field.foreignKeyModel
        ? foreignKeyModelNameToIdMap.get(field.foreignKeyModel)
        : field.foreignKeyModelId; // Fallback to foreignKeyModelId if foreignKeyModel is not used or not found

    const {
      dependsOnFieldId: _omitDependsOnFieldId,
      dependsOnFieldName: _omitDependsOnFieldName,
      ...rest
    } = field;
    return prisma.fieldDefn.create({
      data: {
        // Apply visibility attributes based on the user and field data
        ...parseAndAssignVisibilityAttributes({ body: field, user }),
        id: rest?.id,
        name: rest?.name,
        label: rest?.label,
        helpfulHint: rest?.helpfulHint,
        labelTranslationCode: rest?.labelTranslationCode,
        helpfulHintTranslationCode: rest?.helpfulHintTranslationCode,
        dataType: rest?.dataType,
        isForeignKey: rest?.isForeignKey,
        foreignKeyType: rest?.foreignKeyType,
        foreignKeyTarget: rest?.foreignKeyTarget,
        isOptional: rest?.isOptional,
        isUnique: rest?.isUnique,
        isIndex: rest?.isIndex,
        onDelete: rest?.onDelete,
        order: rest?.order,
        minLength: rest?.minLength,
        maxLength: rest?.maxLength,
        tags: rest?.tags,
        description: rest?.description,
        showInTable: rest?.showInTable,
        showInCreateForm: rest?.showInCreateForm,
        showInDetailCard: rest?.showInDetailCard,
        externalIsOptional: rest?.externalIsOptional,
        isEditable: rest?.isEditable,
        isClickableLink: rest?.isClickableLink,
        isMultiline: rest?.isMultiline,
        externalMicroserviceId: rest?.externalMicroserviceId,
        externalModelId: rest?.externalModelId,
        enumDefnId: rest?.enumDefnId,
        // Vector field configuration (only applicable when dataType = Vector)
        vectorDimension: rest?.vectorDimension,
        vectorDistanceMetric: rest?.vectorDistanceMetric,
        vectorIndexType: rest?.vectorIndexType,
        // Nested VectorIndexConfig creation (only for Vector fields with config)
        ...(rest?.dataType === 'Vector' &&
        rest?.vectorIndexConfigs?.length > 0
          ? {
              vectorIndexConfigs: {
                create: rest.vectorIndexConfigs.map((config) => ({
                  hnswM: config?.hnswM,
                  hnswEfConstruct: config?.hnswEfConstruct,
                  ivfLists: config?.ivfLists,
                  ...parseAndAssignVisibilityAttributes({ body: field, user }),
                })),
              },
            }
          : {}),
        // Connect to the parent model using the top-level modelId
        model: {
          connect: { id: modelId },
        },
        ...(rest?.isForeignKey && resolvedForeignKeyModelId
          ? {
              foreignKeyModel: {
                connect: { id: resolvedForeignKeyModelId },
              },
            }
          : {}),
      },
    });
  });

  // Execute all create queries in a single transaction
  const createdResults = await prisma.$transaction(queries);

  // Second pass: resolve and set dependsOnFieldId (by id or name)
  const nameToCreatedId = new Map();
  createdResults.forEach((r) => {
    nameToCreatedId.set(r.name, r.id);
  });

  const dependencyUpdates = [];
  for (let i = 0; i < modelFields.length; i += 1) {
    const inputField = modelFields[i];
    const createdRow = createdResults[i];

    let targetId = inputField?.dependsOnFieldId || null;
    if (!targetId && inputField?.dependsOnFieldName) {
      targetId = nameToCreatedId.get(inputField.dependsOnFieldName) || null;
    }

    if (!targetId) continue;
    if (targetId === createdRow.id) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        `Field '${createdRow.name}' cannot depend on itself.`,
        { context: 'createModelFieldsBatch' }
      );
    }

    const target = await prisma.fieldDefn.findUnique({
      where: { id: targetId },
      select: { id: true, modelId: true, isForeignKey: true },
    });

    if (!target || target.modelId !== modelId || !target.isForeignKey) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        `dependsOnField '${inputField.dependsOnFieldName || targetId}' must reference a FK field in the same model`,
        { context: 'createModelFieldsBatch' }
      );
    }

    dependencyUpdates.push(
      prisma.fieldDefn.update({
        where: { id: createdRow.id },
        data: { dependsOnField: { connect: { id: targetId } } },
      })
    );
  }

  if (dependencyUpdates.length > 0) {
    await prisma.$transaction(dependencyUpdates);
  }

  // Handle isDisplayValue - auto-set display value if model has none
  // Note: Validation ensures only one field can have isDisplayValue: true
  const displayValueField = modelFields.find((f) => f.isDisplayValue === true);

  if (displayValueField) {
    // Find the created field ID
    const displayValueFieldIndex = modelFields.indexOf(displayValueField);
    const createdDisplayValueField = createdResults[displayValueFieldIndex];

    // Fetch the parent model to check display value configuration
    const parentModel = await prisma.modelDefn.findUnique({
      where: { id: modelId },
      select: {
        id: true,
        displayValueId: true,
        displayValueTemplate: true,
      },
    });

    // Only set if model has NO display value config (both null/undefined)
    if (
      parentModel &&
      !parentModel.displayValueId &&
      !parentModel.displayValueTemplate
    ) {
      // Follow existing pattern from model.controller.js updateModel:
      // 1. Reset isClickableLink on all other fields
      await prisma.fieldDefn.updateMany({
        where: {
          modelId,
          isClickableLink: true,
        },
        data: {
          isClickableLink: false,
        },
      });

      // 2. Set order and isClickableLink on the display value field
      await prisma.fieldDefn.update({
        where: { id: createdDisplayValueField.id },
        data: {
          order: 1,
          isClickableLink: true,
        },
      });

      // 3. Update the model's displayValueId
      await prisma.modelDefn.update({
        where: { id: modelId },
        data: {
          displayValueId: createdDisplayValueField.id,
        },
      });
    }
  }

  return res.status(201).json(createdResults);
}

async function getModelField(req, res) {
  const { params, user } = req;

  const modelField = await prisma.fieldDefn.findFirst({
    where: {
      id: params?.id,
      ...getVisibilityFilters(user),
    },
    include: { foreignKeyModel: true, model: true, enumDefn: true },
  });

  if (!modelField) {
    throw createStandardError(ERROR_TYPES.NOT_FOUND, 'ModelField not found', {
      context: 'getModelField',
    });
  }

  const [modelFieldWithDetails] = await getDetailsFromAPI({
    results: [modelField],
    token: user.accessToken,
  });

  res.status(200).json(modelFieldWithDetails);
}

async function updateModelField(req, res) {
  const { params, body, user } = req;

  const values = await modelFieldUpdate.validateAsync(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  const modelField = await prisma.fieldDefn.findFirst({
    where: {
      id: params?.id,
      ...getVisibilityFilters(user),
    },
    select: {
      modelId: true,
    },
  });

  if (!modelField) {
    throw createStandardError(ERROR_TYPES.NOT_FOUND, 'ModelField not found', {
      context: 'updateModelField',
    });
  }

  if (values?.isClickableLink) {
    await prisma.fieldDefn.updateMany({
      where: {
        modelId: modelField.modelId,
        isClickableLink: true,
      },
      data: {
        isClickableLink: false,
      },
    });
  }

  // Removed order renormalization on update per requirements

  // Validate dependsOnFieldId on update: same model, FK, and not self
  if (values?.dependsOnFieldId) {
    if (values.dependsOnFieldId === params?.id) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'A field cannot depend on itself.',
        { context: 'updateModelField' }
      );
    }

    const target = await prisma.fieldDefn.findUnique({
      where: { id: values.dependsOnFieldId },
      select: { id: true, modelId: true, isForeignKey: true },
    });

    if (
      !target ||
      target.modelId !== modelField.modelId ||
      !target.isForeignKey
    ) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'dependsOnFieldId must reference a foreign key field within the same model.',
        { context: 'updateModelField' }
      );
    }
  }

  const updated = await prisma.fieldDefn.update({
    where: { id: params?.id },
    data: {
      ...objectKeysToCamelCase(values),
    },
  });

  // Sync translations when label or helpfulHint are updated
  let translationSyncWarning = null;
  if (values.label !== undefined || values.helpfulHint !== undefined) {
    try {
      const fieldWithCodes = await prisma.fieldDefn.findFirst({
        where: { id: params?.id },
        select: {
          id: true,
          label: true,
          helpfulHint: true,
          labelTranslationCode: true,
          helpfulHintTranslationCode: true,
        },
      });

      if (fieldWithCodes) {
        const languages = await getClientLanguages(prisma, user?.client?.id);
        if (languages.length > 0) {
          await prisma.$transaction(async (tx) => {
            await syncFieldTranslations({
              tx,
              field: fieldWithCodes,
              languages,
              clientId: user?.client?.id,
              userId: user?.id,
              generateMissingCodes: true, // Generate codes if missing
              dryRun: false,
            });
          });

          // Re-fetch field to get the newly generated translation codes
          const updatedWithCodes = await prisma.fieldDefn.findFirst({
            where: { id: params?.id },
          });
          if (updatedWithCodes) {
            // Merge the new translation codes into the response
            updated.labelTranslationCode = updatedWithCodes.labelTranslationCode;
            updated.helpfulHintTranslationCode = updatedWithCodes.helpfulHintTranslationCode;
          }
        } else {
          translationSyncWarning = 'No languages configured for client - translation sync skipped';
          logEvent(`[TranslationSync] ${translationSyncWarning} for field ${params?.id}`);
        }
      }
    } catch (syncError) {
      translationSyncWarning = `Translation sync failed: ${syncError.message}`;
      logOperationError('updateModelField:translationSync', req, syncError);
      // Continue with update response even if sync fails
    }
  }

  const response = { ...updated };
  if (translationSyncWarning) {
    response._translationSyncWarning = translationSyncWarning;
  }

  res.status(200).json(response);
}

async function deleteModelField(req, res) {
  const { params, user } = req;

  await prisma.modelDefn.updateMany({
    where: {
      OR: [
        { displayValueId: params?.id },
        { dashboardStageFieldId: params?.id },
      ],
    },
    data: {
      displayValueId: null,
      dashboardStageFieldId: null,
    },
  });

  await prisma.fieldDefn.deleteMany({
    where: { id: params?.id, ...getVisibilityFilters(user) },
  });

  res.status(200).json({ deleted: params?.id });
}

async function updateModelFieldsBatch(req, res) {
  const { user, body } = req;

  const validated = await modelFieldBatchUpdateWithMeta.validateAsync(body, {
    abortEarly: false,
    stripUnknown: true,
  });

  const { createdBy, client, modelFields } = validated;

  const isInternal = !user.isAuthenticated && user.internalRequest;
  if (isInternal) {
    if (!createdBy || !client) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'For internal requests, both client and createdBy fields are required.',
        { context: 'updateModelFieldsBatch' }
      );
    }
    user.client = { id: client };
    user.id = createdBy;
  }

  // Fetch all existing records in scope to ensure visibility
  const fieldIds = modelFields.map((f) => f.id);
  const existing = await prisma.fieldDefn.findMany({
    where: { id: { in: fieldIds }, ...getVisibilityFilters(user) },
    select: { id: true, modelId: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));
  const missingIds = fieldIds.filter((id) => !existingIds.has(id));
  if (missingIds.length > 0) {
    throw createStandardError(
      ERROR_TYPES.NOT_FOUND,
      `Some fields were not found or not visible: ${missingIds.join(', ')}`,
      { context: 'updateModelFieldsBatch' }
    );
  }

  // If any updated field sets isClickableLink, clear others for same model
  const clickableUpdates = modelFields.filter((f) => f.isClickableLink);
  const modelIdsNeedingClear = new Set();
  if (clickableUpdates.length > 0) {
    // Map id->modelId from existing lookup
    const idToModelId = new Map(existing.map((e) => [e.id, e.modelId]));
    clickableUpdates.forEach((f) => {
      const mId = idToModelId.get(f.id);
      if (mId) modelIdsNeedingClear.add(mId);
    });
  }

  const updates = [];
  // First clear isClickableLink for impacted models
  for (const modelId of modelIdsNeedingClear) {
    updates.push(
      prisma.fieldDefn.updateMany({
        where: { modelId, isClickableLink: true },
        data: { isClickableLink: false },
      })
    );
  }

  // Then apply individual updates
  for (const field of modelFields) {
    const { id, ...rest } = field;
    updates.push(
      prisma.fieldDefn.update({
        where: { id },
        data: objectKeysToCamelCase(rest),
      })
    );
  }

  const result = await prisma.$transaction(updates);
  // Return only the updated field rows (last N entries), not the clear operations
  const updatedRows = result.slice(modelIdsNeedingClear.size, result.length);
  return res.status(200).json(updatedRows);
}

module.exports = {
  getAllModelFields,
  createModelField,
  createModelFieldsBatch,
  getModelField,
  updateModelField,
  deleteModelField,
  updateModelFieldsBatch,
};
