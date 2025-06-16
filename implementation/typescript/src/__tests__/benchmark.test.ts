import { OpenAPIParser } from '../parser';
import { OpenAPICodeGenerator } from '../generator';
import { performance } from 'perf_hooks';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Performance Benchmark Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', '..', 'benchmark-temp');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('Caching Performance Benchmarks', () => {
    test('should demonstrate significant performance improvement with caching', async () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Benchmark API', version: '1.0.0' },
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
                settings: { $ref: '#/components/schemas/Settings' }
              }
            },
            Settings: {
              type: 'object' as const,
              properties: {
                theme: { type: 'string' as const },
                notifications: { type: 'boolean' as const },
                profile: { $ref: '#/components/schemas/Profile' }
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

      const iterations = 200;
      const references = [
        '#/components/schemas/User',
        '#/components/schemas/Profile', 
        '#/components/schemas/Settings',
        '#/components/schemas/Post',
        '#/components/schemas/Comment'
      ];

      // Benchmark WITHOUT caching
      const parserWithoutCache = new OpenAPIParser();
      parserWithoutCache.configureCaching({ enabled: false });
      parserWithoutCache.configureMetrics({ enabled: true });
      
      parserWithoutCache.startPerformanceTracking();
      const startTime1 = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        for (const refPath of references) {
          await parserWithoutCache.resolveReference(spec, { $ref: refPath });
        }
      }
      
      const endTime1 = performance.now();
      parserWithoutCache.endPerformanceTracking();
      const timeWithoutCache = endTime1 - startTime1;
      const metricsWithoutCache = parserWithoutCache.getPerformanceMetrics();

      // Benchmark WITH caching
      const parserWithCache = new OpenAPIParser();
      parserWithCache.configureCaching({ enabled: true, maxSize: 100 });
      parserWithCache.configureMetrics({ enabled: true });
      
      parserWithCache.startPerformanceTracking();
      const startTime2 = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        for (const refPath of references) {
          await parserWithCache.resolveReference(spec, { $ref: refPath });
        }
      }
      
      const endTime2 = performance.now();
      parserWithCache.endPerformanceTracking();
      const timeWithCache = endTime2 - startTime2;
      const metricsWithCache = parserWithCache.getPerformanceMetrics();

      const improvement = ((timeWithoutCache - timeWithCache) / timeWithoutCache) * 100;
      const totalOperations = iterations * references.length;

      console.log(`
=== CACHING PERFORMANCE BENCHMARK ===
Operations: ${totalOperations} (${iterations} iterations × ${references.length} references)

WITHOUT CACHING:
  Total Time: ${timeWithoutCache.toFixed(2)}ms
  Operations/Second: ${(totalOperations / (timeWithoutCache / 1000)).toFixed(0)}
  Avg Time/Operation: ${(timeWithoutCache / totalOperations).toFixed(4)}ms
  Cache Hit Rate: ${(metricsWithoutCache.cache.overall.hitRate * 100).toFixed(1)}%

WITH CACHING:
  Total Time: ${timeWithCache.toFixed(2)}ms
  Operations/Second: ${(totalOperations / (timeWithCache / 1000)).toFixed(0)}
  Avg Time/Operation: ${(timeWithCache / totalOperations).toFixed(4)}ms
  Cache Hit Rate: ${(metricsWithCache.cache.overall.hitRate * 100).toFixed(1)}%

IMPROVEMENT:
  Time Reduction: ${improvement.toFixed(1)}%
  Speed Increase: ${(timeWithoutCache / timeWithCache).toFixed(1)}x faster
      `);

      // Assertions
      expect(improvement).toBeGreaterThan(70); // At least 70% improvement
      expect(metricsWithCache.cache.overall.hitRate).toBeGreaterThan(0.9); // >90% cache hit rate
      expect(timeWithCache).toBeLessThan(timeWithoutCache * 0.3); // At least 3x faster
    });

    test('should show cache efficiency across different cache types', async () => {
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Cache Types Test', version: '1.0.0' },
        paths: {},
        components: {
          schemas: {
            BaseEntity: {
              type: 'object' as const,
              properties: {
                id: { type: 'integer' as const },
                createdAt: { type: 'string' as const, format: 'date-time' }
              }
            },
            ComplexComposition: {
              allOf: [
                { $ref: '#/components/schemas/BaseEntity' },
                {
                  type: 'object' as const,
                  properties: {
                    name: { type: 'string' as const },
                    nested: {
                      oneOf: [
                        { $ref: '#/components/schemas/TypeA' },
                        { $ref: '#/components/schemas/TypeB' }
                      ],
                      discriminator: { propertyName: 'type' }
                    }
                  }
                }
              ]
            },
            TypeA: {
              type: 'object' as const,
              required: ['type'],
              properties: {
                type: { type: 'string' as const, enum: ['A'] },
                dataA: { type: 'string' as const }
              }
            },
            TypeB: {
              type: 'object' as const, 
              required: ['type'],
              properties: {
                type: { type: 'string' as const, enum: ['B'] },
                dataB: { type: 'integer' as const }
              }
            }
          }
        }
      };

      const parser = new OpenAPIParser();
      parser.configureCaching({ enabled: true, maxSize: 50 });
      parser.configureMetrics({ enabled: true });
      
      parser.startPerformanceTracking();
      
      // Test reference caching
      for (let i = 0; i < 50; i++) {
        await parser.resolveReference(spec, { $ref: '#/components/schemas/BaseEntity' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/TypeA' });
        await parser.resolveReference(spec, { $ref: '#/components/schemas/TypeB' });
      }
      
      // Test composition caching
      for (let i = 0; i < 30; i++) {
        await parser.resolveSchema(spec, spec.components.schemas.ComplexComposition);
      }
      
      parser.endPerformanceTracking();
      const metrics = parser.getPerformanceMetrics();

      console.log(`
=== CACHE TYPE EFFICIENCY ===
Reference Cache:
  Hit Rate: ${(metrics.cache.reference.hitRate * 100).toFixed(1)}%
  Hits: ${metrics.cache.reference.hits}
  Misses: ${metrics.cache.reference.misses}
  Size: ${metrics.cache.reference.size}/${metrics.cache.reference.maxSize}

Composition Cache:
  Hit Rate: ${(metrics.cache.composition.hitRate * 100).toFixed(1)}%
  Hits: ${metrics.cache.composition.hits}
  Misses: ${metrics.cache.composition.misses}
  Size: ${metrics.cache.composition.size}/${metrics.cache.composition.maxSize}

Overall Cache:
  Hit Rate: ${(metrics.cache.overall.hitRate * 100).toFixed(1)}%
  Total Requests: ${metrics.cache.overall.totalRequests}
  Evictions: ${metrics.cache.overall.evictions}
      `);

      expect(metrics.cache.reference.hitRate).toBeGreaterThan(0.85);
      expect(metrics.cache.composition.hitRate).toBeGreaterThan(0.8);
      expect(metrics.cache.overall.hitRate).toBeGreaterThan(0.8);
    });
  });

  describe('Memory Optimization Benchmarks', () => {
    test('should show memory efficiency for large specifications', async () => {
      // Create a large spec with many schemas
      const largeSpec = {
        openapi: '3.0.3',
        info: { title: 'Large API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Generate 500 schemas to test memory efficiency
      for (let i = 0; i < 500; i++) {
        (largeSpec.components.schemas as any)[`Model${i}`] = {
          type: 'object' as const,
          properties: {
            id: { type: 'integer' as const },
            name: { type: 'string' as const },
            description: { type: 'string' as const },
            data: {
              type: 'object' as const,
              properties: {
                field1: { type: 'string' as const },
                field2: { type: 'integer' as const },
                field3: { type: 'boolean' as const },
                nested: { $ref: `#/components/schemas/Model${Math.max(0, i - 1)}` }
              }
            }
          },
          required: ['id', 'name']
        };
      }

      // Test WITHOUT memory optimization
      const parserWithoutOpt = new OpenAPIParser();
      parserWithoutOpt.configureMemoryOptimization({ enabled: false });
      parserWithoutOpt.configureMetrics({ enabled: true });

      const initialMemory1 = process.memoryUsage();
      parserWithoutOpt.startPerformanceTracking();
      const startTime1 = performance.now();
      
      const schemas1 = await parserWithoutOpt.getAllSchemas(largeSpec);
      
      const endTime1 = performance.now();
      parserWithoutOpt.endPerformanceTracking();
      const finalMemory1 = process.memoryUsage();
      const metrics1 = parserWithoutOpt.getPerformanceMetrics();

      // Test WITH memory optimization
      const parserWithOpt = new OpenAPIParser();
      parserWithOpt.configureMemoryOptimization({ 
        enabled: true, 
        memoryThreshold: 100 * 1024 * 1024, // 100MB
        streamingMode: true 
      });
      parserWithOpt.configureMetrics({ enabled: true });

      const initialMemory2 = process.memoryUsage();
      parserWithOpt.startPerformanceTracking();
      const startTime2 = performance.now();
      
      const schemas2 = await parserWithOpt.getAllSchemas(largeSpec);
      
      const endTime2 = performance.now();
      parserWithOpt.endPerformanceTracking();
      const finalMemory2 = process.memoryUsage();
      const metrics2 = parserWithOpt.getPerformanceMetrics();

      const memoryIncrease1 = finalMemory1.heapUsed - initialMemory1.heapUsed;
      const memoryIncrease2 = finalMemory2.heapUsed - initialMemory2.heapUsed;
      const memoryImprovement = ((memoryIncrease1 - memoryIncrease2) / memoryIncrease1) * 100;

      console.log(`
=== MEMORY OPTIMIZATION BENCHMARK ===
Schemas Processed: ${Object.keys(schemas1).length}

WITHOUT MEMORY OPTIMIZATION:
  Processing Time: ${(endTime1 - startTime1).toFixed(2)}ms
  Memory Increase: ${(memoryIncrease1 / 1024 / 1024).toFixed(2)} MB
  Peak Memory: ${(metrics1.memory.peakUsageMB).toFixed(2)} MB
  Memory Cleanups: ${metrics1.memory.cleanupCount}

WITH MEMORY OPTIMIZATION:
  Processing Time: ${(endTime2 - startTime2).toFixed(2)}ms
  Memory Increase: ${(memoryIncrease2 / 1024 / 1024).toFixed(2)} MB
  Peak Memory: ${(metrics2.memory.peakUsageMB).toFixed(2)} MB
  Memory Cleanups: ${metrics2.memory.cleanupCount}

IMPROVEMENT:
  Memory Reduction: ${memoryImprovement.toFixed(1)}%
  Peak Memory Reduction: ${(((metrics1.memory.peakUsageMB - metrics2.memory.peakUsageMB) / metrics1.memory.peakUsageMB) * 100).toFixed(1)}%
      `);

      expect(Object.keys(schemas1)).toHaveLength(500);
      expect(Object.keys(schemas2)).toHaveLength(500);
      expect(memoryImprovement).toBeGreaterThan(20); // At least 20% memory reduction
      expect(metrics2.memory.cleanupCount).toBeGreaterThan(0); // Should trigger cleanups
    });
  });

  describe('Parallel Processing Benchmarks', () => {
    test('should demonstrate parallel processing performance gains', async () => {
      // Create spec with many schemas to trigger parallel processing
      const spec = {
        openapi: '3.0.3',
        info: { title: 'Parallel Processing Test', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Create 100 schemas to ensure parallel processing kicks in
      for (let i = 0; i < 100; i++) {
        (spec.components.schemas as any)[`Model${i}`] = {
          type: 'object' as const,
          properties: {
            id: { type: 'integer' as const },
            name: { type: 'string' as const },
            description: { type: 'string' as const },
            status: { type: 'string' as const, enum: ['ACTIVE', 'INACTIVE'] },
            metadata: {
              type: 'object' as const,
              properties: {
                created: { type: 'string' as const, format: 'date-time' },
                updated: { type: 'string' as const, format: 'date-time' },
                tags: {
                  type: 'array' as const,
                  items: { type: 'string' as const }
                }
              }
            }
          },
          required: ['id', 'name']
        };
      }

      // Add paths to test controller generation
      spec.paths = {
        '/models': {
          get: {
            operationId: 'getModels',
            tags: ['models'],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array' as const,
                      items: { $ref: '#/components/schemas/Model0' }
                    }
                  }
                }
              }
            }
          }
        },
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
                      type: 'array' as const,
                      items: { $ref: '#/components/schemas/Model1' }
                    }
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
                description: 'Success'
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
                description: 'Success'
              }
            }
          }
        }
      };

      const specFile = path.join(tempDir, 'parallel-benchmark.json');
      await fs.writeFile(specFile, JSON.stringify(spec, null, 2));

      // Test generation with parallel processing
      const outputDir = path.join(tempDir, 'parallel-output');
      const generator = new OpenAPICodeGenerator({
        outputDir,
        basePackage: 'com.benchmark',
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

      const startTime = performance.now();
      const result = await generator.generate(specFile);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const schemasPerSecond = Object.keys(spec.components.schemas).length / (totalTime / 1000);
      const filesPerSecond = result.fileCount / (totalTime / 1000);

      console.log(`
=== PARALLEL PROCESSING BENCHMARK ===
Schemas: ${Object.keys(spec.components.schemas).length}
Controllers: ${Object.keys(spec.paths).length}
Files Generated: ${result.fileCount}

PERFORMANCE:
  Total Time: ${totalTime.toFixed(2)}ms
  Schemas/Second: ${schemasPerSecond.toFixed(2)}
  Files/Second: ${filesPerSecond.toFixed(2)}
  Avg Time/Schema: ${(totalTime / Object.keys(spec.components.schemas).length).toFixed(2)}ms
      `);

      expect(result.fileCount).toBeGreaterThanOrEqual(100); // At least one file per model
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(schemasPerSecond).toBeGreaterThan(5); // Should process at least 5 schemas per second
    });
  });

  describe('End-to-End Performance Benchmarks', () => {
    test('should benchmark complete generation workflow', async () => {
      // Create realistic e-commerce API spec
      const ecommerceSpec = {
        openapi: '3.0.3',
        info: { 
          title: 'E-commerce API Benchmark', 
          version: '1.0.0',
          description: 'Complete e-commerce API for performance testing'
        },
        servers: [
          { url: 'https://api.example.com', description: 'Production server' }
        ],
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              tags: ['users'],
              summary: 'Get all users',
              parameters: [
                {
                  name: 'page',
                  in: 'query',
                  schema: { type: 'integer' as const, default: 1 }
                },
                {
                  name: 'limit', 
                  in: 'query',
                  schema: { type: 'integer' as const, default: 20 }
                }
              ],
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object' as const,
                        properties: {
                          users: {
                            type: 'array' as const,
                            items: { $ref: '#/components/schemas/User' }
                          },
                          pagination: { $ref: '#/components/schemas/Pagination' }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              operationId: 'createUser',
              tags: ['users'],
              summary: 'Create a new user',
              requestBody: {
                required: true,
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
                        type: 'array' as const,
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
                        type: 'array' as const,
                        items: { $ref: '#/components/schemas/Order' }
                      }
                    }
                  }
                }
              }
            },
            post: {
              operationId: 'createOrder',
              tags: ['orders'],
              requestBody: {
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/CreateOrderRequest' }
                  }
                }
              },
              responses: {
                '201': {
                  description: 'Created',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/Order' }
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
                id: { type: 'integer' as const, format: 'int64' },
                email: { type: 'string' as const, format: 'email' },
                name: { type: 'string' as const, minLength: 1, maxLength: 100 },
                profile: { $ref: '#/components/schemas/UserProfile' },
                addresses: {
                  type: 'array' as const,
                  items: { $ref: '#/components/schemas/Address' }
                }
              }
            },
            UserProfile: {
              type: 'object' as const,
              properties: {
                bio: { type: 'string' as const, maxLength: 500 },
                avatar: { type: 'string' as const, format: 'uri' },
                preferences: { $ref: '#/components/schemas/UserPreferences' }
              }
            },
            UserPreferences: {
              type: 'object' as const,
              properties: {
                theme: { type: 'string' as const, enum: ['light', 'dark'] },
                notifications: { type: 'boolean' as const, default: true },
                language: { type: 'string' as const, default: 'en' }
              }
            },
            CreateUserRequest: {
              type: 'object' as const,
              required: ['email', 'name', 'password'],
              properties: {
                email: { type: 'string' as const, format: 'email' },
                name: { type: 'string' as const, minLength: 1, maxLength: 100 },
                password: { type: 'string' as const, minLength: 8 }
              }
            },
            Product: {
              type: 'object' as const,
              required: ['id', 'name', 'price'],
              properties: {
                id: { type: 'integer' as const, format: 'int64' },
                name: { type: 'string' as const, minLength: 1, maxLength: 200 },
                description: { type: 'string' as const, maxLength: 1000 },
                price: { type: 'number' as const, format: 'decimal', minimum: 0 },
                category: { $ref: '#/components/schemas/Category' },
                images: {
                  type: 'array' as const,
                  items: { type: 'string' as const, format: 'uri' }
                },
                inventory: { $ref: '#/components/schemas/Inventory' }
              }
            },
            Category: {
              type: 'object' as const,
              required: ['id', 'name'],
              properties: {
                id: { type: 'integer' as const, format: 'int64' },
                name: { type: 'string' as const, minLength: 1, maxLength: 100 },
                parent: { $ref: '#/components/schemas/Category' }
              }
            },
            Inventory: {
              type: 'object' as const,
              required: ['quantity', 'inStock'],
              properties: {
                quantity: { type: 'integer' as const, minimum: 0 },
                inStock: { type: 'boolean' as const },
                location: { type: 'string' as const }
              }
            },
            Order: {
              type: 'object' as const,
              required: ['id', 'user', 'items', 'total', 'status'],
              properties: {
                id: { type: 'integer' as const, format: 'int64' },
                user: { $ref: '#/components/schemas/User' },
                items: {
                  type: 'array' as const,
                  items: { $ref: '#/components/schemas/OrderItem' }
                },
                total: { type: 'number' as const, format: 'decimal', minimum: 0 },
                status: {
                  type: 'string' as const,
                  enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
                },
                shipping: { $ref: '#/components/schemas/ShippingInfo' },
                payment: { $ref: '#/components/schemas/PaymentInfo' }
              }
            },
            OrderItem: {
              type: 'object' as const,
              required: ['product', 'quantity', 'price'],
              properties: {
                product: { $ref: '#/components/schemas/Product' },
                quantity: { type: 'integer' as const, minimum: 1 },
                price: { type: 'number' as const, format: 'decimal', minimum: 0 }
              }
            },
            CreateOrderRequest: {
              type: 'object' as const,
              required: ['items', 'shipping'],
              properties: {
                items: {
                  type: 'array' as const,
                  items: {
                    type: 'object' as const,
                    properties: {
                      productId: { type: 'integer' as const },
                      quantity: { type: 'integer' as const, minimum: 1 }
                    }
                  }
                },
                shipping: { $ref: '#/components/schemas/Address' }
              }
            },
            Address: {
              type: 'object' as const,
              required: ['street', 'city', 'country'],
              properties: {
                street: { type: 'string' as const, minLength: 1, maxLength: 200 },
                city: { type: 'string' as const, minLength: 1, maxLength: 100 },
                state: { type: 'string' as const, maxLength: 100 },
                postalCode: { type: 'string' as const, maxLength: 20 },
                country: { type: 'string' as const, minLength: 2, maxLength: 2 }
              }
            },
            ShippingInfo: {
              type: 'object' as const,
              properties: {
                method: { type: 'string' as const },
                trackingNumber: { type: 'string' as const },
                estimatedDelivery: { type: 'string' as const, format: 'date' },
                address: { $ref: '#/components/schemas/Address' }
              }
            },
            PaymentInfo: {
              type: 'object' as const,
              properties: {
                method: { type: 'string' as const, enum: ['CREDIT_CARD', 'PAYPAL', 'BANK_TRANSFER'] },
                status: { type: 'string' as const, enum: ['PENDING', 'COMPLETED', 'FAILED'] },
                transactionId: { type: 'string' as const }
              }
            },
            Pagination: {
              type: 'object' as const,
              properties: {
                page: { type: 'integer' as const, minimum: 1 },
                limit: { type: 'integer' as const, minimum: 1, maximum: 100 },
                total: { type: 'integer' as const, minimum: 0 },
                pages: { type: 'integer' as const, minimum: 0 }
              }
            }
          }
        }
      };

      const specFile = path.join(tempDir, 'ecommerce-benchmark.json');
      await fs.writeFile(specFile, JSON.stringify(ecommerceSpec, null, 2));

      // Create optimized generator
      const outputDir = path.join(tempDir, 'ecommerce-output');
      const generator = new OpenAPICodeGenerator({
        outputDir,
        basePackage: 'com.ecommerce',
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

      // Configure parser for optimal performance
      generator.parser.configureCaching({ enabled: true, maxSize: 200 });
      generator.parser.configureMemoryOptimization({
        enabled: true,
        memoryThreshold: 200 * 1024 * 1024,
        streamingMode: true
      });
      generator.parser.configureMetrics({ enabled: true });

      const initialMemory = process.memoryUsage();
      const startTime = performance.now();

      generator.parser.startPerformanceTracking();
      const result = await generator.generate(specFile);
      generator.parser.endPerformanceTracking();

      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      const metrics = generator.parser.getPerformanceMetrics();

      const totalTime = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
      const schemasCount = Object.keys(ecommerceSpec.components.schemas).length;
      const endpointsCount = Object.keys(ecommerceSpec.paths).length;

      console.log(`
=== END-TO-END PERFORMANCE BENCHMARK ===
API Specification:
  Schemas: ${schemasCount}
  Endpoints: ${endpointsCount}
  Files Generated: ${result.fileCount}

PERFORMANCE METRICS:
  Total Generation Time: ${totalTime.toFixed(2)}ms
  Memory Used: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB
  Peak Memory: ${metrics.memory.peakUsageMB.toFixed(2)} MB

EFFICIENCY:
  Schemas/Second: ${metrics.efficiency.schemasPerSecond.toFixed(2)}
  Files/Second: ${metrics.efficiency.filesPerSecond.toFixed(2)}
  Cache Hit Rate: ${(metrics.efficiency.cacheEfficiency * 100).toFixed(1)}%
  Memory Efficiency: ${(metrics.efficiency.memoryEfficiency * 100).toFixed(1)}%

DETAILED PERFORMANCE:
${generator.parser.generatePerformanceReport()}
      `);

      // Performance assertions
      expect(result.fileCount).toBeGreaterThanOrEqual(schemasCount); // At least one file per schema
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(metrics.efficiency.cacheEfficiency).toBeGreaterThan(0.7); // >70% cache hit rate
      expect(metrics.efficiency.schemasPerSecond).toBeGreaterThan(2); // At least 2 schemas/second
      expect(memoryUsed / 1024 / 1024).toBeLessThan(100); // Should use less than 100MB

      // Verify files were actually generated
      const generatedFiles = await fs.readdir(outputDir, { recursive: true });
      expect(generatedFiles.length).toBeGreaterThan(0);
    });
  });
});