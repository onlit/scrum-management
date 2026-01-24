/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to the compute microservice.
 * It sets up environment variables using dotenv, including the microservice name.
 *
 *
 */

const dotenv = require('dotenv');

dotenv.config();

const MS_NAME = 'CRM V2';

const DEV_ENV_NAME = 'development';

// Reserved computed property for display labels to avoid user field collisions
const DISPLAY_VALUE_PROP = '__displayValue';

const DJANGO_DETAILS_ROUTE = '/api/get-bulk-details/';
const NODE_DETAILS_ROUTE = '/api/v1/get-bulk-details/';

// External service hosts
const { CALENDAR_HOST, HR_HOST, LISTS_V2_HOST, BPA_HOST } = process.env;

const UUID_KEY_VALUE_PAIRS = {
  [HR_HOST]: {
    route: DJANGO_DETAILS_ROUTE,
    models: {
      Employee: {
        accountManagerId: true,
        salesPersonId: true,
        ownerId: true,
      },
    },
  },
  [BPA_HOST]: {
    route: DJANGO_DETAILS_ROUTE,
    models: {
      WorkflowDefn: {
        workflowId: true,
      },
      WorkflowInstance: {
        workflowInstanceId: true,
      },
    },
  },
  [LISTS_V2_HOST]: {
    route: NODE_DETAILS_ROUTE,
    models: {
      country: {
        countryId: true,
      },
      state: {
        stateId: true,
      },
      city: {
        cityId: true,
      },
      industry: {
        industryId: true,
      },
    },
  },
};

// Display value configuration per model (generated)
const DISPLAY_VALUE_TEMPLATES = {
  Person: '{firstName} {lastName}',
  ProspectProduct: '{prospect} - {productVariant}',
  OpportunityProduct: '{opportunity} - {productVariant}',
  PersonRelationship: '{person}',
};

const DISPLAY_VALUE_FALLBACK_FIELDS = {
  Company: 'name',
  Person: 'email',
  Relationship: 'name',
  SocialMediaType: 'name',
  Territory: 'name',
  Channel: 'name',
  CustomerEnquiryPurpose: 'name',
  CustomerEnquiryStatus: 'name',
  Pipeline: 'name',
  CallListPipeline: 'name',
  PipelineStage: 'stage',
  CallListPipelineStage: 'name',
  MarketingList: 'name',
  CompanyHistory: 'history',
  CompanySocialMedia: 'url',
  CompanySpin: 'problem',
  AccountManagerInCompany: 'accountManager',
  CompanyInTerritory: 'territory',
  PersonHistory: 'person',
  PersonSocialMedia: 'username',
  PersonInMarketingList: 'person',
  PersonRelationship: 'person',
  TerritoryOwner: 'salesPerson',
  CompanyContact: 'person',
  CustomerEnquiry: 'person',
  CallList: 'name',
  PersonRelationshipHistory: 'personRelationship',
  SalesPersonTarget: 'salesPerson',
  Opportunity: 'name',
  OpportunityCategory: 'name',
  CallSchedule: 'person',
  Client: 'companyContact',
  TargetActualHistory: 'actuals',
  OpportunityInfluencer: 'companyContact',
  OpportunityProduct: 'productVariant',
  OpportunityHistory: 'notes',
  ActionPlan: 'what',
  DataNeeded: 'infoNeeded',
  CallHistory: 'outcome',
  ClientHistory: 'url',
  OnlineSignup: 'owner',
  Prospect: 'person',
  ProspectProduct: 'productVariant',
  ProspectCategory: 'name',
  ProspectPipeline: 'name',
  ProspectPipelineStage: 'stage',
  // Aliases for relation property names that don't match model names
  SocialMedia: 'name', // for CompanySocialMedia.socialMedia → SocialMediaType
  ClientRef: 'companyContact', // for ClientHistory.clientRef → Client
  Country: 'name',
  Employee: 'email',
  AccountManager: 'email',
  Status: 'name',
};

// Error severity levels
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

// Standard error types
const ERROR_TYPES = {
  VALIDATION: 'validation',
  AUTHENTICATION: 'authentication',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMIT: 'rate_limit',
  INTERNAL: 'internal',
  BAD_REQUEST: 'bad_request',
  SERVICE_UNAVAILABLE: 'service_unavailable',
};

// Standard error messages
const ERROR_MESSAGES = {
  [ERROR_TYPES.VALIDATION]: 'Validation failed',
  [ERROR_TYPES.AUTHENTICATION]: 'Authentication required',
  [ERROR_TYPES.AUTHORIZATION]: 'Insufficient permissions',
  [ERROR_TYPES.NOT_FOUND]: 'Resource not found',
  [ERROR_TYPES.CONFLICT]: 'Resource conflict',
  [ERROR_TYPES.RATE_LIMIT]: 'Rate limit exceeded',
  [ERROR_TYPES.INTERNAL]: 'Internal server error',
  [ERROR_TYPES.BAD_REQUEST]: 'Bad request',
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 'Service temporarily unavailable',
};

// Error titles for responses
const ERROR_TITLES = {
  [ERROR_TYPES.VALIDATION]: 'Validation Failed',
  [ERROR_TYPES.AUTHENTICATION]: 'Unauthorized',
  [ERROR_TYPES.AUTHORIZATION]: 'Forbidden',
  [ERROR_TYPES.NOT_FOUND]: 'Not Found',
  [ERROR_TYPES.CONFLICT]: 'Conflict',
  [ERROR_TYPES.RATE_LIMIT]: 'Rate Limited',
  [ERROR_TYPES.INTERNAL]: 'Internal Server Error',
  [ERROR_TYPES.BAD_REQUEST]: 'Bad Request',
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 'Service Unavailable',
};

// Status codes mapping
const STATUS_CODES = {
  [ERROR_TYPES.VALIDATION]: 422,
  [ERROR_TYPES.AUTHENTICATION]: 401,
  [ERROR_TYPES.AUTHORIZATION]: 403,
  [ERROR_TYPES.NOT_FOUND]: 404,
  [ERROR_TYPES.CONFLICT]: 409,
  [ERROR_TYPES.RATE_LIMIT]: 429,
  [ERROR_TYPES.INTERNAL]: 500,
  [ERROR_TYPES.BAD_REQUEST]: 400,
  [ERROR_TYPES.SERVICE_UNAVAILABLE]: 503,
};

module.exports = {
  MS_NAME,
  DEV_ENV_NAME,
  DJANGO_DETAILS_ROUTE,
  NODE_DETAILS_ROUTE,
  UUID_KEY_VALUE_PAIRS,
  DISPLAY_VALUE_TEMPLATES,
  DISPLAY_VALUE_FALLBACK_FIELDS,
  ERROR_SEVERITY,
  ERROR_TYPES,
  ERROR_MESSAGES,
  ERROR_TITLES,
  STATUS_CODES,
  CALENDAR_HOST,
  DISPLAY_VALUE_PROP,
};
