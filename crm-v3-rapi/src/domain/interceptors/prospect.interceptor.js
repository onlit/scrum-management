/**
 * Prospect Interceptor
 *
 * Lifecycle hooks for Prospect model.
 * Add custom business logic here - this file is NEVER overwritten by the generator.
 *
 * Available hooks:
 * - beforeValidate(data, context) - Transform input before validation
 * - extendSchema(schema, context) - Add custom Joi rules
 * - afterValidate(data, context) - Cross-field validation
 * - beforeCreate/Update/Delete(data, context) - Pre-operation logic
 * - afterCreate/Update/Delete(data, context) - Post-operation logic
 * - beforeList/Read(data, context) - Query modification
 * - afterList/Read(data, context) - Response transformation
 * - beforeVectorSearch(params, context) - Modify search params, add permission filters
 * - afterVectorSearch(results, context) - Transform results, redact fields
 * - onError(error, context) - Error handling
 *
 * Each hook should return: { data, halt?, response? }
 * Set halt: true to stop processing and return response immediately.
 *
 * @module domain/interceptors/prospect.interceptor
 */

// const Joi = require('joi');
// const { createDomainError, ERROR_TYPES } = require('#core/exceptions/domain.exception.js');

module.exports = {
  // Uncomment and implement hooks as needed:

  // async beforeValidate(data, context) {
  //   // Transform/normalize input before Joi validation
  //   return { data };
  // },

  // extendSchema(schema, context) {
  //   // Add custom Joi rules to the base schema
  //   // Example: return schema.append({ customField: Joi.string().required() });
  //   return schema;
  // },

  // async afterValidate(data, context) {
  //   // Cross-field validation after Joi passes
  //   // Example: if (data.endDate < data.startDate) { return { halt: true, response: {...} }; }
  //   return { data };
  // },

  // async beforeCreate(data, context) {
  //   // Pre-database logic: compute fields, external API calls
  //   return { data };
  // },

  // async afterCreate(record, context) {
  //   // Post-database logic: notifications, audit logging
  //   return { data: record };
  // },

  // async beforeUpdate(data, context) {
  //   // Protect immutable fields, validate transitions
  //   return { data };
  // },

  // async afterUpdate(record, context) {
  //   // Change notifications, cache invalidation
  //   return { data: record };
  // },

  // async beforeDelete(record, context) {
  //   // Referential integrity checks, soft-delete alternatives
  //   return { data: record };
  // },

  // async afterDelete(record, context) {
  //   // Cleanup related data, send notifications
  //   return { data: record };
  // },

  // async beforeList(query, context) {
  //   // Add custom filters, modify pagination
  //   return { data: query };
  // },

  // async afterList(response, context) {
  //   // Transform results, add computed fields
  //   return { data: response };
  // },

  // async beforeRead(id, context) {
  //   // Access control, audit read operations
  //   return { data: id };
  // },

  // async afterRead(record, context) {
  //   // Redact sensitive fields, add computed data
  //   return { data: record };
  // },

  // async onError(error, context) {
  //   // Custom error handling/transformation
  //   // Return { data: { handled: true, response: {...} } } to handle error
  //   // Return { data: { handled: false } } to let default handler run
  //   return { data: { handled: false } };
  // },

  // ============================================
  // Vector Search Hooks (for models with vector fields)
  // ============================================

  // async beforeVectorSearch(params, context) {
  //   // Modify search parameters before execution
  //   // - Add additional permission-based filters
  //   // - Adjust threshold based on user preferences
  //   // - Restrict searchable fields by role
  //   //
  //   // params contains: { vector, field, embedding, pagination, threshold, filter, includeScore, select }
  //   // context contains: { req, user, requestId }
  //   //
  //   // Example: Add department filter for non-admin users
  //   // if (!context.user.isAdmin) {
  //   //   params.filter = { ...params.filter, departmentId: context.user.departmentId };
  //   // }
  //   return { data: params };
  // },

  // async afterVectorSearch(results, context) {
  //   // Transform search results after execution
  //   // - Redact sensitive fields from results
  //   // - Add computed properties (e.g., highlight snippets)
  //   // - Filter out results based on additional criteria
  //   //
  //   // results contains: { data: [...], pagination: {...}, meta: {...} }
  //   // context contains: { req, user, requestId, params }
  //   //
  //   // Example: Remove internal fields from results
  //   // results.data = results.data.map(item => {
  //   //   const { internalNotes, ...publicData } = item;
  //   //   return publicData;
  //   // });
  //   return { data: results };
  // },
};
