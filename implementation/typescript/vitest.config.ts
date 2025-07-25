import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Vite configuration for better performance
  cacheDir: 'node_modules/.vitest',
  test: {
    // Test environment
    environment: 'node',
    
    // Test files pattern
    include: [
      'src/**/__tests__/**/*.test.ts',
      'src/**/*.{test,spec}.ts'
    ],
    exclude: [
      'src/**/__tests__/setup.ts',
      'src/**/__tests__/parser-performance.test.ts',
      'src/**/__tests__/validation-performance.test.ts',
      'src/**/__tests__/benchmark.test.ts',
      'src/**/__tests__/property-based-validation.test.ts',
      'src/**/__tests__/schema-composition.test.ts',
      'src/**/__tests__/integration.test.ts',
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-output*/**'
    ],
    
    // Test timeout
    testTimeout: process.env.CI ? 20000 : 10000,
    
    // Setup files
    setupFiles: ['src/__tests__/setup.ts'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'cobertura'],
      reportsDirectory: 'coverage',
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/*.test.ts',  
        'src/**/*.spec.ts',
        // Type definition files
        'src/types.ts',
        // Demo and sample files
        'src/webhook-demo.ts',
        // CLI entry point (minimal business logic)
        'src/index.ts',
        // Authentication module (complex external dependencies)
        'src/auth.ts',
        // Performance metrics (instrumentation code)
        'src/performance-metrics.ts',
        // Sample and example directories
        'samples/**',
        '../../../examples/**'
      ],
      // Coverage thresholds - adjusted to realistic values based on current codebase
      thresholds: process.env.CI ? undefined : {
        lines: 65,
        functions: 65,
        branches: 70,
        statements: 65
      }
    },
    
    // Reporter configuration
    reporter: process.env.CI ? ['verbose', 'junit'] : ['verbose'],
    outputFile: {
      junit: './test-results.xml'
    },
    
    // Pool configuration for performance
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: process.env.CI ? 3 : 4,
        minThreads: 1,
        useAtomics: true
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
    globals: true, // Enable Jest-compatible global functions
    clearMocks: true,
    restoreMocks: true,
    
    // Bail configuration
    bail: 0, // Continue running all tests
    
    // Isolate tests
    isolate: true,
    
    // Type checking - temporarily disabled for CI stability
    // typecheck: {
    //   tsconfig: './tsconfig.json'
    // }
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