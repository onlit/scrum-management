/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains a controller function for creating a compute microservice in a database using Prisma.
 * It validates the request body using a Joi schema, retrieves the microservice details based on the provided
 * microservice ID, and includes associated enum and model definitions with visibility filters applied to ensure
 * accessibility for the requesting user.
 *
 * The `createComputeMicroservice` function then generates an API based on the retrieved microservice, model,
 * and enum definitions using a script named `generateAPI`. It measures the execution time for API generation
 * and sends a successful response upon completion.
 *
 *
 */

const prisma = require('#configs/prisma.js');
const {
  computeMicroserviceCreate,
  computeMicroserviceValidate,
  computeMicroservicePrismaSchema,
  computeMicroserviceModelsFieldsCompact,
  computeMicroserviceAutofix,
} = require('#schemas/computeMicroservice.schemas.js');
const generateAPI = require('#scripts/generateAPI.js');
const generateDevOps = require('#scripts/generateDevOps.js');
const generateFrontend = require('#scripts/generateFrontend.js');
const cleanupK8sLeftOver = require('#src/scripts/cleanupK8sLeftOver.js');
const cleanupMainAppLeftOverFiles = require('#src/scripts/cleanupMainAppLeftOverFiles.js');
const {
  setupMicroserviceRepositories,
  commitAndPushChanges,
} = require('#scripts/gitAutomation.js');
const {
  cleanupMicroserviceRepositories,
  removeLocalClones,
  removeComputeOutputDirectory,
} = require('#utils/api/gitCleanupUtils.js');
const { filterDeleted } = require('#utils/shared/generalUtils.js');
const { logPhase } = require('#utils/shared/loggingUtils.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const { validateRepositorySetup } = require('#utils/api/apiSetupUtils.js');
const {
  MODEL_DEFN_DETAIL,
  FIELD_DEFN_DETAIL,
  DISPLAY_VALUE_DETAIL,
  ENUM_DEFN_DETAIL,
  COMMIT_WAY,
  ALLOWED_COMPUTE_ROLES,
} = require('#configs/constants.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { GITLAB_HOST } = require('#configs/gitlab.js');
const updateDNSRecords = require('#scripts/updateGoDaddyDnsRecords.js');
const {
  getExternalForeignKeys,
} = require('#utils/api/externalForeignKeyUtils.js');
const { getDetailsFromAPI } = require('#utils/shared/apiUtils.js');
const {
  validateMicroserviceConfiguration,
  fetchSystemMenus,
  hasComputeAdminAccess,
  buildValidationErrorSummary,
  applyValidationAutoFixes,
} = require('#utils/api/microserviceValidationUtils.js');
const { convertToSlug } = require('#utils/shared/stringUtils.js');
const {
  generatePrismaModelFieldsOnlyString,
  generatePrismaEnumString,
} = require('#utils/api/prismaUtils.js');
const {
  analyzeMigrationIssues,
  applyMigrationFixes,
  buildMigrationValidationErrors,
  getMigrationInfoMessages,
} = require('#utils/api/migrationIssuesHandler.js');
const getComputeMicroservicePaths = require('#configs/computePaths.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  logWithTrace,
} = require('#utils/shared/traceUtils.js');
const queueConfig = require('#configs/bullQueue.js');
const {
  COMPUTE_GENERATION_QUEUE_NAME,
  COMPUTE_QUEUE_LEADER_KEY,
  COMPUTE_QUEUE_LEADER_TTL_MS,
  COMPUTE_QUEUE_LEADER_RENEW_MS,
} = require('#configs/computeQueue.js');
const { createLeaderElection } = require('#utils/shared/leaderElectionUtils.js');

// Queue is shared across instances; worker/scheduler are leader-only
const computeGenerationQueue = new queueConfig.Queue(
  COMPUTE_GENERATION_QUEUE_NAME,
  { connection: queueConfig.connection }
);
let computeGenerationQueueScheduler = null;
let computeGenerationWorker = null;
let computeGenerationLeaderElection = null;

function logComputeQueueInit() {
  try {
    logWithTrace(
      'computeGenerationQueue initialized',
      { traceId: 'compute-queue' },
      {
        queueName: COMPUTE_GENERATION_QUEUE_NAME,
        connection: queueConfig.connection,
      }
    );
  } catch (_) {
    /* intentionally ignored: optional queue initialization log */
  }
}

async function startComputeGenerationQueueScheduler() {
  if (!queueConfig.QueueScheduler || computeGenerationQueueScheduler) return;

  try {
    computeGenerationQueueScheduler = new queueConfig.QueueScheduler(
      COMPUTE_GENERATION_QUEUE_NAME,
      { connection: queueConfig.connection }
    );

    try {
      await computeGenerationQueueScheduler.waitUntilReady();
      logWithTrace('computeGenerationQueue scheduler ready', {
        traceId: 'compute-queue',
      });
    } catch (err) {
      logWithTrace(
        'computeGenerationQueue scheduler ready wait failed',
        { traceId: 'compute-queue' },
        { error: err?.message }
      );
    }
  } catch (e) {
    logWithTrace(
      'QueueScheduler initialization failed',
      { traceId: 'compute-queue' },
      { error: e?.message }
    );
    computeGenerationQueueScheduler = null;
  }
}

async function stopComputeGenerationQueueScheduler() {
  if (!computeGenerationQueueScheduler) return;
  try {
    await computeGenerationQueueScheduler.close();
  } catch (_) {
    /* intentionally ignored: best-effort shutdown */
  } finally {
    computeGenerationQueueScheduler = null;
  }
}

async function startComputeGenerationWorker() {
  if (computeGenerationWorker) return;
  computeGenerationWorker = createComputeGenerationWorker();
  attachWorkerLifecycleLogs();
  logWithTrace(
    'computeGenerationWorker initialized',
    { traceId: 'compute-queue' },
    {
      concurrency: 1,
    }
  );
}

async function stopComputeGenerationWorker() {
  if (!computeGenerationWorker) return;
  try {
    await computeGenerationWorker.close();
  } catch (_) {
    /* intentionally ignored: best-effort shutdown */
  } finally {
    computeGenerationWorker = null;
  }
}

async function startComputeQueueLeadership() {
  if (computeGenerationLeaderElection) return;
  computeGenerationLeaderElection = createLeaderElection({
    key: COMPUTE_QUEUE_LEADER_KEY,
    ttlMs: COMPUTE_QUEUE_LEADER_TTL_MS,
    renewMs: COMPUTE_QUEUE_LEADER_RENEW_MS,
    logContext: { traceId: 'compute-queue' },
    onLeader: async () => {
      await startComputeGenerationQueueScheduler();
      await startComputeGenerationWorker();
    },
    onFollower: async () => {
      await stopComputeGenerationWorker();
      await stopComputeGenerationQueueScheduler();
    },
  });

  await computeGenerationLeaderElection.start();
  logWithTrace('computeGenerationQueue leader election started', {
    traceId: 'compute-queue',
  });
}

logComputeQueueInit();
startComputeQueueLeadership().catch((error) => {
  logWithTrace(
    'computeGenerationQueue leader election failed to start',
    { traceId: 'compute-queue' },
    { error: error?.message }
  );
});

async function performComputeGeneration({
  instanceId,
  microserviceId,
  generateApiFlag,
  generateFrontendFlag,
  generateDevOpsFlag,
  userInfo, // Changed from 'user' - contains only userId, userEmail, roleNames for logging
  externalFks, // Pre-resolved external foreign keys (resolved before enqueue to avoid token expiration)
  menus: preEnqueueMenus, // Pre-fetched menus (fetched before enqueue to avoid token expiration)
  traceId,
  migrationOptions = {},
}) {
  // Track start time for duration calculation
  const startTime = Date.now();

  // Fetch the stored requestTraceId for consistent log correlation
  let effectiveTraceId = traceId;
  let instanceForTrace = null;
  try {
    instanceForTrace = await prisma.instance.findUnique({
      where: { id: instanceId },
      select: { requestTraceId: true, status: true },
    });
    // Use stored requestTraceId if available, otherwise fall back to job traceId or instanceId
    effectiveTraceId =
      instanceForTrace?.requestTraceId || traceId || instanceId;
  } catch (traceErr) {
    // If we can't fetch, use the job traceId or instanceId
    effectiveTraceId = traceId || instanceId;
  }

  const reqCtx = { traceId: effectiveTraceId };

  if (instanceForTrace?.status === 'Completed') {
    logWithTrace('Compute generation skipped: instance already completed', reqCtx, {
      instanceId,
    });
    return;
  }

  // Create a minimal user object for visibility filters and logging
  // Note: This user object does NOT contain accessToken - all token-dependent
  // operations (like getExternalForeignKeys) must be done before enqueuing
  const user = {
    id: userInfo.userId,
    email: userInfo.userEmail,
    roleNames: userInfo.roleNames,
    organisationId: userInfo.organisationId,
    client: userInfo.clientId ? { id: userInfo.clientId } : null,
    isAuthenticated: userInfo.isAuthenticated,
    roles: userInfo.roles || [],
  };

  try {
    logDatabaseStart('get_microservice_with_details_worker', reqCtx, {
      microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: MODEL_DEFN_DETAIL,
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        reqCtx,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_compute_microservice_worker',
          details: { microserviceId },
        }
      );
    }

    if (
      !microservice?.deploymentState ||
      microservice?.deploymentState !== 'Development'
    ) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' is not in development state.`,
        reqCtx,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_compute_microservice_worker',
          details: {
            microserviceId,
            deploymentState: microservice?.deploymentState,
          },
        }
      );
    }

    // Move instance to Processing and clear queue position
    await prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: 'Processing',
        queuePosition: null,
        processingStartedAt: new Date(),
      },
    });

    const { modelDefns, enumDefns, ...rest } = microservice;
    const models = modelDefns
      .filter((model) => !model.deleted)
      .map((model) => ({
        ...model,
        fieldDefns: model.fieldDefns.filter((field) => !field.deleted),
      }));
    const enums = filterDeleted(enumDefns);
    // externalFks is now passed as parameter (pre-resolved before enqueue)
    // menus (preEnqueueMenus) is now passed as parameter (pre-fetched before enqueue)

    // Use pre-fetched menus for validation (fetched before enqueue to avoid token expiration)
    const menus = preEnqueueMenus || [];

    // Perform validation
    const validationResult = await validateMicroserviceConfiguration({
      microservice: rest,
      models,
      menus,
      req: reqCtx,
    });

    if (validationResult.hasErrors) {
      // Build a human-readable summary of validation errors for failureReason
      const errorSummary = buildValidationErrorSummary(
        validationResult.validationErrors
      );

      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: 'Failed',
          failureReason: errorSummary,
          errorType: ERROR_TYPES.VALIDATION,
          errorPhase: 'VALIDATION',
          errorContext: 'microservice_validation',
          errorDetails: {
            validationErrors: validationResult.validationErrors,
            traceId: reqCtx.traceId,
            timestamp: new Date().toISOString(),
            instanceId,
            microserviceId,
          },
        },
      });

      throw createErrorWithTrace(ERROR_TYPES.VALIDATION, errorSummary, reqCtx, {
        severity: ERROR_SEVERITY.MEDIUM,
        context: 'microservice_validation',
        details: { validationErrors: validationResult.validationErrors },
      });
    }

    const defaultBranch =
      COMMIT_WAY === 'sandbox_to_production' ? 'dev' : 'main';

    logWithTrace('Setting up microservice repositories', reqCtx, {
      microserviceName: rest?.name,
      defaultBranch,
    });

    const { restAPIRepo, mainAppRepo, frontendRepo, devOpsRepo } =
      await setupMicroserviceRepositories({
        microserviceName: rest?.name,
        instanceId,
        switchToBranch: defaultBranch,
        user,
      });

    if (!validateRepositorySetup({ restAPIRepo, devOpsRepo })) {
      throw createErrorWithTrace(
        ERROR_TYPES.INTERNAL,
        'Failed to setup Git repositories for the microservice. Please try again or contact support.',
        reqCtx,
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'repository_setup_validation',
        }
      );
    }

    if (generateApiFlag) {
      logWithTrace('Generating API', reqCtx, { instanceId, migrationOptions });
      await logPhase({
        instanceId,
        phase: 'API_GENERATION',
        status: 'Started',
        user,
        traceId: effectiveTraceId,
        metadata: { modelsCount: models.length },
      });

      await generateAPI({
        user,
        enums,
        models,
        externalFks,
        microservice: rest,
        instanceId,
        k8sRepoID: devOpsRepo?.id,
        k8sCiPipelineToken: devOpsRepo?.triggerToken,
        migrationOptions,
        traceId: effectiveTraceId,
      });
      await logPhase({
        instanceId,
        phase: 'API_GENERATION',
        status: 'Completed',
        user,
        traceId: effectiveTraceId,
      });
    } else {
      logWithTrace('Skipping API generation by request', reqCtx, {
        instanceId,
      });
    }

    if (generateFrontendFlag) {
      logWithTrace('Generating frontend', reqCtx, { instanceId });
      await logPhase({
        instanceId,
        phase: 'FRONTEND_GENERATION',
        status: 'Started',
        user,
        traceId: effectiveTraceId,
      });

      await generateFrontend({
        instanceId,
        microservice: rest,
        models,
        menus,
        user,
        externalFks,
        traceId: effectiveTraceId,
      });

      await logPhase({
        instanceId,
        phase: 'FRONTEND_GENERATION',
        status: 'Completed',
        user,
        traceId: effectiveTraceId,
      });
    } else {
      logWithTrace('Skipping frontend generation by request', reqCtx, {
        instanceId,
      });
    }

    if (generateDevOpsFlag) {
      logWithTrace('Generating DevOps configuration', reqCtx, { instanceId });
      await logPhase({
        instanceId,
        phase: 'DEVOPS_GENERATION',
        status: 'Started',
        user,
        traceId: effectiveTraceId,
      });

      await generateDevOps({
        microserviceName: rest?.name,
        feRepoPath: frontendRepo?.path_with_namespace,
        rapiRepoPath: restAPIRepo?.path_with_namespace,
        nginxRepoPath: devOpsRepo?.path_with_namespace,
        instanceId,
        user,
        traceId: effectiveTraceId,
      });

      await logPhase({
        instanceId,
        phase: 'DEVOPS_GENERATION',
        status: 'Completed',
        user,
        traceId: effectiveTraceId,
      });
    } else {
      logWithTrace('Skipping DevOps generation by request', reqCtx, {
        instanceId,
      });
    }

    const repos = [
      ...(generateApiFlag
        ? [
            {
              path: restAPIRepo?.clonePath,
              commitMessage: '- Initial Commit',
              branch: defaultBranch,
              instanceId,
              user,
            },
          ]
        : []),
      {
        path: mainAppRepo?.clonePath,
        commitMessage: `- Added ${rest?.name} configs`,
        branch: defaultBranch,
        instanceId,
        user,
      },
      ...(generateDevOpsFlag
        ? [
            {
              path: devOpsRepo?.clonePath,
              commitMessage: '- Initial Commit',
              branch: defaultBranch,
              instanceId,
              devOps: true,
              user,
            },
          ]
        : []),
      ...(process.env.NODE_ENV === 'prod' &&
      COMMIT_WAY === 'sandbox_to_production'
        ? [
            ...(generateApiFlag
              ? [
                  {
                    path: restAPIRepo?.clonePath,
                    commitMessage: 'Promote to production',
                    branch: 'dev',
                    mergeBranch: 'main',
                    cherryPick: 'dev',
                    instanceId,
                    user,
                  },
                ]
              : []),
            ...(generateDevOpsFlag
              ? [
                  {
                    path: devOpsRepo?.clonePath,
                    commitMessage: '- Promote to production',
                    branch: 'dev',
                    mergeBranch: 'main',
                    cherryPick: 'dev',
                    instanceId,
                    devOps: true,
                    user,
                  },
                ]
              : []),
            {
              path: mainAppRepo?.clonePath,
              commitMessage: `- Promote ${rest?.name} configs to production`,
              branch: 'dev',
              mergeBranch: 'main',
              cherryPick: 'dev',
              instanceId,
              user,
            },
          ]
        : []),
      ...(generateFrontendFlag
        ? [
            {
              path: frontendRepo?.clonePath,
              commitMessage: '- Initial Commit',
              branch: defaultBranch,
              instanceId,
              user,
            },
          ]
        : []),
    ];

    logWithTrace('Committing and pushing changes', reqCtx, {
      repoCount: repos.length,
      instanceId,
    });
    await logPhase({
      instanceId,
      phase: 'GIT_OPERATIONS',
      status: 'Started',
      user,
      traceId: effectiveTraceId,
      metadata: { repoCount: repos.length },
    });

    await commitAndPushChanges(repos);

    await logPhase({
      instanceId,
      phase: 'GIT_OPERATIONS',
      status: 'Completed',
      user,
      traceId: effectiveTraceId,
    });

    logWithTrace('Updating DNS records', reqCtx, {
      microserviceName: microservice?.name,
      microserviceId,
    });
    await logPhase({
      instanceId,
      phase: 'DNS_UPDATE',
      status: 'Started',
      user,
      traceId: effectiveTraceId,
    });

    await updateDNSRecords({
      msName: microservice?.name,
      microserviceId,
      user,
    });

    await logPhase({
      instanceId,
      phase: 'DNS_UPDATE',
      status: 'Completed',
      user,
      traceId: effectiveTraceId,
    });

    // Calculate duration for successful completion
    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    const updated = await prisma.instance.update({
      where: { id: instanceId },
      data: {
        status: 'Completed',
        duration: durationSeconds,
        apiGitRepoUrl: generateApiFlag ? restAPIRepo?.web_url : null,
        feGitRepoUrl: generateFrontendFlag ? frontendRepo?.web_url : null,
        devopsGitRepoUrl: generateDevOpsFlag ? devOpsRepo?.web_url : null,
      },
    });

    logOperationSuccess('createComputeMicroservice_worker', reqCtx, {
      instanceId: updated.id,
      microserviceName: rest.name,
      durationSeconds,
    });
  } catch (error) {
    // Calculate duration even for failures
    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    logOperationError('createComputeMicroservice_worker', reqCtx, error);

    // Determine error phase based on error context/message
    const errorPhase = determineErrorPhase(error);

    // Build structured error details (full capture, no truncation)
    // IMPORTANT: Include error.details to capture validationErrors and other structured details
    const errorDetails = {
      ...error?.details, // Include structured details like validationErrors
      message: error?.message,
      stack: error?.stack,
      type: error?.type || 'UNKNOWN',
      severity: error?.severity || 'HIGH',
      context: error?.context,
      code: error?.code,
      originalError:
        typeof error?.originalError === 'string'
          ? error.originalError
          : error?.originalError?.message,
      timestamp: new Date().toISOString(),
      traceId: reqCtx.traceId,
      instanceId,
      microserviceId,
    };

    // Best-effort failure update with full error details
    try {
      await prisma.instance.update({
        where: { id: instanceId },
        data: {
          status: 'Failed',
          duration: durationSeconds,
          failureReason: error?.message, // Now stored in Text field (no truncation needed)
          errorType: error?.type || 'INTERNAL',
          errorPhase,
          errorContext: error?.context || 'performComputeGeneration',
          errorDetails,
        },
      });
    } catch (updateError) {
      logWithTrace('Failed to update instance with error details', reqCtx, {
        updateError: updateError?.message,
      });
    }
    throw error;
  }
}

// Job execution timeout (default 15 minutes)
const COMPUTE_GEN_TIMEOUT_MS =
  Number(process.env.COMPUTE_GEN_TIMEOUT_MS) || 15 * 60 * 1000;

// Helper to create a timeout promise
function createTimeoutPromise(timeoutMs, instanceId) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      const error = new Error(
        `Compute generation timeout after ${timeoutMs / 1000}s for instance ${instanceId}`
      );
      error.type = ERROR_TYPES.TIMEOUT;
      reject(error);
    }, timeoutMs);
  });
}

/**
 * Determine which generation phase an error occurred in based on error context/message
 * @param {Error} error - The error object
 * @returns {string} - Phase identifier
 */
function determineErrorPhase(error) {
  const context = (error?.context || '').toLowerCase();
  const message = (error?.message || '').toLowerCase();

  if (
    context.includes('generate_api') ||
    context.includes('api') ||
    message.includes('api generation')
  ) {
    return 'API_GENERATION';
  }
  if (context.includes('frontend') || message.includes('frontend')) {
    return 'FRONTEND_GENERATION';
  }
  if (context.includes('devops') || message.includes('devops')) {
    return 'DEVOPS_GENERATION';
  }
  if (
    context.includes('repository') ||
    context.includes('git') ||
    message.includes('git') ||
    message.includes('commit') ||
    message.includes('push')
  ) {
    return 'GIT_OPERATIONS';
  }
  if (
    context.includes('migration') ||
    message.includes('migration') ||
    message.includes('prisma')
  ) {
    return 'MIGRATION';
  }
  if (context.includes('validation') || message.includes('validation')) {
    return 'VALIDATION';
  }
  if (
    context.includes('dns') ||
    message.includes('dns') ||
    message.includes('godaddy')
  ) {
    return 'DNS_UPDATE';
  }
  return 'UNKNOWN';
}

function createComputeGenerationWorker() {
  return new queueConfig.Worker(
    COMPUTE_GENERATION_QUEUE_NAME,
    async (job) => {
      const reqTraceId = job?.data?.traceId || 'compute-queue';

      // Execute with timeout to prevent indefinite hanging
      try {
        await Promise.race([
          performComputeGeneration(job.data),
          createTimeoutPromise(COMPUTE_GEN_TIMEOUT_MS, job.data?.instanceId),
        ]);
      } catch (executionError) {
        // Smart retry logic: classify errors as retriable or non-retriable
        const errorCode = executionError?.code || executionError?.type;

        // Non-retriable errors - fail immediately without retry
        const nonRetriableErrors = [
          ERROR_TYPES.VALIDATION,
          ERROR_TYPES.NOT_FOUND,
          ERROR_TYPES.AUTHORIZATION,
          ERROR_TYPES.TIMEOUT,
          ERROR_TYPES.MIGRATION_ISSUES,
        ];

        if (nonRetriableErrors.includes(errorCode)) {
          logWithTrace(
            'computeGenerationWorker non-retriable error',
            { traceId: reqTraceId },
            {
              errorCode,
              errorMessage: executionError?.message,
              instanceId: job.data?.instanceId,
            }
          );
          // Mark job as failed without retry by using BullMQ's UnrecoverableError
          // BullMQ will not retry jobs that throw UnrecoverableError
          throw new queueConfig.UnrecoverableError(executionError.message);
        }

        // Retriable errors - let BullMQ retry with backoff
        logWithTrace(
          'computeGenerationWorker retriable error',
          { traceId: reqTraceId },
          {
            errorCode,
            errorMessage: executionError?.message,
            instanceId: job.data?.instanceId,
            attemptsMade: job.attemptsMade,
            maxAttempts: job.opts?.attempts,
          }
        );
        throw executionError;
      }
    },
    { connection: queueConfig.connection, concurrency: 1 }
  );
}

function attachWorkerLifecycleLogs() {
  if (!computeGenerationWorker) return;
  try {
    computeGenerationWorker.on('active', async (job) => {
      try {
        const counts = await computeGenerationQueue.getJobCounts();
        const activeJobs = await computeGenerationQueue.getJobs(['active']);
        logWithTrace(
          'computeGenerationWorker job active',
          { traceId: job?.data?.traceId || 'compute-queue' },
          {
            jobId: job?.id,
            instanceId: job?.data?.instanceId,
            microserviceId: job?.data?.microserviceId,
            counts,
            activeCount: activeJobs?.length || 0,
            activeInstanceIds: (activeJobs || [])
              .map((j) => (j && j.data ? j.data.instanceId : null))
              .filter(Boolean),
            concurrency: 1,
          }
        );
      } catch (e) {
        logWithTrace(
          'computeGenerationWorker active log failed',
          { traceId: job?.data?.traceId || 'compute-queue' },
          { error: e?.message }
        );
      }
    });

    computeGenerationWorker.on('completed', async (job) => {
      try {
        const counts = await computeGenerationQueue.getJobCounts();
        logWithTrace(
          'computeGenerationWorker job completed',
          { traceId: job?.data?.traceId || 'compute-queue' },
          {
            jobId: job?.id,
            instanceId: job?.data?.instanceId,
            microserviceId: job?.data?.microserviceId,
            counts,
          }
        );
      } catch (e) {
        logWithTrace(
          'computeGenerationWorker completed log failed',
          { traceId: job?.data?.traceId || 'compute-queue' },
          { error: e?.message }
        );
      }
    });

    computeGenerationWorker.on('failed', async (job, err) => {
      try {
        const counts = await computeGenerationQueue.getJobCounts();
        logWithTrace(
          'computeGenerationWorker job failed',
          { traceId: job?.data?.traceId || 'compute-queue' },
          {
            jobId: job?.id,
            instanceId: job?.data?.instanceId,
            microserviceId: job?.data?.microserviceId,
            error: err?.message,
            counts,
          }
        );
      } catch (e) {
        logWithTrace(
          'computeGenerationWorker failed log failed',
          { traceId: job?.data?.traceId || 'compute-queue' },
          { error: e?.message }
        );
      }
    });
  } catch (_) {
    /* intentionally ignored: optional worker lifecycle logs */
  }
}

async function createComputeMicroservice(req, res) {
  const { user, body } = req;

  logOperationStart('createComputeMicroservice', req, {
    user: user.id,
    bodyKeys: Object.keys(body),
  });

  try {
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to create compute microservices.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'create_compute_microservice',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    const {
      microserviceId,
      generateApi: generateApiFlag,
      generateFrontend: generateFrontendFlag,
      generateDevOps: generateDevOpsFlag,
    } = await computeMicroserviceCreate.validateAsync(body, {
      abortEarly: false,
      stripUnknown: true,
    });

    // Ensure at least one artifact is selected
    if (!generateApiFlag && !generateFrontendFlag && !generateDevOpsFlag) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'You must enable at least one of generateApi, generateFrontend, or generateDevOps.',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_compute_microservice',
          details: {
            generateApi: generateApiFlag,
            generateFrontend: generateFrontendFlag,
            generateDevOps: generateDevOpsFlag,
          },
        }
      );
    }

    logDatabaseStart('get_microservice_with_details', req, { microserviceId });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: MODEL_DEFN_DETAIL,
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_compute_microservice',
          details: { microserviceId },
        }
      );
    }

    if (
      !microservice?.deploymentState ||
      microservice?.deploymentState !== 'Development'
    ) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' is not in development state.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_compute_microservice',
          details: {
            microserviceId,
            deploymentState: microservice?.deploymentState,
          },
        }
      );
    }

    logDatabaseSuccess('get_microservice_with_details', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const { modelDefns, enumDefns, ...rest } = microservice;
    const models = modelDefns
      .filter((model) => !model.deleted)
      .map((model) => ({
        ...model,
        fieldDefns: model.fieldDefns.filter((field) => !field.deleted),
      }));

    // Pre-enqueue validation: fail fast if configuration is invalid
    const preEnqueueMenus = await fetchSystemMenus(microserviceId, user, req);
    const preEnqueueValidation = await validateMicroserviceConfiguration({
      microservice: rest,
      models,
      menus: preEnqueueMenus,
      req,
    });
    if (preEnqueueValidation.hasErrors) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Microservice validation failed',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'microservice_validation_pre_enqueue',
          details: { validationErrors: preEnqueueValidation.validationErrors },
        }
      );
    }

    // Pre-enqueue migration issues check: analyze and block dangerous changes before enqueueing
    let migrationReport = null;
    let appliedMigrationFixes = [];

    if (generateApiFlag) {
      const { restAPI } = getComputeMicroservicePaths({
        microserviceName: rest?.name,
      });

      migrationReport = await analyzeMigrationIssues({
        microservice: rest,
        models,
        restAPI,
        req,
      });

      const migrationValidationErrors =
        buildMigrationValidationErrors(migrationReport);
      if (migrationValidationErrors) {
        const errorSummary = buildValidationErrorSummary(
          migrationValidationErrors
        );
        throw createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          errorSummary,
          req,
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'migration_validation_pre_enqueue',
            details: {
              validationErrors: migrationValidationErrors,
              migrationReport,
            },
          }
        );
      }

      if (migrationReport.hasFixableChanges) {
        const fixResult = await applyMigrationFixes({
          report: migrationReport,
          prisma,
        });
        appliedMigrationFixes = fixResult.appliedFixes || [];
      }

      logWithTrace('Migration issues check completed', req, {
        hasIssues: migrationReport.hasIssues,
        isFirstGeneration: migrationReport.isFirstGeneration,
        appliedFixesCount: appliedMigrationFixes.length,
      });
    }

    // Get informational messages for removals (not blocking, just for display)
    const removalInfo = migrationReport
      ? getMigrationInfoMessages(migrationReport)
      : null;

    const migrationInfo = migrationReport
      ? {
          ...migrationReport,
          appliedFixes: appliedMigrationFixes,
          ...(removalInfo || {}),
        }
      : null;

    // Pre-enqueue: Resolve external foreign keys NOW while user token is still valid
    // This is critical because user tokens have short TTL (e.g., 5 minutes) and would
    // expire if we tried to resolve them later in the queue worker
    let externalFks = [];
    if (generateApiFlag) {
      logWithTrace('Resolving external foreign keys before enqueue', req, {
        modelCount: models.length,
      });
      externalFks = await getExternalForeignKeys(models, user, req);
      logWithTrace('External foreign keys resolved', req, {
        externalFkCount: externalFks.length,
      });
    }

    logDatabaseStart('create_instance', req, { microserviceId });

    const instance = await prisma.instance.create({
      data: buildCreateRecordPayload({
        validatedValues: {
          status: 'Processing',
          microserviceId,
          queuedAt: new Date(), // Track when job was added to queue
          requestTraceId: req.traceId || null, // Store original request traceId for log correlation
        },
        requestBody: body,
        user,
      }),
    });

    logDatabaseSuccess('create_instance', req, { instanceId: instance.id });

    // Enqueue job for single-concurrency processing
    const waitingCount = await computeGenerationQueue.getWaitingCount();
    const delayedCount =
      (await computeGenerationQueue.getJobCounts()).delayed || 0;
    try {
      const countsBefore = await computeGenerationQueue.getJobCounts();
      logWithTrace('Queue counts before enqueue', req, {
        countsBefore,
        waitingCount,
      });
    } catch (_) {
      /* intentionally ignored: optional pre-enqueue log */
    }

    const job = await computeGenerationQueue.add(
      'generate',
      {
        instanceId: instance.id,
        microserviceId,
        generateApiFlag,
        generateFrontendFlag,
        generateDevOpsFlag,
        // Pass minimal user info instead of full user object
        // This avoids passing the short-lived accessToken to the queue
        userInfo: {
          userId: user.id,
          userEmail: user.email,
          roleNames: user.roleNames,
          organisationId: user.organisationId,
          clientId: user.client?.id,
          isAuthenticated: user.isAuthenticated,
          roles: user.roles,
        },
        // Pre-resolved external foreign keys (resolved before enqueue to avoid token expiration)
        externalFks,
        // Pre-fetched menus (fetched before enqueue to avoid token expiration)
        menus: preEnqueueMenus,
        traceId: req?.traceId,
        migrationOptions: {
          skipMigrationAnalysis: false,
          applyAutoFixes: true,
          appliedFixes: appliedMigrationFixes,
        },
      },
      {
        removeOnComplete: true,
        removeOnFail: true,
        jobId: instance.id,
        attempts: Number(process.env.COMPUTE_GEN_MAX_ATTEMPTS) || 10, // Reduced from 50 to avoid excessive retries
        backoff: {
          type: 'exponential',
          delay: Number(process.env.COMPUTE_GEN_RETRY_DELAY_MS) || 5000,
        },
      }
    );

    try {
      const countsAfter = await computeGenerationQueue.getJobCounts();
      const activeJobs = await computeGenerationQueue.getJobs(['active']);
      const computedPosition =
        (activeJobs?.length || 0) +
        (countsAfter?.waiting || 0) +
        (countsAfter?.delayed || 0);

      // Update instance with queue position for frontend visibility
      await prisma.instance.update({
        where: { id: instance.id },
        data: { queuePosition: computedPosition },
      });

      logWithTrace('Job enqueued for computeGenerationQueue', req, {
        jobId: job?.id,
        instanceId: instance.id,
        microserviceId,
        position: computedPosition,
        countsAfter,
        activeCount: activeJobs?.length || 0,
        activeInstanceIds: (activeJobs || [])
          .map((j) => (j && j.data ? j.data.instanceId : null))
          .filter(Boolean),
        configuredConcurrency: 1,
      });
      // Respond immediately with queued feedback using computed counts
      return res.status(202).json({
        id: instance.id,
        status: 'Queued',
        queued: true,
        position: computedPosition,
        queuedAt: instance.createdAt,
        ...(migrationInfo ? { migrationReport: migrationInfo } : {}),
      });
    } catch (_) {
      /* intentionally ignored: optional post-enqueue log */
    }

    // Fallback response position if countsAfter computation failed
    const fallbackPosition = waitingCount + delayedCount + 1;
    // Best-effort update of queue position
    try {
      await prisma.instance.update({
        where: { id: instance.id },
        data: { queuePosition: fallbackPosition },
      });
    } catch (_) {
      /* intentionally ignored: best-effort queue position update */
    }

    return res.status(202).json({
      id: instance.id,
      status: 'Queued',
      queued: true,
      position: fallbackPosition,
      queuedAt: instance.createdAt,
      ...(migrationInfo ? { migrationReport: migrationInfo } : {}),
    });

    // From here onward, the worker will process the job and update the instance
  } catch (error) {
    logOperationError('createComputeMicroservice', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Compute microservice creation validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'compute_microservice_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function validateComputeMicroservice(req, res) {
  const { user, body } = req;

  logOperationStart('validateComputeMicroservice', req, {
    user: user.id,
    bodyKeys: Object.keys(body),
  });

  try {
    const { microserviceId } = await computeMicroserviceValidate.validateAsync(
      body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    logDatabaseStart('get_microservice_for_validation', req, {
      microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: MODEL_DEFN_DETAIL,
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'validate_compute_microservice',
          details: { microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_for_validation', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const { modelDefns, enumDefns, ...rest } = microservice;
    const models = modelDefns
      .filter((model) => !model.deleted)
      .map((model) => ({
        ...model,
        fieldDefns: model.fieldDefns.filter((field) => !field.deleted),
      }));
    const enums = filterDeleted(enumDefns);

    // Fetch menus for validation
    const menus = await fetchSystemMenus(microserviceId, user, req);

    // Perform validation using the extracted utility
    let { validationErrors, hasErrors } =
      await validateMicroserviceConfiguration({
        microservice: rest,
        models,
        menus,
        req,
      });

    let migrationReport = null;
    if (rest?.name) {
      try {
        const { restAPI } = getComputeMicroservicePaths({
          microserviceName: rest?.name,
        });

        migrationReport = await analyzeMigrationIssues({
          microservice: rest,
          models,
          restAPI,
          req,
        });

        const migrationValidationErrors =
          buildMigrationValidationErrors(migrationReport);
        if (migrationValidationErrors) {
          validationErrors = { ...validationErrors, ...migrationValidationErrors };
          hasErrors = true;
        }
      } catch (error) {
        logWithTrace('Migration validation failed', req, {
          error: error?.message,
          context: error?.context,
        });

        validationErrors = {
          ...validationErrors,
          migrationIssues: [
            {
              issue:
                error?.message ||
                'Migration validation failed. Please review recent schema changes.',
              changeType: 'migration_validation_failed',
              severity: 'error',
            },
          ],
        };
        hasErrors = true;
      }
    }

    const result = {
      microserviceId,
      microserviceName: rest.name,
      isValid: !hasErrors,
      validationErrors: hasErrors ? validationErrors : {},
      summary: {
        totalModels: models.length,
        totalEnums: enums.length,
        totalMenus: menus.length,
        errorsFound: hasErrors ? Object.keys(validationErrors).length : 0,
      },
    };

    logOperationSuccess('validateComputeMicroservice', req, {
      microserviceId,
      isValid: !hasErrors,
      errorCount: hasErrors ? Object.keys(validationErrors).length : 0,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('validateComputeMicroservice', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Compute microservice validation request failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'compute_microservice_validation_request',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function cleanupComputeMicroservice(req, res) {
  const { params, user } = req;

  logOperationStart('cleanupComputeMicroservice', req, {
    user: user.id,
    microserviceId: params?.microserviceId,
  });

  try {
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to clean up compute microservices.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'cleanup_compute_microservice',
          details: {
            requiredRoles: ALLOWED_COMPUTE_ROLES,
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    logDatabaseStart('get_microservice_for_cleanup', req, {
      microserviceId: params?.microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: params?.microserviceId,
        ...getVisibilityFilters(user),
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${params?.microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'cleanup_compute_microservice',
          details: { microserviceId: params?.microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_for_cleanup', req, {
      microserviceId: microservice.id,
      microserviceName: microservice.name,
    });

    let clonePaths = [];
    let mainAppClonePath = null;
    const cleanupSummary = {
      localFilesCleanedUp: false,
      mainAppIntegrationRemoved: false,
      gitRepositoriesRemoved: false,
      localClonesRemoved: 0,
      gitCommitSuccess: false,
    };

    // First setup repositories to get proper clone paths
    try {
      logWithTrace('Setting up repository information for cleanup', req, {
        microserviceName: microservice?.name,
      });

      const { restAPIRepo, mainAppRepo, frontendRepo, devOpsRepo } =
        await setupMicroserviceRepositories({
          microserviceName: microservice?.name,
          user,
          skipClone: false, // Need to clone to get proper paths for cleanup
        });

      mainAppClonePath = mainAppRepo?.clonePath;
      clonePaths = [
        restAPIRepo?.clonePath,
        frontendRepo?.clonePath,
        devOpsRepo?.clonePath,
      ].filter(Boolean);

      logWithTrace('Repository paths identified for cleanup', req, {
        mainAppClonePath: !!mainAppClonePath,
        clonePathsCount: clonePaths.length,
      });

      // Now perform cleanup with proper repository paths
      if (mainAppClonePath) {
        try {
          logWithTrace('Starting main app cleanup', req, {
            microserviceName: microservice.name,
          });

          await cleanupMainAppLeftOverFiles({
            microservice,
            user,
            mainAppClonePath, // Pass the actual clone path
          });
          cleanupSummary.localFilesCleanedUp = true;
          cleanupSummary.mainAppIntegrationRemoved = true;

          logWithTrace('Main app cleanup completed successfully', req, {
            microserviceName: microservice.name,
          });
        } catch (cleanupError) {
          logWithTrace('Main app cleanup failed', req, {
            error: cleanupError.message,
            microserviceName: microservice.name,
          });
        }
      } else {
        logWithTrace(
          'Skipping main app cleanup - no clone path available',
          req
        );
      }

      // Only attempt git operations if mainAppClonePath exists and git is available
      if (mainAppClonePath) {
        try {
          logWithTrace('Starting git commit and push operations', req);

          const repos = [
            {
              path: mainAppClonePath,
              commitMessage: `- Clean up ${microservice?.name}`,
              branch: 'dev',
              user,
            },
            ...(process.env.NODE_ENV === 'prod'
              ? [
                  {
                    path: mainAppClonePath,
                    commitMessage: `- Merged Clean up of ${microservice?.name}`,
                    branch: 'dev',
                    mergeBranch: 'main',
                    cherryPick: 'dev',
                    user,
                  },
                ]
              : []),
          ];

          await commitAndPushChanges(repos);
          cleanupSummary.gitCommitSuccess = true;

          logWithTrace('Git commit and push completed successfully', req);
        } catch (gitError) {
          logWithTrace('Git commit/push failed', req, {
            error: gitError.message,
          });
          // Continue with cleanup even if git operations fail
        }
      } else {
        logWithTrace(
          'Skipping git operations - no main app clone path available',
          req
        );
      }
    } catch (repoError) {
      logWithTrace('Repository setup failed', req, {
        error: repoError.message,
      });
      // Continue with cleanup even if repository setup fails
      // Set empty arrays to prevent further errors
      clonePaths = [];
      mainAppClonePath = null;
    }

    // Clean up remote repositories
    if (process.env.GIT_ACCESS_TOKEN) {
      try {
        logWithTrace('Starting remote repository cleanup', req);

        const microserviceSlug = convertToSlug(microservice.name);

        await cleanupMicroserviceRepositories({
          microserviceName: microservice.name,
          microserviceSlug,
          gitlabToken: process.env.GIT_ACCESS_TOKEN,
          gitlabUrl: GITLAB_HOST,
          groupNamespace: `pullstream/microservices`,
        });

        cleanupSummary.gitRepositoriesRemoved = true;

        logWithTrace('Remote repository cleanup completed successfully', req);
      } catch (gitError) {
        logWithTrace('Git repository cleanup failed', req, {
          error: gitError.message,
        });
        // Don't fail the entire cleanup if git cleanup fails
      }
    } else {
      logWithTrace(
        'Skipping remote repository cleanup - GITLAB_TOKEN not configured',
        req
      );
    }

    // Clean up local repository clones
    if (clonePaths.length > 0) {
      try {
        logWithTrace('Starting local repository clone cleanup', req, {
          clonePathsCount: clonePaths.length,
        });

        await removeLocalClones(clonePaths);
        cleanupSummary.localClonesRemoved = clonePaths.length;

        logWithTrace(
          'Local repository clone cleanup completed successfully',
          req
        );
      } catch (cleanupError) {
        logWithTrace('Local clone cleanup failed', req, {
          error: cleanupError.message,
        });
      }
    } else {
      logWithTrace('No local repository clones to clean up', req);
    }

    // Always clean up the computeOutput directory (fallback cleanup)
    // This ensures leftover directories are removed even if clone failed
    const outputSlug = convertToSlug(microservice.name);
    try {
      logWithTrace('Starting compute output directory cleanup', req, {
        microserviceSlug: outputSlug,
      });

      await removeComputeOutputDirectory(outputSlug, req);
      cleanupSummary.computeOutputCleaned = true;

      logWithTrace('Compute output directory cleanup completed', req);
    } catch (cleanupError) {
      logWithTrace('Compute output directory cleanup failed', req, {
        error: cleanupError.message,
      });
    }

    // Clean up from the k8s cluster
    if (microservice.name) {
      try {
        logWithTrace('Starting cleanup from k8s', req, {
          microserviceName: microservice.name,
        });

        await cleanupK8sLeftOver({
          microserviceName: microservice.name,
        });
        cleanupSummary.k8sCleanup = true;

        logWithTrace('cleanup from k8s completed successfully', req);
      } catch (cleanupError) {
        logWithTrace('K8s cleanup cleanup failed', req, {
          error: cleanupError.message,
        });
      }
    } else {
      logWithTrace('No microserviceName to clean up', req);
    }

    // Clean up database records (Instance and InstanceLog)
    try {
      logWithTrace('Starting database records cleanup', req, {
        microserviceId: microservice.id,
      });

      // First get all instance IDs for this microservice
      const instances = await prisma.instance.findMany({
        where: { microserviceId: microservice.id },
        select: { id: true },
      });
      const instanceIds = instances.map((i) => i.id);

      // Delete InstanceLog records first (foreign key constraint)
      const deletedLogs = await prisma.instanceLog.deleteMany({
        where: { instanceId: { in: instanceIds } },
      });

      // Delete Instance records
      const deletedInstances = await prisma.instance.deleteMany({
        where: { microserviceId: microservice.id },
      });

      cleanupSummary.instanceLogsDeleted = deletedLogs.count;
      cleanupSummary.instancesDeleted = deletedInstances.count;

      logWithTrace('Database records cleanup completed', req, {
        instanceLogsDeleted: deletedLogs.count,
        instancesDeleted: deletedInstances.count,
      });
    } catch (dbCleanupError) {
      logWithTrace('Database records cleanup failed', req, {
        error: dbCleanupError.message,
      });
    }

    const result = {
      success: true,
      message: 'Microservice cleanup completed successfully',
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      cleanupSummary,
    };

    logOperationSuccess('cleanupComputeMicroservice', req, {
      microserviceId: microservice.id,
      microserviceName: microservice.name,
      cleanupSummary,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('cleanupComputeMicroservice', req, error);

    // Provide more specific error information
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      originalError: error.originalError || null,
    };

    throw createErrorWithTrace(
      ERROR_TYPES.INTERNAL,
      `Microservice cleanup encountered errors: ${error.message}. Some cleanup operations may have succeeded.`,
      req,
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'cleanup_compute_microservice',
        details: errorDetails,
        originalError: error,
      }
    );
  }
}

async function generatePrismaSchemaString(req, res) {
  const { user, body } = req;

  logOperationStart('generatePrismaSchemaString', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to generate Prisma schema strings for compute microservices.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'generate_prisma_schema_string',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    const { microserviceId } =
      await computeMicroservicePrismaSchema.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });

    logDatabaseStart('get_microservice_for_prisma_schema', req, {
      microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: MODEL_DEFN_DETAIL,
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'generate_prisma_schema_string',
          details: { microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_for_prisma_schema', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const { modelDefns, enumDefns } = microservice;
    const models = modelDefns
      .filter((model) => model.deleted === null)
      .map((model) => ({
        ...model,
        fieldDefns: model.fieldDefns.filter((field) => field.deleted === null),
      }));
    const enums = filterDeleted(enumDefns);

    logWithTrace('Generating Prisma schema strings', req, {
      modelCount: models.length,
      enumCount: enums.length,
    });

    const enumString = generatePrismaEnumString(enums);
    const lookupModels = models.filter((m) => m.lookup === true);
    const otherModels = models.filter((m) => !m.lookup);
    const lookupModelString = generatePrismaModelFieldsOnlyString(
      lookupModels,
      microserviceId
    );
    const otherModelString = generatePrismaModelFieldsOnlyString(
      otherModels,
      microserviceId
    );
    const modelString = generatePrismaModelFieldsOnlyString(
      models,
      microserviceId
    );

    const result = {
      microserviceId,
      microserviceName: microservice.name,
      prismaSchema: {
        enums: enumString,
        lookupModels: lookupModelString,
        otherModels: otherModelString,
        models: modelString,
        complete: `${enumString}\n${modelString}`,
      },
      metadata: {
        totalModels: models.length,
        totalLookupModels: lookupModels.length,
        totalOtherModels: otherModels.length,
        totalEnums: enums.length,
        generatedAt: new Date().toISOString(),
      },
    };

    logOperationSuccess('generatePrismaSchemaString', req, {
      microserviceId,
      microserviceName: microservice.name,
      modelCount: models.length,
      enumCount: enums.length,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('generatePrismaSchemaString', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Prisma schema generation validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'prisma_schema_generation_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function getModelsFields(req, res) {
  const { user, body } = req;

  logOperationStart('getModelsFields', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to access models and fields for compute microservices.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'get_models_fields',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    const { microserviceId } =
      await computeMicroservicePrismaSchema.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });

    logDatabaseStart('get_microservice_models_fields', req, {
      microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        modelDefns: {
          where: { deleted: null },
          include: {
            fieldDefns: {
              ...FIELD_DEFN_DETAIL,
              where: { deleted: null },
            },
            displayValue: DISPLAY_VALUE_DETAIL,
            dashboardStageField: FIELD_DEFN_DETAIL,
            microservice: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_models_fields',
          details: { microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_models_fields', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const { modelDefns } = microservice;

    // Filter out deleted models and fields
    const models = modelDefns
      .filter((model) => model.deleted === null)
      .map((model) => {
        const fields = model.fieldDefns
          .filter((field) => field.deleted === null)
          .map((field) => {
            const { isForeignKey } = field;

            const baseField = {
              id: field.id,
              order: field.order,
              name: field.name,
              description: field.description,
              helpfulHint: field.helpfulHint,
              dataType: field.dataType,
              isForeignKey,
              isClickable: field.isClickableLink || false,
              isOptional: field.isOptional || false,
              isIndex: field.isIndex || false,
            };

            // Only include foreign key related fields if isForeignKey is true
            if (isForeignKey) {
              const foreignKeyTarget = field.foreignKeyTarget || null;

              if (foreignKeyTarget === 'Internal') {
                return {
                  ...baseField,
                  foreignKeyTarget: field.foreignKeyTarget || null,

                  foreignKeyModel: field.foreignKeyModel?.name || null,
                };
              }

              return {
                ...baseField,
                foreignKeyTarget: field.foreignKeyTarget || null,
                externalMicroservice: field.externalMicroservice || null,
                externalModel: field.externalModel || null,
              };
            }

            return baseField;
          });

        // Map model display value field (if any) using the same shape as fields above
        const displayValue = (() => {
          const field = model.fieldDefns.find(
            (field) => field.id === model.displayValueId
          );
          if (!field) return null;

          const baseField = {
            name: field.name,
            description: field.description,
            dataType: field.dataType,
          };

          return baseField;
        })();

        return {
          id: model.id,
          name: model.name,
          label: model.label,
          lookup: model.lookup,
          description: model.description,
          helpfulHint: model.helpfulHint,
          displayValueId: model.displayValueId || null,
          displayValue,
          fields,
        };
      });

    const result = {
      microserviceId,
      microserviceName: microservice.name,
      models,
      metadata: {
        totalModels: models.length,
        totalFields: models.reduce(
          (sum, model) => sum + model.fields.length,
          0
        ),
        generatedAt: new Date().toISOString(),
      },
    };

    logOperationSuccess('getModelsFields', req, {
      microserviceId,
      microserviceName: microservice.name,
      modelCount: models.length,
      totalFieldCount: result.metadata.totalFields,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('getModelsFields', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Models and fields retrieval validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_models_fields_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function getModelsFieldsCompact(req, res) {
  let { user } = req;
  const { body } = req;

  logOperationStart('getModelsFieldsCompact', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    const { microserviceId, excludeFieldMeta, client, createdBy } =
      await computeMicroserviceModelsFieldsCompact.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });

    // Handle internal request authentication
    const isInternal = !user.isAuthenticated && user.internalRequest;

    if (isInternal) {
      if (!client) {
        throw createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'For internal requests, client field is required.',
          req,
          {
            context: 'get_models_fields_compact',
            severity: ERROR_SEVERITY.LOW,
          }
        );
      }
      // Override user object with provided values for visibility filtering
      user = { ...user, client: { id: client }, id: createdBy, isAuthenticated: true };
    }

    logDatabaseStart('get_microservice_models_fields_compact', req, {
      microserviceId,
      excludeFieldMeta,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: {
          where: { deleted: null },
          include: {
            fieldDefns: {
              ...FIELD_DEFN_DETAIL,
              where: { deleted: null },
            },
          },
        },
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_models_fields_compact',
          details: { microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_models_fields_compact', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const { modelDefns } = microservice;

    // Collect all fields for external FK resolution
    const allFieldsFlat = modelDefns
      .filter((model) => model.deleted === null)
      .flatMap((model) =>
        model.fieldDefns
          .filter((field) => field.deleted === null)
          .map((field) => ({
            ...field,
            modelName: model.name,
          }))
      );

    // Resolve external foreign keys using getDetailsFromAPI
    let fieldsWithDetails = allFieldsFlat;
    try {
      fieldsWithDetails = await getDetailsFromAPI({
        results: allFieldsFlat,
        token: user.accessToken,
      });
    } catch (error) {
      logWithTrace(
        'Failed to resolve external foreign keys, using UUIDs as fallback',
        req,
        { error: error.message }
      );
    }

    // Create a map of field.id -> resolved details for quick lookup
    const fieldDetailsMap = new Map(
      fieldsWithDetails.map((f) => [f.id, f.details || {}])
    );

    // Ultra-compact format optimized for LLM token efficiency
    const models = modelDefns
      .filter((model) => model.deleted === null)
      .map((model) => {
        const fields = model.fieldDefns
          .filter((field) => field.deleted === null)
          .map((field) => {
            const compactField = {
              name: field.name,
              label: field.label,
              dataType: field.dataType,
              isOptional: field.isOptional,
            };

            // Include id and description unless excludeFieldMeta is true
            if (!excludeFieldMeta) {
              compactField.id = field.id;
              compactField.description = field.description;
            }

            // Handle enum references
            if (field.enumDefn) {
              compactField.enumTo = field.enumDefn.name;
            }

            // Handle foreign keys
            if (field.isForeignKey) {
              const { foreignKeyTarget } = field;

              if (foreignKeyTarget === 'Internal') {
                compactField.foreignKeyTo = `Internal:${field.foreignKeyModel?.name || 'Unknown'}`;
              } else if (foreignKeyTarget === 'External') {
                // Get resolved names from getDetailsFromAPI
                const details = fieldDetailsMap.get(field.id) || {};
                const microserviceName =
                  details.externalMicroserviceId?.name ||
                  field.externalMicroserviceId ||
                  'Unknown';
                const modelName =
                  details.externalModelId?.name ||
                  field.externalModelId ||
                  'Unknown';
                compactField.foreignKeyTo = `External:${microserviceName}.${modelName}`;
              }
            }

            return compactField;
          });

        const compactModel = {
          id: model.id,
          name: model.name,
          label: model.label,
          description: model.description,
          lookup: model.lookup,
          fields,
        };

        return compactModel;
      });

    // Process enum definitions
    const enums = (microservice.enumDefns || [])
      .filter((enumDefn) => enumDefn.deleted === null)
      .map((enumDefn) => ({
        id: enumDefn.id,
        name: enumDefn.name,
        label: enumDefn.label,
        values: (enumDefn.enumValues || [])
          .filter((v) => v.deleted === null)
          .map((v) => ({
            id: v.id,
            name: v.name,
            label: v.label,
          })),
      }));

    const result = {
      id: microserviceId,
      microservice: microservice.name,
      models,
      enums,
    };

    logOperationSuccess('getModelsFieldsCompact', req, {
      microserviceId,
      microserviceName: microservice.name,
      modelCount: models.length,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('getModelsFieldsCompact', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Compact models and fields retrieval validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_models_fields_compact_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function getModels(req, res) {
  const { user, body } = req;

  logOperationStart('getModels', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to access models for compute microservices.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'get_models',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    const { microserviceId } =
      await computeMicroservicePrismaSchema.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });

    logDatabaseStart('get_microservice_models', req, {
      microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      select: {
        id: true,
        name: true,
        modelDefns: {
          where: { deleted: null },
          select: {
            id: true,
            name: true,
            label: true,
            description: true,
            helpfulHint: true,
          },
        },
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_models',
          details: { microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_models', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const result = {
      microserviceId,
      microserviceName: microservice.name,
      models: microservice.modelDefns,
      metadata: {
        totalModels: microservice.modelDefns.length,
        generatedAt: new Date().toISOString(),
      },
    };

    logOperationSuccess('getModels', req, {
      microserviceId,
      microserviceName: microservice.name,
      modelCount: microservice.modelDefns.length,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('getModels', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Models retrieval validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_models_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

async function autofixComputeMicroservice(req, res) {
  const { user, body } = req;

  logOperationStart('autofixComputeMicroservice', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    if (!hasComputeAdminAccess(user)) {
      throw createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'You do not have permission to autofix compute microservice configurations.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'autofix_compute_microservice',
          details: {
            userRoles: user?.roleNames ?? [],
          },
        }
      );
    }

    const { microserviceId } = await computeMicroserviceAutofix.validateAsync(
      body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    logDatabaseStart('get_microservice_for_autofix', req, {
      microserviceId,
    });

    const microservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: MODEL_DEFN_DETAIL,
      },
    });

    if (!microservice || !microservice?.name) {
      throw createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        `The microservice with ID '${microserviceId}' could not be found or you don't have access to it.`,
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'autofix_compute_microservice',
          details: { microserviceId },
        }
      );
    }

    logDatabaseSuccess('get_microservice_for_autofix', req, {
      microserviceId,
      microserviceName: microservice.name,
    });

    const { modelDefns, ...rest } = microservice;
    const models = modelDefns
      .filter((model) => !model.deleted)
      .map((model) => ({
        ...model,
        fieldDefns: model.fieldDefns.filter((field) => !field.deleted),
      }));

    // Fetch menus for validation
    const menus = await fetchSystemMenus(microserviceId, user, req);

    // Perform initial validation to get errors
    const beforeValidation = await validateMicroserviceConfiguration({
      microservice: rest,
      models,
      menus,
      req,
    });

    if (!beforeValidation.hasErrors) {
      // No errors to fix
      logOperationSuccess('autofixComputeMicroservice', req, {
        microserviceId,
        microserviceName: rest.name,
        message: 'No fixable errors found',
      });

      return res.status(200).json({
        microserviceId,
        microserviceName: rest.name,
        fixesApplied: 0,
        appliedFixes: [],
        remainingErrors: {},
        isNowValid: true,
        message: 'No fixable errors found - microservice configuration is already valid.',
      });
    }

    // Apply auto-fixes
    const { appliedFixes } = await applyValidationAutoFixes({
      validationErrors: beforeValidation.validationErrors,
      microserviceId,
      prisma,
      req,
    });

    // Re-fetch and re-validate to get remaining errors
    const updatedMicroservice = await prisma.microservice.findFirst({
      where: {
        id: microserviceId,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: ENUM_DEFN_DETAIL,
        modelDefns: MODEL_DEFN_DETAIL,
      },
    });

    const { modelDefns: updatedModelDefns, ...updatedRest } = updatedMicroservice;
    const updatedModels = updatedModelDefns
      .filter((model) => !model.deleted)
      .map((model) => ({
        ...model,
        fieldDefns: model.fieldDefns.filter((field) => !field.deleted),
      }));

    const afterValidation = await validateMicroserviceConfiguration({
      microservice: updatedRest,
      models: updatedModels,
      menus,
      req,
    });

    const result = {
      microserviceId,
      microserviceName: rest.name,
      fixesApplied: appliedFixes.length,
      appliedFixes,
      remainingErrors: afterValidation.hasErrors
        ? afterValidation.validationErrors
        : {},
      isNowValid: !afterValidation.hasErrors,
      summary: {
        errorsBeforeFix: Object.keys(beforeValidation.validationErrors).length,
        errorsAfterFix: afterValidation.hasErrors
          ? Object.keys(afterValidation.validationErrors).length
          : 0,
      },
    };

    logOperationSuccess('autofixComputeMicroservice', req, {
      microserviceId,
      microserviceName: rest.name,
      fixesApplied: appliedFixes.length,
      isNowValid: !afterValidation.hasErrors,
    });

    res.status(200).json(result);
  } catch (error) {
    logOperationError('autofixComputeMicroservice', req, error);

    if (error.isJoi) {
      throw createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Autofix request validation failed',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'autofix_compute_microservice_validation',
          details: { validationErrors: error.details },
        }
      );
    }
    throw error;
  }
}

module.exports = {
  createComputeMicroservice,
  validateComputeMicroservice,
  cleanupComputeMicroservice,
  generatePrismaSchemaString,
  getModelsFields,
  getModelsFieldsCompact,
  getModels,
  autofixComputeMicroservice,
};
