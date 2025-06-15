export interface ErrorContext {
  schemaPath: string[];
  line?: number;
  column?: number;
  suggestion?: string;
  errorCode?: string;
  originalError?: Error;
}

export class OpenAPIParsingError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
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
  getFormattedMessage(): string {
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

export class OpenAPIGenerationError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'OpenAPIGenerationError';
    this.context = context;
    this.originalError = originalError;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OpenAPIGenerationError);
    }
  }

  getFormattedMessage(): string {
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

/**
 * Error codes for different types of OpenAPI parsing issues
 */
export enum ErrorCode {
  // File and format errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',
  INVALID_JSON = 'INVALID_JSON',
  INVALID_YAML = 'INVALID_YAML',
  
  // OpenAPI specification errors
  MISSING_OPENAPI_VERSION = 'MISSING_OPENAPI_VERSION',
  UNSUPPORTED_OPENAPI_VERSION = 'UNSUPPORTED_OPENAPI_VERSION',
  MISSING_INFO = 'MISSING_INFO',
  MISSING_INFO_TITLE = 'MISSING_INFO_TITLE',
  MISSING_INFO_VERSION = 'MISSING_INFO_VERSION',
  MISSING_PATHS = 'MISSING_PATHS',
  INVALID_SPEC_TYPE = 'INVALID_SPEC_TYPE',
  
  // Reference errors
  EXTERNAL_REFERENCE_NOT_SUPPORTED = 'EXTERNAL_REFERENCE_NOT_SUPPORTED',
  REFERENCE_NOT_FOUND = 'REFERENCE_NOT_FOUND',
  CIRCULAR_REFERENCE = 'CIRCULAR_REFERENCE',
  EXTERNAL_FETCH_FAILED = 'EXTERNAL_FETCH_FAILED',
  EXTERNAL_FILE_LOAD_FAILED = 'EXTERNAL_FILE_LOAD_FAILED',
  EXTERNAL_PARSE_FAILED = 'EXTERNAL_PARSE_FAILED',
  INVALID_REFERENCE_FORMAT = 'INVALID_REFERENCE_FORMAT',
  DOMAIN_NOT_ALLOWED = 'DOMAIN_NOT_ALLOWED',
  INVALID_URL_FORMAT = 'INVALID_URL_FORMAT',
  
  // Schema composition errors
  ALLOF_MERGE_CONFLICT = 'ALLOF_MERGE_CONFLICT',
  ONEOF_DISCRIMINATOR_MISSING = 'ONEOF_DISCRIMINATOR_MISSING',
  ANYOF_NO_VARIANTS = 'ANYOF_NO_VARIANTS',
  
  // Code generation errors
  UNSUPPORTED_SCHEMA_TYPE = 'UNSUPPORTED_SCHEMA_TYPE',
  INVALID_PROPERTY_NAME = 'INVALID_PROPERTY_NAME',
  TEMPLATE_GENERATION_FAILED = 'TEMPLATE_GENERATION_FAILED'
}

/**
 * Suggestion messages for common error scenarios
 */
export const ERROR_SUGGESTIONS = {
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
  [ErrorCode.EXTERNAL_FETCH_FAILED]: 'Check network connectivity and ensure the URL is accessible',
  [ErrorCode.EXTERNAL_FILE_LOAD_FAILED]: 'Verify file path exists and you have read permissions',
  [ErrorCode.EXTERNAL_PARSE_FAILED]: 'Ensure the external file contains valid OpenAPI specification',
  [ErrorCode.INVALID_REFERENCE_FORMAT]: 'Use format: "file.yaml#/path/to/schema" for external references',
  [ErrorCode.DOMAIN_NOT_ALLOWED]: 'Add the domain to allowedDomains in resolver configuration',
  [ErrorCode.INVALID_URL_FORMAT]: 'Use valid HTTP/HTTPS URLs or proper file paths',
  [ErrorCode.ALLOF_MERGE_CONFLICT]: 'Resolve conflicting properties in allOf schemas',
  [ErrorCode.ONEOF_DISCRIMINATOR_MISSING]: 'Add a discriminator property to distinguish oneOf variants',
  [ErrorCode.ANYOF_NO_VARIANTS]: 'Ensure anyOf contains at least one schema variant',
  [ErrorCode.UNSUPPORTED_SCHEMA_TYPE]: 'Use supported OpenAPI schema types: string, number, integer, boolean, array, object',
  [ErrorCode.INVALID_PROPERTY_NAME]: 'Use valid property names that don\'t conflict with language keywords',
  [ErrorCode.TEMPLATE_GENERATION_FAILED]: 'Check template syntax and ensure all required data is available'
} as const;

/**
 * Utility function to create parsing errors with context
 */
export function createParsingError(
  message: string,
  errorCode: ErrorCode,
  schemaPath: string[] = [],
  options: {
    line?: number;
    column?: number;
    suggestion?: string;
    originalError?: Error;
  } = {}
): OpenAPIParsingError {
  return new OpenAPIParsingError(message, {
    schemaPath,
    errorCode,
    line: options.line,
    column: options.column,
    suggestion: options.suggestion || ERROR_SUGGESTIONS[errorCode],
    originalError: options.originalError
  }, options.originalError);
}

/**
 * Utility function to create generation errors with context
 */
export function createGenerationError(
  message: string,
  errorCode: ErrorCode,
  schemaPath: string[] = [],
  options: {
    suggestion?: string;
    originalError?: Error;
  } = {}
): OpenAPIGenerationError {
  return new OpenAPIGenerationError(message, {
    schemaPath,
    errorCode,
    suggestion: options.suggestion || ERROR_SUGGESTIONS[errorCode],
    originalError: options.originalError
  }, options.originalError);
}