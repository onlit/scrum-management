/**
 * Tests for getOutputPath in apiSetupUtils.js
 *
 * Verifies that generated files are placed in the core/ directory structure.
 */

// Mock prettier to avoid dynamic import issues in Jest
jest.mock('prettier', () => ({
  format: jest.fn((content) => content),
}));

const { getOutputPath, OUTPUT_PATHS } = require('#utils/api/apiSetupUtils.js');

describe('getOutputPath', () => {
  it('should place controllers in core/controllers/', () => {
    const result = getOutputPath('controller', 'employee');
    expect(result).toBe('core/controllers/employee.controller.core.js');
  });

  it('should place schemas in core/schemas/', () => {
    const result = getOutputPath('schema', 'employee');
    expect(result).toBe('core/schemas/employee.schema.core.js');
  });

  it('should place routes in core/routes/v1/', () => {
    const result = getOutputPath('routes', 'employee');
    expect(result).toBe('core/routes/v1/employee.routes.core.js');
  });

  it('should throw error for unknown type', () => {
    expect(() => getOutputPath('unknown', 'employee')).toThrow(
      'Unknown output type'
    );
  });
});

describe('OUTPUT_PATHS', () => {
  it('should define core directory paths', () => {
    expect(OUTPUT_PATHS.controller).toBe('core/controllers');
    expect(OUTPUT_PATHS.schema).toBe('core/schemas');
    expect(OUTPUT_PATHS.routes).toBe('core/routes/v1');
  });
});
