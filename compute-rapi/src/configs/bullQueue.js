const { Queue, Worker, QueueScheduler, UnrecoverableError } = require('bullmq');
const redis = require('#configs/redis.js');

// Reuse the ioredis connection for BullMQ
const connection = redis;

module.exports = {
  connection,
  Queue,
  Worker,
  QueueScheduler,
  UnrecoverableError,
};
