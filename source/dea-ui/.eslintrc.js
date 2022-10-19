// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-config/patch/modern-module-resolution');

module.exports = {
  extends: ['eslint:recommended', '@aws/eslint-config-workbench-core-eslint-custom', 'next/core-web-vitals'],
  parserOptions: { tsconfigRootDir: __dirname },
  plugins: ['testing-library', '@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  overrides: [
    // Only uses Testing Library lint rules in test files
    {
      files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      extends: ['plugin:testing-library/react'],
    },
  ],
  globals: {
    React: true,
    JSX: true,
  },
};
