/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
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
 * REVISED BY: AI Assistant
 * REVISION DATE: 2025-01-27
 * REVISION REASON: Implement standardized error handling and trace ID conventions
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
