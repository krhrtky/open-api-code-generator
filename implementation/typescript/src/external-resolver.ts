import axios, { AxiosResponse } from 'axios';
import * as yaml from 'yaml';
import * as path from 'path';
import * as fs from 'fs-extra';
import { OpenAPISpec, OpenAPISchema } from './types';
import { createParsingError, ErrorCode } from './errors';

export interface ExternalResolverConfig {
  timeout?: number;
  maxCacheSize?: number;
  cacheEnabled?: boolean;
  allowedDomains?: string[];
  maxRedirects?: number;
  userAgent?: string;
  retries?: number;
  headers?: Record<string, string>;
}

export interface CachedSpec {
  spec: OpenAPISpec;
  timestamp: number;
  etag?: string;
  lastModified?: string;
}

export class ExternalReferenceResolver {
  private cache = new Map<string, CachedSpec>();
  private config: Required<ExternalResolverConfig>;

  constructor(config: ExternalResolverConfig = {}) {
    this.config = {
      timeout: config.timeout ?? 30000, // 30秒
      maxCacheSize: config.maxCacheSize ?? 100,
      cacheEnabled: config.cacheEnabled ?? true,
      allowedDomains: config.allowedDomains ?? [],
      maxRedirects: config.maxRedirects ?? 5,
      userAgent: config.userAgent ?? 'OpenAPI-CodeGen/1.0.0',
      retries: config.retries ?? 3,
      headers: config.headers ?? {}
    };
  }

  /**
   * 外部参照を解決する
   * @param refPath 参照パス（URL or ファイルパス）
   * @param baseUrl ベースURL（相対パス解決用）
   * @returns 解決されたOpenAPI仕様
   */
  async resolveExternalReference(refPath: string, baseUrl?: string): Promise<OpenAPISpec> {
    const resolvedUrl = this.resolveUrl(refPath, baseUrl);
    
    if (this.isHttpUrl(resolvedUrl)) {
      return this.fetchHttpSpec(resolvedUrl);
    } else {
      return this.loadFileSpec(resolvedUrl);
    }
  }

  /**
   * 外部参照からスキーマを解決する
   * @param refPath 参照パス（URL#/path/to/schema形式）
   * @param baseUrl ベースURL
   * @returns 解決されたスキーマ
   */
  async resolveExternalSchema(refPath: string, baseUrl?: string): Promise<OpenAPISchema> {
    const [specPath, schemaPath] = this.parseReference(refPath);
    const spec = await this.resolveExternalReference(specPath, baseUrl);
    
    if (!schemaPath) {
      throw createParsingError(
        `Invalid external reference format: ${refPath}`,
        ErrorCode.INVALID_REFERENCE_FORMAT,
        ['$ref']
      );
    }

    return this.extractSchemaFromSpec(spec, schemaPath);
  }

  /**
   * HTTPからOpenAPI仕様を取得
   */
  private async fetchHttpSpec(url: string): Promise<OpenAPISpec> {
    this.validateDomain(url);

    // キャッシュチェック
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(url);
      if (cached && this.isCacheValid(cached)) {
        return cached.spec;
      }
    }

    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        const response: AxiosResponse = await axios.get(url, {
          timeout: this.config.timeout,
          maxRedirects: this.config.maxRedirects,
          headers: {
            'User-Agent': this.config.userAgent,
            'Accept': 'application/yaml, application/json, text/yaml, text/plain'
          },
          validateStatus: (status) => status >= 200 && status < 400
        });

        const spec = this.parseSpecContent(response.data, url);
        
        // キャッシュに保存
        if (this.config.cacheEnabled) {
          this.cacheSpec(url, spec, response.headers.etag, response.headers['last-modified']);
        }

        return spec;
      } catch (error: any) {
        lastError = error;
        if (attempt < this.config.retries) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }
    
    throw createParsingError(
      `Failed to fetch external OpenAPI spec from ${url}: ${lastError.message}`,
      ErrorCode.EXTERNAL_FETCH_FAILED,
      ['$ref'],
      { originalError: lastError }
    );
  }

  /**
   * ファイルからOpenAPI仕様を読み込み
   */
  private async loadFileSpec(filePath: string): Promise<OpenAPISpec> {
    // キャッシュチェック
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(filePath);
      if (cached && this.isCacheValid(cached)) {
        return cached.spec;
      }
    }

    try {
      if (!await fs.pathExists(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const content = await fs.readFile(filePath, 'utf-8');
      const spec = this.parseSpecContent(content, filePath);
      
      // キャッシュに保存
      if (this.config.cacheEnabled) {
        this.cacheSpec(filePath, spec);
      }

      return spec;
    } catch (error: any) {
      throw createParsingError(
        `Failed to load external OpenAPI spec from ${filePath}: ${error.message}`,
        ErrorCode.EXTERNAL_FILE_LOAD_FAILED,
        ['$ref'],
        { originalError: error }
      );
    }
  }

  /**
   * OpenAPI仕様のコンテンツをパース
   */
  private parseSpecContent(content: string, source: string): OpenAPISpec {
    try {
      let spec: any;
      
      if (source.endsWith('.json') || this.isJsonContent(content)) {
        spec = JSON.parse(content);
      } else {
        spec = yaml.parse(content);
      }

      // 基本的なOpenAPI仕様の検証
      if (!spec || typeof spec !== 'object') {
        throw new Error('Invalid OpenAPI specification format');
      }

      if (!spec.openapi && !spec.swagger) {
        throw new Error('Missing openapi or swagger version field');
      }

      if (!spec.info || !spec.info.title || !spec.info.version) {
        throw new Error('Missing required info fields (title, version)');
      }

      return spec as OpenAPISpec;
    } catch (error: any) {
      throw createParsingError(
        `Failed to parse OpenAPI spec from ${source}: ${error.message}`,
        ErrorCode.EXTERNAL_PARSE_FAILED,
        [],
        { originalError: error }
      );
    }
  }

  /**
   * 参照パスを解析（URL#/path/to/schema形式）
   */
  private parseReference(refPath: string): [string, string | null] {
    const hashIndex = refPath.indexOf('#');
    if (hashIndex === -1) {
      return [refPath, null];
    }
    
    const specPath = refPath.substring(0, hashIndex);
    const schemaPath = refPath.substring(hashIndex + 1);
    
    return [specPath, schemaPath.startsWith('/') ? schemaPath.substring(1) : schemaPath];
  }

  /**
   * OpenAPI仕様からスキーマを抽出
   */
  private extractSchemaFromSpec(spec: OpenAPISpec, schemaPath: string): OpenAPISchema {
    const parts = schemaPath.split('/');
    let current: any = spec;

    for (const part of parts) {
      if (!current || typeof current !== 'object' || !(part in current)) {
        throw createParsingError(
          `Schema not found at path: ${schemaPath}`,
          ErrorCode.REFERENCE_NOT_FOUND,
          parts.slice(0, parts.indexOf(part) + 1)
        );
      }
      current = current[part];
    }

    return current as OpenAPISchema;
  }

  /**
   * URLを解決（相対パス対応）
   */
  private resolveUrl(refPath: string, baseUrl?: string): string {
    if (this.isHttpUrl(refPath)) {
      return refPath;
    }

    if (baseUrl && this.isHttpUrl(baseUrl)) {
      try {
        return new URL(refPath, baseUrl).toString();
      } catch {
        throw createParsingError(
          `Invalid URL combination: base=${baseUrl}, ref=${refPath}`,
          ErrorCode.INVALID_URL_FORMAT,
          ['$ref']
        );
      }
    }

    if (path.isAbsolute(refPath)) {
      return refPath;
    }

    if (baseUrl && !this.isHttpUrl(baseUrl)) {
      return path.resolve(path.dirname(baseUrl), refPath);
    }

    return path.resolve(refPath);
  }

  /**
   * HTTPs/HTTP URLかチェック
   */
  private isHttpUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://');
  }

  /**
   * JSONコンテンツかチェック
   */
  private isJsonContent(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  /**
   * ドメイン制限チェック
   */
  private validateDomain(url: string): void {
    if (this.config.allowedDomains.length > 0) {
      try {
        const urlObj = new URL(url);
        const isAllowed = this.config.allowedDomains.some(domain => 
          urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
        );
        
        if (!isAllowed) {
          throw createParsingError(
            `Domain not allowed: ${urlObj.hostname}`,
            ErrorCode.DOMAIN_NOT_ALLOWED,
            ['$ref']
          );
        }
      } catch (error: any) {
        if (error.code === ErrorCode.DOMAIN_NOT_ALLOWED) {
          throw error;
        }
        throw createParsingError(
          `Invalid URL format: ${url}`,
          ErrorCode.INVALID_URL_FORMAT,
          ['$ref']
        );
      }
    }
  }

  /**
   * キャッシュが有効かチェック（5分間有効）
   */
  private isCacheValid(cached: CachedSpec): boolean {
    const now = Date.now();
    const cacheAge = now - cached.timestamp;
    return cacheAge < 300000; // 5分
  }

  /**
   * 仕様をキャッシュに保存
   */
  private cacheSpec(url: string, spec: OpenAPISpec, etag?: string, lastModified?: string): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.config.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(url, {
      spec,
      timestamp: Date.now(),
      etag,
      lastModified
    });
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * キャッシュ統計を取得
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize
    };
  }
}