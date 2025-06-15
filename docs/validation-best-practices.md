# Validation Best Practices Guide

## Overview

This guide provides best practices for using the conditional validation system in OpenAPI specifications and generated code. Following these practices will help you create maintainable, performant, and robust validation rules.

## OpenAPI Specification Best Practices

### 1. Validation Structure Organization

#### Use Consistent Naming Conventions
```yaml
# Good: Clear, descriptive validation names
x-validation:
  customValidations:
    - EmailUnique
    - StrongPassword
    - PhoneNumber

# Bad: Unclear, abbreviated names
x-validation:
  customValidations:
    - EU
    - SP
    - PN
```

#### Group Related Validations
```yaml
# Good: Logical grouping
properties:
  userProfile:
    type: object
    x-validation:
      crossFieldValidations:
        - type: field_equality
          fields: ["password", "confirmPassword"]
        - type: field_dependency
          dependentField: "emergencyContact"
          dependsOn: "isActive"

# Bad: Scattered validation rules
properties:
  password:
    x-validation:
      crossFieldValidations:
        - type: field_equality
          fields: ["password", "confirmPassword"]
  emergencyContact:
    x-validation:
      crossFieldValidations:
        - type: field_dependency
          dependentField: "emergencyContact"
          dependsOn: "isActive"
```

### 2. Conditional Logic Design

#### Keep Conditions Simple and Readable
```yaml
# Good: Simple, clear conditions
conditionalValidations:
  - condition: "userType == 'admin'"
    validations: [NotNull]
    message: "Admin users must provide this field"

  - condition: "age >= 18"
    validations: [Valid]
    message: "Adult verification required"

# Bad: Complex, hard-to-read conditions
conditionalValidations:
  - condition: "(userType == 'admin' OR userType == 'superadmin') AND (status == 'ACTIVE' OR status == 'PENDING') AND (verified == true OR adminOverride == true)"
    validations: [NotNull]
    message: "Complex validation rule"
```

#### Use Explicit Operators
```yaml
# Good: Explicit and clear
condition: "accountType == 'business' AND revenue > 100000"

# Bad: Implicit or unclear
condition: "accountType = 'business' & revenue > 100000"
```

#### Break Down Complex Logic
```yaml
# Good: Multiple simple conditions
conditionalValidations:
  - condition: "userType in ['admin', 'superadmin']"
    validations: [SecurityClearance]
    message: "Security clearance required for admin users"
    
  - condition: "userType == 'superadmin'"
    validations: [IpWhitelist]
    message: "IP whitelist required for superadmin users"

# Bad: Single complex condition
conditionalValidations:
  - condition: "userType in ['admin', 'superadmin'] AND (userType == 'admin' OR ipWhitelist is not null)"
    validations: [SecurityClearance, IpWhitelist]
    message: "Complex admin validation"
```

### 3. Error Message Guidelines

#### Provide Actionable Error Messages
```yaml
# Good: Clear, actionable messages
message: "Phone number is required when SMS notifications are enabled"
message: "Business license number must be provided for business accounts"
message: "Password must contain at least one special character for admin users"

# Bad: Vague or technical messages
message: "Validation failed"
message: "Invalid input"
message: "Constraint violation"
```

#### Use Internationalization Keys
```yaml
# Good: I18n support
message: "validation.phone_required_for_sms"
message: "validation.business_license_required"

# Bad: Hardcoded messages
message: "Phone number is required when SMS notifications are enabled"
```

### 4. Performance Considerations

#### Prioritize Validation Rules
```yaml
# Good: Priority-based validation order
conditionalValidations:
  - condition: "required_field is null"
    validations: [NotNull]
    message: "This field is required"
    priority: 100  # High priority - check first
    
  - condition: "complex_business_rule == true"
    validations: [ComplexValidator]
    message: "Complex business rule validation"
    priority: 50   # Lower priority - check after basic validations
```

#### Avoid Expensive Operations in Conditions
```yaml
# Good: Simple field comparisons
condition: "userType == 'premium'"
condition: "age >= 18"
condition: "status in ['ACTIVE', 'VERIFIED']"

# Bad: Complex operations that should be in validation logic
condition: "email.matches('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}')"
condition: "calculateCreditScore() > 700"
```

## Code Generation Best Practices

### 1. Custom Validation Rules

#### Design Reusable Validators
```typescript
// Good: Reusable, configurable validator
const emailUniqueRule: ValidationRule = {
  name: 'UniqueEmail',
  annotation: '@UniqueEmail',
  imports: ['com.validation.UniqueEmail', 'com.service.UserService'],
  validationLogic: `
    return userService.isEmailUnique(value, constraintAnnotation.excludeUserId());
  `,
  parameters: [
    { name: 'excludeUserId', type: 'Long', defaultValue: '0L' },
    { name: 'caseSensitive', type: 'Boolean', defaultValue: 'false' }
  ],
  defaultMessage: 'Email address is already in use'
};

// Bad: Hardcoded, inflexible validator
const emailUniqueRule: ValidationRule = {
  name: 'UniqueEmail',
  annotation: '@UniqueEmail',
  imports: ['com.validation.UniqueEmail'],
  validationLogic: 'return UserRepository.findByEmail(value) == null;'
};
```

#### Implement Comprehensive Error Handling
```typescript
// Good: Comprehensive error handling
validationLogic: `
  try {
    if (value == null || value.trim().isEmpty()) {
      return true; // Let @NotNull handle null validation
    }
    
    return phoneNumberService.isValid(value, constraintAnnotation.region());
  } catch (ServiceException e) {
    context.buildConstraintViolationWithTemplate(
      "Phone validation service unavailable"
    ).addConstraintViolation();
    return false;
  }
`

// Bad: No error handling
validationLogic: `
  return phoneNumberService.isValid(value, constraintAnnotation.region());
`
```

### 2. Generator Configuration

#### Use Environment-Specific Settings
```typescript
// Good: Environment-aware configuration
const config: GeneratorConfig = {
  outputDir: './generated',
  basePackage: 'com.example.api',
  includeValidation: process.env.NODE_ENV !== 'test',
  validationConfig: {
    enableCaching: process.env.NODE_ENV === 'production',
    maxCacheSize: parseInt(process.env.VALIDATION_CACHE_SIZE || '1000'),
    validationTimeout: parseInt(process.env.VALIDATION_TIMEOUT || '5000')
  }
};

// Bad: Hardcoded configuration
const config: GeneratorConfig = {
  outputDir: './generated',
  basePackage: 'com.example.api',
  includeValidation: true,
  validationConfig: {
    enableCaching: true,
    maxCacheSize: 1000,
    validationTimeout: 5000
  }
};
```

#### Configure Appropriate Imports
```typescript
// Good: Comprehensive import management
private addValidationImports(schema: OpenAPISchema, imports: Set<string>): void {
  // Core validation imports
  imports.add('javax.validation.constraints.*');
  imports.add('javax.validation.Valid');
  
  // Custom validation imports
  if (this.hasCustomValidations(schema)) {
    imports.add('com.validation.*');
  }
  
  // Conditional validation imports
  if (this.hasConditionalValidations(schema)) {
    imports.add('com.validation.conditional.*');
  }
  
  // Service dependencies for complex validators
  if (this.hasServiceDependentValidations(schema)) {
    imports.add('org.springframework.beans.factory.annotation.Autowired');
  }
}
```

## Runtime Best Practices

### 1. Validation Service Configuration

#### Implement Proper Caching
```kotlin
// Good: Efficient caching strategy
@Service
@CacheConfig(cacheNames = ["validationCache"])
class ValidationService {
    
    @Cacheable(key = "#email", condition = "#email != null")
    fun isEmailUnique(email: String, excludeUserId: Long = 0L): Boolean {
        return userRepository.countByEmailAndIdNot(email, excludeUserId) == 0L
    }
    
    @CacheEvict(key = "#email")
    fun invalidateEmailCache(email: String) {
        // Cache invalidation on user update
    }
}

// Bad: No caching, repeated database queries
@Service
class ValidationService {
    fun isEmailUnique(email: String, excludeUserId: Long = 0L): Boolean {
        return userRepository.countByEmailAndIdNot(email, excludeUserId) == 0L
    }
}
```

#### Use Async Validation for Expensive Operations
```kotlin
// Good: Async validation for expensive operations
@Component
class AsyncValidationService {
    
    @Async
    fun validateCreditScore(ssn: String): CompletableFuture<Boolean> {
        return CompletableFuture.supplyAsync {
            // Expensive external API call
            creditBureauService.getCreditScore(ssn) >= 650
        }
    }
}

// Bad: Blocking validation
@Component
class ValidationService {
    fun validateCreditScore(ssn: String): Boolean {
        // Blocks the thread during external API call
        return creditBureauService.getCreditScore(ssn) >= 650
    }
}
```

### 2. Error Handling and Logging

#### Implement Structured Logging
```kotlin
// Good: Structured logging with context
@Component
class ValidationLogger {
    private val logger = LoggerFactory.getLogger(ValidationLogger::class.java)
    
    fun logValidationFailure(
        fieldName: String,
        value: Any?,
        condition: String,
        validationType: String
    ) {
        logger.warn(
            "Validation failed: field={}, condition={}, type={}, value={}",
            fieldName, condition, validationType, 
            if (value is String && value.length > 50) "[TRUNCATED]" else value
        )
    }
}

// Bad: Generic logging without context
logger.error("Validation failed")
```

#### Provide User-Friendly Error Responses
```kotlin
// Good: Structured error responses
@ExceptionHandler(MethodArgumentNotValidException::class)
fun handleValidationExceptions(ex: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
    val errors = ex.bindingResult.fieldErrors.map { fieldError ->
        ValidationError(
            field = fieldError.field,
            message = messageSource.getMessage(fieldError, LocaleContextHolder.getLocale()),
            rejectedValue = fieldError.rejectedValue,
            code = fieldError.code
        )
    }
    
    return ResponseEntity.badRequest().body(
        ErrorResponse(
            message = "Validation failed",
            errors = errors,
            timestamp = Instant.now()
        )
    )
}

// Bad: Generic error response
@ExceptionHandler(MethodArgumentNotValidException::class)
fun handleValidationExceptions(ex: MethodArgumentNotValidException): ResponseEntity<String> {
    return ResponseEntity.badRequest().body("Validation failed")
}
```

## Testing Best Practices

### 1. Unit Testing Validation Rules

#### Test All Condition Branches
```kotlin
// Good: Comprehensive test coverage
@Test
fun `should require phone number for verified users`() {
    // Test condition: verified = true
    val verifiedUser = CreateUserRequest(
        email = "test@example.com",
        verified = true,
        phoneNumber = null // Should fail validation
    )
    
    val violations = validator.validate(verifiedUser)
    assertThat(violations).hasSize(1)
    assertThat(violations.first().message).contains("Phone number is required")
}

@Test
fun `should not require phone number for unverified users`() {
    // Test condition: verified = false
    val unverifiedUser = CreateUserRequest(
        email = "test@example.com",
        verified = false,
        phoneNumber = null // Should pass validation
    )
    
    val violations = validator.validate(unverifiedUser)
    assertThat(violations).isEmpty()
}

// Bad: Incomplete test coverage
@Test
fun `should validate user`() {
    val user = CreateUserRequest(email = "test@example.com")
    val violations = validator.validate(user)
    assertThat(violations).isEmpty()
}
```

#### Test Edge Cases
```kotlin
// Good: Edge case testing
@Test
fun `should handle null values in conditions`() {
    val user = CreateUserRequest(
        email = "test@example.com",
        age = null, // Test null in condition
        serviceType = "financial" // Requires age verification
    )
    
    val violations = validator.validate(user)
    assertThat(violations).hasSize(1)
    assertThat(violations.first().propertyPath.toString()).isEqualTo("age")
}

@Test
fun `should handle empty strings in conditions`() {
    val user = CreateUserRequest(
        email = "test@example.com",
        userType = "", // Test empty string
        adminNotes = "admin notes" // Should be forbidden for non-admin
    )
    
    val violations = validator.validate(user)
    assertThat(violations).hasSize(1)
}
```

### 2. Integration Testing

#### Test Cross-Field Validation
```kotlin
// Good: Cross-field validation testing
@Test
fun `should validate field dependencies`() {
    val user = UpdateProfileRequest(
        status = "ACTIVE",
        emergencyContact = null // Should be required when status is ACTIVE
    )
    
    val violations = validator.validate(user)
    assertThat(violations).hasSize(1)
    assertThat(violations.first().message).contains("Emergency contact is required")
}

@Test
fun `should validate forbidden field combinations`() {
    val user = UpdateProfileRequest(
        userType = "user",
        adminNotes = "admin notes" // Should be forbidden for regular users
    )
    
    val violations = validator.validate(user)
    assertThat(violations).hasSize(1)
    assertThat(violations.first().message).contains("forbidden")
}
```

## Performance Optimization

### 1. Condition Evaluation Optimization

#### Cache Condition Results
```typescript
// Good: Condition result caching
class CachedConditionalValidator {
    private conditionCache = new Map<string, boolean>();
    
    evaluateCondition(condition: string, context: Record<string, any>): boolean {
        const cacheKey = this.createCacheKey(condition, context);
        
        if (this.conditionCache.has(cacheKey)) {
            return this.conditionCache.get(cacheKey)!;
        }
        
        const result = this.doEvaluateCondition(condition, context);
        this.conditionCache.set(cacheKey, result);
        
        return result;
    }
    
    private createCacheKey(condition: string, context: Record<string, any>): string {
        // Create deterministic cache key
        const contextHash = this.hashContext(context);
        return `${condition}:${contextHash}`;
    }
}
```

#### Optimize Condition Parsing
```typescript
// Good: Pre-compiled condition patterns
class OptimizedConditionParser {
    private static readonly SIMPLE_PATTERNS = new Map([
        [/^(\w+)\s*==\s*'([^']+)'$/, 'SIMPLE_EQUALITY'],
        [/^(\w+)\s*!=\s*'([^']+)'$/, 'SIMPLE_INEQUALITY'],
        [/^(\w+)\s*in\s*\[([^\]]+)\]$/, 'SIMPLE_IN']
    ]);
    
    parse(condition: string): ParsedCondition {
        // Try simple patterns first (faster)
        for (const [pattern, type] of OptimizedConditionParser.SIMPLE_PATTERNS) {
            const match = condition.match(pattern);
            if (match) {
                return this.createSimpleCondition(type, match);
            }
        }
        
        // Fall back to complex parsing
        return this.parseComplexCondition(condition);
    }
}
```

### 2. Validation Rule Optimization

#### Lazy Load Validation Rules
```typescript
// Good: Lazy loading of validation rules
class LazyValidationRuleService {
    private ruleCache = new Map<string, ValidationRule>();
    private rulePromises = new Map<string, Promise<ValidationRule>>();
    
    async getValidationRule(name: string): Promise<ValidationRule> {
        if (this.ruleCache.has(name)) {
            return this.ruleCache.get(name)!;
        }
        
        if (this.rulePromises.has(name)) {
            return this.rulePromises.get(name)!;
        }
        
        const promise = this.loadValidationRule(name);
        this.rulePromises.set(name, promise);
        
        const rule = await promise;
        this.ruleCache.set(name, rule);
        this.rulePromises.delete(name);
        
        return rule;
    }
}
```

## Security Considerations

### 1. Input Validation Security

#### Prevent Injection Attacks
```yaml
# Good: Safe condition syntax
condition: "userType == 'admin'"
condition: "age >= 18"
condition: "status in ['ACTIVE', 'VERIFIED']"

# Bad: Potentially unsafe dynamic evaluation
condition: "eval(userInput)"
condition: "System.getProperty('user.home')"
```

#### Sanitize Error Messages
```kotlin
// Good: Safe error message handling
fun createValidationError(field: String, userInput: String): String {
    val sanitizedInput = userInput.take(50).replace(Regex("[<>\"']"), "_")
    return "Validation failed for field '$field' with value '$sanitizedInput'"
}

// Bad: Unsanitized user input in error messages
fun createValidationError(field: String, userInput: String): String {
    return "Validation failed for field '$field' with value '$userInput'"
}
```

### 2. Access Control

#### Validate Permissions in Custom Validators
```kotlin
// Good: Permission-aware validation
@Component
class SecureValidator {
    
    @Autowired
    private lateinit var securityContext: SecurityContextService
    
    fun validateAdminOnlyField(value: String, fieldName: String): Boolean {
        val currentUser = securityContext.getCurrentUser()
        
        if (!currentUser.hasRole("ADMIN") && value != null) {
            throw ValidationException("Field '$fieldName' can only be set by admin users")
        }
        
        return true
    }
}
```

## Monitoring and Observability

### 1. Validation Metrics

#### Track Validation Performance
```kotlin
// Good: Performance monitoring
@Component
class ValidationMetrics {
    private val validationTimer = Timer.builder("validation.execution.time")
        .description("Time taken for validation execution")
        .register(Metrics.globalRegistry)
    
    private val validationCounter = Counter.builder("validation.executions")
        .description("Number of validation executions")
        .register(Metrics.globalRegistry)
    
    fun <T> recordValidation(validationType: String, operation: () -> T): T {
        return validationTimer.recordCallable {
            validationCounter.increment(Tags.of("type", validationType))
            operation()
        }!!
    }
}
```

#### Monitor Validation Failures
```kotlin
// Good: Failure rate monitoring
@EventListener
class ValidationFailureListener {
    private val failureCounter = Counter.builder("validation.failures")
        .description("Number of validation failures")
        .register(Metrics.globalRegistry)
    
    @EventListener
    fun handleValidationFailure(event: ValidationFailureEvent) {
        failureCounter.increment(
            Tags.of(
                "field", event.fieldName,
                "rule", event.ruleName,
                "severity", event.severity.name
            )
        )
    }
}
```

## Summary

Following these best practices will help you:

1. **Maintain readable and maintainable validation rules**
2. **Optimize performance for large-scale applications**
3. **Ensure security and prevent common vulnerabilities**
4. **Provide excellent user experience with clear error messages**
5. **Enable comprehensive testing and monitoring**

Remember to regularly review and update your validation rules as your application evolves, and always prioritize clarity and maintainability over complex optimizations unless performance is a critical concern.