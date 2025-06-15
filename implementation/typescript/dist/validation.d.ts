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
}
/**
 * Built-in custom validation rules
 */
export declare class BuiltInValidationRules {
    /**
     * Email uniqueness validation
     */
    static readonly EMAIL_UNIQUE: ValidationRule;
    /**
     * Strong password validation
     */
    static readonly STRONG_PASSWORD: ValidationRule;
    /**
     * Phone number validation (international format)
     */
    static readonly PHONE_NUMBER: ValidationRule;
}
/**
 * Service for managing custom validation rules
 */
export declare class ValidationRuleService {
    private rules;
    constructor();
    /**
     * Register built-in validation rules
     */
    private registerBuiltInRules;
    /**
     * Register a custom validation rule
     */
    registerRule(rule: ValidationRule): void;
    /**
     * Get a validation rule by name
     */
    getRule(name: string): ValidationRule | undefined;
    /**
     * Get all registered rules
     */
    getAllRules(): ValidationRule[];
    /**
     * Check if a rule exists
     */
    hasRule(name: string): boolean;
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
export declare class ValidationUtils {
    /**
     * Extract validation rules from OpenAPI schema
     */
    static extractValidationRules(schema: OpenAPISchemaWithValidation): string[];
    /**
     * Generate validation annotation string
     */
    static generateValidationAnnotation(rule: ValidationRule, parameters?: Record<string, any>): string;
    /**
     * Generate all validation annotations for a schema
     */
    static generateAllValidationAnnotations(schema: OpenAPISchemaWithValidation, ruleService: ValidationRuleService): {
        annotations: string[];
        imports: Set<string>;
    };
}
