/**
 * Log Extraction Utilities
 *
 * Provides functions to extract and aggregate logs for a specific generation
 * by traceId or instanceId. Useful for debugging and monitoring generation pipeline.
 */

const fs = require('fs');
const path = require('path');
const prisma = require('#configs/prisma.js');

/**
 * Get all logs for a specific instance/traceId
 * Searches both the database (InstanceLog entries) and file-based logs
 *
 * @param {string} traceId - The trace ID or instance ID to search for
 * @param {Object} options - Options
 * @param {boolean} [options.includeFileLogs=true] - Include logs from file system
 * @param {boolean} [options.includeDatabaseLogs=true] - Include logs from database
 * @param {number} [options.maxDaysBack=7] - Maximum days to search back in file logs
 * @returns {Promise<Object>} Aggregated logs
 */
async function getLogsForTrace(traceId, options = {}) {
  const {
    includeFileLogs = true,
    includeDatabaseLogs = true,
    maxDaysBack = 7,
  } = options;

  const result = {
    traceId,
    fileLogs: [],
    instanceLogs: [],
    instance: null,
  };

  // Get instance and its logs from database
  if (includeDatabaseLogs) {
    try {
      result.instance = await prisma.instance.findFirst({
        where: {
          OR: [
            { requestTraceId: traceId },
            { id: traceId },
          ],
        },
        include: {
          instanceLogs: {
            orderBy: { createdAt: 'asc' },
            include: { block: true },
          },
          microservice: {
            select: { name: true, id: true },
          },
        },
      });

      if (result.instance) {
        result.instanceLogs = result.instance.instanceLogs.map((log) => ({
          timestamp: log.createdAt,
          phase: log.block?.name || 'Unknown',
          phaseCode: log.block?.code || null,
          status: log.status,
          message: log.message,
          parsedMessage: (() => {
            try {
              return JSON.parse(log.message);
            } catch {
              return null;
            }
          })(),
        }));
      }
    } catch (dbError) {
      result.databaseError = dbError.message;
    }
  }

  // Search file logs
  if (includeFileLogs) {
    const logsDir = path.join('/tmp', 'logs');

    if (fs.existsSync(logsDir)) {
      try {
        const logFiles = fs
          .readdirSync(logsDir)
          .filter((f) => f.endsWith('-logs.txt'))
          .sort()
          .reverse()
          .slice(0, maxDaysBack); // Limit to recent files

        for (const logFile of logFiles) {
          try {
            const content = fs.readFileSync(
              path.join(logsDir, logFile),
              'utf8'
            );
            const lines = content.split('\n');

            for (const line of lines) {
              if (line.includes(`TraceID: ${traceId}`) || line.includes(traceId)) {
                result.fileLogs.push({
                  file: logFile,
                  line: line.trim(),
                });
              }
            }
          } catch (readError) {
            // Skip files that can't be read
          }
        }
      } catch (dirError) {
        result.fileLogsError = dirError.message;
      }
    }
  }

  return result;
}

/**
 * Format logs for display/export
 * Creates a structured summary suitable for API responses or debugging
 *
 * @param {Object} logsResult - Result from getLogsForTrace
 * @returns {Object} Formatted logs
 */
function formatLogsForExport(logsResult) {
  const { traceId, instance, instanceLogs, fileLogs, databaseError, fileLogsError } = logsResult;

  return {
    traceId,
    generationSummary: instance
      ? {
          instanceId: instance.id,
          microserviceName: instance.microservice?.name,
          microserviceId: instance.microserviceId,
          status: instance.status,
          duration: instance.duration,
          startedAt: instance.processingStartedAt,
          completedAt: instance.updatedAt,
          createdAt: instance.createdAt,

          // Error information (if failed)
          errorType: instance.errorType,
          errorPhase: instance.errorPhase,
          errorContext: instance.errorContext,
          failureReason: instance.failureReason,
          errorDetails: instance.errorDetails,

          // URLs (if completed)
          apiGitRepoUrl: instance.apiGitRepoUrl,
          feGitRepoUrl: instance.feGitRepoUrl,
          devopsGitRepoUrl: instance.devopsGitRepoUrl,
        }
      : null,

    phases: instanceLogs.map((log) => ({
      timestamp: log.timestamp,
      phase: log.phase,
      phaseCode: log.phaseCode,
      status: log.status,
      details: log.parsedMessage,
    })),

    detailedLogs: fileLogs.map((f) => f.line),

    metadata: {
      totalPhases: instanceLogs.length,
      totalFileLogs: fileLogs.length,
      exportedAt: new Date().toISOString(),
      errors: {
        database: databaseError || null,
        fileLogs: fileLogsError || null,
      },
    },
  };
}

/**
 * Get a quick summary of logs for an instance
 * Useful for API responses that need minimal data
 *
 * @param {string} instanceId - The instance ID
 * @returns {Promise<Object>} Quick summary
 */
async function getLogsSummary(instanceId) {
  const instance = await prisma.instance.findUnique({
    where: { id: instanceId },
    include: {
      instanceLogs: {
        orderBy: { createdAt: 'desc' },
        take: 10, // Last 10 log entries
        include: { block: true },
      },
    },
  });

  if (!instance) {
    return null;
  }

  return {
    instanceId: instance.id,
    status: instance.status,
    duration: instance.duration,
    requestTraceId: instance.requestTraceId,
    errorType: instance.errorType,
    errorPhase: instance.errorPhase,
    failureReason: instance.failureReason,
    recentLogs: instance.instanceLogs.map((log) => ({
      timestamp: log.createdAt,
      phase: log.block?.name || log.block?.code,
      status: log.status,
    })),
  };
}

module.exports = {
  getLogsForTrace,
  formatLogsForExport,
  getLogsSummary,
};
