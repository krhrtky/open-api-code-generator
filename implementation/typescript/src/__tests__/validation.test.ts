/**
 * Test suite for custom validation functionality
 * Tests Issue #4: Advanced validation annotation generation
 */

import { 
  ValidationRuleService,
  ValidationRule,
  ValidationUtils,
  BuiltInValidationRules,
  OpenAPISchemaWithValidation
} from '../validation';

describe('ValidationRuleService', () => {
  let service: ValidationRuleService;

  beforeEach(() => {
    service = new ValidationRuleService();
  });

  describe('Built-in Rules Registration', () => {
    test('should register EMAIL_UNIQUE rule', () => {
      expect(service.hasRule('EmailUnique')).toBe(true);
      const rule = service.getRule('EmailUnique');
      expect(rule).toBeDefined();
      expect(rule?.annotationClass).toBe('UniqueEmail');
    });

    test('should register STRONG_PASSWORD rule', () => {
      expect(service.hasRule('StrongPassword')).toBe(true);
      const rule = service.getRule('StrongPassword');
      expect(rule).toBeDefined();
      expect(rule?.annotationClass).toBe('StrongPassword');
    });

    test('should register PHONE_NUMBER rule', () => {
      expect(service.hasRule('PhoneNumber')).toBe(true);
      const rule = service.getRule('PhoneNumber');
      expect(rule).toBeDefined();
      expect(rule?.annotationClass).toBe('PhoneNumber');
    });
  });

  describe('Custom Rule Management', () => {
    test('should register custom validation rule', () => {
      const customRule: ValidationRule = {
        name: 'CustomTest',
        annotationClass: 'CustomTestAnnotation',
        messageTemplate: 'Custom validation failed',
        imports: ['javax.validation.Constraint'],
        validatorClass: 'CustomValidator'
      };

      service.registerRule(customRule);
      expect(service.hasRule('CustomTest')).toBe(true);
      
      const retrievedRule = service.getRule('CustomTest');
      expect(retrievedRule).toEqual(customRule);
    });

    test('should return all registered rules', () => {
      const allRules = service.getAllRules();
      expect(allRules.length).toBeGreaterThanOrEqual(3); // At least the 3 built-in rules
      
      const ruleNames = allRules.map(rule => rule.name);
      expect(ruleNames).toContain('EmailUnique');
      expect(ruleNames).toContain('StrongPassword');
      expect(ruleNames).toContain('PhoneNumber');
    });

    test('should return undefined for non-existent rule', () => {
      expect(service.getRule('NonExistentRule')).toBeUndefined();
      expect(service.hasRule('NonExistentRule')).toBe(false);
    });
  });
});

describe('ValidationUtils', () => {
  let service: ValidationRuleService;

  beforeEach(() => {
    service = new ValidationRuleService();
  });

  describe('extractValidationRules', () => {
    test('should extract email validation from format', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'email'
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('Email');
    });

    test('should extract password validation from format', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'password'
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('StrongPassword');
    });

    test('should extract phone validation from format', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'phone'
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('PhoneNumber');
    });

    test('should extract pattern validation', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        pattern: '^[A-Z]{2,3}$'
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('Pattern');
    });

    test('should extract size validation from string constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        minLength: 5,
        maxLength: 100
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('Size');
    });

    test('should extract numeric validation rules', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'number',
        minimum: 0,
        maximum: 100
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('DecimalMin');
      expect(rules).toContain('DecimalMax');
    });

    test('should extract custom validations from x-validation extension', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'email',
        'x-validation': {
          customValidations: ['EmailUnique', 'CustomRule']
        }
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('Email');
      expect(rules).toContain('EmailUnique');
      expect(rules).toContain('CustomRule');
    });
  });

  describe('generateValidationAnnotation', () => {
    test('should generate annotation without parameters', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      const annotation = ValidationUtils.generateValidationAnnotation(rule);
      expect(annotation).toBe('@UniqueEmail');
    });

    test('should generate annotation with parameters', () => {
      const rule = BuiltInValidationRules.STRONG_PASSWORD;
      const parameters = {
        minLength: 10,
        requireUppercase: true,
        requireSpecialChar: false
      };
      
      const annotation = ValidationUtils.generateValidationAnnotation(rule, parameters);
      expect(annotation).toContain('@StrongPassword');
      expect(annotation).toContain('minLength = 10');
      expect(annotation).toContain('requireUppercase = true');
      expect(annotation).toContain('requireSpecialChar = false');
    });
  });

  describe('generateAllValidationAnnotations', () => {
    test('should generate all annotations for complex schema', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'email',
        minLength: 5,
        maxLength: 100,
        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
        'x-validation': {
          customValidations: ['EmailUnique']
        }
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Email');
      expect(result.annotations).toContain('@UniqueEmail');
      expect(result.annotations).toContain('@Size(min = 5, max = 100)');
      expect(result.annotations).toContain('@Pattern(regexp = "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$")');
      
      expect(result.imports.has('javax.validation.constraints.Email')).toBe(true);
      expect(result.imports.has('javax.validation.constraints.Size')).toBe(true);
      expect(result.imports.has('javax.validation.constraints.Pattern')).toBe(true);
    });

    test('should handle numeric schema with min/max constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'integer',
        minimum: 18,
        maximum: 120
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Min(18)');
      expect(result.annotations).toContain('@Max(120)');
      expect(result.imports.has('javax.validation.constraints.Min')).toBe(true);
      expect(result.imports.has('javax.validation.constraints.Max')).toBe(true);
    });

    test('should handle password schema with strong password validation', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'password',
        minLength: 8,
        'x-validation': {
          customValidations: ['StrongPassword']
        }
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@StrongPassword');
      expect(result.annotations).toContain('@Size(min = 8)');
      
      // Check that the StrongPassword rule's imports are included
      const strongPasswordRule = service.getRule('StrongPassword');
      expect(strongPasswordRule).toBeDefined();
      strongPasswordRule!.imports.forEach(imp => {
        expect(result.imports.has(imp)).toBe(true);
      });
    });

    test('should handle empty schema gracefully', () => {
      const schema: OpenAPISchemaWithValidation = {};

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toEqual([]);
      expect(result.imports.size).toBe(0);
    });

    test('should handle schema with only minimum constraint', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'integer',
        minimum: 0
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Min(0)');
      expect(result.annotations).not.toContain('@Max');
      expect(result.imports.has('javax.validation.constraints.Min')).toBe(true);
    });

    test('should handle schema with only maximum constraint', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'number',
        maximum: 100.5
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Max(100.5)');
      expect(result.annotations).not.toContain('@Min');
      expect(result.imports.has('javax.validation.constraints.Max')).toBe(true);
    });

    test('should handle schema with only minLength constraint', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        minLength: 1
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Size(min = 1)');
      expect(result.imports.has('javax.validation.constraints.Size')).toBe(true);
    });

    test('should handle schema with only maxLength constraint', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        maxLength: 255
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Size(max = 255)');
      expect(result.imports.has('javax.validation.constraints.Size')).toBe(true);
    });

    test('should handle zero values for constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        minLength: 0,
        maxLength: 0
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Size(min = 0, max = 0)');
    });

    test('should handle negative values for numeric constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'integer',
        minimum: -100,
        maximum: -1
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Min(-100)');
      expect(result.annotations).toContain('@Max(-1)');
    });

    test('should handle complex patterns with special characters', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      expect(result.annotations).toContain('@Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$")');
    });

    test('should handle array item constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'array',
        minItems: 1,
        maxItems: 10
      };

      const result = ValidationUtils.extractValidationRules(schema);
      expect(result).toContain('Size');
    });

    test('should handle required fields constraint', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'object',
        required: ['field1', 'field2']
      };

      const result = ValidationUtils.extractValidationRules(schema);
      expect(result).toContain('NotNull');
    });

    test('should handle unknown format gracefully', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'unknown-format' as any
      };

      const result = ValidationUtils.extractValidationRules(schema);
      // Should not contain any format-based rules for unknown formats
      expect(result).not.toContain('Email');
      expect(result).not.toContain('StrongPassword');
      expect(result).not.toContain('PhoneNumber');
    });
  });
});

describe('ValidationRuleService - Edge Cases', () => {
  let service: ValidationRuleService;

  beforeEach(() => {
    service = new ValidationRuleService();
  });

  describe('registerValidationRule method', () => {
    test('should register rule with minimal information and defaults', () => {
      service.registerValidationRule('MinimalRule', {});
      
      const rule = service.getRule('MinimalRule');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('MinimalRule');
      expect(rule?.annotationClass).toBe('@MinimalRule');
      expect(rule?.messageTemplate).toBe('Validation failed for MinimalRule');
      expect(rule?.imports).toEqual([]);
      expect(rule?.parameters).toEqual({});
    });

    test('should register rule with partial information', () => {
      service.registerValidationRule('PartialRule', {
        annotationClass: 'CustomAnnotation',
        messageTemplate: 'Custom message'
      });
      
      const rule = service.getRule('PartialRule');
      expect(rule?.annotationClass).toBe('CustomAnnotation');
      expect(rule?.messageTemplate).toBe('Custom message');
      expect(rule?.name).toBe('PartialRule');
      expect(rule?.imports).toEqual([]);
      expect(rule?.parameters).toEqual({});
    });

    test('should override existing rule when registering with same name', () => {
      const originalRule = service.getRule('EmailUnique');
      expect(originalRule).toBeDefined();

      service.registerValidationRule('EmailUnique', {
        annotationClass: 'NewEmailAnnotation',
        messageTemplate: 'New email message'
      });

      const newRule = service.getRule('EmailUnique');
      expect(newRule?.annotationClass).toBe('NewEmailAnnotation');
      expect(newRule?.messageTemplate).toBe('New email message');
    });

    test('should handle rule registration with complex parameters', () => {
      service.registerValidationRule('ComplexRule', {
        annotationClass: 'ComplexAnnotation',
        parameters: {
          minValue: 10,
          maxValue: 100,
          allowNull: false,
          pattern: '^[A-Z]+$',
          nested: {
            subParam: 'value'
          }
        }
      });
      
      const rule = service.getRule('ComplexRule');
      expect(rule?.parameters).toEqual({
        minValue: 10,
        maxValue: 100,
        allowNull: false,
        pattern: '^[A-Z]+$',
        nested: {
          subParam: 'value'
        }
      });
    });
  });

  describe('getValidationRule alias method', () => {
    test('should work as alias for getRule', () => {
      const rule1 = service.getRule('EmailUnique');
      const rule2 = service.getValidationRule('EmailUnique');
      
      expect(rule1).toEqual(rule2);
    });

    test('should return undefined for non-existent rule', () => {
      expect(service.getValidationRule('NonExistent')).toBeUndefined();
    });
  });

  describe('rule name case sensitivity', () => {
    test('should be case sensitive for rule names', () => {
      expect(service.hasRule('emailunique')).toBe(false);
      expect(service.hasRule('EMAILUNIQUE')).toBe(false);
      expect(service.hasRule('EmailUnique')).toBe(true);
    });
  });

  describe('rule registration edge cases', () => {
    test('should handle empty string rule name', () => {
      service.registerValidationRule('', {
        annotationClass: 'EmptyNameRule'
      });
      
      const rule = service.getRule('');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('');
    });

    test('should handle special characters in rule name', () => {
      const specialName = 'Special-Rule_123';
      service.registerValidationRule(specialName, {
        annotationClass: 'SpecialAnnotation'
      });
      
      expect(service.hasRule(specialName)).toBe(true);
      expect(service.getRule(specialName)?.name).toBe(specialName);
    });

    test('should handle null/undefined values in rule definition', () => {
      service.registerValidationRule('NullValueRule', {
        annotationClass: undefined as any,
        messageTemplate: null as any,
        imports: undefined as any,
        parameters: null as any
      });
      
      const rule = service.getRule('NullValueRule');
      expect(rule).toBeDefined();
      expect(rule?.annotationClass).toBe('@NullValueRule'); // Default
      expect(rule?.messageTemplate).toBe('Validation failed for NullValueRule'); // Default
      expect(rule?.imports).toEqual([]); // Default
      expect(rule?.parameters).toEqual({}); // Default
    });
  });
});

describe('ValidationUtils - Edge Cases and Boundary Tests', () => {
  let service: ValidationRuleService;

  beforeEach(() => {
    service = new ValidationRuleService();
  });

  describe('generateValidationAnnotation edge cases', () => {
    test('should handle annotation with empty parameters object', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      const annotation = ValidationUtils.generateValidationAnnotation(rule, {});
      expect(annotation).toBe('@UniqueEmail');
    });

    test('should handle annotation with null/undefined parameters', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      const annotation1 = ValidationUtils.generateValidationAnnotation(rule, null as any);
      const annotation2 = ValidationUtils.generateValidationAnnotation(rule, undefined);
      
      expect(annotation1).toBe('@UniqueEmail');
      expect(annotation2).toBe('@UniqueEmail');
    });

    test('should handle parameters with special values', () => {
      const rule = BuiltInValidationRules.STRONG_PASSWORD;
      const parameters = {
        minLength: 0,
        requireUppercase: false,
        message: 'Test "quotes" and \'apostrophes\'',
        nullValue: null,
        undefinedValue: undefined
      };
      
      const annotation = ValidationUtils.generateValidationAnnotation(rule, parameters);
      expect(annotation).toContain('@StrongPassword');
      expect(annotation).toContain('minLength = 0');
      expect(annotation).toContain('requireUppercase = false');
      expect(annotation).toContain('"Test \\"quotes\\" and \'apostrophes\'"');
      expect(annotation).toContain('nullValue = null');
      expect(annotation).toContain('undefinedValue = null'); // JSON.stringify converts undefined to null
    });

    test('should handle parameters with complex nested objects', () => {
      const rule = BuiltInValidationRules.PHONE_NUMBER;
      const parameters = {
        regions: ['US', 'UK', 'JP'],
        config: {
          strict: true,
          format: 'international'
        }
      };
      
      const annotation = ValidationUtils.generateValidationAnnotation(rule, parameters);
      expect(annotation).toContain('@PhoneNumber');
      expect(annotation).toContain('regions = ["US","UK","JP"]');
      expect(annotation).toContain('config = {"strict":true,"format":"international"}');
    });
  });

  describe('extractValidationRules boundary conditions', () => {
    test('should handle schema with boundary values for constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        minLength: Number.MAX_SAFE_INTEGER,
        maxLength: Number.MAX_SAFE_INTEGER,
        minimum: Number.MIN_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('Size');
      expect(rules).toContain('DecimalMin');
      expect(rules).toContain('DecimalMax');
    });

    test('should handle schema with floating point constraints', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'number',
        minimum: 0.1,
        maximum: 99.99
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      expect(result.annotations).toContain('@Min(0.1)');
      expect(result.annotations).toContain('@Max(99.99)');
    });

    test('should handle schema with very large numbers', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'number',
        minimum: 1e10,
        maximum: 1e20
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      expect(result.annotations).toContain('@Min(10000000000)');
      expect(result.annotations).toContain('@Max(100000000000000000000)');
    });

    test('should handle empty arrays in schema', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'object',
        required: []
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).not.toContain('NotNull');
    });

    test('should handle schema with only null type', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'null' as any
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules.length).toBe(0);
    });

    test('should handle schema without type property', () => {
      const schema: OpenAPISchemaWithValidation = {
        format: 'email',
        pattern: '^test$'
      };

      const rules = ValidationUtils.extractValidationRules(schema);
      expect(rules).toContain('Email');
      expect(rules).toContain('Pattern');
    });
  });

  describe('generateAllValidationAnnotations error handling', () => {
    test('should handle service without registered rules', () => {
      const emptyService = new ValidationRuleService();
      // Clear built-in rules by creating a new service and not registering anything
      const clearService = Object.create(ValidationRuleService.prototype);
      clearService.rules = new Map();
      clearService.hasRule = function(name: string) { return false; };
      clearService.getRule = function(name: string) { return undefined; };

      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'email',
        'x-validation': {
          customValidations: ['NonExistentRule']
        }
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, clearService);
      // Should still generate built-in validation
      expect(result.annotations).toContain('@Email');
      // But not the custom one
      expect(result.annotations.every(ann => !ann.includes('NonExistentRule'))).toBe(true);
    });

    test('should handle mixed existing and non-existing custom rules', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        'x-validation': {
          customValidations: ['EmailUnique', 'NonExistentRule1', 'StrongPassword', 'NonExistentRule2']
        }
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      
      // Should include existing rules
      expect(result.annotations).toContain('@UniqueEmail');
      expect(result.annotations).toContain('@StrongPassword');
      
      // Should not include non-existent rules
      expect(result.annotations.every(ann => !ann.includes('NonExistentRule'))).toBe(true);
    });

    test('should handle rules with empty imports array', () => {
      const customRule: ValidationRule = {
        name: 'EmptyImportsRule',
        annotationClass: 'EmptyImports',
        messageTemplate: 'Test',
        imports: []
      };
      
      service.registerRule(customRule);
      
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        'x-validation': {
          customValidations: ['EmptyImportsRule']
        }
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      expect(result.annotations).toContain('@EmptyImports');
      // Should not crash with empty imports
      expect(result.imports.size).toBeGreaterThanOrEqual(0);
    });

    test('should handle schema with x-validation but no customValidations', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        format: 'email',
        'x-validation': {}
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      expect(result.annotations).toContain('@Email');
    });

    test('should handle schema with empty x-validation object', () => {
      const schema: OpenAPISchemaWithValidation = {
        type: 'string',
        'x-validation': {
          customValidations: [],
          conditionalValidations: [],
          crossFieldValidations: []
        }
      };

      const result = ValidationUtils.generateAllValidationAnnotations(schema, service);
      expect(result.annotations.length).toBe(0);
      expect(result.imports.size).toBe(0);
    });
  });
});

describe('Built-in Validation Rules - Detailed Testing', () => {
  describe('EMAIL_UNIQUE rule edge cases', () => {
    test('should contain proper null handling in validator', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      expect(rule.validatorClass).toContain('if (email == null) return true');
    });

    test('should contain repository dependency injection', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      expect(rule.validatorClass).toContain('@Autowired');
      expect(rule.validatorClass).toContain('UserRepository userRepository');
    });

    test('should have all required annotation imports', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      const requiredImports = [
        'javax.validation.Constraint',
        'javax.validation.Payload',
        'java.lang.annotation.ElementType',
        'java.lang.annotation.Retention',
        'java.lang.annotation.RetentionPolicy',
        'java.lang.annotation.Target'
      ];
      
      requiredImports.forEach(imp => {
        expect(rule.imports).toContain(imp);
      });
    });
  });

  describe('STRONG_PASSWORD rule edge cases', () => {
    test('should handle all password strength requirements', () => {
      const rule = BuiltInValidationRules.STRONG_PASSWORD;
      
      // Check for all validation patterns
      expect(rule.validatorClass).toContain('password.matches(".*[A-Z].*")'); // Uppercase
      expect(rule.validatorClass).toContain('password.matches(".*[a-z].*")'); // Lowercase
      expect(rule.validatorClass).toContain('password.matches(".*\\\\d.*")'); // Digit
      expect(rule.validatorClass).toContain('requireSpecialChar'); // Special character check
    });

    test('should have configurable parameters', () => {
      const rule = BuiltInValidationRules.STRONG_PASSWORD;
      
      expect(rule.validatorClass).toContain('int minLength() default 8');
      expect(rule.validatorClass).toContain('boolean requireUppercase() default true');
      expect(rule.validatorClass).toContain('boolean requireLowercase() default true');
      expect(rule.validatorClass).toContain('boolean requireDigit() default true');
      expect(rule.validatorClass).toContain('boolean requireSpecialChar() default true');
    });

    test('should reject null passwords', () => {
      const rule = BuiltInValidationRules.STRONG_PASSWORD;
      expect(rule.validatorClass).toContain('if (password == null) return false');
    });
  });

  describe('PHONE_NUMBER rule edge cases', () => {
    test('should handle null phone numbers gracefully', () => {
      const rule = BuiltInValidationRules.PHONE_NUMBER;
      expect(rule.validatorClass).toContain('if (phoneNumber == null) return true');
    });

    test('should have configurable region parameter', () => {
      const rule = BuiltInValidationRules.PHONE_NUMBER;
      expect(rule.validatorClass).toContain('String region() default "US"');
    });

    test('should contain phone number cleaning logic', () => {
      const rule = BuiltInValidationRules.PHONE_NUMBER;
      expect(rule.validatorClass).toContain('phoneNumber.replaceAll("[^\\\\d+]", "")');
    });

    test('should validate international phone number format', () => {
      const rule = BuiltInValidationRules.PHONE_NUMBER;
      expect(rule.validatorClass).toContain('cleanNumber.matches("^\\\\+?[1-9]\\\\d{6,14}$")');
    });
  });
});

describe('Built-in Validation Rules', () => {
  describe('EMAIL_UNIQUE rule', () => {
    test('should have correct structure', () => {
      const rule = BuiltInValidationRules.EMAIL_UNIQUE;
      
      expect(rule.name).toBe('EmailUnique');
      expect(rule.annotationClass).toBe('UniqueEmail');
      expect(rule.messageTemplate).toBe('Email address must be unique');
      expect(rule.imports).toContain('javax.validation.Constraint');
      expect(rule.validatorClass).toContain('@Constraint(validatedBy = UniqueEmailValidator.class)');
      expect(rule.validatorClass).toContain('userRepository.existsByEmail(email)');
    });
  });

  describe('STRONG_PASSWORD rule', () => {
    test('should have correct structure', () => {
      const rule = BuiltInValidationRules.STRONG_PASSWORD;
      
      expect(rule.name).toBe('StrongPassword');
      expect(rule.annotationClass).toBe('StrongPassword');
      expect(rule.messageTemplate).toContain('at least 8 characters');
      expect(rule.imports).toContain('javax.validation.Constraint');
      expect(rule.validatorClass).toContain('int minLength() default 8');
      expect(rule.validatorClass).toContain('requireUppercase');
      expect(rule.validatorClass).toContain('requireLowercase');
      expect(rule.validatorClass).toContain('requireDigit');
      expect(rule.validatorClass).toContain('requireSpecialChar');
    });
  });

  describe('PHONE_NUMBER rule', () => {
    test('should have correct structure', () => {
      const rule = BuiltInValidationRules.PHONE_NUMBER;
      
      expect(rule.name).toBe('PhoneNumber');
      expect(rule.annotationClass).toBe('PhoneNumber');
      expect(rule.messageTemplate).toBe('Invalid phone number format');
      expect(rule.imports).toContain('javax.validation.Constraint');
      expect(rule.validatorClass).toContain('String region() default "US"');
      expect(rule.validatorClass).toContain('phoneNumber.replaceAll');
    });
  });
});