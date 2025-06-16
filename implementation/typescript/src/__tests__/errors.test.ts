import {
  createParsingError,
  createGenerationError,
  ErrorCode,
  OpenAPIParsingError,
  OpenAPIGenerationError,
  ERROR_SUGGESTIONS
} from '../errors';

describe('Error Creation and Handling', () => {
  describe('createParsingError', () => {
    test('should create basic parsing error', () => {
      const error = createParsingError(
        'Test error message',
        ErrorCode.INVALID_JSON,
        ['test', 'path']
      );

      expect(error).toBeInstanceOf(OpenAPIParsingError);
      expect(error.message).toBe('Test error message');
      expect(error.context.errorCode).toBe(ErrorCode.INVALID_JSON);
      expect(error.context.schemaPath).toEqual(['test', 'path']);
    });

    test('should create parsing error with original error', () => {
      const originalError = new Error('Original error');
      const error = createParsingError(
        'Test error message',
        ErrorCode.INVALID_YAML,
        ['yaml', 'path'],
        { originalError }
      );

      expect(error.context.originalError).toBe(originalError);
    });

    test('should create parsing error with suggestion', () => {
      const error = createParsingError(
        'Test error message',
        ErrorCode.MISSING_OPENAPI_VERSION,
        ['openapi'],
        { suggestion: 'Add openapi version' }
      );

      expect(error.context.suggestion).toBe('Add openapi version');
    });

    test('should use default suggestion from ERROR_SUGGESTIONS', () => {
      const error = createParsingError(
        'Test error message',
        ErrorCode.MISSING_OPENAPI_VERSION,
        ['openapi']
      );

      expect(error.context.suggestion).toBe(ERROR_SUGGESTIONS[ErrorCode.MISSING_OPENAPI_VERSION]);
    });
  });

  describe('createGenerationError', () => {
    test('should create basic generation error', () => {
      const error = createGenerationError(
        'Test generation error',
        ErrorCode.TEMPLATE_GENERATION_FAILED,
        ['generation', 'path']
      );

      expect(error).toBeInstanceOf(OpenAPIGenerationError);
      expect(error.message).toBe('Test generation error');
      expect(error.context.errorCode).toBe(ErrorCode.TEMPLATE_GENERATION_FAILED);
      expect(error.context.schemaPath).toEqual(['generation', 'path']);
    });

    test('should create generation error with all options', () => {
      const originalError = new Error('Original generation error');
      const error = createGenerationError(
        'Test generation error',
        ErrorCode.UNSUPPORTED_SCHEMA_TYPE,
        ['schema', 'type'],
        {
          originalError,
          suggestion: 'Use supported schema type',
          context: { additionalInfo: 'test' }
        }
      );

      expect(error.context.originalError).toBe(originalError);
      expect(error.context.suggestion).toBe('Use supported schema type');
      expect(error.context.context).toEqual({ additionalInfo: 'test' });
    });
  });

  describe('OpenAPIParsingError', () => {
    test('should create error with proper inheritance', () => {
      const error = new OpenAPIParsingError('Test message', {
        errorCode: ErrorCode.REFERENCE_NOT_FOUND,
        schemaPath: ['ref', 'path']
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OpenAPIParsingError);
      expect(error.name).toBe('OpenAPIParsingError');
    });

    test('should handle empty schema path', () => {
      const error = new OpenAPIParsingError('Test message', {
        errorCode: ErrorCode.INVALID_SPEC_TYPE,
        schemaPath: []
      });

      expect(error.context.schemaPath).toEqual([]);
    });
  });

  describe('OpenAPIGenerationError', () => {
    test('should create error with proper inheritance', () => {
      const error = new OpenAPIGenerationError('Test message', {
        errorCode: ErrorCode.INVALID_PROPERTY_NAME,
        schemaPath: ['property', 'name']
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(OpenAPIGenerationError);
      expect(error.name).toBe('OpenAPIGenerationError');
    });
  });

  describe('ErrorCode enum', () => {
    test('should contain all expected error codes', () => {
      expect(ErrorCode.FILE_NOT_FOUND).toBeDefined();
      expect(ErrorCode.UNSUPPORTED_FORMAT).toBeDefined();
      expect(ErrorCode.INVALID_JSON).toBeDefined();
      expect(ErrorCode.INVALID_YAML).toBeDefined();
      expect(ErrorCode.INVALID_SPEC_TYPE).toBeDefined();
      expect(ErrorCode.MISSING_OPENAPI_VERSION).toBeDefined();
      expect(ErrorCode.UNSUPPORTED_OPENAPI_VERSION).toBeDefined();
      expect(ErrorCode.MISSING_INFO).toBeDefined();
      expect(ErrorCode.MISSING_INFO_TITLE).toBeDefined();
      expect(ErrorCode.MISSING_INFO_VERSION).toBeDefined();
      expect(ErrorCode.MISSING_PATHS).toBeDefined();
      expect(ErrorCode.REFERENCE_NOT_FOUND).toBeDefined();
      expect(ErrorCode.EXTERNAL_FETCH_FAILED).toBeDefined();
      expect(ErrorCode.ALLOF_MERGE_CONFLICT).toBeDefined();
      expect(ErrorCode.ONEOF_DISCRIMINATOR_MISSING).toBeDefined();
      expect(ErrorCode.ANYOF_NO_VARIANTS).toBeDefined();
      expect(ErrorCode.TEMPLATE_GENERATION_FAILED).toBeDefined();
      expect(ErrorCode.UNSUPPORTED_SCHEMA_TYPE).toBeDefined();
      expect(ErrorCode.INVALID_PROPERTY_NAME).toBeDefined();
    });
  });

  describe('ERROR_SUGGESTIONS', () => {
    test('should provide helpful suggestions for common errors', () => {
      expect(ERROR_SUGGESTIONS[ErrorCode.MISSING_OPENAPI_VERSION]).toContain('openapi');
      expect(ERROR_SUGGESTIONS[ErrorCode.INVALID_JSON]).toContain('JSON');
      expect(ERROR_SUGGESTIONS[ErrorCode.INVALID_YAML]).toContain('YAML');
      expect(ERROR_SUGGESTIONS[ErrorCode.REFERENCE_NOT_FOUND]).toContain('reference');
    });

    test('should have suggestions for all error codes', () => {
      const errorCodes = Object.values(ErrorCode);
      for (const errorCode of errorCodes) {
        expect(ERROR_SUGGESTIONS[errorCode]).toBeDefined();
        expect(typeof ERROR_SUGGESTIONS[errorCode]).toBe('string');
        expect(ERROR_SUGGESTIONS[errorCode].length).toBeGreaterThan(0);
      }
    });
  });
});