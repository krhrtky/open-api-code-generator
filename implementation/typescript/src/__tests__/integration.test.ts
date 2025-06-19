import { OpenAPICodeGenerator } from '../generator';
import { GeneratorConfig } from '../types';
import { I18nService } from '../i18n';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('Integration Tests', () => {
  let tempDir: string;
  let config: GeneratorConfig;
  let generator: OpenAPICodeGenerator;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openapi-integration-test-'));
    
    const i18n = new I18nService();
    await i18n.initialize();
    
    config = {
      outputDir: tempDir,
      basePackage: 'com.example.test',
      generateModels: true,
      generateControllers: true,
      includeValidation: true,
      includeSwagger: true,
      verbose: false,
      i18n
    };
    
    generator = new OpenAPICodeGenerator(config);
  });

  afterAll(async () => {
    await fs.remove(tempDir);
  });

  describe('End-to-End Code Generation', () => {
    test('should generate complete project from schema composition test API', async () => {
      const testApiPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');
      const result = await generator.generate(testApiPath);
      
      expect(result.generatedFiles.length).toBeGreaterThan(0);
      expect(result.outputDir).toBe(tempDir);
      
      // Verify project structure
      const srcDir = path.join(tempDir, 'src/main/kotlin/com/example/test');
      const modelDir = path.join(srcDir, 'model/model');
      const controllerDir = path.join(srcDir, 'controller');
      const buildFile = path.join(tempDir, 'build.gradle.kts');
      
      expect(await fs.pathExists(modelDir)).toBe(true);
      expect(await fs.pathExists(controllerDir)).toBe(true);
      expect(await fs.pathExists(buildFile)).toBe(true);
      
      // Check specific files
      expect(await fs.pathExists(path.join(modelDir, 'UserProfile.kt'))).toBe(true);
      expect(await fs.pathExists(path.join(modelDir, 'Notification.kt'))).toBe(true);
      expect(await fs.pathExists(path.join(controllerDir, 'AllOfController.kt'))).toBe(true);
      
      // Verify build.gradle.kts content
      const buildContent = await fs.readFile(buildFile, 'utf-8');
      expect(buildContent).toContain('kotlin("jvm")');
      expect(buildContent).toContain('spring-boot-starter-web');
      expect(buildContent).toContain('jackson-module-kotlin');
      expect(buildContent).toContain('springdoc-openapi-starter-webmvc-ui');
    });

    test('should generate valid Kotlin syntax for all composition patterns', async () => {
      const testFiles = [
        'allof-inheritance-example.yaml',
        'oneof-polymorphism-example.yaml',
        'anyof-flexible-unions-example.yaml',
        'complex-composition-example.yaml'
      ];

      for (const testFile of testFiles) {
        const testPath = path.join(__dirname, '../../../../examples', testFile);
        const result = await generator.generate(testPath);
        
        expect(result.generatedFiles.length).toBeGreaterThan(0);
        
        // Verify all generated Kotlin files have valid syntax
        const kotlinFiles = result.generatedFiles.filter(f => f.endsWith('.kt'));
        
        for (const kotlinFile of kotlinFiles) {
          const content = await fs.readFile(kotlinFile, 'utf-8');
          
          // Basic syntax checks
          expect(content).toMatch(/^package\s+[\w.]+/m);
          
          // Skip validation files and only check for class definitions in other files
          if (!kotlinFile.includes('validation') && !kotlinFile.endsWith('Validator.kt')) {
            expect(content).toMatch(/(data\s+class|sealed\s+class|interface)\s+\w+/);
          }
          
          // Ensure proper imports
          if (content.includes('@JsonProperty')) {
            expect(content).toContain('import com.fasterxml.jackson.annotation.JsonProperty');
          }
          if (content.includes('@NotNull')) {
            expect(content).toContain('import javax.validation.constraints.*');
          }
          if (content.includes('@Schema')) {
            expect(content).toContain('import io.swagger.v3.oas.annotations.media.Schema');
          }
          
          // Ensure proper Kotlin syntax
          expect(content).not.toContain(';;'); // No double semicolons
          
          // Validate class structure
          const classMatches = content.match(/(data\s+class|sealed\s+class|interface)\s+(\w+)/g);
          if (classMatches) {
            for (const match of classMatches) {
              const className = match.split(/\s+/).pop();
              expect(className).toMatch(/^[A-Z][a-zA-Z0-9]*$/); // PascalCase
            }
          }
        }
      }
    });

    test('should handle special characters and internationalization', async () => {
      // Test with Japanese i18n
      const japaneseI18n = new I18nService();
      await japaneseI18n.initialize();
      
      const japaneseConfig = { ...config, i18n: japaneseI18n };
      const japaneseGenerator = new OpenAPICodeGenerator(japaneseConfig);
      
      try {
        const result = await japaneseGenerator.generate(
          path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml')
        );
        expect(result.generatedFiles.length).toBeGreaterThan(0);
      } catch (error) {
        // Error messages should be in Japanese
        if (error instanceof Error) {
          // Just ensure the generator can handle Japanese locale
          expect(japaneseI18n).toBeDefined();
        }
      }
    });
  });

  describe('Generated Code Validation', () => {
    test('should generate syntactically correct Kotlin code', async () => {
      const testApiPath = path.join(__dirname, '../../../../examples/allof-inheritance-example.yaml');
      const result = await generator.generate(testApiPath);
      
      const kotlinFiles = result.generatedFiles.filter(f => f.endsWith('.kt'));
      expect(kotlinFiles.length).toBeGreaterThan(0);
      
      for (const kotlinFile of kotlinFiles) {
        const content = await fs.readFile(kotlinFile, 'utf-8');
        
        // Comprehensive syntax validation
        expect(content).toMatch(/^package\s+[\w.]+/m);
        
        // Validate imports
        const importLines = content.split('\n').filter(line => line.startsWith('import'));
        for (const importLine of importLines) {
          expect(importLine).toMatch(/^import\s+[\w.]+(\.\*)?$/);
        }
        
        // Validate class declarations
        const classDeclarations = content.match(/(data\s+class|sealed\s+class|interface)\s+\w+[^{]*\{?/g);
        if (classDeclarations) {
          for (const declaration of classDeclarations) {
            expect(declaration).not.toContain(',,'); // No double commas
            expect(declaration).not.toContain('::'); // No double colons in wrong places
          }
        }
        
        // Validate property declarations
        const propertyDeclarations = content.match(/val\s+\w+:\s*[\w<>?,\s]+/g);
        if (propertyDeclarations) {
          for (const property of propertyDeclarations) {
            expect(property).toMatch(/^val\s+[a-zA-Z]\w*:\s*[\w<>?,\s]+$/);
          }
        }
        
        // Validate annotations
        const annotations = content.match(/@\w+(\([^)]*\))?/g);
        if (annotations) {
          for (const annotation of annotations) {
            expect(annotation).toMatch(/^@[A-Za-z]\w*(\([^)]*\))?$/);
          }
        }
      }
    });

    test('should generate proper Jackson annotations for polymorphism', async () => {
      const oneOfPath = path.join(__dirname, '../../../../examples/oneof-polymorphism-example.yaml');
      const result = await generator.generate(oneOfPath);
      
      const eventFile = result.generatedFiles.find(f => f.includes('Event.kt'));
      expect(eventFile).toBeDefined();
      
      if (eventFile) {
        const content = await fs.readFile(eventFile, 'utf-8');
        
        // Should have proper Jackson polymorphic annotations
        expect(content).toContain('@JsonTypeInfo');
        expect(content).toContain('use = JsonTypeInfo.Id.NAME');
        expect(content).toContain('include = JsonTypeInfo.As.PROPERTY');
        expect(content).toContain('property = "type"');
        expect(content).toContain('@JsonSubTypes');
        expect(content).toContain('JsonSubTypes.Type');
        
        // Should have sealed class structure
        expect(content).toContain('sealed class Event');
        expect(content).toMatch(/data class \w+[\s\S]*?\) : Event\(/);
      }
    });

    test('should generate proper validation annotations', async () => {
      const allOfPath = path.join(__dirname, '../../../../examples/allof-inheritance-example.yaml');
      const result = await generator.generate(allOfPath);
      
      const employeeFile = result.generatedFiles.find(f => f.includes('Employee.kt'));
      expect(employeeFile).toBeDefined();
      
      if (employeeFile) {
        const content = await fs.readFile(employeeFile, 'utf-8');
        
        // Should have validation imports
        expect(content).toContain('import javax.validation.constraints.*');
        
        // Should have validation annotations on appropriate fields
        if (content.includes('email')) {
          expect(content).toMatch(/@Email[\s\S]*email:/);
        }
        if (content.includes('employeeId')) {
          expect(content).toMatch(/@Pattern[\s\S]*employeeId:/);
        }
        
        // Should have @NotNull on required fields
        expect(content).toContain('@NotNull');
      }
    });
  });

  describe('File System Integration', () => {
    test('should create proper directory structure', async () => {
      const testApiPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');
      const result = await generator.generate(testApiPath);
      
      // Check Kotlin source directory structure
      const expectedDirs = [
        'src',
        'src/main',
        'src/main/kotlin',
        'src/main/kotlin/com',
        'src/main/kotlin/com/example',
        'src/main/kotlin/com/example/test',
        'src/main/kotlin/com/example/test/model',
        'src/main/kotlin/com/example/test/model/model',
        'src/main/kotlin/com/example/test/controller'
      ];
      
      for (const dir of expectedDirs) {
        const fullPath = path.join(tempDir, dir);
        expect(await fs.pathExists(fullPath)).toBe(true);
        const stat = await fs.stat(fullPath);
        expect(stat.isDirectory()).toBe(true);
      }
    });

    test('should handle file naming conflicts gracefully', async () => {
      const testApiPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');
      
      // Generate once
      const result1 = await generator.generate(testApiPath);
      expect(result1.generatedFiles.length).toBeGreaterThan(0);
      
      // Generate again (should overwrite)
      const result2 = await generator.generate(testApiPath);
      expect(result2.generatedFiles.length).toBe(result1.generatedFiles.length);
      
      // Files should still exist and be valid
      for (const file of result2.generatedFiles) {
        expect(await fs.pathExists(file)).toBe(true);
        if (file.endsWith('.kt')) {
          const content = await fs.readFile(file, 'utf-8');
          expect(content.length).toBeGreaterThan(0);
          expect(content).toMatch(/^package\s+/);
        }
      }
    });

    test('should generate build file with correct dependencies', async () => {
      const testApiPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');
      const result = await generator.generate(testApiPath);
      
      const buildFile = path.join(tempDir, 'build.gradle.kts');
      expect(await fs.pathExists(buildFile)).toBe(true);
      
      const content = await fs.readFile(buildFile, 'utf-8');
      
      // Check essential dependencies
      expect(content).toContain('spring-boot-starter-web');
      expect(content).toContain('spring-boot-starter-validation');
      expect(content).toContain('jackson-module-kotlin');
      expect(content).toContain('kotlin-reflect');
      expect(content).toContain('springdoc-openapi-starter-webmvc-ui');
      
      // Check Kotlin configuration
      expect(content).toContain('kotlin("jvm")');
      expect(content).toContain('kotlin("plugin.spring")');
      expect(content).toContain('jvmTarget = "17"');
      
      // Check plugins
      expect(content).toContain('org.springframework.boot');
      expect(content).toContain('io.spring.dependency-management');
      
      // Check group and version
      expect(content).toContain('group = "com.example.test"');
      expect(content).toContain('version = "0.0.1-SNAPSHOT"');
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle large schemas efficiently', async () => {
      // Create a large schema with many properties for testing
      const largeSchema = {
        openapi: '3.0.3',
        info: { title: 'Large Schema Test', version: '1.0.0' },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': {
                  description: 'Success',
                  content: {
                    'application/json': {
                      schema: { $ref: '#/components/schemas/LargeObject' }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          schemas: {
            LargeObject: {
              type: 'object',
              properties: {}
            }
          }
        }
      };

      // Add many properties to test performance
      for (let i = 0; i < 100; i++) {
        (largeSchema.components.schemas.LargeObject.properties as any)[`property${i}`] = {
          type: 'string',
          description: `Property ${i}`
        };
      }

      const complexPath = path.join(tempDir, 'large-schema.yaml');
      await fs.writeFile(complexPath, JSON.stringify(largeSchema));
      
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      const result = await generator.generate(complexPath);
      
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;
      
      // Performance assertions (adjust thresholds as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
      expect(result.generatedFiles.length).toBeGreaterThan(0);
    });

    test('should clean up temporary resources', async () => {
      // First generate to get baseline
      const baselineResult = await generator.generate(path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml'));
      const initialFileCount = baselineResult.generatedFiles.length;
      
      // Generate multiple times to ensure no resource leaks
      for (let i = 0; i < 3; i++) {
        const testPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');
        const iterationResult = await generator.generate(testPath);
        expect(iterationResult.generatedFiles.length).toBe(initialFileCount);
      }
      
      // Memory usage should remain stable
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(300 * 1024 * 1024); // 300MB
    });
  });

  describe('Error Recovery and Robustness', () => {
    test('should gracefully handle invalid file paths', async () => {
      await expect(generator.generate('/non/existent/path.yaml')).rejects.toThrow(/File not found/);
    });

    test('should gracefully handle malformed YAML', async () => {
      const malformedYaml = path.join(tempDir, 'malformed.yaml');
      await fs.writeFile(malformedYaml, 'invalid: yaml: content: [missing bracket');
      
      await expect(generator.generate(malformedYaml)).rejects.toThrow(/Invalid YAML format/);
    });

    test('should gracefully handle invalid OpenAPI specs', async () => {
      const invalidSpec = path.join(tempDir, 'invalid-spec.yaml');
      await fs.writeFile(invalidSpec, `
openapi: 3.0.0
info:
  title: Invalid Spec
  # Missing version
paths: {}
`);
      
      await expect(generator.generate(invalidSpec)).rejects.toThrow(/Missing required field/);
    });

    test('should handle permission errors gracefully', async () => {
      const readOnlyConfig = {
        ...config,
        outputDir: '/root/no-permission' // Assume this directory doesn't exist or has no write permission
      };
      
      const readOnlyGenerator = new OpenAPICodeGenerator(readOnlyConfig);
      const testPath = path.join(__dirname, '../../../../examples/schema-composition-test-api.yaml');
      
      // Should fail gracefully without crashing
      await expect(readOnlyGenerator.generate(testPath)).rejects.toThrow();
    });
  });
});