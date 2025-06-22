module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  testPathIgnorePatterns: [
    'setup.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'cobertura'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 15000, // Reduced from 30s to 15s for faster feedback
  maxWorkers: '50%', // Use 50% of available CPU cores for better parallelization
  // Worker pool settings for better resource management
  workerIdleMemoryLimit: '512MB',
  moduleFileExtensions: ['ts', 'js', 'json'],
  verbose: false, // Reduced verbosity for faster output
  cache: true, // Enable Jest cache
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  // Performance optimizations
  clearMocks: true,
  resetMocks: true,
  resetModules: false,
  restoreMocks: true,
  // Worker process cleanup
  detectOpenHandles: true,
  forceExit: true,
  // Fast fail for quicker feedback
  bail: false, // Continue running tests even if some fail
  // Optimize file watching
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/test-output*/'
  ],
  // Module resolution optimization
  modulePathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/test-output*/'
  ],
  // TypeScript compilation optimization
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        skipLibCheck: true, // Skip type checking of declaration files
      }
    }],
  }
};