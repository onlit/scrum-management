/**
 * CREATED BY: Umer Lachi
 * CREATOR EMAIL: umer@pullstream.com
 * CREATION DATE: 25/08/2025
 *
 *
 * DESCRIPTION:
 * ------------------
 * This file provides utilities related to data visibility and access control within the application. It includes functions for parsing visibility attributes from data inputs, constructing database query filters based on user permissions, and ensuring data is accessed in accordance with defined visibility rules.
 *
 *
 */
const _ = require('lodash');
const validator = require('validator');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');

/**
 * Extracts visibility fields from the provided body object.
 *
 * @param {Object} options - Options object.
 * @param {Object} options.body - The body object to extract the visibility fields from.
 * @param {Object} options.user - The user object.
 * @param {boolean} options.noDefaults - Flag indicating whether to exclude default fields or not.
 *
 * @returns {Object} The extracted visibility fields object.
 */
function parseAndAssignVisibilityAttributes({
  body,
  user,
  noDefaults = false,
}) {
  const bodyOrObj = _.mapKeys(body, (value, key) => _.camelCase(key));

  const {
    client,
    createdBy,
    updatedBy,
    everyoneCanSeeIt,
    anonymousCanSeeIt,
    onlyTheseRolesCanSeeIt = [],
    onlyTheseUsersCanSeeIt = [],
  } = bodyOrObj;

  const extractedFields = {
    everyoneCanSeeIt:
      typeof everyoneCanSeeIt === 'string'
        ? everyoneCanSeeIt === 'true'
        : !!everyoneCanSeeIt,
    anonymousCanSeeIt:
      typeof anonymousCanSeeIt === 'string'
        ? anonymousCanSeeIt === 'true'
        : !!anonymousCanSeeIt,
    onlyTheseRolesCanSeeIt,
    onlyTheseUsersCanSeeIt,
  };

  if (noDefaults) {
    Object.keys(extractedFields).forEach((key) => {
      if (!(key in body)) {
        delete extractedFields[key];
      }
    });
  }

  // Enforce rules for createdBy/client usage
  const isAuthenticated = !!user?.isAuthenticated;

  // If authenticated, never trust body values; always use user context
  if (isAuthenticated) {
    return {
      createdBy: user?.id,
      updatedBy: user?.id,
      client: user?.client?.id,
      ...extractedFields,
    };
  }

  // If not authenticated, validate provided UUIDs if present
  if (!isAuthenticated) {
    // Enforce presence
    if (
      createdBy === undefined ||
      createdBy === null ||
      String(createdBy).trim() === ''
    ) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'createdBy is required for anonymous requests.',
        { severity: ERROR_SEVERITY.LOW, context: 'visibility_attributes' }
      );
    }
    if (
      client === undefined ||
      client === null ||
      String(client).trim() === ''
    ) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'client is required for anonymous requests.',
        { severity: ERROR_SEVERITY.LOW, context: 'visibility_attributes' }
      );
    }
  }

  if (createdBy !== undefined && createdBy !== null) {
    const val = String(createdBy);
    if (!validator.isUUID(val)) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Invalid createdBy format. Expected a UUID.',
        { severity: ERROR_SEVERITY.LOW, context: 'visibility_attributes' }
      );
    }
  }
  if (client !== undefined && client !== null) {
    const val = String(client);
    if (!validator.isUUID(val)) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Invalid client format. Expected a UUID.',
        { severity: ERROR_SEVERITY.LOW, context: 'visibility_attributes' }
      );
    }
  }
  if (updatedBy !== undefined && updatedBy !== null) {
    const val = String(updatedBy);
    if (!validator.isUUID(val)) {
      throw createStandardError(
        ERROR_TYPES.VALIDATION,
        'Invalid updatedBy format. Expected a UUID.',
        { severity: ERROR_SEVERITY.LOW, context: 'visibility_attributes' }
      );
    }
  }

  return {
    createdBy: createdBy ?? user?.id ?? null,
    updatedBy: updatedBy ?? user?.id ?? null,
    client: client ?? user?.client?.id ?? null,
    ...extractedFields,
  };
}

/**
 * Builds the payload for creating a new record by merging provided values with visibility fields.
 *
 * @param {Object} options - Options object.
 * @param {Object} options.validatedValues - The validated values object to merge with the visibility fields.
 * @param {Object} options.requestBody - The request body object to extract the visibility fields from.
 * @param {Object} options.user - The user object.
 * @param {Object} options.relations - An array of foreign key name strings.
 *
 * @returns {Object} The create record body object.
 */
function buildCreateRecordPayload(
  { validatedValues, requestBody, user, relations } = { relations: [] }
) {
  const visibilityAttributes = parseAndAssignVisibilityAttributes({
    body: requestBody,
    user,
  });

  const recordPayload = {};

  // Convert empty string values to null for all fields
  const sanitizedValues = {};
  for (const [key, value] of Object.entries(validatedValues)) {
    sanitizedValues[key] = value === '' ? null : value;
  }

  for (const fieldName of Object.keys(sanitizedValues)) {
    if (fieldName.endsWith('Id') && relations?.includes(fieldName)) {
      if (!sanitizedValues[fieldName]) {
        continue;
      }

      const relatedModelName = _.camelCase(fieldName.slice(0, -2));
      recordPayload[relatedModelName] = {
        connect: {
          id: sanitizedValues[fieldName],
        },
      };
    } else {
      recordPayload[_.camelCase(fieldName)] = sanitizedValues[fieldName];
    }
  }

  for (const fieldName of Object.keys(recordPayload)) {
    if (fieldName in visibilityAttributes) {
      delete visibilityAttributes[fieldName];
    }
  }

  return { ...recordPayload, ...visibilityAttributes };
}

/**
 * Returns the visibility filters based on the user's permissions.
 *
 * @param {Object} user - The user object.
 * @param {boolean} user.isAuthenticated - Flag indicating whether the user is authenticated or not.
 * @param {Object} user.client - The company object.
 * @param {string} user.client.id - The ID of the company the user belongs to.
 * @param {string} user.id - The ID of the user.
 *
 * @returns {Object} The visibility filters object.
 */
function getVisibilityFilters(user) {
  const client = user.client?.id;

  // Honor internal server-to-server calls by scoping visibility to the provided client.
  // If client is missing for an internal call, fall back to anonymous visibility only.
  if (user?.internalRequest) {
    if (client) {
      return { AND: [{ client }] };
    }

    return {
      AND: [
        {
          OR: [{ anonymousCanSeeIt: true }],
        },
      ],
    };
  }

  // Define base conditions for visibility
  const visibilityConditions = {
    OR: [],
  };

  const transform = (arr) => {
    // 1. Ensure the input is an array
    if (!Array.isArray(arr)) {
      return []; // Return an empty array for invalid input
    }

    return arr
      .filter((item) => {
        // 2. Check if the item is an object and if role is a non-null object
        const isObject = item && typeof item === 'object';
        const hasValidRole =
          isObject && item.role && typeof item.role === 'object';

        // 3. Check for the existence of id and role.name specifically
        // This allows an id of 0 to be considered valid
        return (
          item &&
          item.id != null && // Use != null to check for both null and undefined
          hasValidRole &&
          item.role.name
        );
      })
      .map(({ id, role }) => `${id}|${role.name}`);
  };

  // Extend conditions based on user's authentication and role
  if (user.isAuthenticated) {
    // Additional conditions for authenticated users
    const authenticatedUserConditions = [
      { everyoneCanSeeIt: true },
      { client, createdBy: user.id },
      { client, everyoneInObjectCompanyCanSeeIt: true },
      {
        onlyTheseUsersCanSeeIt: {
          array_contains: [`${user.id}|${user.email}`],
        },
      },
    ];

    transform(user?.roles).forEach((item) => {
      authenticatedUserConditions.push({
        onlyTheseRolesCanSeeIt: {
          array_contains: [item],
        },
      });
    });

    // Merge conditions
    visibilityConditions.OR.push(...authenticatedUserConditions);
  } else {
    // Condition for non-authenticated (anonymous) users
    visibilityConditions.OR.push({ anonymousCanSeeIt: true });
  }

  // Final query condition
  return {
    AND: [visibilityConditions],
  };
}

module.exports = {
  parseAndAssignVisibilityAttributes,
  buildCreateRecordPayload,
  getVisibilityFilters,
};
