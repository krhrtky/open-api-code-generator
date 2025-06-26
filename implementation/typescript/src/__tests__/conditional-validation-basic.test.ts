/**
 * Basic test suite for ConditionalValidator
 * Tests core functionality to improve coverage
 */

import { ConditionalValidator } from '../conditional-validation';
import { OpenAPISchema } from '../types';

describe('ConditionalValidator Basic Tests', () => {
  let validator: ConditionalValidator;

  beforeEach(() => {
    validator = new ConditionalValidator();
  });

  describe('constructor', () => {
    test('should initialize validator', () => {
      expect(validator).toBeInstanceOf(ConditionalValidator);
    });
  });

  describe('validateConditionalSchema', () => {
    test('should validate simple if-then schema', async () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          type: { type: 'string' },
          value: { type: 'string' }
        },
        if: {
          properties: {
            type: { const: 'email' }
          }
        },
        then: {
          properties: {
            value: { format: 'email' }
          }
        }
      };

      const validData = { type: 'email', value: 'test@example.com' };
      const result = await validator.validateConditionalSchema(validData, schema);
      
      expect(result.isValid).toBe(true);
    });

    test('should validate if-then-else schema', async () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          type: { type: 'string' },
          value: { type: 'string' }
        },
        if: {
          properties: {
            type: { const: 'number' }
          }
        },
        then: {
          properties: {
            value: { type: 'number' }
          }
        },
        else: {
          properties: {
            value: { type: 'string' }
          }
        }
      };

      const validData = { type: 'text', value: 'hello' };
      const result = await validator.validateConditionalSchema(validData, schema);
      
      expect(result.isValid).toBe(true);
    });

    test('should handle validation errors', async () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          type: { type: 'string' },
          value: { type: 'string' }
        },
        if: {
          properties: {
            type: { const: 'email' }
          }
        },
        then: {
          properties: {
            value: { format: 'email' }
          }
        }
      };

      const invalidData = { type: 'email', value: 'invalid-email' };
      const result = await validator.validateConditionalSchema(invalidData, schema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should handle schema without conditional logic', async () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const data = { name: 'test' };
      const result = await validator.validateConditionalSchema(data, schema);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('generateConditionalValidationCode', () => {
    test('should generate validation code for if-then schema', () => {
      const schema: OpenAPISchema = {
        if: {
          properties: {
            type: { const: 'email' }
          }
        },
        then: {
          properties: {
            value: { format: 'email' }
          }
        }
      };

      const code = validator.generateConditionalValidationCode('TestValidator', schema);
      
      expect(code).toContain('TestValidator');
      expect(code).toContain('if');
      expect(code).toContain('then');
    });

    test('should generate validation code for if-then-else schema', () => {
      const schema: OpenAPISchema = {
        if: {
          properties: {
            type: { const: 'number' }
          }
        },
        then: {
          properties: {
            value: { type: 'number' }
          }
        },
        else: {
          properties: {
            value: { type: 'string' }
          }
        }
      };

      const code = validator.generateConditionalValidationCode('FlexibleValidator', schema);
      
      expect(code).toContain('FlexibleValidator');
      expect(code).toContain('if');
      expect(code).toContain('then');
      expect(code).toContain('else');
    });

    test('should handle schema without conditional logic', () => {
      const schema: OpenAPISchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const code = validator.generateConditionalValidationCode('SimpleValidator', schema);
      
      expect(code).toContain('SimpleValidator');
    });
  });

  describe('validateIfCondition', () => {
    test('should validate if condition with const', async () => {
      const ifCondition = {
        properties: {
          type: { const: 'email' }
        }
      };

      const data = { type: 'email' };
      const result = await validator.validateIfCondition(data, ifCondition);
      
      expect(result).toBe(true);
    });

    test('should validate if condition with enum', async () => {
      const ifCondition = {
        properties: {
          category: { enum: ['A', 'B', 'C'] }
        }
      };

      const data = { category: 'B' };
      const result = await validator.validateIfCondition(data, ifCondition);
      
      expect(result).toBe(true);
    });

    test('should return false for non-matching condition', async () => {
      const ifCondition = {
        properties: {
          type: { const: 'email' }
        }
      };

      const data = { type: 'text' };
      const result = await validator.validateIfCondition(data, ifCondition);
      
      expect(result).toBe(false);
    });
  });

  describe('validateThenElseSchema', () => {
    test('should validate then schema', async () => {
      const thenSchema = {
        properties: {
          value: { type: 'string', minLength: 5 }
        }
      };

      const data = { value: 'hello world' };
      const result = await validator.validateThenElseSchema(data, thenSchema);
      
      expect(result.isValid).toBe(true);
    });

    test('should return validation errors for then schema', async () => {
      const thenSchema = {
        properties: {
          value: { type: 'string', minLength: 10 }
        }
      };

      const data = { value: 'short' };
      const result = await validator.validateThenElseSchema(data, thenSchema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('generateIfConditionCode', () => {
    test('should generate code for const condition', () => {
      const ifCondition = {
        properties: {
          type: { const: 'email' }
        }
      };

      const code = validator.generateIfConditionCode(ifCondition);
      
      expect(code).toContain('type');
      expect(code).toContain('email');
    });

    test('should generate code for enum condition', () => {
      const ifCondition = {
        properties: {
          category: { enum: ['A', 'B', 'C'] }
        }
      };

      const code = validator.generateIfConditionCode(ifCondition);
      
      expect(code).toContain('category');
      expect(code).toContain('A');
    });

    test('should handle complex conditions', () => {
      const ifCondition = {
        properties: {
          type: { const: 'complex' },
          status: { enum: ['active', 'inactive'] }
        }
      };

      const code = validator.generateIfConditionCode(ifCondition);
      
      expect(code).toContain('type');
      expect(code).toContain('status');
    });
  });

  describe('generateThenElseCode', () => {
    test('should generate code for then schema', () => {
      const thenSchema = {
        properties: {
          value: { type: 'string', format: 'email' }
        }
      };

      const code = validator.generateThenElseCode(thenSchema);
      
      expect(code).toContain('value');
      expect(code).toContain('email');
    });

    test('should generate code for complex schema', () => {
      const schema = {
        properties: {
          data: {
            type: 'object',
            properties: {
              nested: { type: 'string' }
            }
          }
        }
      };

      const code = validator.generateThenElseCode(schema);
      
      expect(code).toContain('data');
      expect(code).toContain('nested');
    });
  });

  describe('error handling', () => {
    test('should handle invalid data types', async () => {
      const schema: OpenAPISchema = {
        if: {
          properties: {
            type: { const: 'email' }
          }
        },
        then: {
          properties: {
            value: { format: 'email' }
          }
        }
      };

      const result = await validator.validateConditionalSchema(null, schema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
    });

    test('should handle missing required properties', async () => {
      const schema: OpenAPISchema = {
        if: {
          properties: {
            type: { const: 'email' }
          },
          required: ['type']
        },
        then: {
          properties: {
            value: { format: 'email' }
          },
          required: ['value']
        }
      };

      const invalidData = { type: 'email' }; // missing 'value'
      const result = await validator.validateConditionalSchema(invalidData, schema);
      
      expect(result.isValid).toBe(false);
    });
  });

  describe('utility methods', () => {
    test('should check if schema has conditional logic', () => {
      const conditionalSchema = {
        if: { properties: { type: { const: 'test' } } },
        then: { properties: { value: { type: 'string' } } }
      };

      const simpleSchema = {
        type: 'object',
        properties: { name: { type: 'string' } }
      };

      expect(validator.hasConditionalLogic(conditionalSchema)).toBe(true);
      expect(validator.hasConditionalLogic(simpleSchema)).toBe(false);
    });

    test('should generate validation result', () => {
      const errors = ['Error 1', 'Error 2'];
      const result = validator.createValidationResult(false, errors);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(errors);
    });
  });
});