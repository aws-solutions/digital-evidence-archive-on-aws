const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  collectCoverage: true,
  collectCoverageFrom: ["src/**"],
  coveragePathIgnorePatterns: ["<rootDir>/src/pages/_app.tsx"],
  coverageDirectory: 'temp/coverage',
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 80,
      functions: 80,
      statements: 90,
    },
  },
  coverageReporters: ['json-summary', 'json', "lcov", 'text'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/pages/(.*)$': '<rootDir>/src/pages/$1',
  },
  testEnvironment: 'jest-environment-jsdom',
  preset: '@cloudscape-design/jest-preset',
};

// see https://github.com/vercel/next.js/issues/35634#issuecomment-1115250297
async function jestConfig() {
  const nextJestConfig = await createJestConfig(customJestConfig)();
  // /node_modules/ is the first pattern
  nextJestConfig.transformIgnorePatterns[0] = '/node_modules/(?!@cloudscape-design)/';
  return nextJestConfig;
}

module.exports = jestConfig;
