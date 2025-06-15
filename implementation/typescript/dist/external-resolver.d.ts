import { OpenAPISpec, OpenAPISchema } from './types';
export interface ExternalResolverConfig {
    timeout?: number;
    maxCacheSize?: number;
    cacheEnabled?: boolean;
    allowedDomains?: string[];
    maxRedirects?: number;
    userAgent?: string;
}
export interface CachedSpec {
    spec: OpenAPISpec;
    timestamp: number;
    etag?: string;
    lastModified?: string;
}
export declare class ExternalReferenceResolver {
    private cache;
    private config;
    constructor(config?: ExternalResolverConfig);
    /**
     * 外部参照を解決する
     * @param refPath 参照パス（URL or ファイルパス）
     * @param baseUrl ベースURL（相対パス解決用）
     * @returns 解決されたOpenAPI仕様
     */
    resolveExternalReference(refPath: string, baseUrl?: string): Promise<OpenAPISpec>;
    /**
     * 外部参照からスキーマを解決する
     * @param refPath 参照パス（URL#/path/to/schema形式）
     * @param baseUrl ベースURL
     * @returns 解決されたスキーマ
     */
    resolveExternalSchema(refPath: string, baseUrl?: string): Promise<OpenAPISchema>;
    /**
     * HTTPからOpenAPI仕様を取得
     */
    private fetchHttpSpec;
    /**
     * ファイルからOpenAPI仕様を読み込み
     */
    private loadFileSpec;
    /**
     * OpenAPI仕様のコンテンツをパース
     */
    private parseSpecContent;
    /**
     * 参照パスを解析（URL#/path/to/schema形式）
     */
    private parseReference;
    /**
     * OpenAPI仕様からスキーマを抽出
     */
    private extractSchemaFromSpec;
    /**
     * URLを解決（相対パス対応）
     */
    private resolveUrl;
    /**
     * HTTPs/HTTP URLかチェック
     */
    private isHttpUrl;
    /**
     * JSONコンテンツかチェック
     */
    private isJsonContent;
    /**
     * ドメイン制限チェック
     */
    private validateDomain;
    /**
     * キャッシュが有効かチェック（5分間有効）
     */
    private isCacheValid;
    /**
     * 仕様をキャッシュに保存
     */
    private cacheSpec;
    /**
     * キャッシュをクリア
     */
    clearCache(): void;
    /**
     * キャッシュ統計を取得
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
    };
}
