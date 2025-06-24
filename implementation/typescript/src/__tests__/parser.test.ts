/**
 * Test suite for OpenAPIParser
 * Tests basic parsing functionality and error handling
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as YAML from 'yaml';
import { OpenAPIParser } from '../parser';
import { OpenAPISpec, OpenAPISchema } from '../types';
import { WebhookService } from '../webhook';
import { ExternalReferenceResolver } from '../external-resolver';

// Mock fs-extra
jest.mock('fs-extra');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock path
jest.mock('path');
const mockPath = path as jest.Mocked<typeof path>;

// Mock YAML
jest.mock('yaml');
const mockYAML = YAML as jest.Mocked<typeof YAML>;

describe('OpenAPIParser', () => {
  let parser: OpenAPIParser;
  let mockWebhookService: jest.Mocked<WebhookService>;

  const mockSpec: OpenAPISpec = {
    openapi: '3.0.0',
    info: {
      title: 'Test API',
      version: '1.0.0'
    },
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
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' }
              }
            }
          },
          responses: {
            '201': { description: 'Created' }
          }
        }
      }
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' }
          },
          required: ['id', 'name']
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            price: { type: 'number' }
          }
        }
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock WebhookService
    mockWebhookService = {
      triggerEvent: jest.fn().mockResolvedValue(undefined),
      registerWebhook: jest.fn(),
      unregisterWebhook: jest.fn(),
      getRegisteredWebhooks: jest.fn().mockReturnValue([]),
      handleEvent: jest.fn()
    } as any;

    parser = new OpenAPIParser(undefined, mockWebhookService);

    // Mock file system operations
    mockFs.pathExists.mockResolvedValue(true);
    mockFs.readFile.mockResolvedValue(JSON.stringify(mockSpec));
    mockPath.resolve.mockImplementation((filePath) => `/resolved/${filePath}`);
    mockPath.extname.mockReturnValue('.json');
    mockYAML.parse.mockReturnValue(mockSpec);
  });

  describe('constructor', () => {
    test('should initialize parser with default config', () => {
      const defaultParser = new OpenAPIParser();
      expect(defaultParser).toBeInstanceOf(OpenAPIParser);
    });

    test('should initialize parser with webhook service', () => {
      const parserWithWebhook = new OpenAPIParser(undefined, mockWebhookService);
      expect(parserWithWebhook).toBeInstanceOf(OpenAPIParser);
    });

    test('should initialize parser with external resolver config', () => {
      const externalConfig = {
        enableRemoteReferences: true,
        maxDepth: 5,
        timeout: 10000
      };
      const parserWithConfig = new OpenAPIParser(externalConfig);
      expect(parserWithConfig).toBeInstanceOf(OpenAPIParser);
    });
  });

  describe('parseFile', () => {
    test('should parse JSON file successfully', async () => {
      mockPath.extname.mockReturnValue('.json');
      
      const result = await parser.parseFile('/test/api.json');
      
      expect(result).toEqual(mockSpec);
      expect(mockFs.pathExists).toHaveBeenCalledWith('/resolved//test/api.json');
      expect(mockFs.readFile).toHaveBeenCalledWith('/resolved//test/api.json', 'utf-8');
    });

    test('should parse YAML file successfully', async () => {
      mockPath.extname.mockReturnValue('.yaml');
      
      const result = await parser.parseFile('/test/api.yaml');
      
      expect(result).toEqual(mockSpec);
      expect(mockYAML.parse).toHaveBeenCalled();
    });

    test('should parse YML file successfully', async () => {
      mockPath.extname.mockReturnValue('.yml');
      
      const result = await parser.parseFile('/test/api.yml');
      
      expect(result).toEqual(mockSpec);
      expect(mockYAML.parse).toHaveBeenCalled();
    });

    test('should handle file not found', async () => {
      mockFs.pathExists.mockResolvedValue(false);
      
      await expect(parser.parseFile('/test/nonexistent.json')).rejects.toThrow('File not found');
    });

    test('should handle invalid JSON content', async () => {
      mockFs.readFile.mockResolvedValue('invalid json content');
      mockPath.extname.mockReturnValue('.json');
      
      await expect(parser.parseFile('/test/invalid.json')).rejects.toThrow();
    });

    test('should handle invalid YAML content', async () => {
      mockYAML.parse.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });
      mockPath.extname.mockReturnValue('.yaml');
      
      await expect(parser.parseFile('/test/invalid.yaml')).rejects.toThrow();
    });

    test('should handle unsupported file extension', async () => {
      mockPath.extname.mockReturnValue('.txt');
      
      await expect(parser.parseFile('/test/api.txt')).rejects.toThrow('Unsupported file format');
    });
  });

  describe('getAllSchemas', () => {
    test('should return all schemas from components', async () => {
      const schemas = await parser.getAllSchemas(mockSpec);
      
      expect(schemas).toEqual(mockSpec.components?.schemas);
      expect(Object.keys(schemas)).toHaveLength(2);
      expect(schemas['User']).toBeDefined();
      expect(schemas['Product']).toBeDefined();
    });

    test('should handle spec without components', async () => {
      const specWithoutComponents = { ...mockSpec, components: undefined };
      
      const schemas = await parser.getAllSchemas(specWithoutComponents);
      
      expect(schemas).toEqual({});
    });

    test('should handle spec without schemas in components', async () => {
      const specWithoutSchemas = { 
        ...mockSpec, 
        components: { ...mockSpec.components, schemas: undefined }
      };
      
      const schemas = await parser.getAllSchemas(specWithoutSchemas);
      
      expect(schemas).toEqual({});
    });
  });

  describe('getAllOperations', () => {
    test('should return all operations from paths', async () => {
      const operations = await parser.getAllOperations(mockSpec);
      
      expect(operations).toHaveLength(2);
      expect(operations[0].path).toBe('/users');
      expect(operations[0].method).toBe('get');
      expect(operations[1].method).toBe('post');
    });

    test('should handle spec without paths', async () => {
      const specWithoutPaths = { ...mockSpec, paths: {} };
      
      const operations = await parser.getAllOperations(specWithoutPaths);
      
      expect(operations).toEqual([]);
    });

    test('should extract operation details correctly', async () => {
      const operations = await parser.getAllOperations(mockSpec);
      const getOperation = operations.find(op => op.method === 'get');
      
      expect(getOperation?.operationId).toBe('getUsers');
      expect(getOperation?.tags).toEqual(['users']);
      expect(getOperation?.responses).toBeDefined();
    });
  });

  describe('getAllTags', () => {
    test('should return unique tags from operations', () => {
      const tags = parser.getAllTags(mockSpec);
      
      expect(tags).toEqual(['users']);
    });

    test('should handle spec without operations', () => {
      const specWithoutPaths = { ...mockSpec, paths: {} };
      
      const tags = parser.getAllTags(specWithoutPaths);
      
      expect(tags).toEqual([]);
    });

    test('should return unique tags from multiple operations', () => {
      const specWithMultipleTags = {
        ...mockSpec,
        paths: {
          '/users': {
            get: { tags: ['users', 'admin'] }
          },
          '/products': {
            get: { tags: ['products'] },
            post: { tags: ['products', 'admin'] }
          }
        }
      };
      
      const tags = parser.getAllTags(specWithMultipleTags);
      
      expect(tags.sort()).toEqual(['admin', 'products', 'users']);
    });
  });

  describe('resolveSchema', () => {
    test('should resolve schema by name', async () => {
      const schema = await parser.resolveSchema('User', mockSpec);
      
      expect(schema).toEqual(mockSpec.components?.schemas?.User);
    });

    test('should handle non-existent schema', async () => {
      const schema = await parser.resolveSchema('NonExistent', mockSpec);
      
      expect(schema).toBeUndefined();
    });

    test('should handle spec without components', async () => {
      const specWithoutComponents = { ...mockSpec, components: undefined };
      
      const schema = await parser.resolveSchema('User', specWithoutComponents);
      
      expect(schema).toBeUndefined();
    });
  });

  describe('isReference', () => {
    test('should return true for reference objects', () => {
      const reference = { $ref: '#/components/schemas/User' };
      
      expect(parser.isReference(reference)).toBe(true);
    });

    test('should return false for non-reference objects', () => {
      const schema = { type: 'string' };
      
      expect(parser.isReference(schema)).toBe(false);
    });

    test('should handle null/undefined', () => {
      expect(parser.isReference(null)).toBe(false);
      expect(parser.isReference(undefined)).toBe(false);
    });
  });

  describe('dereference', () => {
    test('should dereference schema reference', async () => {
      const reference = { $ref: '#/components/schemas/User' };
      
      const dereferenced = await parser.dereference(reference, mockSpec);
      
      expect(dereferenced).toEqual(mockSpec.components?.schemas?.User);
    });

    test('should return non-reference objects as-is', async () => {
      const schema = { type: 'string' };
      
      const result = await parser.dereference(schema, mockSpec);
      
      expect(result).toEqual(schema);
    });

    test('should handle invalid references', async () => {
      const invalidReference = { $ref: '#/components/schemas/NonExistent' };
      
      await expect(parser.dereference(invalidReference, mockSpec)).rejects.toThrow();
    });

    test('should handle external references', async () => {
      const externalReference = { $ref: 'external.yaml#/components/schemas/External' };
      
      // Mock external resolver
      const mockExternalResolver = {
        resolveReference: jest.fn().mockResolvedValue({ type: 'object' })
      };
      (parser as any).externalResolver = mockExternalResolver;
      
      const result = await parser.dereference(externalReference, mockSpec);
      
      expect(mockExternalResolver.resolveReference).toHaveBeenCalled();
      expect(result).toEqual({ type: 'object' });
    });
  });

  describe('getParametersForOperation', () => {
    test('should return parameters from operation', () => {
      const operation = {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ]
      };
      
      const parameters = parser.getParametersForOperation(operation);
      
      expect(parameters).toHaveLength(2);
      expect(parameters[0].name).toBe('id');
      expect(parameters[1].name).toBe('limit');
    });

    test('should return empty array when no parameters', () => {
      const operation = {};
      
      const parameters = parser.getParametersForOperation(operation);
      
      expect(parameters).toEqual([]);
    });

    test('should handle operation with undefined parameters', () => {
      const operation = { parameters: undefined };
      
      const parameters = parser.getParametersForOperation(operation);
      
      expect(parameters).toEqual([]);
    });
  });

  describe('getRequestBodyForOperation', () => {
    test('should return request body from operation', () => {
      const operation = {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/User' }
            }
          }
        }
      };
      
      const requestBody = parser.getRequestBodyForOperation(operation);
      
      expect(requestBody).toEqual(operation.requestBody);
    });

    test('should return null when no request body', () => {
      const operation = {};
      
      const requestBody = parser.getRequestBodyForOperation(operation);
      
      expect(requestBody).toBeNull();
    });
  });

  describe('getResponsesForOperation', () => {
    test('should return responses from operation', () => {
      const operation = {
        responses: {
          '200': { description: 'Success' },
          '404': { description: 'Not Found' }
        }
      };
      
      const responses = parser.getResponsesForOperation(operation);
      
      expect(responses).toEqual(operation.responses);
    });

    test('should return empty object when no responses', () => {
      const operation = {};
      
      const responses = parser.getResponsesForOperation(operation);
      
      expect(responses).toEqual({});
    });
  });

  describe('validateSpec', () => {
    test('should validate valid OpenAPI spec', async () => {
      const isValid = await parser.validateSpec(mockSpec);
      
      expect(isValid).toBe(true);
    });

    test('should reject spec without openapi version', async () => {
      const invalidSpec = { ...mockSpec, openapi: undefined };
      
      const isValid = await parser.validateSpec(invalidSpec as any);
      
      expect(isValid).toBe(false);
    });

    test('should reject spec without info', async () => {
      const invalidSpec = { ...mockSpec, info: undefined };
      
      const isValid = await parser.validateSpec(invalidSpec as any);
      
      expect(isValid).toBe(false);
    });

    test('should reject spec with invalid openapi version', async () => {
      const invalidSpec = { ...mockSpec, openapi: '2.0' };
      
      const isValid = await parser.validateSpec(invalidSpec);
      
      expect(isValid).toBe(false);
    });
  });

  describe('caching functionality', () => {
    test('should cache resolved schemas', async () => {
      const schema1 = await parser.resolveSchema('User', mockSpec);
      const schema2 = await parser.resolveSchema('User', mockSpec);
      
      expect(schema1).toEqual(schema2);
      expect(schema1).toBe(schema2); // Should be same reference due to caching
    });

    test('should enable/disable caching', () => {
      const enableCacheMethod = (parser as any).enableCache.bind(parser);
      const disableCacheMethod = (parser as any).disableCache.bind(parser);
      
      disableCacheMethod();
      expect((parser as any).cacheEnabled).toBe(false);
      
      enableCacheMethod();
      expect((parser as any).cacheEnabled).toBe(true);
    });

    test('should clear cache', () => {
      const clearCacheMethod = (parser as any).clearCache.bind(parser);
      
      // Add something to cache first
      (parser as any).schemaCache.set('test', { type: 'object' });
      expect((parser as any).schemaCache.size).toBe(1);
      
      clearCacheMethod();
      expect((parser as any).schemaCache.size).toBe(0);
    });
  });

  describe('performance optimization', () => {
    test('should handle memory optimization mode', () => {
      const enableMemoryOptimizationMethod = (parser as any).enableMemoryOptimization.bind(parser);
      
      enableMemoryOptimizationMethod();
      expect((parser as any).memoryOptimized).toBe(true);
    });

    test('should enable streaming mode for large specs', () => {
      const enableStreamingMethod = (parser as any).enableStreamingMode.bind(parser);
      
      enableStreamingMethod();
      expect((parser as any).streamingMode).toBe(true);
    });

    test('should track performance metrics when enabled', () => {
      const enableMetricsMethod = (parser as any).enableMetrics.bind(parser);
      
      enableMetricsMethod();
      expect((parser as any).metricsEnabled).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle circular references', async () => {
      const circularSpec = {
        ...mockSpec,
        components: {
          schemas: {
            A: {
              type: 'object',
              properties: {
                b: { $ref: '#/components/schemas/B' }
              }
            },
            B: {
              type: 'object',
              properties: {
                a: { $ref: '#/components/schemas/A' }
              }
            }
          }
        }
      };
      
      await expect(parser.dereference({ $ref: '#/components/schemas/A' }, circularSpec))
        .rejects.toThrow();
    });

    test('should handle malformed references', async () => {
      const malformedRef = { $ref: 'invalid-reference-format' };
      
      await expect(parser.dereference(malformedRef, mockSpec)).rejects.toThrow();
    });

    test('should emit events on errors', async () => {
      const errorSpy = jest.fn();
      parser.on('error', errorSpy);
      
      mockFs.pathExists.mockResolvedValue(false);
      
      try {
        await parser.parseFile('/nonexistent.json');
      } catch (error) {
        // Expected to throw
      }
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('composition handling', () => {
    test('should handle allOf composition', async () => {
      const compositionSpec = {
        ...mockSpec,
        components: {
          schemas: {
            BaseModel: {
              type: 'object',
              properties: {
                id: { type: 'integer' }
              }
            },
            ExtendedModel: {
              allOf: [
                { $ref: '#/components/schemas/BaseModel' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' }
                  }
                }
              ]
            }
          }
        }
      };
      
      const resolveCompositionMethod = (parser as any).resolveComposition.bind(parser);
      const result = await resolveCompositionMethod(
        compositionSpec.components.schemas.ExtendedModel,
        compositionSpec
      );
      
      expect(result.type).toBe('object');
      expect(result.properties).toBeDefined();
    });

    test('should handle oneOf composition', async () => {
      const compositionSpec = {
        ...mockSpec,
        components: {
          schemas: {
            UnionModel: {
              oneOf: [
                { type: 'string' },
                { type: 'integer' }
              ]
            }
          }
        }
      };
      
      const resolveCompositionMethod = (parser as any).resolveComposition.bind(parser);
      const result = await resolveCompositionMethod(
        compositionSpec.components.schemas.UnionModel,
        compositionSpec
      );
      
      expect(result.oneOf).toHaveLength(2);
    });

    test('should handle anyOf composition', async () => {
      const compositionSpec = {
        ...mockSpec,
        components: {
          schemas: {
            FlexibleModel: {
              anyOf: [
                { type: 'string' },
                { type: 'object', properties: { data: { type: 'string' } } }
              ]
            }
          }
        }
      };
      
      const resolveCompositionMethod = (parser as any).resolveComposition.bind(parser);
      const result = await resolveCompositionMethod(
        compositionSpec.components.schemas.FlexibleModel,
        compositionSpec
      );
      
      expect(result.anyOf).toHaveLength(2);
    });
  });
});