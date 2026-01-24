/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 * DESCRIPTION:
 * ------------------
 * This module provides utilities for validating dates in specific formats.
 * It contains functions to validate:
 * - ISO 8601 date format (YYYY-MM-DD)
 * - ISO 8601 datetime format (e.g., 2025-08-30T14:25:36.123Z)
 */
const { isValid: isDateValid, parseISO } = require('date-fns');

/**
 * Validates if a string is in ISO 8601 date format (YYYY-MM-DD)
 * @param {string} value - The date string to validate
 * @returns {boolean} - True if the date is valid and in the correct format
 */
const isValidISODateFormat = (value) => {
  // Check if it's a valid string
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Check if the string matches the ISO date format YYYY-MM-DD
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDatePattern.test(value)) {
    return false;
  }

  // Use date-fns to check if it's a valid date
  const parsedDate = parseISO(value);
  return isDateValid(parsedDate);
};

/**
 * Joi custom validation function for ISO 8601 date format (YYYY-MM-DD)
 * @param {string} value - The date string to validate
 * @param {object} helpers - Joi helper object
 * @returns {string|object} - Returns the value if valid, or an error message if invalid
 */
const validateISODate = (value, helpers) => {
  if (!value) return value;

  if (!isValidISODateFormat(value)) {
    return helpers.message('Invalid ISO date format. Use YYYY-MM-DD format');
  }

  return value;
};

/**
 * Validates if a string is in ISO 8601 datetime format
 * Accepts common variants like:
 *  - 2025-08-30T14:25:36Z
 *  - 2025-08-30T14:25:36.123Z
 *  - 2025-08-30T14:25:36+05:30
 *  - 2025-08-30T14:25:36.123+05:30
 * Timezone part is optional, but time component is required.
 * @param {string} value - The datetime string to validate
 * @returns {boolean}
 */
const isValidISODateTimeFormat = (value) => {
  if (!value || typeof value !== 'string') {
    return false;
  }

  // Require presence of time component with optional seconds and milliseconds
  const isoDateTimePattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/;
  if (!isoDateTimePattern.test(value)) {
    return false;
  }

  const parsed = parseISO(value);
  return isDateValid(parsed);
};

/**
 * Joi custom validation function for ISO 8601 datetime format
 * @param {string} value
 * @param {object} helpers
 * @returns {string|object}
 */
const validateISODateTime = (value, helpers) => {
  if (!value) return value;

  if (!isValidISODateTimeFormat(value)) {
    return helpers.message(
      'Invalid ISO datetime format. Use YYYY-MM-DDTHH:mm[:ss[.SSS]][Z|±HH:MM]'
    );
  }

  return value;
};

module.exports = {
  isValidISODateFormat,
  validateISODate,
  isValidISODateTimeFormat,
  validateISODateTime,
};
