/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing person using Prisma.
 * It includes functions for retrieving all person, creating a new person, retrieving a single person,
 * updating an existing person, and deleting a person.
 *
 * The `getAllPerson` function retrieves a paginated list of person based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPerson` function validates the request body using a Joi schema, generates a unique code
 * for the person, and creates a new person in the database with additional metadata.
 *
 * The `getPerson` function retrieves a single person based on the provided person ID, with visibility
 * filters applied to ensure the person is accessible to the requesting user.
 *
 * The `updatePerson` function updates an existing person in the database based on the provided person ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePerson` function deletes a person from the database based on the provided person ID, with
 * visibility filters applied to ensure the person is deletable by the requesting user.
 *
 *
 */

const validator = require('validator');
const prisma = require('#configs/prisma.js');
const { personCreate, personUpdate } = require('#schemas/person.schemas.js');
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
  logWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  findWorkflowAndTrigger,
  triggerAutomata,
} = require('#utils/shared/automataUtils.js');
const {
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllPerson(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPerson', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'color',
      'middleName',
      'personalMobile',
      'address2',
      'state',
      'owner',
      'source',
      'preferredName',
      'username',
      'avatar',
      'homePhone',
      'city',
      'address1',
      'notes',
      'firstName',
      'zip',
      'sourceNotes',
      'lastName',
      'email',
    ];
    const filterFields = [
      ...searchFields,
      'dob',
      'countryId',
      'stateId',
      'cityId',
      'parentId',
      'companyOwnerId',
      'hasWhatsapp',
      'user',
      'status',
    ];

    const include = {
      parent: true,
      companyOwner: true,
      personPersonRelationshipPerson: {
        where: { deleted: null },
        include: { relationship: true },
      },
      personCompanyContactPerson: {
        where: {
          deleted: null,
          workEmail: { not: null },
          NOT: [{ workEmail: '' }],
        },
        select: { workEmail: true },
      },
    };

    // Log database operation start
    logDatabaseStart('get_all_person', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    // Custom filters parity with Django
    const customWhere = {};
    const andConditions = [];

    if (query?.marketing_list) {
      const id = String(query.marketing_list);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'marketing_list'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_person',
            details: { marketing_list: id },
          }
        );
        throw error;
      }
      andConditions.push({
        personPersonInMarketingListPerson: {
          some: { marketingListId: id, deleted: null },
        },
      });
    }

    if (query?.relationship) {
      const id = String(query.relationship);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'relationship'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_person',
            details: { relationship: id },
          }
        );
        throw error;
      }
      andConditions.push({
        personPersonRelationshipPerson: {
          some: { relationshipId: id, deleted: null },
        },
      });
    }

    if (query?.user__isnotnull) {
      andConditions.push({ user: { not: null } });
    }

    if (andConditions.length) customWhere.AND = andConditions;

    let response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: personUpdate,
      filterFields,
      searchFields,
      model: 'person',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Mask PII and add allEmails list on list view
    const roleNames = user?.roleNames || [];
    const shouldMaskEmail = roleNames.includes('MASK_CRM_PERSON_EMAIL');
    const shouldMaskPhone = roleNames.includes('MASK_CRM_PERSON_PHONES');

    const mask = (value) => {
      if (!value) return value;
      const s = String(value);
      if (s.length <= 2) return s;
      return '*'.repeat(s.length - 2) + s.slice(-2);
    };

    response = {
      ...response,
      results: (response?.results || []).map((p) => {
        let masked = { ...p };
        if (shouldMaskEmail) masked.email = mask(p.email);
        if (shouldMaskPhone) {
          masked.homePhone = mask(p.homePhone);
          masked.personalMobile = mask(p.personalMobile);
        }

        // Aggregate all emails: person email + company contact work emails (non-empty)
        const workEmails = (p.personCompanyContactPerson || [])
          .map((c) => (c.workEmail || '').trim())
          .filter((e) => !!e);
        masked.allEmails = Array.from(
          new Set([p.email, ...workEmails].filter(Boolean))
        );

        // Attach display value
        masked = enrichRecordDisplayValues(masked, 'Person');

        // Enrich nested personPersonRelationshipPerson array
        if (Array.isArray(masked.personPersonRelationshipPerson)) {
          masked.personPersonRelationshipPerson = masked.personPersonRelationshipPerson.map(
            (rel) => {
              // Attach minimal person object for template resolution
              rel.person = { [DISPLAY_VALUE_PROP]: masked[DISPLAY_VALUE_PROP] };

              if (rel.relationship) {
                rel.relationship = enrichRecordDisplayValues(
                  rel.relationship,
                  'Relationship'
                );
              }
              return enrichRecordDisplayValues(rel, 'PersonRelationship');
            }
          );
        }

        return masked;
      }),
    };

    // Log database operation success
    logDatabaseSuccess('get_all_person', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPerson', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPerson', req, error);
    throw handleDatabaseError(error, 'get_all_person');
  }
}

async function createPerson(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPerson', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPerson', req, error);
        throw handleValidationError(error, 'person_creation');
      }
      logOperationError('createPerson', req, error);
      throw error;
    }

    const modelRelationFields = ['parentId', 'companyOwnerId'];

    const include = {
      parent: true,
      companyOwner: true,
    };

    // Verify foreign key access for parentId and companyOwnerId if provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.parentId
          ? { model: 'person', fieldValues: { parentId: values.parentId } }
          : null,
        values?.companyOwnerId
          ? {
            model: 'company',
            fieldValues: { companyOwnerId: values.companyOwnerId },
          }
          : null,
      ].filter(Boolean),
    });

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Parity with Django: if a person with same phone/email exists in same client, set parentId
    try {
      const { homePhone, personalMobile, email } = values;
      if (homePhone || personalMobile || email) {
        const existing = await prisma.person.findFirst({
          where: {
            client: user?.client?.id,
            deleted: null,
            OR: [
              ...(homePhone ? [{ homePhone }] : []),
              ...(personalMobile ? [{ personalMobile }] : []),
              ...(email
                ? [{ email: { equals: email, mode: 'insensitive' } }]
                : []),
            ],
          },
          select: { id: true },
        });
        if (existing && !values.parentId) {
          values.parentId = existing.id;
        }
      }
    } catch (_e) {
      // best-effort; do not block creation if the check fails
    }

    // Log database operation start
    logDatabaseStart('create_person', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPerson = await prisma.person.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person', req, {
      id: newPerson.id,
      code: newPerson.code,
    });

    const [newPersonWithDetails] = await getDetailsFromAPI({
      results: [newPerson],
      token: user?.accessToken,
    });

    // Attach display value
    const personWithDisplayValue = enrichRecordDisplayValues(
      newPersonWithDetails,
      'Person'
    );

    // Log operation success
    logOperationSuccess('createPerson', req, {
      id: newPerson.id,
      code: newPerson.code,
    });

    res.status(201).json(personWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        const requestedWorkflowId = values?.workflowId;

        const payloadData = {
          ...newPerson,
        };

        if (requestedWorkflowId) {
          const automataResponse = await triggerAutomata(
            user?.accessToken,
            requestedWorkflowId,
            '',
            false,
            payloadData
          );

          if (automataResponse?.instance) {
            await prisma.person.updateMany({
              where: { id: newPerson.id },
              data: {
                workflowId: requestedWorkflowId,
                workflowInstanceId: automataResponse.instance,
              },
            });
            logWithTrace('Automata workflow triggered (person)', req, {
              workflowId: requestedWorkflowId,
              personId: newPerson.id,
            });
          } else {
            logWithTrace('Automata workflow trigger failed (person)', req, {
              personId: newPerson.id,
            });
          }
        } else {
          await findWorkflowAndTrigger(
            prisma,
            newPerson,
            'person',
            user?.client?.id,
            payloadData,
            user?.accessToken
          );
        }
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createPerson', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_person');
  }
}

async function getPerson(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPerson', req, {
    user: user?.id,
    personId: params?.id,
  });

  try {
    const idParam = String(params?.id || '');
    if (!validator.isUUID(idParam)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid person id. Expected a UUID.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person',
          details: { id: idParam },
        }
      );
      logOperationError('getPerson', req, error);
      throw error;
    }

    const include = {
      parent: true,
      companyOwner: true,
    };

    // Log database operation start
    logDatabaseStart('get_person', req, {
      personId: params?.id,
      userId: user?.id,
    });

    const foundPerson = await prisma.person.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_person', req, {
      found: !!foundPerson,
      personId: params?.id,
    });

    if (!foundPerson) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Person not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person',
          details: { personId: params?.id },
        }
      );
      logOperationError('getPerson', req, error);
      throw error;
    }

    const [foundPersonWithDetails] = await getDetailsFromAPI({
      results: [foundPerson],
      token: user?.accessToken,
    });

    // Attach display value
    const personWithDisplayValue = enrichRecordDisplayValues(
      foundPersonWithDetails,
      'Person'
    );

    // Log operation success
    logOperationSuccess('getPerson', req, {
      id: foundPerson.id,
      code: foundPerson.code,
    });

    res.status(200).json(personWithDisplayValue);
  } catch (error) {
    logOperationError('getPerson', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person');
  }
}

async function getPersonByEmail(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonByEmail', req, {
    user: user?.id,
    email: params?.email,
  });

  try {
    const emailParam = String(params?.email || '').trim();

    if (!validator.isEmail(emailParam)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid email format',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_by_email',
          details: { email: emailParam },
        }
      );
      logOperationError('getPersonByEmail', req, error);
      throw error;
    }

    // Validate optional createdBy and client coming from query/body are not used without checks
    // We don't accept overriding visibility via query/body in this route; rely on user context

    const include = {
      parent: true,
      companyOwner: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_by_email', req, {
      email: emailParam,
      userId: user?.id,
    });

    const foundPerson = await prisma.person.findFirst({
      where: {
        email: { equals: emailParam, mode: 'insensitive' },
        parentId: null,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_person_by_email', req, {
      found: !!foundPerson,
      email: emailParam,
    });

    if (!foundPerson) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Person not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_by_email',
          details: { email: emailParam },
        }
      );
      logOperationError('getPersonByEmail', req, error);
      throw error;
    }

    const [foundPersonWithDetails] = await getDetailsFromAPI({
      results: [foundPerson],
      token: user?.accessToken,
    });

    // Attach display value
    const personWithDisplayValue = enrichRecordDisplayValues(
      foundPersonWithDetails,
      'Person'
    );

    // Log operation success
    logOperationSuccess('getPersonByEmail', req, {
      id: foundPerson.id,
      email: emailParam,
    });

    res.status(200).json(personWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonByEmail', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person_by_email');
  }
}

async function updatePerson(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePerson', req, {
    personId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePerson', req, error);
        throw handleValidationError(error, 'person_update');
      }
      logOperationError('updatePerson', req, error);
      throw error;
    }

    // Verify foreign key access for parentId and companyOwnerId if provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.parentId
          ? { model: 'person', fieldValues: { parentId: values.parentId } }
          : null,
        values?.companyOwnerId
          ? {
            model: 'company',
            fieldValues: { companyOwnerId: values.companyOwnerId },
          }
          : null,
      ].filter(Boolean),
    });

    // Ensure person exists and compute effective parentId (request value or existing DB value)
    const existingPerson = await prisma.person.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true, parentId: true },
    });
    if (!existingPerson) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Person not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person',
          details: { personId: params?.id },
        }
      );
      logOperationError('updatePerson', req, error);
      throw error;
    }

    const effectiveParentId = values?.parentId ?? existingPerson.parentId;

    // Enforce duplicate rules only for top-level persons (no parent) using effective parentId
    if (!effectiveParentId) {
      const { homePhone, personalMobile, email } = values;
      if (homePhone || personalMobile || email) {
        const dupe = await prisma.person.findFirst({
          where: {
            id: { not: params?.id },
            client: user?.client?.id,
            deleted: null,
            parentId: null,
            OR: [
              ...(homePhone ? [{ homePhone }] : []),
              ...(personalMobile ? [{ personalMobile }] : []),
              ...(email
                ? [{ email: { equals: email, mode: 'insensitive' } }]
                : []),
            ],
          },
          select: { id: true },
        });
        if (dupe) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A person with this phone/email already exists.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_person_duplicate_check',
              details: { homePhone, personalMobile, email },
            }
          );
          throw error;
        }
      }
    }

    // Log database operation start
    logDatabaseStart('update_person', req, {
      personId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.person.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Person not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person',
          details: { personId: params?.id },
        }
      );
      logOperationError('updatePerson', req, error);
      throw error;
    }

    // Fetch updated record for response
    const updatedPerson = await prisma.person.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Log database operation success
    logDatabaseSuccess('update_person', req, {
      id: updatedPerson.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updatePerson', req, {
      id: updatedPerson.id,
      updatedFields: Object.keys(values),
    });

    const [updatedPersonWithDetails] = await getDetailsFromAPI({
      results: [updatedPerson],
      token: user?.accessToken,
    });

    const personWithDisplayValue = enrichRecordDisplayValues(
      updatedPersonWithDetails,
      'Person'
    );

    res.status(200).json(personWithDisplayValue);
  } catch (error) {
    logOperationError('updatePerson', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_person');
  }
}

async function deletePerson(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePerson', req, {
    user: user?.id,
    personId: params?.id,
  });

  try {
    await prisma.personRelationship.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.companyContact.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.customerEnquiry.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.personHistory.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.callSchedule.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.person.updateMany({
      where: { parentId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.personInMarketingList.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunity.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.personSocialMedia.updateMany({
      where: { personId: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_person', req, {
      personId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.person.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person', req, {
      deletedCount: result.count,
      personId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Person not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person',
          details: { personId: params?.id },
        }
      );
      logOperationError('deletePerson', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePerson', req, {
      deletedCount: result.count,
      personId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePerson', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_person');
  }
}

async function getPersonBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for person',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPerson,
  createPerson,
  getPerson,
  getPersonByEmail,
  updatePerson,
  deletePerson,
  getPersonBarChartData,
};
