const path = require('path');
const {
  toCamelCase,
  replaceAllOccurrences,
} = require('#utils/shared/stringUtils.js');
const { getFormattedFieldName } = require('#utils/api/commonUtils.js');
const { filterDeleted } = require('#utils/shared/generalUtils.js');
const { modifyFile, formatFile } = require('#utils/shared/fileUtils.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  // logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');

const NON_NULLABLE_TYPES = ['UUID', 'Boolean', 'Int', 'Float', 'Decimal', 'Latitude', 'Longitude', 'Percentage'];

/**
 * Maps a field definition to a Joi validation string.
 *
 * This function takes a field object, which includes the field's data type,
 * optional status, minimum and maximum lengths (for strings), enum definitions (for enum types),
 * and potentially other properties relevant for validation. It returns a string representing
 * the corresponding Joi validation logic. If the field's data type is not recognized,
 * it defaults to a forbidden Joi validation. The function also handles the optional
 * status of fields, appending `.optional()` or `.required()` as appropriate.
 *
 * @param {Object} field - An object representing the field to be validated.
 * The object structure is:
 *  {
 *    dataType: 'String' | 'Int' | 'Boolean' | 'Json' | 'DateTime' | 'Date' | 'UUID' | 'Float' | 'Decimal' | 'URL' | 'IPAddress' | 'Enum',
 *    isOptional: Boolean?,
 *    minLength: Number?, // Optional min length for String type
 *    maxLength: Number?, // Optional max length for String type
 *    enumDefn: { values: Array }?, // Optional enum definition, applicable for dataType: 'Enum'
 *    defaultValue: String?, // Optional default value for the field
 *  }
 * @returns {String} A string representing the Joi validation logic for the specified field.
 */
function mapFieldTypeToJoi(field) {
  // Helper to format enum values for validation (uses value field)
  const formatEnumValues = (values) =>
    values.map(({ value }) => `'${value}'`).join(', ');

  // Helper to format enum labels for error messages (uses label field)
  /// Uses double quotes to avoid conflicts with single quotes in labels
  const formatEnumLabels = (values) =>
    values.map(({ label }) => label).join(', ');

  const minLenVal = field?.minLength ? `.min(${field.minLength})` : '';
  const maxLenVal = field?.maxLength ? `.max(${field.maxLength})` : '';

  // Use Joi.alternatives to accept both objects and arrays for Prisma Json fields
  // Prisma stores Json fields as native JSON objects/arrays, not strings
  const jsonValidation = `Joi.alternatives()
                            .try(Joi.object(), Joi.array())
                            .messages({
                              'alternatives.match': 'Must be a valid JSON object or array'
                            })`;

  const dateValidation = `Joi.string().custom(validateISODate).messages({
                            'string.base': 'Must be a valid date',
                            'string.empty': 'Date is required'
                          })`;
  const dateTimeValidation = `Joi.string().custom(validateISODateTime).messages({
                            'string.base': 'Must be a valid date and time',
                            'string.empty': 'Date and time is required'
                          })`;

  // Mapping of field types to Joi validation strings
  const joiStringMap = {
    String: () =>
      `Joi.string()${minLenVal}${maxLenVal}.messages({
        'string.base': 'Must be text',
        'string.empty': 'Cannot be empty',
        'string.min': 'Must be at least {#limit} characters',
        'string.max': 'Cannot exceed {#limit} characters'
      })`,
    Email: () =>
      `Joi.string().email().messages({
        'string.base': 'Must be text',
        'string.empty': 'Email is required',
        'string.email': 'Please enter a valid email address'
      })`,
    Int: () =>
      `Joi.number().integer().min(0).max(2147483647).messages({
        'number.base': 'Must be a number',
        'number.integer': 'Must be a whole number (no decimals)',
        'number.min': 'Must be 0 or greater',
        'number.max': 'Number is too large'
      })`,
    Boolean: () =>
      `Joi.boolean().messages({
        'boolean.base': 'Must be Yes or No'
      })`,
    Json: () => jsonValidation,
    DateTime: () => dateTimeValidation,
    Date: () => dateValidation,
    UUID: () =>
      `Joi.string().uuid().messages({
        'string.base': 'Must be text',
        'string.empty': 'This field is required',
        'string.guid': 'Invalid identifier format'
      })`,
    Float: () =>
      `Joi.number().min(0).max(3.40282347e+38).messages({
        'number.base': 'Must be a number',
        'number.min': 'Must be 0 or greater',
        'number.max': 'Number is too large'
      })`,
    Decimal: () =>
      `Joi.number().min(0).precision(2).messages({
        'number.base': 'Must be a number',
        'number.min': 'Must be 0 or greater',
        'number.precision': 'Maximum 2 decimal places allowed'
      })`,
    URL: () =>
      `Joi.string().uri().messages({
        'string.base': 'Must be text',
        'string.empty': 'URL is required',
        'string.uri': 'Please enter a valid URL (e.g., https://example.com)'
      })`,
    Upload: () =>
      `Joi.alternatives().try(Joi.string().uri(), Joi.object()).allow("").messages({
        'alternatives.match': 'Please provide a valid file or URL'
      })`,
    IPAddress: () =>
      `Joi.string().ip().messages({
        'string.base': 'Must be text',
        'string.empty': 'IP address is required',
        'string.ip': 'Please enter a valid IP address (e.g., 192.168.1.1)'
      })`,
    Enum: () =>
      Array.isArray(field?.enumDefn?.enumValues)
        ? `Joi.string().valid(${formatEnumValues(field.enumDefn.enumValues)}).messages({
            'string.base': 'Must be text',
            'string.empty': 'Please select an option',
            'any.only': 'Please select one of: ${formatEnumLabels(field.enumDefn.enumValues)}'
          })`
        : 'Joi.any()',
    Phone: () =>
      `Joi.string().pattern(/^\\+[1-9]\\d{6,14}$/).messages({
        'string.base': 'Must be text',
        'string.empty': 'Phone number is required',
        'string.pattern.base': 'Please enter a valid phone number in international format (e.g., +14155552671)'
      })`,
    Latitude: () =>
      `Joi.number().min(-90).max(90).precision(8).messages({
        'number.base': 'Must be a number',
        'number.min': 'Latitude must be at least -90',
        'number.max': 'Latitude must be at most 90'
      })`,
    Longitude: () =>
      `Joi.number().min(-180).max(180).precision(8).messages({
        'number.base': 'Must be a number',
        'number.min': 'Longitude must be at least -180',
        'number.max': 'Longitude must be at most 180'
      })`,
    Percentage: () =>
      `Joi.number().min(0).max(100).precision(2).messages({
        'number.base': 'Must be a number',
        'number.min': 'Percentage must be at least 0',
        'number.max': 'Percentage cannot exceed 100'
      })`,
    Slug: () =>
      `Joi.string().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).messages({
        'string.base': 'Must be text',
        'string.empty': 'Slug is required',
        'string.pattern.base': 'Slug must be lowercase letters, numbers, and hyphens only (e.g., my-page-slug)'
      })`,
    Vector: () => {
      const dimension = field.vectorDimension || 1536;
      return `Joi.array()
        .items(Joi.number())
        .length(${dimension})
        .messages({
          'array.length': '${field.name} must have exactly ${dimension} dimensions',
          'array.base': '${field.name} must be an array of numbers',
          'number.base': 'Each element in ${field.name} must be a number'
        })`;
    },
  };

  const { isOptional, dataType, enforceNonNullable, allowEmptyStringAndNull } =
    field;

  const validationString = joiStringMap[dataType]
    ? joiStringMap[dataType]()
    : 'Joi.any()';

  let nullAllowance = '';
  if (!enforceNonNullable) {
    nullAllowance = allowEmptyStringAndNull
      ? `.allow('', null)` // Allow both empty string and null
      : `.allow(null)`; // Allow only null
  }

  const finalValidation = isOptional
    ? `${validationString}${nullAllowance}.optional()`
    : `${validationString}.required()`;

  // // Determine if the field has a default value and adjust based on data type.
  // const hasDefaultValue = !!defaultValue;
  // const isEnumType = dataType === 'Enum';
  // const formattedDefaultValue = isEnumType ? `'${defaultValue}'` : defaultValue;

  // if (hasDefaultValue) {
  //   return `${finalValidation}.default(${formattedDefaultValue})`;
  // }

  return finalValidation;
}

/**
 * Generates a Joi schema string from an array of field definitions.
 *
 * This function iterates over each field definition object in the provided array,
 * converting each field into a Joi validation string based on its data type and other properties.
 * The resulting Joi validation strings are then concatenated, separated by commas and new lines,
 * to form a single schema string that represents the Joi validations for all the fields.
 *
 * @param {Array} fields - An array of objects representing field definitions. Each object should
 * include properties like `name`, `dataType`, and any other properties relevant for validation
 * as expected by the `mapFieldTypeToJoi` function.
 * @returns {String} A string representing the Joi schema for the provided field definitions.
 */
function generateJoiSchemaString(fields) {
  const validations = fields.map((field) => {
    // Map field type to Joi validation using the mapFieldTypeToJoi function
    const validation = mapFieldTypeToJoi(field);
    // Convert Joi validation to string representation
    return `  ${getFormattedFieldName(field?.name, field?.isForeignKey)}: ${validation}`;
  });

  // Join validations with comma and new line for readability
  return validations.join(',\n');
}

/**
 * Processes model schemas by generating Joi validation strings and updating corresponding schema files.
 *
 * This function iterates over each model provided, filters out deleted field definitions,
 * classifies fields into optional and required, generates Joi schema strings for each category,
 * and then updates the model's corresponding schema file with these generated strings.
 *
 * @param {Object} params - The parameters object.
 * @param {Array} params.models - An array of model objects to process.
 * @param {string} params.srcPath - The source path where schema files are located.
 * @param {string} params.folder - The folder within the srcPath where schema files should be updated.
 * @param {Object} params.req - Request object for trace ID context (optional)
 */
const processModelSchemas = withErrorHandling(
  async ({ models, srcPath, folder, req } = {}) => {
    logOperationStart('processModelSchemas', req, {
      modelCount: models?.length || 0,
      srcPath,
      folder,
    });

    // Process each model
    for (const model of models) {
      const camelCasedName = toCamelCase(model?.name);
      const filePath = path.join(
        srcPath,
        folder,
        `${camelCasedName}.schema.core.js`
      );

      // logWithTrace('Processing model schema', req, {
      //   modelName: model?.name,
      //   camelCasedName,
      //   filePath,
      // });

      try {
        // Filter out deleted fields
        const modelFields = filterDeleted(model?.fieldDefns ?? []);

        // Classify fields into optional and required
        const { optionalFields, requiredFields } = classifyFields(modelFields);

        // Generate Joi schema strings
        const baseSchema = generateJoiSchemaString(
          optionalFields.map((field) => ({
            ...field,
            allowEmptyStringAndNull: !NON_NULLABLE_TYPES.includes(
              field?.dataType
            ),
          }))
        );
        const createSchema = generateJoiSchemaString(requiredFields);
        const updateSchema = generateJoiSchemaString(
          requiredFields.map((field) => ({
            ...field,
            isOptional: true,
            enforceNonNullable: true,
          }))
        );

        // Update schema file
        modifyFile(filePath, (fileContent) => {
          fileContent = replaceAllOccurrences(
            fileContent,
            '// BASE_KEY_VALUE_USES',
            baseSchema
          );
          fileContent = replaceAllOccurrences(
            fileContent,
            'CREATE_KEY_VALUE_USES',
            requiredFields?.length ? `{ ${createSchema} }` : ''
          );
          return replaceAllOccurrences(
            fileContent,
            'UPDATE_KEY_VALUE_USES',
            requiredFields?.length ? `{ ${updateSchema} }` : ''
          );
        });

        // Format the file
        await formatFile(filePath, 'babel');

        // logWithTrace('Successfully processed model schema', req, {
        //   modelName: model?.name,
        //   fieldCount: modelFields.length,
        //   requiredFields: requiredFields.length,
        //   optionalFields: optionalFields.length,
        // });
      } catch (error) {
        logOperationError('processModelSchemas', req, error);
        throw createStandardError(
          ERROR_TYPES.INTERNAL,
          `Failed to process schema for model: ${model?.name}`,
          {
            severity: ERROR_SEVERITY.HIGH,
            context: 'model_schema_processing',
            details: {
              modelName: model?.name,
              filePath,
              error: error.message,
            },
          }
        );
      }
    }

    logOperationSuccess('processModelSchemas', req, {
      processedModels: models?.length || 0,
    });
  },
  'model_schema_processing'
);

// Helper function to classify fields
function classifyFields(fields) {
  return fields.reduce(
    (acc, field) => {
      const key = field.isOptional ? 'optionalFields' : 'requiredFields';
      acc[key].push(field);
      return acc;
    },
    { optionalFields: [], requiredFields: [] }
  );
}

module.exports = {
  NON_NULLABLE_TYPES,
  mapFieldTypeToJoi,
  generateJoiSchemaString,
  processModelSchemas,
};
