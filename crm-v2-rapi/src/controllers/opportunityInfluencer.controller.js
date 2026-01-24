/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunityInfluencer using Prisma.
 * It includes functions for retrieving all opportunityInfluencer, creating a new opportunityInfluencer, retrieving a single opportunityInfluencer,
 * updating an existing opportunityInfluencer, and deleting a opportunityInfluencer.
 *
 * The `getAllOpportunityInfluencer` function retrieves a paginated list of opportunityInfluencer based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunityInfluencer` function validates the request body using a Joi schema, generates a unique code
 * for the opportunityInfluencer, and creates a new opportunityInfluencer in the database with additional metadata.
 *
 * The `getOpportunityInfluencer` function retrieves a single opportunityInfluencer based on the provided opportunityInfluencer ID, with visibility
 * filters applied to ensure the opportunityInfluencer is accessible to the requesting user.
 *
 * The `updateOpportunityInfluencer` function updates an existing opportunityInfluencer in the database based on the provided opportunityInfluencer ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunityInfluencer` function deletes a opportunityInfluencer from the database based on the provided opportunityInfluencer ID, with
 * visibility filters applied to ensure the opportunityInfluencer is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const validator = require('validator');
const {
  opportunityInfluencerCreate,
  opportunityInfluencerUpdate,
} = require('#schemas/opportunityInfluencer.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  verifyForeignKeyAccessBatch,
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

async function getAllOpportunityInfluencer(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllOpportunityInfluencer', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['role', 'desireForSelf', 'color', 'desireForCompany'];
    const filterFields = [
      ...searchFields,
      'rating',
      'companyContactId',
      'opportunityId',
    ];

    const include = {
      companyContact: { include: { person: true } },
      opportunity: true,
    };

    // Enhance search: allow searching by related CompanyContact -> Person fields
    // and avoid FTS path which cannot include relation fields
    const trimmedSearch =
      typeof query?.search === 'string' ? query.search.trim() : '';
    const hasRelationalSearch = !!trimmedSearch;
    const customWhere = hasRelationalSearch
      ? {
          OR: [
            // Existing scalar fields on influencer (preserve legacy expectations)
            { role: { contains: trimmedSearch, mode: 'insensitive' } },
            { desireForSelf: { contains: trimmedSearch, mode: 'insensitive' } },
            { color: { contains: trimmedSearch, mode: 'insensitive' } },
            {
              desireForCompany: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
            // Relational: CompanyContact -> Person fields
            {
              companyContact: {
                person: {
                  firstName: { contains: trimmedSearch, mode: 'insensitive' },
                },
              },
            },
            {
              companyContact: {
                person: {
                  lastName: { contains: trimmedSearch, mode: 'insensitive' },
                },
              },
            },
            {
              companyContact: {
                person: {
                  email: { contains: trimmedSearch, mode: 'insensitive' },
                },
              },
            },
          ],
        }
      : {};
    // When we apply custom relational search, blank out the built-in search to avoid FTS path
    const paginatedQuery = hasRelationalSearch
      ? { ...query, search: '' }
      : query;

    // Log database operation start
    logDatabaseStart('get_all_opportunity_influencer', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query: paginatedQuery,
      user,
      prisma,
      schema: opportunityInfluencerUpdate,
      filterFields,
      searchFields: hasRelationalSearch ? [] : searchFields,
      model: 'opportunityInfluencer',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values to all opportunity influencer records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'OpportunityInfluencer')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity_influencer', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllOpportunityInfluencer', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllOpportunityInfluencer', req, error);
    throw handleDatabaseError(error, 'get_all_opportunity_influencer');
  }
}

async function createOpportunityInfluencer(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createOpportunityInfluencer', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityInfluencerCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createOpportunityInfluencer', req, error);
        throw handleValidationError(error, 'opportunity_influencer_creation');
      }
      logOperationError('createOpportunityInfluencer', req, error);
      throw error;
    }

    const modelRelationFields = ['companyContactId', 'opportunityId'];

    const include = {
      companyContact: { include: { person: true } },
      opportunity: true,
    };

    // Verify FK access (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.companyContactId
          ? {
              model: 'companyContact',
              fieldValues: { companyContactId: values.companyContactId },
            }
          : null,
        values?.opportunityId
          ? {
              model: 'opportunity',
              fieldValues: { opportunityId: values.opportunityId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness (soft-delete aware): prevent duplicate (opportunityId, companyContactId)
    // Only enforce when opportunityId is provided
    if (values?.opportunityId && values?.companyContactId) {
      const duplicate = await prisma.opportunityInfluencer.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          opportunityId: values.opportunityId,
          companyContactId: values.companyContactId,
        },
        select: { id: true },
      });
      if (duplicate) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'This contact is already an influencer on the selected opportunity.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_influencer_creation_uniqueness',
            details: {
              opportunityId: values?.opportunityId,
              companyContactId: values?.companyContactId,
            },
          }
        );
        throw error;
      }
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_opportunity_influencer', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunityInfluencer = await prisma.opportunityInfluencer.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity_influencer', req, {
      id: newOpportunityInfluencer.id,
      code: newOpportunityInfluencer.code,
    });

    const [newOpportunityInfluencerWithDetails] = await getDetailsFromAPI({
      results: [newOpportunityInfluencer],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const opportunityInfluencerWithDisplayValue = enrichRecordDisplayValues(
      newOpportunityInfluencerWithDetails,
      'OpportunityInfluencer'
    );

    // Log operation success
    logOperationSuccess('createOpportunityInfluencer', req, {
      id: newOpportunityInfluencer.id,
      code: newOpportunityInfluencer.code,
    });

    res.status(201).json(opportunityInfluencerWithDisplayValue);

    // No workflow triggers for this resource (Django parity)
  } catch (error) {
    logOperationError('createOpportunityInfluencer', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_opportunity_influencer');
  }
}

async function getOpportunityInfluencer(req, res) {
  const { params, user } = req;
  if (!validator.isUUID(String(params?.id || ''))) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'Invalid OpportunityInfluencer ID. Expected a UUID.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'get_opportunity_influencer',
        details: { id: params?.id },
      }
    );
    throw error;
  }

  // Log operation start
  logOperationStart('getOpportunityInfluencer', req, {
    user: user?.id,
    opportunityInfluencerId: params?.id,
  });

  try {
    const include = {
      companyContact: { include: { person: true } },
      opportunity: true,
    };

    // Log database operation start
    logDatabaseStart('get_opportunity_influencer', req, {
      opportunityInfluencerId: params?.id,
      userId: user?.id,
    });

    const foundOpportunityInfluencer =
      await prisma.opportunityInfluencer.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_opportunity_influencer', req, {
      found: !!foundOpportunityInfluencer,
      opportunityInfluencerId: params?.id,
    });

    if (!foundOpportunityInfluencer) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_influencer',
          details: { opportunityInfluencerId: params?.id },
        }
      );
      logOperationError('getOpportunityInfluencer', req, error);
      throw error;
    }

    const [foundOpportunityInfluencerWithDetails] = await getDetailsFromAPI({
      results: [foundOpportunityInfluencer],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const opportunityInfluencerWithDisplayValue = enrichRecordDisplayValues(
      foundOpportunityInfluencerWithDetails,
      'OpportunityInfluencer'
    );

    // Log operation success
    logOperationSuccess('getOpportunityInfluencer', req, {
      id: foundOpportunityInfluencer.id,
      code: foundOpportunityInfluencer.code,
    });

    res.status(200).json(opportunityInfluencerWithDisplayValue);
  } catch (error) {
    logOperationError('getOpportunityInfluencer', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_opportunity_influencer');
  }
}

async function updateOpportunityInfluencer(req, res) {
  const { params, body, user } = req;
  if (!validator.isUUID(String(params?.id || ''))) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'Invalid OpportunityInfluencer ID. Expected a UUID.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'update_opportunity_influencer',
        details: { id: params?.id },
      }
    );
    throw error;
  }

  // Log operation start
  logOperationStart('updateOpportunityInfluencer', req, {
    opportunityInfluencerId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityInfluencerUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateOpportunityInfluencer', req, error);
        throw handleValidationError(error, 'opportunity_influencer_update');
      }
      logOperationError('updateOpportunityInfluencer', req, error);
      throw error;
    }

    // Verify FK access for any provided FKs (companyContactId/opportunityId)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.companyContactId
          ? {
              model: 'companyContact',
              fieldValues: { companyContactId: values.companyContactId },
            }
          : null,
        values?.opportunityId
          ? {
              model: 'opportunity',
              fieldValues: { opportunityId: values.opportunityId },
            }
          : null,
      ].filter(Boolean),
    });

    // Fetch current to ensure visibility and compute effective next values
    const current = await prisma.opportunityInfluencer.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        client: true,
        opportunityId: true,
        companyContactId: true,
      },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'opportunity_influencer_update_fetch',
          details: { opportunityInfluencerId: params?.id },
        }
      );
      throw error;
    }

    // Uniqueness checks for composite (opportunityId, companyContactId)
    const effOpportunityId = values?.opportunityId ?? current.opportunityId;
    const effCompanyContactId =
      values?.companyContactId ?? current.companyContactId;
    if (effOpportunityId && effCompanyContactId) {
      const duplicate = await prisma.opportunityInfluencer.findFirst({
        where: {
          id: { not: params?.id },
          client: user?.client?.id || current.client,
          deleted: null,
          opportunityId: effOpportunityId,
          companyContactId: effCompanyContactId,
        },
        select: { id: true },
      });
      if (duplicate) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'This contact is already an influencer on the selected opportunity.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_influencer_update_uniqueness',
            details: {
              opportunityId: effOpportunityId,
              companyContactId: effCompanyContactId,
            },
          }
        );
        throw error;
      }
    }

    // Guard: ensure record still visible right before update
    const stillVisible = await prisma.opportunityInfluencer.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!stillVisible) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'opportunity_influencer_update_guard',
          details: { opportunityInfluencerId: params?.id },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_opportunity_influencer', req, {
      opportunityInfluencerId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedOpportunityInfluencer =
      await prisma.opportunityInfluencer.update({
        where: { id: params?.id },
        data: {
          ...objectKeysToCamelCase(values),
          updatedBy: user?.id,
        },
      });

    // Attach display value (including nested relations)
    const opportunityInfluencerWithDisplayValue = enrichRecordDisplayValues(
      updatedOpportunityInfluencer,
      'OpportunityInfluencer'
    );

    // Log database operation success
    logDatabaseSuccess('update_opportunity_influencer', req, {
      id: updatedOpportunityInfluencer.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateOpportunityInfluencer', req, {
      id: updatedOpportunityInfluencer.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(opportunityInfluencerWithDisplayValue);
  } catch (error) {
    logOperationError('updateOpportunityInfluencer', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_opportunity_influencer');
  }
}

async function deleteOpportunityInfluencer(req, res) {
  const { params, user } = req;
  if (!validator.isUUID(String(params?.id || ''))) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'Invalid OpportunityInfluencer ID. Expected a UUID.',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'delete_opportunity_influencer',
        details: { id: params?.id },
      }
    );
    throw error;
  }

  // Log operation start
  logOperationStart('deleteOpportunityInfluencer', req, {
    user: user?.id,
    opportunityInfluencerId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_opportunity_influencer', req, {
      opportunityInfluencerId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunityInfluencer.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity_influencer', req, {
      deletedCount: result.count,
      opportunityInfluencerId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'OpportunityInfluencer not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity_influencer',
          details: { opportunityInfluencerId: params?.id },
        }
      );
      logOperationError('deleteOpportunityInfluencer', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteOpportunityInfluencer', req, {
      deletedCount: result.count,
      opportunityInfluencerId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteOpportunityInfluencer', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_opportunity_influencer');
  }
}

async function getOpportunityInfluencerBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunityInfluencer',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunityInfluencer,
  createOpportunityInfluencer,
  getOpportunityInfluencer,
  updateOpportunityInfluencer,
  deleteOpportunityInfluencer,
  getOpportunityInfluencerBarChartData,
};
