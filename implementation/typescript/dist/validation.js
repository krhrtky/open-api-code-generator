"use strict";
/**
 * Custom validation foundation for advanced OpenAPI schema validation
 * Implements Issue #4: Advanced validation annotation generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationUtils = exports.ValidationRuleService = exports.BuiltInValidationRules = void 0;
/**
 * Built-in custom validation rules
 */
class BuiltInValidationRules {
}
exports.BuiltInValidationRules = BuiltInValidationRules;
/**
 * Email uniqueness validation
 */
BuiltInValidationRules.EMAIL_UNIQUE = {
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
BuiltInValidationRules.STRONG_PASSWORD = {
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
BuiltInValidationRules.PHONE_NUMBER = {
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
/**
 * Service for managing custom validation rules
 */
class ValidationRuleService {
    constructor() {
        this.rules = new Map();
        this.registerBuiltInRules();
    }
    /**
     * Register built-in validation rules
     */
    registerBuiltInRules() {
        this.registerRule(BuiltInValidationRules.EMAIL_UNIQUE);
        this.registerRule(BuiltInValidationRules.STRONG_PASSWORD);
        this.registerRule(BuiltInValidationRules.PHONE_NUMBER);
    }
    /**
     * Register a custom validation rule
     */
    registerRule(rule) {
        this.rules.set(rule.name, rule);
    }
    /**
     * Get a validation rule by name
     */
    getRule(name) {
        return this.rules.get(name);
    }
    /**
     * Get all registered rules
     */
    getAllRules() {
        return Array.from(this.rules.values());
    }
    /**
     * Check if a rule exists
     */
    hasRule(name) {
        return this.rules.has(name);
    }
}
exports.ValidationRuleService = ValidationRuleService;
/**
 * Utility functions for validation rule processing
 */
class ValidationUtils {
    /**
     * Extract validation rules from OpenAPI schema
     */
    static extractValidationRules(schema) {
        const rules = [];
        // Built-in format validations
        if (schema.format) {
            switch (schema.format) {
                case 'email':
                    rules.push('Email');
                    break;
                case 'password':
                    rules.push('StrongPassword');
                    break;
                case 'phone':
                    rules.push('PhoneNumber');
                    break;
            }
        }
        // Pattern validation
        if (schema.pattern) {
            rules.push('Pattern');
        }
        // String length validations
        if (schema.minLength !== undefined) {
            rules.push('Size');
        }
        if (schema.maxLength !== undefined) {
            rules.push('Size');
        }
        // Numeric validations
        if (schema.minimum !== undefined) {
            rules.push('DecimalMin');
        }
        if (schema.maximum !== undefined) {
            rules.push('DecimalMax');
        }
        // Required validation
        if (schema.required && schema.required.length > 0) {
            rules.push('NotNull');
        }
        // Custom validations from extension
        if (schema['x-validation']?.customValidations) {
            rules.push(...schema['x-validation'].customValidations);
        }
        return rules;
    }
    /**
     * Generate validation annotation string
     */
    static generateValidationAnnotation(rule, parameters) {
        let annotation = `@${rule.annotationClass}`;
        if (parameters && Object.keys(parameters).length > 0) {
            const params = Object.entries(parameters)
                .map(([key, value]) => `${key} = ${JSON.stringify(value)}`)
                .join(', ');
            annotation += `(${params})`;
        }
        return annotation;
    }
    /**
     * Generate all validation annotations for a schema
     */
    static generateAllValidationAnnotations(schema, ruleService) {
        const annotations = [];
        const imports = new Set();
        const rules = this.extractValidationRules(schema);
        for (const ruleName of rules) {
            const rule = ruleService.getRule(ruleName);
            if (rule) {
                // Add custom validation annotation
                annotations.push(this.generateValidationAnnotation(rule, rule.parameters));
                rule.imports.forEach(imp => imports.add(imp));
            }
            else {
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
                        const sizeParams = [];
                        if (schema.minLength !== undefined)
                            sizeParams.push(`min = ${schema.minLength}`);
                        if (schema.maxLength !== undefined)
                            sizeParams.push(`max = ${schema.maxLength}`);
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
                            annotations.push(`@DecimalMin("${schema.minimum}")`);
                            imports.add('javax.validation.constraints.DecimalMin');
                        }
                        break;
                    case 'DecimalMax':
                        if (schema.maximum !== undefined) {
                            annotations.push(`@DecimalMax("${schema.maximum}")`);
                            imports.add('javax.validation.constraints.DecimalMax');
                        }
                        break;
                }
            }
        }
        return { annotations, imports };
    }
}
exports.ValidationUtils = ValidationUtils;
//# sourceMappingURL=validation.js.map