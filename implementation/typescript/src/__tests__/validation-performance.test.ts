import { ValidationRuleService } from '../validation';
import { ConditionalValidator } from '../conditional-validation';
import { OpenAPICodeGenerator } from '../generator';
import { performance } from 'perf_hooks';

describe('Validation Performance Tests', () => {
  let validationService: ValidationRuleService;
  let conditionalValidator: ConditionalValidator;
  let generator: OpenAPICodeGenerator;

  beforeEach(() => {
    validationService = new ValidationRuleService();
    conditionalValidator = new ConditionalValidator();
    generator = new OpenAPICodeGenerator({
      outputDir: './test-output',
      basePackage: 'com.test',
      includeValidation: true,
      includeSwagger: true,
      generateModels: true,
      generateControllers: false,
      verbose: false,
      i18n: {
        t: (key: string, options?: any) => {
          if (options) {
            return key.replace(/\{\{(\w+)\}\}/g, (_, prop) => options[prop] || '');
          }
          return key;
        }
      }
    });
  });

  describe('Conditional Validation Performance', () => {
    test('should evaluate simple conditions quickly', () => {
      const iterations = 10000;
      const conditions = [
        "userType == 'admin'",
        "age >= 18",
        "status == 'ACTIVE'",
        "verified == true"
      ];

      const context = {
        userType: 'admin',
        age: 25,
        status: 'ACTIVE',
        verified: true
      };

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const condition = conditions[i % conditions.length];
        conditionalValidator.evaluateCondition(condition, context);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Simple conditions: ${iterations} evaluations in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(4)}ms)`);
      
      // Performance assertion: should be under 0.1ms per evaluation
      expect(avgTime).toBeLessThan(0.1);
    });

    test.skip('should evaluate complex conditions efficiently', () => {
      const iterations = 1000;
      const complexConditions = [
        "userType in ['admin', 'superadmin'] AND age >= 21 AND verified == true",
        "(accountType == 'business' AND revenue > 100000) OR (creditScore >= 700 AND employmentStatus == 'employed')",
        "status == 'ACTIVE' AND (lastLogin > '2023-01-01' OR accountType == 'premium')",
        "age >= 18 AND country == 'US' AND (income > 50000 OR hasCollateral == true)"
      ];

      const context = {
        userType: 'admin',
        age: 25,
        verified: true,
        accountType: 'business',
        revenue: 150000,
        creditScore: 750,
        employmentStatus: 'employed',
        status: 'ACTIVE',
        lastLogin: '2023-06-01',
        country: 'US',
        income: 60000,
        hasCollateral: false
      };

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const condition = complexConditions[i % complexConditions.length];
        conditionalValidator.evaluateCondition(condition, context);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Complex conditions: ${iterations} evaluations in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(4)}ms)`);
      
      // Performance assertion: should be under 1ms per evaluation
      expect(avgTime).toBeLessThan(1.0);
    });

    test('should handle large context objects efficiently', () => {
      const iterations = 1000;
      
      // Create large context object with 100 properties
      const largeContext: Record<string, any> = {};
      for (let i = 0; i < 100; i++) {
        largeContext[`field${i}`] = i % 2 === 0 ? `value${i}` : i;
      }
      largeContext.userType = 'admin';
      largeContext.status = 'ACTIVE';

      const condition = "userType == 'admin' AND status == 'ACTIVE'";

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        conditionalValidator.evaluateCondition(condition, largeContext);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Large context: ${iterations} evaluations in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(4)}ms)`);
      
      // Performance assertion: should handle large contexts efficiently
      expect(avgTime).toBeLessThan(0.5);
    });
  });

  describe('Validation Rule Service Performance', () => {
    test('should register validation rules quickly', () => {
      const ruleCount = 1000;
      
      const startTime = performance.now();

      for (let i = 0; i < ruleCount; i++) {
        validationService.registerValidationRule(`TestRule${i}`, {
          name: `TestRule${i}`,
          annotationClass: `@TestRule${i}`,
          imports: [`com.validation.TestRule${i}`],
          validationLogic: `return value != null && value.length() > ${i};`,
          defaultMessage: `Test rule ${i} validation failed`
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / ruleCount;

      console.log(`Rule registration: ${ruleCount} rules in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(4)}ms)`);
      
      // Performance assertion: should register rules quickly
      expect(avgTime).toBeLessThan(0.1);
    });

    test('should retrieve validation rules efficiently', () => {
      // Pre-register rules
      const ruleCount = 100;
      for (let i = 0; i < ruleCount; i++) {
        validationService.registerValidationRule(`Rule${i}`, {
          name: `Rule${i}`,
          annotationClass: `@Rule${i}`,
          imports: [`com.validation.Rule${i}`],
          validationLogic: 'return true;'
        });
      }

      const iterations = 10000;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const ruleName = `Rule${i % ruleCount}`;
        validationService.getValidationRule(ruleName);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Rule retrieval: ${iterations} retrievals in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(4)}ms)`);
      
      // Performance assertion: should retrieve rules very quickly
      expect(avgTime).toBeLessThan(0.01);
    });
  });

  describe('Memory Usage Performance', () => {
    test('should not leak memory during repeated validation', () => {
      const iterations = 1000;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const context = {
          userType: 'admin',
          age: 25 + (i % 10),
          status: i % 2 === 0 ? 'ACTIVE' : 'INACTIVE'
        };

        conditionalValidator.evaluateCondition("userType == 'admin' AND age >= 18", context);
        
        // Force garbage collection every 100 iterations
        if (i % 100 === 0 && global.gc) {
          global.gc();
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreaseKB = memoryIncrease / 1024;

      console.log(`Memory usage: increased by ${memoryIncreaseKB.toFixed(2)} KB after ${iterations} validations`);
      
      // Memory assertion: should not increase by more than 2MB
      expect(memoryIncrease).toBeLessThan(2 * 1024 * 1024);
    });
  });

  describe('Large Schema Performance', () => {
    test('should handle large OpenAPI schemas efficiently', async () => {
      // Create large schema with many validation rules
      const largeSchema = {
        openapi: '3.0.3',
        info: { title: 'Large Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {}
        }
      };

      // Generate 50 schemas with validation rules
      for (let i = 0; i < 50; i++) {
        (largeSchema.components.schemas as any)[`Model${i}`] = {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string', minLength: 1 },
            email: {
              type: 'string',
              format: 'email',
              'x-validation': {
                customValidations: ['EmailUnique']
              }
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE'],
              'x-validation': {
                conditionalValidations: [
                  {
                    condition: `userType == 'admin'`,
                    validations: ['NotNull'],
                    message: 'Status required for admin'
                  }
                ]
              }
            }
          }
        };
      }

      const startTime = performance.now();

      // Simulate processing large schema
      const models = Object.keys(largeSchema.components.schemas);
      for (const modelName of models) {
        const schema = (largeSchema.components.schemas as any)[modelName];
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const validation = (propSchema as any)['x-validation'];
            if (validation?.conditionalValidations) {
              for (const rule of validation.conditionalValidations) {
                conditionalValidator.evaluateCondition(rule.condition, { userType: 'admin' });
              }
            }
          }
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Large schema processing: 50 models processed in ${totalTime.toFixed(2)}ms`);
      
      // Performance assertion: should process large schemas in reasonable time
      expect(totalTime).toBeLessThan(1000); // Less than 1 second
    });

    test('should handle deep nesting efficiently', () => {
      const iterations = 1000;
      
      // Create deeply nested condition
      const deepCondition = Array.from({ length: 20 }, (_, i) => 
        `level${i} == 'value${i}'`
      ).join(' AND ');

      const deepContext: Record<string, any> = {};
      for (let i = 0; i < 20; i++) {
        deepContext[`level${i}`] = `value${i}`;
      }

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        conditionalValidator.evaluateCondition(deepCondition, deepContext);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Deep nesting: ${iterations} evaluations in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(4)}ms)`);
      
      // Performance assertion: should handle deep nesting efficiently
      expect(avgTime).toBeLessThan(2.0);
    });
  });

  describe('Concurrent Validation Performance', () => {
    test('should handle concurrent validations efficiently', async () => {
      const concurrentTasks = 100;
      const validationsPerTask = 100;

      const tasks = Array.from({ length: concurrentTasks }, (_, taskId) => {
        return new Promise<number>((resolve) => {
          const startTime = performance.now();
          
          for (let i = 0; i < validationsPerTask; i++) {
            const context = {
              userType: taskId % 2 === 0 ? 'admin' : 'user',
              age: 18 + (i % 50),
              taskId
            };
            
            conditionalValidator.evaluateCondition(
              "userType == 'admin' AND age >= 18",
              context
            );
          }
          
          const endTime = performance.now();
          resolve(endTime - startTime);
        });
      });

      const startTime = performance.now();
      const taskTimes = await Promise.all(tasks);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const totalValidations = concurrentTasks * validationsPerTask;
      const avgTimePerValidation = totalTime / totalValidations;

      console.log(`Concurrent validation: ${totalValidations} validations across ${concurrentTasks} tasks in ${totalTime.toFixed(2)}ms`);
      console.log(`Average time per validation: ${avgTimePerValidation.toFixed(4)}ms`);
      
      // Performance assertion: concurrent execution should be efficient
      expect(totalTime).toBeLessThan(5000); // Less than 5 seconds
      expect(avgTimePerValidation).toBeLessThan(0.1);
    });
  });

  describe('Cache Performance', () => {
    test('should benefit from condition caching', () => {
      const iterations = 10000;
      const condition = "userType == 'admin' AND status == 'ACTIVE'";
      const context = {
        userType: 'admin',
        status: 'ACTIVE'
      };

      // First run - no cache
      const startTime1 = performance.now();
      for (let i = 0; i < iterations; i++) {
        conditionalValidator.evaluateCondition(condition, context);
      }
      const endTime1 = performance.now();
      const timeWithoutCache = endTime1 - startTime1;

      // Second run - with cache (same condition and context)
      const startTime2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        conditionalValidator.evaluateCondition(condition, context);
      }
      const endTime2 = performance.now();
      const timeWithCache = endTime2 - startTime2;

      console.log(`Cache performance: without cache ${timeWithoutCache.toFixed(2)}ms, with cache ${timeWithCache.toFixed(2)}ms`);
      
      // Cache should provide some performance benefit
      // Note: This test assumes the ConditionalValidator implements caching
      expect(timeWithCache).toBeLessThanOrEqual(timeWithoutCache);
    });
  });
});