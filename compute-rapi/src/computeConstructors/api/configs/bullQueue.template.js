/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to bullmq.
 *
 *
 */
const { Queue, Worker, QueueScheduler } = require('bullmq');

const connection = {
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
};

module.exports = {
  connection,
  Queue,
  Worker,
  QueueScheduler,
};
