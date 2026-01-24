const _ = require('lodash');

// Note: Using _.camelCase directly here to avoid circular dependency
// (stringUtils → databaseUtils → visibilityUtils → stringUtils)

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

  return {
    createdBy: createdBy ?? user?.id,
    updatedBy: updatedBy ?? user?.id,
    client: client ?? user?.client?.id,
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

  // Define base conditions for visibility
  const visibilityConditions = {
    OR: [],
  };

  const ensureArray = (value) => (Array.isArray(value) ? value : []);

  const transform = (arr) => arr.map(({ id, name }) => `${id}|${name}`);

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

    transform(ensureArray(user?.roles)).forEach((item) => {
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
