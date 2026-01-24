/**
 * Tests for importExportSetupUtils.js
 *
 * Verifies that import/export controller template paths are correctly resolved.
 */

const path = require('path');

// Mock prettier to avoid dynamic import issues in Jest
jest.mock('prettier', () => ({
  format: jest.fn((content) => content),
}));

// Mock fileUtils
jest.mock('#utils/shared/fileUtils.js', () => ({
  createFileFromTemplate: jest.fn().mockResolvedValue(undefined),
  formatFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock traceUtils
jest.mock('#utils/shared/traceUtils.js', () => ({
  logWithTrace: jest.fn(),
  logOperationStart: jest.fn(),
  logOperationSuccess: jest.fn(),
  logOperationError: jest.fn(),
}));

// Mock errorHandlingUtils
jest.mock('#utils/shared/errorHandlingUtils.js', () => ({
  createStandardError: jest.fn((type, message) => new Error(message)),
  ERROR_TYPES: { INTERNAL: 'INTERNAL' },
  ERROR_SEVERITY: { HIGH: 'HIGH' },
  withErrorHandling: (fn) => fn,
}));

const { createFileFromTemplate } = require('#utils/shared/fileUtils.js');
const {
  processImportExportControllers,
} = require('#utils/api/importExportSetupUtils.js');

describe('processImportExportControllers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use separate paths for template and destination directories', async () => {
    const mockModels = [{ name: 'TestModel' }];
    const mockSrcPath = '/test/output/src';
    const mockConstructorPath = '/test/computeConstructors/api';

    await processImportExportControllers({
      models: mockModels,
      srcPath: mockSrcPath,
      restAPI: { constructorPath: mockConstructorPath },
      user: { id: 'test-user' },
      req: { traceId: 'test-trace-id' },
    });

    // Should be called twice (import and export controllers)
    expect(createFileFromTemplate).toHaveBeenCalledTimes(2);

    // Verify import controller paths
    const importCall = createFileFromTemplate.mock.calls[0][0];
    expect(importCall.destinationPathSegments).toEqual([
      mockSrcPath,
      'core/controllers',
      'import.controller.js',
    ]);
    expect(importCall.templatePathSegments).toEqual([
      mockConstructorPath,
      'controllers', // Template path should NOT have 'core/' prefix
      'import.controller.template.js',
    ]);

    // Verify export controller paths
    const exportCall = createFileFromTemplate.mock.calls[1][0];
    expect(exportCall.destinationPathSegments).toEqual([
      mockSrcPath,
      'core/controllers',
      'export.controller.js',
    ]);
    expect(exportCall.templatePathSegments).toEqual([
      mockConstructorPath,
      'controllers', // Template path should NOT have 'core/' prefix
      'export.controller.template.js',
    ]);
  });

  it('should generate correct template replacements for models', async () => {
    const mockModels = [{ name: 'Employee' }, { name: 'Department' }];

    await processImportExportControllers({
      models: mockModels,
      srcPath: '/test/output/src',
      restAPI: { constructorPath: '/test/computeConstructors/api' },
      user: { id: 'test-user' },
    });

    // Verify import controller has correct replacements
    const importCall = createFileFromTemplate.mock.calls[0][0];
    expect(importCall.templateReplacements['// MODELS_LIST_CAMEL_CASE']).toContain(
      "'employee'"
    );
    expect(importCall.templateReplacements['// MODELS_LIST_CAMEL_CASE']).toContain(
      "'department'"
    );
    expect(importCall.templateReplacements['// MODEL_SCHEMA_IMPORTS']).toContain(
      'employee'
    );
    expect(importCall.templateReplacements['// MODEL_SCHEMA_IMPORTS']).toContain(
      'department'
    );
  });
});

describe('Template path vs destination path separation', () => {
  it('template paths should use controllers/, destination paths should use core/controllers/', () => {
    // This test documents the expected behavior:
    // - Templates are stored at: src/computeConstructors/api/controllers/
    // - Generated files go to: src/core/controllers/
    const templateDir = 'controllers';
    const destinationDir = 'core/controllers';

    expect(templateDir).not.toEqual(destinationDir);
    expect(destinationDir).toContain('core');
    expect(templateDir).not.toContain('core');
  });
});
