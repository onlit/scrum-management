# COMPUTE QUEUE ARCHITECTURE AND PITFALLS

## SCOPE
- Applies to the compute generation workflow implemented in `src/controllers/computeMicroservice.controller.js`.
- Covers the queue (`computeGenerationQueue`), worker, scheduler, leader election, and retry/ordering behavior.

## SPELUNKING SUMMARY (WHAT WE FOUND)
- The compute worker ran inside the API process with `concurrency: 1`, but **multiple API instances** ran the same worker.
- A **global Redlock** gate existed in the worker. If the lock was not acquired, the job threw `COMPUTE_GENERATION_LOCK_NOT_ACQUIRED`.
- BullMQ retries use **exponential backoff**, which moves the job into the **delayed queue**.
- Delayed jobs are **time-based**, not strict FIFO. A later job can retry earlier and execute first.
- Result: a request could appear "stuck" while a later request ran first.

## ROOT CAUSE OF OUT-OF-ORDER EXECUTION
1. Multiple API processes registered the same worker.
2. The worker used a global lock and threw on lock contention.
3. Throwing led to retries with backoff, placing jobs in the delayed queue.
4. Delayed queue wakeups are time-based, which breaks FIFO ordering.

## ENTERPRISE-GRADE FIX (IN-CODE)
The fix is implemented entirely in the codebase, without K8s or pod changes.

### 1) LEADER-ELECTED WORKER (SINGLE ACTIVE WORKER)
- A Redis lease is used to **elect exactly one leader**.
- Only the leader starts the worker and QueueScheduler.
- Followers do not run the worker and remain idle.
- This preserves FIFO and avoids lock contention across processes.

Files:
- `src/utils/shared/leaderElectionUtils.js`
- `src/controllers/computeMicroservice.controller.js`

### 2) REMOVE GLOBAL LOCKS IN WORKER
- The worker no longer uses Redlock gating.
- With a single leader worker, the lock is redundant and harmful.
- This eliminates delayed retries caused by lock acquisition failures.

### 3) JOB DEDUPE AND IDEMPOTENCY GUARDS
- Jobs are enqueued with `jobId: instance.id` to dedupe.
- The worker skips work if the instance is already `Completed`.
- This protects against duplicate work during retries or failover.

### 4) SHARED CONFIG CONSTANTS (DRY)
Centralized compute queue constants in `src/configs/computeQueue.js`:
- Queue name
- Leader lease key and timings
- Stale threshold

Used by:
- `src/controllers/computeMicroservice.controller.js`
- `src/controllers/queueStatus.controller.js`
- `src/bullQueues/workers/staleJobCleanupWorker.js`

## ARCHITECTURE (CURRENT)

### COMPONENTS
- **Queue**: `computeGenerationQueue` (BullMQ)
- **Worker**: single leader worker (`concurrency: 1`)
- **Scheduler**: leader-only QueueScheduler
- **Leader Election**: Redis lease, renewed periodically
- **Stale Cleanup**: background worker marks stuck instances as Failed

### FLOW
1. Request enqueues a job (with `jobId = instance.id`).
2. Leader worker pulls jobs FIFO and executes the generation pipeline.
3. Errors are classified into non-retriable vs retriable.
4. Stale cleanup catches jobs stuck in `Processing`.

## LEADER ELECTION DETAILS

### LEASE MECHANISM
- Acquire: `SET key value NX PX ttl`
- Renew: Lua `GET` + `PEXPIRE` if value matches leader ID
- Release: Lua `GET` + `DEL` if value matches leader ID

### CONFIG
From `src/configs/computeQueue.js`:
- `COMPUTE_QUEUE_LEADER_KEY`
- `COMPUTE_QUEUE_LEADER_TTL_MS`
- `COMPUTE_QUEUE_LEADER_RENEW_MS`

Recommended defaults:
- TTL: 30s
- Renew: 15s

Guidance:
- Too short -> flapping leadership
- Too long -> slow failover

## COMMON PITFALLS
- **Running multiple workers**: breaks FIFO unless only one is active.
- **Throwing on lock contention**: pushes jobs to delayed queue and reorders.
- **No QueueScheduler**: delayed jobs never resume.
- **Missing jobId dedupe**: duplicates cause repeated work and inconsistent status.
- **Stale cleanup misconfigured**: stuck instances remain in Processing.

## TROUBLESHOOTING CHECKLIST
1. **Leader status**
   - Look for logs: "Leader election acquired/lost".
2. **Worker status**
   - Confirm only leader logs "computeGenerationWorker initialized".
3. **Scheduler status**
   - Confirm "computeGenerationQueue scheduler ready".
4. **Queue status endpoint**
   - Check `GET /api/v1/queue-status` for active/waiting/delayed counts.
5. **Stale instances**
   - Monitor failed instances from `staleJobCleanupWorker`.

### EXAMPLE LOG SNIPPETS

Leader election (single active leader):
```
2025-12-21T06:11:16.990Z - [TraceID: compute-queue] Leader election acquired | Data: {"key":"locks:compute:generate:leader:v1","leaderId":"...","ttlMs":30000}
2025-12-21T06:11:17.010Z - [TraceID: compute-queue] computeGenerationWorker initialized | Data: {"concurrency":1}
2025-12-21T06:11:17.045Z - [TraceID: compute-queue] computeGenerationQueue scheduler ready
```

Leader failover:
```
2025-12-21T06:15:31.102Z - [TraceID: compute-queue] Leader election lost | Data: {"key":"locks:compute:generate:leader:v1","leaderId":"...","reason":"lease-extension-failed"}
2025-12-21T06:15:31.128Z - [TraceID: compute-queue] Leader election acquired | Data: {"key":"locks:compute:generate:leader:v1","leaderId":"...","ttlMs":30000}
2025-12-21T06:15:31.140Z - [TraceID: compute-queue] computeGenerationWorker initialized | Data: {"concurrency":1}
```

Worker lifecycle:
```
2025-12-21T06:19:10.932Z - [TraceID: 99d0...] computeGenerationWorker job active | Data: {"jobId":"163","instanceId":"...","activeCount":1,"concurrency":1}
2025-12-21T06:24:15.111Z - [TraceID: 99d0...] computeGenerationWorker job completed | Data: {"jobId":"163","instanceId":"..."}
```

Queue status endpoint sample:
```
{
  "queue": {
    "name": "computeGenerationQueue",
    "waiting": 2,
    "active": 1,
    "delayed": 0,
    "failed": 0,
    "completed": 10
  },
  "timestamp": "2025-12-21T06:24:20.001Z"
}
```

### EXPECTED SEQUENCES

Normal startup sequence:
1. "Leader election acquired"
2. "computeGenerationQueue scheduler ready"
3. "computeGenerationWorker initialized"

Normal job flow:
1. "Job enqueued for computeGenerationQueue"
2. "computeGenerationWorker job active"
3. Phase logs: "API_GENERATION" -> "FRONTEND_GENERATION" -> "DEVOPS_GENERATION" -> "GIT_OPERATIONS" -> "DNS_UPDATE"
4. "computeGenerationWorker job completed"

Leader failover sequence:
1. "Leader election lost" on old leader
2. "Leader election acquired" on new leader
3. "computeGenerationWorker initialized" on new leader
4. Jobs resume in FIFO order

## OPERATIONAL RECOMMENDATIONS
- Keep leader lease TTL reasonable (30s default).
- Ensure Redis availability and low latency.
- Monitor queue latency and job durations.
- Alert when stale instance count spikes.

## VERIFICATION STEPS
1. Run two API processes locally.
2. Ensure only one logs leader acquisition and worker start.
3. Enqueue multiple jobs; verify FIFO execution.
4. Kill the leader process; follower should take over and continue processing.

## FILES OF INTEREST
- `src/controllers/computeMicroservice.controller.js`
- `src/utils/shared/leaderElectionUtils.js`
- `src/configs/computeQueue.js`
- `src/controllers/queueStatus.controller.js`
- `src/bullQueues/workers/staleJobCleanupWorker.js`
