/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 20/09/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * Health controller providing liveness and readiness probes.
 * - Liveness: simple process responsiveness check.
 * - Readiness: verifies critical dependencies (database and Redis/BullMQ).
 */

const prisma = require('#configs/prisma.js');
const { Queue, connection: redisConnection } = require('#configs/bullQueue.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');

async function getLiveness(req, res) {
  logOperationStart('getLiveness', req, {});
  try {
    res.status(200).json({ status: 'OK' });
    logOperationSuccess('getLiveness', req, { status: 'ok' });
  } catch (error) {
    logOperationError('getLiveness', req, error);
    res.status(500).json({ status: 'UNAVAILABLE' });
  }
}

async function getReadiness(req, res) {
  logOperationStart('getReadiness', req, {});
  const checks = { db: false, redis: false };
  const errors = {};

  const DB_TIMEOUT_MS = Number(process.env.READINESS_DB_TIMEOUT_MS || 2000);
  const REDIS_TIMEOUT_MS = Number(
    process.env.READINESS_REDIS_TIMEOUT_MS || 2000
  );
  const OVERALL_TIMEOUT_MS = Number(
    process.env.READINESS_OVERALL_TIMEOUT_MS || 5000
  );

  function withTimeout(promise, timeoutMs, label) {
    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  async function runChecksSequentially() {
    // Database check (<= 2s by default)
    try {
      await withTimeout(prisma.$queryRaw`SELECT 1`, DB_TIMEOUT_MS, 'db');
      checks.db = true;
    } catch (e) {
      errors.db = e?.message || 'Database check failed';
    }

    // Redis/BullMQ check (<= 2s by default)
    try {
      const q = new Queue('__healthcheck__', { connection: redisConnection });
      await withTimeout(q.waitUntilReady(), REDIS_TIMEOUT_MS, 'redis');
      await q.close();
      checks.redis = true;
    } catch (e) {
      errors.redis = e?.message || 'Redis check failed';
    }

    return { checks, errors };
  }

  const overallTimeout = new Promise((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), OVERALL_TIMEOUT_MS)
  );

  const result = await Promise.race([runChecksSequentially(), overallTimeout]);

  if (result && result.timedOut) {
    const error = new Error('Readiness timed out');
    logOperationError('getReadiness', req, error);
    return res.status(503).json({
      status: 'UNAVAILABLE',
      checks,
      errors: { ...errors, timeout: 'overall readiness timeout' },
    });
  }

  if (checks.db && checks.redis) {
    logOperationSuccess('getReadiness', req, { checks });
    return res.status(200).json({ status: 'OK', checks });
  }

  const error = new Error('Service not ready');
  logOperationError('getReadiness', req, error);
  return res.status(503).json({ status: 'UNAVAILABLE', checks, errors });
}

module.exports = { getLiveness, getReadiness };
