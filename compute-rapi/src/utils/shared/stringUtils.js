const _ = require('lodash');
const pluralize = require('pluralize');
const { isCodeUnique } = require('#utils/shared/databaseUtils.js');

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
  const text =
    typeof paragraph === 'string' ? paragraph : String(paragraph ?? '');
  if (!text) return '';
  const words = text.split(' ');
  let currentLine = '';
  let formattedComment = '';

  words.forEach((word) => {
    // Check if adding the next word exceeds the max line length
    if ((currentLine + word).length > maxLineLength) {
      // Add the current line to the formatted comment
      formattedComment += `/// ${currentLine.trim()}\n`;
      // Start a new line with the current word
      currentLine = `${word} `;
    } else {
      // Add the current word to the line
      currentLine += `${word} `;
    }
  });

  // Add the last line to the formatted comment
  formattedComment += `/// ${currentLine.trim()}`;

  return formattedComment;
}

async function generateUniqueCode(prisma, clientId) {
  let isUnique = false;
  let code;

  while (!isUnique) {
    const prefix = getRandomAlphanumeric(4);
    const number = getRandomAlphanumeric(3);
    code = `${prefix}-${number}`;
    isUnique = await isCodeUnique(prisma, code, clientId);
  }

  return code;
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

function toSnakeCase(inputString) {
  return _.snakeCase(inputString);
}

function toStartCase(inputString) {
  return _.startCase(inputString);
}

function toKebabCase(inputString) {
  return _.kebabCase(inputString);
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

/**
 * Resolves the URL slug for a model.
 * Uses custom slug if set, otherwise computes from model name.
 *
 * @param {Object} model - Model object with optional slug and name
 * @returns {string} The resolved slug
 */
function resolveModelSlug(model) {
  if (model?.slug && typeof model.slug === 'string' && model.slug.trim()) {
    return model.slug.trim();
  }
  return convertModelNameToSlug(model?.name);
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

function modifyStringWithItems(inputString, items, placeholder, lineGenerator) {
  const newLines = items.map((item) => lineGenerator(item)).join('\n');
  return inputString.replace(placeholder, newLines);
}

module.exports = {
  getRandomAlphanumeric,
  toStartCaseNoSpaces,
  toPascalCase,
  generateUniqueCode,
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
  extractTemplateFields,
  toPlural,
  toSingular,
  isSingular,
  isPlural,
  convertModelNameToSlug,
  resolveModelSlug,
};
