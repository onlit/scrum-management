/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * Prisma V6 configuration using Client Extensions ($extends).
 * - Soft deletion on reads (hide deleted by default).
 * - Soft delete on delete/deleteMany (sets `deleted` to timestamp).
 * - Create/updateMany logging via exportDBLogs.
 */

const { PrismaClient } = require('@prisma/client');
const { MS_NAME } = require('#configs/constants.js');
const { exportDBLogs } = require('#utils/apiUtils.js');
const { normalizeDateStringsToDate, isTestEnv } = require('#utils/generalUtils.js');
const {
  isMissingTableError,
  logMissingTableWarning,
} = require('#utils/errorHandlingUtils.js');

// If you want query logging events, you can still use $on('query').
// const prismaBase = new PrismaClient({
//   log: [{ emit: 'event', level: 'query' }],
// });
// prismaBase.$on('query', (e) => {
//   console.log('==============================================================');
//   console.log('Query: ', e.query);
//   console.log('Params: ', e.params);
//   console.log('Duration: ', e.duration, 'ms');
//   console.log('==============================================================\n\n');
// });

const prismaBase = new PrismaClient();

/**
 * IMPORTANT: We create an extended client that:
 * - Adds default filters for soft delete on reads
 * - Rewrites delete/deleteMany into update/updateMany (soft delete)
 * - Emits DB log payloads on create and updateMany
 *
 * Notes:
 * - We call `prisma[model].findFirst/update/updateMany` from inside handlers.
 *   That *intentionally* re-enters the extension so our read filters apply.
 */
const prisma = prismaBase.$extends({
  name: 'soft-delete-and-logging',
  query: {
    $allModels: {
      // Hide soft-deleted rows on findFirst
      async findFirst({ args, query }) {
        args.where ??= {};
        if (args.where.deleted === undefined) args.where.deleted = null;
        return query(args);
      },

      // Hide soft-deleted rows on findMany (unless explicitly requested)
      async findMany({ args, query }) {
        args.where ??= {};
        if (args.where.deleted === undefined) args.where.deleted = null;
        return query(args);
      },

      // Emulate your old "findUnique -> findFirst + deleted:null"
      async findUnique({ model, args }) {
        const where = { ...(args.where ?? {}) };
        return prisma[model].findFirst({
          ...args,
          where: { ...where, deleted: null },
        });
      },

      // Soft delete single: delete -> update { deleted: now }
      async delete({ model, args }) {
        const now = new Date().toISOString();
        return prisma[model].update({
          where: args.where,
          data: { deleted: now },
        });
      },

      // Soft delete many: deleteMany -> updateMany { deleted: now }
      async deleteMany({ model, args }) {
        const now = new Date().toISOString();
        const data = { ...(args.data ?? {}), deleted: now };
        return prisma[model].updateMany({ ...args, data });
      },

      // Log creations
      async create({ model, args, query }) {
        // Coerce any date-only strings (YYYY-MM-DD) into Date objects
        if (args && args.data) {
          args.data = normalizeDateStringsToDate(args.data);
        }
        const actionDatetime = new Date().toISOString();
        const resp = await query(args);

        await exportDBLogs([
          {
            microservice: MS_NAME,
            model,
            object_id: resp?.id,
            before_action_content: JSON.stringify({}),
            after_action_content: JSON.stringify(resp),
            action_datetime: actionDatetime,
            action: 'Addition',
          },
        ]);

        return resp;
      },

      // Normalize dates on createMany as well
      async createMany({ args, query }) {
        if (args && args.data) {
          args.data = normalizeDateStringsToDate(args.data);
        }
        return query(args);
      },

      // Log updateMany (including soft deletions triggered via deleteMany above)
      async updateMany({ model, args, query }) {
        // Coerce any date-only strings (YYYY-MM-DD) into Date objects
        if (args && args.data) {
          args.data = normalizeDateStringsToDate(args.data);
        }
        const actionDatetime = new Date().toISOString();

        // Fetch "before" state in batches to avoid OOM
        const beforeInstances = [];
        let cursor;
        try {
          do {
            const batch = await prisma[model].findMany({
              where: args?.where,
              take: 1000,
              ...(cursor ? { skip: 1, cursor } : {}),
            });
            beforeInstances.push(...batch);
            cursor = batch.length
              ? { id: batch[batch.length - 1].id }
              : undefined;
          } while (cursor);
        } catch (error) {
          if (isTestEnv() && isMissingTableError(error)) {
            logMissingTableWarning(model, error);
            return { count: 0 };
          }
          throw error;
        }

        let resp;
        try {
          resp = await query(args);
        } catch (error) {
          if (isTestEnv() && isMissingTableError(error)) {
            logMissingTableWarning(model, error);
            return { count: 0 };
          }
          throw error;
        }

        const isDeletion = Boolean(args?.data?.deleted);
        const logPayloads = beforeInstances.map((instance) => ({
          microservice: MS_NAME,
          model,
          object_id: instance?.id,
          before_action_content: JSON.stringify({ ...instance }),
          after_action_content: JSON.stringify({ ...instance, ...(args?.data || {}) }),
          action_datetime: actionDatetime,
          action: isDeletion ? 'Deletion' : 'Change',
        }));

        await exportDBLogs(logPayloads);
        return resp; // Prisma returns { count } for updateMany
      },

      // Normalize dates on update
      async update({ args, query }) {
        if (args && args.data) {
          args.data = normalizeDateStringsToDate(args.data);
        }
        return query(args);
      },

      // Normalize dates on upsert
      async upsert({ args, query }) {
        if (args) {
          if (args.create) args.create = normalizeDateStringsToDate(args.create);
          if (args.update) args.update = normalizeDateStringsToDate(args.update);
        }
        return query(args);
      },
    },

    // OPTIONAL: If you ever want to *enforce* excluding deleted rows on updates,
    // uncomment the handlers below (parity with your commented middleware).
    //
    // $allModels: {
    //   async update({ args, query }) {
    //     // Force updates only on non-deleted rows by converting to updateMany
    //     // and returning the updated record via an extra fetch.
    //     // Use with caution; it changes semantics of update (should affect 1 row).
    //     args.where ??= {};
    //     args.where.deleted = null;
    //     // Run as updateMany then read back (implementation choice).
    //     const res = await query({ ...args, action: 'updateMany' }); // NOTE: not supported; prefer explicit pattern below
    //     return res;
    //   },
    //   async updateMany({ args, query }) {
    //     args.where ??= {};
    //     if (args.where.deleted === undefined) args.where.deleted = null;
    //     return query(args);
    //   },
    // },
  },
});

module.exports = prisma;
