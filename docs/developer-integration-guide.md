# Developer Integration Guide - Conditional Validation System

## Architecture Overview

The conditional validation system is built around several key components that work together to provide comprehensive validation capabilities:

### Core Components

1. **ValidationRuleService** (`src/validation.ts`): Manages custom validation rules and their registration
2. **ConditionalValidator** (`src/conditional-validation.ts`): Handles conditional logic evaluation
3. **OpenAPICodeGenerator** (`src/generator.ts`): Integrates validation into code generation
4. **Generated Validation Classes**: Kotlin annotations and validators

## Integration Architecture

```
OpenAPI Spec (x-validation) 
    ↓
ValidationRuleService → ConditionalValidator
    ↓                       ↓
OpenAPICodeGenerator
    ↓
Generated Kotlin Classes + Validation Annotations
```

## Adding Custom Validation Rules

### Step 1: Define the Validation Rule

```typescript
import { ValidationRuleService, ValidationRule } from './validation';

const customRule: ValidationRule = {
  name: 'CustomBusinessRule',
  annotation: '@CustomBusinessRule',
  imports: ['com.validation.CustomBusinessRule'],
  validationLogic: `
    // Custom validation logic
    return BusinessRuleValidator.validate(value, constraintAnnotation.threshold);
  `,
  parameters: [
    { name: 'threshold', type: 'Int', defaultValue: '100' },
    { name: 'category', type: 'String', defaultValue: '"default"' }
  ],
  defaultMessage: 'Business rule validation failed'
};
```

### Step 2: Register the Rule

```typescript
const validationService = new ValidationRuleService();
validationService.registerValidationRule('CustomBusinessRule', customRule);
```

### Step 3: Use in OpenAPI Specification

```yaml
components:
  schemas:
    BusinessEntity:
      type: object
      properties:
        value:
          type: number
          x-validation:
            customValidations:
              - CustomBusinessRule:
                  threshold: 500
                  category: "premium"
```

## Extending Conditional Validation

### Adding New Operators

To add new conditional operators, extend the `ConditionParser` class:

```typescript
// In conditional-validation.ts
export class ConditionParser {
  
  // Add new operator to the parseComparison method
  private parseComparison(left: any, operator: string, right: any): boolean {
    switch (operator.toUpperCase()) {
      // ... existing operators
      case 'BETWEEN':
        return this.isBetween(left, right);
      case 'REGEX_MATCH':
        return this.regexMatch(left, right);
      default:
        throw new Error(`Unsupported operator: ${operator}`);
    }
  }
  
  private isBetween(value: any, range: any): boolean {
    if (!Array.isArray(range) || range.length !== 2) return false;
    const [min, max] = range;
    return value >= min && value <= max;
  }
  
  private regexMatch(value: any, pattern: any): boolean {
    if (typeof value !== 'string' || typeof pattern !== 'string') return false;
    return new RegExp(pattern).test(value);
  }
}
```

### Custom Conditional Rules

Create custom conditional validation rules:

```typescript
// In your application code
const customConditionalRule = {
  type: 'conditional_business_rule',
  condition: 'accountType == "premium" AND balance > 10000',
  validationLogic: 'return PremiumAccountValidator.validate(value);',
  message: 'Premium account validation failed'
};

// Register with the validation service
validationService.registerConditionalRule('conditional_business_rule', customConditionalRule);
```

## Code Generation Integration

### Extending the Generator

To add new validation generation capabilities:

```typescript
// In generator.ts
export class OpenAPICodeGenerator {
  
  private generateCustomValidationAnnotations(
    schema: OpenAPISchema, 
    customRules: any[]
  ): string[] {
    const annotations: string[] = [];
    
    for (const rule of customRules) {
      const annotation = this.validationRuleService.generateAnnotation(rule);
      if (annotation) {
        annotations.push(annotation);
      }
    }
    
    return annotations;
  }
  
  private addCustomValidationImports(
    customRules: any[], 
    imports: Set<string>
  ): void {
    for (const rule of customRules) {
      const ruleImports = this.validationRuleService.getImports(rule);
      ruleImports.forEach(imp => imports.add(imp));
    }
  }
}
```

### Template Customization

Customize the generated Kotlin templates:

```typescript
// Custom template for validation classes
const customValidationTemplate = `
package com.validation

import javax.validation.ConstraintValidator
import javax.validation.ConstraintValidatorContext
import org.springframework.beans.factory.annotation.Autowired
import com.service.ValidationService

class {{className}}Validator : ConstraintValidator<{{className}}, {{targetType}}> {
    
    @Autowired
    private lateinit var validationService: ValidationService
    
    {{#if parameters}}
    {{#each parameters}}
    private var {{name}}: {{type}} = {{defaultValue}}
    {{/each}}
    {{/if}}
    
    override fun initialize(constraintAnnotation: {{className}}) {
        {{#each parameters}}
        this.{{name}} = constraintAnnotation.{{name}}
        {{/each}}
    }
    
    override fun isValid(value: {{targetType}}?, context: ConstraintValidatorContext?): Boolean {
        if (value == null) return true
        
        {{validationLogic}}
    }
}
`;
```

## Testing Integration

### Unit Testing Validation Rules

```typescript
import { ValidationRuleService } from '../src/validation';
import { ConditionalValidator } from '../src/conditional-validation';

describe('Custom Validation Rules', () => {
  let validationService: ValidationRuleService;
  let conditionalValidator: ConditionalValidator;
  
  beforeEach(() => {
    validationService = new ValidationRuleService();
    conditionalValidator = new ConditionalValidator();
  });
  
  test('should register custom validation rule', () => {
    const customRule = {
      name: 'TestRule',
      annotation: '@TestRule',
      imports: ['com.validation.TestRule'],
      validationLogic: 'return true;'
    };
    
    validationService.registerValidationRule('TestRule', customRule);
    
    expect(validationService.hasValidationRule('TestRule')).toBe(true);
  });
  
  test('should evaluate conditional validation', () => {
    const result = conditionalValidator.evaluateCondition(
      'age >= 18 AND status == "active"',
      { age: 25, status: 'active' }
    );
    
    expect(result).toBe(true);
  });
});
```

### Integration Testing

```typescript
import { OpenAPICodeGenerator } from '../src/generator';

describe('Validation Code Generation', () => {
  let generator: OpenAPICodeGenerator;
  
  beforeEach(() => {
    const config = {
      outputDir: './test-output',
      basePackage: 'com.test',
      includeValidation: true
    };
    generator = new OpenAPICodeGenerator(config);
  });
  
  test('should generate validation annotations', async () => {
    const spec = {
      components: {
        schemas: {
          TestModel: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                format: 'email',
                'x-validation': {
                  customValidations: ['UniqueEmail']
                }
              }
            }
          }
        }
      }
    };
    
    const result = await generator.generate('test-spec.yaml');
    
    expect(result.generatedFiles).toContain('TestModel.kt');
    expect(result.generatedFiles).toContain('UniqueEmail.kt');
    expect(result.generatedFiles).toContain('UniqueEmailValidator.kt');
  });
});
```

## Performance Optimization

### Caching Strategies

Implement caching for validation rule evaluation:

```typescript
class CachedConditionalValidator extends ConditionalValidator {
  private conditionCache = new Map<string, boolean>();
  
  evaluateCondition(condition: string, context: Record<string, any>): boolean {
    const cacheKey = `${condition}:${JSON.stringify(context)}`;
    
    if (this.conditionCache.has(cacheKey)) {
      return this.conditionCache.get(cacheKey)!;
    }
    
    const result = super.evaluateCondition(condition, context);
    this.conditionCache.set(cacheKey, result);
    
    return result;
  }
}
```

### Lazy Loading

Implement lazy loading for validation rules:

```typescript
class LazyValidationRuleService extends ValidationRuleService {
  private ruleCache = new Map<string, ValidationRule>();
  
  getValidationRule(name: string): ValidationRule | undefined {
    if (this.ruleCache.has(name)) {
      return this.ruleCache.get(name);
    }
    
    const rule = this.loadValidationRule(name);
    if (rule) {
      this.ruleCache.set(name, rule);
    }
    
    return rule;
  }
  
  private loadValidationRule(name: string): ValidationRule | undefined {
    // Load rule from configuration or external source
    return undefined;
  }
}
```

## Configuration Management

### Environment-Specific Configuration

```typescript
// config/validation.config.ts
export interface ValidationConfig {
  enableCustomValidation: boolean;
  cacheValidationResults: boolean;
  maxCacheSize: number;
  validationTimeout: number;
  customRulesPath: string;
}

export const validationConfig: ValidationConfig = {
  enableCustomValidation: process.env.NODE_ENV !== 'test',
  cacheValidationResults: true,
  maxCacheSize: 1000,
  validationTimeout: 5000,
  customRulesPath: './config/custom-validation-rules.json'
};
```

### Dynamic Rule Loading

```typescript
// Load validation rules from external configuration
class ConfigurableValidationService extends ValidationRuleService {
  constructor(private config: ValidationConfig) {
    super();
    this.loadCustomRules();
  }
  
  private async loadCustomRules(): Promise<void> {
    if (!this.config.enableCustomValidation) return;
    
    try {
      const rulesData = await fs.readFile(this.config.customRulesPath, 'utf-8');
      const customRules = JSON.parse(rulesData);
      
      for (const [name, rule] of Object.entries(customRules)) {
        this.registerValidationRule(name, rule as ValidationRule);
      }
    } catch (error) {
      console.warn('Failed to load custom validation rules:', error);
    }
  }
}
```

## Migration Guide

### From Basic to Conditional Validation

1. **Update OpenAPI specifications**:
   ```yaml
   # Before
   properties:
     email:
       type: string
       format: email
   
   # After
   properties:
     email:
       type: string
       format: email
       x-validation:
         customValidations:
           - UniqueEmail
   ```

2. **Update generator configuration**:
   ```typescript
   // Before
   const config = {
     includeValidation: false
   };
   
   // After
   const config = {
     includeValidation: true,
     validationMode: 'conditional'
   };
   ```

3. **Update runtime dependencies**:
   ```kotlin
   // Add to build.gradle.kts
   dependencies {
     implementation("org.springframework.boot:spring-boot-starter-validation")
     implementation("org.jetbrains.kotlin:kotlin-reflect")
   }
   ```

## Troubleshooting

### Common Integration Issues

1. **Missing imports**: Ensure all validation imports are properly added to generated classes
2. **Runtime errors**: Check that validation classes are on the classpath
3. **Condition parsing**: Verify condition syntax matches supported operators
4. **Performance issues**: Consider caching and optimization strategies

### Debug Configuration

```typescript
const debugConfig = {
  validation: {
    logConditionEvaluation: true,
    logRuleRegistration: true,
    logCodeGeneration: true,
    dumpGeneratedValidation: true
  }
};
```

## Best Practices

1. **Rule Naming**: Use descriptive names for validation rules
2. **Error Messages**: Provide clear, actionable error messages
3. **Performance**: Cache validation results when possible
4. **Testing**: Write comprehensive tests for custom validation logic
5. **Documentation**: Document custom validation rules and their usage

## API Reference

### ValidationRuleService

```typescript
class ValidationRuleService {
  registerValidationRule(name: string, rule: ValidationRule): void
  hasValidationRule(name: string): boolean
  getValidationRule(name: string): ValidationRule | undefined
  getAllValidationRules(): Map<string, ValidationRule>
  generateAnnotation(rule: ValidationRule): string
  getImports(rule: ValidationRule): string[]
}
```

### ConditionalValidator

```typescript
class ConditionalValidator {
  evaluateCondition(condition: string, context: Record<string, any>): boolean
  addCustomFunction(name: string, fn: Function): void
  validateConditionalRules(rules: ConditionalRule[], context: Record<string, any>): ValidationResult[]
}
```

## Contributing

To contribute to the validation system:

1. Fork the repository
2. Create a feature branch for your validation enhancement
3. Add comprehensive tests for new validation functionality
4. Update documentation for any new validation features
5. Submit a pull request with detailed description

## Resources

- [Conditional Validation Guide](./conditional-validation-guide.md)
- [Best Practices](./validation-best-practices.md)
- [API Documentation](./api-reference.md)
- [Example Implementations](../samples/)