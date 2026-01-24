/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing customerEnquiry using Prisma.
 * It includes functions for retrieving all customerEnquiry, creating a new customerEnquiry, retrieving a single customerEnquiry,
 * updating an existing customerEnquiry, and deleting a customerEnquiry.
 *
 * The `getAllCustomerEnquiry` function retrieves a paginated list of customerEnquiry based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createCustomerEnquiry` function validates the request body using a Joi schema, generates a unique code
 * for the customerEnquiry, and creates a new customerEnquiry in the database with additional metadata.
 *
 * The `getCustomerEnquiry` function retrieves a single customerEnquiry based on the provided customerEnquiry ID, with visibility
 * filters applied to ensure the customerEnquiry is accessible to the requesting user.
 *
 * The `updateCustomerEnquiry` function updates an existing customerEnquiry in the database based on the provided customerEnquiry ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteCustomerEnquiry` function deletes a customerEnquiry from the database based on the provided customerEnquiry ID, with
 * visibility filters applied to ensure the customerEnquiry is deletable by the requesting user.
 *
 *
 */

const _ = require('lodash');
const validator = require('validator');
const prisma = require('#configs/prisma.js');
const {
  customerEnquiryCreate,
  customerEnquiryUpdate,
} = require('#schemas/customerEnquiry.schemas.js');
const visibility = require('#utils/shared/visibilityUtils.js');
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
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
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
  attachNestedDisplayValues,
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllCustomerEnquiry(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllCustomerEnquiry', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'firstName',
      'phone',
      'sourceNotes',
      'color',
      'lastName',
      'message',
      'source',
    ];
    const filterFields = [...searchFields, 'personId', 'statusId', 'purposeId'];

    const include = {
      person: true,
      status: true,
      purpose: true,
    };

    // Support relational search parity with Django (person name/email)
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { person: { firstName: { contains: rawSearch, mode: 'insensitive' } } },
          { person: { middleName: { contains: rawSearch, mode: 'insensitive' } } },
          { person: { lastName: { contains: rawSearch, mode: 'insensitive' } } },
          { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
        ],
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_customer_enquiry', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: customerEnquiryUpdate,
      filterFields,
      searchFields,
      model: 'customerEnquiry',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations) to all customer enquiries
    if (response?.results) {
      response.results = response.results.map((item) =>
        enrichRecordDisplayValues(
          attachNestedDisplayValues(item, [
            { relation: 'status', model: 'CustomerEnquiryStatus' },
            { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
          ]),
          'CustomerEnquiry'
        )
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_customer_enquiry', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllCustomerEnquiry', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllCustomerEnquiry', req, error);
    throw handleDatabaseError(error, 'get_all_customer_enquiry');
  }
}

async function createCustomerEnquiry(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createCustomerEnquiry', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await customerEnquiryCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createCustomerEnquiry', req, error);
        throw handleValidationError(error, 'customer_enquiry_creation');
      }
      logOperationError('createCustomerEnquiry', req, error);
      throw error;
    }

    const modelRelationFields = ['personId', 'statusId', 'purposeId'];

    const include = {
      person: true,
      status: true,
      purpose: true,
    };

    // If personId is missing, find or create Person by email (Django parity)
    if (!values?.personId) {
      const email = _.trim(body?.email || '');
      if (!email) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Either personId or email is required.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'customer_enquiry_creation_person',
            details: {},
          }
        );
        throw error;
      }

      // Try to find existing Person by email within tenant
      const existingPerson = await prisma.person.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          email: { equals: email, mode: 'insensitive' },
          parentId: null,
        },
        select: { id: true },
      });

      if (existingPerson) {
        values.personId = existingPerson.id;
      } else {
        // Create a minimal Person
        // Respect anonymous support and visibility validation: use visibility utils
        const vis = visibility.parseAndAssignVisibilityAttributes({
          body,
          user,
        });
        const newPerson = await prisma.person.create({
          data: {
            email,
            firstName: values?.firstName || null,
            lastName: values?.lastName || null,
            createdBy: vis.createdBy,
            updatedBy: vis.updatedBy,
            client: vis.client,
            everyoneCanSeeIt: vis.everyoneCanSeeIt ?? false,
            anonymousCanSeeIt: vis.anonymousCanSeeIt ?? false,
            everyoneInObjectCompanyCanSeeIt:
              vis.everyoneInObjectCompanyCanSeeIt ?? true,
          },
          select: { id: true },
        });
        values.personId = newPerson.id;
      }
    }

    // Foreign key visibility validation (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.statusId
          ? {
              model: 'customerEnquiryStatus',
              fieldValues: { statusId: values.statusId },
            }
          : null,
        values?.purposeId
          ? {
              model: 'customerEnquiryPurpose',
              fieldValues: { purposeId: values.purposeId },
            }
          : null,
      ].filter(Boolean),
    });

    // Controller-level uniqueness checks (soft-delete aware)
    // Prevent duplicate enquiry messages for the same person within a tenant
    const clientId = user?.client?.id;
    const trimmedMessage = _.trim(values?.message || '');
    if (validator.isUUID(values?.personId || '', 4) && trimmedMessage) {
      const existing = await prisma.customerEnquiry.findFirst({
        where: {
          client: clientId,
          deleted: null,
          personId: values.personId,
          message: { equals: trimmedMessage, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A customer enquiry with this message already exists for this person.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'customer_enquiry_creation_uniqueness',
            details: { personId: values.personId },
          }
        );
        throw error;
      }
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_customer_enquiry', req, {
      name: values.name,
      userId: user?.id,
    });

    const newCustomerEnquiry = await prisma.customerEnquiry.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_customer_enquiry', req, {
      id: newCustomerEnquiry.id,
      code: newCustomerEnquiry.code,
    });

    let [newCustomerEnquiryWithDetails] = [newCustomerEnquiry];
    try {
      [newCustomerEnquiryWithDetails] = await getDetailsFromAPI({
        results: [newCustomerEnquiry],
        token: user?.accessToken,
      });
    } catch (_e) {
      [newCustomerEnquiryWithDetails] = [newCustomerEnquiry];
    }

    // Attach display value (including nested relations)
    const createdWithDisplayValue = enrichRecordDisplayValues(
      attachNestedDisplayValues(newCustomerEnquiryWithDetails, [
        { relation: 'status', model: 'CustomerEnquiryStatus' },
        { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
      ]),
      'CustomerEnquiry'
    );

    // Log operation success
    logOperationSuccess('createCustomerEnquiry', req, {
      id: newCustomerEnquiry.id,
      code: newCustomerEnquiry.code,
    });

    res.status(201).json(createdWithDisplayValue);

    // Fire-and-forget create-time workflow trigger AFTER response for lower latency
    (async () => {
      try {
        // Support optional initiate_workflow flag (parity): default true when present/true
        const shouldInitiate =
          body?.initiate_workflow === true ||
          body?.initiateWorkflow === true ||
          body?.trigger_bpa === true;
        if (shouldInitiate) {
          await findWorkflowAndTrigger(
            prisma,
            newCustomerEnquiry,
            'customerEnquiry',
            user?.client?.id || body?.client,
            {
              email: newCustomerEnquiry?.person?.email || '',
              full_name: `${newCustomerEnquiry?.firstName || ''} ${
                newCustomerEnquiry?.lastName || ''
              }`.trim(),
              status: newCustomerEnquiry?.status?.name || '',
              purpose: newCustomerEnquiry?.purpose?.name || '',
              status_id: newCustomerEnquiry?.status?.id || '',
              purpose_id: newCustomerEnquiry?.purpose?.id || '',
              person_id: newCustomerEnquiry?.person?.id || '',
            },
            user?.accessToken
          );
        }
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createCustomerEnquiry', req, error);

    // DEBUG: Log actual error details for investigation
    console.error('[DEBUG createCustomerEnquiry] Actual error:', JSON.stringify({
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5),
    }));

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_customer_enquiry');
  }
}

async function getCustomerEnquiry(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getCustomerEnquiry', req, {
    user: user?.id,
    customerEnquiryId: params?.id,
  });

  try {
    const include = {
      person: true,
      status: true,
      purpose: true,
    };

    // Log database operation start
    logDatabaseStart('get_customer_enquiry', req, {
      customerEnquiryId: params?.id,
      userId: user?.id,
    });

    const foundCustomerEnquiry = await prisma.customerEnquiry.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_customer_enquiry', req, {
      found: !!foundCustomerEnquiry,
      customerEnquiryId: params?.id,
    });

    if (!foundCustomerEnquiry) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiry not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_customer_enquiry',
          details: { customerEnquiryId: params?.id },
        }
      );
      logOperationError('getCustomerEnquiry', req, error);
      throw error;
    }

    const [foundCustomerEnquiryWithDetails] = await getDetailsFromAPI({
      results: [foundCustomerEnquiry],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const itemWithDisplayValue = enrichRecordDisplayValues(
      attachNestedDisplayValues(foundCustomerEnquiryWithDetails, [
        { relation: 'status', model: 'CustomerEnquiryStatus' },
        { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
      ]),
      'CustomerEnquiry'
    );

    // Log operation success
    logOperationSuccess('getCustomerEnquiry', req, {
      id: foundCustomerEnquiry.id,
      code: foundCustomerEnquiry.code,
    });

    res.status(200).json(itemWithDisplayValue);
  } catch (error) {
    logOperationError('getCustomerEnquiry', req, error);

    // DEBUG: Log actual error details for investigation
    console.error('[DEBUG getCustomerEnquiry] Actual error:', JSON.stringify({
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5),
    }));

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_customer_enquiry');
  }
}

async function updateCustomerEnquiry(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateCustomerEnquiry', req, {
    customerEnquiryId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await customerEnquiryUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateCustomerEnquiry', req, error);
        throw handleValidationError(error, 'customer_enquiry_update');
      }
      logOperationError('updateCustomerEnquiry', req, error);
      throw error;
    }

    // Foreign key visibility validation (soft-delete aware, strict tenant scope)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        body?.personId
          ? { model: 'person', fieldValues: { personId: body.personId } }
          : null,
        body?.statusId
          ? {
              model: 'customerEnquiryStatus',
              fieldValues: { statusId: body.statusId },
            }
          : null,
        body?.purposeId
          ? {
              model: 'customerEnquiryPurpose',
              fieldValues: { purposeId: body.purposeId },
            }
          : null,
      ].filter(Boolean),
    });

    // Uniqueness checks for (personId, message) on update
    const clientId = user?.client?.id;
    const trimmedMessage = _.trim(values?.message || '');
    const targetPersonId = values?.personId;
    if (validator.isUUID(targetPersonId || '', 4) && trimmedMessage) {
      const existing = await prisma.customerEnquiry.findFirst({
        where: {
          client: clientId,
          deleted: null,
          id: { not: params?.id },
          personId: targetPersonId,
          message: { equals: trimmedMessage, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existing) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A customer enquiry with this message already exists for this person.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'customer_enquiry_update_uniqueness',
            details: { personId: targetPersonId },
          }
        );
        throw error;
      }
    }

    // Log database operation start
    logDatabaseStart('update_customer_enquiry', req, {
      customerEnquiryId: params?.id,
      updateFields: Object.keys(values),
    });

    // Guard: ensure record exists within visibility scope before update
    const currentCustomerEnquiry = await prisma.customerEnquiry.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!currentCustomerEnquiry) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiry not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_customer_enquiry',
          details: { customerEnquiryId: params?.id },
        }
      );
      logOperationError('updateCustomerEnquiry', req, error);
      throw error;
    }

    const updatedCustomerEnquiry = await prisma.customerEnquiry.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
      include: {
        person: true,
        status: true,
        purpose: true,
      },
    });

    // Log database operation success
    logDatabaseSuccess('update_customer_enquiry', req, {
      id: updatedCustomerEnquiry.id,
      updatedFields: Object.keys(values),
    });

    // Attach display value (including nested relations)
    const updatedWithDisplayValue = enrichRecordDisplayValues(
      attachNestedDisplayValues(updatedCustomerEnquiry, [
        { relation: 'status', model: 'CustomerEnquiryStatus' },
        { relation: 'purpose', model: 'CustomerEnquiryPurpose' },
      ]),
      'CustomerEnquiry'
    );

    // Log operation success
    logOperationSuccess('updateCustomerEnquiry', req, {
      id: updatedCustomerEnquiry.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedWithDisplayValue);
  } catch (error) {
    logOperationError('updateCustomerEnquiry', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_customer_enquiry');
  }
}

async function deleteCustomerEnquiry(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteCustomerEnquiry', req, {
    user: user?.id,
    customerEnquiryId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_customer_enquiry', req, {
      customerEnquiryId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.customerEnquiry.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_customer_enquiry', req, {
      deletedCount: result.count,
      customerEnquiryId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'CustomerEnquiry not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_customer_enquiry',
          details: { customerEnquiryId: params?.id },
        }
      );
      logOperationError('deleteCustomerEnquiry', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteCustomerEnquiry', req, {
      deletedCount: result.count,
      customerEnquiryId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteCustomerEnquiry', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_customer_enquiry');
  }
}

async function getCustomerEnquiryBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for customerEnquiry',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllCustomerEnquiry,
  createCustomerEnquiry,
  getCustomerEnquiry,
  updateCustomerEnquiry,
  deleteCustomerEnquiry,
  getCustomerEnquiryBarChartData,
};
