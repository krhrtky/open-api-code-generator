import { EventEmitter } from 'events';
import { OpenAPISpec, OpenAPISchema, OpenAPIReference } from './types';
import { ExternalResolverConfig } from './external-resolver';
import { WebhookService } from './webhook';
export declare class OpenAPIParser extends EventEmitter {
    private externalResolver;
    private baseUrl?;
    private webhookService?;
    constructor(externalResolverConfig?: ExternalResolverConfig, webhookService?: WebhookService);
    parseFile(filePath: string): Promise<OpenAPISpec>;
    private validateSpec;
    resolveReference(spec: OpenAPISpec, ref: OpenAPIReference): Promise<OpenAPISchema>;
    isReference(obj: any): obj is OpenAPIReference;
    resolveSchema(spec: OpenAPISpec, schema: OpenAPISchema | OpenAPIReference): Promise<OpenAPISchema>;
    private resolveAllOfSchema;
    private resolveOneOfSchema;
    private resolveAnyOfSchema;
    extractSchemaName(ref: string): string;
    getAllSchemas(spec: OpenAPISpec): Promise<Record<string, OpenAPISchema>>;
    getAllTags(spec: OpenAPISpec): string[];
    /**
     * Check if a string is a URL
     */
    private isUrl;
    /**
     * Set webhook service for event notifications
     */
    setWebhookService(webhookService: WebhookService): void;
}
