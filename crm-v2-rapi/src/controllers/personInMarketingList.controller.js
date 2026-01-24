/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing personInMarketingList using Prisma.
 * It includes functions for retrieving all personInMarketingList, creating a new personInMarketingList, retrieving a single personInMarketingList,
 * updating an existing personInMarketingList, and deleting a personInMarketingList.
 *
 * The `getAllPersonInMarketingList` function retrieves a paginated list of personInMarketingList based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createPersonInMarketingList` function validates the request body using a Joi schema, generates a unique code
 * for the personInMarketingList, and creates a new personInMarketingList in the database with additional metadata.
 *
 * The `getPersonInMarketingList` function retrieves a single personInMarketingList based on the provided personInMarketingList ID, with visibility
 * filters applied to ensure the personInMarketingList is accessible to the requesting user.
 *
 * The `updatePersonInMarketingList` function updates an existing personInMarketingList in the database based on the provided personInMarketingList ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deletePersonInMarketingList` function deletes a personInMarketingList from the database based on the provided personInMarketingList ID, with
 * visibility filters applied to ensure the personInMarketingList is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const validator = require('validator');
const {
  personInMarketingListCreate,
  personInMarketingListUpdate,
} = require('#schemas/personInMarketingList.schemas.js');
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
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const { findWorkflowAndTrigger } = require('#utils/shared/automataUtils.js');
const {
  computeDisplayValue,
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function getAllPersonInMarketingList(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllPersonInMarketingList', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['color'];
    const filterFields = [
      ...searchFields,
      'expiryDate',
      'marketingListId',
      'personId',
    ];

    const include = {
      marketingList: true,
      person: true,
    };

    // Support relational search (person name/email, marketing list name)
    let customWhere = {};
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      customWhere = {
        OR: [
          { person: { firstName: { contains: rawSearch, mode: 'insensitive' } } },
          { person: { middleName: { contains: rawSearch, mode: 'insensitive' } } },
          { person: { lastName: { contains: rawSearch, mode: 'insensitive' } } },
          { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
          { marketingList: { name: { contains: rawSearch, mode: 'insensitive' } } },
        ],
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_person_in_marketing_list', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: personInMarketingListUpdate,
      filterFields,
      searchFields,
      model: 'personInMarketingList',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values (including nested relations) to all records
    if (response?.results) {
      response.results = response.results.map((record) =>
        enrichRecordDisplayValues(record, 'PersonInMarketingList')
      );
    }

    // Log database operation success
    logDatabaseSuccess('get_all_person_in_marketing_list', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllPersonInMarketingList', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllPersonInMarketingList', req, error);
    throw handleDatabaseError(error, 'get_all_person_in_marketing_list');
  }
}

async function createPersonInMarketingList(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createPersonInMarketingList', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personInMarketingListCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createPersonInMarketingList', req, error);
        throw handleValidationError(error, 'person_in_marketing_list_creation');
      }
      logOperationError('createPersonInMarketingList', req, error);
      throw error;
    }

    const modelRelationFields = ['marketingListId', 'personId'];

    const include = {
      marketingList: true,
      person: true,
    };

    // Verify FK access for marketingListId and personId
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        { model: 'marketingList', id: values.marketingListId },
        { model: 'person', id: values.personId },
      ],
    });

    // Controller-level uniqueness: a person can be in a marketing list only once (soft-delete aware)
    try {
      const existing = await prisma.personInMarketingList.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          marketingListId: values.marketingListId,
          personId: values.personId,
        },
        select: { id: true },
      });
      if (existing) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'This person is already in the selected marketing list.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_person_in_marketing_list_duplicate_check',
            details: {
              marketingListId: values.marketingListId,
              personId: values.personId,
            },
          }
        );
        throw error;
      }
    } catch (e) {
      // Re-throw validation errors, ignore database lookup failures
      if (e?.type === ERROR_TYPES.VALIDATION) {
        throw e;
      }
      // best-effort for other errors (e.g., database connectivity issues)
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_person_in_marketing_list', req, {
      name: values.name,
      userId: user?.id,
    });

    const newPersonInMarketingList = await prisma.personInMarketingList.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_person_in_marketing_list', req, {
      id: newPersonInMarketingList.id,
      code: newPersonInMarketingList.code,
    });

    const [newPersonInMarketingListWithDetails] = await getDetailsFromAPI({
      results: [newPersonInMarketingList],
      token: user?.accessToken,
    });

    // Attach display value (including nested relations)
    const personInMarketingListWithDisplayValue = enrichRecordDisplayValues(
      newPersonInMarketingListWithDetails,
      'PersonInMarketingList'
    );

    // Log operation success
    logOperationSuccess('createPersonInMarketingList', req, {
      id: newPersonInMarketingList.id,
      code: newPersonInMarketingList.code,
    });

    res.status(201).json(personInMarketingListWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newPersonInMarketingList,
          'personInMarketingList',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow
      }
    })();
  } catch (error) {
    logOperationError('createPersonInMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_person_in_marketing_list');
  }
}

async function getPersonInMarketingList(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonInMarketingList', req, {
    user: user?.id,
    personInMarketingListId: params?.id,
  });

  try {
    const include = {
      marketingList: true,
      person: true,
    };

    // Log database operation start
    logDatabaseStart('get_person_in_marketing_list', req, {
      personInMarketingListId: params?.id,
      userId: user?.id,
    });

    const foundPersonInMarketingList =
      await prisma.personInMarketingList.findFirst({
        where: {
          id: params?.id,
          ...getVisibilityFilters(user),
        },
        include: Object.keys(include).length ? include : undefined,
      });

    // Log database operation success
    logDatabaseSuccess('get_person_in_marketing_list', req, {
      found: !!foundPersonInMarketingList,
      personInMarketingListId: params?.id,
    });

    if (!foundPersonInMarketingList) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonInMarketingList not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_in_marketing_list',
          details: { personInMarketingListId: params?.id },
        }
      );
      logOperationError('getPersonInMarketingList', req, error);
      throw error;
    }

    const [foundPersonInMarketingListWithDetails] = await getDetailsFromAPI({
      results: [foundPersonInMarketingList],
      token: user?.accessToken,
    });

    // Attach display value
    const personInMarketingListWithDisplayValue = enrichRecordDisplayValues(
      foundPersonInMarketingListWithDetails,
      'PersonInMarketingList'
    );

    // Log operation success
    logOperationSuccess('getPersonInMarketingList', req, {
      id: foundPersonInMarketingList.id,
      code: foundPersonInMarketingList.code,
    });

    res.status(200).json(personInMarketingListWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonInMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person_in_marketing_list');
  }
}

async function updatePersonInMarketingList(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updatePersonInMarketingList', req, {
    personInMarketingListId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personInMarketingListUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updatePersonInMarketingList', req, error);
        throw handleValidationError(error, 'person_in_marketing_list_update');
      }
      logOperationError('updatePersonInMarketingList', req, error);
      throw error;
    }

    // Verify FK access where provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.marketingListId
          ? { model: 'marketingList', id: values.marketingListId }
          : null,
        values?.personId ? { model: 'person', id: values.personId } : null,
      ].filter(Boolean),
    });

    // Uniqueness on update with effective next values
    try {
      const nextMarketingListId = values?.marketingListId;
      const nextPersonId = values?.personId;
      if (nextMarketingListId || nextPersonId) {
        // Fetch current to compute effective next
        const current = await prisma.personInMarketingList.findFirst({
          where: { id: params?.id, ...getVisibilityFilters(user) },
          select: { marketingListId: true, personId: true },
        });
        if (!current) {
          const error = createErrorWithTrace(
            ERROR_TYPES.NOT_FOUND,
            'PersonInMarketingList not found or not accessible',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_person_in_marketing_list',
              details: { id: params?.id },
            }
          );
          throw error;
        }
        const effMarketingListId =
          nextMarketingListId || current.marketingListId;
        const effPersonId = nextPersonId || current.personId;
        const dupe = await prisma.personInMarketingList.findFirst({
          where: {
            id: { not: params?.id },
            client: user?.client?.id,
            deleted: null,
            marketingListId: effMarketingListId,
            personId: effPersonId,
          },
          select: { id: true },
        });
        if (dupe) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'This person is already in the selected marketing list.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_person_in_marketing_list_duplicate_check',
              details: {
                marketingListId: effMarketingListId,
                personId: effPersonId,
              },
            }
          );
          throw error;
        }
      }
    } catch (e) {
      // Re-throw validation errors, ignore database lookup failures
      if (e?.type === ERROR_TYPES.VALIDATION) {
        throw e;
      }
      // best-effort for other errors (e.g., database connectivity issues)
    }

    // Guard: ensure visibility before update
    const visible = await prisma.personInMarketingList.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    if (!visible) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonInMarketingList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_person_in_marketing_list',
          details: { id: params?.id },
        }
      );
      logOperationError('updatePersonInMarketingList', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('update_person_in_marketing_list', req, {
      personInMarketingListId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedPersonInMarketingList =
      await prisma.personInMarketingList.update({
        where: { id: params?.id },
        data: {
          ...objectKeysToCamelCase(values),
          updatedBy: user?.id,
        },
        include: { marketingList: true, person: true },
      });

    // Attach display value
    const personInMarketingListWithDisplayValue = enrichRecordDisplayValues(
      updatedPersonInMarketingList,
      'PersonInMarketingList'
    );

    // Log database operation success
    logDatabaseSuccess('update_person_in_marketing_list', req, {
      id: updatedPersonInMarketingList.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updatePersonInMarketingList', req, {
      id: updatedPersonInMarketingList.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(personInMarketingListWithDisplayValue);
  } catch (error) {
    logOperationError('updatePersonInMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_person_in_marketing_list');
  }
}

async function deletePersonInMarketingList(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deletePersonInMarketingList', req, {
    user: user?.id,
    personInMarketingListId: params?.id,
  });

  try {
    // Log database operation start
    logDatabaseStart('delete_person_in_marketing_list', req, {
      personInMarketingListId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.personInMarketingList.updateMany({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_person_in_marketing_list', req, {
      deletedCount: result.count,
      personInMarketingListId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'PersonInMarketingList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_person_in_marketing_list',
          details: { personInMarketingListId: params?.id },
        }
      );
      logOperationError('deletePersonInMarketingList', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deletePersonInMarketingList', req, {
      deletedCount: result.count,
      personInMarketingListId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deletePersonInMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_person_in_marketing_list');
  }
}

async function getPersonInMarketingListBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for personInMarketingList',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllPersonInMarketingList,
  createPersonInMarketingList,
  getPersonInMarketingList,
  updatePersonInMarketingList,
  deletePersonInMarketingList,
  getPersonInMarketingListBarChartData,
};
