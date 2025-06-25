/**
 * Custom validation foundation for advanced OpenAPI schema validation
 * Implements Issue #4: Advanced validation annotation generation
 */

import { OpenAPISchema } from './types';

/**
 * Interface for custom validation rule definitions
 */
export interface ValidationRule {
  /** Validation rule name */
  name: string;
  /** Validation annotation class name */
  annotationClass: string;
  /** Parameters for the validation */
  parameters?: Record<string, any>;
  /** Error message template */
  messageTemplate: string;
  /** Required imports for this validation */
  imports: string[];
  /** Custom validator class definition if needed */
  validatorClass?: string;
  /** Custom validation logic for dynamic rules (for testing/performance scenarios) */
  validationLogic?: string;
  /** Default message for validation failures */
  defaultMessage?: string;
}

/**
 * Built-in custom validation rules
 */
export class BuiltInValidationRules {
  /**
   * Email uniqueness validation
   */
  static readonly EMAIL_UNIQUE: ValidationRule = {
    name: 'EmailUnique',
    annotationClass: 'UniqueEmail',
    messageTemplate: 'Email address must be unique',
    imports: [
      'javax.validation.Constraint',
      'javax.validation.Payload',
      'java.lang.annotation.ElementType',
      'java.lang.annotation.Retention',
      'java.lang.annotation.RetentionPolicy',
      'java.lang.annotation.Target'
    ],
    validatorClass: `
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = UniqueEmailValidator.class)
public @interface UniqueEmail {
    String message() default "Email address must be unique";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

@Component
public class UniqueEmailValidator implements ConstraintValidator<UniqueEmail, String> {
    @Autowired
    private UserRepository userRepository;
    
    @Override
    public boolean isValid(String email, ConstraintValidatorContext context) {
        if (email == null) return true;
        return !userRepository.existsByEmail(email);
    }
}`
  };

  /**
   * Strong password validation
   */
  static readonly STRONG_PASSWORD: ValidationRule = {
    name: 'StrongPassword',
    annotationClass: 'StrongPassword',
    messageTemplate: 'Password must contain at least 8 characters with uppercase, lowercase, digit and special character',
    imports: [
      'javax.validation.Constraint',
      'javax.validation.Payload',
      'java.lang.annotation.ElementType',
      'java.lang.annotation.Retention',
      'java.lang.annotation.RetentionPolicy',
      'java.lang.annotation.Target'
    ],
    validatorClass: `
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = StrongPasswordValidator.class)
public @interface StrongPassword {
    String message() default "Password must contain at least 8 characters with uppercase, lowercase, digit and special character";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
    
    int minLength() default 8;
    boolean requireUppercase() default true;
    boolean requireLowercase() default true;
    boolean requireDigit() default true;
    boolean requireSpecialChar() default true;
}

public class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    private int minLength;
    private boolean requireUppercase;
    private boolean requireLowercase;
    private boolean requireDigit;
    private boolean requireSpecialChar;
    
    @Override
    public void initialize(StrongPassword annotation) {
        this.minLength = annotation.minLength();
        this.requireUppercase = annotation.requireUppercase();
        this.requireLowercase = annotation.requireLowercase();
        this.requireDigit = annotation.requireDigit();
        this.requireSpecialChar = annotation.requireSpecialChar();
    }
    
    @Override
    public boolean isValid(String password, ConstraintValidatorContext context) {
        if (password == null) return false;
        
        if (password.length() < minLength) return false;
        if (requireUppercase && !password.matches(".*[A-Z].*")) return false;
        if (requireLowercase && !password.matches(".*[a-z].*")) return false;
        if (requireDigit && !password.matches(".*\\\\d.*")) return false;
        if (requireSpecialChar && !password.matches(".*[!@#$%^&*()_+\\\\-=\\\\[\\\\]{};':\"\\\\\\\\|,.<>\\\\/?].*")) return false;
        
        return true;
    }
}`
  };

  /**
   * Phone number validation (international format)
   */
  static readonly PHONE_NUMBER: ValidationRule = {
    name: 'PhoneNumber',
    annotationClass: 'PhoneNumber',
    messageTemplate: 'Invalid phone number format',
    imports: [
      'javax.validation.Constraint',
      'javax.validation.Payload',
      'java.lang.annotation.ElementType',
      'java.lang.annotation.Retention',
      'java.lang.annotation.RetentionPolicy',
      'java.lang.annotation.Target'
    ],
    validatorClass: `
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = PhoneNumberValidator.class)
public @interface PhoneNumber {
    String message() default "Invalid phone number format";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
    
    String region() default "US";
}

public class PhoneNumberValidator implements ConstraintValidator<PhoneNumber, String> {
    private String region;
    
    @Override
    public void initialize(PhoneNumber annotation) {
        this.region = annotation.region();
    }
    
    @Override
    public boolean isValid(String phoneNumber, ConstraintValidatorContext context) {
        if (phoneNumber == null) return true;
        
        // Basic phone number validation - in production, use libphonenumber
        String cleanNumber = phoneNumber.replaceAll("[^\\\\d+]", "");
        return cleanNumber.matches("^\\\\+?[1-9]\\\\d{6,14}$");
    }
}`
  };
}

/**
 * Service for managing custom validation rules
 */
export class ValidationRuleService {
  private rules: Map<string, ValidationRule> = new Map();

  constructor() {
    this.registerBuiltInRules();
  }

  /**
   * Register built-in validation rules
   */
  private registerBuiltInRules(): void {
    this.registerRule(BuiltInValidationRules.EMAIL_UNIQUE);
    this.registerRule(BuiltInValidationRules.STRONG_PASSWORD);
    this.registerRule(BuiltInValidationRules.PHONE_NUMBER);
  }

  /**
   * Register a custom validation rule
   */
  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.name, rule);
  }

  /**
   * Register a validation rule by name and definition
   */
  registerValidationRule(name: string, rule: Partial<ValidationRule>): void {
    const fullRule: ValidationRule = {
      name,
      annotationClass: rule.annotationClass || `@${name}`,
      parameters: rule.parameters || {},
      messageTemplate: rule.messageTemplate || `Validation failed for ${name}`,
      imports: rule.imports || [],
      validatorClass: rule.validatorClass
    };
    this.registerRule(fullRule);
  }

  /**
   * Get a validation rule by name
   */
  getRule(name: string): ValidationRule | undefined {
    return this.rules.get(name);
  }

  /**
   * Get a validation rule by name (alias for getRule)
   */
  getValidationRule(name: string): ValidationRule | undefined {
    return this.getRule(name);
  }

  /**
   * Get all registered rules
   */
  getAllRules(): ValidationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Check if a rule exists
   */
  hasRule(name: string): boolean {
    return this.rules.has(name);
  }
}

/**
 * OpenAPI schema extension for validation metadata
 */
export interface ValidationMetadata {
  /** Custom validation rules to apply */
  customValidations?: string[];
  /** Conditional validation rules */
  conditionalValidations?: ConditionalValidation[];
  /** Cross-field validation rules */
  crossFieldValidations?: CrossFieldValidation[];
}

/**
 * Conditional validation configuration
 */
export interface ConditionalValidation {
  /** Condition expression (e.g., "status == 'ACTIVE'") */
  condition: string;
  /** Validation rules to apply when condition is true */
  validations: string[];
  /** Error message for failed condition */
  message?: string;
}

/**
 * Cross-field validation configuration
 */
export interface CrossFieldValidation {
  /** Fields involved in the validation */
  fields: string[];
  /** Validation rule name */
  rule: string;
  /** Parameters for the validation */
  parameters?: Record<string, any>;
  /** Error message template */
  message?: string;
}

/**
 * Enhanced OpenAPI schema with validation metadata
 */
export interface OpenAPISchemaWithValidation extends OpenAPISchema {
  'x-validation'?: ValidationMetadata;
}

/**
 * Utility functions for validation rule processing
 */
export class ValidationUtils {
  /**
   * Extract validation rules from OpenAPI schema
   */
  static extractValidationRules(schema: OpenAPISchemaWithValidation): string[] {
    const rules = new Set<string>();
    
    // Built-in format validations
    if (schema.format) {
      switch (schema.format) {
        case 'email':
          rules.add('Email');
          break;
        case 'password':
          rules.add('StrongPassword');
          break;
        case 'phone':
          rules.add('PhoneNumber');
          break;
      }
    }
    
    // Pattern validation
    if (schema.pattern) {
      rules.add('Pattern');
    }
    
    // String length validations  
    if (schema.minLength !== undefined || schema.maxLength !== undefined) {
      rules.add('Size');
    }
    
    // Numeric validations
    if (schema.minimum !== undefined) {
      rules.add('DecimalMin'); // Will generate @Min(value)
    }
    if (schema.maximum !== undefined) {
      rules.add('DecimalMax'); // Will generate @Max(value)
    }
    
    // Array item validations
    if (schema.minItems !== undefined) {
      rules.add('Size');
    }
    if (schema.maxItems !== undefined) {
      rules.add('Size');
    }
    
    // Required validation
    if (schema.required && schema.required.length > 0) {
      rules.add('NotNull');
    }
    
    // Custom validations from extension
    if (schema['x-validation']?.customValidations) {
      schema['x-validation'].customValidations.forEach(rule => rules.add(rule));
    }
    
    return Array.from(rules);
  }

  /**
   * Generate validation annotation string
   */
  static generateValidationAnnotation(rule: ValidationRule, parameters?: Record<string, any>): string {
    let annotation = `@${rule.annotationClass}`;
    
    if (parameters && Object.keys(parameters).length > 0) {
      const params = Object.entries(parameters)
        .map(([key, value]) => `${key} = ${JSON.stringify(value === undefined ? null : value)}`)
        .join(', ');
      annotation += `(${params})`;
    }
    
    return annotation;
  }

  /**
   * Generate all validation annotations for a schema
   */
  static generateAllValidationAnnotations(
    schema: OpenAPISchemaWithValidation, 
    ruleService: ValidationRuleService
  ): { annotations: string[], imports: Set<string> } {
    const annotations: string[] = [];
    const imports = new Set<string>();
    
    const rules = this.extractValidationRules(schema);
    
    for (const ruleName of rules) {
      const rule = ruleService.getRule(ruleName);
      if (rule) {
        // Add custom validation annotation
        annotations.push(this.generateValidationAnnotation(rule, rule.parameters));
        rule.imports.forEach(imp => imports.add(imp));
      } else {
        // Handle built-in Bean Validation annotations
        switch (ruleName) {
          case 'Email':
            annotations.push('@Email');
            imports.add('javax.validation.constraints.Email');
            break;
          case 'NotNull':
            annotations.push('@NotNull');
            imports.add('javax.validation.constraints.NotNull');
            break;
          case 'Size':
            const sizeParams: string[] = [];
            if (schema.minLength !== undefined) sizeParams.push(`min = ${schema.minLength}`);
            if (schema.maxLength !== undefined) sizeParams.push(`max = ${schema.maxLength}`);
            annotations.push(`@Size(${sizeParams.join(', ')})`);
            imports.add('javax.validation.constraints.Size');
            break;
          case 'Pattern':
            if (schema.pattern) {
              annotations.push(`@Pattern(regexp = "${schema.pattern}")`);
              imports.add('javax.validation.constraints.Pattern');
            }
            break;
          case 'DecimalMin':
            if (schema.minimum !== undefined) {
              annotations.push(`@Min(${schema.minimum})`);
              imports.add('javax.validation.constraints.Min');
            }
            break;
          case 'DecimalMax':
            if (schema.maximum !== undefined) {
              annotations.push(`@Max(${schema.maximum})`);
              imports.add('javax.validation.constraints.Max');
            }
            break;
        }
      }
    }
    
    return { annotations, imports };
  }
}