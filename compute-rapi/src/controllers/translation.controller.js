const prisma = require('#configs/prisma.js');
const {
  translationCreate,
  translationUpdate,
} = require('#schemas/translation.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  handleTranslationCode,
  isCodeUniqueForLanguage,
} = require('#utils/api/translationCodeHandlerUtils.js');
const {
  generateUniqueCode,
} = require('#utils/api/translationCodeGeneratorUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { getPrimaryLanguage } = require('#utils/api/translationSyncUtils.js');

async function getAllTranslations(req, res) {
  const { user, query } = req;

  logOperationStart('getAllTranslations', req, { user: user?.id, query });
  const searchFields = ['translationCode', 'value', 'namespace'];
  const filterFields = [...searchFields, 'languageId'];

  let response;
  try {
    logDatabaseStart('get_paginated_translations', req, {
      searchFields,
      filterFields,
    });
    response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: translationUpdate,
      filterFields,
      searchFields,
      model: 'translation',
      include: {
        language: true,
      },
    });
    logDatabaseSuccess('get_paginated_translations', req, {
      count: response.data?.length,
    });
  } catch (error) {
    logOperationError('getAllTranslations', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to fetch translations',
      req,
      {
        context: 'get_all_translations',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  res.status(200).json(response);
}

async function createTranslation(req, res) {
  const { user, body } = req;

  logOperationStart('createTranslation', req, {
    user: user?.id,
    bodyKeys: Object.keys(body),
  });
  let values;
  try {
    values = await translationCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('createTranslation', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'translation_creation',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('createTranslation', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'translation_creation',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  try {
    // Handle translation code generation or validation
    const clientId = user?.client?.id;

    // Include languageId in the data for proper uniqueness checking
    const codeData = {
      translationCode: values.translationCode,
      languageId: values.languageId,
    };

    values.translationCode = await handleTranslationCode(
      prisma,
      codeData,
      clientId
    );

    logDatabaseStart('create_translation', req, {
      translationCode: values.translationCode,
      languageId: values.languageId,
    });
    const translation = await prisma.translation.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_translation', req, { id: translation.id });
    logOperationSuccess('createTranslation', req, { id: translation.id });
    res.status(201).json(translation);
  } catch (error) {
    logOperationError('createTranslation', req, error);
    if (
      error.message &&
      (error.message.includes('translation code') ||
        error.message.includes('language'))
    ) {
      throw createErrorWithTrace(ERROR_TYPES.BAD_REQUEST, error.message, req, {
        context: 'translation_creation',
        severity: ERROR_SEVERITY.MEDIUM,
        originalError: error,
      });
    }
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'translation_creation',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }
}

async function getTranslation(req, res) {
  const { params, user } = req;

  logOperationStart('getTranslation', req, {
    translationId: params?.id,
    user: user?.id,
  });
  let translation;
  try {
    translation = await prisma.translation.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        language: true,
      },
    });
    logDatabaseSuccess('find_translation', req, { found: !!translation });
  } catch (error) {
    logOperationError('getTranslation', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_translation',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!translation) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      'Translation not found',
      req,
      {
        context: 'get_translation',
        severity: ERROR_SEVERITY.LOW,
        details: { translationId: params?.id },
      }
    );
    logOperationError('getTranslation', req, error);
    throw error;
  }

  logOperationSuccess('getTranslation', req, { id: translation.id });
  res.status(200).json(translation);
}

async function getTranslationsByLangCode(req, res) {
  const { params } = req;

  logOperationStart('getTranslationsByLangCode', req, {
    langCode: params?.langCode,
    namespace: params?.namespace,
  });
  // Extract langCode and namespace from params parameters
  const { langCode, namespace = 'compute' } = params;

  if (!langCode) {
    const error = createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'langCode is required',
      req,
      { context: 'get_translations_by_lang_code', severity: ERROR_SEVERITY.LOW }
    );
    logOperationError('getTranslationsByLangCode', req, error);
    throw error;
  }

  // First, find the language by its code to get the ID
  let language;
  try {
    language = await prisma.language.findFirst({
      where: {
        code: langCode,
      },
      select: {
        id: true,
      },
    });
    logDatabaseSuccess('find_language', req, { found: !!language });
  } catch (error) {
    logOperationError('getTranslationsByLangCode', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_translations_by_lang_code',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  if (!language) {
    const error = createErrorWithTrace(
      ERROR_TYPES.NOT_FOUND,
      `Language with code "${langCode}" not found`,
      req,
      {
        context: 'get_translations_by_lang_code',
        severity: ERROR_SEVERITY.LOW,
        details: { langCode },
      }
    );
    logOperationError('getTranslationsByLangCode', req, error);
    throw error;
  }

  let translations;
  try {
    translations = await prisma.translation.findMany({
      where: {
        languageId: language.id,
        namespace,
      },
      select: {
        translationCode: true,
        value: true,
      },
    });
    logDatabaseSuccess('find_translations_by_lang', req, {
      count: translations.length,
    });
  } catch (error) {
    logOperationError('getTranslationsByLangCode', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'get_translations_by_lang_code',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }

  // Format translations as a key-value object
  const formattedTranslations = translations.reduce((acc, t) => {
    acc[t.translationCode] = t.value;
    return acc;
  }, {});

  logOperationSuccess('getTranslationsByLangCode', req, {
    count: translations.length,
  });
  res.status(200).json(formattedTranslations);
}

async function updateTranslation(req, res) {
  const { params, body, user } = req;

  logOperationStart('updateTranslation', req, {
    translationId: params?.id,
    user: user?.id,
    bodyKeys: Object.keys(body),
  });
  let values;
  try {
    values = await translationUpdate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    if (error.isJoi) {
      logOperationError('updateTranslation', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        {
          context: 'update_translation',
          severity: ERROR_SEVERITY.LOW,
          details: { validationErrors: error.details?.map((d) => d.message) },
        }
      );
    }
    logOperationError('updateTranslation', req, error);
    throw createErrorWithTrace(ERROR_TYPES.INTERNAL, 'Validation error', req, {
      context: 'update_translation',
      severity: ERROR_SEVERITY.HIGH,
      originalError: error,
    });
  }

  try {
    // First get the current translation to know what we're updating from
    logDatabaseStart('find_translation', req, { translationId: params?.id });
    const currentTranslation = await prisma.translation.findUnique({
      where: { id: params?.id },
      select: { translationCode: true, languageId: true },
    });
    logDatabaseSuccess('find_translation', req, {
      found: !!currentTranslation,
    });

    if (!currentTranslation) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Translation not found',
        req,
        {
          context: 'update_translation',
          severity: ERROR_SEVERITY.LOW,
          details: { translationId: params?.id },
        }
      );
      logOperationError('updateTranslation', req, error);
      throw error;
    }

    const clientId = user?.client?.id;

    // Prepare data for code validation with the correct language ID
    // If we're updating the language, use the new one, otherwise use the current one
    const codeData = {
      translationCode: values.translationCode,
      languageId: values.languageId || currentTranslation.languageId,
    };

    // Only validate the code if it's being changed
    if (values.translationCode !== undefined) {
      values.translationCode = await handleTranslationCode(
        prisma,
        codeData,
        clientId,
        params?.id
      );
    }

    // Special handling for when only the language changes but code stays the same
    if (values.languageId && values.translationCode === undefined) {
      // We need to check if the current code is unique for the new language
      const isUniqueForNewLanguage = await isCodeUniqueForLanguage(
        prisma,
        currentTranslation.translationCode,
        clientId,
        values.languageId,
        params?.id
      );

      if (!isUniqueForNewLanguage) {
        const error = createErrorWithTrace(
          ERROR_TYPES.CONFLICT,
          'A translation with this code already exists for the target language',
          req,
          { context: 'update_translation', severity: ERROR_SEVERITY.LOW }
        );
        logOperationError('updateTranslation', req, error);
        throw error;
      }
    }

    logDatabaseStart('update_translation', req, { translationId: params?.id });
    const updated = await prisma.translation.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user.id,
      },
    });
    logDatabaseSuccess('update_translation', req, { id: updated.id });

    // Bidirectional sync: Update model/field if this is the primary language
    if (values.value !== undefined) {
      try {
        const primaryLanguage = await getPrimaryLanguage(
          prisma,
          user?.client?.id
        );

        // Only sync back if this translation is for the primary language
        if (primaryLanguage && updated.languageId === primaryLanguage.id) {
          const { translationCode } = updated;

          // Check if this translation code belongs to a ModelDefn
          const linkedModel = await prisma.modelDefn.findFirst({
            where: {
              OR: [
                { labelTranslationCode: translationCode },
                { helpfulHintTranslationCode: translationCode },
              ],
              client: user?.client?.id,
              deleted: null,
            },
            select: {
              id: true,
              labelTranslationCode: true,
              helpfulHintTranslationCode: true,
            },
          });

          if (linkedModel) {
            const updateData = {};
            if (linkedModel.labelTranslationCode === translationCode) {
              updateData.label = updated.value;
            }
            if (linkedModel.helpfulHintTranslationCode === translationCode) {
              updateData.helpfulHint = updated.value;
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.modelDefn.update({
                where: { id: linkedModel.id },
                data: {
                  ...updateData,
                  updatedBy: user.id,
                },
              });
              logEvent(
                `[BidirectionalSync] Updated ModelDefn ${linkedModel.id} from translation ${updated.id}`
              );
            }
          }

          // Check if this translation code belongs to a FieldDefn
          const linkedField = await prisma.fieldDefn.findFirst({
            where: {
              OR: [
                { labelTranslationCode: translationCode },
                { helpfulHintTranslationCode: translationCode },
              ],
              client: user?.client?.id,
              deleted: null,
            },
            select: {
              id: true,
              labelTranslationCode: true,
              helpfulHintTranslationCode: true,
            },
          });

          if (linkedField) {
            const updateData = {};
            if (linkedField.labelTranslationCode === translationCode) {
              updateData.label = updated.value;
            }
            if (linkedField.helpfulHintTranslationCode === translationCode) {
              updateData.helpfulHint = updated.value;
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.fieldDefn.update({
                where: { id: linkedField.id },
                data: {
                  ...updateData,
                  updatedBy: user.id,
                },
              });
              logEvent(
                `[BidirectionalSync] Updated FieldDefn ${linkedField.id} from translation ${updated.id}`
              );
            }
          }
        }
      } catch (syncError) {
        // Log but don't fail the update - sync can be run manually later
        logOperationError(
          'updateTranslation:bidirectionalSync',
          req,
          syncError
        );
      }
    }

    logOperationSuccess('updateTranslation', req, { id: updated.id });
    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateTranslation', req, error);
    if (
      error.message &&
      (error.message.includes('translation code') ||
        error.message.includes('language'))
    ) {
      throw createErrorWithTrace(ERROR_TYPES.BAD_REQUEST, error.message, req, {
        context: 'update_translation',
        severity: ERROR_SEVERITY.MEDIUM,
        originalError: error,
      });
    }
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'update_translation',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }
}

async function deleteTranslation(req, res) {
  const { params, user } = req;

  logOperationStart('deleteTranslation', req, {
    translationId: params?.id,
    user: user?.id,
  });
  try {
    logDatabaseStart('delete_translation', req, { translationId: params?.id });
    await prisma.translation.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_translation', req, { deleted: params?.id });
    logOperationSuccess('deleteTranslation', req, { deleted: params?.id });
    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteTranslation', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Database operation failed',
      req,
      {
        context: 'delete_translation',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }
}

/**
 * Generates unique translation codes for import purposes
 * @param {Request} req - Express request with { count } in body
 * @param {Response} res - Express response
 */
async function generateTranslationCodes(req, res) {
  const { body, user } = req;
  const { count } = body;

  logOperationStart('generateTranslationCodes', req, { count, user: user?.id });

  // Validate count
  if (!count || typeof count !== 'number' || count < 1) {
    const error = createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      'count is required and must be a positive integer',
      req,
      { context: 'generate_translation_codes', severity: ERROR_SEVERITY.LOW }
    );
    logOperationError('generateTranslationCodes', req, error);
    throw error;
  }

  // Limit count to prevent abuse
  const MAX_CODES = 1000;
  if (count > MAX_CODES) {
    const error = createErrorWithTrace(
      ERROR_TYPES.BAD_REQUEST,
      `count cannot exceed ${MAX_CODES}`,
      req,
      {
        context: 'generate_translation_codes',
        severity: ERROR_SEVERITY.LOW,
        details: { count, maxAllowed: MAX_CODES },
      }
    );
    logOperationError('generateTranslationCodes', req, error);
    throw error;
  }

  const clientId = user?.client?.id;

  try {
    const codes = [];
    for (let i = 0; i < count; i += 1) {
      const code = await generateUniqueCode(prisma, clientId);
      codes.push(code);
    }

    logOperationSuccess('generateTranslationCodes', req, {
      count: codes.length,
    });
    res.status(200).json({ codes });
  } catch (error) {
    logOperationError('generateTranslationCodes', req, error);
    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      'Failed to generate translation codes',
      req,
      {
        context: 'generate_translation_codes',
        severity: ERROR_SEVERITY.HIGH,
        originalError: error,
      }
    );
  }
}

module.exports = {
  getAllTranslations,
  createTranslation,
  getTranslation,
  updateTranslation,
  deleteTranslation,
  getTranslationsByLangCode,
  generateTranslationCodes,
};
