# OpenAPI Code Generator

[![codecov](https://codecov.io/gh/krhrtky/open-api-code-generator/branch/main/graph/badge.svg)](https://codecov.io/gh/krhrtky/open-api-code-generator)

A multi-language OpenAPI code generator that creates Spring Boot Kotlin controllers and models from OpenAPI 3.x specifications. **Optimized for performance and large file support** with implementations in multiple programming languages.

## 🚀 Features

- ✅ **OpenAPI 3.0.x & 3.1.x Support** - Full specification compliance
- ✅ **Multi-format Input** - YAML and JSON support  
- ✅ **Spring Boot Integration** - Generate production-ready Kotlin code
- ✅ **Advanced Schema Support** - oneOf, allOf, anyOf, inheritance patterns
- ✅ **Bean Validation** - Automatic validation annotations
- ✅ **Swagger Documentation** - Built-in OpenAPI annotations
- ✅ **High Performance** - Optimized for large specifications
- ✅ **Error Handling** - Comprehensive error detection and reporting
- ✅ **I18n Support** - Internationalization capabilities

## 📋 Quick Start

### Prerequisites

Choose your preferred implementation:

**TypeScript Implementation** (Recommended for development):
- Node.js 16+
- npm or yarn

**Rust Implementation** (Recommended for CI/CD):
- Rust 1.70+
- Cargo

### Installation & Basic Usage

#### TypeScript Implementation

```bash
# Clone and setup
git clone <repository-url>
cd open-api-code-generator/implementation/typescript
npm install

# Build the project
npm run build

# Generate code from OpenAPI spec
node dist/index.js \
  --input ../../examples/sample-api.yaml \
  --output ./generated \
  --package com.example.api \
  --verbose
```

#### Rust Implementation

```bash
# Navigate to Rust implementation
cd implementation/rust

# Build release version
cargo build --release

# Generate code
./target/release/openapi-codegen \
  --input ../../examples/sample-api.yaml \
  --output ./generated \
  --package com.example.api \
  --verbose
```

## 📚 Comprehensive Usage Guide

### 1. Command Line Interface

#### Available Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--input, -i` | Path to OpenAPI specification file | **Required** | `./api.yaml` |
| `--output, -o` | Output directory for generated code | `./generated` | `./src/main/kotlin` |
| `--package, -p` | Base package name for generated classes | `com.example` | `com.mycompany.api` |
| `--verbose, -v` | Enable verbose logging | `false` | - |
| `--include-validation` | Include Bean Validation annotations | `true` | - |
| `--include-swagger` | Include Swagger/OpenAPI annotations | `true` | - |
| `--generate-models` | Generate model classes | `true` | - |
| `--generate-controllers` | Generate controller interfaces | `true` | - |

#### Example Commands

**Basic Generation:**
```bash
# Minimal command
openapi-codegen -i api.yaml -o ./generated

# With custom package
openapi-codegen -i api.yaml -o ./src/main/kotlin -p com.mycompany.userapi

# Full configuration
openapi-codegen \
  --input ./specs/user-api.yaml \
  --output ./src/main/kotlin \
  --package com.mycompany.userapi \
  --include-validation \
  --include-swagger \
  --verbose
```

### 2. Programmatic Usage (TypeScript)

#### Basic API Usage

```typescript
import { OpenAPIParser, OpenAPICodeGenerator } from './src';
import { I18nService } from './src/i18n';

// Initialize services
const parser = new OpenAPIParser();
const i18n = new I18nService();
await i18n.initialize();

// Configure generator
const config = {
  outputDir: './generated',
  basePackage: 'com.example.api',
  generateModels: true,
  generateControllers: true,
  includeValidation: true,
  includeSwagger: true,
  verbose: false,
  i18n
};

const generator = new OpenAPICodeGenerator(config);

// Parse and generate
try {
  const spec = await parser.parseFile('./api.yaml');
  const result = await generator.generate('./api.yaml');
  
  console.log(`Generated ${result.generatedFiles.length} files`);
  result.generatedFiles.forEach(file => console.log(`- ${file}`));
} catch (error) {
  console.error('Generation failed:', error.message);
}
```

#### Advanced Parser Configuration

```typescript
import { OpenAPIParser } from './src/parser';
import { ExternalReferenceResolver } from './src/external-resolver';
import { WebhookService } from './src/webhook';

// Configure external reference resolver
const resolverConfig = {
  allowedDomains: ['api.example.com', 'schemas.mycompany.com'],
  timeout: 5000,
  maxRedirects: 3
};

// Setup webhook notifications
const webhookService = new WebhookService({
  port: 3001,
  enabled: true
});

// Initialize parser with advanced configuration
const parser = new OpenAPIParser(resolverConfig, webhookService);

// Register webhook for spec validation events
await webhookService.register({
  url: 'http://localhost:3000/webhooks/spec-validated',
  events: ['api.spec.validated'],
  secret: 'my-webhook-secret'
});

// Parse with event notifications
const spec = await parser.parseFile('./api.yaml');
```

### 3. Schema Composition Examples

#### allOf (Inheritance)

**Input OpenAPI Schema:**
```yaml
components:
  schemas:
    BaseEntity:
      type: object
      required: [id, createdAt]
      properties:
        id:
          type: integer
          format: int64
        createdAt:
          type: string
          format: date-time
    
    Person:
      type: object
      required: [firstName, lastName]
      properties:
        firstName:
          type: string
        lastName:
          type: string
    
    Employee:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - $ref: '#/components/schemas/Person'
        - type: object
          required: [employeeId]
          properties:
            employeeId:
              type: string
            department:
              type: string
```

**Generated Kotlin Code:**
```kotlin
@Schema(description = "Employee entity")
data class Employee(
    @NotNull val id: Long,
    @NotNull val createdAt: java.time.OffsetDateTime,
    @Size(min = 1, max = 50) @NotNull val firstName: String,
    @Size(min = 1, max = 50) @NotNull val lastName: String,
    @NotNull val employeeId: String,
    val department: String?
)
```

#### oneOf (Polymorphism)

**Input OpenAPI Schema:**
```yaml
components:
  schemas:
    Notification:
      oneOf:
        - $ref: '#/components/schemas/EmailNotification'
        - $ref: '#/components/schemas/SMSNotification'
      discriminator:
        propertyName: type
        mapping:
          email: '#/components/schemas/EmailNotification'
          sms: '#/components/schemas/SMSNotification'
    
    EmailNotification:
      type: object
      required: [type, email, subject]
      properties:
        type:
          type: string
          enum: [email]
        email:
          type: string
          format: email
        subject:
          type: string
    
    SMSNotification:
      type: object
      required: [type, phone, message]
      properties:
        type:
          type: string
          enum: [sms]
        phone:
          type: string
        message:
          type: string
```

**Generated Kotlin Code:**
```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = EmailNotification::class, name = "email"),
    JsonSubTypes.Type(value = SMSNotification::class, name = "sms")
)
sealed class Notification(
    @NotNull val type: String
)

data class EmailNotification(
    @Email @NotNull val email: String,
    @NotNull val subject: String
) : Notification("email")

data class SMSNotification(
    @NotNull val phone: String,
    @NotNull val message: String
) : Notification("sms")
```

#### anyOf (Flexible Unions)

**Input OpenAPI Schema:**
```yaml
components:
  schemas:
    SearchFilter:
      anyOf:
        - $ref: '#/components/schemas/TextFilter'
        - $ref: '#/components/schemas/DateFilter'
        - $ref: '#/components/schemas/NumericFilter'
    
    TextFilter:
      type: object
      properties:
        query:
          type: string
        caseSensitive:
          type: boolean
    
    DateFilter:
      type: object
      properties:
        startDate:
          type: string
          format: date
        endDate:
          type: string
          format: date
    
    NumericFilter:
      type: object
      properties:
        min:
          type: number
        max:
          type: number
```

**Generated Kotlin Code:**
```kotlin
@Schema(description = "Flexible search filter supporting multiple types")
data class SearchFilter(
    @JsonValue val value: Any,
    val supportedTypes: Set<String> = setOf("TextFilter", "DateFilter", "NumericFilter")
) {
    companion object {
        @JsonCreator
        @JvmStatic
        fun create(value: Any): SearchFilter = SearchFilter(value)
    }
}
```

### 4. Controller Generation Examples

**Input OpenAPI Paths:**
```yaml
paths:
  /users:
    get:
      summary: Get all users
      operationId: getUsers
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: size
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: Users retrieved successfully
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    
    post:
      summary: Create new user
      operationId: createUser
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
```

**Generated Kotlin Controller:**
```kotlin
@RestController
@RequestMapping("/api/v1")
@Validated
interface UserController {
    
    @GetMapping("/users")
    @Operation(summary = "Get all users")
    @ApiResponses(
        ApiResponse(responseCode = "200", description = "Users retrieved successfully")
    )
    fun getUsers(
        @RequestParam(required = false, defaultValue = "0") 
        @Min(0) page: Int?,
        @RequestParam(required = false, defaultValue = "20") 
        @Min(1) @Max(100) size: Int?
    ): ResponseEntity<List<User>>
    
    @PostMapping("/users")
    @Operation(summary = "Create new user")
    @ApiResponses(
        ApiResponse(responseCode = "201", description = "User created successfully")
    )
    fun createUser(
        @Valid @RequestBody user: CreateUserRequest
    ): ResponseEntity<User>
}
```

### 5. Validation Examples

**Enhanced Validation Support:**

```yaml
components:
  schemas:
    User:
      type: object
      required: [email, firstName, lastName]
      properties:
        email:
          type: string
          format: email
          x-validation:
            customValidations: [EmailUnique]
        firstName:
          type: string
          minLength: 1
          maxLength: 50
        lastName:
          type: string
          minLength: 1
          maxLength: 50
        age:
          type: integer
          minimum: 0
          maximum: 120
        password:
          type: string
          format: password
          minLength: 8
          x-validation:
            customValidations: [StrongPassword]
```

**Generated Kotlin with Advanced Validation:**
```kotlin
@Schema(description = "User entity")
data class User(
    @Email @UniqueEmail @NotNull val email: String,
    @Size(min = 1, max = 50) @NotNull val firstName: String,
    @Size(min = 1, max = 50) @NotNull val lastName: String,
    @DecimalMin("0") @DecimalMax("120") val age: Int?,
    @StrongPassword @Size(min = 8) val password: String?
)
```

### 6. Error Handling

The generator provides comprehensive error handling with detailed messages:

```typescript
import { OpenAPIParsingError, ErrorCode } from './src/errors';

try {
  const spec = await parser.parseFile('./invalid-api.yaml');
} catch (error) {
  if (error instanceof OpenAPIParsingError) {
    console.error('Parsing failed:');
    console.error(`- Error: ${error.message}`);
    console.error(`- Code: ${error.context.errorCode}`);
    console.error(`- Path: ${error.context.schemaPath.join('.')}`);
    
    if (error.context.suggestion) {
      console.error(`- Suggestion: ${error.context.suggestion}`);
    }
    
    // Formatted error message with context
    console.error('\nDetailed Error:');
    console.error(error.getFormattedMessage());
  }
}
```

## 🏗️ Project Structure

```
open-api-code-generator/
├── README.md                    # This comprehensive guide
├── implementation/
│   ├── rust/                    # Rust implementation (ultra-fast)
│   └── typescript/              # TypeScript implementation (feature-rich)
├── examples/                    # OpenAPI specification examples
│   ├── sample-api.yaml         # Basic example
│   ├── allof-inheritance-example.yaml
│   ├── oneof-polymorphism-example.yaml
│   ├── anyof-flexible-unions-example.yaml
│   └── schema-composition-test-api.yaml
├── docs/                       # Documentation
│   ├── api/                    # API reference documentation
│   ├── architecture/           # System design documentation
│   ├── troubleshooting/        # Problem resolution guides
│   └── examples/               # Code examples and patterns
└── generated_rust/             # Example generated output
```

## 🎯 Implementation Comparison

| Feature | TypeScript | Rust |
|---------|------------|------|
| **Performance** | ⚡⚡⚡ (~1.0s) | ⚡⚡⚡⚡⚡ (~0.05s) |
| **Memory Usage** | 🧠⚡⚡ (~45MB) | 🧠⚡⚡⚡⚡ (~8MB) |
| **Binary Size** | Node.js dependency | 🥇 ~2MB single binary |
| **Startup Time** | ⚡⚡⚡ | ⚡⚡⚡⚡⚡ |
| **Development** | 🛠️⚡⚡⚡⚡ Rich ecosystem | 🛠️⚡⚡ System-level |
| **CI/CD Integration** | ✅ Good | ✅ Excellent |
| **Cross-platform** | ✅ Via Node.js | ✅ Native binaries |

### When to Choose Each Implementation

**Choose TypeScript for:**
- Development and prototyping
- Rich npm ecosystem integration
- Team familiar with JavaScript/TypeScript
- Rapid feature development

**Choose Rust for:**
- Production CI/CD pipelines
- Large-scale file processing
- Memory-constrained environments
- Maximum performance requirements

## 🧪 Testing

### Running Tests

**TypeScript Implementation:**
```bash
cd implementation/typescript
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Generate coverage report
```

**Rust Implementation:**
```bash
cd implementation/rust
cargo test                 # Run all tests
cargo test --release       # Run optimized tests
```

### Test Coverage

The project maintains comprehensive test coverage with automated Codecov integration:

#### Setting up Codecov (for repository maintainers)

To enable coverage reporting, configure the Codecov token in GitHub repository secrets:

1. **Get Codecov Token:**
   - Visit [Codecov.io](https://codecov.io) and login with your GitHub account
   - Navigate to your repository settings
   - Copy the repository upload token

2. **Add GitHub Secret:**
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CODECOV_TOKEN`
   - Value: Paste your Codecov token (without `CODECOV_TOKEN=` prefix)
   - Click "Add secret"

3. **Coverage Reports:**
   - Coverage reports are automatically generated and uploaded on every CI run
   - View detailed coverage at: `https://codecov.io/gh/your-username/open-api-code-generator`

#### Coverage Metrics

The project maintains comprehensive test coverage:

- ✅ **Unit Tests** - Individual component testing
- ✅ **Integration Tests** - End-to-end generation testing  
- ✅ **Schema Composition Tests** - Complex schema handling
- ✅ **Error Handling Tests** - Comprehensive error scenarios
- ✅ **Performance Tests** - Benchmarking and optimization

## 📊 Performance Benchmarks

Run the included benchmark to compare implementations:

```bash
./benchmark.sh
```

**Sample Results:**
```
🚀 OpenAPI Code Generator - Language Implementation Benchmark
============================================================

📊 Testing Rust implementation (Ultra-fast, memory efficient)
✅ Rust: 0.051s
📄 Generated files: 9
💾 Output size: 42K
🧠 Peak memory usage: ~8.2MB

📊 Testing TypeScript implementation (Rich ecosystem, developer-friendly)
✅ TypeScript: 1.020s
📄 Generated files: 9
💾 Output size: 45K
🧠 Peak memory usage: ~45.1MB

🏆 Performance Rankings:
------------------------
⚡ Speed: Rust (20x faster)
🧠 Memory: Rust (5.5x less memory)
📦 Binary Size: Rust (single 2MB binary)
```

## ⚡ Performance Configuration

The OpenAPI Code Generator includes advanced performance optimization features for handling large specifications and high-throughput scenarios.

### 🎯 Caching Configuration

**Enable comprehensive caching for schema resolution:**

```typescript
import { OpenAPIParser } from 'openapi-code-generator';

const parser = new OpenAPIParser();

// Configure caching (default: enabled with 1000 entries)
parser.configureCaching({
  enabled: true,        // Enable/disable caching
  maxSize: 1000        // Maximum cache entries per cache type
});

// Get cache statistics
const cacheStats = parser.getCacheStats();
console.log(`Cache efficiency: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
```

**Cache Types:**
- **Reference Cache**: `$ref` resolution results
- **Composition Cache**: `allOf`/`oneOf`/`anyOf` results  
- **Schema Cache**: General schema processing results

### 🧠 Memory Optimization

**Configure memory-efficient processing for large specifications:**

```typescript
// Memory optimization for large OpenAPI specs
parser.configureMemoryOptimization({
  enabled: true,                    // Enable memory optimization
  memoryThreshold: 500 * 1024 * 1024, // 500MB threshold
  streamingMode: true               // Process in chunks
});

// Monitor memory usage
const memoryStats = parser.getMemoryStats();
console.log(`Memory usage: ${(memoryStats.heapUsed / 1024 / 1024).toFixed(2)} MB`);
```

**Memory Features:**
- **Streaming Mode**: Process large specs in 10-schema chunks
- **Automatic Cleanup**: Garbage collection when memory threshold exceeded
- **Cache Eviction**: LRU eviction under memory pressure
- **Memory Monitoring**: Real-time memory usage tracking

### 📊 Performance Metrics

**Enable detailed performance tracking:**

```typescript
// Enable metrics collection
parser.configureMetrics({ enabled: true });

// Start performance tracking
parser.startPerformanceTracking();

// ... perform operations ...

// End tracking and get report
parser.endPerformanceTracking();
const report = parser.generatePerformanceReport();
console.log(report);
```

**Sample Performance Report:**
```
=== PERFORMANCE REPORT ===

📊 SUMMARY
  Total Processing Time: 1,234.56ms
  Schemas Processed: 150
  Files Generated: 45
  Average Schema Time: 8.23ms

⚡ EFFICIENCY  
  Schemas/Second: 121.54
  Files/Second: 36.46
  Cache Efficiency: 89.2%
  Memory Efficiency: 94.1%

🎯 CACHE PERFORMANCE
  Overall Hit Rate: 89.2%
  Reference Cache: 94.1% hit rate (423/450)
  Composition Cache: 87.3% hit rate (145/166)
  
💾 MEMORY USAGE
  Peak Memory: 125.34 MB
  Current Memory: 89.67 MB
  Memory Cleanups: 3
```

### 🚀 Parallel Processing

**Automatic parallel processing for large specifications:**

```typescript
import { OpenAPICodeGenerator } from 'openapi-code-generator';

const generator = new OpenAPICodeGenerator({
  outputDir: './generated',
  basePackage: 'com.example',
  generateModels: true,
  generateControllers: true,
  // ... other config
});

// Parallel processing is automatically enabled for:
// - Model generation: >20 schemas (up to 8 concurrent workers)
// - Controller generation: >3 controllers (up to 4 concurrent workers)

const result = await generator.generate('./large-api.yaml');
console.log(`Generated ${result.fileCount} files`);
```

### 🎛️ Configuration Presets

**Optimized configurations for different scenarios:**

```typescript
// Small APIs (< 50 schemas)
parser.configureCaching({ enabled: true, maxSize: 200 });
parser.configureMemoryOptimization({ enabled: false });

// Medium APIs (50-200 schemas)  
parser.configureCaching({ enabled: true, maxSize: 500 });
parser.configureMemoryOptimization({ 
  enabled: true, 
  memoryThreshold: 200 * 1024 * 1024,
  streamingMode: false 
});

// Large APIs (200+ schemas)
parser.configureCaching({ enabled: true, maxSize: 1000 });
parser.configureMemoryOptimization({
  enabled: true,
  memoryThreshold: 500 * 1024 * 1024,
  streamingMode: true
});

// Enterprise APIs (1000+ schemas)
parser.configureCaching({ enabled: true, maxSize: 2000 });
parser.configureMemoryOptimization({
  enabled: true, 
  memoryThreshold: 1024 * 1024 * 1024, // 1GB
  streamingMode: true
});
```

### 📈 Performance Benchmarks

**Typical performance improvements with optimizations enabled:**

| Optimization | Improvement | Use Case |
|-------------|-------------|----------|
| **Caching** | 70-90% faster | Specs with repeated references |
| **Memory Optimization** | 40-60% less memory | Large specifications (200+ schemas) |
| **Parallel Processing** | 2-4x faster | Multiple models/controllers |
| **Combined** | 5-10x overall improvement | Enterprise APIs |

**Real-world Performance Examples:**

```typescript
// E-commerce API (15 schemas, 8 endpoints)
// Without optimization: 2.1s, 67MB memory
// With optimization: 0.3s, 23MB memory (7x faster, 65% less memory)

// Enterprise API (500 schemas, 50 endpoints)  
// Without optimization: 45s, 890MB memory
// With optimization: 6.2s, 245MB memory (7.3x faster, 72% less memory)

// Microservices API (50 schemas, 200 endpoints)
// Without optimization: 8.7s, 156MB memory
// With optimization: 1.8s, 89MB memory (4.8x faster, 43% less memory)
```

### 🔧 Performance Tuning Tips

1. **Enable Caching**: Always enable for production use
2. **Monitor Memory**: Use memory optimization for large specs
3. **Streaming Mode**: Enable for 200+ schemas
4. **Cache Size**: Increase for specs with many repeated references
5. **Parallel Processing**: Automatically optimized based on workload size
6. **Metrics Collection**: Enable during development for optimization insights

### 🚨 Performance Troubleshooting

**Common performance issues and solutions:**

```typescript
// Issue: High memory usage
parser.configureMemoryOptimization({ 
  enabled: true,
  memoryThreshold: 200 * 1024 * 1024  // Lower threshold
});

// Issue: Slow repeated operations
parser.configureCaching({ 
  enabled: true,
  maxSize: 2000  // Increase cache size
});

// Issue: Low cache hit rate
const cacheStats = parser.getCacheStats();
if (cacheStats.hitRate < 0.5) {
  // Increase cache size or check for unique references
  parser.configureCaching({ maxSize: cacheStats.maxSize * 2 });
}
```

For more performance tuning guidance, see our [Performance Troubleshooting Guide](./docs/troubleshooting/README.md#performance-issues).

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

1. **Fork and Clone:**
   ```bash
   git clone https://github.com/your-username/open-api-code-generator.git
   cd open-api-code-generator
   ```

2. **Choose Implementation:**
   ```bash
   # TypeScript development
   cd implementation/typescript
   npm install
   npm run build
   npm test
   
   # Rust development  
   cd implementation/rust
   cargo build
   cargo test
   ```

3. **Run Examples:**
   ```bash
   # Test with provided examples
   npm run example:basic
   npm run example:composition
   ```

### Code Quality

- Follow existing code style and conventions
- Add tests for new features
- Update documentation for API changes
- Ensure all implementations maintain consistency

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 **Documentation:** [./docs/](./docs/)
- 🐛 **Issues:** [GitHub Issues](https://github.com/your-org/open-api-code-generator/issues)
- 💬 **Discussions:** [GitHub Discussions](https://github.com/your-org/open-api-code-generator/discussions)
- 🔧 **Troubleshooting:** [./docs/troubleshooting/](./docs/troubleshooting/)

---

**Designed for high performance and large file support - efficiently process OpenAPI specifications of any size with industry-leading speed and memory efficiency.**