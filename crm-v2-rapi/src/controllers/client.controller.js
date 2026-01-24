/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing client using Prisma.
 * It includes functions for retrieving all client, creating a new client, retrieving a single client,
 * updating an existing client, and deleting a client.
 *
 * The `getAllClient` function retrieves a paginated list of client based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createClient` function validates the request body using a Joi schema, generates a unique code
 * for the client, and creates a new client in the database with additional metadata.
 *
 * The `getClient` function retrieves a single client based on the provided client ID, with visibility
 * filters applied to ensure the client is accessible to the requesting user.
 *
 * The `updateClient` function updates an existing client in the database based on the provided client ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteClient` function deletes a client from the database based on the provided client ID, with
 * visibility filters applied to ensure the client is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const validator = require('validator');
const {
  clientCreate,
  clientUpdate,
  createClientFromOpportunity: createClientFromOpportunitySchema,
  createClientsFromOpportunities: createClientsFromOpportunitiesSchema,
} = require('#schemas/client.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY, DISPLAY_VALUE_PROP } = require('#configs/constants.js');
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
  computeDisplayValue,
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllClient(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllClient', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['notes', 'color'];
    const filterFields = [...searchFields, 'opportunityId', 'companyContactId'];

    const include = {
      opportunity: true,
      companyContact: { include: { person: true } },
    };

    // Support relational search (person name/email via companyContact, opportunity name)
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { companyContact: { person: { firstName: { contains: rawSearch, mode: 'insensitive' } } } },
          { companyContact: { person: { middleName: { contains: rawSearch, mode: 'insensitive' } } } },
          { companyContact: { person: { lastName: { contains: rawSearch, mode: 'insensitive' } } } },
          { companyContact: { person: { email: { contains: rawSearch, mode: 'insensitive' } } } },
          { opportunity: { name: { contains: rawSearch, mode: 'insensitive' } } },
        ],
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_client', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: clientUpdate,
      filterFields,
      searchFields,
      model: 'client',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations)
    if (response?.results) {
      response.results = response.results.map((client) =>
        enrichRecordDisplayValues(client, 'Client')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_client', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllClient', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllClient', req, error);
    throw handleDatabaseError(error, 'get_all_client');
  }
}

async function createClient(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createClient', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await clientCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createClient', req, error);
        throw handleValidationError(error, 'client_creation');
      }
      logOperationError('createClient', req, error);
      throw error;
    }

    const modelRelationFields = ['opportunityId', 'companyContactId'];

    const include = {
      opportunity: true,
      companyContact: { include: { person: true } },
    };

    // FK visibility validation (soft-delete aware)
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

    // Controller-level uniqueness checks (soft-delete aware, per-tenant)
    try {
      // 1) Prevent duplicate Client for same opportunityId
      if (
        values?.opportunityId &&
        validator.isUUID(String(values.opportunityId))
      ) {
        const duplicateByOpportunity = await prisma.client.findFirst({
          where: {
            client: user?.client?.id,
            deleted: null,
            opportunityId: values.opportunityId,
          },
          select: { id: true },
        });
        if (duplicateByOpportunity) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A client for this opportunity already exists.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'create_client_duplicate_check',
              details: { opportunityId: values.opportunityId },
            }
          );
          throw error;
        }
      }

      // 2) Prevent duplicate Client for same companyContactId
      if (
        values?.companyContactId &&
        validator.isUUID(String(values.companyContactId))
      ) {
        const duplicateByCompanyContact = await prisma.client.findFirst({
          where: {
            client: user?.client?.id,
            deleted: null,
            companyContactId: values.companyContactId,
          },
          select: { id: true },
        });
        if (duplicateByCompanyContact) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This company contact already has a client.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'create_client_duplicate_check',
              details: { companyContactId: values.companyContactId },
            }
          );
          throw error;
        }
      }
    } catch (dupCheckError) {
      // If the error is already standardized, rethrow it; otherwise ignore duplicate-check failures silently
      if (
        dupCheckError?.type &&
        Object.values(ERROR_TYPES).includes(dupCheckError.type)
      ) {
        throw dupCheckError;
      }
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_client', req, {
      name: values.name,
      userId: user?.id,
    });

    const newClient = await prisma.client.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_client', req, {
      id: newClient.id,
      code: newClient.code,
    });

    const [newClientWithDetails] = await getDetailsFromAPI({
      results: [newClient],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const clientWithDisplayValue = enrichRecordDisplayValues(
      newClientWithDetails,
      'Client'
    );

    // Log operation success
    logOperationSuccess('createClient', req, {
      id: newClient.id,
      code: newClient.code,
    });

    res.status(201).json(clientWithDisplayValue);
  } catch (error) {
    logOperationError('createClient', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_client');
  }
}

async function getClient(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getClient', req, {
    user: user?.id,
    clientId: params?.id,
  });

  try {
    const include = {
      opportunity: true,
      companyContact: { include: { person: true } },
    };

    // Log database operation start
    logDatabaseStart('get_client', req, {
      clientId: params?.id,
      userId: user?.id,
    });

    const foundClient = await prisma.client.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_client', req, {
      found: !!foundClient,
      clientId: params?.id,
    });

    if (!foundClient) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Client not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_client',
          details: { clientId: params?.id },
        }
      );
      logOperationError('getClient', req, error);
      throw error;
    }

    const [foundClientWithDetails] = await getDetailsFromAPI({
      results: [foundClient],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const clientWithDisplayValue = enrichRecordDisplayValues(
      foundClientWithDetails,
      'Client'
    );

    // Log operation success
    logOperationSuccess('getClient', req, {
      id: foundClient.id,
      code: foundClient.code,
    });

    res.status(200).json(clientWithDisplayValue);
  } catch (error) {
    logOperationError('getClient', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_client');
  }
}

async function updateClient(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateClient', req, {
    clientId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await clientUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateClient', req, error);
        throw handleValidationError(error, 'client_update');
      }
      logOperationError('updateClient', req, error);
      throw error;
    }

    // Load current to compute effective values and validate visibility
    const current = await prisma.client.findFirst({
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
        'Client not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_client',
          details: { clientId: params?.id },
        }
      );
      throw error;
    }

    const effectiveOpportunityId =
      values?.opportunityId ?? current.opportunityId;
    const effectiveCompanyContactId =
      values?.companyContactId ?? current.companyContactId;

    // FK visibility validation on provided FKs
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

    // Controller-level uniqueness checks on effective next values
    try {
      if (
        effectiveOpportunityId &&
        validator.isUUID(String(effectiveOpportunityId))
      ) {
        const duplicateByOpportunity = await prisma.client.findFirst({
          where: {
            id: { not: current.id },
            client: user?.client?.id,
            deleted: null,
            opportunityId: effectiveOpportunityId,
            ...getVisibilityFilters(user),
          },
          select: { id: true },
        });
        if (duplicateByOpportunity) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A client for this opportunity already exists.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_client_duplicate_check',
              details: { opportunityId: effectiveOpportunityId },
            }
          );
          throw error;
        }
      }

      if (
        effectiveCompanyContactId &&
        validator.isUUID(String(effectiveCompanyContactId))
      ) {
        const duplicateByCompanyContact = await prisma.client.findFirst({
          where: {
            id: { not: current.id },
            client: user?.client?.id,
            deleted: null,
            companyContactId: effectiveCompanyContactId,
            ...getVisibilityFilters(user),
          },
          select: { id: true },
        });
        if (duplicateByCompanyContact) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This company contact already has a client.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_client_duplicate_check',
              details: { companyContactId: effectiveCompanyContactId },
            }
          );
          throw error;
        }
      }
    } catch (dupCheckError) {
      if (
        dupCheckError?.type &&
        Object.values(ERROR_TYPES).includes(dupCheckError.type)
      ) {
        throw dupCheckError;
      }
    }

    // Log database operation start
    logDatabaseStart('update_client', req, {
      clientId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedClient = await prisma.client.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    // Attach display value (including nested relations)
    const clientWithDisplayValue = enrichRecordDisplayValues(
      updatedClient,
      'Client'
    );

    // Log database operation success
    logDatabaseSuccess('update_client', req, {
      id: updatedClient.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateClient', req, {
      id: updatedClient.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(clientWithDisplayValue);
  } catch (error) {
    logOperationError('updateClient', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_client');
  }
}

async function deleteClient(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteClient', req, {
    user: user?.id,
    clientId: params?.id,
  });

  try {
    await prisma.clientHistory.updateMany({
      where: {
        clientRefId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_client', req, {
      clientId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.client.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_client', req, {
      deletedCount: result.count,
      clientId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Client not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_client',
          details: { clientId: params?.id },
        }
      );
      logOperationError('deleteClient', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteClient', req, {
      deletedCount: result.count,
      clientId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteClient', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_client');
  }
}

async function getClientBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for client',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

/**
 * Create a single Client from an Opportunity
 * POST /api/v1/clients/from-opportunity
 */
async function createClientFromOpportunity(req, res) {
  const { user, body } = req;

  logOperationStart('createClientFromOpportunity', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate request body
    let values;
    try {
      values = await createClientFromOpportunitySchema.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createClientFromOpportunity', req, error);
        throw handleValidationError(error, 'create_client_from_opportunity');
      }
      throw error;
    }

    const { opportunityId } = values;

    // Fetch the opportunity with its companyContact
    logDatabaseStart('get_opportunity_for_client', req, {
      opportunityId,
      userId: user?.id,
    });

    const opportunity = await prisma.opportunity.findFirst({
      where: {
        id: opportunityId,
        client: user?.client?.id,
        deleted: null,
      },
      include: {
        companyContact: {
          include: {
            person: true,
            company: true,
          },
        },
      },
    });

    if (!opportunity) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_client_from_opportunity',
          details: { opportunityId },
        }
      );
      throw error;
    }

    if (!opportunity.companyContactId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Opportunity has no associated company contact',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_client_from_opportunity',
          details: { opportunityId, code: 'NO_COMPANY_CONTACT' },
        }
      );
      error.code = 'NO_COMPANY_CONTACT';
      throw error;
    }

    // Check if client already exists for this companyContact
    const existingClient = await prisma.client.findFirst({
      where: {
        client: user?.client?.id,
        companyContactId: opportunity.companyContactId,
        deleted: null,
      },
    });

    if (existingClient) {
      const error = createErrorWithTrace(
        ERROR_TYPES.CONFLICT,
        'A client already exists for this company contact',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_client_from_opportunity',
          details: {
            opportunityId,
            existingClientId: existingClient.id,
            code: 'CLIENT_EXISTS',
          },
        }
      );
      error.code = 'CLIENT_EXISTS';
      error.existingClientId = existingClient.id;
      throw error;
    }

    // Create the client
    logDatabaseStart('create_client_from_opportunity', req, {
      opportunityId,
      companyContactId: opportunity.companyContactId,
      userId: user?.id,
    });

    const newClient = await prisma.client.create({
      data: {
        client: user?.client?.id,
        companyContactId: opportunity.companyContactId,
        opportunityId: opportunity.id,
        createdBy: user?.id,
        updatedBy: user?.id,
      },
      include: {
        opportunity: true,
        companyContact: {
          include: {
            person: true,
          },
        },
      },
    });

    logDatabaseSuccess('create_client_from_opportunity', req, {
      id: newClient.id,
      opportunityId,
    });

    // Enrich with display values
    const [newClientWithDetails] = await getDetailsFromAPI({
      results: [newClient],
      token: user?.accessToken,
    });

    const clientWithDisplayValue = enrichRecordDisplayValues(
      newClientWithDetails,
      'Client'
    );

    logOperationSuccess('createClientFromOpportunity', req, {
      id: newClient.id,
    });

    res.status(201).json({
      data: clientWithDisplayValue,
      message: 'Client created successfully',
    });
  } catch (error) {
    logOperationError('createClientFromOpportunity', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_client_from_opportunity');
  }
}

/**
 * Create multiple Clients from Opportunities (bulk)
 * POST /api/v1/clients/from-opportunities
 */
async function createClientsFromOpportunities(req, res) {
  const { user, body } = req;

  logOperationStart('createClientsFromOpportunities', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate request body
    let values;
    try {
      values = await createClientsFromOpportunitiesSchema.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createClientsFromOpportunities', req, error);
        throw handleValidationError(error, 'create_clients_from_opportunities');
      }
      throw error;
    }

    const { opportunityIds } = values;

    // Fetch all opportunities with their companyContacts
    logDatabaseStart('get_opportunities_for_clients', req, {
      opportunityIds,
      userId: user?.id,
    });

    const opportunities = await prisma.opportunity.findMany({
      where: {
        id: { in: opportunityIds },
        client: user?.client?.id,
        deleted: null,
      },
      include: {
        companyContact: {
          include: {
            person: true,
          },
        },
      },
    });

    // Categorize opportunities
    const results = {
      created: [],
      skipped: [],
      errors: [],
    };

    for (const opportunity of opportunities) {
      // No companyContactId
      if (!opportunity.companyContactId) {
        results.errors.push({
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          reason: 'No company contact associated',
          code: 'NO_COMPANY_CONTACT',
        });
        continue;
      }

      // Check for existing client
      const existingClient = await prisma.client.findFirst({
        where: {
          client: user?.client?.id,
          companyContactId: opportunity.companyContactId,
          deleted: null,
        },
      });

      if (existingClient) {
        results.skipped.push({
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          existingClientId: existingClient.id,
          reason: 'Client already exists for this company contact',
          code: 'CLIENT_EXISTS',
        });
        continue;
      }

      // Create client
      try {
        const newClient = await prisma.client.create({
          data: {
            client: user?.client?.id,
            companyContactId: opportunity.companyContactId,
            opportunityId: opportunity.id,
            createdBy: user?.id,
            updatedBy: user?.id,
          },
        });

        results.created.push({
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          clientId: newClient.id,
        });
      } catch (err) {
        results.errors.push({
          opportunityId: opportunity.id,
          opportunityName: opportunity.name,
          reason: 'Database error during creation',
          code: 'CREATE_FAILED',
        });
      }
    }

    // Handle opportunities not found
    const foundIds = opportunities.map((o) => o.id);
    const notFoundIds = opportunityIds.filter((id) => !foundIds.includes(id));
    notFoundIds.forEach((id) => {
      results.errors.push({
        opportunityId: id,
        reason: 'Opportunity not found',
        code: 'NOT_FOUND',
      });
    });

    logDatabaseSuccess('create_clients_from_opportunities', req, {
      created: results.created.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    });

    logOperationSuccess('createClientsFromOpportunities', req, {
      created: results.created.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
    });

    res.status(200).json({
      data: results,
      summary: {
        total: opportunityIds.length,
        created: results.created.length,
        skipped: results.skipped.length,
        failed: results.errors.length,
      },
      message: `Created ${results.created.length} client(s), ${results.skipped.length} skipped, ${results.errors.length} failed`,
    });
  } catch (error) {
    logOperationError('createClientsFromOpportunities', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_clients_from_opportunities');
  }
}

module.exports = {
  getAllClient,
  createClient,
  getClient,
  updateClient,
  deleteClient,
  getClientBarChartData,
  createClientFromOpportunity,
  createClientsFromOpportunities,
};
