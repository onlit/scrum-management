# Domain Queues

This directory contains domain-specific Bull queues and workers that persist across code regeneration.

## Directory Structure

```
src/domain/bullQueues/
├── queue-loader.js     # Auto-discovery and initialization
├── queues/             # Queue definitions
│   └── *.queue.js      # One file per queue
├── workers/            # Worker implementations
│   └── *.worker.js     # One file per worker
└── README.md           # This file
```

## Creating a Queue

Create a file in `queues/` with the `.queue.js` suffix:

```javascript
// src/domain/bullQueues/queues/notification.queue.js

const { Queue } = require('bullmq');
const { connection } = require('#configs/bullQueue.js');

const notificationQueue = new Queue('notificationQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 100,
      age: 24 * 60 * 60, // 24 hours
    },
    removeOnFail: {
      count: 500,
    },
  },
});

module.exports = notificationQueue;
```

## Creating a Worker

Create a file in `workers/` with the `.worker.js` suffix:

```javascript
// src/domain/bullQueues/workers/notification.worker.js

const { Worker } = require('bullmq');
const { connection } = require('#configs/bullQueue.js');

const notificationWorker = new Worker(
  'notificationQueue',
  async (job) => {
    const { userId, message, channel } = job.data;

    console.log(`[NotificationWorker] Processing job ${job.id}`);
    console.log(`[NotificationWorker] Sending ${channel} notification to ${userId}`);

    // Implement your notification logic here
    switch (channel) {
      case 'email':
        // await sendEmail(userId, message);
        break;
      case 'sms':
        // await sendSms(userId, message);
        break;
      case 'push':
        // await sendPush(userId, message);
        break;
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }

    return { sent: true, channel, userId };
  },
  {
    connection,
    concurrency: 5, // Process 5 jobs concurrently
  }
);

// Event handlers
notificationWorker.on('completed', (job, result) => {
  console.log(`[NotificationWorker] Job ${job.id} completed:`, result);
});

notificationWorker.on('failed', (job, error) => {
  console.error(`[NotificationWorker] Job ${job?.id} failed:`, error.message);
});

module.exports = notificationWorker;
```

## Adding Jobs to the Queue

Use the queue in your controllers or interceptors:

```javascript
// src/domain/interceptors/order.interceptor.js

const { getQueue } = require('#domain/bullQueues/queue-loader.js');

module.exports = {
  async afterCreate(record, context) {
    // Send notification after order is created
    const notificationQueue = getQueue('notification');

    if (notificationQueue) {
      await notificationQueue.add('orderConfirmation', {
        userId: record.userId,
        message: `Your order #${record.id} has been placed!`,
        channel: 'email',
      });
    }

    return { data: record };
  },
};
```

## Initialization

Domain queues are auto-initialized on server startup. The loader:

1. Scans `queues/` for `*.queue.js` files
2. Scans `workers/` for `*.worker.js` files
3. Registers each queue and worker

To manually initialize (useful in tests):

```javascript
const { initializeDomainQueues } = require('#domain/bullQueues/queue-loader.js');

await initializeDomainQueues();
```

## Graceful Shutdown

Workers and queues are automatically closed on process termination:

```javascript
const { shutdownDomainQueues } = require('#domain/bullQueues/queue-loader.js');

process.on('SIGTERM', async () => {
  await shutdownDomainQueues();
  process.exit(0);
});
```

## Job Data Patterns

### Pre-Resolve Time-Sensitive Data

Don't pass access tokens or data that expires:

```javascript
// BAD - token may expire before job runs
await queue.add('task', { accessToken: user.accessToken });

// GOOD - pass user ID, resolve token in worker if needed
await queue.add('task', { userId: user.id });
```

### Include Trace IDs

For distributed tracing:

```javascript
await queue.add('task', {
  traceId: req.traceId,
  userId: user.id,
  // ... job data
});
```

### Use Meaningful Job Names

```javascript
// Named jobs for easier debugging
await queue.add('sendWelcomeEmail', { userId });
await queue.add('processRefund', { orderId });
await queue.add('generateReport', { reportType, dateRange });
```

## Testing Domain Queues

```javascript
// tests/domain/bullQueues/notification.queue.test.js

const { Queue } = require('bullmq');
const Redis = require('ioredis');

describe('Notification Queue', () => {
  let queue;
  let redis;

  beforeAll(() => {
    redis = new Redis({ host: 'localhost', port: 6379 });
  });

  afterAll(async () => {
    await redis.quit();
  });

  beforeEach(async () => {
    queue = new Queue('test-notification', { connection: redis });
  });

  afterEach(async () => {
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it('should add job with correct data', async () => {
    const jobData = { userId: '123', message: 'Hello', channel: 'email' };

    const job = await queue.add('sendNotification', jobData);

    expect(job.id).toBeDefined();
    expect(job.data).toEqual(jobData);
  });
});
```

## Protected Files

All files in `src/domain/bullQueues/` are protected and never overwritten by the generator.
