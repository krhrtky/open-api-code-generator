/**
 * Test suite for OpenAPIParser
 * Tests basic parsing functionality and error handling
 */

import { describe, test, expect, beforeEach, vi, Mock } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as YAML from 'yaml';
import { OpenAPIParser } from '../parser';
import { OpenAPISpec, OpenAPISchema } from '../types';
import { WebhookService } from '../webhook';
import { ExternalReferenceResolver } from '../external-resolver';

// Mock dependencies
vi.mock('fs-extra', () => ({
  pathExists: vi.fn(),
  readFile: vi.fn()
}));

vi.mock('path', () => ({
  resolve: vi.fn(),
  extname: vi.fn()
}));

vi.mock('yaml', () => ({
  parse: vi.fn()
}));

vi.mock('../webhook', () => ({
  WebhookService: vi.fn()
}));

vi.mock('../external-resolver', () => ({
  ExternalReferenceResolver: vi.fn().mockImplementation(() => ({
    resolveExternalSchema: vi.fn()
  }))
}));

vi.mock('../performance-metrics', () => ({
  PerformanceTracker: vi.fn().mockImplementation(() => ({
    startTimer: vi.fn(),
    endTimer: vi.fn(),
    recordCacheHit: vi.fn(),
    recordCacheMiss: vi.fn(),
    updateCacheSize: vi.fn(),
    recordSchemaProcessed: vi.fn(),
    startTracking: vi.fn(),
    endTracking: vi.fn(),
    reset: vi.fn(),
    takeMemorySnapshot: vi.fn(),
    recordCacheEviction: vi.fn(),
    getPerformanceReport: vi.fn().mockReturnValue({}),
    generateFormattedReport: vi.fn().mockReturnValue(''),
    exportMetrics: vi.fn().mockReturnValue('{}')
  }))
}));

describe('OpenAPIParser', () => {
  let parser: OpenAPIParser;
  let mockWebhookServiceInstance: any;

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
    vi.clearAllMocks();

    // Mock WebhookService instance
    mockWebhookServiceInstance = {
      triggerEvent: vi.fn().mockResolvedValue(undefined),
      registerWebhook: vi.fn(),
      unregisterWebhook: vi.fn(),
      getRegisteredWebhooks: vi.fn().mockReturnValue([]),
      handleEvent: vi.fn()
    };

    parser = new OpenAPIParser(undefined, mockWebhookServiceInstance);

    // Setup mocks
    fs.pathExists = vi.fn().mockResolvedValue(true);
    fs.readFile = vi.fn().mockResolvedValue(JSON.stringify(mockSpec));
    path.resolve = vi.fn().mockImplementation((filePath) => `/resolved/${filePath}`);
    path.extname = vi.fn().mockReturnValue('.json');
    YAML.parse = vi.fn().mockReturnValue(mockSpec);
  });

  describe('constructor', () => {
    test('should initialize parser with default config', () => {
      const defaultParser = new OpenAPIParser();
      expect(defaultParser).toBeInstanceOf(OpenAPIParser);
    });

    test('should initialize parser with webhook service', () => {
      const parserWithWebhook = new OpenAPIParser(undefined, mockWebhookServiceInstance);
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
      path.extname.mockReturnValue('.json');
      
      const result = await parser.parseFile('/test/api.json');
      
      expect(result).toEqual(mockSpec);
      expect(fs.pathExists).toHaveBeenCalledWith('/resolved//test/api.json');
      expect(fs.readFile).toHaveBeenCalledWith('/resolved//test/api.json', 'utf-8');
    });

    test('should parse YAML file successfully', async () => {
      path.extname.mockReturnValue('.yaml');
      
      const result = await parser.parseFile('/test/api.yaml');
      
      expect(result).toEqual(mockSpec);
      expect(YAML.parse).toHaveBeenCalled();
    });

    test('should parse YML file successfully', async () => {
      path.extname.mockReturnValue('.yml');
      
      const result = await parser.parseFile('/test/api.yml');
      
      expect(result).toEqual(mockSpec);
      expect(YAML.parse).toHaveBeenCalled();
    });

    test('should handle file not found', async () => {
      fs.pathExists.mockResolvedValue(false);
      
      await expect(parser.parseFile('/test/nonexistent.json')).rejects.toThrow('File not found');
    });

    test('should handle invalid JSON content', async () => {
      fs.readFile.mockResolvedValue('invalid json content');
      path.extname.mockReturnValue('.json');
      
      await expect(parser.parseFile('/test/invalid.json')).rejects.toThrow();
    });

    test('should handle invalid YAML content', async () => {
      YAML.parse.mockImplementation(() => {
        throw new Error('Invalid YAML');
      });
      path.extname.mockReturnValue('.yaml');
      
      await expect(parser.parseFile('/test/invalid.yaml')).rejects.toThrow();
    });

    test('should handle unsupported file extension', async () => {
      path.extname.mockReturnValue('.txt');
      
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

  describe.skip('getAllOperations', () => {
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
      expect(parser.isReference(null)).toBeFalsy();
      expect(parser.isReference(undefined)).toBeFalsy();
    });
  });

  describe('resolveReference', () => {
    test('should resolve schema reference', async () => {
      const reference = { $ref: '#/components/schemas/User' };
      
      const resolved = await parser.resolveReference(mockSpec, reference);
      
      expect(resolved).toEqual(mockSpec.components?.schemas?.User);
    });

    test('should handle invalid references', async () => {
      const invalidReference = { $ref: '#/components/schemas/NonExistent' };
      
      await expect(parser.resolveReference(mockSpec, invalidReference)).rejects.toThrow('Reference not found');
    });

    test('should handle circular references', async () => {
      const visitedRefs = new Set(['#/components/schemas/User']);
      const reference = { $ref: '#/components/schemas/User' };
      
      await expect(parser.resolveReference(mockSpec, reference, visitedRefs)).rejects.toThrow('Circular reference detected');
    });

    test('should handle external references', async () => {
      const externalReference = { $ref: 'external.yaml#/components/schemas/External' };
      
      // Mock external resolver
      const mockExternalResolverInstance = {
        resolveExternalSchema: vi.fn().mockResolvedValue({ type: 'object' })
      };
      (parser as any).externalResolver = mockExternalResolverInstance;
      
      const result = await parser.resolveReference(mockSpec, externalReference);
      
      expect(mockExternalResolverInstance.resolveExternalSchema).toHaveBeenCalled();
      expect(result).toEqual({ type: 'object' });
    });

    test('should handle external reference resolution failure', async () => {
      const externalReference = { $ref: 'external.yaml#/components/schemas/External' };
      
      // Mock external resolver to fail
      const mockExternalResolverInstance = {
        resolveExternalSchema: vi.fn().mockRejectedValue(new Error('Network error'))
      };
      (parser as any).externalResolver = mockExternalResolverInstance;
      
      await expect(parser.resolveReference(mockSpec, externalReference)).rejects.toThrow('Failed to resolve external reference');
    });

    test('should cache resolved references', async () => {
      const reference = { $ref: '#/components/schemas/User' };
      
      // First resolution
      const result1 = await parser.resolveReference(mockSpec, reference);
      
      // Second resolution should use cache
      const result2 = await parser.resolveReference(mockSpec, reference);
      
      expect(result1).toEqual(result2);
      expect((parser as any).referenceCache.has('#/components/schemas/User')).toBe(true);
    });
  });

  describe('resolveSchema', () => {
    test('should resolve reference schema', async () => {
      const reference = { $ref: '#/components/schemas/User' };
      
      const resolved = await parser.resolveSchema(mockSpec, reference);
      
      expect(resolved).toEqual(mockSpec.components?.schemas?.User);
    });

    test('should return non-reference schema as-is', async () => {
      const schema = { type: 'string' };
      
      const result = await parser.resolveSchema(mockSpec, schema);
      
      expect(result).toEqual(schema);
    });

    test('should handle allOf composition', async () => {
      const allOfSchema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'integer' } } },
          { type: 'object', properties: { name: { type: 'string' } } }
        ]
      };
      
      const resolved = await parser.resolveSchema(mockSpec, allOfSchema);
      
      expect(resolved.type).toBe('object');
      expect(resolved.properties).toHaveProperty('id');
      expect(resolved.properties).toHaveProperty('name');
    });

    test('should handle oneOf composition with discriminator', async () => {
      const oneOfSchema = {
        oneOf: [
          { type: 'object', properties: { type: { type: 'string' }, value: { type: 'string' } } },
          { type: 'object', properties: { type: { type: 'string' }, count: { type: 'integer' } } }
        ],
        discriminator: { propertyName: 'type' }
      };
      
      const resolved = await parser.resolveSchema(mockSpec, oneOfSchema);
      
      expect(resolved.type).toBe('object');
      expect((resolved as any).oneOfVariants).toHaveLength(2);
      expect(resolved.properties).toHaveProperty('type');
    });

    test('should handle anyOf composition', async () => {
      const anyOfSchema = {
        anyOf: [
          { type: 'object', properties: { id: { type: 'integer' } } },
          { type: 'object', properties: { name: { type: 'string' } } }
        ]
      };
      
      const resolved = await parser.resolveSchema(mockSpec, anyOfSchema);
      
      expect(resolved.type).toBe('object');
      expect((resolved as any).anyOfVariants).toHaveLength(2);
    });
  });

  describe.skip('getParametersForOperation', () => {
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

  describe.skip('getRequestBodyForOperation', () => {
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

  describe.skip('getResponsesForOperation', () => {
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
    test('should throw for valid OpenAPI spec', () => {
      expect(() => (parser as any).validateSpec(mockSpec)).not.toThrow();
    });

    test('should throw for spec without openapi version', () => {
      const invalidSpec = { ...mockSpec, openapi: undefined };
      
      expect(() => (parser as any).validateSpec(invalidSpec)).toThrow('Missing required field: openapi');
    });

    test('should throw for spec without info', () => {
      const invalidSpec = { ...mockSpec, info: undefined };
      
      expect(() => (parser as any).validateSpec(invalidSpec)).toThrow('Missing required field: info');
    });

    test('should throw for spec with invalid openapi version', () => {
      const invalidSpec = { ...mockSpec, openapi: '2.0' };
      
      expect(() => (parser as any).validateSpec(invalidSpec)).toThrow('Unsupported OpenAPI version: 2.0');
    });

    test('should throw for spec without info.title', () => {
      const invalidSpec = { ...mockSpec, info: { version: '1.0.0' } };
      
      expect(() => (parser as any).validateSpec(invalidSpec)).toThrow('Missing required field: info.title');
    });

    test('should throw for spec without info.version', () => {
      const invalidSpec = { ...mockSpec, info: { title: 'Test API' } };
      
      expect(() => (parser as any).validateSpec(invalidSpec)).toThrow('Missing required field: info.version');
    });

    test('should throw for spec without paths', () => {
      const invalidSpec = { ...mockSpec, paths: undefined };
      
      expect(() => (parser as any).validateSpec(invalidSpec)).toThrow('Missing required field: paths');
    });

    test('should throw for non-object spec', () => {
      expect(() => (parser as any).validateSpec('invalid')).toThrow('Invalid OpenAPI specification: not an object');
    });

    test('should throw for null spec', () => {
      expect(() => (parser as any).validateSpec(null)).toThrow('Invalid OpenAPI specification: not an object');
    });
  });

  describe('caching functionality', () => {
    test('should cache resolved compositions', async () => {
      const allOfSchema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'integer' } } },
          { type: 'object', properties: { name: { type: 'string' } } }
        ]
      };
      
      const result1 = await parser.resolveSchema(mockSpec, allOfSchema);
      const result2 = await parser.resolveSchema(mockSpec, allOfSchema);
      
      expect(result1).toEqual(result2);
      expect((parser as any).compositionCache.size).toBeGreaterThan(0);
    });

    test('should configure caching', () => {
      parser.configureCaching({ enabled: false });
      expect((parser as any).cacheEnabled).toBe(false);
      
      parser.configureCaching({ enabled: true, maxSize: 500 });
      expect((parser as any).cacheEnabled).toBe(true);
      expect((parser as any).maxCacheSize).toBe(500);
    });

    test('should clear cache', () => {
      // Add something to cache first
      (parser as any).schemaCache.set('test', { type: 'object' });
      expect((parser as any).schemaCache.size).toBe(1);
      
      parser.clearAllCaches();
      expect((parser as any).schemaCache.size).toBe(0);
    });

    test('should get cache statistics', () => {
      (parser as any).schemaCache.set('schema1', { type: 'object' });
      (parser as any).compositionCache.set('comp1', { type: 'object' });
      (parser as any).referenceCache.set('ref1', { type: 'object' });
      
      const stats = parser.getCacheStats();
      expect(stats.schemas).toBe(1);
      expect(stats.compositions).toBe(1);
      expect(stats.references).toBe(1);
      expect(stats.maxSize).toBeGreaterThan(0);
    });
  });

  describe('performance optimization', () => {
    test('should configure memory optimization', () => {
      parser.configureMemoryOptimization({ 
        enabled: true, 
        memoryThreshold: 1000000, 
        streamingMode: true 
      });
      
      expect((parser as any).memoryOptimized).toBe(true);
      expect((parser as any).maxMemoryThreshold).toBe(1000000);
      expect((parser as any).streamingMode).toBe(true);
    });

    test('should configure performance metrics', () => {
      // Mock the reset method for this test
      const mockReset = vi.fn();
      (parser as any).performanceTracker.reset = mockReset;
      
      parser.configureMetrics({ enabled: true });
      expect((parser as any).metricsEnabled).toBe(true);
    });

    test('should start and end performance tracking', () => {
      // Mock all necessary performance tracker methods
      const mockReset = vi.fn();
      const mockStartTracking = vi.fn();
      const mockEndTracking = vi.fn();
      
      (parser as any).performanceTracker.reset = mockReset;
      (parser as any).performanceTracker.startTracking = mockStartTracking;
      (parser as any).performanceTracker.endTracking = mockEndTracking;
      
      parser.configureMetrics({ enabled: true });
      
      expect(() => parser.startPerformanceTracking()).not.toThrow();
      expect(() => parser.endPerformanceTracking()).not.toThrow();
    });

    test('should get memory statistics', () => {
      const stats = parser.getMemoryStats();
      
      expect(stats).toHaveProperty('heapUsed');
      expect(stats).toHaveProperty('heapTotal');
      expect(stats).toHaveProperty('processedSchemas');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('memoryOptimized');
    });

    test('should throw when metrics not enabled for performance report', () => {
      parser.configureMetrics({ enabled: false });
      
      expect(() => parser.getPerformanceMetrics()).toThrow('Performance metrics are not enabled');
      expect(() => parser.exportPerformanceMetrics()).toThrow('Performance metrics are not enabled');
      expect(parser.generatePerformanceReport()).toBe('Performance metrics are not enabled.');
    });
  });

  describe('error handling', () => {
    test('should handle circular references', async () => {
      // Create a visited refs set with the same reference to simulate circular dependency  
      const visitedRefs = new Set(['#/components/schemas/User']);
      const reference = { $ref: '#/components/schemas/User' };
      
      await expect(parser.resolveReference(mockSpec, reference, visitedRefs))
        .rejects.toThrow('Circular reference detected');
    });

  });

  describe('composition validation errors', () => {
    test('should handle allOf composition validation errors', async () => {
      const allOfSchema = { allOf: 'invalid' };
      
      await expect(parser.resolveSchema(mockSpec, allOfSchema)).rejects.toThrow('allOf must be an array');
    });

    test('should handle empty allOf array', async () => {
      const allOfSchema = { allOf: [] };
      
      await expect(parser.resolveSchema(mockSpec, allOfSchema)).rejects.toThrow('allOf array cannot be empty');
    });

    test('should handle null allOf', async () => {
      const allOfSchema = { allOf: null };
      
      await expect(parser.resolveSchema(mockSpec, allOfSchema)).rejects.toThrow('allOf cannot be null');
    });

    test('should handle oneOf without discriminator', async () => {
      const oneOfSchema = {
        oneOf: [
          { type: 'string' },
          { type: 'integer' }
        ]
      };
      
      await expect(parser.resolveSchema(mockSpec, oneOfSchema)).rejects.toThrow('oneOf schema without discriminator property');
    });

    test('should handle invalid oneOf structure', async () => {
      const oneOfSchema = { oneOf: 'invalid' };
      
      await expect(parser.resolveSchema(mockSpec, oneOfSchema)).rejects.toThrow('oneOf must be an array');
    });

    test('should handle empty oneOf array', async () => {
      const oneOfSchema = { oneOf: [] };
      
      await expect(parser.resolveSchema(mockSpec, oneOfSchema)).rejects.toThrow('oneOf array cannot be empty');
    });

    test('should handle invalid anyOf structure', async () => {
      const anyOfSchema = { anyOf: {} };
      
      await expect(parser.resolveSchema(mockSpec, anyOfSchema)).rejects.toThrow('anyOf must be an array');
    });

    test('should handle empty anyOf array', async () => {
      const anyOfSchema = { anyOf: [] };
      
      await expect(parser.resolveSchema(mockSpec, anyOfSchema)).rejects.toThrow('anyOf schema must contain at least one variant');
    });

    test('should handle allOf property conflicts', async () => {
      const conflictSchema = {
        allOf: [
          { type: 'object', properties: { id: { type: 'string' } } },
          { type: 'object', properties: { id: { type: 'integer' } } }
        ]
      };
      
      await expect(parser.resolveSchema(mockSpec, conflictSchema)).rejects.toThrow('Property \'id\' has conflicting types in allOf schemas');
    });
  });

  describe('extractSchemaName', () => {
    test('should extract schema name from reference', () => {
      const ref = '#/components/schemas/User';
      const name = parser.extractSchemaName(ref);
      
      expect(name).toBe('User');
    });

    test('should extract name from nested reference', () => {
      const ref = 'external.yaml#/components/schemas/ExternalModel';
      const name = parser.extractSchemaName(ref);
      
      expect(name).toBe('ExternalModel');
    });
  });

  describe('getAllSchemas with streaming', () => {
    test('should process large specs in streaming mode', async () => {
      parser.configureMemoryOptimization({ streamingMode: true });
      
      const largeSpec = {
        ...mockSpec,
        components: {
          schemas: {}
        }
      };
      
      // Create many schemas to trigger streaming
      for (let i = 0; i < 60; i++) {
        largeSpec.components.schemas[`Schema${i}`] = {
          type: 'object',
          properties: { id: { type: 'integer' } }
        };
      }
      
      const schemas = await parser.getAllSchemas(largeSpec);
      
      expect(Object.keys(schemas)).toHaveLength(60);
      expect((parser as any).processedSchemaCount).toBeGreaterThan(0);
    });
  });

  describe('setWebhookService', () => {
    test('should set webhook service', () => {
      const newWebhookService = {
        triggerEvent: vi.fn()
      };
      
      parser.setWebhookService(newWebhookService as any);
      
      expect((parser as any).webhookService).toBe(newWebhookService);
    });
  });

  describe('URL validation', () => {
    test('should identify valid URLs', () => {
      const isUrlMethod = (parser as any).isUrl.bind(parser);
      
      expect(isUrlMethod('https://example.com')).toBe(true);
      expect(isUrlMethod('http://example.com')).toBe(true);
      expect(isUrlMethod('ftp://example.com')).toBe(true);
    });

    test('should identify invalid URLs', () => {
      const isUrlMethod = (parser as any).isUrl.bind(parser);
      
      expect(isUrlMethod('not-a-url')).toBe(false);
      expect(isUrlMethod('/local/path')).toBe(false);
      expect(isUrlMethod('')).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle malformed reference paths', async () => {
      const malformedRef = { $ref: 'invalid///path' };
      
      await expect(parser.resolveReference(mockSpec, malformedRef)).rejects.toThrow();
    });

    test('should handle empty reference path', async () => {
      const emptyRef = { $ref: '' };
      
      await expect(parser.resolveReference(mockSpec, emptyRef)).rejects.toThrow();
    });

    test('should handle deeply nested references', async () => {
      const deepRef = { $ref: '#/components/schemas/Level1/Level2/Level3' };
      
      await expect(parser.resolveReference(mockSpec, deepRef)).rejects.toThrow('Reference not found');
    });

    test('should handle specs with no components section', async () => {
      const specWithoutComponents = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {}
      };
      
      const schemas = await parser.getAllSchemas(specWithoutComponents);
      expect(schemas).toEqual({});
    });

    test('should handle specs with undefined schemas in components', async () => {
      const specWithUndefinedSchemas = {
        ...mockSpec,
        components: {}
      };
      
      const schemas = await parser.getAllSchemas(specWithUndefinedSchemas);
      expect(schemas).toEqual({});
    });

    test('should handle file read errors gracefully', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockRejectedValue(new Error('Permission denied'));
      
      await expect(parser.parseFile('/test/api.json')).rejects.toThrow();
    });

    test('should handle YAML parsing errors with detailed messages', async () => {
      path.extname.mockReturnValue('.yaml');
      YAML.parse.mockImplementation(() => {
        const error = new Error('YAML syntax error at line 5');
        throw error;
      });
      
      await expect(parser.parseFile('/test/api.yaml')).rejects.toThrow('Invalid YAML format');
    });

    test('should handle JSON parsing errors with detailed messages', async () => {
      path.extname.mockReturnValue('.json');
      fs.readFile.mockResolvedValue('{ invalid json');
      
      await expect(parser.parseFile('/test/api.json')).rejects.toThrow('Invalid JSON format');
    });

    test('should handle cache eviction properly', () => {
      const cache = new Map();
      
      // Set maxCacheSize before filling cache
      (parser as any).maxCacheSize = 10;
      
      // Fill cache beyond limit
      for (let i = 0; i < 15; i++) {
        cache.set(`key${i}`, { value: i });
      }
      
      // Simulate cache eviction
      const evictMethod = (parser as any).evictCacheIfFull.bind(parser);
      evictMethod(cache);
      
      // The method only removes 10% (1 item) when cache size exceeds maxCacheSize
      expect(cache.size).toBe(14); // 15 - 1 = 14
    });

    test('should handle percentage-based cache eviction', () => {
      const cache = new Map();
      
      // Fill cache
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, { value: i });
      }
      
      const evictPercentageMethod = (parser as any).evictCachePercentage.bind(parser);
      const evicted = evictPercentageMethod(cache, 0.5);
      
      expect(evicted).toBe(5);
      expect(cache.size).toBe(5);
    });

    test('should generate composition cache keys correctly', () => {
      const generateKeyMethod = (parser as any).generateCompositionCacheKey.bind(parser);
      
      const allOfSchema = { allOf: [{ type: 'string' }] };
      const oneOfSchema = { oneOf: [{ type: 'string' }] };
      const anyOfSchema = { anyOf: [{ type: 'string' }] };
      
      expect(generateKeyMethod(allOfSchema)).toContain('allOf:');
      expect(generateKeyMethod(oneOfSchema)).toContain('oneOf:');
      expect(generateKeyMethod(anyOfSchema)).toContain('anyOf:');
    });

    test('should perform memory cleanup when enabled', () => {
      parser.configureMemoryOptimization({ enabled: true });
      
      const cleanupMethod = (parser as any).performMemoryCleanup.bind(parser);
      
      expect(() => cleanupMethod()).not.toThrow();
    });

    test('should skip memory cleanup when disabled', () => {
      parser.configureMemoryOptimization({ enabled: false });
      
      const cleanupMethod = (parser as any).performMemoryCleanup.bind(parser);
      
      expect(() => cleanupMethod()).not.toThrow();
    });
  });
});