/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing socialMediaType using Prisma.
 * It includes functions for retrieving all socialMediaType, creating a new socialMediaType, retrieving a single socialMediaType,
 * updating an existing socialMediaType, and deleting a socialMediaType.
 *
 * The `getAllSocialMediaType` function retrieves a paginated list of socialMediaType based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createSocialMediaType` function validates the request body using a Joi schema, generates a unique code
 * for the socialMediaType, and creates a new socialMediaType in the database with additional metadata.
 *
 * The `getSocialMediaType` function retrieves a single socialMediaType based on the provided socialMediaType ID, with visibility
 * filters applied to ensure the socialMediaType is accessible to the requesting user.
 *
 * The `updateSocialMediaType` function updates an existing socialMediaType in the database based on the provided socialMediaType ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteSocialMediaType` function deletes a socialMediaType from the database based on the provided socialMediaType ID, with
 * visibility filters applied to ensure the socialMediaType is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  socialMediaTypeCreate,
  socialMediaTypeUpdate,
} = require('#schemas/socialMediaType.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
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
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllSocialMediaType(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllSocialMediaType', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['name', 'color', 'description'];
    const filterFields = [...searchFields];

    const include = {};

    // Log database operation start
    logDatabaseStart('get_all_social_media_type', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: socialMediaTypeUpdate,
      filterFields,
      searchFields,
      model: 'socialMediaType',
      include: Object.keys(include).length ? include : undefined,
    });

    // Attach display values to all social media types
    if (response?.results) {
      response.results = response.results.map((socialMediaType) => ({
        ...socialMediaType,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(
          socialMediaType,
          'SocialMediaType'
        ),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_social_media_type', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllSocialMediaType', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllSocialMediaType', req, error);
    throw handleDatabaseError(error, 'get_all_social_media_type');
  }
}

async function createSocialMediaType(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createSocialMediaType', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await socialMediaTypeCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createSocialMediaType', req, error);
        throw handleValidationError(error, 'social_media_type_creation');
      }
      logOperationError('createSocialMediaType', req, error);
      throw error;
    }

    const modelRelationFields = [];

    const include = {};

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_social_media_type', req, {
      name: values.name,
      userId: user?.id,
    });

    const newSocialMediaType = await prisma.socialMediaType.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_social_media_type', req, {
      id: newSocialMediaType.id,
      code: newSocialMediaType.code,
    });

    const [newSocialMediaTypeWithDetails] = await getDetailsFromAPI({
      results: [newSocialMediaType],
      token: user?.accessToken,
    });

    // Attach display value
    const socialMediaTypeWithDisplayValue = {
      ...newSocialMediaTypeWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newSocialMediaTypeWithDetails,
        'SocialMediaType'
      ),
    };

    // Log operation success
    logOperationSuccess('createSocialMediaType', req, {
      id: newSocialMediaType.id,
      code: newSocialMediaType.code,
    });

    res.status(201).json(socialMediaTypeWithDisplayValue);
  } catch (error) {
    logOperationError('createSocialMediaType', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_social_media_type');
  }
}

async function getSocialMediaType(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getSocialMediaType', req, {
    user: user?.id,
    socialMediaTypeId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_social_media_type', req, {
      socialMediaTypeId: params?.id,
      userId: user?.id,
    });

    const foundSocialMediaType = await prisma.socialMediaType.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_social_media_type', req, {
      found: !!foundSocialMediaType,
      socialMediaTypeId: params?.id,
    });

    if (!foundSocialMediaType) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SocialMediaType not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_social_media_type',
          details: { socialMediaTypeId: params?.id },
        }
      );
      logOperationError('getSocialMediaType', req, error);
      throw error;
    }

    const [foundSocialMediaTypeWithDetails] = await getDetailsFromAPI({
      results: [foundSocialMediaType],
      token: user?.accessToken,
    });

    // Attach display value
    const socialMediaTypeWithDisplayValue = {
      ...foundSocialMediaTypeWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundSocialMediaTypeWithDetails,
        'SocialMediaType'
      ),
    };

    // Log operation success
    logOperationSuccess('getSocialMediaType', req, {
      id: foundSocialMediaType.id,
      code: foundSocialMediaType.code,
    });

    res.status(200).json(socialMediaTypeWithDisplayValue);
  } catch (error) {
    logOperationError('getSocialMediaType', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_social_media_type');
  }
}

async function updateSocialMediaType(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateSocialMediaType', req, {
    socialMediaTypeId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await socialMediaTypeUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateSocialMediaType', req, error);
        throw handleValidationError(error, 'social_media_type_update');
      }
      logOperationError('updateSocialMediaType', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Log database operation start
    logDatabaseStart('update_social_media_type', req, {
      socialMediaTypeId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope
    const currentSocialMediaType = await prisma.socialMediaType.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!currentSocialMediaType) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SocialMediaType not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_social_media_type',
          details: { socialMediaTypeId: params?.id },
        }
      );
      logOperationError('updateSocialMediaType', req, error);
      throw error;
    }

    const updatedSocialMediaType = await prisma.socialMediaType.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Attach display value
    const socialMediaTypeWithDisplayValue = {
      ...updatedSocialMediaType,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        updatedSocialMediaType,
        'SocialMediaType'
      ),
    };

    // Log database operation success
    logDatabaseSuccess('update_social_media_type', req, {
      id: updatedSocialMediaType.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateSocialMediaType', req, {
      id: updatedSocialMediaType.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(socialMediaTypeWithDisplayValue);
  } catch (error) {
    logOperationError('updateSocialMediaType', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_social_media_type');
  }
}

async function deleteSocialMediaType(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteSocialMediaType', req, {
    user: user?.id,
    socialMediaTypeId: params?.id,
  });

  try {
    await prisma.companySocialMedia.updateMany({
      where: {
        socialMediaId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.personSocialMedia.updateMany({
      where: {
        socialMediaId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_social_media_type', req, {
      socialMediaTypeId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.socialMediaType.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_social_media_type', req, {
      deletedCount: result.count,
      socialMediaTypeId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'SocialMediaType not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_social_media_type',
          details: { socialMediaTypeId: params?.id },
        }
      );
      logOperationError('deleteSocialMediaType', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteSocialMediaType', req, {
      deletedCount: result.count,
      socialMediaTypeId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteSocialMediaType', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_social_media_type');
  }
}

async function getSocialMediaTypeBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for socialMediaType',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllSocialMediaType,
  createSocialMediaType,
  getSocialMediaType,
  updateSocialMediaType,
  deleteSocialMediaType,
  getSocialMediaTypeBarChartData,
};
