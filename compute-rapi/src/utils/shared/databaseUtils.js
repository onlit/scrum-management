const _ = require('lodash');
const prisma = require('#configs/prisma.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const { isObject } = require('#utils/shared/generalUtils.js');
// Note: Using _.camelCase directly here to avoid circular dependency
// (stringUtils → databaseUtils → stringUtils)
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const { logEvent } = require('#utils/shared/loggingUtils.js');

async function isCodeUnique(prisma, code, clientId) {
  return !(await prisma.block.findFirst({
    where: { code, client: clientId },
  }));
}

/**
 * Renormalizes the `order` field for a given model to be strictly sequential (1, 2, 3,...).
 * WARNING: This can be resource-intensive as it reads and potentially updates
 * many rows within the specified conditions.
 *
 * @param {Object} params
 * @param {string} params.modelName - The name of the Prisma model (e.g., "fieldDefn").
 * @param {string} params.orderField - The name of the `order` field (default is "order").
 * @param {Object} params.conditions - Conditions to filter the records to renormalize (e.g., { modelId: 'xyz' }).
 * @param {Object} params.prisma - The Prisma client instance (or transaction client).
 */
async function renormalizeOrders({
  modelName,
  orderField = 'order',
  conditions,
  prisma: prismaClient, // Use the passed client
} = {}) {
  if (!prismaClient) {
    logEvent('[RENORMALIZE_ORDERS_ERROR] Prisma client instance is required');
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Prisma client instance is required for renormalizeOrders',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'renormalize_orders',
      }
    );
  }
  if (!conditions || Object.keys(conditions).length === 0) {
    logEvent(
      '[RENORMALIZE_ORDERS_ERROR] Conditions are required to scope the renormalization.'
    );
    throw createStandardError(
      ERROR_TYPES.BAD_REQUEST,
      'Conditions are required to scope the renormalization.',
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'renormalize_orders',
      }
    );
  }
  logEvent(
    `Renormalizing order for ${modelName} with conditions: ${JSON.stringify(conditions)}`
  );

  // 1. Fetch all items matching the conditions, ordered by their *current* order.
  //    Select only the id and current order field for efficiency.
  const itemsToRenormalize = await prismaClient[modelName].findMany({
    where: conditions,
    select: {
      id: true, // Need the ID to update
      [orderField]: true, // Need the current order to check if update is needed
    },
    orderBy: {
      [orderField]: 'asc',
    },
  });

  if (itemsToRenormalize.length === 0) {
    logEvent('No items found matching conditions, skipping renormalization.');
    return; // Nothing to do
  }

  logEvent(
    `Found ${itemsToRenormalize.length} items to potentially renormalize.`
  );

  // 2. Create promises for updates where the order needs changing.
  const updatePromises = [];
  itemsToRenormalize.forEach((item, index) => {
    const expectedOrder = index + 1; // Order should be 1, 2, 3, ...
    const currentOrder = item[orderField];

    // Only update if the current order is not the expected sequential order
    if (currentOrder !== expectedOrder) {
      logEvent(
        `Updating ${modelName} id ${item.id} from order ${currentOrder} to ${expectedOrder}`
      );
      updatePromises.push(
        prismaClient[modelName].update({
          where: { id: item.id },
          data: {
            [orderField]: expectedOrder,
          },
          select: { id: true }, // Don't need the full updated record here
        })
      );
    }
  });

  // 3. Execute all necessary updates concurrently.
  if (updatePromises.length > 0) {
    logEvent(`Executing ${updatePromises.length} order update(s).`);
    await Promise.all(updatePromises);
    logEvent(`Finished ${updatePromises.length} order update(s).`);
  } else {
    logEvent('All items are already in correct sequential order.');
  }
}

/**
 * Rebase the `order` field for a given model.
 *
 * @param {Object} params
 * @param {string} params.modelName - The name of the Prisma model (e.g., "menuDefn").
 * @param {string} params.orderField - The name of the `order` field (default is "order").
 * @param {Object} params.conditions - Additional conditions to filter the records (e.g., microserviceId).
 * @param {number} params.order - The `order` value to start rebasing from.
 * @param {Object} params.prisma - The Prisma client instance.
 */
async function rebaseOrders({
  modelName,
  orderField = 'order',
  conditions,
  order,
} = {}) {
  const whereConditions = {
    ...conditions,
    [orderField]: {
      gte: order,
    },
  };

  const updateData = {
    [orderField]: {
      increment: 1,
    },
  };

  // Dynamically update the specified model
  await prisma[modelName].updateMany({
    where: whereConditions,
    data: updateData,
  });
}

/**
 * Validates access to foreign keys across multiple models for a given user within a single transaction.
 * This function ensures that the current user has access to specified records, based on foreign keys, across different models.
 * It checks if the record exists and if the user has the visibility/access rights to it.
 *
 * @param {Object} params - The parameters for the function.
 * @param {Object} params.user - The user object to apply visibility filters based on user permissions.
 * @param {Array} params.validations - An array of validation objects, each specifying a model, and the fields with values to validate.
 *    Each validation object includes:
 *    - model: The name of the model (e.g., 'form') as defined in your ORM schema.
 *    - fieldValues: An object where each key is a field name to check, and the value is the foreign key to validate.
 *
 * @throws {Error} Throws an error if any of the validations fail, with a message indicating the invalid field and model.
 *
 * Example usage:
 * await verifyForeignKeyAccessBatch({
 *   user,
 *   validations: [
 *     {
 *       model: 'form',
 *       fieldValues: { formId },
 *     },
 *     {
 *       model: 'group',
 *       fieldValues: { groupId },
 *     },
 *   ],
 * });
 */
async function verifyForeignKeyAccessBatch({ user, validations } = {}) {
  // Prepare the queries and track their corresponding model and fieldName
  const queryIdentifiers = [];

  const queries = validations.reduce((acc, validation) => {
    Object.entries(validation?.fieldValues ?? {}).forEach(
      ([fieldName, fieldValue]) => {
        const model = validation?.model;
        if (model && fieldValue) {
          // Push an identifier for each query to match them with their results later
          queryIdentifiers.push({ model, fieldName });

          // Only add the Prisma findFirst call for truthy fieldValue, avoiding unnecessary queries
          acc.push(
            prisma?.[model].findFirst({
              where: {
                id: fieldValue,
                ...getVisibilityFilters(user),
              },
              select: { id: true },
            })
          );
        }
      }
    );
    return acc;
  }, []);

  // Execute all the queries within a single transaction
  const results = await prisma.$transaction(queries);

  // Iterate over the results to find any null responses indicating a failed validation
  const failedIndex = results.findIndex((result) => result === null);

  if (failedIndex !== -1) {
    // Use the failedIndex to find the corresponding model and field from queryIdentifiers
    const { model, fieldName } = queryIdentifiers[failedIndex];
    throw createStandardError(
      ERROR_TYPES.VALIDATION,
      `Invalid ${fieldName} in ${model}.`,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'validate_foreign_keys_db',
        details: { model, fieldName, failedIndex },
      }
    );
  }
}

/**
 * Generates filters and search queries for a list page.
 *
 * @async
 * @function getListFiltersAndQueries
 *
 * @param {Object} options - The options object.
 * @param {Object} options.user - The user object.
 * @param {String} options.search - The search string.
 * @param {Object} options.filters - The filter object.
 * @param {Object} options.schema - The schema object.
 * @param {Array} options.filterFields - The fields to filter on.
 * @param {Array} options.searchFields - The fields to search on.
 *
 * @returns {Promise<Object>} The where object.
 */
async function getListFiltersAndQueries({
  user,
  search,
  filters,
  schema,
  filterFields,
  searchFields,
}) {
  const where = { ...getVisibilityFilters(user) };
  const filterKeys = Object.keys(filters);

  if (filterKeys.length) {
    const validatedQuery = await schema.validateAsync(filters, {
      stripUnknown: true,
      abortEarly: false,
    });

    for (const field of filterKeys) {
      const value = validatedQuery[field];
      if (filterFields.includes(field) && !!value) {
        where.AND.push({
          [_.camelCase(field)]: { equals: value === 'null' ? null : value },
        });
      }
    }
  }

  if (searchFields.length && search) {
    const searchConditions = searchFields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));

    where.AND.push({ OR: searchConditions });
  }

  return where;
}

/**
 * Returns a paginated list of items for the provided model.
 *
 * @async
 * @function getPaginatedList
 *
 * @param {Object} options - The options object.
 * @param {Object} options.query - The query object containing pagination and filtering parameters.
 * @param {Object} options.user - The user object used for authorization.
 * @param {Object} options.schema - The schema object used for filtering and querying.
 * @param {Array} options.filterFields - The fields to use for filtering.
 * @param {Array} options.searchFields - The fields to use for searching.
 * @param {Object} options.prisma - The Prisma client instance used for database operations.
 * @param {string} options.model - The name of the Prisma model to query.
 *
 * @returns {Promise<Object>} Returns an object containing the paginated list and pagination metadata.
 */
async function getPaginatedList({
  query,
  user,
  schema,
  filterFields,
  searchFields,
  prisma,
  model,
  include,
  select,
  customWhere = {},
}) {
  // Generate a unique identifier for the labels
  // const uniqueId = Date.now() + Math.random();

  // console.time(`Total Execution Time ${uniqueId}`);

  // Start timestamp for parsing query parameters
  // console.time(`Parse Query Parameters ${uniqueId}`);
  const { pageSize, page, search, ordering = '', ...filters } = query;
  // console.timeEnd(`Parse Query Parameters ${uniqueId}`);

  // Start timestamp for generating filters and queries
  // console.time(`Generate Filters and Queries ${uniqueId}`);
  const filtersAndQueries = await getListFiltersAndQueries({
    user,
    search,
    filters,
    schema,
    filterFields,
    searchFields,
  });
  // console.timeEnd(`Generate Filters and Queries ${uniqueId}`);

  // Merge filters and custom where conditions
  // console.time(`Merge Where Conditions ${uniqueId}`);
  const where = { ...filtersAndQueries, ...customWhere };
  // console.timeEnd(`Merge Where Conditions ${uniqueId}`);

  // Calculate pagination details
  // console.time(`Calculate Pagination ${uniqueId}`);
  const perPage = +(pageSize ?? 10);
  const currentPage = +(page ?? 1);
  const skip = (currentPage - 1) * perPage;
  const filterWithMixins = [...filterFields, 'createdAt', 'updatedAt'];
  // console.timeEnd(`Calculate Pagination ${uniqueId}`);

  // Determine ordering
  // console.time(`Determine Ordering ${uniqueId}`);
  const hasHyphen =
    typeof ordering === 'string' ? ordering.startsWith('-') : false;
  const orderingWithoutHyphen = hasHyphen ? ordering.substring(1) : ordering;
  const orderCol = filterWithMixins.includes(orderingWithoutHyphen)
    ? orderingWithoutHyphen
    : 'id';
  const orderBy = { [orderCol]: ordering && !hasHyphen ? 'asc' : 'desc' };
  // console.timeEnd(`Determine Ordering ${uniqueId}`);

  // Check include and select validity
  // console.time(`Validate Include and Select ${uniqueId}`);
  const hasValidInclude = isObject(include) && Object.keys(include)?.length;
  const hasValidSelect = isObject(select) && Object.keys(select)?.length;
  // console.timeEnd(`Validate Include and Select ${uniqueId}`);

  // Execute database transactions
  // console.time(`Execute Database Transactions ${uniqueId}`);
  const [totalCount, items] = await prisma.$transaction([
    prisma[model].count({ where: { ...where, deleted: null } }),
    prisma[model].findMany({
      where,
      orderBy,
      include: hasValidInclude ? include : undefined,
      select: hasValidSelect ? select : undefined,
      skip,
      take: perPage,
    }),
  ]);
  // console.timeEnd(`Execute Database Transactions ${uniqueId}`);

  // Calculate page count
  // console.time(`Calculate Page Count ${uniqueId}`);
  const pageCount = Math.ceil(totalCount / perPage);
  // console.timeEnd(`Calculate Page Count ${uniqueId}`);

  const results =
    (await getDetailsFromAPI({
      results: items,
      token: user?.accessToken,
    })) ?? [];

  // Return the final paginated response
  // console.timeEnd(`Total Execution Time ${uniqueId}`);
  return {
    totalCount,
    pageCount,
    currentPage,
    perPage,
    results,
  };
}

module.exports = {
  isCodeUnique,
  getListFiltersAndQueries,
  getPaginatedList,
  verifyForeignKeyAccessBatch,
  rebaseOrders,
  renormalizeOrders,
};

// ARCHIVED - REVISIT LATER
// /**
//  * Returns a paginated list of items for the provided model.
//  *
//  * @async
//  * @function getPaginatedList
//  *
//  * @param {Object} options - The options object.
//  * @param {Object} options.query - The query object containing pagination and filtering parameters.
//  * @param {Object} options.user - The user object used for authorization.
//  * @param {Object} options.schema - The schema object used for filtering and querying.
//  * @param {Array} options.filterFields - The fields to use for filtering.
//  * @param {Array} options.searchFields - The fields to use for searching.
//  * @param {Object} options.prisma - The Prisma client instance used for database operations.
//  * @param {string} options.model - The name of the Prisma model to query.
//  *
//  * @returns {Promise<Object>} Returns an object containing the paginated list and pagination metadata.
//  */
// async function getPaginatedList({
//   query,
//   user,
//   schema,
//   filterFields,
//   searchFields,
//   prisma,
//   model,
//   include,
// }) {
//   const { pageSize, after, before, search, ordering = '', ...filters } = query;

//   const where = await getListFiltersAndQueries({
//     user,
//     search,
//     filters,
//     schema,
//     filterFields,
//     searchFields,
//   });

//   const cursor = after ?? before ?? null;
//   const cursorQuery = cursor ? { id: cursor } : undefined;
//   const perPage = +pageSize ?? 10;
//   const negativeTake = Math.abs(perPage) * -1;
//   const take = Math.abs(perPage);

//   const hasHyphen = ordering.startsWith('-');
//   const orderingWithoutHyphen = hasHyphen ? ordering.substring(1) : ordering;
//   const orderCol = filterFields.includes(orderingWithoutHyphen)
//     ? orderingWithoutHyphen
//     : 'id';

//   const orderBy = { [orderCol]: ordering && !hasHyphen ? 'asc' : 'desc' };

//   const [totalCount, items] = await prisma.$transaction([
//     prisma[model].count({ where }),
//     prisma[model].findMany({
//       take: before ? negativeTake : take,
//       skip: cursor ? 1 : 0,
//       cursor: cursorQuery,
//       where,
//       orderBy,
//       include: include ?? undefined,
//     }),
//   ]);

//   const [firstItem] = items;
//   const lastItem = items.at(-1);
//   let startCursor = firstItem?.id ?? null;
//   let endCursor = lastItem?.id ?? null;

//   let nextItem = [];
//   let prevItem = [];

//   if (startCursor ?? endCursor) {
//     [nextItem, prevItem] = await prisma.$transaction([
//       prisma[model].findMany({
//         take: 1,
//         skip: 1,
//         where,
//         select: { id: true },
//         cursor: endCursor ? { id: endCursor } : undefined,
//         orderBy,
//       }),
//       prisma[model].findMany({
//         take: -1,
//         skip: 1,
//         where,
//         select: { id: true },
//         cursor: startCursor ? { id: startCursor } : undefined,
//         orderBy,
//       }),
//     ]);
//   }

//   const hasNextPage = !!nextItem.length;
//   const hasPreviousPage = !!prevItem.length;

//   if (!hasNextPage) {
//     endCursor = null;
//   }

//   if (!hasPreviousPage) {
//     startCursor = null;
//   }

//   return {
//     totalCount,
//     perPage,
//     hasNextPage,
//     hasPreviousPage,
//     startCursor,
//     endCursor,
//     results: items,
//   };
// }
// ARCHIVED - REVISIT LATER
