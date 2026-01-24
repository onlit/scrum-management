const prisma = require('#configs/prisma.js');

async function getLiveness(req, res) {
  try {
    res.status(200).json({ status: 'OK' });
  } catch (error) {
    console.error('Liveness check failed:', error);
    res.status(500).json({ status: 'UNAVAILABLE' });
  }
}

async function getReadiness(req, res) {
  const checks = { db: false };
  const errors = {};

  const DB_TIMEOUT_MS = Number(process.env.READINESS_DB_TIMEOUT_MS || 2000);
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

    return { checks, errors };
  }

  const overallTimeout = new Promise((resolve) =>
    setTimeout(() => resolve({ timedOut: true }), OVERALL_TIMEOUT_MS)
  );

  const result = await Promise.race([runChecksSequentially(), overallTimeout]);

  if (result && result.timedOut) {
    const error = new Error('Readiness timed out');
    console.error('Readiness check failed:', error);
    return res.status(503).json({
      status: 'UNAVAILABLE',
      checks,
      errors: { ...errors, timeout: 'overall readiness timeout' },
    });
  }

  if (checks.db) {
    return res.status(200).json({ status: 'OK', checks });
  }

  const error = new Error('Service not ready');
  console.error('Readiness check failed:', error);
  return res.status(503).json({ status: 'UNAVAILABLE', checks, errors });
}

module.exports = { getLiveness, getReadiness };
