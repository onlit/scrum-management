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
