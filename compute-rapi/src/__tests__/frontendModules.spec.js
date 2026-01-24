/* Smoke tests for frontend utils to ensure modules load and export expected functions */

// Mock fileUtils to avoid prettier ESM issues in Jest
jest.mock('#utils/shared/fileUtils.js', () => ({
  createFileFromTemplate: jest.fn(),
  formatFile: jest.fn(),
}));

describe('frontend utils modules', () => {
  test('tableColumnsUtils exports expected functions', () => {
    const mod = require('../utils/frontend/tableColumnsUtils.js');
    expect(typeof mod.generateFieldColumns).toBe('function');
    expect(typeof mod.createTableColumnsFile).toBe('function');
    expect(typeof mod.formatTableColumnsFile).toBe('function');
    expect(typeof mod.createTableColumns).toBe('function');
  });

  test('dataMapperUtils exports expected functions', () => {
    const mod = require('../utils/frontend/dataMapperUtils.js');
    expect(typeof mod.createTableDataMapperFile).toBe('function');
    expect(typeof mod.formatTableDataMapperFile).toBe('function');
    expect(typeof mod.createTableDataMappers).toBe('function');
  });
});
