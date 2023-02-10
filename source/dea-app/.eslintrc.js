// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-config/patch/modern-module-resolution');

module.exports = {
  extends: [
    'eslint:recommended',
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
    curly: ['error'],
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'security', 'import'],
  parserOptions: { tsconfigRootDir: __dirname, project: './tsconfig.json' },
};
