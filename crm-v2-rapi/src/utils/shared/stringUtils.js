/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file focuses on string manipulation and processing. It can contain functions for common string operations such as formatting, sanitizing, and other manipulations needed across the application to handle text data effectively.
 *
 *
 */
const _ = require('lodash');
const { DISPLAY_VALUE_PROP } = require('#configs/constants.js');

function interpolateTemplate(template, record) {
  if (!template || typeof template !== 'string') return '';
  if (!record || typeof record !== 'object') return template;

  // Replace placeholders, then trim to handle null/empty fields causing trailing spaces
  // e.g., '{firstName} {lastName}' with lastName=null → 'Umer ' → 'Umer'
  return template.replace(/\{([^}]+)\}/g, (_, rawKey) => {
    const key = String(rawKey || '').trim();
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
    if (value && typeof value === 'object') {
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

    return String(value);
  }).trim();
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
  // Convert to start case
  const startCaseText = _.startCase(_.toLower(text)); // Ensures that text is in lowercase before applying start case
  // Convert to uppercase and replace spaces with underscores
  return _.toUpper(startCaseText.replace(/ /g, '_'));
}

function toHyphenatedPlural(inputString) {
  const words = _.words(inputString).map((word) => _.toLower(word));

  if (!words?.length) {
    return _.toLower(inputString);
  }

  const lastWord = words.pop(); // Remove and capture the last word for processing

  // Determine plural form of the last word
  const pluralLastWord = /s|sh|ch|x|z$/.test(lastWord)
    ? `${lastWord}es`
    : `${lastWord}s`;

  // Concatenate the modified list of words, now including the pluralized last word
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
  interpolateTemplate,
  getRandomAlphanumeric,
  toStartCaseNoSpaces,
  convertToSlug,
  toHyphenatedPlural,
  toCamelCase,
  toCapitalize,
  replaceAllOccurrences,
  modifyStringWithItems,
  getUserNameOrEmail,
  formatAsMultilineComments,
  toKebabCase,
  toStartCase,
  toStartCaseUpperUnderscore,
};
