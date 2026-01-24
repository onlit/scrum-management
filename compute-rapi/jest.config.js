module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/__tests__/**/*.test.js', '**/__tests__/**/*.spec.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  moduleNameMapper: {
    // Map template imports to their .template.js versions for testing
    '#core/interfaces/interceptor\\.interface\\.js$':
      '<rootDir>/src/computeConstructors/api/core/interfaces/interceptor.interface.template.js',
    '#core/interfaces/query-builder\\.interface\\.js$':
      '<rootDir>/src/computeConstructors/api/core/interfaces/query-builder.interface.template.js',
    '#core/exceptions/domain\\.exception\\.js$':
      '<rootDir>/src/computeConstructors/api/core/exceptions/domain.exception.template.js',
  },
};
