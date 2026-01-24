const { FlatCompat } = require('@eslint/eslintrc');
const js = require('@eslint/js');
const globals = require('globals');
const path = require('path');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  js.configs.recommended,
  ...compat.extends('airbnb-base'),
  ...compat.extends('plugin:jest/recommended'),
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2021,
      },
    },
    rules: {
      'import/no-unresolved': 'off',
      'import/extensions': 'off',
      'comma-dangle': 'off',
      'no-restricted-syntax': 'off',
      'no-unsafe-optional-chaining': 'off',
      'operator-linebreak': 'off',
      'implicit-arrow-linebreak': 'off',
      'no-case-declarations': 'off',
      'no-confusing-arrow': 'off',
      'function-paren-newline': 'off',
      'no-use-before-define': 'off',
      'guard-for-in': 'off',
      'object-curly-newline': 'off',
      'no-param-reassign': 'off',
      'no-console': 'off',
      'no-await-in-loop': 'off',
      'max-len': 'off',
      'import/prefer-default-export': 'off',
      'no-continue': 'off',
      indent: 'off',
      'consistent-return': 'off',
      'no-underscore-dangle': 'off',
      'arrow-body-style': 'off',
      'no-loop-func': 'off',
      'no-shadow': 'off',
      'prefer-regex-literals': 'off',
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
      'no-promise-executor-return': 'off',
      'newline-per-chained-call': 'off',
      'linebreak-style': 'off',
      'no-plusplus': 'off',
      'no-cond-assign': 'off',
      camelcase: 'off',
      'default-param-last': 'off',
      'class-methods-use-this': 'off',
      'max-classes-per-file': 'off',
      'no-void': 'off',
      'no-control-regex': 'off',
      quotes: 'off',
      'global-require': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
  },
];
