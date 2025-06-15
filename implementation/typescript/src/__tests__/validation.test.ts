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
      
      expect(result.annotations).toContain('@DecimalMin("18")');
      expect(result.annotations).toContain('@DecimalMax("120")');
      expect(result.imports.has('javax.validation.constraints.DecimalMin')).toBe(true);
      expect(result.imports.has('javax.validation.constraints.DecimalMax')).toBe(true);
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