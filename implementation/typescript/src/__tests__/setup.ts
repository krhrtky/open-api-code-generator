// Vitest setup file for schema composition tests
import { beforeAll, afterAll, expect } from 'vitest';

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Mock console.log for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeAll(() => {
  // Suppress console output during tests unless in verbose mode
  if (!process.env.VERBOSE_TESTS) {
    console.log = () => {};
    console.error = () => {};
  }
});

afterAll(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Helper function for test utilities
declare module 'vitest' {
  interface Assertion<T = any> {
    toContainValidKotlinClass(): T;
    toHaveValidPackageDeclaration(): T;
    toContainRequiredImports(): T;
  }
}

// Custom Vitest matchers for Kotlin code validation
expect.extend({
  toContainValidKotlinClass(received: string) {
    const hasPackage = /^package\s+[\w.]+/m.test(received);
    const hasClass = /(data\s+class|sealed\s+class|interface)\s+\w+/.test(received);
    
    if (hasPackage && hasClass) {
      return {
        message: () => `Expected content not to contain valid Kotlin class`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected content to contain valid Kotlin class with package declaration`,
        pass: false,
      };
    }
  },

  toHaveValidPackageDeclaration(received: string) {
    const packageMatch = received.match(/^package\s+([\w.]+)/m);
    
    if (packageMatch && packageMatch[1]) {
      const packageName = packageMatch[1];
      const isValid = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/.test(packageName);
      
      if (isValid) {
        return {
          message: () => `Expected package declaration to be invalid`,
          pass: true,
        };
      } else {
        return {
          message: () => `Expected valid package declaration, got: ${packageName}`,
          pass: false,
        };
      }
    } else {
      return {
        message: () => `Expected content to have package declaration`,
        pass: false,
      };
    }
  },

  toContainRequiredImports(received: string) {
    const importLines = received.split('\n').filter(line => line.startsWith('import'));
    const hasValidImports = importLines.every(line => 
      /^import\s+[\w.]+(\.\*)?$/.test(line.trim())
    );
    
    if (hasValidImports && importLines.length > 0) {
      return {
        message: () => `Expected content not to contain required imports`,
        pass: true,
      };
    } else {
      return {
        message: () => `Expected content to contain valid import statements`,
        pass: false,
      };
    }
  },
});

// Test utilities
export const testUtils = {
  /**
   * Extract class name from Kotlin file content
   */
  extractClassName(content: string): string | null {
    const match = content.match(/(data\s+class|sealed\s+class|interface)\s+(\w+)/);
    return match ? match[2] : null;
  },

  /**
   * Extract all property names from Kotlin data class
   */
  extractPropertyNames(content: string): string[] {
    const propertyMatches = content.match(/val\s+(\w+):/g);
    return propertyMatches ? propertyMatches.map(match => match.replace(/val\s+(\w+):/, '$1')) : [];
  },

  /**
   * Check if content contains specific annotation
   */
  hasAnnotation(content: string, annotation: string): boolean {
    return content.includes(`@${annotation}`);
  },

  /**
   * Validate Kotlin syntax basics
   */
  validateKotlinSyntax(content: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check package declaration
    if (!content.match(/^package\s+[\w.]+/m)) {
      errors.push('Missing or invalid package declaration');
    }

    // Check class declaration
    if (!content.match(/(data\s+class|sealed\s+class|interface)\s+\w+/)) {
      errors.push('Missing or invalid class declaration');
    }

    // Check for syntax errors
    if (content.includes(';;')) {
      errors.push('Double semicolons detected');
    }

    if (content.includes(',,')) {
      errors.push('Double commas detected');
    }

    // Check proper import format
    const importLines = content.split('\n').filter(line => line.startsWith('import'));
    for (const importLine of importLines) {
      if (!importLine.match(/^import\s+[\w.]+(\.\*)?$/)) {
        errors.push(`Invalid import: ${importLine}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};