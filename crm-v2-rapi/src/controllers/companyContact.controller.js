/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing companyContact using Prisma.
 * It includes functions for retrieving all companyContact, creating a new companyContact, retrieving a single companyContact,
 * updating an existing companyContact, and deleting a companyContact.
 *
 * The `getAllCompanyContact` function retrieves a paginated list of companyContact based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCompanyContact` function validates the request body using a Joi schema, generates a unique code
 * for the companyContact, and creates a new companyContact in the database with additional metadata.
 *
 * The `getCompanyContact` function retrieves a single companyContact based on the provided companyContact ID, with visibility
 * filters applied to ensure the companyContact is accessible to the requesting user.
 *
 * The `updateCompanyContact` function updates an existing companyContact in the database based on the provided companyContact ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCompanyContact` function deletes a companyContact from the database based on the provided companyContact ID, with
 * visibility filters applied to ensure the companyContact is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const _ = require('lodash');
const validator = require('validator');
const {
  companyContactCreate,
  companyContactUpdate,
} = require('#schemas/companyContact.schemas.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllCompanyContact(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCompanyContact', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'color',
      'workPhone',
      'jobTitle',
      'workMobile',
      'workEmail',
    ];
    const filterFields = [
      ...searchFields,
      'accounts',
      'personId',
      'companyId',
      'startDate',
      'endDate',
    ];

    const include = {
      person: true,
      company: true,
    };

    // Build customWhere to support relational search parity with Django
    let customWhere = {};
    const andConditions = [];
    const rawSearch = (query?.search || '').trim();
    const isAutocomplete = !!query?.autocomplete;
    if (rawSearch) {
      if (isAutocomplete) {
        customWhere = {
          OR: [
            { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
            {
              person: {
                firstName: { contains: rawSearch, mode: 'insensitive' },
              },
            },
            {
              person: {
                lastName: { contains: rawSearch, mode: 'insensitive' },
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
            { company: { name: { contains: rawSearch, mode: 'insensitive' } } },
          ],
        };
      }
    }

    // territory: contacts whose company is in the given territory
    if (query?.territory) {
      const id = String(query.territory);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'territory'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_company_contact',
            details: { territory: id },
          }
        );
        throw error;
      }
      andConditions.push({
        company: {
          companyCompanyInTerritoryCompany: {
            some: { deleted: null, territoryId: id },
          },
        },
      });
    }

    if (andConditions.length) customWhere.AND = andConditions;

    // Log database operation start
    logDatabaseStart('get_all_company_contact', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: companyContactUpdate,
      filterFields,
      searchFields,
      model: 'companyContact',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values
    if (response?.results) {
      response.results = response.results.map((companyContact) =>
        enrichRecordDisplayValues(companyContact, 'CompanyContact')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_company_contact', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCompanyContact', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCompanyContact', req, error);
    throw handleDatabaseError(error, 'get_all_company_contact');
  }
}

async function createCompanyContact(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCompanyContact', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyContactCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCompanyContact', req, error);
        throw handleValidationError(error, 'company_contact_creation');
      }
      logOperationError('createCompanyContact', req, error);
      throw error;
    }

    const modelRelationFields = ['personId', 'companyId'];

    const include = {
      person: true,
      company: true,
    };

    // Verify FK access for personId and companyId
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.companyId
          ? { model: 'company', fieldValues: { companyId: values.companyId } }
          : null,
      ].filter(Boolean),
    });
    // (Removed duplicate FK verification)

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Controller-level uniqueness checks (soft-delete aware)
    // 1) Prevent duplicate (companyId, personId) pair per client
    try {
      const personId = values?.personId || null;
      const companyId = values?.companyId || null;
      if (personId && companyId) {
        const existingPair = await prisma.companyContact.findFirst({
          where: {
            personId,
            companyId,
            client: user?.client?.id,
            deleted: null,
          },
          select: { id: true },
        });
        if (existingPair) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This person is already a contact for the selected company.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'company_contact_creation_duplicate_pair',
              details: { personId, companyId },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      // best-effort duplicate protection; proceed if check fails
    }

    // 2) Prevent duplicate workEmail within tenant (case-insensitive)
    try {
      const rawEmail = (values?.workEmail || '').trim();
      if (rawEmail && validator.isEmail(rawEmail)) {
        const email = rawEmail.toLowerCase();
        const existingEmail = await prisma.companyContact.findFirst({
          where: {
            client: user?.client?.id,
            workEmail: { equals: email, mode: 'insensitive' },
            deleted: null,
          },
          select: { id: true },
        });
        if (existingEmail) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A company contact with this work email already exists.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'company_contact_creation_duplicate_email',
              details: { workEmail: rawEmail },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      // swallow duplicate check errors to avoid hard failures
    }

    // Log database operation start
    logDatabaseStart('create_company_contact', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCompanyContact = await prisma.companyContact.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_company_contact', req, {
      id: newCompanyContact.id,
      code: newCompanyContact.code,
    });

    const [newCompanyContactWithDetails] = await getDetailsFromAPI({
      results: [newCompanyContact],
      token: user?.accessToken,
    });

    // Attach display value
    const companyContactWithDisplayValue = enrichRecordDisplayValues(
      newCompanyContactWithDetails,
      'CompanyContact'
    );

    // Log operation success
    logOperationSuccess('createCompanyContact', req, {
      id: newCompanyContact.id,
      code: newCompanyContact.code,
    });

    res.status(201).json(companyContactWithDisplayValue);

    // Fire-and-forget create-time workflow trigger AFTER response for lower latency
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newCompanyContact,
          'companyContact',
          user?.client?.id,
          {
            company_name: newCompanyContact?.company?.name,
            company_website: newCompanyContact?.company?.website,
            person_first_name: newCompanyContact?.person?.firstName,
            person_last_name: newCompanyContact?.person?.lastName,
          },
          user?.accessToken
        );
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createCompanyContact', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_company_contact');
  }
}

async function getCompanyContact(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCompanyContact', req, {
    user: user?.id,
    companyContactId: params?.id,
  });

  try {
    const include = {
      person: true,
      company: true,
    };

    // Log database operation start
    logDatabaseStart('get_company_contact', req, {
      companyContactId: params?.id,
      userId: user?.id,
    });

    const foundCompanyContact = await prisma.companyContact.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_company_contact', req, {
      found: !!foundCompanyContact,
      companyContactId: params?.id,
    });

    if (!foundCompanyContact) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_company_contact',
          details: { companyContactId: params?.id },
        }
      );
      logOperationError('getCompanyContact', req, error);
      throw error;
    }

    const [foundCompanyContactWithDetails] = await getDetailsFromAPI({
      results: [foundCompanyContact],
      token: user?.accessToken,
    });

    // Attach display value
    const companyContactWithDisplayValue = enrichRecordDisplayValues(
      foundCompanyContactWithDetails,
      'CompanyContact'
    );

    // Log operation success
    logOperationSuccess('getCompanyContact', req, {
      id: foundCompanyContact.id,
      code: foundCompanyContact.code,
    });

    res.status(200).json(companyContactWithDisplayValue);
  } catch (error) {
    logOperationError('getCompanyContact', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_company_contact');
  }
}

async function updateCompanyContact(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCompanyContact', req, {
    companyContactId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await companyContactUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCompanyContact', req, error);
        throw handleValidationError(error, 'company_contact_update');
      }
      logOperationError('updateCompanyContact', req, error);
      throw error;
    }

    // Fetch current record to compute final values and enforce visibility
    const currentRecord = await prisma.companyContact.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, personId: true, companyId: true, workEmail: true },
    });
    if (!currentRecord) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_contact_fetch',
          details: { companyContactId: params?.id },
        }
      );
      throw error;
    }

    // Controller-level uniqueness checks on new values (soft-delete aware)
    try {
      const nextPersonId = values?.personId ?? currentRecord.personId ?? null;
      const nextCompanyId =
        values?.companyId ?? currentRecord.companyId ?? null;
      if (nextPersonId && nextCompanyId) {
        const dupePair = await prisma.companyContact.findFirst({
          where: {
            id: { not: params?.id },
            personId: nextPersonId,
            companyId: nextCompanyId,
            client: user?.client?.id,
          },
          select: { id: true },
        });
        if (dupePair) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This person is already a contact for the selected company.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'company_contact_update_duplicate_pair',
              details: { personId: nextPersonId, companyId: nextCompanyId },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      /* noop */
    }

    try {
      const rawNextEmail = (
        values?.workEmail ??
        currentRecord.workEmail ??
        ''
      ).trim();
      if (rawNextEmail && validator.isEmail(rawNextEmail)) {
        const nextEmail = rawNextEmail.toLowerCase();
        const dupeEmail = await prisma.companyContact.findFirst({
          where: {
            id: { not: params?.id },
            client: user?.client?.id,
            workEmail: { equals: nextEmail, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (dupeEmail) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A company contact with this work email already exists.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'company_contact_update_duplicate_email',
              details: { workEmail: rawNextEmail },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      /* noop */
    }

    // Log database operation start
    logDatabaseStart('update_company_contact', req, {
      companyContactId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.companyContact.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_company_contact',
          details: { companyContactId: params?.id },
        }
      );
      throw error;
    }

    const updatedCompanyContact = await prisma.companyContact.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      include: {
        person: true,
        company: true,
      },
    });

    // Attach display value
    const companyContactWithDisplayValue = enrichRecordDisplayValues(
      updatedCompanyContact,
      'CompanyContact'
    );

    // Log database operation success
    logDatabaseSuccess('update_company_contact', req, {
      id: params?.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateCompanyContact', req, {
      id: params?.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(companyContactWithDisplayValue);
  } catch (error) {
    logOperationError('updateCompanyContact', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_company_contact');
  }
}

async function deleteCompanyContact(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCompanyContact', req, {
    user: user?.id,
    companyContactId: params?.id,
  });

  try {
    await prisma.client.updateMany({
      where: { companyContactId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityInfluencer.updateMany({
      where: { companyContactId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: { companyContactId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_company_contact', req, {
      companyContactId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.companyContact.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_company_contact', req, {
      deletedCount: result.count,
      companyContactId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CompanyContact not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_company_contact',
          details: { companyContactId: params?.id },
        }
      );
      logOperationError('deleteCompanyContact', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCompanyContact', req, {
      deletedCount: result.count,
      companyContactId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCompanyContact', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_company_contact');
  }
}

async function getCompanyContactBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for companyContact',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCompanyContact,
  createCompanyContact,
  getCompanyContact,
  updateCompanyContact,
  deleteCompanyContact,
  getCompanyContactBarChartData,
};
