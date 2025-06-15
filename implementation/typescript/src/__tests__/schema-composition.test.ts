import { OpenAPIParser } from '../parser';
import { OpenAPICodeGenerator } from '../generator';
import { GeneratorConfig } from '../types';
import { I18nService } from '../i18n';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

describe('Schema Composition Tests', () => {
  let parser: OpenAPIParser;
  let generator: OpenAPICodeGenerator;
  let tempDir: string;
  let config: GeneratorConfig;

  beforeEach(async () => {
    parser = new OpenAPIParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openapi-test-'));
    
    const i18n = new I18nService();
    await i18n.initialize();
    
    config = {
      outputDir: tempDir,
      basePackage: 'com.example.test',
      generateModels: true,
      generateControllers: true,
      includeValidation: true,
      includeSwagger: true,
      verbose: false,
      i18n
    };
    
    generator = new OpenAPICodeGenerator(config);
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  describe('allOf Schema Composition', () => {
    const allOfExamplePath = path.join(__dirname, '../../../../examples/allof-inheritance-example.yaml');

    test('should parse allOf inheritance example correctly', async () => {
      const spec = await parser.parseFile(allOfExamplePath);
      
      expect(spec).toBeDefined();
      expect(spec.info.title).toBe('allOf Inheritance Example');
      expect(spec.components?.schemas).toBeDefined();
      
      // Check key schemas exist
      expect(spec.components!.schemas!['Employee']).toBeDefined();
      expect(spec.components!.schemas!['ElectricCar']).toBeDefined();
      expect(spec.components!.schemas!['BaseEntity']).toBeDefined();
      expect(spec.components!.schemas!['Person']).toBeDefined();
    });

    test('should resolve allOf schemas correctly', async () => {
      // Test allOf resolution logic
      const mockSpec = {
        components: {
          schemas: {
            BaseEntity: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'integer', format: 'int64' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            },
            Person: {
              type: 'object',
              required: ['firstName', 'lastName'],
              properties: {
                firstName: { type: 'string' },
                lastName: { type: 'string' }
              }
            }
          }
        }
      } as any;

      const allOfSchema = {
        allOf: [
          { $ref: '#/components/schemas/BaseEntity' },
          { $ref: '#/components/schemas/Person' },
          {
            type: 'object' as const,
            required: ['email'],
            properties: {
              email: { type: 'string' as const, format: 'email' }
            }
          }
        ]
      };

      const resolved = await parser.resolveSchema(mockSpec, allOfSchema);
      
      expect(resolved.type).toBe('object');
      expect(resolved.properties).toBeDefined();
      expect(resolved.properties!['id']).toBeDefined();
      expect(resolved.properties!['firstName']).toBeDefined();
      expect(resolved.properties!['email']).toBeDefined();
      expect(resolved.required).toContain('id');
      expect(resolved.required).toContain('firstName');
      expect(resolved.required).toContain('email');
    });

    test('should generate Kotlin classes for allOf schemas', async () => {
      const spec = await parser.parseFile(allOfExamplePath);
      const result = await generator.generate(allOfExamplePath);
      
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      
      // Check that Employee class file exists
      const employeeFile = result.generatedFiles.find(f => f.includes('Employee.kt'));
      expect(employeeFile).toBeDefined();
      
      if (employeeFile) {
        const content = await fs.readFile(employeeFile, 'utf-8');
        expect(content).toContain('data class Employee');
        expect(content).toContain('val id: Long');
        expect(content).toContain('val firstName: String');
        expect(content).toContain('val employeeId: String');
      }
    });

    test('should handle allOf property conflicts', async () => {
      const mockSpec = {
        components: {
          schemas: {
            Schema1: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                conflictProp: { type: 'string' }
              }
            },
            Schema2: {
              type: 'object',
              properties: {
                age: { type: 'integer' },
                conflictProp: { type: 'integer' } // Different type - should cause error
              }
            }
          }
        }
      } as any;

      const allOfSchema = {
        allOf: [
          { $ref: '#/components/schemas/Schema1' },
          { $ref: '#/components/schemas/Schema2' }
        ]
      };

      await expect(async () => {
        await parser.resolveSchema(mockSpec, allOfSchema);
      }).rejects.toThrow(/conflicting types/);
    });
  });

  describe('oneOf Schema Composition', () => {
    const oneOfExamplePath = path.join(__dirname, '../../../../examples/oneof-polymorphism-example.yaml');

    test('should parse oneOf polymorphism example correctly', async () => {
      const spec = await parser.parseFile(oneOfExamplePath);
      
      expect(spec).toBeDefined();
      expect(spec.info.title).toBe('oneOf Polymorphism Example');
      expect(spec.components?.schemas).toBeDefined();
      
      // Check key schemas exist
      expect(spec.components!.schemas!['Event']).toBeDefined();
      expect(spec.components!.schemas!['UserRegistrationEvent']).toBeDefined();
      expect(spec.components!.schemas!['OrderPlacedEvent']).toBeDefined();
      expect(spec.components!.schemas!['Document']).toBeDefined();
    });

    test('should resolve oneOf schemas correctly', async () => {
      const mockSpec = {
        components: {
          schemas: {
            EmailNotification: {
              type: 'object',
              required: ['type', 'email'],
              properties: {
                type: { type: 'string', enum: ['email'] },
                email: { type: 'string', format: 'email' },
                subject: { type: 'string' }
              }
            },
            SMSNotification: {
              type: 'object',
              required: ['type', 'phone'],
              properties: {
                type: { type: 'string', enum: ['sms'] },
                phone: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      } as any;

      const oneOfSchema = {
        oneOf: [
          { $ref: '#/components/schemas/EmailNotification' },
          { $ref: '#/components/schemas/SMSNotification' }
        ],
        discriminator: {
          propertyName: 'type',
          mapping: {
            email: '#/components/schemas/EmailNotification',
            sms: '#/components/schemas/SMSNotification'
          }
        }
      };

      const resolved = await parser.resolveSchema(mockSpec, oneOfSchema);
      
      expect(resolved.oneOfVariants).toBeDefined();
      expect(resolved.oneOfVariants).toHaveLength(2);
      expect(resolved.properties?.type).toBeDefined();
      expect(resolved.required).toContain('type');
    });

    test('should generate sealed classes for oneOf schemas', async () => {
      const spec = await parser.parseFile(oneOfExamplePath);
      const result = await generator.generate(oneOfExamplePath);
      
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      
      // Check that Event sealed class exists
      const eventFile = result.generatedFiles.find(f => f.includes('Event.kt'));
      expect(eventFile).toBeDefined();
      
      if (eventFile) {
        const content = await fs.readFile(eventFile, 'utf-8');
        expect(content).toContain('sealed class Event');
        expect(content).toContain('@JsonTypeInfo');
        expect(content).toContain('@JsonSubTypes');
        expect(content).toContain('data class UserRegistrationEvent');
        expect(content).toContain(': Event(');
      }
    });

    test('should require discriminator for oneOf schemas', async () => {
      const mockSpec = {
        components: {
          schemas: {
            Option1: { type: 'object', properties: { value: { type: 'string' } } },
            Option2: { type: 'object', properties: { value: { type: 'integer' } } }
          }
        }
      } as any;

      const oneOfSchema = {
        oneOf: [
          { $ref: '#/components/schemas/Option1' },
          { $ref: '#/components/schemas/Option2' }
        ]
        // Missing discriminator - should cause error
      };

      await expect(async () => {
        await parser.resolveSchema(mockSpec, oneOfSchema);
      }).rejects.toThrow(/discriminator/);
    });
  });

  describe('anyOf Schema Composition', () => {
    const anyOfExamplePath = path.join(__dirname, '../../../../examples/anyof-flexible-unions-example.yaml');

    test('should parse anyOf flexible unions example correctly', async () => {
      const spec = await parser.parseFile(anyOfExamplePath);
      
      expect(spec).toBeDefined();
      expect(spec.info.title).toBe('anyOf Flexible Unions Example');
      expect(spec.components?.schemas).toBeDefined();
      
      // Check key schemas exist
      expect(spec.components!.schemas!['SearchFilter']).toBeDefined();
      expect(spec.components!.schemas!['IntegrationConfig']).toBeDefined();
      expect(spec.components!.schemas!['PermissionUpdate']).toBeDefined();
    });

    test('should resolve anyOf schemas correctly', async () => {
      const mockSpec = {
        components: {
          schemas: {
            TextFilter: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                caseSensitive: { type: 'boolean' }
              }
            },
            DateFilter: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date' },
                endDate: { type: 'string', format: 'date' }
              }
            },
            NumericFilter: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' }
              }
            }
          }
        }
      } as any;

      const anyOfSchema = {
        anyOf: [
          { $ref: '#/components/schemas/TextFilter' },
          { $ref: '#/components/schemas/DateFilter' },
          { $ref: '#/components/schemas/NumericFilter' }
        ]
      };

      const resolved = await parser.resolveSchema(mockSpec, anyOfSchema);
      
      expect(resolved.anyOfVariants).toBeDefined();
      expect(resolved.anyOfVariants).toHaveLength(3);
      expect(resolved.properties).toBeDefined();
    });

    test('should generate union wrapper classes for anyOf schemas', async () => {
      const spec = await parser.parseFile(anyOfExamplePath);
      const result = await generator.generate(anyOfExamplePath);
      
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      
      // Check that SearchFilter union class exists
      const searchFilterFile = result.generatedFiles.find(f => f.includes('SearchFilter.kt'));
      expect(searchFilterFile).toBeDefined();
      
      if (searchFilterFile) {
        const content = await fs.readFile(searchFilterFile, 'utf-8');
        expect(content).toContain('data class SearchFilter');
        expect(content).toContain('val value: Any');
        expect(content).toContain('val supportedTypes: Set<String>');
        expect(content).toContain('@JsonValue');
        expect(content).toContain('@JsonCreator');
        expect(content).toContain('companion object');
      }
    });

    test('should reject empty anyOf schemas', async () => {
      const anyOfSchema = {
        anyOf: []
      };

      await expect(async () => {
        await parser.resolveSchema({} as any, anyOfSchema);
      }).rejects.toThrow(/at least one variant/);
    });
  });

  describe('Complex Schema Composition', () => {
    const complexExamplePath = path.join(__dirname, '../../../../examples/complex-composition-example.yaml');

    test('should parse complex composition example correctly', async () => {
      const spec = await parser.parseFile(complexExamplePath);
      
      expect(spec).toBeDefined();
      expect(spec.info.title).toBe('Complex Schema Composition Example');
      expect(spec.components?.schemas).toBeDefined();
      
      // Check key complex schemas exist
      expect(spec.components!.schemas!['ContentItem']).toBeDefined();
      expect(spec.components!.schemas!['Workflow']).toBeDefined();
      expect(spec.components!.schemas!['AnalyticsEvent']).toBeDefined();
    });

    test('should handle nested composition patterns', async () => {
      const spec = await parser.parseFile(complexExamplePath);
      const result = await generator.generate(complexExamplePath);
      
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      
      // Check that complex classes are generated
      const contentItemFile = result.generatedFiles.find(f => f.includes('ContentItem.kt'));
      expect(contentItemFile).toBeDefined();
      
      if (contentItemFile) {
        const content = await fs.readFile(contentItemFile, 'utf-8');
        expect(content).toContain('data class ContentItem');
        // Should have properties from BaseEntity, Ownership, and ContentItem-specific properties
        expect(content).toContain('val id: String');
        expect(content).toContain('val ownerId: String');
        expect(content).toContain('val title: String');
      }
    });

    test('should generate multiple files for complex schemas', async () => {
      const spec = await parser.parseFile(complexExamplePath);
      const result = await generator.generate(complexExamplePath);
      
      // Should generate many files for all the complex schemas
      expect(result.generatedFiles.length).toBeGreaterThan(20);
      
      // Check for various expected files
      const fileNames = result.generatedFiles.map(f => path.basename(f));
      expect(fileNames).toContain('ContentItem.kt');
      expect(fileNames).toContain('Workflow.kt');
      expect(fileNames).toContain('AnalyticsEvent.kt');
      expect(fileNames).toContain('BaseEntity.kt');
      expect(fileNames).toContain('Ownership.kt');
    });
  });

  describe('Schema Composition Test API', () => {
    const compositionTestPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');

    test('should parse comprehensive test API correctly', async () => {
      const spec = await parser.parseFile(compositionTestPath);
      
      expect(spec).toBeDefined();
      expect(spec.info.title).toBe('Schema Composition Test API');
      expect(spec.paths).toBeDefined();
      expect(spec.components?.schemas).toBeDefined();
      
      // Check that all major composition patterns are present
      expect(spec.components!.schemas!['UserProfile']).toBeDefined(); // allOf
      expect(spec.components!.schemas!['Notification']).toBeDefined(); // oneOf
      expect(spec.components!.schemas!['SearchCriteria']).toBeDefined(); // anyOf
    });

    test('should generate comprehensive Kotlin code', async () => {
      const spec = await parser.parseFile(compositionTestPath);
      const result = await generator.generate(compositionTestPath);
      
      expect(result.generatedFiles.length).toBeGreaterThan(30);
      
      // Verify specific patterns are implemented correctly
      const userProfileFile = result.generatedFiles.find(f => f.includes('UserProfile.kt'));
      const notificationFile = result.generatedFiles.find(f => f.includes('Notification.kt'));
      const searchCriteriaFile = result.generatedFiles.find(f => f.includes('SearchCriteria.kt'));
      
      expect(userProfileFile).toBeDefined();
      expect(notificationFile).toBeDefined();
      expect(searchCriteriaFile).toBeDefined();
      
      if (userProfileFile) {
        const content = await fs.readFile(userProfileFile, 'utf-8');
        expect(content).toContain('data class UserProfile');
        expect(content).toContain('val id: Long'); // from BaseEntity
        expect(content).toContain('val firstName: String'); // from Person
        expect(content).toContain('val isActive: Boolean'); // UserProfile-specific
      }
      
      if (notificationFile) {
        const content = await fs.readFile(notificationFile, 'utf-8');
        expect(content).toContain('sealed class Notification');
        expect(content).toContain('@JsonTypeInfo');
        expect(content).toContain('data class EmailNotification');
      }
      
      if (searchCriteriaFile) {
        const content = await fs.readFile(searchCriteriaFile, 'utf-8');
        expect(content).toContain('data class SearchCriteria');
        expect(content).toContain('val value: Any');
        expect(content).toContain('companion object');
      }
    });

    test('should generate valid controller interfaces', async () => {
      const spec = await parser.parseFile(compositionTestPath);
      const result = await generator.generate(compositionTestPath);
      
      const controllerFiles = result.generatedFiles.filter(f => f.includes('Controller.kt'));
      expect(controllerFiles.length).toBeGreaterThan(0);
      
      for (const controllerFile of controllerFiles) {
        const content = await fs.readFile(controllerFile, 'utf-8');
        expect(content).toContain('interface');
        expect(content).toContain('Controller');
        expect(content).toContain('@PostMapping');
        expect(content).toContain('ResponseEntity');
      }
    });
  });

  describe('Error Handling in Schema Composition', () => {
    test('should handle circular references in allOf', async () => {
      const mockSpec = {
        components: {
          schemas: {
            A: {
              allOf: [{ $ref: '#/components/schemas/B' }]
            },
            B: {
              allOf: [{ $ref: '#/components/schemas/A' }]
            }
          }
        }
      } as any;

      await expect(async () => {
        await parser.resolveSchema(mockSpec, { $ref: '#/components/schemas/A' });
      }).rejects.toThrow(); // Should detect circular reference
    });

    test('should handle invalid references in oneOf', async () => {
      const mockSpec = {
        components: {
          schemas: {}
        }
      } as any;

      const oneOfSchema = {
        oneOf: [
          { $ref: '#/components/schemas/NonExistent' }
        ],
        discriminator: {
          propertyName: 'type'
        }
      };

      await expect(async () => {
        await parser.resolveSchema(mockSpec, oneOfSchema);
      }).rejects.toThrow(/not found/);
    });

    test('should validate schema composition structure', async () => {
      // Test malformed allOf
      await expect(async () => {
        await parser.resolveSchema({} as any, { allOf: null as any });
      }).rejects.toThrow();

      // Test malformed oneOf
      await expect(async () => {
        await parser.resolveSchema({} as any, { oneOf: 'invalid' as any });
      }).rejects.toThrow();

      // Test malformed anyOf
      await expect(async () => {
        await parser.resolveSchema({} as any, { anyOf: {} as any });
      }).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('should handle large schema compositions efficiently', async () => {
      const startTime = Date.now();
      
      // Test with the comprehensive example which has many schemas
      const spec = await parser.parseFile(path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml'));
      const result = await generator.generate(path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml'));
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(result.generatedFiles.length).toBeGreaterThan(0);
    });

    test('should handle deeply nested compositions', async () => {
      const mockSpec = {
        components: {
          schemas: {
            Level1: {
              allOf: [
                { $ref: '#/components/schemas/Level2' },
                { type: 'object', properties: { level1Prop: { type: 'string' } } }
              ]
            },
            Level2: {
              allOf: [
                { $ref: '#/components/schemas/Level3' },
                { type: 'object', properties: { level2Prop: { type: 'string' } } }
              ]
            },
            Level3: {
              allOf: [
                { $ref: '#/components/schemas/Level4' },
                { type: 'object', properties: { level3Prop: { type: 'string' } } }
              ]
            },
            Level4: {
              type: 'object',
              properties: { level4Prop: { type: 'string' } }
            }
          }
        }
      } as any;

      const resolved = await parser.resolveSchema(mockSpec, { $ref: '#/components/schemas/Level1' });
      
      expect(resolved.properties).toBeDefined();
      expect(resolved.properties!['level1Prop']).toBeDefined();
      expect(resolved.properties!['level2Prop']).toBeDefined();
      expect(resolved.properties!['level3Prop']).toBeDefined();
      expect(resolved.properties!['level4Prop']).toBeDefined();
    });
  });
});