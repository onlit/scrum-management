const prisma = require('#configs/prisma.js');
const {
  languageCreate,
  languageUpdate,
} = require('#schemas/language.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { getPaginatedList } = require('#utils/shared/databaseUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');

async function getAllLanguages(req, res) {
  logOperationStart('getAllLanguages', req, {
    user: req.user?.id,
    query: req.query,
  });
  try {
    const { user, query } = req;

    const searchFields = ['code', 'name', 'direction', 'tags'];
    const filterFields = [...searchFields];

    logDatabaseStart('get_paginated_languages', req, {
      filterFields,
      searchFields,
    });
    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: languageUpdate,
      filterFields,
      searchFields,
      model: 'language',
    });
    logDatabaseSuccess('get_paginated_languages', req, {
      count: response.data?.length,
    });
    logOperationSuccess('getAllLanguages', req, {
      count: response.data?.length,
    });
    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllLanguages', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to get languages',
      req,
      { context: 'get_all_languages', originalError: error }
    );
  }
}

async function createLanguage(req, res) {
  logOperationStart('createLanguage', req, {
    user: req.user?.id,
    bodyKeys: Object.keys(req.body || {}),
  });
  try {
    const { user, body } = req;
    let values;
    try {
      values = await languageCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('createLanguage', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        { context: 'create_language_validation', originalError: error }
      );
    }
    logDatabaseStart('check_existing_language', req, { code: values.code });
    // Check if a language with the same code exists (including soft-deleted ones)
    const existingLanguage = await prisma.language.findFirst({
      where: {
        code: values.code,
      },
    });

    if (existingLanguage) {
      throw createErrorWithTrace(
        ERROR_TYPES.CONFLICT,
        'A language with this code already exists',
        req,
        { context: 'create_language_duplicate_check' }
      );
    }
    logDatabaseStart('create_language', req, { values });
    const language = await prisma.language.create({
      data: buildCreateRecordPayload({
        validatedValues: values,
        requestBody: body,
        user,
      }),
    });
    logDatabaseSuccess('create_language', req, { id: language.id });
    logOperationSuccess('createLanguage', req, { id: language.id });
    res.status(201).json(language);
  } catch (error) {
    logOperationError('createLanguage', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to create language',
      req,
      { context: 'create_language', originalError: error }
    );
  }
}

async function getLanguage(req, res) {
  logOperationStart('getLanguage', req, {
    languageId: req.params?.id,
    user: req.user?.id,
  });
  try {
    const { params, user } = req;

    logDatabaseStart('find_language', req, { languageId: params?.id });
    const language = await prisma.language.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
    });
    logDatabaseSuccess('find_language', req, { found: !!language });
    if (!language) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Language not found',
        req,
        { context: 'get_language' }
      );
    }
    logOperationSuccess('getLanguage', req, { id: language.id });
    res.status(200).json(language);
  } catch (error) {
    logOperationError('getLanguage', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to get language',
      req,
      { context: 'get_language', originalError: error }
    );
  }
}

async function updateLanguage(req, res) {
  logOperationStart('updateLanguage', req, {
    languageId: req.params?.id,
    bodyKeys: Object.keys(req.body || {}),
  });
  try {
    const { params, body } = req;
    let values;
    try {
      values = await languageUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      logOperationError('updateLanguage', req, error);
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Input validation failed',
        req,
        { context: 'update_language_validation', originalError: error }
      );
    }
    // If code is being updated, check for uniqueness
    if (values.code) {
      logDatabaseStart('get_current_language', req, { languageId: params?.id });
      // Get the current language to compare
      const currentLanguage = await prisma.language.findUnique({
        where: { id: params?.id },
        select: { code: true },
      });

      // Only check for duplicates if the code is actually changing
      if (currentLanguage && currentLanguage.code !== values.code) {
        logDatabaseStart('check_existing_language_code', req, {
          code: values.code,
        });
        const existingLanguage = await prisma.language.findFirst({
          where: {
            code: values.code,
            id: { not: params?.id }, // Exclude the current record
          },
        });

        if (existingLanguage) {
          throw createErrorWithTrace(
            ERROR_TYPES.CONFLICT,
            'A language with this code already exists',
            req,
            { context: 'update_language_duplicate_check' }
          );
        }
      }
    }
    logDatabaseStart('update_language', req, {
      languageId: params?.id,
      values,
    });
    const updated = await prisma.language.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
      },
    });
    logDatabaseSuccess('update_language', req, { id: updated.id });
    logOperationSuccess('updateLanguage', req, { id: updated.id });
    res.status(200).json(updated);
  } catch (error) {
    logOperationError('updateLanguage', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to update language',
      req,
      { context: 'update_language', originalError: error }
    );
  }
}

async function deleteLanguage(req, res) {
  logOperationStart('deleteLanguage', req, {
    languageId: req.params?.id,
    user: req.user?.id,
  });
  try {
    const { params, user } = req;

    logDatabaseStart('delete_language', req, { languageId: params?.id });
    await prisma.language.deleteMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    await prisma.translation.deleteMany({
      where: { languageId: params?.id, ...getVisibilityFilters(user) },
    });
    logDatabaseSuccess('delete_language', req, { deletedId: params?.id });
    logOperationSuccess('deleteLanguage', req, { deletedId: params?.id });
    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteLanguage', req, error);
    throw createErrorWithTrace(
      error.type || ERROR_TYPES.INTERNAL,
      error.message || 'Failed to delete language',
      req,
      { context: 'delete_language', originalError: error }
    );
  }
}

module.exports = {
  getAllLanguages,
  createLanguage,
  getLanguage,
  updateLanguage,
  deleteLanguage,
};
