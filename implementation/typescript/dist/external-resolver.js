"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalReferenceResolver = void 0;
const axios_1 = __importDefault(require("axios"));
const yaml = __importStar(require("yaml"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs-extra"));
const errors_1 = require("./errors");
class ExternalReferenceResolver {
    constructor(config = {}) {
        this.cache = new Map();
        this.config = {
            timeout: config.timeout ?? 30000, // 30秒
            maxCacheSize: config.maxCacheSize ?? 100,
            cacheEnabled: config.cacheEnabled ?? true,
            allowedDomains: config.allowedDomains ?? [],
            maxRedirects: config.maxRedirects ?? 5,
            userAgent: config.userAgent ?? 'OpenAPI-CodeGen/1.0.0'
        };
    }
    /**
     * 外部参照を解決する
     * @param refPath 参照パス（URL or ファイルパス）
     * @param baseUrl ベースURL（相対パス解決用）
     * @returns 解決されたOpenAPI仕様
     */
    async resolveExternalReference(refPath, baseUrl) {
        const resolvedUrl = this.resolveUrl(refPath, baseUrl);
        if (this.isHttpUrl(resolvedUrl)) {
            return this.fetchHttpSpec(resolvedUrl);
        }
        else {
            return this.loadFileSpec(resolvedUrl);
        }
    }
    /**
     * 外部参照からスキーマを解決する
     * @param refPath 参照パス（URL#/path/to/schema形式）
     * @param baseUrl ベースURL
     * @returns 解決されたスキーマ
     */
    async resolveExternalSchema(refPath, baseUrl) {
        const [specPath, schemaPath] = this.parseReference(refPath);
        const spec = await this.resolveExternalReference(specPath, baseUrl);
        if (!schemaPath) {
            throw (0, errors_1.createParsingError)(`Invalid external reference format: ${refPath}`, errors_1.ErrorCode.INVALID_REFERENCE_FORMAT, ['$ref']);
        }
        return this.extractSchemaFromSpec(spec, schemaPath);
    }
    /**
     * HTTPからOpenAPI仕様を取得
     */
    async fetchHttpSpec(url) {
        this.validateDomain(url);
        // キャッシュチェック
        if (this.config.cacheEnabled) {
            const cached = this.cache.get(url);
            if (cached && this.isCacheValid(cached)) {
                return cached.spec;
            }
        }
        try {
            const response = await axios_1.default.get(url, {
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
        }
        catch (error) {
            throw (0, errors_1.createParsingError)(`Failed to fetch external OpenAPI spec from ${url}: ${error.message}`, errors_1.ErrorCode.EXTERNAL_FETCH_FAILED, ['$ref'], { originalError: error });
        }
    }
    /**
     * ファイルからOpenAPI仕様を読み込み
     */
    async loadFileSpec(filePath) {
        try {
            if (!await fs.pathExists(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }
            const content = await fs.readFile(filePath, 'utf-8');
            return this.parseSpecContent(content, filePath);
        }
        catch (error) {
            throw (0, errors_1.createParsingError)(`Failed to load external OpenAPI spec from ${filePath}: ${error.message}`, errors_1.ErrorCode.EXTERNAL_FILE_LOAD_FAILED, ['$ref'], { originalError: error });
        }
    }
    /**
     * OpenAPI仕様のコンテンツをパース
     */
    parseSpecContent(content, source) {
        try {
            let spec;
            if (source.endsWith('.json') || this.isJsonContent(content)) {
                spec = JSON.parse(content);
            }
            else {
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
            return spec;
        }
        catch (error) {
            throw (0, errors_1.createParsingError)(`Failed to parse OpenAPI spec from ${source}: ${error.message}`, errors_1.ErrorCode.EXTERNAL_PARSE_FAILED, [], { originalError: error });
        }
    }
    /**
     * 参照パスを解析（URL#/path/to/schema形式）
     */
    parseReference(refPath) {
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
    extractSchemaFromSpec(spec, schemaPath) {
        const parts = schemaPath.split('/');
        let current = spec;
        for (const part of parts) {
            if (!current || typeof current !== 'object' || !(part in current)) {
                throw (0, errors_1.createParsingError)(`Schema not found at path: ${schemaPath}`, errors_1.ErrorCode.REFERENCE_NOT_FOUND, parts.slice(0, parts.indexOf(part) + 1));
            }
            current = current[part];
        }
        return current;
    }
    /**
     * URLを解決（相対パス対応）
     */
    resolveUrl(refPath, baseUrl) {
        if (this.isHttpUrl(refPath)) {
            return refPath;
        }
        if (baseUrl && this.isHttpUrl(baseUrl)) {
            try {
                return new URL(refPath, baseUrl).toString();
            }
            catch {
                throw (0, errors_1.createParsingError)(`Invalid URL combination: base=${baseUrl}, ref=${refPath}`, errors_1.ErrorCode.INVALID_URL_FORMAT, ['$ref']);
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
    isHttpUrl(url) {
        return url.startsWith('http://') || url.startsWith('https://');
    }
    /**
     * JSONコンテンツかチェック
     */
    isJsonContent(content) {
        const trimmed = content.trim();
        return trimmed.startsWith('{') || trimmed.startsWith('[');
    }
    /**
     * ドメイン制限チェック
     */
    validateDomain(url) {
        if (this.config.allowedDomains.length > 0) {
            try {
                const urlObj = new URL(url);
                const isAllowed = this.config.allowedDomains.some(domain => urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`));
                if (!isAllowed) {
                    throw (0, errors_1.createParsingError)(`Domain not allowed: ${urlObj.hostname}`, errors_1.ErrorCode.DOMAIN_NOT_ALLOWED, ['$ref']);
                }
            }
            catch (error) {
                if (error.code === errors_1.ErrorCode.DOMAIN_NOT_ALLOWED) {
                    throw error;
                }
                throw (0, errors_1.createParsingError)(`Invalid URL format: ${url}`, errors_1.ErrorCode.INVALID_URL_FORMAT, ['$ref']);
            }
        }
    }
    /**
     * キャッシュが有効かチェック（5分間有効）
     */
    isCacheValid(cached) {
        const now = Date.now();
        const cacheAge = now - cached.timestamp;
        return cacheAge < 300000; // 5分
    }
    /**
     * 仕様をキャッシュに保存
     */
    cacheSpec(url, spec, etag, lastModified) {
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
    clearCache() {
        this.cache.clear();
    }
    /**
     * キャッシュ統計を取得
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.config.maxCacheSize
        };
    }
}
exports.ExternalReferenceResolver = ExternalReferenceResolver;
//# sourceMappingURL=external-resolver.js.map