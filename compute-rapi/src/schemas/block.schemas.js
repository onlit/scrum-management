/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 19/02/2024
 *
 *
 * DESCRIPTION:
 * ------------------
 * This module defines Joi schemas for validating data related to blocks.
 * It imports Joi for schema validation and the visibilityCreate schema from 'visibility.schemas.js'.
 *
 * It exports the following schemas:
 * - blockCreate.
 * - blockUpdate.
 *
 *
 * REVISION 1:
 * REVISED BY: Umer Lachi
 * REVISION DATE: 20/02/2024
 * REVISION REASON: Add Standard File Header Comments
 */

const Joi = require('joi');

const { visibilityCreate } = require('#schemas/visibility.schemas.js');

const blockBase = visibilityCreate.keys({
  order: Joi.number(),
  id: Joi.string().uuid().allow(''),
  description: Joi.string().allow(null, ''),
  tags: Joi.string().allow(null, ''),
});

const blockCreate = blockBase.keys({
  name: Joi.string().max(200).required(),
  groupId: Joi.string().uuid().required(),
});

const blockUpdate = blockBase.keys({
  name: Joi.string().max(200).optional(),
  groupId: Joi.string().uuid().optional(),
  code: Joi.string()
    .regex(/^[A-Z0-9]{1,4}-[A-Z0-9]{1,3}$/i)
    .max(8),
});

module.exports = { blockCreate, blockUpdate };
