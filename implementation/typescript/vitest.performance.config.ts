import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite configuration for better performance
  cacheDir: 'node_modules/.vitest',
  test: {
    // Test environment
    environment: 'node',
    
    // Test files pattern - only include performance tests
    include: [
      'src/**/__tests__/benchmark.test.ts',
      'src/**/__tests__/parser-performance.test.ts',
      'src/**/__tests__/validation-performance.test.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-output*/**'
    ],
    
    // Test timeout - extended for performance tests
    testTimeout: process.env.CI ? 60000 : 30000,
    
    // Setup files
    setupFiles: ['src/__tests__/setup.ts'],
    
    // Coverage configuration - disabled for performance tests
    coverage: {
      enabled: false
    },
    
    // Reporter configuration
    reporter: process.env.CI ? ['verbose', 'junit'] : ['verbose'],
    outputFile: {
      junit: './performance-test-results.xml'
    },
    
    // Pool configuration for performance
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    
    // Performance optimizations
    cache: {
      dir: 'node_modules/.vitest'
    },
    
    // Watch mode configuration
    watchExclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-output*/**'
    ],
    
    // Global test configuration
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    
    // Bail configuration
    bail: 0, // Continue running all tests
    
    // Isolate tests
    isolate: true
  },
  
  // Vite configuration for test compilation
  esbuild: {
    target: 'node16'
  },
  
  // Module resolution
  resolve: {
    alias: {
      '@': './src'
    }
  }
});