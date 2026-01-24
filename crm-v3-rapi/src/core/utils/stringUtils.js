/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file focuses on string manipulation and processing. It can contain functions for common string operations such as formatting, sanitizing, and other manipulations needed across the application to handle text data effectively.
 *
 *
 */
const _ = require('lodash');
const pluralize = require('pluralize');
const { DISPLAY_VALUE_PROP } = require('#configs/constants.js');

/**
 * Supported format hints for template interpolation.
 * Use in templates like: {effectiveDate|date} or {createdAt|datetime}
 */
const FORMAT_HINTS = {
  DATE: 'date', // Formats as d/M/yy (e.g., 15/12/25)
  DATETIME: 'datetime', // Formats as d/M/yy HH:mm (e.g., 15/12/25 14:30)
};

/**
 * Parses a Date-like value into a JavaScript Date object.
 * Handles Date objects, ISO strings, and timestamps.
 *
 * @param {Date|string|number} value - The value to parse
 * @returns {Date|null} Parsed Date or null if invalid
 */
function parseToDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Parses a template field reference with optional format hint.
 * E.g., 'effectiveDate|date' -> { field: 'effectiveDate', formatHint: 'date' }
 *
 * @param {string} rawKey - The raw key from template (e.g., 'field|date')
 * @returns {{ field: string, formatHint: string|null }}
 */
function parseTemplateKey(rawKey) {
  const trimmed = String(rawKey || '').trim();
  const pipeIndex = trimmed.indexOf('|');

  if (pipeIndex === -1) {
    return { field: trimmed, formatHint: null };
  }

  const field = trimmed.slice(0, pipeIndex).trim();
  const formatHint = trimmed
    .slice(pipeIndex + 1)
    .trim()
    .toLowerCase();

  const validHint = Object.values(FORMAT_HINTS).includes(formatHint)
    ? formatHint
    : null;

  return { field, formatHint: validHint };
}

/**
 * Formats a date value for display in templates.
 *
 * @param {Date|string|number} value - The date value to format
 * @param {string} formatHint - 'date' for d/M/yy, 'datetime' for d/M/yy HH:mm
 * @param {string} [timezone] - IANA timezone string (defaults to UTC)
 * @returns {string} Formatted date string, or empty string if invalid
 */
function formatDateForDisplay(value, formatHint, timezone) {
  const date = parseToDate(value);
  if (!date) return '';

  try {
    const effectiveTimezone = timezone || 'UTC';

    const dateOptions = {
      day: 'numeric',
      month: 'numeric',
      year: '2-digit',
      timeZone: effectiveTimezone,
    };

    const dateParts = new Intl.DateTimeFormat(
      'en-GB',
      dateOptions
    ).formatToParts(date);
    const day = dateParts.find((p) => p.type === 'day')?.value || '';
    const month = dateParts.find((p) => p.type === 'month')?.value || '';
    const year = dateParts.find((p) => p.type === 'year')?.value || '';
    const dateStr = `${day}/${month}/${year}`;

    if (formatHint === FORMAT_HINTS.DATETIME) {
      const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: effectiveTimezone,
      };
      const timeParts = new Intl.DateTimeFormat(
        'en-GB',
        timeOptions
      ).formatToParts(date);
      const hour = timeParts.find((p) => p.type === 'hour')?.value || '';
      const minute = timeParts.find((p) => p.type === 'minute')?.value || '';
      return `${dateStr} ${hour}:${minute}`;
    }

    return dateStr;
  } catch (err) {
    // Fallback to ISO format if timezone is invalid
    if (formatHint === FORMAT_HINTS.DATETIME) {
      return date.toISOString().slice(0, 16).replace('T', ' ');
    }
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Extracts field references from a template string.
 * Strips any format hints (e.g., |date, |datetime) from field names.
 *
 * @param {string} template - The template string (e.g., '{bankAccount} - {statementDate|date}')
 * @returns {string[]} Array of field names found in the template (without format hints)
 */
function extractTemplateFields(template) {
  if (!template || typeof template !== 'string') return [];
  const matches = template.match(/\{([^}]+)\}/g) || [];
  return matches
    .map((m) => {
      const content = m.slice(1, -1).trim();
      // Strip format hint if present (e.g., 'field|date' -> 'field')
      const pipeIndex = content.indexOf('|');
      return pipeIndex === -1 ? content : content.slice(0, pipeIndex).trim();
    })
    .filter(Boolean);
}

/**
 * Interpolates a template string with values from a record object.
 * Supports format hints for date/datetime fields: {field|date} or {field|datetime}
 *
 * @param {string} template - Template string with {field} or {field|hint} placeholders
 * @param {object} record - Record object containing field values
 * @param {object} [options] - Optional settings
 * @param {string} [options.timezone] - IANA timezone for date formatting (defaults to UTC)
 * @returns {string} Interpolated string
 */
function interpolateTemplate(template, record, options = {}) {
  if (!template || typeof template !== 'string') return '';
  if (!record || typeof record !== 'object') return template;

  const { timezone } = options;

  return template.replace(/\{([^}]+)\}/g, (_, rawKey) => {
    const { field: key, formatHint } = parseTemplateKey(rawKey);
    if (!key) return '';

    // Support simple dot paths in future; for now, shallow lookup
    const parts = key.split('.');
    let value = record;
    for (const p of parts) {
      if (value && Object.prototype.hasOwnProperty.call(value, p)) {
        value = value[p];
      } else {
        value = '';
        break;
      }
    }

    // If we resolved to an object, favor its computed display value
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if (Object.prototype.hasOwnProperty.call(value, DISPLAY_VALUE_PROP)) {
        value = value[DISPLAY_VALUE_PROP];
      }
    }

    // Fallback: if no direct value found for a simple key like "person",
    // try details.<key>Id.__displayValue (e.g., details.personId.__displayValue)
    if (
      (value === '' || value == null) &&
      parts.length === 1 &&
      record?.details &&
      typeof record.details === 'object'
    ) {
      const detailsKey = `${key}Id`;
      const maybe =
        record.details?.[detailsKey] &&
        typeof record.details[detailsKey] === 'object'
          ? record.details[detailsKey][DISPLAY_VALUE_PROP]
          : undefined;
      if (maybe != null && String(maybe).trim()) {
        value = maybe;
      }
    }

    if (value == null) return '';

    // Apply format hint if present (for date/datetime fields)
    if (
      formatHint &&
      (formatHint === FORMAT_HINTS.DATE || formatHint === FORMAT_HINTS.DATETIME)
    ) {
      const formatted = formatDateForDisplay(value, formatHint, timezone);
      if (formatted) return formatted;
    }

    return String(value);
  });
}

function getRandomAlphanumeric(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
}

function getUserNameOrEmail(user) {
  const { firstName, lastName, email } = user ?? {};
  return firstName || lastName
    ? `${firstName ?? ''} ${lastName ?? ''}`.trim()
    : email;
}

/**
 * Converts a string to StartCase and removes all spaces.
 *
 * @param {string} str - The string to be converted.
 * @return {string} The converted string with each word start-cased and no spaces.
 */
function toStartCaseNoSpaces(str) {
  // Normalize acronyms and mixed-case inputs by converting to camelCase and then uppercasing the first letter
  // Examples:
  //   'DISCProfile' -> 'DiscProfile'
  //   'HTTPServer'  -> 'HttpServer'
  //   'crm person'  -> 'CrmPerson'
  const input = str ?? '';
  return _.upperFirst(_.camelCase(input));
}

const toPascalCase = toStartCaseNoSpaces;

function formatAsMultilineComments(paragraph) {
  const maxLineLength = 80;
  const words = paragraph.split(' ');
  let currentLine = '';
  let formattedComment = '';

  words.forEach((word) => {
    // Check if adding the next word exceeds the max line length
    if ((currentLine + word).length > maxLineLength) {
      // Add the current line to the formatted comment
      formattedComment += `// ${currentLine.trim()}\n`;
      // Start a new line with the current word
      currentLine = `${word} `;
    } else {
      // Add the current word to the line
      currentLine += `${word} `;
    }
  });

  // Add the last line to the formatted comment
  formattedComment += `// ${currentLine.trim()}`;

  return formattedComment;
}

function convertToSlug(input) {
  return (input ?? '').toLowerCase().replace(/\s+/g, '-');
}

function toStartCaseUpperUnderscore(text) {
  const input = text ?? '';
  // Split on:
  // - transitions from lowercase/digit to uppercase (camel/Pascal boundaries)
  // - acronym boundaries (e.g., HTTPServer -> HTTP, Server)
  // - uppercase letter(s) followed by digits (e.g., "V2" -> "V2")
  // - groups of digits (standalone)
  // - lowercase words
  // - standalone uppercase sequences (e.g., "PSO" -> "PSO")
  const words = _.words(
    input,
    /[A-Z]+(?=[A-Z][a-z])|[A-Z]+[0-9]+|[A-Z]?[a-z]+|[0-9]+|[A-Z]+/g
  );
  return words.map((w) => _.toUpper(w)).join('_');
}

function toHyphenatedPlural(inputString) {
  const words = _.words(inputString).map((word) => _.toLower(word));

  if (!words?.length) {
    return _.toLower(inputString);
  }

  const lastWord = words.pop();
  const pluralLastWord = pluralize.plural(lastWord);

  return [...words, pluralLastWord].join('-');
}

function toCamelCase(inputString) {
  return _.camelCase(inputString);
}

function toStartCase(inputString) {
  return _.startCase(inputString);
}

function toKebabCase(inputString) {
  return _.kebabCase(inputString);
}

function toSnakeCase(inputString) {
  return _.snakeCase(inputString);
}

function toPlural(word) {
  return pluralize.plural(word ?? '');
}

function toSingular(word) {
  return pluralize.singular(word ?? '');
}

function isSingular(word) {
  if (!word || word.trim() === '') return true;
  return pluralize.isSingular(word);
}

function isPlural(word) {
  if (!word || word.trim() === '') return false;
  return pluralize.isPlural(word);
}

function convertModelNameToSlug(modelName) {
  return toKebabCase(toPlural(modelName ?? ''));
}

function toCapitalize(inputString) {
  let words = _.words(inputString, /[A-Z][a-z]*/g);
  words = words.map(_.capitalize); // Capitalize all words
  return words.join('');
}

function replaceAllOccurrences(content, targetWord, replacementWord) {
  // Create a regular expression with the global flag
  const regex = new RegExp(targetWord, 'g');

  // Replace all occurrences of the word
  return content.replace(regex, replacementWord);
}

function modifyStringWithItems(inputString, items, placeholder, lineGenerator) {
  const newLines = items.map((item) => lineGenerator(item)).join('\n');
  return inputString.replace(placeholder, newLines);
}

module.exports = {
  getRandomAlphanumeric,
  toStartCaseNoSpaces,
  toPascalCase,
  convertToSlug,
  toHyphenatedPlural,
  toCamelCase,
  toCapitalize,
  toSnakeCase,
  replaceAllOccurrences,
  modifyStringWithItems,
  getUserNameOrEmail,
  formatAsMultilineComments,
  toKebabCase,
  toStartCase,
  toStartCaseUpperUnderscore,
  interpolateTemplate,
  extractTemplateFields,
  toPlural,
  toSingular,
  isSingular,
  isPlural,
  convertModelNameToSlug,
  // New exports for date formatting
  FORMAT_HINTS,
  parseTemplateKey,
  formatDateForDisplay,
  parseToDate,
};
