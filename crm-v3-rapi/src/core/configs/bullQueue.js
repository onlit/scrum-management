/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
