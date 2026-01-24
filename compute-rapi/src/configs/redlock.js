const Redlock = require('redlock');
const redis = require('#configs/redis.js');

// Single-node Redis, but Redlock still provides a robust locking interface
// Add modest retries and jitter so transient contention doesn't immediately push jobs into delayed
const redlock = new Redlock([redis], {
  retryCount: Number(process.env.REDLOCK_RETRY_COUNT ?? 5),
  retryDelay: Number(process.env.REDLOCK_RETRY_DELAY_MS ?? 200),
  retryJitter: Number(process.env.REDLOCK_RETRY_JITTER_MS ?? 150),
  // Auto-extend the lock slightly before it expires while work is ongoing
  automaticExtensionThreshold: Number(process.env.REDLOCK_EXTENSION_THRESHOLD_MS ?? 5000),
});

module.exports = redlock;
