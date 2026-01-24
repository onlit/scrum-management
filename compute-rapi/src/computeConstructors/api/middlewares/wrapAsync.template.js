/**
 * CREATED BY: {{CREATOR_NAME}}
 * CREATOR EMAIL: {{CREATOR_EMAIL}}
 * CREATION DATE: {{NOW}}
 *
 *
 * DESCRIPTION:
 * ------------------
 * DEPRECATED: This file is deprecated in favor of wrapExpressAsync from errorHandlingUtils.js
 *
 * The wrapAsync function has been replaced by wrapExpressAsync which provides:
 * - Standardized error handling and logging
 * - Better error context and tracking
 * - Consistent error structure across the application
 *
 * Use: const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');
 *
 *
 */
const { wrapExpressAsync } = require('#utils/errorHandlingUtils.js');

// Keep the same interface for backward compatibility, but use standardized error handling
let hasWarned = false;
function wrapAsync(handler, context) {
  if (!hasWarned) {
    hasWarned = true;
    console.warn(
      '[DEPRECATED] wrapAsync is deprecated. Use wrapExpressAsync from errorHandlingUtils.js instead.'
    );
  }

  return wrapExpressAsync(handler, context || 'legacy_wrapAsync');
}

module.exports = wrapAsync;
