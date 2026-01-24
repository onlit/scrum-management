/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing company using Prisma.
 * It includes functions for retrieving all company, creating a new company, retrieving a single company,
 * updating an existing company, and deleting a company.
 *
 * The `getAllCompany` function retrieves a paginated list of company based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompany` function validates the request body using a Joi schema, generates a unique code
 * for the company, and creates a new company in the database with additional metadata.
 *
 * The `getCompany` function retrieves a single company based on the provided company ID, with visibility
 * filters applied to ensure the company is accessible to the requesting user.
 *
 * The `updateCompany` function updates an existing company in the database based on the provided company ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompany` function deletes a company from the database based on the provided company ID, with
 * visibility filters applied to ensure the company is deletable by the requesting user.
 *
 *
 */

const validator = require('validator');
const prisma = require('#configs/prisma.js');
const { companyCreate, companyUpdate } = require('#schemas/company.schemas.js');
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

async function getAllCompany(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCompany', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    // Base search fields (overridden for autocomplete behavior)
    let searchFields = [
      'staffUrl',
      'email',
      'website',
      'notes',
      'city',
      'state',
      'zip',
      'industry',
      'name',
      'color',
      'description',
      'companyIntelligence',
      'keywords',
      'contactUrl',
      'phone',
      'fax',
      'address1',
      'address2',
      'newsUrl',
    ];
    if (query?.autocomplete) {
      // Autocomplete mode: limit search fields to name for performance
      searchFields = ['name'];
    }
    const filterFields = [
      ...searchFields,
      'size',
      'branchOfId',
      'betaPartners',
      'ownerId',
      'countryId',
      'stateId',
      'cityId',
      'industryId',
    ];

    const include = {
      branchOf: true,
    };

    if (query?.includeCompanyContact) {
      include.companyCompanyContactCompany = {
        where: {
          deleted: null,
          person: {
            deleted: null,
          },
        },
        include: {
          person: true,
        },
      };
    }

    // Custom filters not covered by generic schema validation
    const customWhere = {};
    const andConditions = [];
    const notConditions = [];

    // company_contact_person: include companies where a contact with this person exists
    if (query?.company_contact_person) {
      const id = String(query.company_contact_person);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'company_contact_person'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_company',
            details: { company_contact_person: id },
          }
        );
        throw error;
      }
      andConditions.push({
        companyCompanyContactCompany: {
          some: {
            personId: id,
            deleted: null,
            person: { deleted: null },
          },
        },
      });
    }

    // exclude_company_contact_person: exclude companies where a contact with this person exists
    if (query?.exclude_company_contact_person) {
      const id = String(query.exclude_company_contact_person);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'exclude_company_contact_person'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_company',
            details: { exclude_company_contact_person: id },
          }
        );
        throw error;
      }
      notConditions.push({
        companyCompanyContactCompany: {
          some: {
            personId: id,
            deleted: null,
            person: { deleted: null },
          },
        },
      });
    }

    // territory: companies that are in a given territory
    if (query?.territory) {
      const id = String(query.territory);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'territory'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_company',
            details: { territory: id },
          }
        );
        throw error;
      }
      andConditions.push({
        companyCompanyInTerritoryCompany: {
          some: {
            deleted: null,
            territoryId: id,
          },
        },
      });
    }

    // sales_person: companies whose territory has an owner matching the sales person
    if (query?.sales_person) {
      const id = String(query.sales_person);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'sales_person'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_company',
            details: { sales_person: id },
          }
        );
        throw error;
      }
      andConditions.push({
        companyCompanyInTerritoryCompany: {
          some: {
            deleted: null,
            territory: {
              deleted: null,
              territoryTerritoryOwnerTerritory: {
                some: { deleted: null, salesPersonId: id },
              },
            },
          },
        },
      });
    }

    // without_company_office: accepted but no-op (no office model)
    // if (query?.without_company_office) { /* intentionally ignored */ }

    if (andConditions.length) {
      customWhere.AND = andConditions;
    }
    if (notConditions.length) {
      customWhere.NOT = notConditions;
    }

    // Log database operation start with detailed query/debug info
    logDatabaseStart('get_all_company', req, {
      userId: user?.id,
      query: {
        search: query?.search,
        autocomplete: query?.autocomplete,
        page: query?.page,
        pageSize: query?.pageSize,
        page_size: query?.page_size,
        ordering: query?.ordering,
      },
      searchFields,
      filterFields,
      customWhereSummary: {
        andCount: Array.isArray(andConditions) ? andConditions.length : 0,
        notCount: Array.isArray(notConditions) ? notConditions.length : 0,
      },
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: companyUpdate,
      filterFields,
      searchFields,
      model: 'company',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values to all companies
    if (response?.results) {
      response.results = response.results.map((company) =>
        enrichRecordDisplayValues(company, 'Company')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_company', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCompany', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCompany', req, error);
    throw handleDatabaseError(error, 'get_all_company');
  }
}

async function createCompany(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCompany', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCompany', req, error);
        throw handleValidationError(error, 'company_creation');
      }
      logOperationError('createCompany', req, error);
      throw error;
    }

    const modelRelationFields = ['branchOfId'];

    const include = {
      branchOf: true,
    };

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.branchOfId
          ? { model: 'company', fieldValues: { branchOfId: values.branchOfId } }
          : null,
      ].filter(Boolean),
    });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Prevent duplicate company name within the same client (soft-delete aware)
    const existing = await prisma.company.findFirst({
      where: { name: values.name, client: user?.client?.id, deleted: null },
      select: { id: true },
    });
    if (existing) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'A company with this name already exists for your account.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'company_creation',
          details: { name: values.name },
        }
      );
      throw error;
    }
    // Optional cross-tenant safety (matches legacy behavior): prevent duplicates globally when active
    const globalDuplicate = await prisma.company.findFirst({
      where: { name: values.name, deleted: null },
      select: { id: true },
    });
    if (globalDuplicate) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'A company with this name already exists.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'company_creation',
          details: { name: values.name },
        }
      );
      throw error;
    }

    // Log database operation start
    logDatabaseStart('create_company', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompany = await prisma.company.create({
      data: {
        ...buildCreateRecordPayload({
          user,
          validatedValues: values,
          requestBody: body,
          relations: modelRelationFields,
        }),
        // Default owner to current user
        ownerId: user?.id,
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company', req, {
      id: newCompany.id,
      code: newCompany.code,
    });

    const [newCompanyWithDetails] = await getDetailsFromAPI({
      results: [newCompany],
      token: user?.accessToken,
    });

    // Attach display value
    const companyWithDisplayValue = enrichRecordDisplayValues(
      newCompanyWithDetails,
      'Company'
    );

    // Fire-and-forget create-time workflow trigger
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newCompany,
          'company',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();

    // Log operation success
    logOperationSuccess('createCompany', req, {
      id: newCompany.id,
      code: newCompany.code,
    });

    res.status(201).json(companyWithDisplayValue);
  } catch (error) {
    logOperationError('createCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_company');
  }
}

async function getCompany(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCompany', req, {
    user: user?.id,
    companyId: params?.id,
  });

  try {
    const include = {
      branchOf: true,
    };

    // Log database operation start
    logDatabaseStart('get_company', req, {
      companyId: params?.id,
      userId: user?.id,
    });

    const foundCompany = await prisma.company.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company', req, {
      found: !!foundCompany,
      companyId: params?.id,
    });

    if (!foundCompany) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Company not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company',
          details: { companyId: params?.id },
        }
      );
      logOperationError('getCompany', req, error);
      throw error;
    }

    const [foundCompanyWithDetails] = await getDetailsFromAPI({
      results: [foundCompany],
      token: user?.accessToken,
    });

    // Include aggregated contact emails on detail
    const contactEmails = await prisma.companyContact.findMany({
      where: {
        companyId: params?.id,
        deleted: null,
        workEmail: { not: null },
        // Exclude empty string emails at DB level where supported by Prisma
        NOT: [{ workEmail: '' }],
        ...getVisibilityFilters(user),
      },
      select: { workEmail: true },
    });
    const allEmails = Array.from(
      new Set((contactEmails || []).map((c) => c.workEmail.trim()))
    );
    const enriched = enrichRecordDisplayValues(
      {
        ...foundCompanyWithDetails,
        allEmails,
      },
      'Company'
    );

    // Log operation success
    logOperationSuccess('getCompany', req, {
      id: foundCompany.id,
      code: foundCompany.code,
    });

    res.status(200).json(enriched);
  } catch (error) {
    logOperationError('getCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_company');
  }
}

async function updateCompany(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCompany', req, {
    companyId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCompany', req, error);
        throw handleValidationError(error, 'company_update');
      }
      logOperationError('updateCompany', req, error);
      throw error;
    }

    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.branchOfId
          ? { model: 'company', fieldValues: { branchOfId: values.branchOfId } }
          : null,
      ].filter(Boolean),
    });

    // Log database operation start
    logDatabaseStart('update_company', req, {
      companyId: params?.id,
      updateFields: Object.keys(values),
    });

    // Enforce duplicate name rules on update
    if (values?.name) {
      const existingSameClient = await prisma.company.findFirst({
        where: {
          id: { not: params?.id },
          name: values.name,
          client: user?.client?.id,
          deleted: null,
        },
        select: { id: true },
      });
      if (existingSameClient) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A company with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'company_update',
            details: { name: values.name },
          }
        );
        throw error;
      }
      const existingGlobal = await prisma.company.findFirst({
        where: {
          id: { not: params?.id },
          name: values.name,
          deleted: null,
        },
        select: { id: true },
      });
      if (existingGlobal) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A company with this name already exists.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'company_update',
            details: { name: values.name },
          }
        );
        throw error;
      }
    }

    // Apply visibility to update to match object-level permissions
    const updateResult = await prisma.company.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Company not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company',
          details: { companyId: params?.id },
        }
      );
      logOperationError('updateCompany', req, error);
      throw error;
    }

    // Fetch the updated record for response
    const updatedCompany = await prisma.company.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Log database operation success
    logDatabaseSuccess('update_company', req, {
      id: updatedCompany.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCompany', req, {
      id: updatedCompany.id,
      updatedFields: Object.keys(values),
    });

    const [updatedCompanyWithDetails] = await getDetailsFromAPI({
      results: [updatedCompany],
      token: user?.accessToken,
    });

    const companyWithDisplayValue = enrichRecordDisplayValues(
      updatedCompanyWithDetails,
      'Company'
    );

    res.status(200).json(companyWithDisplayValue);
  } catch (error) {
    logOperationError('updateCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_company');
  }
}

async function deleteCompany(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCompany', req, {
    user: user?.id,
    companyId: params?.id,
  });

  try {
    await prisma.companyContact.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.accountManagerInCompany.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.companySocialMedia.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.company.updateMany({
      where: { branchOfId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.companyHistory.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.person.updateMany({
      where: { companyOwnerId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.companyInTerritory.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.companySpin.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: { companyId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_company', req, {
      companyId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.company.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company', req, {
      deletedCount: result.count,
      companyId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Company not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company',
          details: { companyId: params?.id },
        }
      );
      logOperationError('deleteCompany', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCompany', req, {
      deletedCount: result.count,
      companyId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCompany', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_company');
  }
}

async function getCompanyBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for company',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompany,
  createCompany,
  getCompany,
  updateCompany,
  deleteCompany,
  getCompanyBarChartData,
};
