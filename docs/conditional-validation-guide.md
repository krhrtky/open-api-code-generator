# Conditional Validation System Guide

## Overview

The OpenAPI Code Generator now supports advanced conditional validation capabilities that go beyond standard Bean Validation annotations. This system allows you to define complex validation rules that depend on the values of other fields, implement custom validation logic, and create sophisticated business rule validations.

## Features

### 1. Custom Validation Annotations
- **@UniqueEmail**: Email uniqueness validation with database integration
- **@StrongPassword**: Complex password requirements with configurable parameters
- **@PhoneNumber**: International phone number validation with region support

### 2. Conditional Validation
- **@ConditionallyRequired**: Fields that are required based on conditions
- **@ConditionalPattern**: Pattern validation that applies conditionally
- **@ConditionalSize**: Size constraints that vary based on context

### 3. Cross-Field Validation
- **@FieldsEqual**: Ensures multiple fields have equal values
- **@FieldDependency**: Validates field dependencies and relationships

## Usage

### Basic Setup

To enable conditional validation in your OpenAPI specification, use the `x-validation` extension:

```yaml
components:
  schemas:
    UserRegistration:
      type: object
      required:
        - email
        - username
      properties:
        email:
          type: string
          format: email
          x-validation:
            customValidations:
              - EmailUnique
        password:
          type: string
          format: password
          x-validation:
            customValidations:
              - StrongPassword
        confirmPassword:
          type: string
          format: password
        phone:
          type: string
          format: phone
          x-validation:
            customValidations:
              - PhoneNumber
      x-validation:
        crossFieldValidations:
          - type: field_equality
            fields: ["password", "confirmPassword"]
            message: "Passwords must match"
```

### Conditional Validation Rules

Define conditional validation rules that depend on other field values:

```yaml
components:
  schemas:
    BusinessAccount:
      type: object
      properties:
        accountType:
          type: string
          enum: ["personal", "business"]
        businessName:
          type: string
          x-validation:
            conditionalRules:
              - type: conditional_required
                condition: "accountType == 'business'"
                message: "Business name is required for business accounts"
        taxId:
          type: string
          x-validation:
            conditionalRules:
              - type: conditional_pattern
                condition: "accountType == 'business'"
                pattern: "^[0-9]{9}$"
                message: "Tax ID must be 9 digits for business accounts"
```

### Complex Conditional Logic

Support for complex expressions with multiple operators:

```yaml
components:
  schemas:
    LoanApplication:
      type: object
      properties:
        age:
          type: integer
        income:
          type: number
        employmentStatus:
          type: string
          enum: ["employed", "self-employed", "unemployed"]
        creditScore:
          type: integer
        collateral:
          type: string
          x-validation:
            conditionalRules:
              - type: conditional_required
                condition: "age >= 18 AND income < 50000 AND creditScore < 650"
                message: "Collateral is required for applicants under certain criteria"
```

### Field Dependencies

Create dependencies between fields:

```yaml
components:
  schemas:
    ShippingAddress:
      type: object
      properties:
        useAlternateAddress:
          type: boolean
        alternateStreet:
          type: string
        alternateCity:
          type: string
        alternateState:
          type: string
        alternateZip:
          type: string
      x-validation:
        crossFieldValidations:
          - type: field_dependency
            dependentField: "alternateStreet"
            dependsOn: "useAlternateAddress"
          - type: field_dependency
            dependentField: "alternateCity"
            dependsOn: "useAlternateAddress"
          - type: field_dependency
            dependentField: "alternateState"
            dependsOn: "useAlternateAddress"
          - type: field_dependency
            dependentField: "alternateZip"
            dependsOn: "useAlternateAddress"
```

## Generated Kotlin Code

The generator creates corresponding Kotlin classes with proper validation annotations:

```kotlin
@FieldsEqual(fields = ["password", "confirmPassword"])
data class UserRegistration(
    @field:UniqueEmail
    @field:Email
    val email: String,
    
    @field:StrongPassword
    val password: String,
    
    val confirmPassword: String,
    
    @field:PhoneNumber
    val phone: String?
)

@FieldDependency(dependentField = "alternateStreet", dependsOn = "useAlternateAddress")
@FieldDependency(dependentField = "alternateCity", dependsOn = "useAlternateAddress")
data class ShippingAddress(
    val useAlternateAddress: Boolean = false,
    
    @field:ConditionallyRequired(condition = "useAlternateAddress == true")
    val alternateStreet: String?,
    
    @field:ConditionallyRequired(condition = "useAlternateAddress == true")
    val alternateCity: String?
)
```

## Configuration

### Generator Configuration

Enable validation generation in your generator configuration:

```typescript
const config: GeneratorConfig = {
  outputDir: './generated',
  basePackage: 'com.example.api',
  includeValidation: true,  // Enable validation generation
  generateModels: true,
  generateControllers: true,
  verbose: true
};
```

### ValidationRuleService Configuration

Customize validation rules programmatically:

```typescript
import { ValidationRuleService } from './validation';

const validationService = new ValidationRuleService();

// Register custom validation rule
validationService.registerValidationRule('CustomBusinessRule', {
  annotation: '@CustomBusinessRule',
  imports: ['com.validation.CustomBusinessRule'],
  validationLogic: 'return BusinessRuleValidator.validate(value);',
  parameters: [
    { name: 'threshold', type: 'Int', defaultValue: '100' }
  ]
});
```

## Supported Operators

The conditional validation system supports the following operators:

- **Comparison**: `==`, `!=`, `>`, `>=`, `<`, `<=`
- **Logical**: `AND`, `OR`, `NOT`
- **String**: `CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `MATCHES`
- **Collection**: `IN`, `NOT_IN`
- **Null checks**: `IS_NULL`, `IS_NOT_NULL`

## Error Messages

Custom error messages can be specified for each validation rule:

```yaml
x-validation:
  conditionalRules:
    - type: conditional_required
      condition: "age >= 18"
      message: "This field is required for adults"
    - type: conditional_pattern
      condition: "country == 'US'"
      pattern: "^[0-9]{5}$"
      message: "US zip codes must be 5 digits"
```

## Internationalization

Error messages support internationalization through the i18n system:

```yaml
x-validation:
  conditionalRules:
    - type: conditional_required
      condition: "age >= 18"
      message: "validation.adult_required"  # i18n key
```

## Performance Considerations

- Conditional validation is evaluated at runtime
- Complex conditions may impact validation performance
- Consider caching validation results for frequently validated objects
- Use simple conditions when possible for optimal performance

## Troubleshooting

### Common Issues

1. **Validation not applied**: Ensure `includeValidation: true` in generator config
2. **Import errors**: Check that validation classes are properly generated
3. **Condition syntax**: Verify condition syntax matches supported operators
4. **Cross-field validation**: Ensure annotations are applied at class level

### Debug Mode

Enable verbose logging to debug validation generation:

```typescript
const config: GeneratorConfig = {
  // ... other config
  verbose: true  // Enable detailed logging
};
```

## Examples

See the `samples/` directory for complete examples:

- `validation-example.yaml`: Basic validation examples
- `conditional-validation-example.yaml`: Advanced conditional validation scenarios

## Testing

Run the validation test suite:

```bash
npm test -- --testPathPattern=validation
```

## Limitations

- Cross-field validation requires class-level annotations
- Complex conditions may impact runtime performance
- Some advanced features may require additional runtime dependencies

## Next Steps

- See [Developer Integration Guide](./developer-integration-guide.md) for implementation details
- Review [Best Practices](./validation-best-practices.md) for optimal usage patterns
- Check [Performance Guide](./performance-optimization.md) for optimization tips