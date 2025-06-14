import { OpenAPISpec, OpenAPISchema, OpenAPIReference } from './types';
export declare class OpenAPIParser {
    parseFile(filePath: string): Promise<OpenAPISpec>;
    private validateSpec;
    resolveReference(spec: OpenAPISpec, ref: OpenAPIReference): OpenAPISchema;
    isReference(obj: any): obj is OpenAPIReference;
    resolveSchema(spec: OpenAPISpec, schema: OpenAPISchema | OpenAPIReference): OpenAPISchema;
    private resolveAllOfSchema;
    private resolveOneOfSchema;
    private resolveAnyOfSchema;
    extractSchemaName(ref: string): string;
    getAllSchemas(spec: OpenAPISpec): Record<string, OpenAPISchema>;
    getAllTags(spec: OpenAPISpec): string[];
}
