/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companyInTerritory using Prisma.
 * It includes functions for retrieving all companyInTerritory, creating a new companyInTerritory, retrieving a single companyInTerritory,
 * updating an existing companyInTerritory, and deleting a companyInTerritory.
 *
 * The `getAllCompanyInTerritory` function retrieves a paginated list of companyInTerritory based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanyInTerritory` function validates the request body using a Joi schema, generates a unique code
 * for the companyInTerritory, and creates a new companyInTerritory in the database with additional metadata.
 *
 * The `getCompanyInTerritory` function retrieves a single companyInTerritory based on the provided companyInTerritory ID, with visibility
 * filters applied to ensure the companyInTerritory is accessible to the requesting user.
 *
 * The `updateCompanyInTerritory` function updates an existing companyInTerritory in the database based on the provided companyInTerritory ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanyInTerritory` function deletes a companyInTerritory from the database based on the provided companyInTerritory ID, with
 * visibility filters applied to ensure the companyInTerritory is deletable by the requesting user.
 *
 *
 */

const validator = require('validator');
const prisma = require('#configs/prisma.js');
const {
  companyInTerritoryCreate,
  companyInTerritoryUpdate,
} = require('#schemas/companyInTerritory.schemas.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllCompanyInTerritory(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCompanyInTerritory', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [
      ...searchFields,
      'companyId',
      'expiryDate',
      'territoryId',
    ];

    const include = {
      company: true,
      territory: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_company_in_territory', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    // Build customWhere for relational search
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { company: { name: { contains: rawSearch, mode: 'insensitive' } } },
          { territory: { name: { contains: rawSearch, mode: 'insensitive' } } },
        ],
      };
    }

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: companyInTerritoryUpdate,
      filterFields,
      searchFields,
      model: 'companyInTerritory',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations)
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'CompanyInTerritory')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_company_in_territory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCompanyInTerritory', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCompanyInTerritory', req, error);
    throw handleDatabaseError(error, 'get_all_company_in_territory');
  }
}

async function createCompanyInTerritory(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCompanyInTerritory', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyInTerritoryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCompanyInTerritory', req, error);
        throw handleValidationError(error, 'company_in_territory_creation');
      }
      logOperationError('createCompanyInTerritory', req, error);
      throw error;
    }

    const modelRelationFields = ['companyId', 'territoryId'];

    const include = {
      company: true,
      territory: true,
    };

    // Verify FK access
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'company', fieldValues: { companyId: values.companyId } },
        {
          model: 'territory',
          fieldValues: { territoryId: values.territoryId },
        },
      ],
    });

    // Enforce uniqueness: (companyId, territoryId) where expiryDate >= today or expiryDate is null; soft-delete aware
    // Mirrors Django logic: active overlap not allowed
    const today = new Date();
    const duplicate = await prisma.companyInTerritory.findFirst({
      where: {
        client: user?.client?.id,
        deleted: null,
        companyId: values.companyId,
        territoryId: values.territoryId,
        expiryDate: { gte: today },
      },
      select: { id: true },
    });
    if (duplicate) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Company territory must be unique (no overlapping active assignment).',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'company_in_territory_creation',
          details: {
            companyId: values.companyId,
            territoryId: values.territoryId,
          },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('create_company_in_territory', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanyInTerritory = await prisma.companyInTerritory.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_in_territory', req, {
      id: newCompanyInTerritory.id,
      code: newCompanyInTerritory.code,
    });

    const [newCompanyInTerritoryWithDetails] = await getDetailsFromAPI({
      results: [newCompanyInTerritory],
      token: user?.accessToken,
    });

    // Attach display value
    const companyInTerritoryWithDisplayValue = enrichRecordDisplayValues(
      newCompanyInTerritoryWithDetails,
      'CompanyInTerritory'
    );

    // Log operation success
    logOperationSuccess('createCompanyInTerritory', req, {
      id: newCompanyInTerritory.id,
      code: newCompanyInTerritory.code,
    });

    // Fire-and-forget create-time workflow trigger
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newCompanyInTerritory,
          'companyInTerritory',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow errors
      }
    })();

    res.status(201).json(companyInTerritoryWithDisplayValue);
  } catch (error) {
    logOperationError('createCompanyInTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_company_in_territory');
  }
}

async function getCompanyInTerritory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCompanyInTerritory', req, {
    user: user?.id,
    companyInTerritoryId: params?.id,
  });

  try {
    if (!validator.isUUID(String(params?.id || ''))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid CompanyInTerritory ID. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_in_territory',
          details: { id: params?.id },
        }
      );
      throw error;
    }
    const include = {
      company: true,
      territory: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_in_territory', req, {
      companyInTerritoryId: params?.id,
      userId: user?.id,
    });

    const foundCompanyInTerritory = await prisma.companyInTerritory.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_in_territory', req, {
      found: !!foundCompanyInTerritory,
      companyInTerritoryId: params?.id,
    });

    if (!foundCompanyInTerritory) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_in_territory',
          details: { companyInTerritoryId: params?.id },
        }
      );
      logOperationError('getCompanyInTerritory', req, error);
      throw error;
    }

    const [foundCompanyInTerritoryWithDetails] = await getDetailsFromAPI({
      results: [foundCompanyInTerritory],
      token: user?.accessToken,
    });

    // Attach display value
    const companyInTerritoryWithDisplayValue = enrichRecordDisplayValues(
      foundCompanyInTerritoryWithDetails,
      'CompanyInTerritory'
    );

    // Log operation success
    logOperationSuccess('getCompanyInTerritory', req, {
      id: foundCompanyInTerritory.id,
      code: foundCompanyInTerritory.code,
    });

    res.status(200).json(companyInTerritoryWithDisplayValue);
  } catch (error) {
    logOperationError('getCompanyInTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_company_in_territory');
  }
}

async function updateCompanyInTerritory(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCompanyInTerritory', req, {
    companyInTerritoryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    if (!validator.isUUID(String(params?.id || ''))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid CompanyInTerritory ID. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_in_territory',
          details: { id: params?.id },
        }
      );
      throw error;
    }
    // Validation with error handling
    let values;
    try {
      values = await companyInTerritoryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCompanyInTerritory', req, error);
        throw handleValidationError(error, 'company_in_territory_update');
      }
      logOperationError('updateCompanyInTerritory', req, error);
      throw error;
    }

    // Verify FK access if FKs are changing
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'company', fieldValues: { companyId: values.companyId } },
        {
          model: 'territory',
          fieldValues: { territoryId: values.territoryId },
        },
      ],
    });

    // Guard: ensure visibility before update
    const visibleNow = await prisma.companyInTerritory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!visibleNow) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_in_territory',
          details: { id: params?.id },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_company_in_territory', req, {
      companyInTerritoryId: params?.id,
      updateFields: Object.keys(values),
    });

    // Enforce uniqueness on update using effective values and Django overlap rules
    const existing = await prisma.companyInTerritory.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });
    if (!existing) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_in_territory',
          details: { id: params?.id },
        }
      );
      throw error;
    }

    const nextCompanyId = values.companyId ?? existing.companyId;
    const nextTerritoryId = values.territoryId ?? existing.territoryId;
    const nextExpiryDate = values.expiryDate ?? existing.expiryDate;

    // Find latest other record with same (company, territory) having non-null expiryDate
    const latestOther = await prisma.companyInTerritory.findFirst({
      where: {
        id: { not: params?.id },
        client: user?.client?.id,
        deleted: null,
        companyId: nextCompanyId,
        territoryId: nextTerritoryId,
        NOT: { expiryDate: null },
      },
      orderBy: { expiryDate: 'desc' },
      select: { id: true, expiryDate: true },
    });

    if (
      latestOther &&
      latestOther.expiryDate &&
      nextExpiryDate &&
      // If the other is still active (expiryDate > today), then require our expiryDate to be before it
      latestOther.expiryDate > new Date() &&
      nextExpiryDate >= latestOther.expiryDate
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Company territory must be unique (no overlapping active assignment).',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'company_in_territory_update',
          details: { companyId: nextCompanyId, territoryId: nextTerritoryId },
        }
      );
      throw error;
    }

    const updatedCompanyInTerritory = await prisma.companyInTerritory.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_company_in_territory', req, {
      id: updatedCompanyInTerritory.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value
    const companyInTerritoryWithDisplayValue = enrichRecordDisplayValues(
      updatedCompanyInTerritory,
      'CompanyInTerritory'
    );

    // Log operation success
    logOperationSuccess('updateCompanyInTerritory', req, {
      id: updatedCompanyInTerritory.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(companyInTerritoryWithDisplayValue);
  } catch (error) {
    logOperationError('updateCompanyInTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_company_in_territory');
  }
}

async function deleteCompanyInTerritory(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCompanyInTerritory', req, {
    user: user?.id,
    companyInTerritoryId: params?.id,
  });

  try {
    if (!validator.isUUID(String(params?.id || ''))) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid CompanyInTerritory ID. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_in_territory',
          details: { id: params?.id },
        }
      );
      throw error;
    }
    // Log database operation start
    logDatabaseStart('delete_company_in_territory', req, {
      companyInTerritoryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companyInTerritory.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_in_territory', req, {
      deletedCount: result.count,
      companyInTerritoryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyInTerritory not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_in_territory',
          details: { companyInTerritoryId: params?.id },
        }
      );
      logOperationError('deleteCompanyInTerritory', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCompanyInTerritory', req, {
      deletedCount: result.count,
      companyInTerritoryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCompanyInTerritory', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_company_in_territory');
  }
}

async function getCompanyInTerritoryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companyInTerritory',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanyInTerritory,
  createCompanyInTerritory,
  getCompanyInTerritory,
  updateCompanyInTerritory,
  deleteCompanyInTerritory,
  getCompanyInTerritoryBarChartData,
};
