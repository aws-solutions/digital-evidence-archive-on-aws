// This is a workaround for https://github.com/eslint/eslint/issues/3458
require('@rushstack/eslint-config/patch/modern-module-resolution');

module.exports = {
  extends: ['eslint:recommended', '@aws/eslint-config-workbench-core-eslint-custom'],
  env: {
    jest: true,
    node: true
  },
  parserOptions: { tsconfigRootDir: __dirname }
};
