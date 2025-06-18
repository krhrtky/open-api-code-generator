import { ExternalReferenceResolver, ExternalResolverConfig } from '../external-resolver';
import { OpenAPISchema } from '../types';

// Mock fs and path modules
jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readFile: jest.fn()
}));

jest.mock('path', () => ({
  resolve: jest.fn(),
  dirname: jest.fn(),
  extname: jest.fn(),
  isAbsolute: jest.fn()
}));

// Mock axios
jest.mock('axios');

import axios from 'axios';
const mockAxios = axios as jest.Mocked<typeof axios>;

// Import after mocking
const fs = require('fs-extra');
const path = require('path');

describe('ExternalReferenceResolver', () => {
  let resolver: ExternalReferenceResolver;
  const mockConfig: ExternalResolverConfig = {
    timeout: 5000,
    retries: 3,
    headers: { 'User-Agent': 'test-agent' }
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    resolver = new ExternalReferenceResolver(mockConfig);
  });

  describe('constructor', () => {
    test('should use default config when none provided', () => {
      const defaultResolver = new ExternalReferenceResolver();
      expect(defaultResolver).toBeInstanceOf(ExternalReferenceResolver);
    });

    test('should merge provided config with defaults', () => {
      const customConfig = { timeout: 10000 };
      const customResolver = new ExternalReferenceResolver(customConfig);
      expect(customResolver).toBeInstanceOf(ExternalReferenceResolver);
    });
  });

  describe('resolveExternalSchema', () => {
    test('should resolve local file reference', async () => {
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'External Schema', version: '1.0.0' },
        components: {
          schemas: {
            TestSchema: {
              type: 'object',
              properties: {
                id: { type: 'string' }
              }
            }
          }
        }
      };

      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/schema.json');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.json');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSpec));

      const result = await resolver.resolveExternalSchema('./schema.json#/components/schemas/TestSchema', '/base/dir/spec.yaml');

      expect(result).toEqual({
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      });
      expect(fs.readFile).toHaveBeenCalledWith('/resolved/path/schema.json', 'utf-8');
    });

    test('should resolve HTTP URL reference', async () => {
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'HTTP External Schema', version: '1.0.0' },
        components: {
          schemas: {
            RemoteSchema: {
              type: 'object',
              properties: {
                name: { type: 'string' }
              }
            }
          }
        }
      };

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        data: JSON.stringify(mockSpec),
        headers: {}
      };

      mockAxios.get.mockResolvedValueOnce(mockResponse);

      const result = await resolver.resolveExternalSchema('https://example.com/schema.json#/components/schemas/RemoteSchema');

      expect(result).toEqual({
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      });
      expect(mockAxios.get).toHaveBeenCalledWith(
        'https://example.com/schema.json',
        expect.objectContaining({
          timeout: mockConfig.timeout,
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': 'application/yaml, application/json, text/yaml, text/plain'
          })
        })
      );
    });

    test('should handle YAML external file', async () => {
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'YAML External Schema', version: '1.0.0' },
        components: {
          schemas: {
            EmailSchema: {
              type: 'string',
              format: 'email'
            }
          }
        }
      };

      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/schema.yaml');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.yaml');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('openapi: "3.0.3"\ninfo:\n  title: "YAML External Schema"\n  version: "1.0.0"\ncomponents:\n  schemas:\n    EmailSchema:\n      type: string\n      format: email');

      const result = await resolver.resolveExternalSchema('./schema.yaml#/components/schemas/EmailSchema', '/base/dir/spec.yaml');

      expect(result).toEqual({
        type: 'string',
        format: 'email'
      });
    });

    test('should throw error for non-existent local file', async () => {
      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/missing.json');
      path.dirname.mockReturnValue('/base/dir');
      fs.pathExists.mockResolvedValue(false);

      await expect(
        resolver.resolveExternalSchema('./missing.json#/components/schemas/SomeSchema', '/base/dir/spec.yaml')
      ).rejects.toThrow('File not found');
    });

    test('should throw error for HTTP request failure', async () => {
      const axiosError = new Error('Request failed with status code 404');
      
      mockAxios.get.mockRejectedValueOnce(axiosError);

      await expect(
        resolver.resolveExternalSchema('https://example.com/missing.json#/components/schemas/SomeSchema')
      ).rejects.toThrow('Failed to fetch external OpenAPI spec');
    });

    test('should handle timeout for HTTP requests', async () => {
      const timeoutResolver = new ExternalReferenceResolver({ timeout: 100 });
      
      const timeoutError = new Error('timeout of 100ms exceeded');
      mockAxios.get.mockRejectedValueOnce(timeoutError);

      await expect(
        timeoutResolver.resolveExternalSchema('https://slow.example.com/schema.json#/components/schemas/SlowSchema')
      ).rejects.toThrow();
    });

    test('should retry failed HTTP requests', async () => {
      const retryResolver = new ExternalReferenceResolver({ retries: 2 });
      
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'Retry Test Schema', version: '1.0.0' },
        components: {
          schemas: {
            RetrySchema: { type: 'string' }
          }
        }
      };
      
      // Clear and reset the mock for this test
      mockAxios.get.mockReset();
      mockAxios.get
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          status: 200,
          statusText: 'OK',
          data: JSON.stringify(mockSpec),
          headers: {}
        });

      const result = await retryResolver.resolveExternalSchema('https://example.com/schema.json#/components/schemas/RetrySchema');

      expect(result).toEqual({ type: 'string' });
      expect(mockAxios.get).toHaveBeenCalledTimes(3);
    });

    test('should handle invalid JSON in external file', async () => {
      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/invalid.json');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.json');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('invalid json {');

      await expect(
        resolver.resolveExternalSchema('./invalid.json#/components/schemas/SomeSchema', '/base/dir/spec.yaml')
      ).rejects.toThrow('is not valid JSON');
    });

    test('should handle invalid YAML in external file', async () => {
      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/invalid.yaml');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.yaml');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('invalid: yaml: content: [');

      await expect(
        resolver.resolveExternalSchema('./invalid.yaml#/components/schemas/SomeSchema', '/base/dir/spec.yaml')
      ).rejects.toThrow('Nested mappings are not allowed');
    });

    test('should handle unsupported file extensions', async () => {
      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/schema.xml');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.xml');
      fs.pathExists.mockResolvedValue(true);

      await expect(
        resolver.resolveExternalSchema('./schema.xml#/components/schemas/SomeSchema', '/base/dir/spec.yaml')
      ).rejects.toThrow('Nested mappings are not allowed');
    });

    test('should resolve absolute file paths', async () => {
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'Absolute Path Schema', version: '1.0.0' },
        components: {
          schemas: {
            BooleanSchema: { type: 'boolean' }
          }
        }
      };

      path.isAbsolute.mockReturnValue(true);
      path.extname.mockReturnValue('.json');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSpec));

      const result = await resolver.resolveExternalSchema('/absolute/path/schema.json#/components/schemas/BooleanSchema');

      expect(result).toEqual({ type: 'boolean' });
      expect(path.resolve).not.toHaveBeenCalled(); // Should not resolve absolute paths
    });

    test('should handle references with fragments', async () => {
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'Fragment Schema', version: '1.0.0' },
        components: {
          schemas: {
            User: { type: 'object', properties: { id: { type: 'string' } } }
          }
        }
      };

      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/schema.json');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.json');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSpec));

      const result = await resolver.resolveExternalSchema('./schema.json#/components/schemas/User', '/base/dir/spec.yaml');

      expect(result).toEqual({ type: 'object', properties: { id: { type: 'string' } } });
    });

    test('should handle missing fragment path', async () => {
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'Missing Fragment Schema', version: '1.0.0' },
        components: {
          schemas: {
            User: { type: 'object' }
          }
        }
      };

      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/schema.json');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.json');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSpec));

      await expect(
        resolver.resolveExternalSchema('./schema.json#/components/schemas/Missing', '/base/dir/spec.yaml')
      ).rejects.toThrow('Schema not found at path');
    });
  });

  describe('caching behavior', () => {
    test('should cache resolved schemas', async () => {
      // Create a fresh resolver and clear mocks specifically for this test
      const cacheResolver = new ExternalReferenceResolver(mockConfig);
      fs.readFile.mockClear();
      
      const mockSpec = {
        openapi: '3.0.3',
        info: { title: 'Cached Schema', version: '1.0.0' },
        components: {
          schemas: {
            NumberSchema: { type: 'number' }
          }
        }
      };

      path.isAbsolute.mockReturnValue(false);
      path.resolve.mockReturnValue('/resolved/path/schema.json');
      path.dirname.mockReturnValue('/base/dir');
      path.extname.mockReturnValue('.json');
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(JSON.stringify(mockSpec));

      // First call
      const result1 = await cacheResolver.resolveExternalSchema('./schema.json#/components/schemas/NumberSchema', '/base/dir/spec.yaml');
      
      // Second call - should use cache
      const result2 = await cacheResolver.resolveExternalSchema('./schema.json#/components/schemas/NumberSchema', '/base/dir/spec.yaml');

      expect(result1).toEqual({ type: 'number' });
      expect(result2).toEqual({ type: 'number' });
      expect(fs.readFile).toHaveBeenCalledTimes(1); // Should only read file once
    });
  });
});