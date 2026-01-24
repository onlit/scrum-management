/**
 * ProspectProduct Filter Extensions
 *
 * Custom filter fields and handlers for the ProspectProduct model.
 * These extensions are merged with the core filter fields at runtime.
 *
 * PROTECTED FILE - This file survives regeneration
 *
 * @see docs/EXTENSION_GUIDE.md for more information on domain extensions
 *
 * @example
 * // Enable custom filters by uncommenting and customizing the exports below
 *
 * module.exports = {
 *   filterFields: ['relatedModelFqn'],
 *   filterHandlers: {
 *     relatedModelFqn: (value) => ({
 *       relatedModel: { fqn: value, deleted: null },
 *     }),
 *   },
 * };
 *
 * @module domain/extensions/prospectProduct.filters
 */

// Uncomment and customize as needed
// module.exports = {
//   /**
//    * Additional filter fields to expose in the API
//    * These are added to the parseFilters middleware and OPTIONS response
//    */
//   filterFields: [],
//
//   /**
//    * Custom filter handlers for relation-based or computed filters
//    * Each handler receives the filter value and returns a Prisma where clause
//    */
//   filterHandlers: {},
// };

module.exports = {};
