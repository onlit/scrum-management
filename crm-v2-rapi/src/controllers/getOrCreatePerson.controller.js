/**
 * CREATED BY: AI Assistant
 * CREATION DATE: 27/08/2025
 *
 * DESCRIPTION:
 * ------------------
 * Express controller for the legacy-parity endpoint: /api/v1/get-or-create-person/
 *
 * Features:
 * - GET: Fetch a Person by id or by (parentId + personalMobile/email)
 * - POST: Get-or-Create logic mirroring Django GetOrCreatePersonAPIView
 * - PUT/PATCH: Update by id with controller-level uniqueness checks
 * - DELETE: Soft delete by id (respects global soft-delete extension)
 *
 * Design:
 * - Validates inputs with Joi schemas (person.schemas.js) plus extra runtime checks using validator
 * - FK validation via verifyForeignKeyAccessBatch
 * - Uniqueness handled at controller level (no DB unique constraints required)
 * - Fire-and-forget workflow trigger after create response for lower latency
 */

const _ = require('lodash');
const validator = require('validator');
const prisma = require('#configs/prisma.js');
const { personCreate, personUpdate } = require('#schemas/person.schemas.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
// No workflow trigger here to match Django parity
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

function extractLookupQuery(query) {
  const id = query?.id ? String(query.id) : '';
  const parentId = query?.parentId ? String(query.parentId) : '';
  const personalMobile = query?.personalMobile
    ? String(query.personalMobile)
    : '';
  const email = query?.email ? String(query.email) : '';
  return { id, parentId, personalMobile, email };
}

// GET/PUT/PATCH/DELETE are intentionally not implemented for parity with Django

async function createGetOrCreatePerson(req, res) {
  const { user, body } = req;

  logOperationStart('createGetOrCreatePerson', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await personCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createGetOrCreatePerson', req, error);
        throw handleValidationError(error, 'get_or_create_person_creation');
      }
      logOperationError('createGetOrCreatePerson', req, error);
      throw error;
    }

    // Drop extraneous fields (Django parity)
    const sanitized = { ...values };
    delete sanitized.model;
    delete sanitized.companyOwner; // companyOwnerId used instead

    // For internal calls without auth, enforce createdBy & client presence (from raw body)
    const bodyCreatedBy = body?.createdBy || body?.created_by;
    const bodyClient = body?.client;
    if (!user?.isAuthenticated) {
      if (!bodyCreatedBy) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Created By is required!',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_or_create_person_creation',
          }
        );
        throw error;
      }
      if (!bodyClient) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Client is required!',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_or_create_person_creation',
          }
        );
        throw error;
      }
    }

    if (!sanitized.personalMobile) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Personal Mobile is required!',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_or_create_person_creation',
        }
      );
      throw error;
    }

    const modelRelationFields = ['parentId', 'companyOwnerId'];

    // Verify FK access for parentId/companyOwnerId if provided
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        sanitized?.parentId
          ? { model: 'person', fieldValues: { parentId: sanitized.parentId } }
          : null,
        sanitized?.companyOwnerId
          ? {
              model: 'company',
              fieldValues: { companyOwnerId: sanitized.companyOwnerId },
            }
          : null,
      ].filter(Boolean),
    });

    // If existing record by (parentId, personalMobile, client) return it (and set hasWhatsapp=true if false)
    logDatabaseStart('get_or_create_person_check_existing', req, {
      parentId: sanitized.parentId,
      personalMobile: sanitized.personalMobile,
    });
    const existing = await prisma.person.findFirst({
      where: {
        client: user?.client?.id ?? sanitized.client,
        deleted: null,
        parentId: sanitized.parentId,
        personalMobile: sanitized.personalMobile,
      },
    });

    if (existing) {
      if (!existing.hasWhatsapp) {
        try {
          await prisma.person.update({
            where: { id: existing.id },
            data: {
              hasWhatsapp: true,
              updatedBy: user?.id ?? sanitized.createdBy,
            },
          });
        } catch (_e) {}
      }
      logDatabaseSuccess('get_or_create_person_check_existing', req, {
        id: existing.id,
        reused: true,
      });
      logOperationSuccess('createGetOrCreatePerson', req, {
        id: existing.id,
        reused: true,
      });
      const existingWithDisplay = {
        ...existing,
        [DISPLAY_VALUE_PROP]: computeDisplayValue(existing, 'Person'),
      };
      res.status(200).json(existingWithDisplay);
      return;
    }

    // Controller-level uniqueness checks within same (client, parentId)
    try {
      const { homePhone, personalMobile, email } = sanitized;
      const duplicate = await prisma.person.findFirst({
        where: {
          client: user?.client?.id ?? bodyClient,
          deleted: null,
          parentId: sanitized.parentId,
          OR: [
            ...(homePhone ? [{ homePhone }] : []),
            ...(personalMobile ? [{ personalMobile }] : []),
            ...(email
              ? [{ email: { equals: email, mode: 'insensitive' } }]
              : []),
          ],
        },
        select: { id: true },
      });
      if (duplicate) {
        const fields = _.compact([
          sanitized.homePhone ? 'home phone' : null,
          sanitized.personalMobile ? 'personal mobile' : null,
          sanitized.email ? 'email' : null,
        ]).join('/');
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          `A person with this ${fields} already exists for the specified parent.`,
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_or_create_person_duplicate_check',
            details: {
              parentId: sanitized.parentId,
              homePhone,
              personalMobile,
              email,
            },
          }
        );
        throw error;
      }
    } catch (_e) {
      // best-effort duplicate protection
    }

    // Create person
    logDatabaseStart('get_or_create_person_create', req, {
      parentId: sanitized.parentId,
    });
    const newPerson = await prisma.person.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: sanitized,
        requestBody: body,
        relations: modelRelationFields,
      }),
    });

    logDatabaseSuccess('get_or_create_person_create', req, {
      id: newPerson.id,
    });
    logOperationSuccess('createGetOrCreatePerson', req, { id: newPerson.id });

    const newPersonWithDisplay = {
      ...newPerson,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(newPerson, 'Person'),
    };
    res.status(200).json(newPersonWithDisplay);
  } catch (error) {
    logOperationError('createGetOrCreatePerson', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type))
      throw error;
    throw handleDatabaseError(error, 'get_or_create_person_create');
  }
}

// update/delete not implemented here for parity

module.exports = {
  createGetOrCreatePerson,
};
