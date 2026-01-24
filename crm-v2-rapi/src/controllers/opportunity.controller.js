/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file contains controller functions for managing opportunity using Prisma.
 * It includes functions for retrieving all opportunity, creating a new opportunity, retrieving a single opportunity,
 * updating an existing opportunity, and deleting a opportunity.
 *
 * The `getAllOpportunity` function retrieves a paginated list of opportunity based on query parameters such as
 * search fields and filter fields, with support for user-specific visibility filters.
 *
 * The `createOpportunity` function validates the request body using a Joi schema, generates a unique code
 * for the opportunity, and creates a new opportunity in the database with additional metadata.
 *
 * The `getOpportunity` function retrieves a single opportunity based on the provided opportunity ID, with visibility
 * filters applied to ensure the opportunity is accessible to the requesting user.
 *
 * The `updateOpportunity` function updates an existing opportunity in the database based on the provided opportunity ID
 * and request body, with validation performed using a Joi schema.
 *
 * The `deleteOpportunity` function deletes a opportunity from the database based on the provided opportunity ID, with
 * visibility filters applied to ensure the opportunity is deletable by the requesting user.
 *
 *
 */

// const _ = require('lodash');
const validator = require('validator');
const prisma = require('#configs/prisma.js');
const {
  opportunityCreate,
  opportunityUpdate,
  opportunityBulkVisibilityUpdate,
} = require('#schemas/opportunity.schemas.js');
const { objectKeysToCamelCase } = require('#utils/shared/generalUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  buildCreateRecordPayload,
  getVisibilityFilters,
} = require('#utils/shared/visibilityUtils.js');
const {
  getPaginatedList,
  verifyForeignKeyAccessBatch,
} = require('#utils/shared/databaseUtils.js');
const { getDetailsFromAPI, getInaCount } = require('#utils/shared/apiUtils.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  logWithTrace,
} = require('#utils/shared/traceUtils.js');
const {
  handleDatabaseError,
  handleValidationError,
} = require('#utils/shared/errorHandlingUtils.js');
const {
  findWorkflowAndTrigger,
  triggerAutomata,
} = require('#utils/shared/automataUtils.js');
const {
  attachNestedDisplayValues,
  enrichRecordDisplayValues,
} = require('#utils/shared/displayValueUtils.js');

async function bulkUpdateOpportunityVisibility(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('bulkUpdateOpportunityVisibility', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validate payload
    let values;
    try {
      values = await opportunityBulkVisibilityUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('bulkUpdateOpportunityVisibility', req, error);
        throw handleValidationError(
          error,
          'opportunity_bulk_visibility_update'
        );
      }
      logOperationError('bulkUpdateOpportunityVisibility', req, error);
      throw error;
    }

    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'bulk_update_opportunity_visibility_client_guard',
        }
      );
      throw error;
    }

    // Guard: only system administrators can perform this action
    if (
      !Array.isArray(user?.roleNames) ||
      !user.roleNames.includes('System Administrator')
    ) {
      const error = createErrorWithTrace(
        ERROR_TYPES.AUTHORIZATION,
        'Sorry, you do not have permissions to update opportunity visibility.',
        req,
        {
          severity: ERROR_SEVERITY.MEDIUM,
          context: 'bulk_update_opportunity_visibility_permission_check',
        }
      );
      throw error;
    }

    const { ids, ...visibilityValuesSnake } = values || {};
    const visibilityValues = objectKeysToCamelCase(visibilityValuesSnake);

    // Log database operation start
    logDatabaseStart('bulk_update_opportunity_visibility', req, {
      idsCount: Array.isArray(ids) ? ids.length : 0,
      updateFields: Object.keys(visibilityValues || {}),
    });

    const result = await prisma.opportunity.updateMany({
      where: {
        id: { in: ids },
        deleted: null,
        ...getVisibilityFilters(user),
      },
      data: {
        ...visibilityValues,
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('bulk_update_opportunity_visibility', req, {
      updatedCount: result.count,
    });

    // Log operation success
    logOperationSuccess('bulkUpdateOpportunityVisibility', req, {
      updatedCount: result.count,
    });

    res.status(200).json({
      updatedCount: result.count,
    });
  } catch (error) {
    logOperationError('bulkUpdateOpportunityVisibility', req, error);
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'bulk_update_opportunity_visibility');
  }
}

async function getOpportunityStages(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getOpportunityStages', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const {
      pipeline: pipelineId,
      owner: ownerId,
      start_date: startDateStr,
      end_date: endDateStr,
    } = query || {};

    // Basic validation
    if (!pipelineId || typeof pipelineId !== 'string') {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Invalid or missing pipeline id',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_stages_validation',
          details: { pipelineId },
        }
      );
      logOperationError('getOpportunityStages', req, error);
      throw error;
    }

    let startDate;
    let endDate;
    if (startDateStr) {
      const d = new Date(startDateStr);
      if (Number.isNaN(d.getTime())) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Invalid start_date',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_opportunity_stages_validation',
            details: { startDateStr },
          }
        );
        logOperationError('getOpportunityStages', req, error);
        throw error;
      }
      startDate = d;
    }
    if (endDateStr) {
      const d = new Date(endDateStr);
      if (Number.isNaN(d.getTime())) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Invalid end_date',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_opportunity_stages_validation',
            details: { endDateStr },
          }
        );
        logOperationError('getOpportunityStages', req, error);
        throw error;
      }
      endDate = d;
    }

    // Ensure pipeline exists and is visible
    logDatabaseStart('get_pipeline_for_stages', req, { pipelineId });
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: pipelineId, deleted: null, ...getVisibilityFilters(user) },
      select: { id: true },
    });
    logDatabaseSuccess('get_pipeline_for_stages', req, { found: !!pipeline });

    if (!pipeline) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Pipeline not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity_stages',
          details: { pipelineId },
        }
      );
      logOperationError('getOpportunityStages', req, error);
      throw error;
    }

    // Fetch stages
    logDatabaseStart('get_pipeline_stages_for_stages', req, { pipelineId });
    const stages = await prisma.pipelineStage.findMany({
      where: { pipelineId, deleted: null, ...getVisibilityFilters(user) },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        stage: true,
        description: true,
        order: true,
        parentPipelineStageId: true,
        conversion: true,
        confidence: true,
        rottingDays: true,
        immediateNextAction: true,
      },
    });
    logDatabaseSuccess('get_pipeline_stages_for_stages', req, {
      count: stages.length,
    });

    // Sub-pipeline stages are not supported; remove full-order chain logic

    // Initialize inaCountMap to avoid temporal dead zone error
    let inaCountMap = {};

    const responseMap = {};
    stages.forEach((s) => {
      responseMap[s.id] = {
        id: s.id,
        stage: s.stage,
        name: s.stage,
        description: s.description,
        order: s.order,
        conversion: s.conversion,
        confidence: s.confidence,
        rottingDays: s.rottingDays,
        immediateNextAction: s.immediateNextAction,
        totalEstimatedValue: 0,
        items: [],
      };
    });

    // Build opportunity filters
    const opportunityWhere = {
      pipelineId,
      deleted: null,
      ...getVisibilityFilters(user),
    };

    // Apply owner filter
    if (ownerId) {
      opportunityWhere.ownerId = ownerId;
    }

    // Apply date filters
    if (startDate || endDate) {
      opportunityWhere.createdAt = {};
      if (startDate) opportunityWhere.createdAt.gte = startDate;
      if (endDate) opportunityWhere.createdAt.lte = endDate;
    }

    // Apply search filters (supports search + search_fields)
    const rawSearch = (query?.search || '').trim();
    const rawSearchFields = (query?.search_fields || '').trim();
    const allowedFieldMap = {
      name: (term) => ({ name: { contains: term, mode: 'insensitive' } }),
      description: (term) => ({
        description: { contains: term, mode: 'insensitive' },
      }),
      company: (term) => ({
        company: { name: { contains: term, mode: 'insensitive' } },
      }),
      companyname: (term) => ({
        company: { name: { contains: term, mode: 'insensitive' } },
      }),
      personemail: (term) => ({
        person: { email: { contains: term, mode: 'insensitive' } },
      }),
      contactemail: (term) => ({
        companyContact: {
          person: { email: { contains: term, mode: 'insensitive' } },
        },
      }),
    };
    if (rawSearch) {
      // If no fields provided, default to a sensible set
      const fields = rawSearchFields
        ? rawSearchFields
            .split(',')
            .map((f) => f.trim().toLowerCase())
            .filter(Boolean)
        : ['name', 'description', 'company'];
      const orConditions = [];
      fields.forEach((f) => {
        const builder = allowedFieldMap[f];
        if (typeof builder === 'function') {
          orConditions.push(builder(rawSearch));
        }
      });
      if (orConditions.length > 0) {
        opportunityWhere.OR = orConditions;
      }
    }

    // Fetch opportunities in this pipeline
    logDatabaseStart('get_opportunities_for_stages', req, {
      pipelineId,
      hasOwnerFilter: !!ownerId,
      hasDateFilters: !!(startDate || endDate),
      hasSearchFilters: !!rawSearch,
    });
    const opportunities = await prisma.opportunity.findMany({
      where: opportunityWhere,
      select: {
        id: true,
        name: true,
        description: true,
        companyId: true,
        company: { select: { id: true, name: true } },
        companyContactId: true,
        pipelineId: true,
        statusId: true,
        estimatedCloseDate: true,
        estimatedValue: true,
        probability: true,
        statusAssignedDate: true,
      },
    });
    logDatabaseSuccess('get_opportunities_for_stages', req, {
      count: opportunities.length,
    });

    opportunities.forEach((o) => {
      const stage = o.statusId && responseMap[o.statusId];
      if (!stage) return;

      let rotting = false;
      if (o.statusAssignedDate && Number.isFinite(stage.rottingDays)) {
        const diffDays = Math.floor(
          (Date.now() - new Date(o.statusAssignedDate).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (diffDays >= stage.rottingDays) {
          rotting = true;
        }
      }

      stage.totalEstimatedValue += o.estimatedValue || 0;
      stage.items.push({
        id: o.id,
        name: o.name,
        description: o.description,
        companyId: o.companyId,
        companyContactId: o.companyContactId,
        pipelineId: o.pipelineId,
        statusId: o.statusId,
        estimatedCloseDate: o.estimatedCloseDate,
        estimatedValue: o.estimatedValue,
        probability: o.probability,
        statusAssignedDate: o.statusAssignedDate,
        rotting,
        inaCount: inaCountMap[o.id] || 0,
        details: {
          company: o.company
            ? { id: o.company.id, name: o.company.name }
            : undefined,
        },
      });
    });

    // Get all opportunity IDs for INA count
    const allOpportunityIds = opportunities.map((o) => o.id);

    // Fetch INA counts from calendar service
    logDatabaseStart('get_ina_counts', req, {
      opportunityCount: allOpportunityIds.length,
    });
    inaCountMap = await getInaCount(
      'CRM V2',
      'opportunity',
      allOpportunityIds,
      req.user?.accessToken || req.headers.authorization
    );
    logDatabaseSuccess('get_ina_counts', req, {
      fetchedCount: Object.keys(inaCountMap).length,
    });

    // Update INA counts on already-built stage items
    Object.values(responseMap).forEach((stage) => {
      stage.items = stage.items.map((item) => ({
        ...item,
        inaCount: inaCountMap[item.id] || 0,
      }));
    });

    const stagesArray = Object.values(responseMap).map((s) => ({
      ...s,
      discountedValue:
        (s.confidence ? s.confidence / 100 : 0) * (s.totalEstimatedValue || 0),
    }));

    // Log operation success
    logOperationSuccess('getOpportunityStages', req, {
      stageCount: stagesArray.length,
      itemCount: stagesArray.reduce((n, s) => n + (s.items?.length || 0), 0),
    });

    res.status(200).json(stagesArray);
  } catch (error) {
    logOperationError('getOpportunityStages', req, error);
    // Re-throw standardized errors as-is
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }
    throw handleDatabaseError(error, 'get_opportunity_stages');
  }
}

async function getAllOpportunity(req, res) {
  const { user, query } = req;

  // Log operation start
  logOperationStart('getAllOpportunity', req, {
    user: user?.id,
    queryKeys: Object.keys(query || {}),
  });

  try {
    const searchFields = [
      'sentiment',
      'dataSource',
      'color',
      'notes',
      'name',
      'description',
      'customerPriority',
    ];
    const filterFields = [
      ...searchFields,
      'companyId',
      'personId',
      'statusId',
      'actualValue',
      'probability',
      'economicBuyerInfluenceId',
      'salesPersonId',
      'ownerId',
      'companyContactId',
      'technicalBuyerInfluenceId',
      'statusAssignedDate',
      'pipelineId',
      'estimatedValue',
      'estimatedCloseDate',
      'userBuyerInfluenceId',
      'channelId',
    ];

    const include = {
      company: true,
      person: true,
      status: true,
      economicBuyerInfluence: true,
      companyContact: { include: { person: true } },
      technicalBuyerInfluence: true,
      pipeline: true,
      userBuyerInfluence: true,
      channel: true,
      category: true,
    };

    // Log database operation start
    logDatabaseStart('get_all_opportunity', req, {
      userId: user?.id,
      searchFields,
      filterFields,
    });

    // Build customWhere for relational search and filters
    const customWhere = {};
    const andConditions = [];
    const rawSearch = (query?.search || '').trim();
    if (rawSearch) {
      // Add relational email search on person and companyContact.person
      customWhere.OR = [
        { person: { email: { contains: rawSearch, mode: 'insensitive' } } },
        {
          companyContact: {
            person: { email: { contains: rawSearch, mode: 'insensitive' } },
          },
        },
      ];
    }

    // Person filter should apply to either opportunity.personId OR companyContact.personId
    if (query?.personId) {
      const id = String(query.personId);
      if (!validator.isUUID(id)) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          "Invalid value for 'personId'. Expected a UUID.",
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'get_all_opportunity',
            details: { personId: id },
          }
        );
        throw error;
      }
      andConditions.push({
        OR: [{ personId: id }, { companyContact: { personId: id } }],
      });
    }

    if (andConditions.length) {
      customWhere.AND = andConditions;
    }

    const response = await getPaginatedList({
      query,
      user,
      prisma,
      schema: opportunityUpdate,
      filterFields,
      searchFields,
      model: 'opportunity',
      include: Object.keys(include).length ? include : undefined,
      customWhere,
    });

    // Log database operation success
    logDatabaseSuccess('get_all_opportunity', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    // Mask minimal person details on list
    const roleNames = user?.roleNames || [];
    const maskEmailRole = process.env.MASK_CRM_PERSON_EMAIL_ROLE;
    const maskPhoneRole = process.env.MASK_CRM_PERSON_PHONE_NUMBER_ROLE;
    const shouldMaskEmail = maskEmailRole
      ? roleNames.includes(maskEmailRole)
      : false;
    const shouldMaskPhone = maskPhoneRole
      ? roleNames.includes(maskPhoneRole)
      : false;
    const mask = (value) => {
      if (!value) return value;
      const s = String(value);
      if (s.length <= 2) return s;
      return '*'.repeat(s.length - 2) + s.slice(-2);
    };
    const minimalizePerson = (p) => {
      if (!p) return p;
      const minimal = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: shouldMaskEmail ? mask(p.email) : p.email,
      };
      if (shouldMaskPhone) {
        minimal.homePhone = mask(p.homePhone);
        minimal.personalMobile = mask(p.personalMobile);
      }
      return minimal;
    };

    // Attach minimal masked person details + display values to all opportunities
    if (response?.results) {
      response.results = response.results.map((o) =>
        enrichRecordDisplayValues(
          attachNestedDisplayValues(
            {
              ...o,
              person: minimalizePerson(o.person),
              companyContact: o.companyContact
                ? {
                    ...o.companyContact,
                    person: minimalizePerson(o.companyContact.person),
                  }
                : o.companyContact,
            },
            [
              { relation: 'status', model: 'PipelineStage' },
              { relation: 'economicBuyerInfluence', model: 'CompanySpin' },
              { relation: 'technicalBuyerInfluence', model: 'CompanySpin' },
              { relation: 'userBuyerInfluence', model: 'CompanySpin' },
            ]
          ),
          'Opportunity'
        )
      );
    }

    // Log operation success
    logOperationSuccess('getAllOpportunity', req, {
      count: response?.results?.length || 0,
      total: response?.totalCount || 0,
    });

    res.status(200).json(response);
  } catch (error) {
    logOperationError('getAllOpportunity', req, error);
    throw handleDatabaseError(error, 'get_all_opportunity');
  }
}

async function createOpportunity(req, res) {
  const { user, body } = req;

  // Log operation start
  logOperationStart('createOpportunity', req, {
    user: user?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityCreate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('createOpportunity', req, error);
        throw handleValidationError(error, 'opportunity_creation');
      }
      logOperationError('createOpportunity', req, error);
      throw error;
    }

    const modelRelationFields = [
      'companyId',
      'personId',
      'statusId',
      'economicBuyerInfluenceId',
      'companyContactId',
      'technicalBuyerInfluenceId',
      'pipelineId',
      'userBuyerInfluenceId',
      'channelId',
      'categoryId',
    ];

    const include = {
      company: true,
      person: true,
      status: true,
      economicBuyerInfluence: true,
      companyContact: { include: { person: true } },
      technicalBuyerInfluence: true,
      pipeline: true,
      userBuyerInfluence: true,
      channel: true,
      category: true,
    };

    // A user must always have a client id
    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'create_opportunity_client_guard',
        }
      );
      throw error;
    }

    // Foreign key visibility validation (soft-delete aware)
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.companyId
          ? { model: 'company', fieldValues: { companyId: values.companyId } }
          : null,
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.pipelineId
          ? {
              model: 'pipeline',
              fieldValues: { pipelineId: values.pipelineId },
            }
          : null,
        values?.statusId
          ? {
              model: 'pipelineStage',
              fieldValues: { statusId: values.statusId },
            }
          : null,
        values?.companyContactId
          ? {
              model: 'companyContact',
              fieldValues: { companyContactId: values.companyContactId },
            }
          : null,
        values?.channelId
          ? { model: 'channel', fieldValues: { channelId: values.channelId } }
          : null,
        values?.categoryId
          ? {
              model: 'opportunityCategory',
              fieldValues: { categoryId: values.categoryId },
            }
          : null,
      ].filter(Boolean),
    });

    // const trimmedName = _.trim(values?.name || '');

    // COMMENTED OUT: existingByName check
    // Reason: Opportunities with same names were created before this check was added,
    // which is now causing issues as we don't have time to rename existing records yet.
    // TODO: Re-enable this check after renaming existing duplicate records
    /*
    if (trimmedName) {
      const existingByName = await prisma.opportunity.findFirst({
        where: {
          client: clientId,
          deleted: null,
          name: { equals: trimmedName, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (existingByName) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'An opportunity with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_creation_uniqueness',
            details: { name: trimmedName },
          }
        );
        throw error;
      }
    }
    */

    // Remove composite duplicate checks: allow multiple opportunities for same company/person/companyContact

    // Defaults & derivations (parity with Django behavior)
    if (!values?.ownerId) {
      values.ownerId = user?.id;
    }

    // If pipeline is set and status is not provided, default status to first stage of pipeline
    if (values?.pipelineId && !values?.statusId) {
      const firstStage = await prisma.pipelineStage.findFirst({
        where: {
          pipelineId: values.pipelineId,
          parentPipelineStageId: null,
          deleted: null,
          client: clientId,
        },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      if (firstStage) {
        values.statusId = firstStage.id;
      }
    }

    // If both pipelineId and statusId provided, ensure status belongs to pipeline
    if (values?.pipelineId && values?.statusId) {
      const stageValid = await prisma.pipelineStage.findFirst({
        where: {
          id: values.statusId,
          pipelineId: values.pipelineId,
          deleted: null,
          client: clientId,
        },
        select: { id: true },
      });
      if (!stageValid) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Status does not belong to the specified pipeline',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_create_status_pipeline_validation',
            details: {
              statusId: values.statusId,
              pipelineId: values.pipelineId,
            },
          }
        );
        throw error;
      }
    }

    // If company and person are provided, ensure a companyContact exists and link it
    if (values?.companyId && values?.personId && !values?.companyContactId) {
      const existingContact = await prisma.companyContact.findFirst({
        where: {
          companyId: values.companyId,
          personId: values.personId,
          client: clientId,
          deleted: null,
        },
        select: { id: true },
      });
      if (existingContact) {
        values.companyContactId = existingContact.id;
      } else {
        const newContact = await prisma.companyContact.create({
          data: buildCreateRecordPayload({
            user,
            validatedValues: {
              companyId: values.companyId,
              personId: values.personId,
            },
            requestBody: {},
            relations: ['companyId', 'personId'],
          }),
          select: { id: true },
        });
        values.companyContactId = newContact.id;
      }
    }

    // Sales person logic: derive salesPersonId from latest active company territory owner
    if (values?.companyId && !values?.salesPersonId) {
      const nowIso = new Date().toISOString();
      const companyTerritory = await prisma.companyInTerritory.findFirst({
        where: {
          companyId: values.companyId,
          deleted: null,
          OR: [{ expiryDate: null }, { expiryDate: { gt: nowIso } }],
          client: clientId,
        },
        orderBy: { expiryDate: 'desc' },
        select: { territoryId: true },
      });
      if (companyTerritory?.territoryId) {
        const territoryOwner = await prisma.territoryOwner.findFirst({
          where: {
            territoryId: companyTerritory.territoryId,
            deleted: null,
            OR: [{ expiryDate: null }, { expiryDate: { gt: nowIso } }],
            client: clientId,
          },
          orderBy: { expiryDate: 'desc' },
          select: { salesPersonId: true },
        });
        if (territoryOwner?.salesPersonId) {
          values.salesPersonId = territoryOwner.salesPersonId;
        }
      }
    }

    // Generate unique code if needed
    // const code = await generateUniqueCode(prisma, user?.client?.id);

    // Log database operation start
    logDatabaseStart('create_opportunity', req, {
      name: values.name,
      userId: user?.id,
    });

    const newOpportunity = await prisma.opportunity.create({
      data: buildCreateRecordPayload({
        user,
        validatedValues: values,
        requestBody: body,
        relations: modelRelationFields,
      }),
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('create_opportunity', req, {
      id: newOpportunity.id,
      code: newOpportunity.code,
    });

    let [newOpportunityWithDetailsRaw] = [newOpportunity];
    try {
      [newOpportunityWithDetailsRaw] = await getDetailsFromAPI({
        results: [newOpportunity],
        token: user?.accessToken,
      });
    } catch (_e) {
      // If enrichment fails, fall back to base record to avoid blocking creation
      [newOpportunityWithDetailsRaw] = [newOpportunity];
    }

    // Minimal masked person details in create response
    const roleNames = user?.roleNames || [];
    const maskEmailRole = process.env.MASK_CRM_PERSON_EMAIL_ROLE;
    const maskPhoneRole = process.env.MASK_CRM_PERSON_PHONE_NUMBER_ROLE;
    const shouldMaskEmail = maskEmailRole
      ? roleNames.includes(maskEmailRole)
      : false;
    const shouldMaskPhone = maskPhoneRole
      ? roleNames.includes(maskPhoneRole)
      : false;
    const mask = (value) => {
      if (!value) return value;
      const s = String(value);
      if (s.length <= 2) return s;
      return '*'.repeat(s.length - 2) + s.slice(-2);
    };
    const minimalizePerson = (p) => {
      if (!p) return p;
      const minimal = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: shouldMaskEmail ? mask(p.email) : p.email,
      };
      if (shouldMaskPhone) {
        minimal.homePhone = mask(p.homePhone);
        minimal.personalMobile = mask(p.personalMobile);
      }
      return minimal;
    };

    const newOpportunityWithDetails = enrichRecordDisplayValues(
      attachNestedDisplayValues(
        {
          ...newOpportunityWithDetailsRaw,
          person: minimalizePerson(newOpportunityWithDetailsRaw.person),
          companyContact: newOpportunityWithDetailsRaw.companyContact
            ? {
                ...newOpportunityWithDetailsRaw.companyContact,
                person: minimalizePerson(
                  newOpportunityWithDetailsRaw.companyContact.person
                ),
              }
            : newOpportunityWithDetailsRaw.companyContact,
        },
        [
          { relation: 'status', model: 'PipelineStage' },
          { relation: 'economicBuyerInfluence', model: 'CompanySpin' },
          { relation: 'technicalBuyerInfluence', model: 'CompanySpin' },
          { relation: 'userBuyerInfluence', model: 'CompanySpin' },
        ]
      ),
      'Opportunity'
    );

    // Log operation success
    logOperationSuccess('createOpportunity', req, {
      id: newOpportunity.id,
      code: newOpportunity.code,
    });

    res.status(201).json(newOpportunityWithDetails);

    // Fire-and-forget workflow trigger after response for lower latency
    (async () => {
      try {
        const requestedWorkflowId = values?.workflowId;

        // Build common payload
        let employeeDetails = {};
        if (newOpportunity?.salesPersonId) {
          try {
            const [employeeDetailsRecord] = await getDetailsFromAPI({
              results: [{ salesPersonId: newOpportunity.salesPersonId }],
              token: user?.accessToken,
            });
            employeeDetails =
              employeeDetailsRecord?.details?.salesPersonId || {};
          } catch (_e1) {
            // best-effort; do not block automata trigger
          }
        }
        let employeePerson = null;
        if (employeeDetails?.person) {
          try {
            employeePerson = await prisma.person.findFirst({
              where: {
                id: employeeDetails.person,
                client: clientId,
                deleted: null,
              },
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
              },
            });
          } catch (_e2) {
            // ignore lookup errors
          }
        }

        const payloadData = {
          ...newOpportunity,
          // Company info
          company_name: newOpportunity?.company?.name || '',
          company_website: newOpportunity?.company?.website || '',

          // Company contact info
          company_contact_person:
            newOpportunity?.companyContact?.person?.id || '',
          company_contact_first_name:
            newOpportunity?.companyContact?.person?.firstName || '',
          company_contact_middle_name:
            newOpportunity?.companyContact?.person?.middleName || '',
          company_contact_last_name:
            newOpportunity?.companyContact?.person?.lastName || '',
          company_contact_work_phone:
            newOpportunity?.companyContact?.workPhone || '',
          company_contact_work_mobile:
            newOpportunity?.companyContact?.workMobile || '',
          company_contact_work_email:
            newOpportunity?.companyContact?.workEmail || '',
          company_contact_job_title:
            newOpportunity?.companyContact?.jobTitle || '',

          // Sales person info (from HR + CRM Person)
          sales_person_person: employeeDetails?.person || '',
          sales_person_first_name: employeePerson?.firstName || '',
          sales_person_middle_name: employeePerson?.middleName || '',
          sales_person_last_name: employeePerson?.lastName || '',
          sales_person_cv: employeeDetails?.cv || '',
          sales_person_work_email:
            employeeDetails?.work_email || employeeDetails?.workEmail || '',
          sales_person_work_phone:
            employeeDetails?.work_phone || employeeDetails?.workPhone || '',
          sales_person_next_of_kin_phone:
            employeeDetails?.next_of_kin_phone ||
            employeeDetails?.nextOfKinPhone ||
            '',
        };

        if (requestedWorkflowId) {
          // Direct workflow trigger when workflowId is provided
          const automataResponse = await triggerAutomata(
            user?.accessToken,
            requestedWorkflowId,
            '',
            false,
            payloadData
          );

          if (automataResponse?.instance) {
            await prisma.opportunity.updateMany({
              where: { id: newOpportunity.id },
              data: {
                workflowId: requestedWorkflowId,
                workflowInstanceId: automataResponse.instance,
              },
            });
            logWithTrace('Automata workflow triggered (opportunity)', req, {
              workflowId: requestedWorkflowId,
              opportunityId: newOpportunity.id,
            });
          } else {
            logWithTrace(
              'Automata workflow trigger failed (opportunity)',
              req,
              {
                opportunityId: newOpportunity.id,
              }
            );
          }
        } else {
          // Fallback: discover and trigger workflow
          await findWorkflowAndTrigger(
            prisma,
            newOpportunity,
            'opportunity',
            user?.client?.id,
            payloadData,
            user?.accessToken
          );
        }
      } catch (_e) {
        // swallow to avoid impacting the request lifecycle
      }
    })();
  } catch (error) {
    logOperationError('createOpportunity', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'create_opportunity');
  }
}

async function getOpportunity(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getOpportunity', req, {
    user: user?.id,
    opportunityId: params?.id,
  });

  try {
    const include = {
      company: true,
      person: true,
      status: true,
      economicBuyerInfluence: true,
      companyContact: { include: { person: true } },
      technicalBuyerInfluence: true,
      pipeline: true,
      userBuyerInfluence: true,
      channel: true,
      category: true,
    };

    // Log database operation start
    logDatabaseStart('get_opportunity', req, {
      opportunityId: params?.id,
      userId: user?.id,
    });

    const foundOpportunity = await prisma.opportunity.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: Object.keys(include).length ? include : undefined,
    });

    // Log database operation success
    logDatabaseSuccess('get_opportunity', req, {
      found: !!foundOpportunity,
      opportunityId: params?.id,
    });

    if (!foundOpportunity) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_opportunity',
          details: { opportunityId: params?.id },
        }
      );
      logOperationError('getOpportunity', req, error);
      throw error;
    }

    let [foundOpportunityWithDetailsRaw] = [foundOpportunity];
    try {
      [foundOpportunityWithDetailsRaw] = await getDetailsFromAPI({
        results: [foundOpportunity],
        token: user?.accessToken,
      });
    } catch (_e) {
      [foundOpportunityWithDetailsRaw] = [foundOpportunity];
    }

    // Minimal masked person details in detail response
    const roleNames = user?.roleNames || [];
    const maskEmailRole = process.env.MASK_CRM_PERSON_EMAIL_ROLE;
    const maskPhoneRole = process.env.MASK_CRM_PERSON_PHONE_NUMBER_ROLE;
    const shouldMaskEmail = maskEmailRole
      ? roleNames.includes(maskEmailRole)
      : false;
    const shouldMaskPhone = maskPhoneRole
      ? roleNames.includes(maskPhoneRole)
      : false;
    const mask = (value) => {
      if (!value) return value;
      const s = String(value);
      if (s.length <= 2) return s;
      return '*'.repeat(s.length - 2) + s.slice(-2);
    };
    const minimalizePerson = (p) => {
      if (!p) return p;
      const minimal = {
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        email: shouldMaskEmail ? mask(p.email) : p.email,
      };
      if (shouldMaskPhone) {
        minimal.homePhone = mask(p.homePhone);
        minimal.personalMobile = mask(p.personalMobile);
      }
      return minimal;
    };

    const foundOpportunityWithDetails = enrichRecordDisplayValues(
      attachNestedDisplayValues(
        {
          ...foundOpportunityWithDetailsRaw,
          person: minimalizePerson(foundOpportunityWithDetailsRaw.person),
          companyContact: foundOpportunityWithDetailsRaw.companyContact
            ? {
                ...foundOpportunityWithDetailsRaw.companyContact,
                person: minimalizePerson(
                  foundOpportunityWithDetailsRaw.companyContact.person
                ),
              }
            : foundOpportunityWithDetailsRaw.companyContact,
        },
        [
          { relation: 'status', model: 'PipelineStage' },
          { relation: 'economicBuyerInfluence', model: 'CompanySpin' },
          { relation: 'technicalBuyerInfluence', model: 'CompanySpin' },
          { relation: 'userBuyerInfluence', model: 'CompanySpin' },
        ]
      ),
      'Opportunity'
    );

    // Log operation success
    logOperationSuccess('getOpportunity', req, {
      id: foundOpportunity.id,
      code: foundOpportunity.code,
    });

    res.status(200).json(foundOpportunityWithDetails);
  } catch (error) {
    logOperationError('getOpportunity', req, error);

    // DEBUG: Log actual error details for investigation
    console.error('[DEBUG getOpportunity] Actual error:', JSON.stringify({
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5),
    }));

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_opportunity');
  }
}

async function updateOpportunity(req, res) {
  const { params, body, user } = req;

  // Log operation start
  logOperationStart('updateOpportunity', req, {
    opportunityId: params?.id,
    bodyKeys: Object.keys(body || {}),
  });

  try {
    // Validation with error handling
    let values;
    try {
      values = await opportunityUpdate.validateAsync(body, {
        abortEarly: false,
        stripUnknown: true,
      });
    } catch (error) {
      if (error.isJoi) {
        logOperationError('updateOpportunity', req, error);
        throw handleValidationError(error, 'opportunity_update');
      }
      logOperationError('updateOpportunity', req, error);
      throw error;
    }

    // Fetch current record for parity logic and visibility
    const current = await prisma.opportunity.findFirst({
      where: { id: params?.id, ...getVisibilityFilters(user) },
      select: {
        id: true,
        pipelineId: true,
        statusId: true,
        ownerId: true,
        companyId: true,
        personId: true,
        companyContactId: true,
        client: true,
      },
    });
    if (!current) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity',
          details: { id: params?.id },
        }
      );
      throw error;
    }

    // Foreign key visibility validation
    await verifyForeignKeyAccessBatch({
      user,
      validations: [
        values?.companyId
          ? { model: 'company', fieldValues: { companyId: values.companyId } }
          : null,
        values?.personId
          ? { model: 'person', fieldValues: { personId: values.personId } }
          : null,
        values?.pipelineId
          ? {
              model: 'pipeline',
              fieldValues: { pipelineId: values.pipelineId },
            }
          : null,
        values?.statusId
          ? {
              model: 'pipelineStage',
              fieldValues: { statusId: values.statusId },
            }
          : null,
        values?.companyContactId
          ? {
              model: 'companyContact',
              fieldValues: { companyContactId: values.companyContactId },
            }
          : null,
        values?.channelId
          ? { model: 'channel', fieldValues: { channelId: values.channelId } }
          : null,
        values?.categoryId
          ? {
              model: 'opportunityCategory',
              fieldValues: { categoryId: values.categoryId },
            }
          : null,
      ].filter(Boolean),
    });

    // Uniqueness checks for name
    // A user must always have a client id; do not fallback to current.client
    const clientId = user?.client?.id;
    if (!clientId) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        'Missing client id in user context',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'update_opportunity_client_guard',
        }
      );
      throw error;
    }
    // const trimmedName = _.trim(values?.name || '');
    // COMMENTED OUT: existingByName check
    // Reason: Opportunities with same names were created before this check was added,
    // which is now causing issues as we don't have time to rename existing records yet.
    // TODO: Re-enable this check after renaming existing duplicate records
    /*

    if (trimmedName) {
      const existingByName = await prisma.opportunity.findFirst({
        where: {
          client: clientId,
          deleted: null,
          id: { not: params?.id },
          name: { equals: trimmedName, mode: 'insensitive' },
        },
        select: { id: true },
      });

      if (existingByName) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'An opportunity with this name already exists for your account.',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_update_uniqueness',
            details: { name: trimmedName },
          },
        );
        throw error;
      }
    }
    */

    // Remove composite duplicate checks: allow multiple opportunities for same company/person/companyContact

    // Defaults and parity logic
    if (!values?.ownerId && !current.ownerId) {
      values.ownerId = user?.id;
    }

    const pipelineChanged =
      Boolean(values?.pipelineId) && values.pipelineId !== current.pipelineId;
    const statusProvided = Boolean(values?.statusId);
    if (pipelineChanged && !statusProvided) {
      const firstStage = await prisma.pipelineStage.findFirst({
        where: {
          pipelineId: values.pipelineId,
          parentPipelineStageId: null,
          deleted: null,
          client: clientId,
        },
        orderBy: { order: 'asc' },
        select: { id: true },
      });
      if (firstStage) {
        values.statusId = firstStage.id;
      }
    }

    const finalStatusId = values?.statusId ?? current.statusId;
    if (finalStatusId && finalStatusId !== current.statusId) {
      // Validate status belongs to the (new or existing) pipeline
      const pipelineIdToUse = values?.pipelineId ?? current.pipelineId;
      if (!pipelineIdToUse) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Cannot set status without a pipeline',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_update_status_pipeline_validation',
          }
        );
        throw error;
      }
      const stageValid = await prisma.pipelineStage.findFirst({
        where: {
          id: finalStatusId,
          pipelineId: pipelineIdToUse,
          deleted: null,
          client: clientId,
        },
        select: { id: true },
      });
      if (!stageValid) {
        const error = createErrorWithTrace(
          ERROR_TYPES.VALIDATION,
          'Status does not belong to the specified pipeline',
          req,
          {
            severity: ERROR_SEVERITY.LOW,
            context: 'opportunity_update_status_pipeline_validation',
            details: { statusId: finalStatusId, pipelineId: pipelineIdToUse },
          }
        );
        throw error;
      }
      values.statusAssignedDate = new Date();
    }

    // If company and person are set (either via update or existing), ensure companyContact linkage
    const targetCompanyId = values?.companyId ?? current.companyId;
    const targetPersonId = values?.personId ?? current.personId;
    const targetCompanyContactId =
      values?.companyContactId ?? current.companyContactId;
    if (targetCompanyId && targetPersonId && !targetCompanyContactId) {
      const existingContact = await prisma.companyContact.findFirst({
        where: {
          companyId: targetCompanyId,
          personId: targetPersonId,
          client: clientId,
          deleted: null,
        },
        select: { id: true },
      });
      if (existingContact) {
        values.companyContactId = existingContact.id;
      } else {
        const newContact = await prisma.companyContact.create({
          data: buildCreateRecordPayload({
            user,
            validatedValues: {
              companyId: targetCompanyId,
              personId: targetPersonId,
            },
            requestBody: {},
            relations: ['companyId', 'personId'],
          }),
          select: { id: true },
        });
        values.companyContactId = newContact.id;
      }
    }

    // Log database operation start
    logDatabaseStart('update_opportunity', req, {
      opportunityId: params?.id,
      updateFields: Object.keys(values),
    });

    const updatedOpportunity = await prisma.opportunity.update({
      where: { id: params?.id },
      data: {
        ...objectKeysToCamelCase(values),
        updatedBy: user?.id,
      },
    });

    const opportunityWithDisplayValue = enrichRecordDisplayValues(
      updatedOpportunity,
      'Opportunity'
    );

    // Log database operation success
    logDatabaseSuccess('update_opportunity', req, {
      id: updatedOpportunity.id,
      updatedFields: Object.keys(values),
    });

    // Log operation success
    logOperationSuccess('updateOpportunity', req, {
      id: updatedOpportunity.id,
      updatedFields: Object.keys(values),
    });

    res.status(200).json(opportunityWithDisplayValue);
  } catch (error) {
    logOperationError('updateOpportunity', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'update_opportunity');
  }
}

async function deleteOpportunity(req, res) {
  const { params, user } = req;

  // A user must always have a client id
  const clientId = user?.client?.id;
  if (!clientId) {
    const error = createErrorWithTrace(
      ERROR_TYPES.VALIDATION,
      'Missing client id in user context',
      req,
      {
        severity: ERROR_SEVERITY.LOW,
        context: 'delete_opportunity_client_guard',
      }
    );
    throw error;
  }

  // Log operation start
  logOperationStart('deleteOpportunity', req, {
    user: user?.id,
    opportunityId: params?.id,
  });

  try {
    await prisma.client.updateMany({
      where: { opportunityId: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityInfluencer.updateMany({
      where: { opportunityId: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.actionPlan.updateMany({
      where: { opportunityId: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.dataNeeded.updateMany({
      where: { opportunityId: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityProduct.updateMany({
      where: { opportunityId: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    await prisma.opportunityHistory.updateMany({
      where: { opportunityId: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation start
    logDatabaseStart('delete_opportunity', req, {
      opportunityId: params?.id,
      userId: user?.id,
    });

    const result = await prisma.opportunity.updateMany({
      where: { id: params?.id, client: clientId, deleted: null },
      data: {
        deleted: new Date().toISOString(),
        updatedBy: user?.id,
      },
    });

    // Log database operation success
    logDatabaseSuccess('delete_opportunity', req, {
      deletedCount: result.count,
      opportunityId: params?.id,
    });

    if (result.count === 0) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Opportunity not found or not accessible',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'delete_opportunity',
          details: { opportunityId: params?.id },
        }
      );
      logOperationError('deleteOpportunity', req, error);
      throw error;
    }

    // Log operation success
    logOperationSuccess('deleteOpportunity', req, {
      deletedCount: result.count,
      opportunityId: params?.id,
    });

    res.status(200).json({ deleted: params?.id });
  } catch (error) {
    logOperationError('deleteOpportunity', req, error);

    // Re-throw if it's already a standardized error
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'delete_opportunity');
  }
}

async function getOpportunityBarChartData(req, res) {
  // Dashboard metrics not configured
  res.status(400).json({
    message: 'Dashboard feature not configured for opportunity',
    code: ERROR_TYPES.BAD_REQUEST,
  });
}

module.exports = {
  getAllOpportunity,
  createOpportunity,
  getOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpportunityBarChartData,
  getOpportunityStages,
  bulkUpdateOpportunityVisibility,
};
