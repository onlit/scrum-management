/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file provides utilities for date manipulation and formatting.
 * It includes functions for converting dates to various formats, calculating
 * date differences, and handling common date operations across the application.
 *
 *
 */
const moment = require('moment');

/**
 * Returns current UTC date in DD/MM/YYYY format.
 */
function getCurrentUtcDateInDDMMYYYY() {
  return moment.utc().format('DD/MM/YYYY');
}

/**
 * Determines if a value is an ISO-8601 date string we can safely parse.
 * Accepts forms like 2025-11-08T20:51:17.000Z or 2025-11-08.
 */
function isIsoDateString(value) {
  if (typeof value !== 'string') return false;
  // Quick sanity check: must start with YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  // Date.parse handles ISO 8601; ensure it yields a valid timestamp
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

/**
 * Formats a date-like value as UTC with pattern D/M/YY.
 * Accepts Date or ISO-8601 string.
 */
function formatDateUTC(value) {
  const m = moment.utc(value);
  return m.isValid() ? m.format('D/M/YY') : String(value ?? '');
}

/**
 * Formats a date-like value as UTC with pattern D/M/YY h:mm AM/PM.
 * Accepts Date or ISO-8601 string.
 */
function formatDateTimeUTC(value) {
  const m = moment.utc(value);
  return m.isValid() ? m.format('D/M/YY h:mm A') : String(value ?? '');
}

/**
 * Formats a date-like value based on kind.
 * kind: 'date' | 'datetime' | null
 */
function formatByKind(kind, value) {
  if (value == null) return '';
  // Only format Date or ISO strings; otherwise return as-is
  if (!(value instanceof Date) && !isIsoDateString(value)) {
    return value;
  }
  if (kind === 'date') return formatDateUTC(value);
  // default to datetime
  return formatDateTimeUTC(value);
}

module.exports = {
  getCurrentUtcDateInDDMMYYYY,
  isIsoDateString,
  formatDateUTC,
  formatDateTimeUTC,
  formatByKind,
};
