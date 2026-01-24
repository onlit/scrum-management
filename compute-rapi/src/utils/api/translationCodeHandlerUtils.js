const {
  createStandardError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
} = require('#configs/constants.js');

/**
 * Validates if a translation code has the correct format (XXXX-XXX)
 * @param {string} code - The translation code to validate
 * @returns {boolean} - True if the code has valid format, false otherwise
 */
function isValidCodeFormat(code) {
  // Code format should be XXXX-XXX where X is uppercase letter or digit
  const codeRegex = /^[A-Z0-9]{4}-[A-Z0-9]{3}$/;
  return codeRegex.test(code);
}

/**
 * Checks if a translation code is unique within a client for a specific language
 * @param {Object} prisma - Prisma client instance
 * @param {string} translationCode - The translation code to check
 * @param {string} clientId - The client ID to check against
 * @param {string} languageId - The language ID to check against
 * @param {string} [excludeId] - Optional ID to exclude from the check (for updates)
 * @returns {Promise<boolean>} - True if the code is unique for this language, false otherwise
 */
async function isCodeUniqueForLanguage(
  prisma,
  translationCode,
  clientId,
  languageId,
  excludeId = null
) {
  const whereClause = {
    translationCode,
    client: clientId,
    languageId,
    deleted: null, // Only check non-deleted translations
  };

  // If excluding an ID (for updates), add it to the where clause
  if (excludeId) {
    whereClause.NOT = { id: excludeId };
  }

  const existingTranslation = await prisma.translation.findFirst({
    where: whereClause,
  });

  return !existingTranslation;
}

/**
 * Checks if a translation code exists for a client (regardless of language)
 * This is useful for generating new codes
 * @param {Object} prisma - Prisma client instance
 * @param {string} translationCode - The translation code to check
 * @param {string} clientId - The client ID to check against
 * @returns {Promise<boolean>} - True if the code exists for this client, false otherwise
 */
async function isCodeUnique(prisma, translationCode, clientId) {
  const existingTranslation = await prisma.translation.findFirst({
    where: {
      translationCode,
      client: clientId,
      deleted: null,
    },
  });

  return !existingTranslation;
}

/**
 * Generates a random alphanumeric string of specified length
 * @param {number} length - The length of the string to generate
 * @returns {string} - Random alphanumeric string
 */
function getRandomAlphanumeric(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

/**
 * Generates a unique translation code for a client
 * @param {Object} prisma - Prisma client instance
 * @param {string} clientId - The client ID to generate a unique code for
 * @returns {Promise<string>} - Unique translation code in the format XXXX-XXX
 */
async function generateUniqueCode(prisma, clientId) {
  let isUnique = false;
  let code;
  let attempts = 0;
  const MAX_ATTEMPTS = 10; // Prevent infinite loops

  while (!isUnique && attempts < MAX_ATTEMPTS) {
    const prefix = getRandomAlphanumeric(4);
    const number = getRandomAlphanumeric(3);
    code = `${prefix}-${number}`;
    isUnique = await isCodeUnique(prisma, code, clientId);
    attempts++;
  }

  if (!isUnique) {
    throw createStandardError(
      ERROR_TYPES.INTERNAL,
      'Failed to generate a unique translation code after multiple attempts',
      {
        severity: ERROR_SEVERITY.HIGH,
        context: 'translation_code_generation',
        details: { clientId, attempts: MAX_ATTEMPTS },
      }
    );
  }

  return code;
}

/**
 * Handles translation code generation or validation
 * @param {Object} prisma - Prisma client instance
 * @param {Object} data - The translation data
 * @param {string} clientId - The client ID
 * @param {string} [currentId] - Optional current translation ID (for updates)
 * @returns {Promise<string>} - Valid translation code
 */
async function handleTranslationCode(prisma, data, clientId, currentId = null) {
  // If a code is provided, validate it
  if (data.translationCode) {
    // Check format
    if (!isValidCodeFormat(data.translationCode)) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Invalid translation code format. Must be in the format XXXX-XXX with uppercase letters and numbers only.',
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'translation_code_format_validation',
          details: {
            providedCode: data.translationCode,
            expectedFormat: 'XXXX-XXX',
          },
        }
      );
    }

    // For translation codes, uniqueness is per client AND language
    if (data.languageId) {
      // Check uniqueness for this specific language (considering the current ID if it's an update)
      const isUniqueForLanguage = await isCodeUniqueForLanguage(
        prisma,
        data.translationCode,
        clientId,
        data.languageId,
        currentId
      );

      if (!isUniqueForLanguage) {
        throw createStandardError(
          ERROR_TYPES.CONFLICT,
          'A translation with this code already exists for this language',
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'translation_code_uniqueness_check',
            details: {
              translationCode: data.translationCode,
              languageId: data.languageId,
              clientId,
            },
          }
        );
      }
    }

    return data.translationCode;
  }

  // If no code is provided, generate one
  return generateUniqueCode(prisma, clientId);
}

module.exports = { handleTranslationCode };
