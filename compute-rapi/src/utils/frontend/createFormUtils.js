const path = require('path');
const {
  toStartCaseNoSpaces,
  convertToSlug,
  toCamelCase,
} = require('#utils/shared/stringUtils.js');
const {
  getFormattedFieldName,
  getDisplayValueField,
  determineDateFormatFunction,
  DISPLAY_VALUE_PROP,
} = require('#utils/api/commonUtils.js');
const {
  consolidateImports,
  addForeignKeyToMicroserviceMap,
  processDateAndDateTimeImports,
  sortModelFields,
  escapeStringForJSX,
  resolveDependencyFilterKey,
} = require('#utils/frontend/commonUtils.js');
const {
  ensureDirExists,
  createFileFromTemplate,
  formatFile,
} = require('#utils/shared/fileUtils.js');
const {
  NUMBER_DATA_TYPES,
  generateFormValuesInterface,
  formatFieldsForAPIPayload,
} = require('#utils/frontend/validationSchemaUtils.js');
const {
  isStringType,
  isExternalForeignKey,
  isInternalForeignKey,
  isIntType,
} = require('#utils/api/fieldTypeValidationUtils.js');
const { createStandardError } = require('#utils/shared/errorHandlingUtils.js');
const { ERROR_TYPES } = require('#configs/constants.js');
const { logWithTrace } = require('#utils/shared/traceUtils.js');
const {
  getDependencyRulesForModel,
} = require('#utils/shared/dependencyRulesUtils.js');

function transformDependencyRulesForFrontend(dependencyRules = []) {
  return dependencyRules.map((rule) => ({
    id: rule.id,
    targetFieldId: rule.targetFieldId,
    targetFieldName: rule.targetField?.name,
    action: rule.action,
    logicOperator: rule.logicOperator,
    priority: rule.priority,
    description: rule.description,
    conditions: (rule.conditions || []).map((condition) => ({
      id: condition.id,
      sourceFieldId: condition.sourceFieldId,
      sourceFieldName: condition.sourceField?.name,
      operator: condition.operator,
      compareValue: condition.compareValue,
    })),
  }));
}

function generateFormFieldImports(
  fieldTypes,
  { includeInterfaceTypes = true } = {}
) {
  const imports = new Set();

  fieldTypes.forEach((type) => {
    switch (type) {
      case 'String':
      case 'URL':
      case 'IPAddress':
      case 'UUID':
      case 'Int':
      case 'Float':
      case 'Decimal':
      case 'Email':
      case 'Json':
      case 'Phone':
      case 'Slug':
      case 'Latitude':
      case 'Longitude':
      case 'Percentage':
        imports.add(
          `import FormikTextField from '@ps/shared-core/ui/Inputs/TextField/FormikTextField';`
        );
        break;
      case 'Upload':
        imports.add(
          `import FormikUploadField from '@ps/shared-core/ui/Inputs/UploadField/FormikUploadField';`
        );
        imports.add(
          `import { resolveFileOrUrl } from '@ps/shared-core/ui/shared/FormUpload';`
        );
        break;
      case 'Boolean':
        imports.add(
          `import FormikCheckboxField from '@ps/shared-core/ui/Inputs/CheckboxField/FormikCheckboxField';`
        );
        break;
      case 'Enum':
        imports.add(
          `import FormikSelectField from '@ps/shared-core/ui/Inputs/SelectField/FormikSelectField';`
        );
        break;
      case 'Date':
        imports.add(
          `import FormikDatePickerField from '@ps/shared-core/ui/Inputs/DatePickerField/FormikDatePickerField';`
        );
        break;
      case 'DateTime':
        imports.add(
          `import FormikDateTimePickerField from '@ps/shared-core/ui/Inputs/DateTimePickerField/FormikDateTimePickerField';`
        );
        break;
      case 'ForeignKey':
        imports.add(
          `import FormikAutocompleteField from '@ps/shared-core/ui/Inputs/AutocompleteField/FormikAutocompleteField';`
        );
        imports.add(
          `import CreatableDropdownWrapper from '@ps/shared-core/ui/CreatableDropdownWrapper';`
        );
        // AutocompleteOption is only needed for interface type definitions
        if (includeInterfaceTypes) {
          imports.add(
            `import { AutocompleteOption } from '@ps/shared-core/ui/Inputs/AutocompleteField/AutocompleteField';`
          );
        }
        break;
      default:
    }
  });

  return Array.from(imports);
}

function generateFormFields(model, fields, options = {}, models = null) {
  let formFields = '';

  const renderers = {
    Boolean: (field, options) => renderCheckboxField(field, options),
    Enum: (field, options) => renderSelectField(field, options),
    Date: (field, options) => renderDateField(field, options),
    DateTime: (field, options) => renderDateTimeField(field, options),
    Upload: (field, options) => renderUploadField(field, options),
  };

  // Filter out fields where showInCreateForm is explicitly false (defaults to true)
  const visibleFields = fields.filter(
    (field) => field.showInCreateForm !== false
  );

  // Sort fields by their 'order' property in ascending order
  const sortedFields = visibleFields.sort(sortModelFields);

  // Ensure dependency context (all fields) is available in options for FK renderers
  const optionsWithAllFields = {
    ...options,
    ForeignKey: { ...(options?.ForeignKey || {}), allFields: fields },
    ExternalForeignKey: {
      ...(options?.ExternalForeignKey || {}),
      allFields: fields,
    },
  };

  for (const field of sortedFields) {
    const fieldType = field?.dataType;

    // Skip Vector fields - they're auto-generated via embedding APIs
    if (fieldType === 'Vector') {
      continue;
    }

    if (isInternalForeignKey(field)) {
      formFields += renderInternalForeignKeyField(
        field,
        model,
        optionsWithAllFields?.ForeignKey,
        null,
        models
      );
    } else if (isExternalForeignKey(field)) {
      formFields += renderExternalForeignKeyField(
        field,
        model,
        optionsWithAllFields?.ExternalForeignKey
      );
    } else if (isStringType(fieldType) || isIntType(fieldType)) {
      formFields += renderTextField(field, options?.Text);
    } else {
      const renderer = renderers?.[fieldType];

      if (renderer) {
        formFields += renderer(field, options?.[fieldType]);
      }
    }
  }

  // Add workflowId autocomplete field if showAutomataSelector is enabled
  if (model?.showAutomataSelector) {
    const gridCol = options?.ForeignKey?.gridCol ?? 6;
    formFields += `
    <Grid size={${gridCol}}>
      <FormikAutocompleteField
        name='workflowId'
        label='Automata Workflow'
        requestKey={['${model?.name}-workflowId', 'WorkflowDefn-dropdown']}
        fetchUrl={getRoute('automata/getWorkflowsURL')}
        renderRow={(row) => ({
          id: row?.id,
          label: row?.name ?? row?.${DISPLAY_VALUE_PROP} ?? '',
        })}
        helpfulHint='Select a workflow to associate with this record'
      />
    </Grid>`;
  }

  // Add tags field for all models (reserved field)
  const tagsGridCol = options?.ForeignKey?.gridCol ?? 6;
  formFields += `
    <Grid size={${tagsGridCol}}>
      <FormikTextField
        size='small'
        fullWidth
        name='tags'
        label='Tags'
        helpfulHint='Optional tags for categorization or search (comma-separated)'
      />
    </Grid>`;

  return formFields;
}

function generateFormikInitialValues(fields, defaultValues = {}, model = null) {
  // Skip Vector fields - they're auto-generated via embedding APIs, not user-edited
  const values = fields
    .filter(({ dataType }) => dataType !== 'Vector')
    .map(({ dataType, isForeignKey, name }) => {
      let value = defaultValues?.[name] ? defaultValues[name] : `''`;

      if (defaultValues?.[name] === undefined) {
        if (NUMBER_DATA_TYPES.includes(dataType)) {
          value = 0;
        } else if (isForeignKey) {
          value = 'undefined';
        } else if (dataType === 'Boolean') {
          value = false;
        } else if (dataType === 'Date' || dataType === 'DateTime') {
          value = 'moment()';
        }
      }

      const fieldName = getFormattedFieldName(name, isForeignKey);
      return `  ${fieldName}: ${value}`;
    });

  // Add workflowId initial value if showAutomataSelector is enabled
  if (model?.showAutomataSelector) {
    const workflowIdValue = defaultValues?.workflowId || 'undefined';
    values.push(`  workflowId: ${workflowIdValue}`);
  }

  // Add tags initial value (reserved field - always included)
  const tagsValue = defaultValues?.tags ?? `''`;
  values.push(`  tags: ${tagsValue}`);

  return values.join(',\n');
}

// Common wrapper for grid and hint with dependency rules support
function renderWithGrid(content, gridCol, appendix, fieldName) {
  // If fieldName is provided, wrap with visibility check
  if (fieldName) {
    return `
    {(!fieldStates['${fieldName}'] || fieldStates['${fieldName}']?.visible !== false) && (
      <Grid size={${gridCol ?? 6}}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          ${content ?? ''}
        </Box>
        ${appendix ?? ''}
      </Grid>
    )}`;
  }

  return `
    <Grid size={${gridCol ?? 6}}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        ${content ?? ''}
      </Box>
      ${appendix ?? ''}
    </Grid>`;
}

// Foreign key rendering
// Renders an internal Foreign Key field as an autocomplete with optional inline "Create" support
// - Validates presence of `externalFks` metadata which is used to derive display field information
// - Computes route namespace for the referenced model's microservice to wire the dropdown API
// - Determines how to format the row label (supports Date/DateTime display fields)
function renderInternalForeignKeyField(
  field,
  model,
  options = {},
  context,
  models = null
) {
  // Guard: externalFks is required to compute display value field metadata for FKs
  if (!Array.isArray(options?.externalFks)) {
    logWithTrace(
      '[FORM_ERROR] Missing externalFks in options for internal field',
      context,
      { field, model }
    );
    throw createStandardError(ERROR_TYPES.BAD_REQUEST, 'No externalFks', {
      context: 'renderInternalForeignKeyField',
      details: { field, model, traceId: context?.traceId || context },
    });
  }

  const { foreignKeyModel } = field;
  const foreignKeyModelNameStartCase = toStartCaseNoSpaces(
    foreignKeyModel?.name
  );
  const foreignKeyMicroserviceSlug = convertToSlug(
    foreignKeyModel?.microservice?.name ?? ''
  );
  const foreignKeyCreateFormAlias = `${toStartCaseNoSpaces(
    foreignKeyMicroserviceSlug
  )}${foreignKeyModelNameStartCase}CreateForm`;

  // React Query keys: one specific to this field pairing and one common key per dropdown
  const primaryRequestKey = `${model?.name}-${foreignKeyModel?.name}`;
  const commonDropdownQueryKey = `${foreignKeyModelNameStartCase}-dropdown`;

  // Formik field name uses the conventional `${field}Id` pattern for FK references
  const foreignKeyFieldName = `${field.name}Id`;

  // Resolve which field should be displayed for the FK row and how to format it
  const {
    displayValueField: displayValueFieldName,
    type: displayValueFieldType,
  } = getDisplayValueField(
    foreignKeyModel,
    options?.externalFks,
    context,
    models
  );
  const {
    isDateOrDateTime: isDisplayFieldDateLike,
    formatFn: formatDisplayValueFn,
  } = determineDateFormatFunction(displayValueFieldType);
  const displayLabelPath = `row?.${displayValueFieldName}`;

  // Resolve dependency keys if this field depends on another FK
  // - dependencyValueKey: form field name for accessing values (e.g., prospectPipelineId)
  // - dependencyFilterKey: URL param name for API filtering (e.g., pipelineId)
  const dependencyField = field?.dependsOnField || (field?.dependsOnFieldId
    ? options?.allFields?.find((af) => af?.id === field.dependsOnFieldId)
    : null);
  const dependencyValueKey = dependencyField?.name
    ? `${toCamelCase(dependencyField.name)}Id`
    : null;
  const dependencyFilterKey = resolveDependencyFilterKey(field, dependencyField);
  const dependencyDisabledExpr = dependencyValueKey
    ? ` || !values?.${dependencyValueKey}?.id`
    : '';
  const dependencyRequestKeyExpr = dependencyValueKey
    ? `, '${foreignKeyFieldName}', String(values?.${dependencyValueKey}?.id ?? 'none')`
    : '';
  const dependencyUrlParamsExpr = dependencyFilterKey && dependencyValueKey
    ? `\n          urlParams={values?.${dependencyValueKey}?.id ? \`&${dependencyFilterKey}=\${values.${dependencyValueKey}.id}\` : undefined}`
    : '';

  // Per DEPENDENT_FIELDS_STANDARD: Add enabled prop for dependent fields
  const dependencyEnabledExpr = dependencyValueKey
    ? `\n          enabled={!!values?.${dependencyValueKey}?.id}`
    : '';

  // Per DEPENDENT_FIELDS_STANDARD: Parent fields need onChange to clear dependents
  const resolveDependentFields = (f, opts) => {
    const all = opts?.allFields;
    if (!Array.isArray(all)) return [];
    return all
      .filter((af) => af?.dependsOnFieldId === f?.id)
      .map((af) => (af?.isForeignKey ? `${af.name}Id` : af.name));
  };
  const dependentFields = resolveDependentFields(field, options);
  const onChangeExpr =
    dependentFields.length > 0
      ? `\n          onChange={() => {
            ${dependentFields.map((depField) => `setFieldValue('${depField}', null);`).join('\n            ')}
          }}`
      : '';

  return `
    {(!fieldStates['${foreignKeyFieldName}'] || fieldStates['${foreignKeyFieldName}']?.visible !== false) && (
      <Grid size={${options?.gridCol ?? 6}}>
        <CreatableDropdownWrapper${options?.genericType ? `<${options?.genericType}>` : ''}
          onSave={(data) => {
            const labelValue = getFormattedLabelValue(
              data,
              '${displayValueFieldName}',
              ${isDisplayFieldDateLike ? formatDisplayValueFn : ''}
            );
            setFieldValue('${foreignKeyFieldName}', { id: data?.id, label: labelValue });
            ${options?.skipRefetchAfterCreate ? '' : 'queryClient.invalidateQueries();'}
          }}
          queryClient={queryClient}
          disabled={!(fieldStates['${foreignKeyFieldName}']?.enabled ?? true) || disabledFields.includes('${foreignKeyFieldName}')${dependencyDisabledExpr}}
          CreateFormComponent={${foreignKeyCreateFormAlias}}
        >
          <FormikAutocompleteField
            name='${foreignKeyFieldName}'
            label='${field.label}'
            requestKey={['${primaryRequestKey}', '${commonDropdownQueryKey}'${dependencyRequestKeyExpr}]}
            fetchUrl={getRoute('${foreignKeyMicroserviceSlug}/get${foreignKeyModelNameStartCase}URL')}
            renderRow={(row) => ({
              id: row?.id,
              label: ${
                isDisplayFieldDateLike
                  ? `${formatDisplayValueFn}(${displayLabelPath})`
                  : displayLabelPath
              }
            })}
            required={fieldStates['${foreignKeyFieldName}']?.required ?? ${!field.isOptional}}
            disabled={!(fieldStates['${foreignKeyFieldName}']?.enabled ?? true) || disabledFields.includes('${foreignKeyFieldName}')${dependencyDisabledExpr}}
            helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}${dependencyUrlParamsExpr}${dependencyEnabledExpr}${onChangeExpr}
          />
        </CreatableDropdownWrapper>
      </Grid>
    )}`;
}

// Renders an external Foreign Key field. If the external microservice has UI support (isNode),
// wraps the autocomplete in a CreatableDropdown to allow inline creation. Otherwise renders a plain autocomplete.
// - Derives route namespace and request keys for React Query
// - Determines display label field and formatting rules
function renderExternalForeignKeyField(field, model, options = {}, context) {
  // Guard: externalFks is required to resolve external FK metadata
  if (!Array.isArray(options?.externalFks)) {
    logWithTrace(
      '[FORM_ERROR] Missing externalFks in options for external field',
      context,
      { field, model }
    );
    throw createStandardError(ERROR_TYPES.BAD_REQUEST, 'No externalFks', {
      context: 'renderExternalForeignKeyField',
      details: { field, model, traceId: context?.traceId || context },
    });
  }

  const externalForeignKeyDetail = options?.externalFks?.find(
    ({ fieldId }) => fieldId === field.id
  );

  const externalForeignKeyModel =
    externalForeignKeyDetail?.details?.externalModelId;
  const externalForeignKeyModelNameStartCase = toStartCaseNoSpaces(
    externalForeignKeyModel?.name
  );
  const externalForeignKeyMicroserviceSlug = convertToSlug(
    externalForeignKeyDetail?.details?.externalMicroserviceId?.name
  );

  // React Query keys: pair-specific plus a common dropdown key
  const primaryRequestKey = `${model?.name}-${externalForeignKeyModel?.name}`;
  const commonDropdownQueryKey = `${externalForeignKeyModelNameStartCase}-dropdown`;

  const foreignKeyFieldName = `${field.name}Id`;
  const displayLabelPath = `row?.${DISPLAY_VALUE_PROP}`;
  const externalForeignKeyCreateFormAlias = `${toStartCaseNoSpaces(
    externalForeignKeyMicroserviceSlug
  )}${externalForeignKeyModelNameStartCase}CreateForm`;

  // Get external model's fieldDefns for dependency resolution
  const externalFieldDefns = externalForeignKeyDetail?.fieldDefns || null;

  if (
    externalForeignKeyDetail?.details?.externalMicroserviceId?.isNode &&
    externalForeignKeyDetail?.details?.externalMicroserviceId?.isCompute
  ) {
    // Resolve dependency keys if this field depends on another FK
    // - dependencyValueKey: form field name for accessing values (e.g., prospectPipelineId)
    // - dependencyFilterKey: URL param name for API filtering (e.g., pipelineId)
    const dependencyField = field?.dependsOnField || (field?.dependsOnFieldId
      ? options?.allFields?.find((af) => af?.id === field.dependsOnFieldId)
      : null);
    const dependencyValueKey = dependencyField?.name
      ? `${toCamelCase(dependencyField.name)}Id`
      : null;
    const dependencyFilterKey = resolveDependencyFilterKey(field, dependencyField, externalFieldDefns);
    const dependencyDisabledExpr = dependencyValueKey
      ? ` || !values?.${dependencyValueKey}?.id`
      : '';
    const dependencyRequestKeyExpr = dependencyValueKey
      ? `, '${foreignKeyFieldName}', String(values?.${dependencyValueKey}?.id ?? 'none')`
      : '';
    const dependencyUrlParamsExpr = dependencyFilterKey && dependencyValueKey
      ? `\n            urlParams={values?.${dependencyValueKey}?.id ? \`&${dependencyFilterKey}=\${values.${dependencyValueKey}.id}\` : undefined}`
      : '';

    // Per DEPENDENT_FIELDS_STANDARD: Add enabled prop for dependent fields
    const dependencyEnabledExpr = dependencyValueKey
      ? `\n            enabled={!!values?.${dependencyValueKey}?.id}`
      : '';

    // Per DEPENDENT_FIELDS_STANDARD: Parent fields need onChange to clear dependents
    const resolveDependentFields = (f, opts) => {
      const all = opts?.allFields;
      if (!Array.isArray(all)) return [];
      return all
        .filter((af) => af?.dependsOnFieldId === f?.id)
        .map((af) => (af?.isForeignKey ? `${af.name}Id` : af.name));
    };
    const dependentFields = resolveDependentFields(field, options);
    const onChangeExpr =
      dependentFields.length > 0
        ? `\n            onChange={() => {
              ${dependentFields.map((depField) => `setFieldValue('${depField}', null);`).join('\n              ')}
            }}`
        : '';

    return `
      {(!fieldStates['${foreignKeyFieldName}'] || fieldStates['${foreignKeyFieldName}']?.visible !== false) && (
        <Grid size={${options?.gridCol ?? 6}}>
          <CreatableDropdownWrapper${options?.genericType ? `<${options?.genericType}>` : ''}
            onSave={(data) => {
              const labelValue = getFormattedLabelValue(
                data,
                '${DISPLAY_VALUE_PROP}',
              );
              setFieldValue('${foreignKeyFieldName}', { id: data?.id, label: labelValue });
              ${options?.skipRefetchAfterCreate ? '' : 'queryClient.invalidateQueries();'}
            }}
            queryClient={queryClient}
            disabled={!(fieldStates['${foreignKeyFieldName}']?.enabled ?? true) || disabledFields.includes('${foreignKeyFieldName}')${dependencyDisabledExpr}}
            CreateFormComponent={${externalForeignKeyCreateFormAlias}}
          >
            <FormikAutocompleteField
              name='${foreignKeyFieldName}'
              label='${field.label}'
              requestKey={['${primaryRequestKey}', '${commonDropdownQueryKey}'${dependencyRequestKeyExpr}]}
              fetchUrl={getRoute('${externalForeignKeyMicroserviceSlug}/get${externalForeignKeyModelNameStartCase}URL')}
              renderRow={(row) => ({
                id: row?.id,
                label: ${displayLabelPath},
              })}
              required={fieldStates['${foreignKeyFieldName}']?.required ?? ${!field.isOptional}}
              disabled={!(fieldStates['${foreignKeyFieldName}']?.enabled ?? true) || disabledFields.includes('${foreignKeyFieldName}')${dependencyDisabledExpr}}
              helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}${dependencyUrlParamsExpr}${dependencyEnabledExpr}${onChangeExpr}
            />
          </CreatableDropdownWrapper>
        </Grid>
      )}`;
  }

  // Resolve dependency keys if this field depends on another FK
  // - dependencyValueKey: form field name for accessing values (e.g., prospectPipelineId)
  // - dependencyFilterKey: URL param name for API filtering (e.g., pipelineId)
  const dependencyField = field?.dependsOnField || (field?.dependsOnFieldId
    ? options?.allFields?.find((af) => af?.id === field.dependsOnFieldId)
    : null);
  const dependencyValueKey = dependencyField?.name
    ? `${toCamelCase(dependencyField.name)}Id`
    : null;
  const dependencyFilterKey = resolveDependencyFilterKey(field, dependencyField, externalFieldDefns);
  const dependencyDisabledExpr = dependencyValueKey
    ? ` || !values?.${dependencyValueKey}?.id`
    : '';
  const dependencyRequestKeyExpr = dependencyValueKey
    ? `, '${foreignKeyFieldName}', String(values?.${dependencyValueKey}?.id ?? 'none')`
    : '';
  const dependencyUrlParamsExpr = dependencyFilterKey && dependencyValueKey
    ? `\n        urlParams={values?.${dependencyValueKey}?.id ? \`&${dependencyFilterKey}=\${values.${dependencyValueKey}.id}\` : undefined}`
    : '';

  // Per DEPENDENT_FIELDS_STANDARD: Add enabled prop for dependent fields
  const dependencyEnabledExpr = dependencyValueKey
    ? `\n        enabled={!!values?.${dependencyValueKey}?.id}`
    : '';

  // Per DEPENDENT_FIELDS_STANDARD: Parent fields need onChange to clear dependents
  const resolveDependentFields = (f, opts) => {
    const all = opts?.allFields;
    if (!Array.isArray(all)) return [];
    return all
      .filter((af) => af?.dependsOnFieldId === f?.id)
      .map((af) => (af?.isForeignKey ? `${af.name}Id` : af.name));
  };
  const dependentFields = resolveDependentFields(field, options);
  const onChangeExpr =
    dependentFields.length > 0
      ? `\n        onChange={() => {
          ${dependentFields.map((depField) => `setFieldValue('${depField}', null);`).join('\n          ')}
        }}`
      : '';

  return `
    {(!fieldStates['${foreignKeyFieldName}'] || fieldStates['${foreignKeyFieldName}']?.visible !== false) && (
      <Grid size={${options?.gridCol ?? 6}}>
        <FormikAutocompleteField
          name='${foreignKeyFieldName}'
          label='${field.label}'
          requestKey={['${primaryRequestKey}', '${commonDropdownQueryKey}'${dependencyRequestKeyExpr}]}
          fetchUrl={getRoute('${externalForeignKeyMicroserviceSlug}/get${externalForeignKeyModelNameStartCase}URL')}
          renderRow={(row) => ({
            id: row?.id,
            label: ${displayLabelPath},
          })}
          required={fieldStates['${foreignKeyFieldName}']?.required ?? ${!field.isOptional}}
          disabled={!(fieldStates['${foreignKeyFieldName}']?.enabled ?? true) || disabledFields.includes('${foreignKeyFieldName}')${dependencyDisabledExpr}}
          helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}${dependencyUrlParamsExpr}${dependencyEnabledExpr}${onChangeExpr}
        />
      </Grid>
    )}`;
}

// Text field rendering
function renderTextField(field, options = {}) {
  const content = `
    <FormikTextField
      size='small'
      fullWidth
      name='${field.name}'
      label='${field.label}'
      helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}
      ${field.isMultiline ? 'minRows={3} multiline' : ''}
      required={fieldStates['${field.name}']?.required ?? ${!field.isOptional}}
      disabled={!(fieldStates['${field.name}']?.enabled ?? true) || disabledFields.includes('${field.name}')}
    />`;
  return renderWithGrid(content, options?.gridCol, null, field.name);
}

// Upload field rendering
function renderUploadField(field, options = {}) {
  const currentUploadLink = options?.isDetailForm
    ? `
    <CurrentUploadValueLink
      url={
        typeof values?.${field.name} === 'string'
          ? values?.${field.name}
          : null
      }
      label='View current ${field.label} →'
    />`
    : '';
  const content = `
    <FormikUploadField
      name='${field.name}'
      label='${field.label}'
      helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}
      required={fieldStates['${field.name}']?.required ?? ${!field.isOptional}}
      disabled={!(fieldStates['${field.name}']?.enabled ?? true) || disabledFields.includes('${field.name}')}
    />
    `;
  return renderWithGrid(
    content,
    options?.gridCol,
    currentUploadLink,
    field.name
  );
}

// Checkbox rendering
function renderCheckboxField(field, options = {}) {
  const content = `
    <FormikCheckboxField
      name='${field.name}'
      label='${field.label}'
      helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}
      required={fieldStates['${field.name}']?.required ?? ${!field.isOptional}}
      disabled={!(fieldStates['${field.name}']?.enabled ?? true) || disabledFields.includes('${field.name}')}
    />`;
  return renderWithGrid(content, options?.gridCol, null, field.name);
}

// Select field rendering
function renderSelectField(field, options = {}) {
  const enumValues = field?.enumDefn?.enumValues.map(
    ({ label, value }) => `{ label: '${label}', value: '${value}' }`
  );
  const content = `
    <FormikSelectField
      name='${field.name}'
      label='${field.label}'
      helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}
      options={[${enumValues?.join(',')}]}
      required={fieldStates['${field.name}']?.required ?? ${!field.isOptional}}
      disabled={!(fieldStates['${field.name}']?.enabled ?? true) || disabledFields.includes('${field.name}')}
    />`;
  return renderWithGrid(content, options?.gridCol, null, field.name);
}

// Date field rendering
function renderDateField(field, options = {}) {
  const content = `
    <FormikDatePickerField
      name='${field.name}'
      label='${field.label}'
      helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}
      required={fieldStates['${field.name}']?.required ?? ${!field.isOptional}}
      disabled={!(fieldStates['${field.name}']?.enabled ?? true) || disabledFields.includes('${field.name}')}
    />`;
  return renderWithGrid(content, options?.gridCol, null, field.name);
}

// DateTime field rendering
function renderDateTimeField(field, options = {}) {
  const content = `
    <FormikDateTimePickerField
      name='${field.name}'
      label='${field.label}'
      helpfulHint={\`${escapeStringForJSX(field?.helpfulHint ?? '')}\`}
      required={fieldStates['${field.name}']?.required ?? ${!field.isOptional}}
      disabled={!(fieldStates['${field.name}']?.enabled ?? true) || disabledFields.includes('${field.name}')}
    />`;
  return renderWithGrid(content, options?.gridCol, null, field.name);
}

/**
 * Builds a consolidated list of import statements required by a model's generated Create form.
 *
 * Responsibilities:
 * - Detect form control types based on field data types
 * - Collect CreateForm component imports for referenced models (internal/external FKs)
 * - Discover and import route namespaces for all involved microservices
 * - Include date/time helper imports when Date/DateTime fields are present
 *
 * @param {Object} params
 * @param {Array} params.fieldDefinitions Field definitions for the current model
 * @param {string} params.microserviceSlug Slug for the current microservice
 * @param {Array} params.externalFks External-FK metadata from backend
 * @param {boolean} [params.includeMoment=true] Whether to include moment import for date types
 * @param {boolean} [params.includeInterfaceTypes=true] Whether to include type imports for interfaces (e.g., AutocompleteOption)
 * @returns {{ formFieldImports: string[] }}
 */
function generateFieldImportsAndRoutes({
  fieldDefinitions,
  microserviceSlug,
  externalFks,
  includeMoment = true,
  includeInterfaceTypes = true,
  model = null,
} = {}) {
  // Accumulators that drive import generation
  const formControlTypes = new Set();
  const foreignKeyModelsByMicroservice = {};
  const createFormImportsForForeignKeys = new Set();

  // Walk each field to determine needed UI controls, FK create-form imports, and route namespaces
  fieldDefinitions.forEach((fieldDefinition) => {
    const { dataType, isForeignKey, foreignKeyModel } = fieldDefinition;

    // Internal FK: the referenced model lives within our system and we know its UI path
    if (isInternalForeignKey(fieldDefinition)) {
      const foreignKeyModelNameStartCase = toStartCaseNoSpaces(
        foreignKeyModel?.name
      );
      const foreignKeyMicroserviceSlug = convertToSlug(
        foreignKeyModel?.microservice?.name ?? ''
      );
      formControlTypes.add('ForeignKey');

      const foreignKeyCreateFormComponentAlias = `${toStartCaseNoSpaces(foreignKeyMicroserviceSlug)}${foreignKeyModelNameStartCase}CreateForm`;
      createFormImportsForForeignKeys.add(
        `import { ${foreignKeyModelNameStartCase}Create as ${foreignKeyCreateFormComponentAlias} } from '@ps/entity-core/${foreignKeyMicroserviceSlug}';`
      );

      addForeignKeyToMicroserviceMap(
        foreignKeyModel,
        foreignKeyModelsByMicroservice,
        microserviceSlug
      );
    } else if (isExternalForeignKey(fieldDefinition)) {
      // External FK: referenced model may belong to another microservice
      const externalForeignKeyDetail = externalFks.find(
        ({ fieldId }) => fieldId === fieldDefinition.id
      );
      formControlTypes.add('ForeignKey');

      // Generate CreateFormComponent import for external FKs with UI support
      if (
        externalForeignKeyDetail?.details?.externalMicroserviceId?.isNode &&
        externalForeignKeyDetail?.details?.externalMicroserviceId?.isCompute
      ) {
        const externalModelName =
          externalForeignKeyDetail?.details?.externalModelId?.name;
        const externalMicroserviceSlug = convertToSlug(
          externalForeignKeyDetail?.details?.externalMicroserviceId?.name
        );
        const externalModelNameStartCase =
          toStartCaseNoSpaces(externalModelName);
        const externalCreateFormAlias = `${toStartCaseNoSpaces(externalMicroserviceSlug)}${externalModelNameStartCase}CreateForm`;
        createFormImportsForForeignKeys.add(
          `import { ${externalModelNameStartCase}Create as ${externalCreateFormAlias} } from '@ps/entity-core/${externalMicroserviceSlug}';`
        );
      }

      addForeignKeyToMicroserviceMap(
        { name: externalForeignKeyDetail?.details?.externalModelId?.name },
        foreignKeyModelsByMicroservice,
        microserviceSlug
      );
    } else if (!isForeignKey && dataType !== 'UUID') {
      // Non-FK field that maps to a concrete form control (ignore UUIDs which are generated)
      formControlTypes.add(dataType);
    }
  });

  // Add ForeignKey form control if showAutomataSelector is enabled (for workflowId autocomplete)
  if (model?.showAutomataSelector) {
    formControlTypes.add('ForeignKey');
  }

  // Always include String type for tags reserved field (uses FormikTextField)
  formControlTypes.add('String');

  // Core form-control imports (TextField, Select, DatePicker, etc.)
  const formFieldImports = generateFormFieldImports([...formControlTypes], {
    includeInterfaceTypes,
  });

  // FK CreateForm component imports discovered above (internal FKs only now)
  if (createFormImportsForForeignKeys.size) {
    Array.from(createFormImportsForForeignKeys).forEach((statement) => {
      formFieldImports.push(statement);
    });
  }

  // Date/DateTime helpers (formatting utils, adapters)
  const dateAndDateTimeImports = processDateAndDateTimeImports(
    fieldDefinitions,
    includeMoment
  );
  dateAndDateTimeImports.forEach((statement) => {
    formFieldImports.push(statement);
  });

  // Add dependency rules hook import
  formFieldImports.push(
    `import { type DependencyRule, useDependencyRules } from '@ps/shared-core/hooks/useDependencyRules';`
  );

  // Note: getRoute is already imported in the template file (CreateForm.template.tsx)
  // so we don't add it here to avoid duplicate imports

  return { formFieldImports };
}

async function createSingleStepForm({
  model,
  modelFields,
  frontend,
  user,
  formPath,
  replacementMixins,
  externalFks,
  models,
  microserviceSlug,
} = {}) {
  // Fetch dependency rules for this model
  const dependencyRules = await getDependencyRulesForModel(model.id);

  // Transform rules to include field names for frontend use
  const transformedRules = transformDependencyRulesForFrontend(dependencyRules);

  const replacements = {
    ...replacementMixins,
    '@gen{MODEL_HINT}': escapeStringForJSX(model?.helpfulHint ?? ''),
    '@gen{DEPENDENCY_RULES_JSON}': JSON.stringify(transformedRules),
    '@gen{FORM_FIELDS}': generateFormFields(
      model,
      modelFields,
      {
        ForeignKey: { externalFks, microserviceSlug },
        ExternalForeignKey: { externalFks, microserviceSlug },
      },
      models
    ),
  };

  await createFileFromTemplate({
    destinationPathSegments: formPath,
    templatePathSegments: [
      frontend?.constructorPath,
      'entity-core',
      'core',
      'forms',
      'CreateForm.template.tsx',
    ],
    templateReplacements: replacements,
    user,
  });

  await formatFile(path.join(...formPath));
}

async function addCreateForms({
  frontend,
  models,
  microserviceSlug,
  user,
  externalFks,
} = {}) {
  const formsDirectoryPath = path.join(frontend?.path, 'src', 'core', 'forms');

  await ensureDirExists(formsDirectoryPath);

  for (const model of models) {
    const modelNameInStartCase = toStartCaseNoSpaces(model?.name);
    const modelNameInCamelCase = toCamelCase(model?.name);
    const createFormFolderPath = path.join(
      formsDirectoryPath,
      `${modelNameInStartCase}Create`
    );
    const formPath = [
      createFormFolderPath,
      `${modelNameInStartCase}Create.tsx`,
    ];
    const modelFields = model?.fieldDefns;

    await ensureDirExists(createFormFolderPath);

    const { formFieldImports } = generateFieldImportsAndRoutes({
      fieldDefinitions: modelFields,
      microserviceSlug,
      externalFks,
      model,
    });

    const { customFieldNames, customAssignments } = formatFieldsForAPIPayload(
      modelFields,
      model
    );

    const replacementMixins = {
      '@gen{MICROSERVICE_SLUG}': microserviceSlug,
      '@gen{MODEL_LABEL}': model?.label,
      '@gen{MODEL_NAME|Pascal}': modelNameInStartCase,
      '@gen{MODEL_NAME|Pascal}Create': `${modelNameInStartCase}Create`,
      '@gen{MODEL_NAME|Pascal}CreateFormValues': `${modelNameInStartCase}CreateFormValues`,
      '@gen{MODEL_NAME|Pascal}CreateProps': `${modelNameInStartCase}CreateProps`,
      'get@gen{MODEL_NAME|Pascal}URL': `get${modelNameInStartCase}URL`,
      '@gen{MODEL_NAME|camel}': modelNameInCamelCase,
      '@gen{MODEL_NAME|camel}Schema': `${modelNameInCamelCase}Schema`,
      '// @gen:FORM_VALUES_INTERFACE': generateFormValuesInterface(
        modelFields,
        model
      ),
      '// @gen:FORM_INITIAL_VALUES': generateFormikInitialValues(
        modelFields,
        {},
        model
      ),
      '// @gen:IMPORTS': `${consolidateImports(formFieldImports).join('\n')}`,
      '@gen{CUSTOM_FIELD_NAMES}': customFieldNames?.length
        ? `${customFieldNames.join(', ')}, `
        : '',
      '// @gen:CUSTOM_ASSIGNMENTS': customAssignments.join('\n'),
    };

    await createSingleStepForm({
      model,
      modelFields,
      frontend,
      user,
      formPath,
      replacementMixins,
      externalFks,
      models,
      microserviceSlug,
    });
  }
}

module.exports = {
  generateFormFields,
  generateFormikInitialValues,
  generateFormFieldImports,
  generateFieldImportsAndRoutes,
  transformDependencyRulesForFrontend,
  createSingleStepForm,
  addCreateForms,
  renderInternalForeignKeyField,
  renderExternalForeignKeyField,
};
