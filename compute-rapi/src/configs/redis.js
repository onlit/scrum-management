const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  // Avoid ioredis timeouts interfering with long-running locks/queues
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

module.exports = redis;
