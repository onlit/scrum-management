/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
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
