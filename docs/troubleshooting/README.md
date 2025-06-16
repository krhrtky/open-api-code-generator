# Troubleshooting Guide

This comprehensive guide helps you diagnose and resolve common issues when using the OpenAPI Code Generator.

## Table of Contents

- [Quick Diagnosis](#quick-diagnosis)
- [File and Format Issues](#file-and-format-issues)
- [OpenAPI Specification Issues](#openapi-specification-issues)
- [Reference Resolution Issues](#reference-resolution-issues)
- [Schema Composition Issues](#schema-composition-issues)
- [Code Generation Issues](#code-generation-issues)
- [Performance Issues](#performance-issues)
- [Integration Issues](#integration-issues)
- [Development and Testing Issues](#development-and-testing-issues)
- [Environment-Specific Issues](#environment-specific-issues)
- [Error Reference](#error-reference)

---

## Quick Diagnosis

### 🚨 Emergency Checklist

If you're experiencing issues, check these common problems first:

1. **File exists and is readable**: `ls -la /path/to/your/api.yaml`
2. **Valid YAML/JSON syntax**: Use an online validator
3. **OpenAPI version 3.x**: Check `openapi: "3.0.3"` in your spec
4. **Required fields present**: Ensure `info.title`, `info.version`, and `paths` exist
5. **Node.js version**: Use Node.js 16+ for TypeScript implementation
6. **Disk space**: Ensure sufficient space for generated files

### 🔍 Quick Validation Commands

```bash
# Validate YAML syntax
node -e "console.log(require('yaml').parse(require('fs').readFileSync('./api.yaml', 'utf8')))"

# Validate JSON syntax  
node -e "console.log(JSON.parse(require('fs').readFileSync('./api.json', 'utf8')))"

# Test basic generation
npm run build && node dist/index.js --input ./examples/sample-api.yaml --output ./test-output --verbose
```

---

## File and Format Issues

### FILE_NOT_FOUND

**Error:** `File not found: /path/to/api.yaml`

**Symptoms:**
- Cannot locate the specified OpenAPI file
- Permission denied errors

**Solutions:**

1. **Verify file path:**
   ```bash
   # Check if file exists
   ls -la /path/to/api.yaml
   
   # Use absolute path
   openapi-codegen --input "$(pwd)/api.yaml" --output ./generated
   ```

2. **Check file permissions:**
   ```bash
   # Make file readable
   chmod 644 api.yaml
   
   # Check current permissions
   ls -la api.yaml
   ```

3. **Use relative paths correctly:**
   ```bash
   # From project root
   openapi-codegen --input ./specs/api.yaml --output ./generated
   
   # From current directory
   openapi-codegen --input api.yaml --output ./generated
   ```

### UNSUPPORTED_FORMAT

**Error:** `Unsupported file format: .txt`

**Symptoms:**
- File extension is not .yaml, .yml, or .json
- Generator doesn't recognize the file type

**Solutions:**

1. **Rename file with correct extension:**
   ```bash
   # For YAML files
   mv api.txt api.yaml
   
   # For JSON files  
   mv api.txt api.json
   ```

2. **Verify file content format:**
   ```bash
   # Check first few lines
   head -10 api.yaml
   
   # Should show YAML structure like:
   # openapi: "3.0.3"
   # info:
   #   title: My API
   ```

### INVALID_JSON / INVALID_YAML

**Error:** `Invalid JSON format` or `Invalid YAML format`

**Symptoms:**
- Syntax errors in the specification file
- Parsing fails before validation

**Solutions:**

1. **Validate YAML syntax:**
   ```bash
   # Using yamllint (install: pip install yamllint)
   yamllint api.yaml
   
   # Using Node.js
   node -e "
   try {
     const yaml = require('yaml');
     const fs = require('fs');
     yaml.parse(fs.readFileSync('api.yaml', 'utf8'));
     console.log('✅ Valid YAML');
   } catch(e) {
     console.error('❌ Invalid YAML:', e.message);
   }
   "
   ```

2. **Validate JSON syntax:**
   ```bash
   # Using jq (install: brew install jq)
   jq . api.json
   
   # Using Node.js
   node -e "
   try {
     JSON.parse(require('fs').readFileSync('api.json', 'utf8'));
     console.log('✅ Valid JSON');
   } catch(e) {
     console.error('❌ Invalid JSON:', e.message);
   }
   "
   ```

3. **Common YAML issues:**
   ```yaml
   # ❌ Wrong: Inconsistent indentation
   info:
     title: My API
      version: 1.0.0  # Too much indentation
   
   # ✅ Correct: Consistent indentation
   info:
     title: My API
     version: 1.0.0
   
   # ❌ Wrong: Missing quotes for special characters
   title: My API: Version 2.0
   
   # ✅ Correct: Quoted strings with special characters
   title: "My API: Version 2.0"
   ```

---

## OpenAPI Specification Issues

### MISSING_OPENAPI_VERSION

**Error:** `Missing required field: openapi`

**Solutions:**

```yaml
# ✅ Add OpenAPI version at the top of your spec
openapi: "3.0.3"  # or "3.1.0"
info:
  title: My API
  version: 1.0.0
paths: {}
```

### UNSUPPORTED_OPENAPI_VERSION

**Error:** `Unsupported OpenAPI version: 2.0`

**Solutions:**

1. **Upgrade from Swagger 2.0 to OpenAPI 3.x:**
   ```bash
   # Use swagger-codegen-cli to convert
   npx @apidevtools/swagger-cli convert swagger2.yaml --output openapi3.yaml
   ```

2. **Update version field:**
   ```yaml
   # ❌ Old Swagger 2.0 format
   swagger: "2.0"
   
   # ✅ New OpenAPI 3.x format
   openapi: "3.0.3"
   ```

### MISSING_INFO / MISSING_INFO_TITLE / MISSING_INFO_VERSION

**Error:** `Missing required field: info.title`

**Solutions:**

```yaml
# ✅ Complete info section
openapi: "3.0.3"
info:
  title: "My API"           # Required
  version: "1.0.0"          # Required
  description: "API description"  # Optional but recommended
  contact:                  # Optional
    name: "API Team"
    email: "api@company.com"
  license:                  # Optional
    name: "MIT"
paths: {}
```

### MISSING_PATHS

**Error:** `Missing required field: paths`

**Solutions:**

```yaml
# ✅ Add paths section (can be empty)
openapi: "3.0.3"
info:
  title: My API
  version: 1.0.0
paths: {}  # Required, even if empty

# ✅ Or with actual paths
paths:
  /users:
    get:
      summary: Get users
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  type: object
```

---

## Reference Resolution Issues

### REFERENCE_NOT_FOUND

**Error:** `Reference not found: #/components/schemas/User`

**Symptoms:**
- `$ref` points to non-existent component
- Schema reference cannot be resolved

**Solutions:**

1. **Check component exists:**
   ```yaml
   # ✅ Ensure referenced component is defined
   components:
     schemas:
       User:  # This component must exist
         type: object
         properties:
           id:
             type: integer
           name:
             type: string
   
   paths:
     /users:
       get:
         responses:
           '200':
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/User'  # Reference to existing component
   ```

2. **Verify reference path:**
   ```yaml
   # ❌ Wrong: Case mismatch
   $ref: '#/components/schemas/user'  # lowercase 'user'
   
   # ✅ Correct: Exact case match
   $ref: '#/components/schemas/User'  # matches component name exactly
   
   # ❌ Wrong: Missing #/
   $ref: 'components/schemas/User'
   
   # ✅ Correct: Proper reference format
   $ref: '#/components/schemas/User'
   ```

3. **Check for typos:**
   ```bash
   # Search for component definition
   grep -n "User:" api.yaml
   
   # Search for all references to User
   grep -n "User" api.yaml
   ```

### CIRCULAR_REFERENCE

**Error:** `Circular reference detected: #/components/schemas/User`

**Symptoms:**
- Components reference each other in a cycle
- Infinite recursion during schema resolution

**Solutions:**

1. **Identify circular references:**
   ```yaml
   # ❌ Problem: Circular reference
   components:
     schemas:
       User:
         type: object
         properties:
           profile:
             $ref: '#/components/schemas/Profile'
       
       Profile:
         type: object
         properties:
           user:
             $ref: '#/components/schemas/User'  # Circular!
   ```

2. **Break circular references:**
   ```yaml
   # ✅ Solution: Use optional references or restructure
   components:
     schemas:
       User:
         type: object
         properties:
           id:
             type: integer
           profileId:  # Reference by ID instead of object
             type: integer
       
       Profile:
         type: object
         properties:
           id:
             type: integer
           userId:     # Reference by ID instead of object
             type: integer
   ```

3. **Use composition patterns:**
   ```yaml
   # ✅ Alternative: Use allOf to avoid direct circular reference
   components:
     schemas:
       BaseUser:
         type: object
         properties:
           id:
             type: integer
           name:
             type: string
       
       UserWithProfile:
         allOf:
           - $ref: '#/components/schemas/BaseUser'
           - type: object
             properties:
               profile:
                 $ref: '#/components/schemas/Profile'
   ```

### EXTERNAL_FETCH_FAILED / DOMAIN_NOT_ALLOWED

**Error:** `Failed to resolve external reference` or `Domain not allowed`

**Solutions:**

1. **Configure allowed domains:**
   ```typescript
   const parser = new OpenAPIParser({
     allowedDomains: [
       'api.example.com',
       'schemas.company.com',
       'github.com'
     ],
     timeout: 10000
   });
   ```

2. **Check network connectivity:**
   ```bash
   # Test external URL accessibility
   curl -I https://api.example.com/openapi.yaml
   
   # Check if domain resolves
   nslookup api.example.com
   ```

3. **Use local copies for development:**
   ```bash
   # Download external schemas locally
   mkdir -p ./external-schemas
   curl -o ./external-schemas/common.yaml https://api.example.com/schemas/common.yaml
   
   # Update references to use local files
   # $ref: 'https://api.example.com/schemas/common.yaml#/components/schemas/Error'
   # becomes:
   # $ref: './external-schemas/common.yaml#/components/schemas/Error'
   ```

---

## Schema Composition Issues

### ALLOF_MERGE_CONFLICT

**Error:** `Property 'name' has conflicting types in allOf schemas`

**Symptoms:**
- Same property defined with different types in allOf schemas
- Merge conflict during schema resolution

**Solutions:**

1. **Identify conflicting properties:**
   ```yaml
   # ❌ Problem: Type conflict
   components:
     schemas:
       Schema1:
         type: object
         properties:
           name:
             type: string  # String type
       
       Schema2:
         type: object
         properties:
           name:
             type: integer  # Integer type - CONFLICT!
       
       Combined:
         allOf:
           - $ref: '#/components/schemas/Schema1'
           - $ref: '#/components/schemas/Schema2'
   ```

2. **Resolve type conflicts:**
   ```yaml
   # ✅ Solution: Make types compatible
   components:
     schemas:
       Schema1:
         type: object
         properties:
           name:
             type: string
       
       Schema2:
         type: object
         properties:
           displayName:  # Different property name
             type: string
       
       Combined:
         allOf:
           - $ref: '#/components/schemas/Schema1'
           - $ref: '#/components/schemas/Schema2'
   ```

3. **Use composition hierarchy:**
   ```yaml
   # ✅ Alternative: Define base schema with common type
   components:
     schemas:
       BaseEntity:
         type: object
         properties:
           name:
             type: string  # Consistent type in base
       
       User:
         allOf:
           - $ref: '#/components/schemas/BaseEntity'
           - type: object
             properties:
               email:
                 type: string
       
       Product:
         allOf:
           - $ref: '#/components/schemas/BaseEntity'
           - type: object
             properties:
               price:
                 type: number
   ```

### ONEOF_DISCRIMINATOR_MISSING

**Error:** `oneOf schema without discriminator property`

**Solutions:**

1. **Add discriminator property:**
   ```yaml
   # ✅ Add discriminator to oneOf schemas
   components:
     schemas:
       Notification:
         oneOf:
           - $ref: '#/components/schemas/EmailNotification'
           - $ref: '#/components/schemas/SMSNotification'
         discriminator:
           propertyName: type  # Required discriminator
           mapping:
             email: '#/components/schemas/EmailNotification'
             sms: '#/components/schemas/SMSNotification'
       
       EmailNotification:
         type: object
         required: [type]
         properties:
           type:
             type: string
             enum: [email]  # Must match discriminator mapping
           email:
             type: string
       
       SMSNotification:
         type: object
         required: [type]
         properties:
           type:
             type: string
             enum: [sms]   # Must match discriminator mapping
           phone:
             type: string
   ```

### ANYOF_NO_VARIANTS

**Error:** `anyOf schema must contain at least one variant`

**Solutions:**

```yaml
# ❌ Problem: Empty anyOf
components:
  schemas:
    EmptyUnion:
      anyOf: []  # Empty array not allowed

# ✅ Solution: Add at least one variant
components:
  schemas:
    ValidUnion:
      anyOf:
        - type: string
        - type: number
        - $ref: '#/components/schemas/CustomType'
```

---

## Code Generation Issues

### UNSUPPORTED_SCHEMA_TYPE

**Error:** `Unsupported schema type: unknown`

**Solutions:**

1. **Use supported OpenAPI types:**
   ```yaml
   # ✅ Supported types
   properties:
     stringField:
       type: string
     numberField:
       type: number
     integerField:
       type: integer
     booleanField:
       type: boolean
     arrayField:
       type: array
       items:
         type: string
     objectField:
       type: object
       properties:
         nested:
           type: string
   
   # ❌ Unsupported
   properties:
     unknownField:
       type: unknown  # Not a valid OpenAPI type
   ```

2. **Handle complex types with composition:**
   ```yaml
   # ✅ Use anyOf for union types
   properties:
     flexibleField:
       anyOf:
         - type: string
         - type: number
         - type: boolean
   ```

### INVALID_PROPERTY_NAME

**Error:** `Invalid property name conflicts with language keywords`

**Solutions:**

1. **Avoid language keywords:**
   ```yaml
   # ❌ Problem: Kotlin/Java keywords
   properties:
     class:    # Reserved keyword
       type: string
     interface:  # Reserved keyword
       type: string
     for:      # Reserved keyword
       type: string
   
   # ✅ Solution: Use alternative names
   properties:
     className:
       type: string
     interfaceType:
       type: string
     forValue:
       type: string
   ```

2. **Use x-property-name extension:**
   ```yaml
   # ✅ Override generated property name
   properties:
     class:
       type: string
       x-property-name: className  # Custom property name
   ```

### TEMPLATE_GENERATION_FAILED

**Error:** `Template generation failed for controller UserController`

**Solutions:**

1. **Check required operation properties:**
   ```yaml
   # ✅ Ensure operations have required properties
   paths:
     /users:
       get:
         operationId: getUsers    # Required for method name
         summary: Get all users   # Required for documentation
         responses:               # Required
           '200':
             description: Success
             content:
               application/json:
                 schema:
                   type: array
                   items:
                     $ref: '#/components/schemas/User'
   ```

2. **Validate response schemas:**
   ```yaml
   # ❌ Problem: Missing response schema
   responses:
     '200':
       description: Success
       # Missing content/schema
   
   # ✅ Solution: Add complete response
   responses:
     '200':
       description: Success
       content:
         application/json:
           schema:
             $ref: '#/components/schemas/User'
   ```

---

## Performance Issues

### Slow Generation Times

**Symptoms:**
- Generation takes longer than expected
- High memory usage during generation

**Solutions:**

1. **Use Rust implementation for large files:**
   ```bash
   # Switch to Rust for better performance
   cd implementation/rust
   cargo build --release
   ./target/release/openapi-codegen --input large-api.yaml --output ./generated
   ```

2. **Optimize schema complexity:**
   ```yaml
   # ❌ Avoid deeply nested allOf chains
   ComplexSchema:
     allOf:
       - allOf:
           - allOf:
               - $ref: '#/components/schemas/Level4'
               # Too deep!
   
   # ✅ Flatten schema structure
   ComplexSchema:
     allOf:
       - $ref: '#/components/schemas/Base'
       - $ref: '#/components/schemas/Extensions'
   ```

3. **Enable caching for external references:**
   ```typescript
   const parser = new OpenAPIParser({
     cacheEnabled: true,
     maxCacheSize: 100
   });
   ```

### Memory Issues

**Symptoms:**
- Out of memory errors
- Node.js heap limit exceeded

**Solutions:**

1. **Increase Node.js memory limit:**
   ```bash
   # Increase to 4GB
   node --max-old-space-size=4096 dist/index.js --input large-api.yaml
   
   # Or set environment variable
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm start
   ```

2. **Process large specs in chunks:**
   ```typescript
   // Split large specs into smaller files
   const schemas = await parser.getAllSchemas(spec);
   const schemaChunks = chunkArray(Object.entries(schemas), 50);
   
   for (const chunk of schemaChunks) {
     await generator.generateModels(chunk);
   }
   ```

---

## Integration Issues

### Webhook Service Issues

**Error:** `Webhook service failed to start`

**Solutions:**

1. **Check port availability:**
   ```bash
   # Check if port is in use
   lsof -i :3001
   
   # Kill process using port
   kill -9 $(lsof -t -i:3001)
   ```

2. **Configure different port:**
   ```typescript
   const webhookService = new WebhookService({
     port: 3002,  // Use different port
     enabled: true
   });
   ```

3. **Check firewall settings:**
   ```bash
   # macOS: Allow incoming connections
   sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add node
   
   # Linux: Open port in firewall
   sudo ufw allow 3001
   ```

### Authentication Issues

**Error:** `Authentication failed` or `Invalid JWT token`

**Solutions:**

1. **Verify JWT configuration:**
   ```typescript
   const authService = new AuthService({
     jwtSecret: 'your-secret-key',  // Ensure secret is set
     enableJWT: true
   });
   ```

2. **Check API key format:**
   ```typescript
   // Correct API key header format
   headers: {
     'Authorization': 'Bearer your-api-key',
     // or
     'X-API-Key': 'your-api-key'
   }
   ```

---

## Development and Testing Issues

### Test Failures

**Common test issues and solutions:**

1. **Port conflicts in tests:**
   ```typescript
   // Use dynamic ports in tests
   const port = 3000 + Math.floor(Math.random() * 1000);
   const webhookService = new WebhookService({ port });
   ```

2. **Async test timeout:**
   ```typescript
   // Increase timeout for slow operations
   test('should generate large API', async () => {
     // ... test code
   }, 30000);  // 30 second timeout
   ```

3. **Clean up test resources:**
   ```typescript
   afterEach(async () => {
     await webhookService.stop();
     await fs.remove(tempDir);
   });
   ```

### TypeScript Compilation Issues

**Error:** `Cannot find module` or `Type errors`

**Solutions:**

1. **Update dependencies:**
   ```bash
   npm install
   npm update
   ```

2. **Clear TypeScript cache:**
   ```bash
   rm -rf node_modules/.cache
   rm -rf dist/
   npm run build
   ```

3. **Check TypeScript configuration:**
   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "target": "ES2020",
       "module": "commonjs",
       "lib": ["ES2020"],
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true
     }
   }
   ```

---

## Environment-Specific Issues

### Docker Issues

**Error:** `Cannot access generated files from container`

**Solutions:**

1. **Mount output directory:**
   ```bash
   docker run -v $(pwd)/generated:/app/generated openapi-codegen \
     --input /app/api.yaml --output /app/generated
   ```

2. **Set correct permissions:**
   ```dockerfile
   # In Dockerfile
   USER node
   WORKDIR /app
   RUN mkdir -p generated && chown node:node generated
   ```

### CI/CD Integration

**Common CI/CD issues:**

1. **Missing Node.js version:**
   ```yaml
   # GitHub Actions
   - uses: actions/setup-node@v3
     with:
       node-version: '18'
   ```

2. **Insufficient memory in CI:**
   ```yaml
   # Increase memory limit
   - run: node --max-old-space-size=4096 dist/index.js --input api.yaml
   ```

3. **File permission issues:**
   ```bash
   # Ensure files are readable
   chmod -R 644 specs/
   chmod 755 dist/index.js
   ```

---

## Error Reference

### Complete Error Code Reference

| Error Code | Category | Description | Quick Fix |
|------------|----------|-------------|-----------|
| `FILE_NOT_FOUND` | File | Input file doesn't exist | Check file path and permissions |
| `UNSUPPORTED_FORMAT` | File | Wrong file extension | Use .yaml, .yml, or .json |
| `INVALID_JSON` | File | JSON syntax error | Validate JSON with linter |
| `INVALID_YAML` | File | YAML syntax error | Validate YAML with linter |
| `MISSING_OPENAPI_VERSION` | Spec | No `openapi` field | Add `openapi: "3.0.3"` |
| `UNSUPPORTED_OPENAPI_VERSION` | Spec | Wrong OpenAPI version | Use version 3.x |
| `MISSING_INFO` | Spec | No `info` section | Add `info` with `title` and `version` |
| `MISSING_PATHS` | Spec | No `paths` section | Add `paths: {}` |
| `REFERENCE_NOT_FOUND` | Reference | $ref points to missing component | Create referenced component |
| `CIRCULAR_REFERENCE` | Reference | Circular dependency | Break circular references |
| `EXTERNAL_FETCH_FAILED` | Reference | External URL inaccessible | Check network/permissions |
| `ALLOF_MERGE_CONFLICT` | Schema | Property type conflicts in allOf | Resolve type mismatches |
| `ONEOF_DISCRIMINATOR_MISSING` | Schema | oneOf without discriminator | Add discriminator property |
| `ANYOF_NO_VARIANTS` | Schema | Empty anyOf array | Add at least one variant |
| `UNSUPPORTED_SCHEMA_TYPE` | Generation | Invalid schema type | Use supported OpenAPI types |
| `TEMPLATE_GENERATION_FAILED` | Generation | Code generation failed | Check operation definitions |

### Getting More Help

**Enable verbose logging:**
```bash
openapi-codegen --input api.yaml --output ./generated --verbose
```

**Generate debug information:**
```typescript
const generator = new OpenAPICodeGenerator({
  // ... config
  verbose: true,
  debugMode: true  // If available
});
```

**Check logs and error details:**
```typescript
try {
  await generator.generate('./api.yaml');
} catch (error) {
  if (error instanceof OpenAPIParsingError) {
    console.log('Full error details:', error.getErrorDetails());
    console.log('Formatted message:', error.getFormattedMessage());
    console.log('Schema path:', error.context.schemaPath);
    console.log('Suggestion:', error.context.suggestion);
  }
}
```

---

**💡 Pro Tip:** Always run with `--verbose` flag when troubleshooting to get detailed error information and generation progress.

For additional support, please check:
- [API Documentation](../api/)
- [GitHub Issues](https://github.com/your-org/open-api-code-generator/issues)
- [Examples Directory](../../examples/)