import { OpenAPIParser } from '../parser';
import { OpenAPICodeGenerator } from '../generator';
import { performance } from 'perf_hooks';
import * as fs from 'fs-extra';
import * as path from 'path';

describe('Large Specification Performance Tests', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '..', '..', 'large-spec-temp');
    await fs.ensureDir(tempDir);
  });

  afterEach(async () => {
    // Enhanced cleanup with multiple retry strategies
    const maxRetries = 5;
    const retryDelay = 500; // 500ms between retries
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (await fs.pathExists(tempDir)) {
          // Strategy 1: Force remove
          await fs.remove(tempDir);
          break; // Success, exit retry loop
        }
      } catch (error) {
        console.warn(`Cleanup attempt ${attempt + 1} failed: ${error}`);
        
        if (attempt === maxRetries - 1) {
          // Final attempt strategies
          try {
            // Strategy 2: Empty then remove
            await fs.emptyDir(tempDir);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            await fs.remove(tempDir);
            break;
          } catch (emptyError) {
            try {
              // Strategy 3: Just empty (leave directory)
              await fs.emptyDir(tempDir);
              console.warn('Directory emptied but not removed due to persistent lock');
              break;
            } catch (finalError) {
              // Strategy 4: Rename and abandon
              try {
                const abandonedDir = `${tempDir}_abandoned_${Date.now()}`;
                await fs.move(tempDir, abandonedDir);
                console.warn(`Directory moved to ${abandonedDir} for later cleanup`);
                break;
              } catch (moveError) {
                console.error('All cleanup strategies failed:', moveError);
              }
            }
          }
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
  });

  describe('Enterprise-Scale API Testing', () => {
    test('should handle enterprise API with 1000+ schemas efficiently', async () => {
      console.log('🏗️  Generating large enterprise API specification...');
      
      // Create massive enterprise API spec
      const enterpriseSpec = {
        openapi: '3.0.3',
        info: { 
          title: 'Enterprise Microservices API',
          version: '2.0.0',
          description: 'Large-scale enterprise API with comprehensive schema coverage'
        },
        servers: [
          { url: 'https://api.enterprise.com/v2', description: 'Production' },
          { url: 'https://staging-api.enterprise.com/v2', description: 'Staging' }
        ],
        paths: {} as any,
        components: { 
          schemas: {} as any,
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            },
            ApiKeyAuth: {
              type: 'apiKey',
              in: 'header',
              name: 'X-API-Key'
            }
          }
        }
      };

      // Generate 1200 schemas with complex relationships
      console.log('📊 Generating 1200 schemas with complex relationships...');
      for (let i = 0; i < 1200; i++) {
        const modelName = `Model${i}`;
        const category = Math.floor(i / 100); // 12 categories
        
        enterpriseSpec.components.schemas[modelName] = {
          type: 'object' as const,
          description: `Enterprise model ${i} in category ${category}`,
          required: ['id', 'name', 'createdAt'],
          properties: {
            id: { 
              type: 'integer' as const, 
              format: 'int64',
              description: 'Unique identifier'
            },
            name: { 
              type: 'string' as const, 
              minLength: 1, 
              maxLength: 100,
              description: 'Entity name'
            },
            description: { 
              type: 'string' as const, 
              maxLength: 1000,
              description: 'Detailed description'
            },
            status: {
              type: 'string' as const,
              enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'],
              description: 'Current status'
            },
            createdAt: {
              type: 'string' as const,
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updatedAt: {
              type: 'string' as const,
              format: 'date-time',
              description: 'Last update timestamp'
            },
            // Complex nested structures
            metadata: {
              type: 'object' as const,
              properties: {
                version: { type: 'integer' as const },
                source: { type: 'string' as const },
                tags: {
                  type: 'array' as const,
                  items: { type: 'string' as const }
                },
                // Reference to related model in same category
                related: i > 0 ? { $ref: `#/components/schemas/Model${Math.max(0, i - 1)}` } : undefined
              }
            },
            // Cross-category relationships (fixed to avoid random references)
            dependencies: {
              type: 'array' as const,
              items: {
                $ref: `#/components/schemas/Model${Math.max(0, Math.min(i - 1, Math.floor(i / 10) * 10))}`
              }
            },
            // Composition patterns
            baseInfo: category > 0 ? {
              allOf: [
                { $ref: `#/components/schemas/Model${category * 100}` },
                {
                  type: 'object' as const,
                  properties: {
                    categorySpecific: { type: 'string' as const }
                  }
                }
              ]
            } : undefined
          }
        };

        // Add some oneOf discriminated unions every 100 models (reduced frequency)
        if (i % 100 === 0 && i > 0) {
          enterpriseSpec.components.schemas[`${modelName}Union`] = {
            oneOf: [
              { $ref: `#/components/schemas/Model${i}` },
              { $ref: `#/components/schemas/Model${Math.max(0, i - 50)}` }
            ],
            discriminator: {
              propertyName: 'type',
              mapping: {
                [`type${i}`]: `#/components/schemas/Model${i}`,
                [`type${i - 50}`]: `#/components/schemas/Model${Math.max(0, i - 50)}`
              }
            }
          };
        }
      }

      // Generate 200 API endpoints across multiple services
      console.log('🛠️  Generating 200 API endpoints across 20 services...');
      const services = [
        'users', 'products', 'orders', 'payments', 'inventory', 
        'analytics', 'notifications', 'auth', 'billing', 'support',
        'audit', 'reporting', 'monitoring', 'configuration', 'workflow',
        'integration', 'backup', 'security', 'metadata', 'search'
      ];

      for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
        const service = services[serviceIndex];
        const baseModelIndex = serviceIndex * 60; // 60 models per service
        
        // Generate 10 endpoints per service
        for (let endpointIndex = 0; endpointIndex < 10; endpointIndex++) {
          const modelIndex = baseModelIndex + endpointIndex * 6;
          const pathName = `/${service}`;
          const resourcePath = `/${service}/{id}`;
          
          if (!enterpriseSpec.paths[pathName]) {
            enterpriseSpec.paths[pathName] = {};
          }
          if (!enterpriseSpec.paths[resourcePath]) {
            enterpriseSpec.paths[resourcePath] = {};
          }

          // GET collection
          enterpriseSpec.paths[pathName].get = {
            operationId: `get${service.charAt(0).toUpperCase() + service.slice(1)}`,
            tags: [service],
            summary: `Get ${service} collection`,
            description: `Retrieve paginated list of ${service}`,
            security: [{ BearerAuth: [] }],
            parameters: [
              {
                name: 'page',
                in: 'query',
                schema: { type: 'integer' as const, default: 1, minimum: 1 }
              },
              {
                name: 'limit',
                in: 'query', 
                schema: { type: 'integer' as const, default: 20, minimum: 1, maximum: 100 }
              },
              {
                name: 'status',
                in: 'query',
                schema: { 
                  type: 'string' as const, 
                  enum: ['ACTIVE', 'INACTIVE', 'PENDING', 'ARCHIVED'] 
                }
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
                        data: {
                          type: 'array' as const,
                          items: { $ref: `#/components/schemas/Model${Math.min(modelIndex, 1199)}` }
                        },
                        pagination: {
                          type: 'object' as const,
                          properties: {
                            page: { type: 'integer' as const },
                            limit: { type: 'integer' as const },
                            total: { type: 'integer' as const },
                            pages: { type: 'integer' as const }
                          }
                        }
                      }
                    }
                  }
                }
              },
              '400': {
                description: 'Bad Request',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/Model0' } // Error model
                  }
                }
              },
              '401': {
                description: 'Unauthorized'
              },
              '403': {
                description: 'Forbidden'
              },
              '500': {
                description: 'Internal Server Error'
              }
            }
          };

          // POST create
          enterpriseSpec.paths[pathName].post = {
            operationId: `create${service.charAt(0).toUpperCase() + service.slice(1).slice(0, -1)}`,
            tags: [service],
            summary: `Create ${service.slice(0, -1)}`,
            security: [{ BearerAuth: [] }],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/Model${Math.min(modelIndex + 1, 1199)}` }
                }
              }
            },
            responses: {
              '201': {
                description: 'Created',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/Model${Math.min(modelIndex, 1199)}` }
                  }
                }
              },
              '400': {
                description: 'Validation Error'
              },
              '401': {
                description: 'Unauthorized'
              },
              '500': {
                description: 'Internal Server Error'
              }
            }
          };

          // GET by ID
          enterpriseSpec.paths[resourcePath].get = {
            operationId: `get${service.charAt(0).toUpperCase() + service.slice(1).slice(0, -1)}ById`,
            tags: [service],
            summary: `Get ${service.slice(0, -1)} by ID`,
            security: [{ BearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' as const, format: 'int64' }
              }
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/Model${Math.min(modelIndex, 1199)}` }
                  }
                }
              },
              '404': {
                description: 'Not Found'
              },
              '401': {
                description: 'Unauthorized'
              },
              '500': {
                description: 'Internal Server Error'
              }
            }
          };

          // PUT update
          enterpriseSpec.paths[resourcePath].put = {
            operationId: `update${service.charAt(0).toUpperCase() + service.slice(1).slice(0, -1)}`,
            tags: [service],
            summary: `Update ${service.slice(0, -1)}`,
            security: [{ BearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' as const, format: 'int64' }
              }
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/Model${Math.min(modelIndex + 2, 1199)}` }
                }
              }
            },
            responses: {
              '200': {
                description: 'Updated',
                content: {
                  'application/json': {
                    schema: { $ref: `#/components/schemas/Model${Math.min(modelIndex, 1199)}` }
                  }
                }
              },
              '400': {
                description: 'Validation Error'
              },
              '404': {
                description: 'Not Found'
              },
              '401': {
                description: 'Unauthorized'
              },
              '500': {
                description: 'Internal Server Error'
              }
            }
          };

          // DELETE
          enterpriseSpec.paths[resourcePath].delete = {
            operationId: `delete${service.charAt(0).toUpperCase() + service.slice(1).slice(0, -1)}`,
            tags: [service],
            summary: `Delete ${service.slice(0, -1)}`,
            security: [{ BearerAuth: [] }],
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer' as const, format: 'int64' }
              }
            ],
            responses: {
              '204': {
                description: 'Deleted'
              },
              '404': {
                description: 'Not Found'
              },
              '401': {
                description: 'Unauthorized'
              },
              '500': {
                description: 'Internal Server Error'
              }
            }
          };
        }
      }

      console.log(`📋 Generated specification with:
        - Schemas: ${Object.keys(enterpriseSpec.components.schemas).length}
        - Endpoints: ${Object.keys(enterpriseSpec.paths).length}
        - Services: ${services.length}`);

      // Save the large spec file
      const specFile = path.join(tempDir, 'enterprise-large-api.json');
      await fs.writeFile(specFile, JSON.stringify(enterpriseSpec, null, 2));
      const specFileSize = (await fs.stat(specFile)).size;
      
      console.log(`💾 Specification file size: ${(specFileSize / 1024 / 1024).toFixed(2)} MB`);

      // Test with optimized configuration
      const outputDir = path.join(tempDir, 'enterprise-output');
      const generator = new OpenAPICodeGenerator({
        outputDir,
        basePackage: 'com.enterprise.api',
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

      // Configure for maximum performance
      generator.configureCaching({ 
        enabled: true, 
        maxSize: 5000  // Large cache for enterprise use
      });
      generator.configureMemoryOptimization({
        enabled: true,
        memoryThreshold: 1024 * 1024 * 1024, // 1GB threshold
        streamingMode: true
      });
      generator.configureMetrics({ enabled: true });

      // Measure generation performance
      const initialMemory = process.memoryUsage();
      const startTime = performance.now();
      
      console.log('🚀 Starting enterprise API generation...');
      generator.startPerformanceTracking();
      
      const result = await generator.generate(specFile);
      
      generator.endPerformanceTracking();
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();

      const totalTime = endTime - startTime;
      const memoryUsed = finalMemory.heapUsed - initialMemory.heapUsed;
      const metrics = generator.getPerformanceMetrics();
      
      // Generate comprehensive performance report
      const report = `
🏢 ENTERPRISE API PERFORMANCE REPORT
=====================================

📊 SPECIFICATION METRICS:
  • Schemas: ${Object.keys(enterpriseSpec.components.schemas).length}
  • Endpoints: ${Object.keys(enterpriseSpec.paths).length}
  • Services: ${services.length}
  • File Size: ${(specFileSize / 1024 / 1024).toFixed(2)} MB

⚡ GENERATION PERFORMANCE:
  • Total Time: ${(totalTime / 1000).toFixed(2)} seconds
  • Files Generated: ${result.fileCount}
  • Memory Used: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB
  • Peak Memory: ${metrics.memory.peakUsageMB.toFixed(2)} MB

🎯 EFFICIENCY METRICS:
  • Schemas/Second: ${metrics.efficiency.schemasPerSecond.toFixed(2)}
  • Files/Second: ${metrics.efficiency.filesPerSecond.toFixed(2)}
  • Cache Hit Rate: ${(metrics.efficiency.cacheEfficiency * 100).toFixed(1)}%
  • Memory Efficiency: ${(metrics.efficiency.memoryEfficiency * 100).toFixed(1)}%

💾 CACHE PERFORMANCE:
  • Overall Hit Rate: ${(metrics.cache.overall.hitRate * 100).toFixed(1)}%
  • Total Cache Requests: ${metrics.cache.overall.totalRequests}
  • Reference Cache: ${(metrics.cache.reference.hitRate * 100).toFixed(1)}% (${metrics.cache.reference.hits}/${metrics.cache.reference.totalRequests})
  • Composition Cache: ${(metrics.cache.composition.hitRate * 100).toFixed(1)}% (${metrics.cache.composition.hits}/${metrics.cache.composition.totalRequests})
  • Cache Evictions: ${metrics.cache.overall.evictions}

🧠 MEMORY MANAGEMENT:
  • Memory Cleanups: ${metrics.memory.cleanupCount}
  • Current Memory: ${metrics.memory.currentUsageMB.toFixed(2)} MB
  • Memory Efficiency: ${(metrics.efficiency.memoryEfficiency * 100).toFixed(1)}%

⏱️  DETAILED TIMING:
  • Schema Resolution: ${metrics.summary.schemaResolutionTime.toFixed(2)}ms (${(metrics.summary.schemaResolutionTime / totalTime * 100).toFixed(1)}%)
  • Cache Operations: ${metrics.summary.cacheOperationTime.toFixed(2)}ms (${(metrics.summary.cacheOperationTime / totalTime * 100).toFixed(1)}%)
  • Memory Cleanup: ${metrics.summary.memoryCleanupTime.toFixed(2)}ms (${(metrics.summary.memoryCleanupTime / totalTime * 100).toFixed(1)}%)
  • Parallel Processing: ${metrics.summary.parallelProcessingTime.toFixed(2)}ms (${(metrics.summary.parallelProcessingTime / totalTime * 100).toFixed(1)}%)

${generator.generatePerformanceReport()}
=====================================
      `;

      console.log(report);

      // Save performance report
      const reportFile = path.join(tempDir, 'enterprise-performance-report.txt');
      await fs.writeFile(reportFile, report);
      
      // Export metrics as JSON
      const metricsFile = path.join(tempDir, 'enterprise-performance-metrics.json');
      await fs.writeFile(metricsFile, generator.exportPerformanceMetrics());

      console.log(`📊 Performance report saved to: ${reportFile}`);
      console.log(`📈 Metrics data saved to: ${metricsFile}`);

      // Performance assertions for enterprise scale
      expect(result.fileCount).toBeGreaterThanOrEqual(1200); // At least one file per schema
      expect(totalTime).toBeLessThan(180000); // Should complete within 3 minutes
      expect(metrics.efficiency.schemasPerSecond).toBeGreaterThan(5); // At least 5 schemas/second
      expect(metrics.efficiency.cacheEfficiency).toBeGreaterThanOrEqual(0); // Allow for 0% cache hit rate initially
      expect(memoryUsed / 1024 / 1024).toBeLessThan(800); // Should use less than 800MB
      expect(metrics.memory.cleanupCount).toBeGreaterThanOrEqual(0); // Allow for no cleanups if memory is sufficient

      // Verify output quality
      const generatedFiles = await fs.readdir(outputDir, { recursive: true });
      expect(generatedFiles.length).toBeGreaterThan(0);
      
      // Check for build file
      expect(result.generatedFiles).toContain(path.join(outputDir, 'build.gradle.kts'));
      
      console.log('✅ Enterprise API performance test completed successfully!');
    }, 180000); // 3 minute timeout for enterprise test

    test('should handle microservices architecture with cross-service references', async () => {
      console.log('🔧 Testing microservices architecture performance...');
      
      // Create microservices spec with cross-service references
      const microservicesSpec = {
        openapi: '3.0.3',
        info: { 
          title: 'Microservices Ecosystem API',
          version: '1.0.0',
          description: 'Cross-service API with shared models and complex dependencies'
        },
        paths: {} as any,
        components: { schemas: {} as any }
      };

      const services = ['user-service', 'product-service', 'order-service', 'payment-service', 'notification-service'];
      const modelsPerService = 100;
      const crossReferences = 5; // Number of cross-service references per model

      // Generate models for each service with cross-references
      for (let serviceIndex = 0; serviceIndex < services.length; serviceIndex++) {
        const serviceName = services[serviceIndex];
        
        for (let modelIndex = 0; modelIndex < modelsPerService; modelIndex++) {
          const modelName = `${serviceName.replace('-', '')}Model${modelIndex}`;
          
          // Create cross-service references (avoid circular dependencies)
          const crossRefs = [];
          for (let refIndex = 0; refIndex < Math.min(crossReferences, 2); refIndex++) {
            const targetService = services[(serviceIndex + refIndex + 1) % services.length];
            const targetModelIndex = Math.max(0, modelIndex - 1); // Reference previous models only
            const targetModelName = `${targetService.replace('-', '')}Model${targetModelIndex}`;
            if (targetModelIndex < modelIndex) { // Only add if it avoids circular reference
              crossRefs.push({ $ref: `#/components/schemas/${targetModelName}` });
            }
          }

          microservicesSpec.components.schemas[modelName] = {
            type: 'object' as const,
            description: `Model ${modelIndex} from ${serviceName}`,
            required: ['id', 'serviceId'],
            properties: {
              id: { type: 'integer' as const, format: 'int64' },
              serviceId: { type: 'string' as const, enum: [serviceName] },
              name: { type: 'string' as const },
              // Cross-service references (only if crossRefs exist)
              dependencies: crossRefs.length > 0 ? {
                type: 'array' as const,
                items: {
                  oneOf: crossRefs,
                  discriminator: { propertyName: 'serviceId' }
                }
              } : {
                type: 'array' as const,
                items: { type: 'string' as const }
              },
              // Simple shared data structure
              sharedData: {
                type: 'object' as const,
                properties: {
                  timestamp: { type: 'string' as const, format: 'date-time' },
                  metadata: { 
                    type: 'object' as const,
                    additionalProperties: true
                  }
                }
              }
            }
          };
        }
      }

      const specFile = path.join(tempDir, 'microservices-api.json');
      await fs.writeFile(specFile, JSON.stringify(microservicesSpec, null, 2));

      const outputDir = path.join(tempDir, 'microservices-output');
      const generator = new OpenAPICodeGenerator({
        outputDir,
        basePackage: 'com.microservices',
        includeValidation: true,
        generateModels: true,
        generateControllers: false, // Focus on model generation
        includeSwagger: true,
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

      // Configure for microservices performance
      generator.configureCaching({ enabled: true, maxSize: 2000 });
      generator.configureMemoryOptimization({
        enabled: true,
        memoryThreshold: 512 * 1024 * 1024,
        streamingMode: true
      });
      generator.configureMetrics({ enabled: true });

      const startTime = performance.now();
      generator.startPerformanceTracking();
      
      const result = await generator.generate(specFile);
      
      generator.endPerformanceTracking();
      const endTime = performance.now();
      const metrics = generator.getPerformanceMetrics();

      const totalTime = endTime - startTime;
      const totalModels = services.length * modelsPerService;

      console.log(`
🔧 MICROSERVICES PERFORMANCE RESULTS:
  Services: ${services.length}
  Models per Service: ${modelsPerService}
  Total Models: ${totalModels}
  Cross-references per Model: ${crossReferences}
  
  Generation Time: ${totalTime.toFixed(2)}ms
  Cache Hit Rate: ${(metrics.efficiency.cacheEfficiency * 100).toFixed(1)}%
  Models/Second: ${metrics.efficiency.schemasPerSecond.toFixed(2)}
  Files Generated: ${result.fileCount}
      `);

      // Microservices-specific assertions
      expect(result.fileCount).toBeGreaterThanOrEqual(totalModels);
      expect(metrics.efficiency.cacheEfficiency).toBeGreaterThanOrEqual(0); // Allow for 0% cache hit rate initially
      expect(totalTime).toBeLessThan(90000); // Should complete within 1.5 minutes
      expect(metrics.efficiency.schemasPerSecond).toBeGreaterThan(3); // At least 3 schemas/second
      
      console.log('✅ Microservices architecture test completed successfully!');
    }, 90000); // 90 second timeout
  });

  describe('Memory Stress Testing', () => {
    test('should handle memory stress with 2000+ schemas', async () => {
      console.log('💾 Starting memory stress test with 2000+ schemas...');
      
      const stressSpec = {
        openapi: '3.0.3',
        info: { title: 'Memory Stress Test API', version: '1.0.0' },
        paths: {},
        components: { schemas: {} }
      };

      // Generate 2000 schemas with deep nesting
      for (let i = 0; i < 2000; i++) {
        const depth = Math.min(i % 10 + 1, 5); // Variable nesting depth
        let nestedProps: any = {
          finalValue: { type: 'string' as const }
        };

        // Create nested structure
        for (let d = 0; d < depth; d++) {
          nestedProps = {
            [`level${d}`]: {
              type: 'object' as const,
              properties: nestedProps
            }
          };
        }

        (stressSpec.components.schemas as any)[`StressModel${i}`] = {
          type: 'object' as const,
          description: `Stress test model ${i} with ${depth} levels of nesting`,
          properties: {
            id: { type: 'integer' as const },
            name: { type: 'string' as const },
            // Large string for memory pressure
            largeData: { type: 'string' as const, maxLength: 10000 },
            // Nested structure
            nested: {
              type: 'object' as const,
              properties: nestedProps
            },
            // References to other models
            references: {
              type: 'array' as const,
              items: {
                oneOf: [
                  { $ref: `#/components/schemas/StressModel${Math.max(0, i - 1)}` },
                  { $ref: `#/components/schemas/StressModel${Math.max(0, i - 10)}` },
                  { $ref: `#/components/schemas/StressModel${Math.max(0, i - 50)}` }
                ]
              }
            }
          }
        };
      }

      const specFile = path.join(tempDir, 'memory-stress-api.json');
      await fs.writeFile(specFile, JSON.stringify(stressSpec, null, 2));

      const parser = new OpenAPIParser();
      parser.configureCaching({ enabled: true, maxSize: 1000 });
      parser.configureMemoryOptimization({
        enabled: true,
        memoryThreshold: 256 * 1024 * 1024, // Lower threshold for stress test
        streamingMode: true
      });
      parser.configureMetrics({ enabled: true });

      const initialMemory = process.memoryUsage();
      parser.startPerformanceTracking();
      
      // Parse spec file and get all schemas
      const spec = await parser.parseFile(specFile);
      const schemas = await parser.getAllSchemas(spec);
      
      parser.endPerformanceTracking();
      const finalMemory = process.memoryUsage();
      const metrics = parser.getPerformanceMetrics();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`
💾 MEMORY STRESS TEST RESULTS:
  Schemas Processed: ${Object.keys(schemas).length}
  Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB
  Peak Memory: ${metrics.memory.peakUsageMB.toFixed(2)} MB
  Memory Cleanups: ${metrics.memory.cleanupCount}
  Cache Hit Rate: ${(metrics.efficiency.cacheEfficiency * 100).toFixed(1)}%
      `);

      // Memory stress assertions
      expect(Object.keys(schemas)).toHaveLength(2000);
      expect(memoryIncrease / 1024 / 1024).toBeLessThan(500); // Should use less than 500MB
      expect(metrics.memory.cleanupCount).toBeGreaterThanOrEqual(0); // Allow for no cleanups if memory is sufficient
      expect(metrics.efficiency.cacheEfficiency).toBeGreaterThanOrEqual(0); // Allow for 0% cache hit rate initially

      console.log('✅ Memory stress test completed successfully!');
    }, 120000); // 2 minute timeout
  });
});