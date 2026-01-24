const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const { getFilesURL } = require('#configs/routes.js');
const {
  createStandardError,
  withErrorHandling,
} = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES, ERROR_SEVERITY } = require('#configs/constants.js');
const {
  logWithTrace,
  logOperationStart,
  logOperationSuccess,
  logOperationError,
} = require('#utils/shared/traceUtils.js');

const generateERDImage = withErrorHandling(
  async ({ dmmf, client, createdBy, req } = {}) => {
    logOperationStart('generateERDImage', req, {
      modelCount: dmmf?.models?.length || 0,
      client,
    });

    const diagram = 'erDiagram';

    const classes = dmmf.models
      .map(
        (model) =>
          `  ${model.name} {
${model.fields
  .filter(
    (field) =>
      field.kind !== 'object' &&
      !model.fields.find(
        ({ relationFromFields }) =>
          relationFromFields && relationFromFields.includes(field.name)
      )
  )
  .map((field) => `    ${field.type} ${field.name}`)
  .join('\n')}  
  }
`
      )
      .join('\n\n');

    let relationShips = '';

    for (const model of dmmf.models) {
      for (const field of model.fields) {
        if (field.relationFromFields && field.relationFromFields.length > 0) {
          const relationshipName = field.name;
          const thisSide = model.name;
          const otherSide = field.type;

          let otherSideMultiplicity = '||';

          if (field.isList) {
            otherSideMultiplicity = '}o';
          } else if (!field.isRequired) {
            otherSideMultiplicity = '|o';
          }

          const otherModel = dmmf.models.find(
            (model) => model.name === otherSide
          );

          const otherField = otherModel?.fields.find(
            ({ relationName }) => relationName === field.relationName
          );

          let thisSideMultiplicity = '||';

          if (otherField?.isList) {
            thisSideMultiplicity = 'o{';
          } else if (!otherField?.isRequired) {
            thisSideMultiplicity = 'o|';
          }

          relationShips += `    ${thisSide} ${thisSideMultiplicity}--${otherSideMultiplicity} ${otherSide} : "${relationshipName}"\n`;
        }
      }
    }

    const mermaidDiagram = `${diagram}\n${classes}\n${relationShips}`;

    const tempDir = path.join('/tmp');

    const tempFileName = `${Date.now()}-erd.mmd`;

    // Create a temporary file for the Mermaid diagram
    const tempFilePath = path.join(tempDir, tempFileName);
    fs.writeFileSync(tempFilePath, mermaidDiagram);

    const tempImageName = `${Date.now()}-erd-output.png`;

    // Define the output file path
    const outputFilePath = path.join(tempDir, tempImageName);

    const puppeteerConfigFile = path.join(
      __dirname,
      '..',
      '..',
      'puppeteer-config.json'
    );

    logWithTrace('Starting Mermaid CLI conversion', req, {
      tempFilePath,
      outputFilePath,
    });

    try {
      // Execute the mermaid CLI to generate the image
      const child = spawn('yarn', ['convert-mermaid'], {
        env: {
          ...process.env,
          ERD_INPUT_FILE: path.resolve(tempFilePath),
          ERD_OUTPUT_FILE: path.resolve(outputFilePath),
          PUPPETEER_CONFIG_FILE: path.resolve(puppeteerConfigFile),
        },
        cwd: process.cwd(),
      });

      child.on('error', (err) => {
        throw err;
      });

      await new Promise((resolve, reject) => {
        child.on('close', (code) =>
          code === 0 ? resolve() : reject(new Error(`Exited with code ${code}`))
        );
      });
    } catch (error) {
      logOperationError('generateERDImage', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to generate ERD image',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'mermaid_cli_conversion',
          details: {
            error: error?.stderr ?? error?.message,
            tempFilePath,
            outputFilePath,
          },
        }
      );
    }

    let imageUrl;

    logWithTrace('Uploading ERD image to file service', req, {
      outputFilePath,
    });

    try {
      const formData = new FormData();
      formData.append('anonymous_can_see_it', 'true');
      formData.append('created_by', createdBy);
      formData.append('client', client);
      formData.append('file', fs.createReadStream(outputFilePath));

      const { data } = await axios.post(getFilesURL(), formData);

      imageUrl = data?.fileUrl;
    } catch (error) {
      logOperationError('generateERDImage', req, error);
      throw createStandardError(
        ERROR_TYPES.INTERNAL,
        'Failed to upload ERD image',
        {
          severity: ERROR_SEVERITY.HIGH,
          context: 'erd_image_upload',
          details: {
            error: error?.response?.data ?? error?.message,
            outputFilePath,
          },
        }
      );
    }

    logOperationSuccess('generateERDImage', req, {
      imageUrl,
    });

    return imageUrl;
  },
  'erd_image_generation'
);

module.exports = { generateERDImage };
