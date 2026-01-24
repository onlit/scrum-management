/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personSocialMedia using Prisma.
 * It includes functions for retrieving all personSocialMedia, creating a new personSocialMedia, retrieving a single personSocialMedia,
 * updating an existing personSocialMedia, and deleting a personSocialMedia.
 *
 * The `getAllPersonSocialMedia` function retrieves a paginated list of personSocialMedia based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonSocialMedia` function validates the request body using a Joi schema, generates a unique code
 * for the personSocialMedia, and creates a new personSocialMedia in the database with additional metadata.
 *
 * The `getPersonSocialMedia` function retrieves a single personSocialMedia based on the provided personSocialMedia ID, with visibility
 * filters applied to ensure the personSocialMedia is accessible to the requesting user.
 *
 * The `updatePersonSocialMedia` function updates an existing personSocialMedia in the database based on the provided personSocialMedia ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonSocialMedia` function deletes a personSocialMedia from the database based on the provided personSocialMedia ID, with
 * visibility filters applied to ensure the personSocialMedia is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  personSocialMediaCreate,
  personSocialMediaUpdate,
} = require('#schemas/personSocialMedia.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
} = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  // verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
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
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllPersonSocialMedia(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPersonSocialMedia', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'username', 'url'];
    const filterFields = [...searchFields, 'personId', 'socialMediaId'];

    const include = {
      person: true,
      socialMedia: true,
    };

    // Support relational search: person fields and socialMedia name
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    const isAutocomplete = !!query?.autocomplete;
    if (rawSearch) {
      if (isAutocomplete) {
        customWhere = {
          OR: [
            { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
            {
              socialMedia: {
                name: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          ],
        };
      } else {
        customWhere = {
          OR: [
            {
              person: {
                firstName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            {
              person: {
                middleName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            {
              person: {
                lastName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
            {
              socialMedia: {
                name: { contains: rawSearch, mode: 'insensitive' },
              },
            },
          ],
        };
      }
    }

    // Log database operation start
    logDatabaseStart('get_all_person_social_media', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: personSocialMediaUpdate,
      filterFields,
      searchFields,
      model: 'personSocialMedia',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values to all person social media records
    if (response?.results) {
      response.results = response.results.map((personSocialMedia) =>
        enrichRecordDisplayValues(personSocialMedia, 'PersonSocialMedia')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_person_social_media', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPersonSocialMedia', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPersonSocialMedia', req, error);
    throw handleDatabaseError(error, 'get_all_person_social_media');
  }
}

async function createPersonSocialMedia(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPersonSocialMedia', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personSocialMediaCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPersonSocialMedia', req, error);
        throw handleValidationError(error, 'person_social_media_creation');
      }
      logOperationError('createPersonSocialMedia', req, error);
      throw error;
    }

    const modelRelationFields = ['personId', 'socialMediaId'];

    const include = {
      person: true,
      socialMedia: true,
    };

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_person_social_media', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonSocialMedia = await prisma.personSocialMedia.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person_social_media', req, {
      id: newPersonSocialMedia.id,
      code: newPersonSocialMedia.code,
    });

    const [newPersonSocialMediaWithDetails] = await getDetailsFromAPI({
      results: [newPersonSocialMedia],
      token: user?.accessToken,
    });

    // Attach display value
    const personSocialMediaWithDisplayValue = enrichRecordDisplayValues(
      newPersonSocialMediaWithDetails,
      'PersonSocialMedia'
    );

    // Log operation success
    logOperationSuccess('createPersonSocialMedia', req, {
      id: newPersonSocialMedia.id,
      code: newPersonSocialMedia.code,
    });

    res.status(201).json(personSocialMediaWithDisplayValue);
  } catch (error) {
    logOperationError('createPersonSocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_person_social_media');
  }
}

async function getPersonSocialMedia(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonSocialMedia', req, {
    user: user?.id,
    personSocialMediaId: params?.id,
  });

  try {
    const include = {
      person: true,
      socialMedia: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_social_media', req, {
      personSocialMediaId: params?.id,
      userId: user?.id,
    });

    const foundPersonSocialMedia = await prisma.personSocialMedia.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_person_social_media', req, {
      found: !!foundPersonSocialMedia,
      personSocialMediaId: params?.id,
    });

    if (!foundPersonSocialMedia) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonSocialMedia not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_social_media',
          details: { personSocialMediaId: params?.id },
        }
      );
      logOperationError('getPersonSocialMedia', req, error);
      throw error;
    }

    const [foundPersonSocialMediaWithDetails] = await getDetailsFromAPI({
      results: [foundPersonSocialMedia],
      token: user?.accessToken,
    });

    // Attach display value
    const personSocialMediaWithDisplayValue = enrichRecordDisplayValues(
      foundPersonSocialMediaWithDetails,
      'PersonSocialMedia'
    );

    // Log operation success
    logOperationSuccess('getPersonSocialMedia', req, {
      id: foundPersonSocialMedia.id,
      code: foundPersonSocialMedia.code,
    });

    res.status(200).json(personSocialMediaWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonSocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person_social_media');
  }
}

async function updatePersonSocialMedia(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePersonSocialMedia', req, {
    personSocialMediaId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personSocialMediaUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePersonSocialMedia', req, error);
        throw handleValidationError(error, 'person_social_media_update');
      }
      logOperationError('updatePersonSocialMedia', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Soft-delete aware fetch for current record to ensure visibility
    const current = await prisma.personSocialMedia.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, client: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonSocialMedia not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'person_social_media_update_fetch',
          details: { personSocialMediaId: params?.id },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_person_social_media', req, {
      personSocialMediaId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedPersonSocialMedia = await prisma.personSocialMedia.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Attach display value
    const personSocialMediaWithDisplayValue = enrichRecordDisplayValues(
      updatedPersonSocialMedia,
      'PersonSocialMedia'
    );

    // Log database operation success
    logDatabaseSuccess('update_person_social_media', req, {
      id: updatedPersonSocialMedia.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updatePersonSocialMedia', req, {
      id: updatedPersonSocialMedia.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(personSocialMediaWithDisplayValue);
  } catch (error) {
    logOperationError('updatePersonSocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_person_social_media');
  }
}

async function deletePersonSocialMedia(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePersonSocialMedia', req, {
    user: user?.id,
    personSocialMediaId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_person_social_media', req, {
      personSocialMediaId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personSocialMedia.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_social_media', req, {
      deletedCount: result.count,
      personSocialMediaId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonSocialMedia not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_social_media',
          details: { personSocialMediaId: params?.id },
        }
      );
      logOperationError('deletePersonSocialMedia', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePersonSocialMedia', req, {
      deletedCount: result.count,
      personSocialMediaId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePersonSocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_person_social_media');
  }
}

async function getPersonSocialMediaBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personSocialMedia',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonSocialMedia,
  createPersonSocialMedia,
  getPersonSocialMedia,
  updatePersonSocialMedia,
  deletePersonSocialMedia,
  getPersonSocialMediaBarChartData,
};
