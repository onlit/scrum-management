/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to import queue using bullmq.
 *
 *
 */
const { Queue } = require('bullmq');
const queueConfig = require('#configs/bullQueue.js');

const importQueue = new Queue('importQueue', {
  connection: queueConfig.connection,
});

module.exports = importQueue;
