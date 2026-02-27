const { RESOURCES, TASK_STATUSES, DURATION_UNIT } = require('./constants');

function validateOwnerInput(name) {
  const uuid = RESOURCES[name];
  if (!uuid) {
    const valid = Object.keys(RESOURCES).join(', ');
    throw new Error(`Unknown owner "${name}". Valid owners: ${valid}`);
  }
  return uuid;
}

function resolveStatus(key) {
  // Accept raw UUIDs (pass through) or key names like "IN_PROGRESS"
  if (TASK_STATUSES[key]) return TASK_STATUSES[key];
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  if (isUUID) return key;
  const valid = Object.keys(TASK_STATUSES).join(', ');
  throw new Error(`Unknown status "${key}". Valid statuses: ${valid}`);
}

function validateTaskData(task, opts = {}) {
  const errors = [];

  if (!task.name || typeof task.name !== 'string' || !task.name.trim()) {
    errors.push('name is required and must be a non-empty string');
  }

  if (task.owner !== undefined) {
    const isUUID = /^[0-9a-f]{8}-/i.test(task.owner);
    if (!isUUID && !RESOURCES[task.owner]) {
      errors.push(`owner "${task.owner}" is not a known resource`);
    }
  }

  if (task.status !== undefined) {
    try {
      resolveStatus(task.status);
    } catch {
      errors.push(`status "${task.status}" is not valid`);
    }
  }

  for (const field of ['duration_estimate', 'duration_actual']) {
    if (task[field] !== undefined && task[field] !== null) {
      if (typeof task[field] !== 'number' || !Number.isInteger(task[field])) {
        errors.push(`${field} must be an integer, got ${task[field]}`);
      } else if (task[field] < 0 || task[field] > 32767) {
        errors.push(`${field} must be 0-32767, got ${task[field]}`);
      }
    }
  }

  if (task.duration_unit !== undefined && task.duration_unit !== DURATION_UNIT) {
    errors.push(`duration_unit must be "${DURATION_UNIT}", got "${task.duration_unit}"`);
  }

  if (errors.length > 0 && !opts.silent) {
    const label = task.name || '(unnamed)';
    throw new Error(`Invalid task "${label}":\n  - ${errors.join('\n  - ')}`);
  }

  return errors;
}

module.exports = { validateOwnerInput, validateTaskData, resolveStatus };
