const { randomUUID } = require('crypto');
const { writeFile, unlink } = require('fs/promises');
const { runCommand } = require('#utils/shared/shellUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');

function validateSshParams({ host, port, user, privateKey, command }) {
  // Validate host
  if (!host || typeof host !== 'string' || !/^[a-zA-Z0-9.-]+$/.test(host)) {
    throw new Error('Invalid host format');
  }

  // Validate port
  const portNum = parseInt(port, 10);
  if (!portNum || portNum < 1 || portNum > 65535) {
    throw new Error('Invalid port number');
  }

  // Validate user
  if (!user || typeof user !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(user)) {
    throw new Error('Invalid user format');
  }

  // Validate private key
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('Private key is required');
  }

  // Validate command - allow safe commands for ingress setup
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command');
  }

  // Allow specific ingress setup commands
  // const isIngressCommand =
  //   command.includes('sudo su -c') &&
  //   (command.includes('/mnt/synology-k8s/config/pullstream/04-ingress/') ||
  //     command.includes(
  //       'kubectl apply -f /mnt/synology-k8s/config/pullstream/04-ingress/'
  //     ));

  // if (!isIngressCommand) {
  //   // Block dangerous patterns for non-ingress commands
  //   if (/[;&|`$<>]/.test(command)) {
  //     throw new Error('Invalid or potentially dangerous command');
  //   }
  // }

  return { host, port: portNum, user, privateKey, command };
}

const sshCommand = withErrorHandling(async (params) => {
  let tempKeyPath = null;
  const traceId = params?.traceId || null;
  try {
    const { host, port, user, privateKey, command } = validateSshParams(params);
    tempKeyPath = `/tmp/temp_ssh_key_${randomUUID().replace(/-/g, '')}`;
    await writeFile(tempKeyPath, privateKey, { mode: 0o600 });
    await runCommand('ssh', [
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-o',
      'ConnectTimeout=30',
      '-i',
      tempKeyPath,
      '-p',
      port.toString(),
      `${user}@${host}`,
      command,
    ]);
    logWithTrace(
      `[Success]: SSH command executed on ${host}`,
      { traceId },
      { command }
    );
  } catch (error) {
    logWithTrace(
      '[Error]: Failed to execute SSH command',
      { traceId },
      { error: error?.message }
    );
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Failed to execute SSH command',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'ssh_command',
        details: { traceId, error: error?.message },
        originalError: error,
      }
    );
  } finally {
    if (tempKeyPath) {
      try {
        await unlink(tempKeyPath);
        logWithTrace(
          '[Success]: Cleaned up temporary SSH key',
          { traceId },
          { tempKeyPath }
        );
      } catch (cleanupError) {
        logWithTrace(
          '[Error]: Failed to clean up temp key file',
          { traceId },
          { tempKeyPath, error: cleanupError?.message }
        );
      }
    }
  }
}, 'ssh_command');

module.exports = {
  sshCommand,
};
