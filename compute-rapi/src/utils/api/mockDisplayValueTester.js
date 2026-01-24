/**
 * Mock testing utility for getDisplayValueField function
 * Allows local testing of various path scenarios without full application setup
 */

const { DISPLAY_VALUE_PROP } = require('#configs/constants.js');

// Mock implementations of dependencies
const mockLogWithTrace = (message, req, data) => {
  if (process.env.ENABLE_MOCK_LOGGING === 'true') {
    console.log(`[TRACE] ${message}`, data);
  }
};

const mockIsInternalForeignKey = (field) => {
  return (
    field?.dataType === 'UUID' &&
    field?.isForeignKey &&
    field?.foreignKeyTarget === 'Internal' &&
    !!field?.foreignKeyModel?.name
  );
};

const mockIsExternalForeignKey = (field) => {
  return (
    field?.dataType === 'UUID' &&
    field?.isForeignKey &&
    field?.foreignKeyTarget === 'External' &&
    field?.externalMicroserviceId &&
    field?.externalModelId
  );
};

const mockCreateStandardError = (type, message, details) => {
  const error = new Error(message);
  error.type = type;
  error.details = details;
  return error;
};

const mockFindExternalFkConfigByModelId = (externalConfigs, modelId) => {
  return externalConfigs.find((config) => config.externalModelId === modelId);
};

const mockGetFormattedFieldName = (name, isForeignKey) => {
  const suffix = isForeignKey ? 'Id' : '';
  return `${name}${suffix}`;
};

/**
 * Mock version of getDisplayValueField for local testing
 */
function mockGetDisplayValueField(
  foreignKeyModel,
  externalFkConfigs,
  req = null
) {
  return mockResolveDisplayPath(foreignKeyModel, externalFkConfigs, req, []);
}

/**
 * Mock recursive helper function to resolve display paths for nested foreign keys
 */
function mockResolveDisplayPath(model, externalFkConfigs, req, pathSegments) {
  mockLogWithTrace('Starting display value field resolution', req, {
    model: model?.name,
    primaryDisplayField: model?.displayValue?.name,
    currentPath: pathSegments.join('?.'),
  });

  const primaryDisplayField = model?.displayValue;
  const primaryFieldName = primaryDisplayField?.name;

  mockLogWithTrace('Primary display field analysis', req, {
    field: primaryFieldName,
    isInternal: mockIsInternalForeignKey(primaryDisplayField),
    isExternal: mockIsExternalForeignKey(primaryDisplayField),
    pathDepth: pathSegments.length,
  });

  // Handle internal foreign key relationships
  if (mockIsInternalForeignKey(primaryDisplayField)) {
    mockLogWithTrace('Internal FK detected', req, {
      parentField: primaryFieldName,
      fkType: 'internal',
      nestedModel: primaryDisplayField.foreignKeyModel?.name,
      currentDepth: pathSegments.length,
    });

    const nestedModel = primaryDisplayField.foreignKeyModel;
    const nestedDisplayField = nestedModel?.displayValue;

    mockLogWithTrace('Nested display field analysis', req, {
      nestedField: nestedDisplayField?.name,
      isInternal: mockIsInternalForeignKey(nestedDisplayField),
      isExternal: mockIsExternalForeignKey(nestedDisplayField),
    });

    // Handle internal -> external foreign key chaining
    if (mockIsExternalForeignKey(nestedDisplayField)) {
      mockLogWithTrace('Internal->External FK chain detected', req, {
        externalModelId: nestedDisplayField.externalModelId,
        fieldName: nestedDisplayField.name,
      });

      const externalConfig = mockFindExternalFkConfigByModelId(
        externalFkConfigs,
        nestedDisplayField.externalModelId
      );

      mockLogWithTrace('External config lookup', req, {
        modelId: nestedDisplayField.externalModelId,
        found: !!externalConfig,
        config: externalConfig ? 'exists' : 'MISSING',
      });

      if (!externalConfig) {
        throw mockCreateStandardError(
          'VALIDATION',
          'External FK configuration not found',
          {
            severity: 'MEDIUM',
            context: 'external_fk_config_lookup',
            details: {
              externalModelId: nestedDisplayField.externalModelId,
              fieldName: nestedDisplayField.name,
            },
          }
        );
      }

      const formattedField = mockGetFormattedFieldName(
        nestedDisplayField.name,
        true
      );
      const externalDisplayField = DISPLAY_VALUE_PROP;

      const fullPath = [
        ...pathSegments,
        primaryFieldName,
        `details.${formattedField}`,
        externalDisplayField.name,
      ].join('?.');

      mockLogWithTrace('External display resolution', req, {
        formattedField,
        externalDisplayField: externalDisplayField?.name,
        fullPath,
      });

      return {
        displayValueField: fullPath,
        type: externalDisplayField.type,
      };
    }

    // Handle continued internal foreign key nesting (recursive case)
    if (mockIsInternalForeignKey(nestedDisplayField)) {
      mockLogWithTrace('Recursive internal FK resolution', req, {
        currentField: primaryFieldName,
        nextModel: nestedModel?.name,
        pathDepth: pathSegments.length + 1,
      });

      // Recursively resolve the nested model
      return mockResolveDisplayPath(nestedModel, externalFkConfigs, req, [
        ...pathSegments,
        primaryFieldName,
      ]);
    }

    // Handle simple internal FK (terminal case)
    mockLogWithTrace('Simple internal FK resolution', req, {
      displayPath: nestedDisplayField?.name,
      dataType: nestedDisplayField?.dataType,
      finalPath: [
        ...pathSegments,
        primaryFieldName,
        nestedDisplayField?.name,
      ].join('?.'),
    });

    const finalPath = [
      ...pathSegments,
      primaryFieldName,
      nestedDisplayField?.name,
    ]
      .filter(Boolean)
      .join('?.');

    return {
      displayValueField: finalPath,
      type: nestedDisplayField?.dataType,
    };
  }

  // Handle direct external foreign keys
  if (mockIsExternalForeignKey(primaryDisplayField)) {
    mockLogWithTrace('External FK detected', req, {
      field: primaryFieldName,
      externalModelId: primaryDisplayField.externalModelId,
    });

    const externalConfig = mockFindExternalFkConfigByModelId(
      externalFkConfigs,
      primaryDisplayField.externalModelId
    );

    mockLogWithTrace('External config lookup', req, {
      modelId: primaryDisplayField.externalModelId,
      found: !!externalConfig,
      configDetails: externalConfig?.details ? 'exists' : 'MISSING',
    });

    if (!externalConfig) {
      throw mockCreateStandardError(
        'VALIDATION',
        'External FK configuration not found',
        {
          severity: 'MEDIUM',
          context: 'external_fk_config_lookup',
          details: {
            externalModelId: primaryDisplayField.externalModelId,
            fieldName: primaryFieldName,
          },
        }
      );
    }

    const externalDisplayField = DISPLAY_VALUE_PROP;
    const formattedField = mockGetFormattedFieldName(primaryFieldName, true);
    const finalPath =
      pathSegments.length > 0
        ? [
            ...pathSegments,
            `details.${formattedField}`,
            externalDisplayField.name,
          ].join('?.')
        : `details?.${formattedField}?.${externalDisplayField.name}`;

    mockLogWithTrace('External display resolution', req, {
      formattedField,
      externalDisplayField: externalDisplayField?.name,
      fullPath: finalPath,
    });

    return {
      displayValueField: finalPath,
      type: externalDisplayField.type,
    };
  }

  mockLogWithTrace('Direct field reference resolution', req, {
    displayField: primaryFieldName,
    dataType: primaryDisplayField?.dataType,
    finalPath:
      pathSegments.length > 0
        ? [...pathSegments, primaryFieldName].filter(Boolean).join('?.')
        : primaryFieldName,
  });

  // Default case for direct field reference
  const finalPath =
    pathSegments.length > 0
      ? [...pathSegments, primaryFieldName].filter(Boolean).join('?.')
      : primaryFieldName;

  return {
    displayValueField: finalPath,
    type: primaryDisplayField?.dataType,
  };
}

/**
 * Test data factory functions for creating mock models
 */
const TestDataFactory = {
  createSimpleModel: (name, displayFieldName, dataType = 'String') => ({
    name,
    displayValue: {
      name: displayFieldName,
      dataType,
      isForeignKey: false,
    },
  }),

  createInternalFKModel: (name, displayFieldName, nestedModel) => ({
    name,
    displayValue: {
      name: displayFieldName,
      dataType: 'UUID',
      isForeignKey: true,
      foreignKeyTarget: 'Internal',
      foreignKeyModel: nestedModel,
    },
  }),

  createExternalFKModel: (
    name,
    displayFieldName,
    externalModelId,
    microserviceId
  ) => ({
    name,
    displayValue: {
      name: displayFieldName,
      dataType: 'UUID',
      isForeignKey: true,
      foreignKeyTarget: 'External',
      externalModelId,
      externalMicroserviceId: microserviceId,
    },
  }),

  createExternalConfig: (modelId, displayFieldName, dataType = 'String') => ({
    externalModelId: modelId,
    details: {
      [DISPLAY_VALUE_PROP]: {
        name: displayFieldName,
        type: dataType,
      },
    },
  }),
};

/**
 * Predefined test scenarios based on real-world use cases
 */
const TestScenarios = {
  // Based on dp-error.md: Opportunity -> Contact -> Person chain
  opportunityContactPerson: () => {
    const personModel = TestDataFactory.createSimpleModel(
      'Person',
      'firstName',
      'String'
    );
    const contactModel = TestDataFactory.createInternalFKModel(
      'Contact',
      'person',
      personModel
    );
    const externalConfigs = [];

    return {
      model: contactModel,
      externalConfigs,
      expectedPath: 'person?.firstName',
      expectedType: 'String',
      description: 'Contact model with person foreign key -> Person.firstName',
    };
  },

  // Triple-nested internal FK (now handles full chain)
  tripleNestedInternal: () => {
    const personModel = TestDataFactory.createSimpleModel(
      'Person',
      'firstName',
      'String'
    );
    const contactModel = TestDataFactory.createInternalFKModel(
      'Contact',
      'person',
      personModel
    );
    const opportunityModel = TestDataFactory.createInternalFKModel(
      'Opportunity',
      'contact',
      contactModel
    );

    return {
      model: opportunityModel,
      externalConfigs: [],
      expectedPath: 'contact?.person?.firstName',
      expectedType: 'String',
      description:
        'Opportunity -> Contact -> Person (triple-nested internal FK)',
    };
  },

  // 4-level deep chain: Client History -> Client -> Company Contact -> Person
  fourLevelChain: () => {
    const personModel = TestDataFactory.createSimpleModel(
      'Person',
      'firstName',
      'String'
    );
    const companyContactModel = TestDataFactory.createInternalFKModel(
      'CompanyContact',
      'person',
      personModel
    );
    const clientModel = TestDataFactory.createInternalFKModel(
      'Client',
      'companyContact',
      companyContactModel
    );
    const clientHistoryModel = TestDataFactory.createInternalFKModel(
      'ClientHistory',
      'client',
      clientModel
    );

    return {
      model: clientHistoryModel,
      externalConfigs: [],
      expectedPath: 'client?.companyContact?.person?.firstName',
      expectedType: 'String',
      description:
        'Client History -> Client -> Company Contact -> Person (4-level chain)',
    };
  },

  // Internal -> External chain
  internalToExternalChain: () => {
    // Create a contact model with an external FK as display field
    const contactModel = {
      name: 'Contact',
      displayValue: {
        name: 'externalRef',
        dataType: 'UUID',
        isForeignKey: true,
        foreignKeyTarget: 'External',
        externalModelId: 'ext-person-model',
        externalMicroserviceId: 'hr-service',
      },
    };

    const opportunityModel = TestDataFactory.createInternalFKModel(
      'Opportunity',
      'contact',
      contactModel
    );

    const externalConfigs = [
      TestDataFactory.createExternalConfig(
        'ext-person-model',
        'fullName',
        'String'
      ),
    ];

    return {
      model: opportunityModel,
      externalConfigs,
      expectedPath: 'contact?.details.externalRefId?.fullName',
      expectedType: 'String',
      description:
        'Opportunity -> Contact -> External Person (internal->external chain)',
    };
  },

  // Direct external FK
  directExternal: () => {
    const opportunityModel = TestDataFactory.createExternalFKModel(
      'Opportunity',
      'externalContact',
      'ext-contact-model',
      'crm-service'
    );

    const externalConfigs = [
      TestDataFactory.createExternalConfig(
        'ext-contact-model',
        'companyName',
        'String'
      ),
    ];

    return {
      model: opportunityModel,
      externalConfigs,
      expectedPath: 'details?.externalContactId?.companyName',
      expectedType: 'String',
      description: 'Direct external FK to contact model',
    };
  },

  // Simple direct field
  directField: () => {
    const personModel = TestDataFactory.createSimpleModel(
      'Person',
      'email',
      'Email'
    );

    return {
      model: personModel,
      externalConfigs: [],
      expectedPath: 'email',
      expectedType: 'Email',
      description: 'Direct field reference (no FK)',
    };
  },
};

/**
 * Test runner function
 */
function runTestScenarios(enableLogging = false) {
  if (enableLogging) {
    process.env.ENABLE_MOCK_LOGGING = 'true';
  }

  console.log('🧪 Running getDisplayValueField Test Scenarios\n');

  Object.entries(TestScenarios).forEach(([scenarioName, createScenario]) => {
    console.log(`📋 Testing: ${scenarioName}`);

    try {
      const scenario = createScenario();
      const result = mockGetDisplayValueField(
        scenario.model,
        scenario.externalConfigs
      );

      const success =
        result.displayValueField === scenario.expectedPath &&
        result.type === scenario.expectedType;

      console.log(`   ${success ? '✅' : '❌'} ${scenario.description}`);
      console.log(
        `   Expected: displayValueField="${scenario.expectedPath}", type="${scenario.expectedType}"`
      );
      console.log(
        `   Actual:   displayValueField="${result.displayValueField}", type="${result.type}"`
      );

      if (!success) {
        console.log(`   🚨 MISMATCH DETECTED`);
      }
    } catch (error) {
      console.log(`   ❌ ERROR: ${error.message}`);
    }

    console.log('');
  });

  if (enableLogging) {
    delete process.env.ENABLE_MOCK_LOGGING;
  }
}

/**
 * Interactive test function for custom scenarios
 */
function testCustomScenario(
  model,
  externalConfigs = [],
  description = 'Custom scenario'
) {
  console.log(`🧪 Testing Custom Scenario: ${description}\n`);

  try {
    const result = mockGetDisplayValueField(model, externalConfigs);
    console.log(`✅ Result:`);
    console.log(`   displayValueField: "${result.displayValueField}"`);
    console.log(`   type: "${result.type}"`);
    return result;
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return null;
  }
}

module.exports = {
  mockGetDisplayValueField,
  TestDataFactory,
  TestScenarios,
  runTestScenarios,
  testCustomScenario,
};

// If run directly, execute test scenarios
if (require.main === module) {
  runTestScenarios(true);
}
