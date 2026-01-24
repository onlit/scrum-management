const path = require('path');
const { toCamelCase } = require('#utils/shared/stringUtils.js');
const {
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const { consolidateImports, escapeStringForJSX } = require('./commonUtils.js');
const { getFormattedFieldName } = require('#utils/api/commonUtils.js');
const { NON_NULLABLE_TYPES } = require('#utils/api/joiSchemaUtils.js');

const NUMBER_DATA_TYPES = ['Int', 'Float', 'Decimal', 'Latitude', 'Longitude', 'Percentage'];

function formatFieldsForAPIPayload(modelFields, model = null) {
  const customFieldNames = [];
  const customAssignments = [];

  // Skip Vector fields - they're auto-generated via embedding APIs, not user-edited
  modelFields
    .filter(({ dataType }) => dataType !== 'Vector')
    .forEach((field) => {
    const { dataType, isForeignKey, name, isOptional } = field;

    if (isForeignKey) {
      const fieldName = getFormattedFieldName(name, isForeignKey);
      customFieldNames.push(fieldName);
      customAssignments.push(`${fieldName}: ${fieldName}?.id,`);
    } else if (dataType === 'DateTime') {
      customFieldNames.push(name);
      customAssignments.push(
        `${name}: ${name} ? formatToUTCDateTime(moment(${name} as any).toISOString()) : undefined,`
      );
    } else if (dataType === 'Date') {
      customFieldNames.push(name);
      customAssignments.push(
        `${name}: ${name} ? formatToUTCDate(${name}.format()) : undefined,`
      );
    } else if (dataType === 'Upload') {
      customFieldNames.push(name);
      customAssignments.push(
        `${name}: await resolveFileOrUrl(${name} as any, { axios, token: accessToken, uploadUrl: getRoute('drive/getFileURL')() }),`
      );
    } else if (isOptional && NON_NULLABLE_TYPES.includes(dataType)) {
      customFieldNames.push(name);
      customAssignments.push(`${name}: ${name} || null,`);
    }
  });

  // Add workflowId assignment if showAutomataSelector is enabled
  if (model?.showAutomataSelector) {
    customFieldNames.push('workflowId');
    customAssignments.push(`workflowId: workflowId?.id ?? null,`);
  }

  return { customFieldNames, customAssignments };
}

async function createValidationSchemaFile({
  frontend,
  modelName,
  modelFields,
  user,
} = {}) {
  const camelCasedModel = toCamelCase(modelName);
  const imports = [];

  if (
    modelFields.some(
      ({ dataType }) => dataType === 'Date' || dataType === 'DateTime'
    )
  ) {
    imports.push(`import { isValid as isDateValid } from 'date-fns';`);
  }

  // Create the validation schema file using the provided template
  await createFileFromTemplate({
    destinationPathSegments: [
      frontend?.path, // Destination folder
      'src',
      'core',
      'configs',
      'validationSchemas',
      `${camelCasedModel}Schema.ts`, // File name generated from the model name
    ],
    templatePathSegments: [
      frontend?.constructorPath, // Source template path
      'entity-core',
      'core',
      'configs',
      'validationSchema.template.ts',
    ],
    templateReplacements: {
      '// @gen:IMPORTS': consolidateImports(imports).join('\n'),
      '// @gen:FORM_VALIDATION_SCHEMA': generateYupSchemaString(modelFields),
    },
    user, // User information for tracking or personalization purposes
  });
}

async function formatValidationSchemaFile({ frontend, modelName } = {}) {
  const camelCasedModel = toCamelCase(modelName);
  await formatFile(
    path.join(
      frontend?.path,
      'src',
      'core',
      'configs',
      'validationSchemas',
      `${camelCasedModel}Schema.ts`
    )
  );
}

function mapFieldTypeToYup(field) {
  const {
    isOptional,
    dataType,
    minLength,
    maxLength,
    isForeignKey,
    label,
    name,
  } = field;

  // Build min and max length constraints if applicable
  const minLengthConstraint = minLength ? `.min(${minLength})` : '';
  const maxLengthConstraint = maxLength ? `.max(${maxLength})` : '';

  let yupSchema;

  const jsonValidation = `Yup.string().test(
                            'is-valid-json',
                            'Invalid JSON format',
                            (value) => {
                              if (!value) return ${isOptional ? 'true' : 'false'};
                              try {
                                JSON.parse(value);
                                return true;
                              } catch (err) {
                                return false;
                              }
                            }
                          )`;

  const dateValidation = `Yup.string().test('is-valid-date', 'Invalid date', (value) => {
                            if (!value) return ${isOptional ? 'true' : 'false'};
                            return isDateValid(new Date(value));
                          })`;

  // Map data types to corresponding Yup schemas
  switch (dataType) {
    case 'String':
      yupSchema = `Yup.string()${minLengthConstraint}${maxLengthConstraint}`;
      break;
    case 'Email':
      yupSchema = `Yup.string().email()`;
      break;
    case 'Int':
      yupSchema = `Yup.number().min(0).max(2147483647, 'Must be less than or equal to 2147483647').integer('Only integers are allowed.')`;
      break;
    case 'Float':
      yupSchema = `Yup.number().min(0).max(3.40282347e+38, 'Must be less than or equal to 3.40282347e+38')`;
      break;
    case 'Decimal':
      yupSchema = 'Yup.number().min(0)';
      break;
    case 'Boolean':
      yupSchema = 'Yup.boolean()';
      break;
    case 'Json':
      yupSchema = jsonValidation;
      break;
    case 'URL':
      yupSchema = 'Yup.string().url()';
      break;
    case 'Date':
    case 'DateTime':
      yupSchema = dateValidation;
      break;
    case 'Upload':
      yupSchema = `Yup.mixed()
        .test('file-or-string', 'Invalid file', (value) => {
          if (value == null || value === '') return true;
          if (typeof value === 'string') return true;
          if (typeof File !== 'undefined' && value instanceof File) return true;
          return false;
        })`;
      break;
    case 'Phone':
      yupSchema = `Yup.string().matches(/^\\+[1-9]\\d{6,14}$/, 'Please enter a valid phone number in international format (e.g., +14155552671)')`;
      break;
    case 'Latitude':
      yupSchema = `Yup.number().min(-90, 'Latitude must be at least -90').max(90, 'Latitude must be at most 90')`;
      break;
    case 'Longitude':
      yupSchema = `Yup.number().min(-180, 'Longitude must be at least -180').max(180, 'Longitude must be at most 180')`;
      break;
    case 'Percentage':
      yupSchema = `Yup.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage cannot exceed 100')`;
      break;
    case 'Slug':
      yupSchema = `Yup.string().matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only (e.g., my-page-slug)')`;
      break;
    case 'Vector':
      // Vectors are auto-generated via embedding APIs, not manually edited
      // Use array of numbers validation in case value is present
      yupSchema = `Yup.array().of(Yup.number())`;
      break;
    default:
      yupSchema = 'Yup.string()';
  }

  yupSchema = isForeignKey ? 'Yup.mixed()' : yupSchema;

  // Ensure error messages use the human-friendly field label
  const safeLabel = escapeStringForJSX(label ?? name);
  yupSchema += `.label(\`${safeLabel}\`)`;

  // Handle optional or required fields
  yupSchema += isOptional ? '.nullable()' : '.required()';

  // // Apply default value if provided
  // if (
  //   defaultValue !== undefined &&
  //   defaultValue !== null &&
  //   defaultValue !== ''
  // ) {
  //   if (isStringType(dataType) || dataType === 'Enum') {
  //     yupSchema += `.default('${defaultValue}')`;
  //   } else {
  //     yupSchema += `.default(${defaultValue})`;
  //   }
  // }

  return yupSchema;
}

function generateYupSchemaString(fields) {
  // Skip Vector fields - they're auto-generated via embedding APIs, not user-edited
  const validations = fields
    .filter(({ dataType }) => dataType !== 'Vector')
    .map((field) => {
      const validation = mapFieldTypeToYup(field);
      const { name, isForeignKey } = field;
      const fieldName = getFormattedFieldName(name, isForeignKey);
      return `  ${fieldName}: ${validation}`;
    });
  return validations.join(',\n');
}

function generateFormValuesInterface(fields, model = null) {
  const mapFieldType = ({ dataType, isForeignKey }) => {
    if (NUMBER_DATA_TYPES.includes(dataType)) return 'number';
    if (dataType === 'Boolean') return 'boolean';
    if (dataType === 'Date' || dataType === 'DateTime') return 'Moment';
    if (dataType === 'UUID' && isForeignKey) return 'AutocompleteOption';
    if (dataType === 'Upload') return 'File | string';
    return 'string';
  };

  const mapOptionalType = (type, isOptional) =>
    isOptional ? `${type} | null` : type;

  // Skip Vector fields - they're auto-generated via embedding APIs, not user-edited
  const interfaceFields = fields
    .filter(({ dataType }) => dataType !== 'Vector')
    .map(({ dataType, isForeignKey, isOptional, name }) => {
      const optionalOrForeignKey = isOptional || isForeignKey;
      const fieldType = mapFieldType({ dataType, isForeignKey });
      const optionalType = mapOptionalType(fieldType, optionalOrForeignKey);
      const fieldName = getFormattedFieldName(name, isForeignKey);
      return `  ${fieldName}${optionalOrForeignKey ? '?' : ''}: ${optionalType}`;
    });

  // Add workflowId field if showAutomataSelector is enabled
  if (model?.showAutomataSelector) {
    interfaceFields.push(`  workflowId?: AutocompleteOption | null`);
  }

  // Add tags field (reserved field - always included)
  interfaceFields.push(`  tags?: string | null`);

  return interfaceFields.join(';\n');
}

module.exports = {
  NUMBER_DATA_TYPES,
  createValidationSchemaFile,
  formatValidationSchemaFile,
  generateFormValuesInterface,
  formatFieldsForAPIPayload,
};
