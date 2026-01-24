const validator = require('validator');
const prisma = require('#configs/prisma.js');
const {
  ERROR_TYPES,
  ERROR_SEVERITY,
  DISPLAY_VALUE_PROP,
} = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
} = require('#utils/shared/traceUtils.js');
const { handleDatabaseError } = require('#utils/shared/errorHandlingUtils.js');
const { computeDisplayValue } = require('#utils/shared/displayValueUtils.js');

async function getPersonUnmaskedPhone(req, res) {
  const { params, user } = req;

  // Log operation start
  logOperationStart('getPersonUnmaskedPhone', req, {
    user: user?.id,
    personId: params?.id,
  });

  try {
    if (params?.id && !validator.isUUID(params?.id)) {
      const error = createErrorWithTrace(
        ERROR_TYPES.VALIDATION,
        "Invalid or missing value for 'id'. Expected a Person UUID.",
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person_unmasked_phone_validation',
          details: { id: params?.id },
        }
      );
      logOperationError('getPersonUnmaskedPhone', req, error);
      throw error;
    }

    // Log database operation start
    logDatabaseStart('get_person', req, {
      personId: params?.id,
      userId: user?.id,
    });

    const foundPerson = await prisma.person.findFirst({
      where: {
        id: params?.id,
        deleted: null,
      },
      select: { id: true, personalMobile: true },
    });

    // Log database operation success
    logDatabaseSuccess('get_person', req, {
      found: !!foundPerson,
      personId: params?.id,
    });

    if (!foundPerson) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Person not found',
        req,
        {
          severity: ERROR_SEVERITY.LOW,
          context: 'get_person',
          details: { personId: params?.id },
        }
      );
      logOperationError('getPersonUnmaskedPhone', req, error);
      throw error;
    }

    // Attach display value
    const personWithDisplayValue = {
      personalMobile: foundPerson.personalMobile,
      [DISPLAY_VALUE_PROP]: computeDisplayValue(foundPerson, 'Person'),
    };

    // Log operation success
    logOperationSuccess('getPersonUnmaskedPhone', req, {
      id: foundPerson.id,
      personalMobile: foundPerson.personalMobile,
    });

    res.status(200).json(personWithDisplayValue);
  } catch (error) {
    logOperationError('getPersonUnmaskedPhone', req, error);

    // Re-throw standardized errors as-is
    if (error.type && Object.values(ERROR_TYPES).includes(error.type)) {
      throw error;
    }

    throw handleDatabaseError(error, 'get_person');
  }
}

module.exports = {
  getPersonUnmaskedPhone,
};
