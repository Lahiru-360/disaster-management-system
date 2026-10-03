export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  passWithNoTests: true,
  // Coverage counts application code only: the process entry points, env
  // config and seed scripts are not unit-testable logic.
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/core/Server.js',
    '!src/config/**',
    '!scripts/**',
  ],
  coverageReporters: ['text', ['html', { subdir: 'lcov-report' }], 'json-summary'],
};
