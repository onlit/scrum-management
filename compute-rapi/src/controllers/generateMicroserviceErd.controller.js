const path = require('path');
const { readFile } = require('fs/promises');
const { getDMMF } = require('@prisma/internals');
const prisma = require('#configs/prisma.js');
const { generateERDImage } = require('#utils/api/erdUtils.js');
const { createPrismaSchemaFile } = require('#utils/api/prismaUtils.js');
const { getVisibilityFilters } = require('#utils/shared/visibilityUtils.js');
const { filterDeleted } = require('#utils/shared/generalUtils.js');
const { CONSTRUCTORS_PATH } = require('#configs/constants.js');
const { ERROR_TYPES } = require('#configs/constants.js');
const {
  logOperationStart,
  logOperationSuccess,
  logOperationError,
  logDatabaseStart,
  logDatabaseSuccess,
  createErrorWithTrace,
  withTraceLogging,
} = require('#utils/shared/traceUtils.js');

async function generateERD(req, res) {
  const { user, params } = req;
  logOperationStart('generateERD', req, {
    user: user?.id,
    microserviceId: params?.id,
  });
  try {
    logDatabaseStart('get_microservice', req, { microserviceId: params?.id });
    const microservice = await prisma.microservice.findFirst({
      where: {
        id: params?.id,
        ...getVisibilityFilters(user),
      },
      include: {
        enumDefns: {
          include: {
            enumValues: true,
          },
        },
        modelDefns: {
          include: {
            fieldDefns: {
              include: {
                foreignKeyModel: true,
                enumDefn: {
                  include: {
                    enumValues: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    logDatabaseSuccess('get_microservice', req, { found: !!microservice });

    if (!microservice) {
      const error = createErrorWithTrace(
        ERROR_TYPES.NOT_FOUND,
        'Microservice not found',
        req,
        { context: 'generate_erd' }
      );
      logOperationError('generateERD', req, error);
      throw error;
    }

    // Destructure and filter relevant microservice details
    const { modelDefns, enumDefns } = microservice;
    const models = filterDeleted(modelDefns); // Remove deleted model definitions
    const enums = filterDeleted(enumDefns); // Remove deleted enum definitions

    const tempDir = path.join('/tmp');
    const schemaTempDirName = `${Date.now()}-schema`;

    // Creating schema.prisma
    logOperationStart('create_prisma_schema_file', req, {
      tempDir,
      schemaTempDirName,
    });
    await createPrismaSchemaFile({
      restAPI: {
        path: tempDir,
        constructorPath: path.join(CONSTRUCTORS_PATH, 'api'),
      },
      user,
      enums,
      models,
      newFileFolder: schemaTempDirName,
      microserviceId: microservice?.id,
    });
    logOperationSuccess('create_prisma_schema_file', req);

    const schemaPath = path.join(tempDir, schemaTempDirName, 'schema.prisma');
    logDatabaseStart('read_schema_file', req, { schemaPath });
    const data = await readFile(schemaPath, 'utf-8');
    logDatabaseSuccess('read_schema_file', req);

    logDatabaseStart('get_dmmf', req);
    const dmmf = await getDMMF({ datamodel: data });
    logDatabaseSuccess('get_dmmf', req);

    const client = user?.client?.id;
    const createdBy = user?.id;

    logOperationStart('generate_erd_image', req);
    const fileURL = await generateERDImage({
      dmmf: dmmf.datamodel,
      client,
      createdBy,
    });
    logOperationSuccess('generate_erd_image', req, { fileURL });

    logDatabaseStart('update_microservice_erd_url', req, {
      microserviceId: params?.id,
    });
    await prisma.microservice.update({
      where: { id: params?.id },
      data: {
        erdUrl: fileURL,
      },
    });
    logDatabaseSuccess('update_microservice_erd_url', req);

    logOperationSuccess('generateERD', req, { url: fileURL });
    res.status(200).json({ url: fileURL });
  } catch (error) {
    logOperationError('generateERD', req, error);
    throw error.type && Object.values(ERROR_TYPES).includes(error.type)
      ? error
      : createErrorWithTrace(ERROR_TYPES.INTERNAL, error.message, req, {
          context: 'generate_erd',
          originalError: error,
        });
  }
}

module.exports = {
  generateERD: withTraceLogging(generateERD, 'generateERD'),
};
