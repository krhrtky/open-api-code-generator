import { OpenAPIParser } from '../parser';
import { OpenAPICodeGenerator } from '../generator';
import { ExternalResolverConfig } from '../external-resolver';
import { OpenAPISpec, OpenAPISchema } from '../types';
import { performance } from 'perf_hooks';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';

describe('Parser Performance Tests', () => {
  let parser: OpenAPIParser;
  let generator: OpenAPICodeGenerator;
  let tempDir: string;

  // Mock console.error to prevent test output pollution
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Mock HTTP server configuration for external references
    const mockExternalResolverConfig: ExternalResolverConfig = {
      timeout: 5000,
      maxCacheSize: 100,
      cacheEnabled: true,
      allowedDomains: ['localhost', 'example.com'],
      maxRedirects: 3,
      userAgent: 'Test-Agent/1.0.0',
      retries: 2,
      headers: {}
    };

    parser = new OpenAPIParser(mockExternalResolverConfig);
    
    // Configure parser with performance settings
    parser.configureCaching({ enabled: true, maxSize: 1000 });
    parser.configureMemoryOptimization({ 
      enabled: true, 
      memoryThreshold: 100 * 1024 * 1024,
      streamingMode: false 
    });
    parser.configureMetrics({ enabled: true });

    generator = new OpenAPICodeGenerator({
      outputDir: './test-output',
      basePackage: 'com.test',
      includeValidation: true,
      includeSwagger: true,
      generateModels: true,
      generateControllers: true,
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
    
    tempDir = path.join(__dirname, '..', '..', 'test-temp');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Caching Performance', () => {
    test('should demonstrate cache performance benefits', async () => {
      // Create a spec with repeated schema references
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Cache Test API', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                name: { type: 'string' as const },
                profile: { $ref: '#/components/schemas/Profile' }
              }
            },
            Profile: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                bio: { type: 'string' as const },
                user: { $ref: '#/components/schemas/User' }
              }
            },
            Post: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                title: { type: 'string' as const },
                author: { $ref: '#/components/schemas/User' }
              }
            },
            Comment: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                content: { type: 'string' as const },
                author: { $ref: '#/components/schemas/User' },
                post: { $ref: '#/components/schemas/Post' }
              }
            }
          }
        }
      };

      // Test without caching
      parser.configureCaching({ enabled: false });
      const startTime1 = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await parser.resolveReference(spec, { $ref: '#/components/schemas/User' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/Profile' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/Post' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/Comment' });
      }
      
      const endTime1 = performance.now();
      const timeWithoutCache = endTime1 - startTime1;

      // Test with caching
      parser.configureCaching({ enabled: true, maxSize: 100 });
      const startTime2 = performance.now();
      
      for (let i = 0; i < 100; i++) {
        await parser.resolveReference(spec, { $ref: '#/components/schemas/User' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/Profile' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/Post' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/Comment' });
      }
      
      const endTime2 = performance.now();
      const timeWithCache = endTime2 - startTime2;

      const cacheStats = parser.getCacheStats();
      
      console.log(`Performance comparison:
        Without cache: ${timeWithoutCache.toFixed(2)}ms
        With cache: ${timeWithCache.toFixed(2)}ms
        Improvement: ${((timeWithoutCache - timeWithCache) / timeWithoutCache * 100).toFixed(1)}%
        Cache stats: ${JSON.stringify(cacheStats)}`);

      // Cache should provide significant performance improvement
      expect(timeWithCache).toBeLessThan(timeWithoutCache * 0.8);
      expect(cacheStats.references).toBeGreaterThan(0);
    });

    test('should handle cache eviction under memory pressure', async () => {
      parser.configureCaching({ enabled: true, maxSize: 10 });

      const spec = {
        openapi: '3.0.3',
        info: { title: 'Cache Eviction Test', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Create more schemas than cache size
      for (let i = 0; i < 20; i++) {
        (spec.components.schemas as any)[`Schema${i}`] = {
          type: 'object' as const,
          properties: {
            id: { type: 'integer' as const },
            name: { type: 'string' as const }
          }
        };
      }

      // Resolve all references
      for (let i = 0; i < 20; i++) {
        await parser.resolveReference(spec, { $ref: `#/components/schemas/Schema${i}` });
      }

      const cacheStats = parser.getCacheStats();
      
      // Cache should be limited by maxSize
      expect(cacheStats.references).toBeLessThanOrEqual(10);
      expect(cacheStats.maxSize).toBe(10);

      console.log(`Cache eviction test - cache size: ${cacheStats.references}/${cacheStats.maxSize}`);
    });
  });

  describe('Memory Optimization', () => {
    test('should handle large specifications with memory optimization', async () => {
      parser.configureMemoryOptimization({
        enabled: true,
        memoryThreshold: 100 * 1024 * 1024, // 100MB
        streamingMode: true
      });

      // Create a large spec with many schemas
      const largeSpec = {
        openapi: '3.0.3',
        info: { title: 'Large API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Generate 200 schemas to test streaming mode
      for (let i = 0; i < 200; i++) {
        (largeSpec.components.schemas as any)[`Model${i}`] = {
          type: 'object' as const,
          properties: {
            id: { type: 'integer' as const },
            name: { type: 'string' as const },
            description: { type: 'string' as const },
            status: { type: 'string' as const, enum: ['ACTIVE', 'INACTIVE'] },
            createdAt: { type: 'string' as const, format: 'date-time' },
            updatedAt: { type: 'string' as const, format: 'date-time' }
          },
          required: ['id', 'name']
        };
      }

      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      const schemas = await parser.getAllSchemas(largeSpec);
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const memoryStats = parser.getMemoryStats();

      const processingTime = endTime - startTime;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      console.log(`Large spec processing:
        Schemas processed: ${Object.keys(schemas).length}
        Processing time: ${processingTime.toFixed(2)}ms
        Memory increase: ${memoryIncreaseKB.toFixed(2)} KB
        Memory stats: ${JSON.stringify(memoryStats)}`);

      expect(Object.keys(schemas)).toHaveLength(200);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(memoryStats.memoryOptimized).toBe(true);
      expect(memoryStats.processedSchemas).toBe(200);
    });

    test('should perform memory cleanup during processing', async () => {
      parser.configureMemoryOptimization({
        enabled: true,
        memoryThreshold: 50 * 1024 * 1024, // 50MB - low threshold to trigger cleanup
        streamingMode: true
      });

      const spec = {
        openapi: '3.0.3',
        info: { title: 'Memory Cleanup Test', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Create schemas with large descriptions to increase memory usage
      for (let i = 0; i < 100; i++) {
        (spec.components.schemas as any)[`Schema${i}`] = {
          type: 'object' as const,
          description: 'A'.repeat(1000), // Large description
          properties: {
            id: { type: 'integer' as const },
            data: { 
              type: 'string' as const,
              description: 'B'.repeat(1000)
            }
          }
        };
      }

      const initialStats = parser.getMemoryStats();
      await parser.getAllSchemas(spec);
      const finalStats = parser.getMemoryStats();

      console.log(`Memory cleanup test:
        Initial heap: ${(initialStats.heapUsed / 1024 / 1024).toFixed(2)} MB
        Final heap: ${(finalStats.heapUsed / 1024 / 1024).toFixed(2)} MB
        Cache size: ${finalStats.cacheSize}
        Processed schemas: ${finalStats.processedSchemas}`);

      expect(finalStats.processedSchemas).toBe(100);
      expect(finalStats.memoryOptimized).toBe(true);
    });
  });

  describe('Parallel Processing Performance', () => {
    test('should demonstrate parallel model generation benefits', async () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Parallel Test API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Create 50 schemas to trigger parallel processing
      for (let i = 0; i < 50; i++) {
        (spec.components.schemas as any)[`Model${i}`] = {
          type: 'object' as const,
          properties: {
            id: { type: 'integer' as const },
            name: { type: 'string' as const },
            status: { type: 'string' as const, enum: ['ACTIVE', 'INACTIVE'] },
            metadata: {
              type: 'object' as const,
              properties: {
                created: { type: 'string' as const, format: 'date-time' },
                updated: { type: 'string' as const, format: 'date-time' }
              }
            }
          },
          required: ['id', 'name']
        };
      }

      const specFile = path.join(tempDir, 'parallel-test.yaml');
      await fs.writeFile(specFile, yaml.stringify(spec));

      const outputDir = path.join(tempDir, 'parallel-output');
      generator.updateOutputDirectory(outputDir);

      const startTime = performance.now();
      const result = await generator.generate(specFile);
      const endTime = performance.now();

      const generationTime = endTime - startTime;

      console.log(`Parallel generation test:
        Schemas: 50
        Files generated: ${result.fileCount}
        Generation time: ${generationTime.toFixed(2)}ms
        Average per file: ${(generationTime / result.fileCount).toFixed(2)}ms`);

      expect(result.fileCount).toBeGreaterThanOrEqual(50); // At least one file per model
      expect(generationTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.generatedFiles).toContain(path.join(outputDir, 'build.gradle.kts'));
    });
  });

  describe('Schema Composition Performance', () => {
    test('should handle complex allOf compositions efficiently', async () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Composition Performance Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            BaseEntity: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                createdAt: { type: 'string' as const, format: 'date-time' },
                updatedAt: { type: 'string' as const, format: 'date-time' }
              }
            },
            NamedEntity: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                description: { type: 'string' as const }
              }
            },
            StatusEntity: {
              type: 'object' as const,
              properties: {
                status: { type: 'string' as const, enum: ['ACTIVE', 'INACTIVE'] },
                statusChangedAt: { type: 'string' as const, format: 'date-time' }
              }
            },
            ComplexModel: {
              allOf: [
                { $ref: '#/components/schemas/BaseEntity' },
                { $ref: '#/components/schemas/NamedEntity' },
                { $ref: '#/components/schemas/StatusEntity' },
                {
                  type: 'object' as const,
                  properties: {
                    complexField: {
                      allOf: [
                        { $ref: '#/components/schemas/BaseEntity' },
                        {
                          type: 'object' as const,
                          properties: {
                            nestedData: { type: 'string' as const }
                          }
                        }
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await parser.resolveSchema(spec, spec.components.schemas.ComplexModel);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`Complex allOf composition performance:
        Iterations: ${iterations}
        Total time: ${totalTime.toFixed(2)}ms
        Average per resolution: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(10); // Should resolve complex compositions quickly
    });

    test('should handle oneOf with discriminator efficiently', async () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'OneOf Performance Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            Notification: {
              oneOf: [
                { $ref: '#/components/schemas/EmailNotification' },
                { $ref: '#/components/schemas/SMSNotification' },
                { $ref: '#/components/schemas/PushNotification' }
              ],
              discriminator: {
                propertyName: 'type',
                mapping: {
                  email: '#/components/schemas/EmailNotification',
                  sms: '#/components/schemas/SMSNotification',
                  push: '#/components/schemas/PushNotification'
                }
              }
            },
            EmailNotification: {
              type: 'object' as const,
              required: ['type', 'email'],
              properties: {
                type: { type: 'string' as const, enum: ['email'] },
                email: { type: 'string' as const, format: 'email' },
                subject: { type: 'string' as const },
                body: { type: 'string' as const }
              }
            },
            SMSNotification: {
              type: 'object' as const,
              required: ['type', 'phone'],
              properties: {
                type: { type: 'string' as const, enum: ['sms'] },
                phone: { type: 'string' as const },
                message: { type: 'string' as const }
              }
            },
            PushNotification: {
              type: 'object' as const,
              required: ['type', 'deviceToken'],
              properties: {
                type: { type: 'string' as const, enum: ['push'] },
                deviceToken: { type: 'string' as const },
                title: { type: 'string' as const },
                body: { type: 'string' as const }
              }
            }
          }
        }
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await parser.resolveSchema(spec, spec.components.schemas.Notification);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(`OneOf with discriminator performance:
        Iterations: ${iterations}
        Total time: ${totalTime.toFixed(2)}ms
        Average per resolution: ${avgTime.toFixed(4)}ms`);

      expect(avgTime).toBeLessThan(5); // Should resolve oneOf schemas quickly
    });
  });

  describe('Overall Performance Benchmarks', () => {
    test('should meet performance benchmarks for typical API', async () => {
      // Create a realistic API spec
      const spec = {
        openapi: '3.0.3',
        info: { title: 'E-commerce API', version: '1.0.0' },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              tags: ['users'],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            },
            post: {
              operationId: 'createUser',
              tags: ['users'],
              requestBody: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateUserRequest' }
                  }
                }
              },
              responses: {
                '201': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          },
          '/products': {
            get: {
              operationId: 'getProducts',
              tags: ['products'],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Product' }
                      }
                    }
                  }
                }
              }
            }
          },
          '/orders': {
            get: {
              operationId: 'getOrders',
              tags: ['orders'],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Order' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            User: {
              type: 'object' as const,
              required: ['id', 'email', 'name'],
              properties: {
                id: { type: 'integer' as const },
                email: { type: 'string' as const, format: 'email' },
                name: { type: 'string' as const },
                profile: { $ref: '#/components/schemas/UserProfile' }
              }
            },
            UserProfile: {
              type: 'object' as const,
              properties: {
                bio: { type: 'string' as const },
                avatar: { type: 'string' as const, format: 'uri' },
                preferences: { $ref: '#/components/schemas/UserPreferences' }
              }
            },
            UserPreferences: {
              type: 'object' as const,
              properties: {
                theme: { type: 'string' as const, enum: ['light', 'dark'] },
                notifications: { type: 'boolean' as const }
              }
            },
            CreateUserRequest: {
              type: 'object' as const,
              required: ['email', 'name'],
              properties: {
                email: { type: 'string' as const, format: 'email' },
                name: { type: 'string' as const },
                password: { type: 'string' as const, minLength: 8 }
              }
            },
            Product: {
              type: 'object' as const,
              required: ['id', 'name', 'price'],
              properties: {
                id: { type: 'integer' as const },
                name: { type: 'string' as const },
                description: { type: 'string' as const },
                price: { type: 'number' as const },
                category: { $ref: '#/components/schemas/Category' }
              }
            },
            Category: {
              type: 'object' as const,
              required: ['id', 'name'],
              properties: {
                id: { type: 'integer' as const },
                name: { type: 'string' as const },
                parent: { $ref: '#/components/schemas/Category' }
              }
            },
            Order: {
              type: 'object' as const,
              required: ['id', 'user', 'items', 'total'],
              properties: {
                id: { type: 'integer' as const },
                user: { $ref: '#/components/schemas/User' },
                items: {
                  type: 'array' as const,
                  items: { $ref: '#/components/schemas/OrderItem' }
                },
                total: { type: 'number' as const },
                status: { type: 'string' as const, enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] }
              }
            },
            OrderItem: {
              type: 'object' as const,
              required: ['product', 'quantity', 'price'],
              properties: {
                product: { $ref: '#/components/schemas/Product' },
                quantity: { type: 'integer' as const },
                price: { type: 'number' as const }
              }
            }
          }
        }
      };

      const specFile = path.join(tempDir, 'ecommerce-api.yaml');
      await fs.writeFile(specFile, yaml.stringify(spec));

      const outputDir = path.join(tempDir, 'benchmark-output');
      generator.updateOutputDirectory(outputDir);

      const startTime = performance.now();
      const result = await generator.generate(specFile);
      const endTime = performance.now();

      const totalTime = endTime - startTime;

      console.log(`Performance benchmark - E-commerce API:
        Schemas: ${Object.keys(spec.components.schemas).length}
        Endpoints: ${Object.keys(spec.paths).length}
        Files generated: ${result.fileCount}
        Total generation time: ${totalTime.toFixed(2)}ms
        Time per schema: ${(totalTime / Object.keys(spec.components.schemas).length).toFixed(2)}ms`);

      // Performance benchmarks
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.fileCount).toBeGreaterThanOrEqual(10); // Should generate multiple files
      expect(totalTime / Object.keys(spec.components.schemas).length).toBeLessThan(500); // < 500ms per schema
    });
  });
});