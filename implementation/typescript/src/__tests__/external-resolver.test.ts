import { ExternalReferenceResolver, ExternalResolverConfig } from '../external-resolver';
import { OpenAPISchema } from '../types';
import * as fs from 'fs-extra';
import * as path from 'path';

// Mock fs and path modules
jest.mock('fs-extra');
jest.mock('path');

// Mock global fetch
global.fetch = jest.fn();

const mockFs = fs as jest.Mocked<typeof fs>;
const mockPath = path as jest.Mocked<typeof path>;
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe('ExternalReferenceResolver', () => {
  let resolver: ExternalReferenceResolver;
  const mockConfig: ExternalResolverConfig = {
    timeout: 5000,
    retries: 3,
    headers: { 'User-Agent': 'test-agent' }
  };

  beforeEach(() => {
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
      const mockSchema: OpenAPISchema = {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      };

      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/schema.json');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.json');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSchema));

      const result = await resolver.resolveExternalSchema('./schema.json', '/base/dir/spec.yaml');

      expect(result).toEqual(mockSchema);
      expect(mockFs.readFile).toHaveBeenCalledWith('/resolved/path/schema.json', 'utf-8');
    });

    test('should resolve HTTP URL reference', async () => {
      const mockSchema: OpenAPISchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const mockResponse = {
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockSchema))
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await resolver.resolveExternalSchema('https://example.com/schema.json');

      expect(result).toEqual(mockSchema);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/schema.json',
        expect.objectContaining({
          headers: mockConfig.headers,
          signal: expect.any(AbortSignal)
        })
      );
    });

    test('should handle YAML external file', async () => {
      const mockSchema: OpenAPISchema = {
        type: 'string',
        format: 'email'
      };

      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/schema.yaml');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.yaml');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('type: string\nformat: email');

      const result = await resolver.resolveExternalSchema('./schema.yaml', '/base/dir/spec.yaml');

      expect(result).toEqual(mockSchema);
    });

    test('should throw error for non-existent local file', async () => {
      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/missing.json');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockFs.pathExists.mockResolvedValue(false);

      await expect(
        resolver.resolveExternalSchema('./missing.json', '/base/dir/spec.yaml')
      ).rejects.toThrow('External file not found');
    });

    test('should throw error for HTTP request failure', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        resolver.resolveExternalSchema('https://example.com/missing.json')
      ).rejects.toThrow('Failed to fetch external schema: 404 Not Found');
    });

    test('should handle timeout for HTTP requests', async () => {
      const timeoutResolver = new ExternalReferenceResolver({ timeout: 100 });
      
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 200))
      );

      await expect(
        timeoutResolver.resolveExternalSchema('https://slow.example.com/schema.json')
      ).rejects.toThrow();
    });

    test('should retry failed HTTP requests', async () => {
      const retryResolver = new ExternalReferenceResolver({ retries: 2 });
      
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('{"type": "string"}')
        } as any);

      const result = await retryResolver.resolveExternalSchema('https://example.com/schema.json');

      expect(result).toEqual({ type: 'string' });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test('should handle invalid JSON in external file', async () => {
      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/invalid.json');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.json');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('invalid json {');

      await expect(
        resolver.resolveExternalSchema('./invalid.json', '/base/dir/spec.yaml')
      ).rejects.toThrow('Failed to parse JSON');
    });

    test('should handle invalid YAML in external file', async () => {
      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/invalid.yaml');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.yaml');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue('invalid: yaml: content: [');

      await expect(
        resolver.resolveExternalSchema('./invalid.yaml', '/base/dir/spec.yaml')
      ).rejects.toThrow('Failed to parse YAML');
    });

    test('should handle unsupported file extensions', async () => {
      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/schema.xml');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.xml');
      mockFs.pathExists.mockResolvedValue(true);

      await expect(
        resolver.resolveExternalSchema('./schema.xml', '/base/dir/spec.yaml')
      ).rejects.toThrow('Unsupported external file format');
    });

    test('should resolve absolute file paths', async () => {
      const mockSchema: OpenAPISchema = { type: 'boolean' };

      mockPath.isAbsolute.mockReturnValue(true);
      mockPath.extname.mockReturnValue('.json');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSchema));

      const result = await resolver.resolveExternalSchema('/absolute/path/schema.json');

      expect(result).toEqual(mockSchema);
      expect(mockPath.resolve).not.toHaveBeenCalled(); // Should not resolve absolute paths
    });

    test('should handle references with fragments', async () => {
      const mockSchema = {
        components: {
          schemas: {
            User: { type: 'object', properties: { id: { type: 'string' } } }
          }
        }
      };

      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/schema.json');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.json');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSchema));

      const result = await resolver.resolveExternalSchema('./schema.json#/components/schemas/User', '/base/dir/spec.yaml');

      expect(result).toEqual({ type: 'object', properties: { id: { type: 'string' } } });
    });

    test('should handle missing fragment path', async () => {
      const mockSchema = {
        components: {
          schemas: {
            User: { type: 'object' }
          }
        }
      };

      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/schema.json');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.json');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSchema));

      await expect(
        resolver.resolveExternalSchema('./schema.json#/components/schemas/Missing', '/base/dir/spec.yaml')
      ).rejects.toThrow('Fragment path not found');
    });
  });

  describe('caching behavior', () => {
    test('should cache resolved schemas', async () => {
      const mockSchema: OpenAPISchema = { type: 'number' };

      mockPath.isAbsolute.mockReturnValue(false);
      mockPath.resolve.mockReturnValue('/resolved/path/schema.json');
      mockPath.dirname.mockReturnValue('/base/dir');
      mockPath.extname.mockReturnValue('.json');
      mockFs.pathExists.mockResolvedValue(true);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockSchema));

      // First call
      const result1 = await resolver.resolveExternalSchema('./schema.json', '/base/dir/spec.yaml');
      
      // Second call - should use cache
      const result2 = await resolver.resolveExternalSchema('./schema.json', '/base/dir/spec.yaml');

      expect(result1).toEqual(mockSchema);
      expect(result2).toEqual(mockSchema);
      expect(mockFs.readFile).toHaveBeenCalledTimes(1); // Should only read file once
    });
  });
});