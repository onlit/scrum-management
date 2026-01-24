/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companySocialMedia using Prisma.
 * It includes functions for retrieving all companySocialMedia, creating a new companySocialMedia, retrieving a single companySocialMedia,
 * updating an existing companySocialMedia, and deleting a companySocialMedia.
 *
 * The `getAllCompanySocialMedia` function retrieves a paginated list of companySocialMedia based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanySocialMedia` function validates the request body using a Joi schema, generates a unique code
 * for the companySocialMedia, and creates a new companySocialMedia in the database with additional metadata.
 *
 * The `getCompanySocialMedia` function retrieves a single companySocialMedia based on the provided companySocialMedia ID, with visibility
 * filters applied to ensure the companySocialMedia is accessible to the requesting user.
 *
 * The `updateCompanySocialMedia` function updates an existing companySocialMedia in the database based on the provided companySocialMedia ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanySocialMedia` function deletes a companySocialMedia from the database based on the provided companySocialMedia ID, with
 * visibility filters applied to ensure the companySocialMedia is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  companySocialMediaCreate,
  companySocialMediaUpdate,
} = require('#schemas/companySocialMedia.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
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

async function getAllCompanySocialMedia(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCompanySocialMedia', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color', 'url'];
    const filterFields = [...searchFields, 'companyId', 'socialMediaId'];

    const include = {
      company: true,
      socialMedia: true,
    };

    // Relational search support: company name and social media type name
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { company: { name: { contains: rawSearch, mode: 'insensitive' } } },
          {
            socialMedia: { name: { contains: rawSearch, mode: 'insensitive' } },
          },
        ],
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_company_social_media', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: companySocialMediaUpdate,
      filterFields,
      searchFields,
      model: 'companySocialMedia',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations)
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'CompanySocialMedia')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_company_social_media', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCompanySocialMedia', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCompanySocialMedia', req, error);
    throw handleDatabaseError(error, 'get_all_company_social_media');
  }
}

async function createCompanySocialMedia(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCompanySocialMedia', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companySocialMediaCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCompanySocialMedia', req, error);
        throw handleValidationError(error, 'company_social_media_creation');
      }
      logOperationError('createCompanySocialMedia', req, error);
      throw error;
    }

    const modelRelationFields = ['companyId', 'socialMediaId'];

    const include = {
      company: true,
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
    logDatabaseStart('create_company_social_media', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanySocialMedia = await prisma.companySocialMedia.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_social_media', req, {
      id: newCompanySocialMedia.id,
      code: newCompanySocialMedia.code,
    });

    const [newCompanySocialMediaWithDetails] = await getDetailsFromAPI({
      results: [newCompanySocialMedia],
      token: user?.accessToken,
    });

    // Attach display value
    const companySocialMediaWithDisplayValue = enrichRecordDisplayValues(
      newCompanySocialMediaWithDetails,
      'CompanySocialMedia'
    );

    // Log operation success
    logOperationSuccess('createCompanySocialMedia', req, {
      id: newCompanySocialMedia.id,
      code: newCompanySocialMedia.code,
    });

    res.status(201).json(companySocialMediaWithDisplayValue);
  } catch (error) {
    logOperationError('createCompanySocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_company_social_media');
  }
}

async function getCompanySocialMedia(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCompanySocialMedia', req, {
    user: user?.id,
    companySocialMediaId: params?.id,
  });

  try {
    const include = {
      company: true,
      socialMedia: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_social_media', req, {
      companySocialMediaId: params?.id,
      userId: user?.id,
    });

    const foundCompanySocialMedia = await prisma.companySocialMedia.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_social_media', req, {
      found: !!foundCompanySocialMedia,
      companySocialMediaId: params?.id,
    });

    if (!foundCompanySocialMedia) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySocialMedia not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_social_media',
          details: { companySocialMediaId: params?.id },
        }
      );
      logOperationError('getCompanySocialMedia', req, error);
      throw error;
    }

    const [foundCompanySocialMediaWithDetails] = await getDetailsFromAPI({
      results: [foundCompanySocialMedia],
      token: user?.accessToken,
    });

    // Attach display value
    const companySocialMediaWithDisplayValue = enrichRecordDisplayValues(
      foundCompanySocialMediaWithDetails,
      'CompanySocialMedia'
    );

    // Log operation success
    logOperationSuccess('getCompanySocialMedia', req, {
      id: foundCompanySocialMedia.id,
      code: foundCompanySocialMedia.code,
    });

    res.status(200).json(companySocialMediaWithDisplayValue);
  } catch (error) {
    logOperationError('getCompanySocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_company_social_media');
  }
}

async function updateCompanySocialMedia(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCompanySocialMedia', req, {
    companySocialMediaId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companySocialMediaUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCompanySocialMedia', req, error);
        throw handleValidationError(error, 'company_social_media_update');
      }
      logOperationError('updateCompanySocialMedia', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Guard: ensure visibility before update
    const current = await prisma.companySocialMedia.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySocialMedia not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_social_media',
          details: { companySocialMediaId: params?.id },
        }
      );
      logOperationError('updateCompanySocialMedia', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_company_social_media', req, {
      companySocialMediaId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedCompanySocialMedia = await prisma.companySocialMedia.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_company_social_media', req, {
      id: updatedCompanySocialMedia.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const companySocialMediaWithDisplayValue = enrichRecordDisplayValues(
      updatedCompanySocialMedia,
      'CompanySocialMedia'
    );

    // Log operation success
    logOperationSuccess('updateCompanySocialMedia', req, {
      id: updatedCompanySocialMedia.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(companySocialMediaWithDisplayValue);
  } catch (error) {
    logOperationError('updateCompanySocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_company_social_media');
  }
}

async function deleteCompanySocialMedia(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCompanySocialMedia', req, {
    user: user?.id,
    companySocialMediaId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_company_social_media', req, {
      companySocialMediaId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companySocialMedia.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_social_media', req, {
      deletedCount: result.count,
      companySocialMediaId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanySocialMedia not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_social_media',
          details: { companySocialMediaId: params?.id },
        }
      );
      logOperationError('deleteCompanySocialMedia', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCompanySocialMedia', req, {
      deletedCount: result.count,
      companySocialMediaId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCompanySocialMedia', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_company_social_media');
  }
}

async function getCompanySocialMediaBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companySocialMedia',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanySocialMedia,
  createCompanySocialMedia,
  getCompanySocialMedia,
  updateCompanySocialMedia,
  deleteCompanySocialMedia,
  getCompanySocialMediaBarChartData,
};
