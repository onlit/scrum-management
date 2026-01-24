/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing marketingList using Prisma.
 * It includes functions for retrieving all marketingList, creating a new marketingList, retrieving a single marketingList,
 * updating an existing marketingList, and deleting a marketingList.
 *
 * The `getAllMarketingList` function retrieves a paginated list of marketingList based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createMarketingList` function validates the request body using a Joi schema, generates a unique code
 * for the marketingList, and creates a new marketingList in the database with additional metadata.
 *
 * The `getMarketingList` function retrieves a single marketingList based on the provided marketingList ID, with visibility
 * filters applied to ensure the marketingList is accessible to the requesting user.
 *
 * The `updateMarketingList` function updates an existing marketingList in the database based on the provided marketingList ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteMarketingList` function deletes a marketingList from the database based on the provided marketingList ID, with
 * visibility filters applied to ensure the marketingList is deletable by the requesting user.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  marketingListCreate,
  marketingListUpdate,
} = require('#schemas/marketingList.schemas.js');
const {
  objectKeysToCamelCase,
  convertKeysToSnakeCase,
} = require('#utils/shared/generalUtils.js');
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
const { logEvent } = require('#utils/shared/loggingUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  findWorkflowAndTrigger,
  triggerAutomata,
} = require('#utils/shared/automataUtils.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getAllMarketingList(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllMarketingList', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = ['name', 'color', 'description'];
    const filterFields = [...searchFields, 'expiryDate'];

    const include = {};

    // Support filtering by linked Person via personId, using customWhere
    let customWhere = {};
    if (query?.personId) {
      customWhere = {
        marketingListPersonInMarketingListMarketingList: {
          some: {
            deleted: null,
            personId: String(query.personId),
          },
        },
      };
    }

    // Log database operation start
    logDatabaseStart('get_all_marketing_list', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: marketingListUpdate,
      filterFields,
      searchFields,
      model: 'marketingList',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Attach display values to all marketing lists
    if (response?.results) {
      response.results = response.results.map((ml) => ({
        ...ml,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(ml, 'MarketingList'),
      }));
    }

    // Log database operation success
    logDatabaseSuccess('get_all_marketing_list', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Log operation success
    logOperationSuccess('getAllMarketingList', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllMarketingList', req, error);
    throw handleDatabaseError(error, 'get_all_marketing_list');
  }
}

async function createMarketingList(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createMarketingList', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await marketingListCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createMarketingList', req, error);
        throw handleValidationError(error, 'marketing_list_creation');
      }
      logOperationError('createMarketingList', req, error);
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

    // Controller-level uniqueness: name must be unique (case-insensitive) within tenant among non-deleted
    try {
      const existingByName = await prisma.marketingList.findFirst({
        where: {
          client: user?.client?.id,
          deleted: null,
          name: { equals: values.name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (existingByName) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'A marketing list with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'create_marketing_list_duplicate_check',
            details: { name: values.name },
          }
        );
        throw error;
      }
    } catch (_e) {
      // best-effort; continue if check fails
    }

    // Log database operation start
    logDatabaseStart('create_marketing_list', req, {
      name: values.name,
      userId: user?.id,
    });

    const newMarketingList = await prisma.marketingList.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_marketing_list', req, {
      id: newMarketingList.id,
      code: newMarketingList.code,
    });

    const [newMarketingListWithDetails] = await getDetailsFromAPI({
      results: [newMarketingList],
      token: user?.accessToken,
    });

    // Attach display value
    const marketingListWithDisplayValue = {
      ...newMarketingListWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        newMarketingListWithDetails,
        'MarketingList'
      ),
    };

    // Log operation success
    logOperationSuccess('createMarketingList', req, {
      id: newMarketingList.id,
      code: newMarketingList.code,
    });

    res.status(201).json(marketingListWithDisplayValue);

    // Fire-and-forget workflow trigger AFTER response for lower latency
    (async () => {
      try {
        await findWorkflowAndTrigger(
          prisma,
          newMarketingList,
          'marketingList',
          user?.client?.id,
          {},
          user?.accessToken
        );
      } catch (_e) {
        // swallow
      }
    })();
  } catch (error) {
    logOperationError('createMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_marketing_list');
  }
}

async function getMarketingList(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getMarketingList', req, {
    user: user?.id,
    marketingListId: params?.id,
  });

  try {
    const include = {};

    // Log database operation start
    logDatabaseStart('get_marketing_list', req, {
      marketingListId: params?.id,
      userId: user?.id,
    });

    const foundMarketingList = await prisma.marketingList.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_marketing_list', req, {
      found: !!foundMarketingList,
      marketingListId: params?.id,
    });

    if (!foundMarketingList) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'MarketingList not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_marketing_list',
          details: { marketingListId: params?.id },
        }
      );
      logOperationError('getMarketingList', req, error);
      throw error;
    }

    const [foundMarketingListWithDetails] = await getDetailsFromAPI({
      results: [foundMarketingList],
      token: user?.accessToken,
    });

    // Attach display value
    const marketingListWithDisplayValue = {
      ...foundMarketingListWithDetails,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(
        foundMarketingListWithDetails,
        'MarketingList'
      ),
    };

    // Log operation success
    logOperationSuccess('getMarketingList', req, {
      id: foundMarketingList.id,
      code: foundMarketingList.code,
    });

    res.status(200).json(marketingListWithDisplayValue);
  } catch (error) {
    logOperationError('getMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_marketing_list');
  }
}

async function updateMarketingList(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateMarketingList', req, {
    marketingListId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await marketingListUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateMarketingList', req, error);
        throw handleValidationError(error, 'marketing_list_update');
      }
      logOperationError('updateMarketingList', req, error);
      throw error;
    }

    // await verifyForeignKeyAccessBatch({
    //   user,
    //   validations: [
    //     // ADD_FOREIGN_KEYS_TO_VERIFY
    //   ],
    // });

    // Controller-level uniqueness on update: name must remain unique in tenant
    try {
      if (values?.name) {
        const dupe = await prisma.marketingList.findFirst({
          where: {
            id: { not: params?.id },
            client: user?.client?.id,
            deleted: null,
            name: { equals: values.name, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (dupe) {
          const error = createErrorWithTrace(
            ERROR_TYPES.VALIDATION,
            'A marketing list with this name already exists for your account.',
            req,
            {
              severity: ERROR_SEVERITY.LOW,
              context: 'update_marketing_list_duplicate_check',
              details: { name: values.name },
            }
          );
          throw error;
        }
      }
    } catch (_e) {
      // best-effort; continue if check fails
    }

    // Log database operation start
    logDatabaseStart('update_marketing_list', req, {
      marketingListId: params?.id,
      updateFields: Object.keys(values),
    });

    const updateResult = await prisma.marketingList.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    if (updateResult.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'MarketingList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_marketing_list',
          details: { marketingListId: params?.id },
        }
      );
      logOperationError('updateMarketingList', req, error);
      throw error;
    }

    const updatedMarketingList = await prisma.marketingList.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
    });

    // Log database operation success
    logDatabaseSuccess('update_marketing_list', req, {
      id: updatedMarketingList.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateMarketingList', req, {
      id: updatedMarketingList.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(updatedMarketingList);

    // Conditional workflow trigger for each person in the marketing list
    const shouldTrigger =
      body?.triggerWorkflow === true ||
      body?.trigger_bpa === true ||
      body?.trigger === true;
    if (
      shouldTrigger &&
      updatedMarketingList &&
      updatedMarketingList.workflowId
    ) {
      (async () => {
        try {
          logEvent(
            `[AUTOMATA_TRIGGER_START] Initiating workflow trigger for marketing list ${updatedMarketingList.id}`,
            req?.traceId
          );
          logEvent(
            `[AUTOMATA_TRIGGER_DETAILS] Workflow ID: ${updatedMarketingList.workflowId}, User: ${user?.id}, Client: ${user?.client?.id}`,
            req?.traceId
          );
          logEvent(
            `[AUTOMATA_TRIGGER_CONDITIONS] triggerWorkflow: ${values?.triggerWorkflow}, trigger_bpa: ${values?.trigger_bpa}, trigger: ${values?.trigger}`,
            req?.traceId
          );

          logEvent(
            `[AUTOMATA_TRIGGER_FETCH_PERSONS] Fetching persons from marketing list ${updatedMarketingList.id}`,
            req?.traceId
          );
          const persons = await prisma.personInMarketingList.findMany({
            where: {
              marketingListId: updatedMarketingList.id,
              deleted: null,
              workflowInstanceId: null,
              client: user?.client?.id,
            },
            select: {
              id: true,
              person: true,
            },
          });

          logEvent(
            `[AUTOMATA_TRIGGER_PERSONS_FOUND] Found ${persons.length} persons eligible for workflow trigger`,
            req?.traceId
          );

          let processedCount = 0;
          let successCount = 0;
          let skippedCount = 0;

          for (const row of persons) {
            const person = row?.person;
            if (!person) {
              logEvent(
                `[AUTOMATA_TRIGGER_SKIP] Person data missing for row ${row.id}, skipping`,
                req?.traceId
              );
              skippedCount++;
              continue;
            }

            logEvent(
              `[AUTOMATA_TRIGGER_PROCESSING] Processing person ${person.id} (${
                person.firstName || 'Unknown'
              } ${person.lastName || ''})`,
              req?.traceId
            );

            const personData = convertKeysToSnakeCase(person);
            logEvent(
              `[AUTOMATA_TRIGGER_DATA] Person data keys: ${Object.keys(
                personData
              ).join(', ')}`,
              req?.traceId
            );

            const automataResponse = await triggerAutomata(
              user?.accessToken,
              updatedMarketingList.workflowId,
              '',
              false,
              {
                ...person,
                ...personData,
              }
            );

            if (!automataResponse) {
              logEvent(
                `[AUTOMATA_TRIGGER_FAILED] Automata trigger failed for person ${person.id} - no response received`,
                req?.traceId
              );
              skippedCount++;
              continue;
            }

            logEvent(
              `[AUTOMATA_TRIGGER_RESPONSE] Received automata response for person ${person.id}`,
              req?.traceId
            );

            const { instance: newWorkflowInstance } = automataResponse;

            if (!newWorkflowInstance) {
              logEvent(
                `[AUTOMATA_TRIGGER_INVALID_RESPONSE] Automata response missing 'instance' property for workflow '${updatedMarketingList.workflowId}' and person ${person.id}`,
                req?.traceId
              );
              logEvent(
                `[AUTOMATA_TRIGGER_RESPONSE_DEBUG] Full response keys: ${Object.keys(
                  automataResponse
                ).join(', ')}`,
                req?.traceId
              );
              skippedCount++;
              continue;
            }

            logEvent(
              `[AUTOMATA_TRIGGER_INSTANCE_CREATED] Workflow instance ${newWorkflowInstance} created for person ${person.id}`,
              req?.traceId
            );

            await prisma.personInMarketingList.updateMany({
              where: { id: row.id },
              data: {
                workflowId: updatedMarketingList.workflowId,
                workflowInstanceId: newWorkflowInstance,
              },
            });

            logEvent(
              `[AUTOMATA_TRIGGER_DB_UPDATE] Updated personInMarketingList record ${row.id} with workflow instance ${newWorkflowInstance}`,
              req?.traceId
            );
            successCount++;
            processedCount++;
          }

          logEvent(
            `[AUTOMATA_TRIGGER_SUMMARY] Processing complete - Total: ${persons.length}, Processed: ${processedCount}, Successful: ${successCount}, Skipped: ${skippedCount}`,
            req?.traceId
          );
        } catch (_e) {
          logEvent(
            `[AUTOMATA_TRIGGER_ERROR] Error occurred while triggering automata for persons: ${_e.message}`,
            req?.traceId
          );
          logEvent(`[AUTOMATA_TRIGGER_ERROR_STACK] ${_e.stack}`, req?.traceId);
          // swallow
        }
      })();
    } else {
      logEvent(
        `[AUTOMATA_TRIGGER_SKIPPED] Workflow trigger conditions not met - shouldTrigger: ${shouldTrigger}, hasWorkflowId: ${!!updatedMarketingList?.workflowId}`,
        req?.traceId
      );
    }
  } catch (error) {
    logOperationError('updateMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_marketing_list');
  }
}

async function deleteMarketingList(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('deleteMarketingList', req, {
    user: user?.id,
    marketingListId: params?.id,
  });

  try {
    await prisma.personInMarketingList.updateMany({
      where: {
        marketingListId: params?.id,
        client: user?.client?.id,
        deleted: null,
      },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_marketing_list', req, {
      marketingListId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.marketingList.updateMany({
      where: { id: params?.id, client: user?.client?.id, deleted: null },
      data: {
        deleted: new Date(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_marketing_list', req, {
      deletedCount: result.count,
      marketingListId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'MarketingList not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_marketing_list',
          details: { marketingListId: params?.id },
        }
      );
      logOperationError('deleteMarketingList', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteMarketingList', req, {
      deletedCount: result.count,
      marketingListId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteMarketingList', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_marketing_list');
  }
}

async function getMarketingListBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for marketingList',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllMarketingList,
  createMarketingList,
  getMarketingList,
  updateMarketingList,
  deleteMarketingList,
  getMarketingListBarChartData,
};
