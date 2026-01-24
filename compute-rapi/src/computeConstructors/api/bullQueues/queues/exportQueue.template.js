/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to export queue using bullmq.
 *
 *
 */
const { Queue } = require('bullmq');
const queueConfig = require('#configs/bullQueue.js');

const exportQueue = new Queue('exportQueue', {
  connection: queueConfig.connection,
});

module.exports = exportQueue;
