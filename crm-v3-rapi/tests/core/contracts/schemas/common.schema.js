/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 * DESCRIPTION:
 * ------------------
 * Common Joi schemas for API response validation.
 * Used by contract tests to verify API responses match expected structure.
 */

const Joi = require('joi');

/**
 * Pagination response schema
 */
const PaginationSchema = Joi.object({
  totalCount: Joi.number().integer().min(0).required(),
  pageCount: Joi.number().integer().min(0).required(),
  currentPage: Joi.number().integer().min(1).required(),
  perPage: Joi.number().integer().min(1).required(),
  hasNextPage: Joi.boolean().optional(),
  hasPreviousPage: Joi.boolean().optional(),
  isTotalUnknown: Joi.boolean().optional(),
}).unknown(false);

/**
 * Paginated list response schema factory
 * @param {Joi.Schema} itemSchema - Schema for individual items
 * @returns {Joi.Schema} Complete list response schema
 */
const createListResponseSchema = (itemSchema) =>
  Joi.object({
    totalCount: Joi.number().integer().min(0).required(),
    pageCount: Joi.number().integer().min(0).required(),
    currentPage: Joi.number().integer().min(1).required(),
    perPage: Joi.number().integer().min(1).required(),
    hasNextPage: Joi.boolean().optional(),
    hasPreviousPage: Joi.boolean().optional(),
    isTotalUnknown: Joi.boolean().optional(),
    results: Joi.array().items(itemSchema).required(),
  }).unknown(false);

/**
 * Error response schema
 */
const ErrorResponseSchema = Joi.object({
  error: Joi.string().required(),
  message: Joi.string().required(),
  statusCode: Joi.number().integer().optional(),
  details: Joi.object().optional(),
  stack: Joi.string().optional(), // Only in development
}).unknown(true);

/**
 * Validation error response schema (422)
 */
const ValidationErrorSchema = Joi.object({
  error: Joi.string().required(),
  message: Joi.string().required(),
  statusCode: Joi.number().valid(400, 422).optional(),
  details: Joi.array()
    .items(
      Joi.object({
        field: Joi.string().required(),
        message: Joi.string().required(),
      })
    )
    .optional(),
}).unknown(true);

/**
 * Not found error response schema (404)
 */
const NotFoundErrorSchema = Joi.object({
  error: Joi.string().required(),
  message: Joi.string().required(),
  statusCode: Joi.number().valid(404).optional(),
}).unknown(true);

/**
 * Delete response schema
 */
const DeleteResponseSchema = Joi.object({
  deleted: Joi.string().uuid().required(),
}).unknown(false);

/**
 * Common field schemas
 */
const CommonFields = {
  uuid: Joi.string().uuid(),
  email: Joi.string().email(),
  isoDate: Joi.string().isoDate(),
  isoDateTime: Joi.string().isoDate(),
  boolean: Joi.boolean(),
  positiveInteger: Joi.number().integer().min(0),
};

/**
 * Base entity schema with common audit fields
 */
const BaseEntitySchema = Joi.object({
  id: Joi.string().uuid().required(),
  createdAt: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .required(),
  updatedAt: Joi.alternatives()
    .try(Joi.string().isoDate(), Joi.date())
    .required(),
  createdBy: Joi.string().uuid().allow(null).optional(),
  updatedBy: Joi.string().uuid().allow(null).optional(),
});

module.exports = {
  PaginationSchema,
  createListResponseSchema,
  ErrorResponseSchema,
  ValidationErrorSchema,
  NotFoundErrorSchema,
  DeleteResponseSchema,
  CommonFields,
  BaseEntitySchema,
};
