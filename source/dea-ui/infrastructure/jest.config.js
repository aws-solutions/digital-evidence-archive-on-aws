module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  coveragePathIgnorePatterns: ['<rootDir>/src/dea-ui-stack.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
};
