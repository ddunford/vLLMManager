module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/tests/**',
    '!server/index.js',
    '!server/data/**',
    '!server/logs/**',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/server/tests/setup.js'],
  testTimeout: 10000,
}; 