export interface ErrorContext {
    schemaPath: string[];
    line?: number;
    column?: number;
    suggestion?: string;
    errorCode?: string;
    originalError?: Error;
}
export declare class OpenAPIParsingError extends Error {
    readonly context: ErrorContext;
    readonly originalError?: Error;
    constructor(message: string, context: ErrorContext, originalError?: Error);
    /**
     * Get formatted error message with context information
     */
    getFormattedMessage(): string;
    /**
     * Get error details as structured object
     */
    getErrorDetails(): {
        message: string;
        code: string | undefined;
        path: string[];
        location: {
            line: number;
            column: number;
        } | undefined;
        suggestion: string | undefined;
        originalError: string | undefined;
    };
}
export declare class OpenAPIGenerationError extends Error {
    readonly context: ErrorContext;
    readonly originalError?: Error;
    constructor(message: string, context: ErrorContext, originalError?: Error);
    getFormattedMessage(): string;
}
/**
 * Error codes for different types of OpenAPI parsing issues
 */
export declare enum ErrorCode {
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
    INVALID_JSON = "INVALID_JSON",
    INVALID_YAML = "INVALID_YAML",
    MISSING_OPENAPI_VERSION = "MISSING_OPENAPI_VERSION",
    UNSUPPORTED_OPENAPI_VERSION = "UNSUPPORTED_OPENAPI_VERSION",
    MISSING_INFO = "MISSING_INFO",
    MISSING_INFO_TITLE = "MISSING_INFO_TITLE",
    MISSING_INFO_VERSION = "MISSING_INFO_VERSION",
    MISSING_PATHS = "MISSING_PATHS",
    INVALID_SPEC_TYPE = "INVALID_SPEC_TYPE",
    EXTERNAL_REFERENCE_NOT_SUPPORTED = "EXTERNAL_REFERENCE_NOT_SUPPORTED",
    REFERENCE_NOT_FOUND = "REFERENCE_NOT_FOUND",
    CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE",
    EXTERNAL_FETCH_FAILED = "EXTERNAL_FETCH_FAILED",
    EXTERNAL_FILE_LOAD_FAILED = "EXTERNAL_FILE_LOAD_FAILED",
    EXTERNAL_PARSE_FAILED = "EXTERNAL_PARSE_FAILED",
    INVALID_REFERENCE_FORMAT = "INVALID_REFERENCE_FORMAT",
    DOMAIN_NOT_ALLOWED = "DOMAIN_NOT_ALLOWED",
    INVALID_URL_FORMAT = "INVALID_URL_FORMAT",
    ALLOF_MERGE_CONFLICT = "ALLOF_MERGE_CONFLICT",
    ONEOF_DISCRIMINATOR_MISSING = "ONEOF_DISCRIMINATOR_MISSING",
    ANYOF_NO_VARIANTS = "ANYOF_NO_VARIANTS",
    UNSUPPORTED_SCHEMA_TYPE = "UNSUPPORTED_SCHEMA_TYPE",
    INVALID_PROPERTY_NAME = "INVALID_PROPERTY_NAME",
    TEMPLATE_GENERATION_FAILED = "TEMPLATE_GENERATION_FAILED"
}
/**
 * Suggestion messages for common error scenarios
 */
export declare const ERROR_SUGGESTIONS: {
    readonly FILE_NOT_FOUND: "Verify the file path exists and you have read permissions";
    readonly UNSUPPORTED_FORMAT: "Use .json, .yaml, or .yml file extensions for OpenAPI specifications";
    readonly INVALID_JSON: "Check JSON syntax and ensure valid JSON format";
    readonly INVALID_YAML: "Check YAML syntax and ensure valid YAML format";
    readonly MISSING_OPENAPI_VERSION: "Add an \"openapi\" field specifying the OpenAPI version (e.g., \"3.0.3\")";
    readonly UNSUPPORTED_OPENAPI_VERSION: "Update to OpenAPI 3.x format (3.0.x or 3.1.x)";
    readonly MISSING_INFO: "Add an \"info\" object with \"title\" and \"version\" properties";
    readonly MISSING_INFO_TITLE: "Add a \"title\" field to the info object";
    readonly MISSING_INFO_VERSION: "Add a \"version\" field to the info object";
    readonly MISSING_PATHS: "Add a \"paths\" object defining API endpoints";
    readonly INVALID_SPEC_TYPE: "Ensure the root of the file is a valid JSON/YAML object";
    readonly EXTERNAL_REFERENCE_NOT_SUPPORTED: "Use local references within the same document (starting with \"#/\")";
    readonly REFERENCE_NOT_FOUND: "Ensure the referenced component exists in the components section";
    readonly CIRCULAR_REFERENCE: "Remove circular references between components";
    readonly EXTERNAL_FETCH_FAILED: "Check network connectivity and ensure the URL is accessible";
    readonly EXTERNAL_FILE_LOAD_FAILED: "Verify file path exists and you have read permissions";
    readonly EXTERNAL_PARSE_FAILED: "Ensure the external file contains valid OpenAPI specification";
    readonly INVALID_REFERENCE_FORMAT: "Use format: \"file.yaml#/path/to/schema\" for external references";
    readonly DOMAIN_NOT_ALLOWED: "Add the domain to allowedDomains in resolver configuration";
    readonly INVALID_URL_FORMAT: "Use valid HTTP/HTTPS URLs or proper file paths";
    readonly ALLOF_MERGE_CONFLICT: "Resolve conflicting properties in allOf schemas";
    readonly ONEOF_DISCRIMINATOR_MISSING: "Add a discriminator property to distinguish oneOf variants";
    readonly ANYOF_NO_VARIANTS: "Ensure anyOf contains at least one schema variant";
    readonly UNSUPPORTED_SCHEMA_TYPE: "Use supported OpenAPI schema types: string, number, integer, boolean, array, object";
    readonly INVALID_PROPERTY_NAME: "Use valid property names that don't conflict with language keywords";
    readonly TEMPLATE_GENERATION_FAILED: "Check template syntax and ensure all required data is available";
};
/**
 * Utility function to create parsing errors with context
 */
export declare function createParsingError(message: string, errorCode: ErrorCode, schemaPath?: string[], options?: {
    line?: number;
    column?: number;
    suggestion?: string;
    originalError?: Error;
}): OpenAPIParsingError;
/**
 * Utility function to create generation errors with context
 */
export declare function createGenerationError(message: string, errorCode: ErrorCode, schemaPath?: string[], options?: {
    suggestion?: string;
    originalError?: Error;
}): OpenAPIGenerationError;
