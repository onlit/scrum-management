/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 28/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains functions related to handling, manipulation, and formatting of dates and times using moment.js and Javascript Date object.
 *
 *
 */

const moment = require('moment');

function getCurrentUtcDateInDDMMYYYY() {
  return moment.utc().format('DD/MM/YYYY');
}

module.exports = { getCurrentUtcDateInDDMMYYYY };
