/**
 * Translation Code Generator Utilities
 *
 * Generates and validates translation codes in XXXX-XXX format.
 * Uses distributed locking via Redlock to prevent race conditions
 * when multiple requests generate codes simultaneously.
 */

const redlock = require('#configs/redlock.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

const CODE_REGEX = /^[A-Z0-9]{4}-[A-Z0-9]{3}$/;
const MAX_GENERATION_ATTEMPTS = 10;
const LOCK_TTL_MS = 5000; // 5 seconds lock duration

/**
 * Validates translation code format (XXXX-XXX)
 * @param {string} code - Code to validate
 * @returns {boolean} True if valid format
 */
function isValidCodeFormat(code) {
  if (!code || typeof code !== 'string') return false;
  return CODE_REGEX.test(code);
}

/**
 * Generates random alphanumeric string (uppercase)
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
function getRandomAlphanumeric(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Checks if translation code is unique within client scope
 * @param {Object} prisma - Prisma client
 * @param {string} code - Code to check
 * @param {string} clientId - Client ID
 * @returns {Promise<boolean>} True if unique
 */
async function isCodeUnique(prisma, code, clientId) {
  const existing = await prisma.translation.findFirst({
    where: {
      translationCode: code,
      client: clientId,
      deleted: null,
    },
    select: { id: true },
  });
  return !existing;
}

/**
 * Generates unique translation code (without locking)
 * Use generateUniqueCodeWithLock for concurrent environments
 * @param {Object} prisma - Prisma client
 * @param {string} clientId - Client ID
 * @returns {Promise<string>} Unique code
 */
async function generateUniqueCode(prisma, clientId) {
  let attempts = 0;

  while (attempts < MAX_GENERATION_ATTEMPTS) {
    const prefix = getRandomAlphanumeric(4);
    const suffix = getRandomAlphanumeric(3);
    const code = `${prefix}-${suffix}`;

    const unique = await isCodeUnique(prisma, code, clientId);
    if (unique) {
      return code;
    }

    attempts += 1;
  }

  throw createStandardError(
    ERROR_TYPES.INTERNAL,
    'Failed to generate unique translation code after maximum attempts',
    {
      severity: ERROR_SEVERITY.HIGH,
      context: 'translation_code_generation',
      details: { clientId, attempts: MAX_GENERATION_ATTEMPTS },
    }
  );
}

/**
 * Generates unique translation code with distributed lock
 * Prevents race conditions when multiple processes generate codes
 * @param {Object} prisma - Prisma client
 * @param {string} clientId - Client ID
 * @returns {Promise<string>} Unique code
 */
async function generateUniqueCodeWithLock(prisma, clientId) {
  const lockKey = `lock:translation-code:${clientId}`;
  let lock = null;

  try {
    // Acquire distributed lock for this client's code generation
    lock = await redlock.acquire([lockKey], LOCK_TTL_MS);

    // Generate code while holding lock
    const code = await generateUniqueCode(prisma, clientId);

    return code;
  } finally {
    // Always release lock
    if (lock) {
      try {
        await lock.release();
      } catch (releaseError) {
        // Log but don't throw - lock will auto-expire
        console.error(
          '[REDLOCK] Failed to release lock:',
          releaseError.message
        );
      }
    }
  }
}

module.exports = {
  isValidCodeFormat,
  generateUniqueCode,
  generateUniqueCodeWithLock,
  isCodeUnique,
  getRandomAlphanumeric,
  CODE_REGEX,
  MAX_GENERATION_ATTEMPTS,
};
