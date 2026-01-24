/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file configures Prisma ORM for database operations in the compute microservice.
 * It initializes the Prisma client and defines middleware functions to intercept and modify
 * database queries, specifically targeting soft deletion logic and database operation logging.
 *
 * - Soft Deletion Middleware:
 *   - It intercepts 'findUnique', 'findFirst', and 'findMany' actions to exclude soft-deleted records.
 *   - For 'delete' and 'deleteMany' actions, it updates the 'deleted' field with the current timestamp.
 *   - This middleware ensures that soft-deleted records are excluded from query results by default.
 *
 * - Database Operation Logging Middleware:
 *   - It intercepts 'create' and 'updateMany' actions to log database changes.
 *   - When a new record is created, it logs the addition with the microservice name, model, object ID,
 *     before and after action content, action date time, and action type.
 *   - When multiple records are updated, it logs the changes for each record, capturing the before and
 *     after action content, action date time, and action type (change or deletion).
 *   - Logged payloads are exported using the 'exportDBLogs' function from the loggingUtils module.
 *
 * Note: The soft deletion middleware and the database operation logging middleware are commented out
 *       by default. They are prepared for potential use cases that require soft deletion logic and
 *       database operation logging. Uncommenting these middleware should be done cautiously,
 *       ensuring compatibility with existing database operations and application logic.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 */

const { PrismaClient } = require('@prisma/client');
const { MS_NAME } = require('#configs/constants.js');
const { exportDBLogs } = require('#utils/shared/apiUtils.js');

// {
//   log: [
//     {
//       emit: 'event',
//       level: 'query',
//     },
//   ],
// }
const prisma = new PrismaClient();

// prisma.$on('query', (e) => {
//   console.log('==============================================================');
//   console.log('Query: ', e.query);
//   console.log('Params: ', e.params);
//   console.log('Duration: ', e.duration, 'ms');
//   console.log(
//     '==============================================================\n\n'
//   );
// });

prisma.$use(async (params, next) => {
  if (params.action === 'findUnique' || params.action === 'findFirst') {
    // Change to findFirst - you cannot filter
    // by anything except ID / unique with findUnique
    params.action = 'findFirst';
    // Add 'deleted' filter
    // ID filter maintained
    if (params.args.where) {
      params.args.where.deleted = null;
    }
  }
  if (params.action === 'findMany') {
    // Find many queries
    if (params.args.where) {
      if (params.args.where.deleted === undefined) {
        // Exclude deleted records if they have not been explicitly requested
        params.args.where.deleted = null;
      }
    } else {
      params.args.where = { deleted: null };
    }
  }
  return next(params);
});

/**
 * This middleware is designed for use with Prisma ORM to intercept and modify
 * database operations, specifically targeting update actions to accommodate
 * soft deletion logic. It ensures that update operations do not inadvertently
 * affect soft-deleted records unless explicitly intended.
 *
 * - For 'update' actions, it automatically converts them to 'updateMany' actions.
 *   This is because 'update' actions in Prisma are restricted to filtering by ID or
 *   unique fields only, and cannot include a 'deleted' filter to exclude soft-deleted records.
 *   By changing the action to 'updateMany', it allows for additional filtering based on
 *   the 'deleted' field. It ensures that only records which are not marked as deleted
 *   ('deleted' field is null) are updated.
 *
 * - For 'updateMany' actions, it injects a condition to exclude soft-deleted records
 *   (where 'deleted' is null) if the 'where' clause is defined. If the 'where' clause
 *   is not defined, it creates a new 'where' clause to exclude soft-deleted records.
 *
 * This middleware has been commented out as there is currently no use case that requires
 * filtering out soft-deleted records on update operations within the application. It's
 * prepared to support undelete functionalities for soft-deleted records, ensuring that
 * only active (not deleted) records are considered for updates. This implementation should
 * be revisited and potentially uncommented on a case-by-case basis when the need arises to
 * accommodate specific logic for handling soft deletes or undelete operations.
 *
 * Note: If uncommented for use, it's crucial to assess the impact on update operations
 * across the application, ensuring that this global filter aligns with all use cases and
 * does not unintentionally prevent legitimate update operations on soft-deleted records
 * where such actions might be desired.
 */
// prisma.$use(async (params, next) => {
//   if (params.action === 'update') {
//     // Change to updateMany - you cannot filter
//     // by anything except ID / unique with findUnique
//     params.action = 'updateMany';
//     // Add 'deleted' filter
//     // ID filter maintained
//     params.args.where.deleted = null;
//   }
//   if (params.action === 'updateMany') {
//     if (params.args.where !== undefined) {
//       params.args.where.deleted = null;
//     } else {
//       params.args.where = { deleted: null };
//     }
//   }
//   return next(params);
// });

prisma.$use(async (params, next) => {
  const now = new Date().toISOString();

  // Check incoming query type
  if (params.action === 'delete') {
    // Delete queries
    // Change action to an update
    params.action = 'update';
    params.args.data = { deleted: now };
  }

  if (params.action === 'deleteMany') {
    // Delete many queries
    params.action = 'updateMany';

    if (params.args.data !== undefined) {
      params.args.data.deleted = now;
    } else {
      params.args.data = { deleted: now };
    }
  }

  return next(params);
});

prisma.$use(async (params, next) => {
  const actionsToLog = ['create', 'updateMany'];

  if (!actionsToLog.includes(params?.action)) return next(params);

  const actionDatetime = new Date().toISOString();
  const logPayloads = [];
  let resp = null;

  if (params?.action === 'create') {
    resp = await next(params);
    logPayloads.push({
      microservice: MS_NAME,
      model: params.model,
      object_id: resp?.id,
      before_action_content: JSON.stringify({}),
      after_action_content: JSON.stringify(resp),
      action_datetime: actionDatetime,
      action: 'Addition',
    });
  } else if (params?.action === 'updateMany') {
    // Batch fetch with limit (e.g., 1000) to avoid OOM
    let beforeInstances = [];
    let cursor;
    do {
      const batch = await prisma[params?.model].findMany({
        where: params?.args?.where,
        take: 1000,
        skip: cursor ? 1 : 0,
        cursor,
      });
      beforeInstances = beforeInstances.concat(batch);
      cursor = batch.length ? { id: batch[batch.length - 1].id } : undefined;
    } while (cursor);

    resp = await next(params);

    beforeInstances.forEach((instance) => {
      logPayloads.push({
        microservice: MS_NAME,
        model: params.model,
        object_id: instance?.id,
        before_action_content: JSON.stringify({ ...instance }),
        after_action_content: JSON.stringify({
          ...instance,
          ...params?.args?.data,
        }),
        action_datetime: actionDatetime,
        action: params?.args?.data?.deleted ? 'Deletion' : 'Change',
      });
    });
  }

  await exportDBLogs(logPayloads);
  return resp;
});

module.exports = prisma;
