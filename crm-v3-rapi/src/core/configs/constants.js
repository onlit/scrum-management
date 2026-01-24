/**
 * CREATED BY: najiba@pullstream.com
 * CREATOR EMAIL: najiba@pullstream.com
 * CREATION DATE: 21/01/2026
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file defines various constants and configurations related to the compute microservice.
 * It sets up environment variables using dotenv, including the microservice name.
 *
 * NOTE: Error constants (ERROR_TYPES, STATUS_CODES, ERROR_MESSAGES, ERROR_TITLES) are
 * imported from the canonical source at shared/exceptions/domain.exception.js to ensure
 * consistency between Core and Domain layers.
 *
 */

const dotenv = require('dotenv');

// Import error constants from canonical source
const {
  ERROR_TYPES,
  STATUS_CODES,
  ERROR_MESSAGES,
  ERROR_TITLES,
} = require('#core/exceptions/domain.exception.js');

dotenv.config();

const MS_NAME = 'CRM V3';

const DEV_ENV_NAME = 'development';

// Reserved computed property for display labels to avoid user field collisions
const DISPLAY_VALUE_PROP = '__displayValue';

const DJANGO_DETAILS_ROUTE = '/api/get-bulk-details/';
const NODE_DETAILS_ROUTE = '/api/v1/get-bulk-details/';

// External service hosts
const { CALENDAR_HOST, BPA_HOST } = process.env;

const UUID_KEY_VALUE_PAIRS = {
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
  [process.env.LISTS_V2_HOST]: {
    route: NODE_DETAILS_ROUTE,
    models: {
      state: { stateId: true },
      country: { countryId: true },
      city: { cityId: true },
      industry: { industryId: true },
    },
  },
  [process.env.HR_HOST]: {
    route: DJANGO_DETAILS_ROUTE,
    models: {
      Employee: { ownerId: true, accountManagerId: true, salesPersonId: true },
    },
  },
  [process.env.INVENTORY_V2_HOST]: {
    route: NODE_DETAILS_ROUTE,
    models: {
      productVariant: { productVariantId: true },
    },
  },
};

// Display value configuration per model (generated)
const DISPLAY_VALUE_TEMPLATES = {
  Person: '{firstName} {lastName}',
};

const DISPLAY_VALUE_FALLBACK_FIELDS = {
  Person: 'firstName',
  OpportunityPipeline: 'name',
  Relationship: 'name',
  PersonSocialMedia: 'username',
  ProspectCategory: 'name',
  Prospect: 'person',
  PersonRelationship: 'person',
  PersonRelationshipHistory: 'personRelationship',
  CompanyContact: 'person',
  AccountManagerInCompany: 'accountManager',
  TerritoryOwner: 'salesPerson',
  SalesPersonTarget: 'salesPerson',
  CustomerEnquiryPurpose: 'name',
  CustomerEnquiry: 'person',
  Client: 'companyContact',
  ClientHistory: 'url',
  OpportunityInfluencer: 'companyContact',
  SocialMediaType: 'name',
  CompanySocialMedia: 'url',
  ActionPlan: 'what',
  DataNeeded: 'infoNeeded',
  PersonHistory: 'person',
  CallList: 'name',
  CallListPipelineStage: 'name',
  CallSchedule: 'person',
  Company: 'name',
  CompanyHistory: 'history',
  CompanyInTerritory: 'territory',
  TargetActualHistory: 'actuals',
  PersonInMarketingList: 'person',
  OnlineSignup: 'owner',
  CallListPipeline: 'name',
  OpportunityProduct: 'productVariant',
  CallHistory: 'outcome',
  OpportunityHistory: 'notes',
  CompanySpin: 'problem',
  Opportunity: 'name',
  PipelineStage: 'stage',
  Territory: 'name',
  Channel: 'name',
  CustomerEnquiryStatus: 'name',
  ProspectPipeline: 'name',
  ProspectProduct: 'prospect',
  OpportunityCategory: 'name',
  ProspectPipelineStage: 'stage',
  MarketingList: 'name',
};

// Error severity levels
const ERROR_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
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
