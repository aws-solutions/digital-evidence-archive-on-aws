/*
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 */

// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-config/patch/modern-module-resolution');

module.exports = {
  extends: [
    'eslint:recommended',
    '@rushstack/eslint-config/profile/node',
    '@rushstack/eslint-config/mixins/tsdoc',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    jest: true,
    node: true,
  },
  rules: {
    '@typescript-eslint/consistent-type-assertions': [
      'warn',
      {
        assertionStyle: 'never',
      },
    ],
    'import/no-unresolved': ['off'],
    'import/named': ['off'],
    'import/order': [
      'error',
      {
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
        groups: ['builtin', 'external', 'parent', 'sibling'],
      },
    ],
    'import/newline-after-import': ['error'],
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'security', 'import'],
  parserOptions: { tsconfigRootDir: __dirname },
};
