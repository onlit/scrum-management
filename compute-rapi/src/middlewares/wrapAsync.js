/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
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
 * Use: const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 *
 *
 * REVISION 2:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 21/02/2024
 * REVISION REASON: Convert ESM to CJS
 *
 *
 * REVISION 3:
 * REVISED BY: Claude
 * REVISION DATE: 25/07/2025
 * REVISION REASON: Deprecated in favor of standardized error handling
 */

// Import the new standardized wrapper
const { wrapExpressAsync } = require('#utils/shared/errorHandlingUtils.js');

// Keep the same interface for backward compatibility, but use standardized error handling
function wrapAsync(handler, context) {
  // Log deprecation warning
  console.warn(
    '[DEPRECATED] wrapAsync is deprecated. Use wrapExpressAsync from errorHandlingUtils.js instead.'
  );

  // Use the new standardized wrapper
  return wrapExpressAsync(handler, context || 'legacy_wrapAsync');
}

module.exports = wrapAsync;
