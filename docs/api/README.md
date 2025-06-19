# API Reference Documentation

This document provides comprehensive API reference for all public interfaces, classes, and functions in the OpenAPI Code Generator TypeScript implementation.

## Table of Contents

- [Core API Classes](#core-api-classes)
- [Webhook and Event System](#webhook-and-event-system)
- [External Reference Resolution](#external-reference-resolution)
- [Validation System](#validation-system)
- [Internationalization](#internationalization)
- [Error Handling](#error-handling)
- [Configuration Interfaces](#configuration-interfaces)
- [Type Definitions](#type-definitions)
- [Usage Examples](#usage-examples)

---

## Core API Classes

### OpenAPICodeGenerator

**Primary class for generating Kotlin code from OpenAPI specifications**

```typescript
class OpenAPICodeGenerator {
  constructor(config: GeneratorConfig, webhookService?: WebhookService)
  generate(inputFile: string): Promise<GenerationResult>
}
```

#### Constructor Parameters
- `config: GeneratorConfig` - Configuration object for code generation
- `webhookService?: WebhookService` - Optional webhook service for generation events

#### Methods

##### `generate(inputFile: string): Promise<GenerationResult>`
Generates Kotlin code from an OpenAPI specification file.

**Parameters:**
- `inputFile: string` - Path to the OpenAPI specification file

**Returns:** `Promise<GenerationResult>` - Generation result with file paths and metadata

**Example:**
```typescript
import { OpenAPICodeGenerator } from './src';

const config = {
  outputDir: './generated',
  basePackage: 'com.example.api',
  generateModels: true,
  generateControllers: true,
  includeValidation: true,
  includeSwagger: true,
  verbose: false,
  i18n: await new I18nService().initialize()
};

const generator = new OpenAPICodeGenerator(config);
const result = await generator.generate('./api.yaml');
console.log(`Generated ${result.generatedFiles.length} files`);
```

---

### OpenAPIParser

**Parses and validates OpenAPI specifications with external reference support**

```typescript
class OpenAPIParser extends EventEmitter {
  constructor(externalResolverConfig?: ExternalResolverConfig, webhookService?: WebhookService)
  parseFile(filePath: string): Promise<OpenAPISpec>
  resolveReference(spec: OpenAPISpec, ref: OpenAPIReference, visitedRefs?: Set<string>): Promise<OpenAPISchema>
  resolveSchema(spec: OpenAPISpec, schema: OpenAPISchema | OpenAPIReference, visitedRefs?: Set<string>): Promise<OpenAPISchema>
  isReference(obj: any): obj is OpenAPIReference
  extractSchemaName(ref: string): string
  getAllSchemas(spec: OpenAPISpec): Promise<Record<string, OpenAPISchema>>
  getAllTags(spec: OpenAPISpec): string[]
  setWebhookService(webhookService: WebhookService): void
}
```

#### Constructor Parameters
- `externalResolverConfig?: ExternalResolverConfig` - Configuration for external reference resolution
- `webhookService?: WebhookService` - Optional webhook service for parsing events

#### Methods

##### `parseFile(filePath: string): Promise<OpenAPISpec>`
Parses an OpenAPI specification from a file.

**Parameters:**
- `filePath: string` - Path to the OpenAPI file (YAML or JSON)

**Returns:** `Promise<OpenAPISpec>` - Parsed OpenAPI specification

**Throws:** `OpenAPIParsingError` - When parsing fails

##### `resolveReference(spec: OpenAPISpec, ref: OpenAPIReference, visitedRefs?: Set<string>): Promise<OpenAPISchema>`
Resolves a schema reference within an OpenAPI specification.

**Parameters:**
- `spec: OpenAPISpec` - The OpenAPI specification
- `ref: OpenAPIReference` - Reference object to resolve
- `visitedRefs?: Set<string>` - Set of visited references for circular detection

**Returns:** `Promise<OpenAPISchema>` - Resolved schema

##### `resolveSchema(spec: OpenAPISpec, schema: OpenAPISchema | OpenAPIReference, visitedRefs?: Set<string>): Promise<OpenAPISchema>`
Resolves a schema, handling references and composition patterns (allOf, oneOf, anyOf).

**Parameters:**
- `spec: OpenAPISpec` - The OpenAPI specification
- `schema: OpenAPISchema | OpenAPIReference` - Schema to resolve
- `visitedRefs?: Set<string>` - Set of visited references for circular detection

**Returns:** `Promise<OpenAPISchema>` - Resolved schema with merged properties

**Example:**
```typescript
import { OpenAPIParser } from './src/parser';

const parser = new OpenAPIParser();

try {
  const spec = await parser.parseFile('./api.yaml');
  const schemas = await parser.getAllSchemas(spec);
  
  for (const [name, schema] of Object.entries(schemas)) {
    const resolved = await parser.resolveSchema(spec, schema);
    console.log(`Resolved schema: ${name}`);
  }
} catch (error) {
  console.error('Parsing failed:', error.message);
}
```

---

## Webhook and Event System

### WebhookService

**Handles webhook registration and event notifications for API changes**

```typescript
class WebhookService {
  constructor(config: WebhookConfig)
  start(): Promise<void>
  stop(): Promise<void>
  register(webhook: Omit<WebhookRegistration, 'id' | 'createdAt'>): Promise<WebhookRegistration>
  unregister(id: string): Promise<boolean>
  update(id: string, updates: Partial<WebhookRegistration>): Promise<WebhookRegistration | null>
  list(): Promise<WebhookRegistration[]>
  get(id: string): Promise<WebhookRegistration | null>
  triggerEvent(event: Omit<WebhookEvent, 'id' | 'timestamp' | 'signature'>): Promise<void>
  verifySignature(payload: string, signature: string, secret?: string): boolean
  getStats(): { totalWebhooks: number; activeWebhooks: number; eventTypes: string[] }
}
```

#### Constructor Parameters
- `config: WebhookConfig` - Webhook service configuration

#### Methods

##### `register(webhook: Omit<WebhookRegistration, 'id' | 'createdAt'>): Promise<WebhookRegistration>`
Registers a new webhook endpoint.

**Parameters:**
- `webhook` - Webhook registration details without id and createdAt

**Returns:** `Promise<WebhookRegistration>` - Complete webhook registration

**Example:**
```typescript
const webhookService = new WebhookService({
  port: 3001,
  secret: 'webhook-secret'
});

await webhookService.start();

const webhook = await webhookService.register({
  url: 'https://api.example.com/webhooks/openapi',
  events: ['api.spec.validated', 'api.generation.completed'],
  secret: 'my-secret'
});

console.log(`Webhook registered with ID: ${webhook.id}`);
```

##### `triggerEvent(event: Omit<WebhookEvent, 'id' | 'timestamp' | 'signature'>): Promise<void>`
Triggers an event to all registered webhooks.

**Parameters:**
- `event` - Event data without auto-generated fields

**Returns:** `Promise<void>`

---

### AsyncWebhookProcessor

**Asynchronous webhook delivery with retry logic and queue management**

```typescript
class AsyncWebhookProcessor {
  constructor(config: ProcessorConfig)
  start(): void
  stop(): Promise<void>
  enqueue(webhook: WebhookRegistration, event: WebhookEvent, maxAttempts?: number): boolean
  getStats(): { queueSize: number; processing: number; isRunning: boolean; config: ProcessorConfig }
  getQueueItems(): QueueItem[]
  clearQueue(): void
  removeFromQueue(itemId: string): boolean
  updateConfig(newConfig: Partial<ProcessorConfig>): void
  forceProcessQueue(): Promise<void>
  retryItem(itemId: string): boolean
}
```

#### Constructor Parameters
- `config: ProcessorConfig` - Processor configuration

#### Methods

##### `enqueue(webhook: WebhookRegistration, event: WebhookEvent, maxAttempts?: number): boolean`
Adds a webhook delivery to the processing queue.

**Parameters:**
- `webhook: WebhookRegistration` - Webhook to deliver to
- `event: WebhookEvent` - Event to deliver
- `maxAttempts?: number` - Maximum delivery attempts (defaults to config)

**Returns:** `boolean` - True if successfully enqueued

---

## External Reference Resolution

### ExternalReferenceResolver

**Resolves external OpenAPI references from URLs and files**

```typescript
class ExternalReferenceResolver {
  constructor(config: ExternalResolverConfig)
  resolveExternalReference(refPath: string, baseUrl?: string): Promise<OpenAPISpec>
  resolveExternalSchema(refPath: string, baseUrl?: string): Promise<OpenAPISchema>
  clearCache(): void
  getCacheStats(): { size: number; maxSize: number }
}
```

#### Constructor Parameters
- `config: ExternalResolverConfig` - Resolver configuration

#### Methods

##### `resolveExternalReference(refPath: string, baseUrl?: string): Promise<OpenAPISpec>`
Resolves an external OpenAPI specification reference.

**Parameters:**
- `refPath: string` - Path to external reference (URL or file path)
- `baseUrl?: string` - Base URL for relative references

**Returns:** `Promise<OpenAPISpec>` - Complete OpenAPI specification

**Example:**
```typescript
const resolver = new ExternalReferenceResolver({
  allowedDomains: ['api.example.com'],
  timeout: 5000,
  cacheEnabled: true
});

const externalSpec = await resolver.resolveExternalReference(
  'https://api.example.com/openapi.yaml'
);
```

---

## Validation System

### ValidationRuleService

**Manages custom validation rules for OpenAPI schemas**

```typescript
class ValidationRuleService {
  registerRule(rule: ValidationRule): void
  registerValidationRule(name: string, rule: Partial<ValidationRule>): void
  getRule(name: string): ValidationRule | undefined
  getAllRules(): ValidationRule[]
  hasRule(name: string): boolean
}
```

#### Methods

##### `registerRule(rule: ValidationRule): void`
Registers a custom validation rule.

**Parameters:**
- `rule: ValidationRule` - Complete validation rule definition

**Example:**
```typescript
const validationService = new ValidationRuleService();

validationService.registerRule({
  name: 'CustomEmail',
  annotationClass: 'CustomEmail',
  messageTemplate: 'Must be a valid corporate email',
  imports: ['javax.validation.Constraint'],
  validatorClass: `
    @Constraint(validatedBy = CustomEmailValidator.class)
    @Target({ElementType.FIELD})
    @Retention(RetentionPolicy.RUNTIME)
    public @interface CustomEmail {
        String message() default "Must be a valid corporate email";
        Class<?>[] groups() default {};
        Class<? extends Payload>[] payload() default {};
    }
  `
});
```

---

### ConditionalValidator

**Dynamic validation control based on field conditions with performance optimization**

```typescript
class ConditionalValidator {
  constructor(maxCacheSize?: number)
  addRule(rule: ConditionalValidationRule): void
  addDependency(dependency: FieldDependency): void
  evaluateCondition(condition: ConditionExpression | string, data: Record<string, any>): boolean
  getApplicableRules(data: Record<string, any>): ConditionalValidationRule[]
  isFieldRequired(fieldName: string, data: Record<string, any>): boolean
  isFieldForbidden(fieldName: string, data: Record<string, any>): boolean
  getPerformanceMetrics(): PerformanceMetrics
  clearCache(): void
  getCacheStats(): { parsedConditionsCount: number; evaluationResultsCount: number; hitRate: number; maxCacheSize: number }
}
```

#### Constructor Parameters
- `maxCacheSize?: number` - Maximum cache size for performance optimization (default: 1000)

#### Methods

##### `evaluateCondition(condition: ConditionExpression | string, data: Record<string, any>): boolean`
Evaluates a condition expression against provided data.

**Parameters:**
- `condition: ConditionExpression | string` - Condition to evaluate
- `data: Record<string, any>` - Data context for evaluation

**Returns:** `boolean` - Evaluation result

**Example:**
```typescript
const validator = new ConditionalValidator();

validator.addRule({
  field: 'phoneNumber',
  condition: 'userType === "premium"',
  validationType: 'required',
  message: 'Phone number is required for premium users'
});

const isRequired = validator.isFieldRequired('phoneNumber', {
  userType: 'premium',
  email: 'user@example.com'
});
```

---

## Internationalization

### I18nService

**Provides multi-language support for the application**

```typescript
class I18nService {
  initialize(): Promise<void>
  setLanguage(language: string): Promise<void>
  t(key: string, options?: any): string
  getCurrentLanguage(): string
  getSupportedLanguages(): string[]
}
```

#### Methods

##### `initialize(): Promise<void>`
Initializes the i18n service and loads default language.

**Returns:** `Promise<void>`

##### `t(key: string, options?: any): string`
Translates a text key to the current language.

**Parameters:**
- `key: string` - Translation key
- `options?: any` - Interpolation options

**Returns:** `string` - Translated text

**Example:**
```typescript
const i18n = new I18nService();
await i18n.initialize();

console.log(i18n.t('generator.success')); // "Code generation completed successfully"

await i18n.setLanguage('ja');
console.log(i18n.t('generator.success')); // "コード生成が正常に完了しました"
```

---

## Error Handling

### OpenAPIParsingError

**Specialized error for OpenAPI parsing issues**

```typescript
class OpenAPIParsingError extends Error {
  constructor(message: string, context: ErrorContext, originalError?: Error)
  getFormattedMessage(): string
  getErrorDetails(): object
}
```

#### Properties
- `context: ErrorContext` - Error context with schema path and metadata
- `originalError?: Error` - Original underlying error if available

#### Methods

##### `getFormattedMessage(): string`
Returns a formatted error message with full context information.

**Returns:** `string` - Formatted error message

**Example:**
```typescript
try {
  const spec = await parser.parseFile('./invalid-api.yaml');
} catch (error) {
  if (error instanceof OpenAPIParsingError) {
    console.error(error.getFormattedMessage());
    // Output: "Invalid reference: #/components/schemas/User at path: components.schemas.User (line 42, column 15) [REFERENCE_NOT_FOUND]
    //         Suggestion: Ensure the referenced component exists in the components section"
  }
}
```

---

## Configuration Interfaces

### GeneratorConfig

**Configuration for the OpenAPI code generator**

```typescript
interface GeneratorConfig {
  outputDir: string;
  basePackage: string;
  generateControllers: boolean;
  generateModels: boolean;
  includeValidation: boolean;
  includeSwagger: boolean;
  verbose: boolean;
  i18n: I18nService;
}
```

#### Properties
- `outputDir: string` - Directory for generated files
- `basePackage: string` - Base package name for generated classes
- `generateControllers: boolean` - Whether to generate controller interfaces
- `generateModels: boolean` - Whether to generate model classes
- `includeValidation: boolean` - Whether to include Bean Validation annotations
- `includeSwagger: boolean` - Whether to include Swagger/OpenAPI annotations
- `verbose: boolean` - Enable verbose logging
- `i18n: I18nService` - Internationalization service instance

---

### WebhookConfig

**Configuration for webhook service**

```typescript
interface WebhookConfig {
  port: number;
  secret?: string;
  enableAuth: boolean;
  authConfig?: AuthConfig;
  enableRateLimit: boolean;
  maxRequests: number;
  windowMs: number;
  enableAsyncProcessing: boolean;
  processorConfig?: ProcessorConfig;
}
```

#### Properties
- `port: number` - Port for webhook HTTP server
- `secret?: string` - Default secret for webhook signature verification
- `enableAuth: boolean` - Enable authentication for webhook endpoints
- `enableRateLimit: boolean` - Enable rate limiting
- `enableAsyncProcessing: boolean` - Enable asynchronous webhook processing

---

### ExternalResolverConfig

**Configuration for external reference resolution**

```typescript
interface ExternalResolverConfig {
  timeout: number;
  maxCacheSize: number;
  cacheEnabled: boolean;
  allowedDomains: string[];
  maxRedirects: number;
  userAgent: string;
}
```

#### Properties
- `timeout: number` - Request timeout in milliseconds
- `allowedDomains: string[]` - Domains allowed for external references
- `cacheEnabled: boolean` - Enable response caching
- `maxRedirects: number` - Maximum number of redirects to follow

---

## Type Definitions

### OpenAPISpec

**Complete OpenAPI specification structure**

```typescript
interface OpenAPISpec {
  openapi: string;
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
  components?: OpenAPIComponents;
  security?: OpenAPISecurityRequirement[];
  tags?: OpenAPITag[];
  externalDocs?: OpenAPIExternalDocumentation;
}
```

### GenerationResult

**Result of code generation**

```typescript
interface GenerationResult {
  generatedFiles: string[];
  generationTime: number;
  schemaCount: number;
  controllerCount: number;
  errors: string[];
  warnings: string[];
}
```

### ValidationRule

**Custom validation rule definition**

```typescript
interface ValidationRule {
  name: string;
  annotationClass: string;
  messageTemplate: string;
  imports: string[];
  validatorClass: string;
  parameters?: Record<string, any>;
}
```

### ConditionalValidationRule

**Conditional validation rule definition**

```typescript
interface ConditionalValidationRule {
  field: string;
  condition: string | ConditionExpression;
  validationType: 'required' | 'forbidden' | 'custom';
  message: string;
  priority: number;
  validatorClass?: string;
  parameters?: Record<string, any>;
}
```

### WebhookRegistration

**Webhook registration details**

```typescript
interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  createdAt: Date;
  lastTriggered?: Date;
}
```

### WebhookEvent

**Webhook event structure**

```typescript
interface WebhookEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  signature?: string;
}
```

---

## Usage Examples

### Basic Code Generation

```typescript
import { OpenAPICodeGenerator, I18nService } from './src';

async function generateCode() {
  const i18n = new I18nService();
  await i18n.initialize();

  const generator = new OpenAPICodeGenerator({
    outputDir: './generated',
    basePackage: 'com.example.userapi',
    generateModels: true,
    generateControllers: true,
    includeValidation: true,
    includeSwagger: true,
    verbose: true,
    i18n
  });

  const result = await generator.generate('./user-api.yaml');
  console.log(`Generated ${result.generatedFiles.length} files in ${result.generationTime}ms`);
}
```

### Advanced Parser with External References

```typescript
import { OpenAPIParser, ExternalReferenceResolver } from './src';

async function parseWithExternalRefs() {
  const resolver = new ExternalReferenceResolver({
    allowedDomains: ['schemas.company.com', 'api.example.com'],
    timeout: 10000,
    cacheEnabled: true,
    maxCacheSize: 100
  });

  const parser = new OpenAPIParser(resolver);
  
  try {
    const spec = await parser.parseFile('./api-with-external-refs.yaml');
    const schemas = await parser.getAllSchemas(spec);
    
    for (const [name, schema] of Object.entries(schemas)) {
      const resolved = await parser.resolveSchema(spec, schema);
      console.log(`Resolved schema: ${name} with ${Object.keys(resolved.properties || {}).length} properties`);
    }
  } catch (error) {
    console.error('Failed to parse specification:', error.getFormattedMessage());
  }
}
```

### Webhook Integration

```typescript
import { WebhookService, OpenAPICodeGenerator } from './src';

async function setupWebhookIntegration() {
  // Setup webhook service
  const webhookService = new WebhookService({
    port: 3001,
    secret: 'webhook-secret',
    enableAuth: true,
    enableAsyncProcessing: true
  });

  await webhookService.start();

  // Register webhook for generation events
  await webhookService.register({
    url: 'https://api.example.com/webhooks/openapi',
    events: ['api.spec.validated', 'api.generation.completed'],
    secret: 'client-secret'
  });

  // Use generator with webhook integration
  const generator = new OpenAPICodeGenerator(config, webhookService);
  
  // Webhooks will be triggered automatically during generation
  const result = await generator.generate('./api.yaml');
}
```

### Custom Validation Rules

```typescript
import { ValidationRuleService, OpenAPICodeGenerator } from './src';

async function setupCustomValidation() {
  const validationService = new ValidationRuleService();

  // Register custom email validation
  validationService.registerRule({
    name: 'CompanyEmail',
    annotationClass: 'CompanyEmail',
    messageTemplate: 'Must be a valid company email address',
    imports: [
      'javax.validation.Constraint',
      'javax.validation.ConstraintValidator',
      'javax.validation.ConstraintValidatorContext'
    ],
    validatorClass: `
      @Constraint(validatedBy = CompanyEmailValidator.class)
      @Target({ElementType.FIELD, ElementType.PARAMETER})
      @Retention(RetentionPolicy.RUNTIME)
      public @interface CompanyEmail {
          String message() default "Must be a valid company email address";
          Class<?>[] groups() default {};
          Class<? extends Payload>[] payload() default {};
          String domain() default "company.com";
      }
    `
  });

  // The custom validation will be available in generated code
  // when schemas use x-validation extensions
}
```

### Conditional Validation

```typescript
import { ConditionalValidator } from './src';

function setupConditionalValidation() {
  const validator = new ConditionalValidator();

  // Add conditional rules
  validator.addRule({
    field: 'phoneNumber',
    condition: 'userType === "premium" || region === "US"',
    validationType: 'required',
    message: 'Phone number is required for premium users or US region',
    priority: 1
  });

  validator.addRule({
    field: 'ssn',
    condition: 'age >= 18 && country === "US"',
    validationType: 'required',
    message: 'SSN is required for US adults',
    priority: 2
  });

  // Evaluate conditions dynamically
  const userData = {
    userType: 'premium',
    region: 'EU',
    age: 25,
    country: 'US'
  };

  const applicableRules = validator.getApplicableRules(userData);
  console.log(`${applicableRules.length} validation rules apply to this user`);
}
```

---

This API reference provides comprehensive documentation for all public interfaces in the OpenAPI Code Generator. For additional examples and advanced usage patterns, see the [examples directory](../examples/) and [troubleshooting guide](../troubleshooting/).