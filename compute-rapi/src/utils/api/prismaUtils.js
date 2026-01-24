const path = require('path');
const { mkdir } = require('fs').promises;
const { runCommand } = require('#utils/shared/shellUtils.js');
const {
  toStartCaseNoSpaces,
  formatAsMultilineComments,
  toCamelCase,
  replaceAllOccurrences,
} = require('#utils/shared/stringUtils.js');
const {
  addCreatorMeta,
  copyFile,
  modifyFile,
} = require('#utils/shared/fileUtils.js');
const { withErrorHandling } = require('#utils/shared/errorHandlingUtils.js');

const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');

// Debug helpers for tracing risky field descriptions that could break Prisma formatting
function shouldDebugFieldComment(raw, sanitized) {
  if (!sanitized) return false;
  const text = String(raw ?? '');
  const hadLineBreaks = /[\n\r\v\f\u0085\u2028\u2029]/.test(text);
  const hasQuotes = /['"“”‘’]/.test(text);
  const tooLong = sanitized.length > 140;
  return hadLineBreaks || hasQuotes || tooLong;
}

function logFieldCommentDebug({ modelName = null, fieldName, raw, sanitized }) {
  try {
    const payload = {
      fieldName,
      sanitizedPreview: String(sanitized).slice(0, 200),
    };
    if (modelName) payload.modelName = modelName;
    if (raw) payload.rawPreview = String(raw).slice(0, 200);
    logWithTrace('prisma_field_comment_debug', null, payload);
  } catch (_) {
    // no-op if logging fails
  }
}

/**
 * Generates a string for common fields shared by all models in a Prisma schema.
 * These fields include visibility flags, timestamps, and identification fields.
 *
 * @returns {string} Common fields in Prisma schema syntax.
 */
function generateCommonPrismaFields() {
  // Defines common model attributes for visibility, ownership, and timestamps
  return `  color                 String?              @db.VarChar(40)
  tags                  String?      // Optional tags for easier categorization or search.
  everyoneCanSeeIt                Boolean      @default(false) // Visibility control.
  anonymousCanSeeIt               Boolean      @default(false) // Visibility control for anonymous users.
  everyoneInObjectCompanyCanSeeIt Boolean      @default(true) // Company-wide visibility.
  onlyTheseRolesCanSeeIt          Json?        // Specific roles with visibility access.
  onlyTheseUsersCanSeeIt          Json?        // Specific users with visibility access.
  client                          String       @db.Uuid() // Identifier for the client associated.
  createdBy                       String       @db.Uuid() // User ID of the creator.
  updatedBy                       String       @db.Uuid() // User ID of the last updater.
  createdAt                       DateTime     @default(now()) // Creation timestamp.
  updatedAt                       DateTime     @updatedAt // Last update timestamp.
  deleted                         DateTime?    // Deletion timestamp, if deleted.
  workflowId                      String?      @db.Uuid()
  workflowInstanceId                String?    @db.Uuid()
  isSystemTemplate                Boolean      @default(false)\n`;
}

const processPrismaModels = withErrorHandling(
  async ({ enums, models, srcPath, folder, microserviceId, req } = {}) => {
    logOperationStart('processPrismaModels', req, {
      modelCount: models?.length || 0,
      enumCount: enums?.length || 0,
      microserviceId,
    });

    const filePath = path.join(srcPath, folder, 'schema.prisma');
    const enumString = generatePrismaEnumString(enums);
    const sortedModels = [...models].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0)
    );
    const modelString = generatePrismaModelString(sortedModels, microserviceId);

    modifyFile(filePath, (fileContent) => {
      fileContent = replaceAllOccurrences(
        fileContent,
        '// ENUM_USES',
        enumString
      );
      return replaceAllOccurrences(fileContent, '// MODEL_USES', modelString);
    });

    logOperationSuccess('processPrismaModels', req, {
      filePath,
      processedModels: models?.length || 0,
    });
  },
  'prisma_model_processing'
);

/**
 * Extracts a concise, single-line description to attach as an inline comment
 * for a field. Falls back across common metadata properties if needed.
 */
function getFieldInlineComment(field) {
  const raw = field?.description ?? '';
  if (!raw) return '';
  let text = String(raw);
  // Replace explicit Unicode line separators with spaces
  text = text.replace(/[\u2028\u2029]+/g, ' ');
  // Replace all control characters (C0/C1) with spaces (includes newlines & odd separators)
  let cleaned = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    cleaned += code <= 31 || (code >= 127 && code <= 159) ? ' ' : text[i];
  }
  // Collapse any remaining whitespace runs to a single space
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Generates Prisma schema models as strings from model definitions,
 * improving readability for foreign key relations and indexes.
 *
 * @param {Array} models - Array of model definitions to convert.
 * @param {String} microserviceId - Id of the microservice that is being generated
 * @returns {string} Prisma schema as a string.
 */
function generatePrismaModelString(models, microserviceId) {
  // Define a list of common fields to be indexed in every model.
  const commonFieldsToIndex = [
    'everyoneCanSeeIt',
    'anonymousCanSeeIt',
    'everyoneInObjectCompanyCanSeeIt',
    'onlyTheseRolesCanSeeIt',
    'onlyTheseUsersCanSeeIt',
    'client',
    'createdBy',
    'isSystemTemplate',
    'deleted',
    'createdAt',
    'updatedAt',
  ];

  // Object to keep track of relationships between models.
  const modelRelations = {};
  // Array to store generated model strings.
  const modelStrings = [];

  // Iterate over each model to extract foreign key information.
  for (const model of models) {
    const modelName = toStartCaseNoSpaces(model?.name);
    // Filter the model fields to get only foreign keys.
    const foreignKeyFields = model.fieldDefns.filter(
      ({ isForeignKey, foreignKeyModel }) =>
        isForeignKey && foreignKeyModel?.microserviceId === microserviceId
    );

    // Loop through each foreign key field to collect relation details.
    for (const field of foreignKeyFields) {
      const { name, foreignKeyModel } = field;
      const fieldName = toCamelCase(name); // Convert the field name to camel case.
      const scalarFieldName = createForeignKeyScalarFieldName(fieldName); // Create a scalar field name for the foreign key.
      const fkModelName = toStartCaseNoSpaces(foreignKeyModel?.name); // Get the related model name in start case.
      const relationName = createPrismaRelationName(
        model,
        foreignKeyModel,
        scalarFieldName
      ); // Generate a unique relation name.

      // Initialize the relations array for the related model if it doesn't exist.
      if (!modelRelations[fkModelName]) {
        modelRelations[fkModelName] = [];
      }

      const relationFieldName = createPrismaRelationFieldName(
        foreignKeyModel,
        model,
        fieldName
      );

      const relationDetails = {
        fieldName: relationFieldName,
        modelName,
        relationName,
      };

      // Add the relation details to the modelRelations object.
      modelRelations[fkModelName].push(relationDetails);
    }
  }

  // Iterate over each model to generate the Prisma schema string.
  for (const model of models) {
    // Convert the model name to camel case.
    const modelName = toStartCaseNoSpaces(model?.name);
    const modelNameCamelCased = toCamelCase(modelName);
    // Format the model description as multiline comments if it exists.
    const modelDescriptionFormatted = `${formatAsMultilineComments(model?.description)}\n`;
    const defaultModelDescription = `/// Represents a ${modelNameCamelCased}, including its metadata.\n`;

    // Define the base model structure with an id field.
    const baseModelTemplate = `model ${modelName} {\nid String @id @default(uuid()) @db.Uuid()\n`;

    // Use either the formatted model description or the default one.
    let modelDescriptionTemplate = defaultModelDescription;
    if (model?.description) {
      modelDescriptionTemplate = modelDescriptionFormatted;
    }

    // Start building the model string.
    let modelStr = `${modelDescriptionTemplate}${baseModelTemplate}`;

    // Create a list of fields that should be indexed, including common fields.
    const fieldsToIndex = [...commonFieldsToIndex];

    // Iterate over each field definition in the model.
    for (const field of model?.fieldDefns) {
      const { isIndex, isForeignKey, foreignKeyModel } = field;
      const fieldName = toCamelCase(field?.name); // Convert field name to camel case.
      const scalarFieldName = createForeignKeyScalarFieldName(fieldName); // Create a scalar name for foreign key fields.

      if (isForeignKey) {
        const optionalSuffix = field.isOptional ? '?' : ''; // Check if the field is optional.
        // Add the scalar field representing the foreign key.
        {
          const rawDesc = String(field?.description ?? '');
          const inlineComment = getFieldInlineComment(field);
          if (shouldDebugFieldComment(rawDesc, inlineComment)) {
            logFieldCommentDebug({
              modelName,
              fieldName: scalarFieldName,
              raw: rawDesc,
              sanitized: inlineComment,
            });
          }
          modelStr += `${inlineComment ? `  /// ${inlineComment}\n` : ''}${scalarFieldName}   String${optionalSuffix}   @db.Uuid()\n`;
        }

        if (foreignKeyModel?.microserviceId === microserviceId) {
          // Get the related model name in start case.
          const fkModelName = toStartCaseNoSpaces(foreignKeyModel?.name);
          // Generate the relation name.
          const relationName = createPrismaRelationName(
            model,
            foreignKeyModel,
            scalarFieldName
          );

          // Add the relation field linking to the related model.
          {
            const rawDesc = String(field?.description ?? '');
            const inlineComment = getFieldInlineComment(field);
            if (shouldDebugFieldComment(rawDesc, inlineComment)) {
              logFieldCommentDebug({
                modelName,
                fieldName,
                raw: rawDesc,
                sanitized: inlineComment,
              });
            }
            modelStr += `${inlineComment ? `  /// ${inlineComment}\n` : ''}${fieldName}   ${fkModelName}${optionalSuffix}   @relation("${relationName}", fields: [${scalarFieldName}], references: [id])\n`;
          }
        }
      } else {
        // If it's not a foreign key, map the field to its corresponding Prisma type.
        const rawDesc = String(field?.description ?? '');
        const inlineComment = getFieldInlineComment(field);
        if (shouldDebugFieldComment(rawDesc, inlineComment)) {
          logFieldCommentDebug({
            modelName,
            fieldName,
            raw: rawDesc,
            sanitized: inlineComment,
          });
        }
        modelStr += mapFieldTypeToPrisma(field);
      }

      // If the field is marked as indexed, add it to the fieldsToIndex list.
      if (isIndex) {
        fieldsToIndex.push(isForeignKey ? scalarFieldName : fieldName);
      }
    }

    // Add relation fields from modelRelations for the current model if available.
    if (modelRelations[modelName]) {
      for (const relation of modelRelations[modelName]) {
        modelStr += `  ${relation.fieldName}  ${relation.modelName}[] @relation("${relation.relationName}")\n`;
      }
    }

    // Add common model fields such as createdAt, updatedAt, etc.
    modelStr += generateCommonPrismaFields();

    // If there are fields to index, add the index annotation.
    if (fieldsToIndex?.length) {
      modelStr += `\n  @@index([${fieldsToIndex.join(', ')}])\n`;
    }

    // Close the model definition with a closing curly brace.
    modelStr += '}\n';

    // Add the generated model string to the list of models.
    modelStrings.push(modelStr);
  }

  // Join all the model strings into a single Prisma schema string.
  return modelStrings.join('\n');
}

/**
 * Generates Prisma schema model strings using only the fields from model definitions.
 * This excludes the implicit id field, common fields, and any @@index declarations.
 * Reverse relation arrays are also excluded to ensure output reflects only defined fields.
 *
 * @param {Array} models - Array of model definitions to convert.
 * @param {String} microserviceId - Id of the microservice that is being generated
 * @returns {string} Prisma schema as a string with only defined fields.
 */
function generatePrismaModelFieldsOnlyString(models, microserviceId) {
  const modelStrings = [];

  for (const model of models) {
    const modelName = toStartCaseNoSpaces(model?.name);
    const modelNameCamelCased = toCamelCase(modelName);
    const modelDescriptionFormatted = `${formatAsMultilineComments(model?.description)}\n`;
    const defaultModelDescription = `/// Represents a ${modelNameCamelCased}, including its metadata.\n`;

    let modelStr = `${model?.description ? modelDescriptionFormatted : defaultModelDescription}model ${modelName} {\n`;

    for (const field of model?.fieldDefns) {
      const { isForeignKey, foreignKeyModel } = field;

      if (isForeignKey) {
        const fieldName = toCamelCase(field?.name);
        const scalarFieldName = createForeignKeyScalarFieldName(fieldName);
        const optionalSuffix = field.isOptional ? '?' : '';
        const inlineComment = getFieldInlineComment(field);

        // Scalar FK field
        // Scalar FK field
        modelStr += `${inlineComment ? `  /// ${inlineComment}\n` : ''}${scalarFieldName}   String${optionalSuffix}   @db.Uuid()\n`;

        // Relation field only for internal (same microservice) FKs
        if (foreignKeyModel?.microserviceId === microserviceId) {
          const fkModelName = toStartCaseNoSpaces(foreignKeyModel?.name);
          const relationName = createPrismaRelationName(
            model,
            foreignKeyModel,
            scalarFieldName
          );
          modelStr += `${inlineComment ? `  /// ${inlineComment}\n` : ''}${fieldName}   ${fkModelName}${optionalSuffix}   @relation("${relationName}", fields: [${scalarFieldName}], references: [id])\n`;
        }
      } else {
        const rawDesc = String(field?.description ?? '');
        const inlineComment = getFieldInlineComment(field);
        if (shouldDebugFieldComment(rawDesc, inlineComment)) {
          logFieldCommentDebug({
            modelName,
            fieldName: toCamelCase(field?.name),
            raw: rawDesc,
            sanitized: inlineComment,
          });
        }
        modelStr += mapFieldTypeToPrisma(field);
      }
    }

    modelStr += '}\n';
    modelStrings.push(modelStr);
  }

  return modelStrings.join('\n');
}

/**
 * Generates Prisma schema strings for enum definitions.
 *
 * This function takes an array of enum objects, each containing a name and an array of enumValues.
 * It converts each enum object into a Prisma schema enum type definition string, applying a naming
 * convention to the enum name and including all its values. The enum name is transformed to StartCase
 * without spaces, and each value is listed within the enum's body in the schema.
 *
 * @param {Array} enums - An array of objects representing enum definitions. Each object should have
 *                        a `name` property and an `enumValues` property, which is an array of objects
 *                        each with a `value` property.
 * @returns {string} A string containing all the enum definitions in Prisma schema syntax, separated
 *                   by newlines.
 */
function generatePrismaEnumString(enums) {
  // Iterate over each enum definition in the input array to generate its Prisma schema string
  return enums
    .map((row) => {
      // Initialize the enum string with the enum type name, formatted to StartCase without spaces
      let enumStr = `enum ${toStartCaseNoSpaces(row?.name)} {\n`;

      // Append each enum value to the enum string
      row?.enumValues?.forEach(({ value }) => {
        enumStr += `  ${value}\n`; // Indent each value for readability
      });

      enumStr += '}\n'; // Close the enum definition
      return enumStr; // Return the complete enum definition string
    })
    .join('\n'); // Join all enum definition strings with newlines in between
}

/**
 * Formats the default value according to its Prisma schema data type.
 * Strings are quoted, while other data types are returned as is.
 *
 * @param {Object} params - Parameters including dataType and defaultValue.
 * @param {string} params.dataType - The data type of the field.
 * @param {string|number|boolean} params.defaultValue - The default value of the field.
 * @returns {string} Formatted default value for inclusion in a Prisma schema.
 */
function formatDefaultValue({ dataType, defaultValue } = {}) {
  const stringDataTypes = [
    'String',
    'UUID',
    'Date',
    'DateTime',
    'URL',
    'IPAddress',
  ];

  // Check if the dataType is String to add quotes around the defaultValue
  return stringDataTypes.includes(dataType)
    ? ` @default("${defaultValue}")` // Quote strings
    : ` @default(${defaultValue})`; // Return other types as is
}

/**
 * Maps a field definition to its corresponding Prisma schema declaration.
 * This includes handling data types, optionality, uniqueness, and default values.
 *
 * @param {Object} field - The field definition from a model.
 * @returns {string} The field's Prisma schema declaration.
 */
function mapFieldTypeToPrisma(field) {
  // Handle Vector type specially - uses Unsupported with pgvector syntax
  if (field.dataType === 'Vector') {
    const dimension = field.vectorDimension || 1536;
    const optionalSuffix = field.isOptional ? '?' : '';
    const inlineComment = getFieldInlineComment(field);
    const doc = inlineComment ? `  /// ${inlineComment}\n` : '';
    return `${doc}  ${field?.name} Unsupported("vector(${dimension})")${optionalSuffix}\n`;
  }

  // Mapping from internal data type to Prisma's schema data types
  const typeMapping = {
    String: 'String',
    Int: 'Int',
    Boolean: 'Boolean',
    Json: 'Json',
    DateTime: 'DateTime',
    Date: 'DateTime',
    UUID: 'String',
    Float: 'Float',
    Decimal: 'Decimal',
    URL: 'String',
    IPAddress: 'String',
    Enum: toStartCaseNoSpaces(field?.enumDefn?.name ?? ''), // Convert enum name to StartCase without spaces
    Phone: 'String',
    Latitude: 'Float',
    Longitude: 'Float',
    Percentage: 'Float',
    Slug: 'String',
  };

  const isTypeUUID = field.dataType === 'UUID';
  const isTypeString = field.dataType === 'String';
  const isTypeDate = field.dataType === 'Date';

  const maxLengthLessThan255 = field.maxLength > 0 && field.maxLength < 255;
  let prismaType = typeMapping[field.dataType] ?? 'String'; // Default to String if type is not found
  prismaType += field.isOptional ? '?' : ''; // Append '?' for optional fields
  prismaType += isTypeUUID ? ' @db.Uuid()' : ''; // Add database type hint for UUID
  prismaType += isTypeDate ? ' @db.Date' : ''; // Add database type hint for UUID
  prismaType +=
    isTypeString && maxLengthLessThan255
      ? ` @db.VarChar(${field.maxLength})`
      : ''; // Add database type hint for UUID
  prismaType += field.defaultValue ? formatDefaultValue(field) : ''; // Format default value if present

  const inlineComment = getFieldInlineComment(field);
  const doc = inlineComment ? `  /// ${inlineComment}\n` : '';
  return `${doc}  ${field?.name} ${prismaType}\n`;
}

function createPrismaRelationName(sourceModel, targetModel, scalarFieldName) {
  const sourceModelName = toStartCaseNoSpaces(sourceModel?.name);
  const targetModelName = toStartCaseNoSpaces(targetModel?.name);
  return `${sourceModelName}${targetModelName}${toStartCaseNoSpaces(scalarFieldName)}`;
}

function createPrismaRelationFieldName(targetModel, sourceModel, fieldName) {
  return toCamelCase(
    `${targetModel?.name}${sourceModel?.name}${toStartCaseNoSpaces(fieldName)}`
  );
}

function createForeignKeyScalarFieldName(fieldName) {
  return `${fieldName}Id`;
}

function generateMigrationName(prefix = 'migration') {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-T:.Z]/g, '')
    .slice(0, 14);
  return `${timestamp}_${prefix}`;
}

/**
 * Formats a Prisma schema file using Prisma's built-in formatter.
 *
 * @param {string} schemaPath - The path to the Prisma schema file to format
 * @param {Object} req - Request object for trace ID context (optional)
 */
const formatPrismaSchema = withErrorHandling(async (schemaPath, req = null) => {
  logWithTrace('Formatting Prisma schema', req, { schemaPath });

  try {
    await runCommand('npx', ['prisma', 'format', '--schema', schemaPath]);
    logWithTrace('Successfully formatted Prisma schema', req, { schemaPath });
  } catch (error) {
    logOperationError('formatPrismaSchema', req, error);
    logWithTrace('Could not format Prisma schema', req, {
      schemaPath,
      error: error.message,
    });
    // Don't throw error to avoid breaking the generation process
  }
}, 'prisma_schema_formatting');

const createPrismaSchemaFile = withErrorHandling(
  async ({
    restAPI,
    user,
    enums,
    models,
    constructorFolder = 'prisma',
    newFileFolder = 'prisma',
    microserviceId,
    req,
  } = {}) => {
    logOperationStart('createPrismaSchemaFile', req, {
      modelCount: models?.length || 0,
      enumCount: enums?.length || 0,
      microserviceId,
    });

    await mkdir(path.join(restAPI?.path, newFileFolder), { recursive: true });

    const originPath = path.join(
      restAPI?.constructorPath,
      constructorFolder,
      'schema.template.prisma'
    );
    const newPath = path.join(restAPI?.path, newFileFolder, 'schema.prisma');

    await copyFile(originPath, newPath);

    addCreatorMeta({ path: newPath, user });

    await processPrismaModels({
      enums,
      models,
      srcPath: restAPI?.path,
      folder: newFileFolder,
      microserviceId,
      req,
    });

    // Format the generated Prisma schema file using Prisma's built-in formatter
    await formatPrismaSchema(newPath, req);

    logOperationSuccess('createPrismaSchemaFile', req, {
      newPath,
      processedModels: models?.length || 0,
    });
  },
  'prisma_schema_file_creation'
);

module.exports = {
  processPrismaModels,
  generatePrismaModelString,
  generatePrismaEnumString,
  formatDefaultValue,
  mapFieldTypeToPrisma,
  createPrismaRelationName,
  createPrismaRelationFieldName,
  createForeignKeyScalarFieldName,
  generateMigrationName,
  formatPrismaSchema,
  createPrismaSchemaFile,
  generatePrismaModelFieldsOnlyString,
};
