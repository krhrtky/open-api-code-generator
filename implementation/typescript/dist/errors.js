"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_SUGGESTIONS = exports.ErrorCode = exports.OpenAPIGenerationError = exports.OpenAPIParsingError = void 0;
exports.createParsingError = createParsingError;
exports.createGenerationError = createGenerationError;
class OpenAPIParsingError extends Error {
    constructor(message, context, originalError) {
        super(message);
        this.name = 'OpenAPIParsingError';
        this.context = context;
        this.originalError = originalError;
        // Maintain proper stack trace for where our error was thrown (only V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, OpenAPIParsingError);
        }
    }
    /**
     * Get formatted error message with context information
     */
    getFormattedMessage() {
        const pathStr = this.context.schemaPath.length > 0
            ? ` at path: ${this.context.schemaPath.join('.')}`
            : '';
        const locationStr = this.context.line && this.context.column
            ? ` (line ${this.context.line}, column ${this.context.column})`
            : '';
        const suggestionStr = this.context.suggestion
            ? `\nSuggestion: ${this.context.suggestion}`
            : '';
        const errorCodeStr = this.context.errorCode
            ? ` [${this.context.errorCode}]`
            : '';
        return `${this.message}${pathStr}${locationStr}${errorCodeStr}${suggestionStr}`;
    }
    /**
     * Get error details as structured object
     */
    getErrorDetails() {
        return {
            message: this.message,
            code: this.context.errorCode,
            path: this.context.schemaPath,
            location: this.context.line && this.context.column ? {
                line: this.context.line,
                column: this.context.column
            } : undefined,
            suggestion: this.context.suggestion,
            originalError: this.originalError?.message
        };
    }
}
exports.OpenAPIParsingError = OpenAPIParsingError;
class OpenAPIGenerationError extends Error {
    constructor(message, context, originalError) {
        super(message);
        this.name = 'OpenAPIGenerationError';
        this.context = context;
        this.originalError = originalError;
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, OpenAPIGenerationError);
        }
    }
    getFormattedMessage() {
        const pathStr = this.context.schemaPath.length > 0
            ? ` for schema: ${this.context.schemaPath.join('.')}`
            : '';
        const suggestionStr = this.context.suggestion
            ? `\nSuggestion: ${this.context.suggestion}`
            : '';
        const errorCodeStr = this.context.errorCode
            ? ` [${this.context.errorCode}]`
            : '';
        return `${this.message}${pathStr}${errorCodeStr}${suggestionStr}`;
    }
}
exports.OpenAPIGenerationError = OpenAPIGenerationError;
/**
 * Error codes for different types of OpenAPI parsing issues
 */
var ErrorCode;
(function (ErrorCode) {
    // File and format errors
    ErrorCode["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    ErrorCode["UNSUPPORTED_FORMAT"] = "UNSUPPORTED_FORMAT";
    ErrorCode["INVALID_JSON"] = "INVALID_JSON";
    ErrorCode["INVALID_YAML"] = "INVALID_YAML";
    // OpenAPI specification errors
    ErrorCode["MISSING_OPENAPI_VERSION"] = "MISSING_OPENAPI_VERSION";
    ErrorCode["UNSUPPORTED_OPENAPI_VERSION"] = "UNSUPPORTED_OPENAPI_VERSION";
    ErrorCode["MISSING_INFO"] = "MISSING_INFO";
    ErrorCode["MISSING_INFO_TITLE"] = "MISSING_INFO_TITLE";
    ErrorCode["MISSING_INFO_VERSION"] = "MISSING_INFO_VERSION";
    ErrorCode["MISSING_PATHS"] = "MISSING_PATHS";
    ErrorCode["INVALID_SPEC_TYPE"] = "INVALID_SPEC_TYPE";
    // Reference errors
    ErrorCode["EXTERNAL_REFERENCE_NOT_SUPPORTED"] = "EXTERNAL_REFERENCE_NOT_SUPPORTED";
    ErrorCode["REFERENCE_NOT_FOUND"] = "REFERENCE_NOT_FOUND";
    ErrorCode["CIRCULAR_REFERENCE"] = "CIRCULAR_REFERENCE";
    // Schema composition errors
    ErrorCode["ALLOF_MERGE_CONFLICT"] = "ALLOF_MERGE_CONFLICT";
    ErrorCode["ONEOF_DISCRIMINATOR_MISSING"] = "ONEOF_DISCRIMINATOR_MISSING";
    ErrorCode["ANYOF_NO_VARIANTS"] = "ANYOF_NO_VARIANTS";
    // Code generation errors
    ErrorCode["UNSUPPORTED_SCHEMA_TYPE"] = "UNSUPPORTED_SCHEMA_TYPE";
    ErrorCode["INVALID_PROPERTY_NAME"] = "INVALID_PROPERTY_NAME";
    ErrorCode["TEMPLATE_GENERATION_FAILED"] = "TEMPLATE_GENERATION_FAILED";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
/**
 * Suggestion messages for common error scenarios
 */
exports.ERROR_SUGGESTIONS = {
    [ErrorCode.FILE_NOT_FOUND]: 'Verify the file path exists and you have read permissions',
    [ErrorCode.UNSUPPORTED_FORMAT]: 'Use .json, .yaml, or .yml file extensions for OpenAPI specifications',
    [ErrorCode.INVALID_JSON]: 'Check JSON syntax and ensure valid JSON format',
    [ErrorCode.INVALID_YAML]: 'Check YAML syntax and ensure valid YAML format',
    [ErrorCode.MISSING_OPENAPI_VERSION]: 'Add an "openapi" field specifying the OpenAPI version (e.g., "3.0.3")',
    [ErrorCode.UNSUPPORTED_OPENAPI_VERSION]: 'Update to OpenAPI 3.x format (3.0.x or 3.1.x)',
    [ErrorCode.MISSING_INFO]: 'Add an "info" object with "title" and "version" properties',
    [ErrorCode.MISSING_INFO_TITLE]: 'Add a "title" field to the info object',
    [ErrorCode.MISSING_INFO_VERSION]: 'Add a "version" field to the info object',
    [ErrorCode.MISSING_PATHS]: 'Add a "paths" object defining API endpoints',
    [ErrorCode.INVALID_SPEC_TYPE]: 'Ensure the root of the file is a valid JSON/YAML object',
    [ErrorCode.EXTERNAL_REFERENCE_NOT_SUPPORTED]: 'Use local references within the same document (starting with "#/")',
    [ErrorCode.REFERENCE_NOT_FOUND]: 'Ensure the referenced component exists in the components section',
    [ErrorCode.CIRCULAR_REFERENCE]: 'Remove circular references between components',
    [ErrorCode.ALLOF_MERGE_CONFLICT]: 'Resolve conflicting properties in allOf schemas',
    [ErrorCode.ONEOF_DISCRIMINATOR_MISSING]: 'Add a discriminator property to distinguish oneOf variants',
    [ErrorCode.ANYOF_NO_VARIANTS]: 'Ensure anyOf contains at least one schema variant',
    [ErrorCode.UNSUPPORTED_SCHEMA_TYPE]: 'Use supported OpenAPI schema types: string, number, integer, boolean, array, object',
    [ErrorCode.INVALID_PROPERTY_NAME]: 'Use valid property names that don\'t conflict with language keywords',
    [ErrorCode.TEMPLATE_GENERATION_FAILED]: 'Check template syntax and ensure all required data is available'
};
/**
 * Utility function to create parsing errors with context
 */
function createParsingError(message, errorCode, schemaPath = [], options = {}) {
    return new OpenAPIParsingError(message, {
        schemaPath,
        errorCode,
        line: options.line,
        column: options.column,
        suggestion: options.suggestion || exports.ERROR_SUGGESTIONS[errorCode],
        originalError: options.originalError
    }, options.originalError);
}
/**
 * Utility function to create generation errors with context
 */
function createGenerationError(message, errorCode, schemaPath = [], options = {}) {
    return new OpenAPIGenerationError(message, {
        schemaPath,
        errorCode,
        suggestion: options.suggestion || exports.ERROR_SUGGESTIONS[errorCode],
        originalError: options.originalError
    }, options.originalError);
}
//# sourceMappingURL=errors.js.map