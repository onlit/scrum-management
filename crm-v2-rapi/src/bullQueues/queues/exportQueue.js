/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
