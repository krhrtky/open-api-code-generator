import * as fs from 'fs-extra';
import * as path from 'path';
import { OpenAPIParser } from './parser';
import {
  OpenAPISpec,
  OpenAPISchema,
  OpenAPIOperation,
  OpenAPIParameter,
  GeneratorConfig,
  GenerationResult,
  KotlinClass,
  KotlinController,
  KotlinProperty,
  KotlinMethod,
  KotlinParameter
} from './types';
import { I18nService } from './i18n';
import { 
  createGenerationError, 
  createParsingError,
  ErrorCode,
  OpenAPIGenerationError,
  OpenAPIParsingError 
} from './errors';
import { WebhookService } from './webhook';
import { 
  ValidationRuleService, 
  ValidationUtils, 
  OpenAPISchemaWithValidation 
} from './validation';
import { ConditionalValidator } from './conditional-validation';

export class OpenAPICodeGenerator {
  private config: GeneratorConfig;
  private parser: OpenAPIParser;
  private i18n: I18nService;
  private webhookService?: WebhookService;
  private validationRuleService: ValidationRuleService;
  private conditionalValidator: ConditionalValidator;

  constructor(config: GeneratorConfig, webhookService?: WebhookService) {
    this.config = config;
    this.webhookService = webhookService;
    this.parser = new OpenAPIParser(undefined, webhookService);
    this.i18n = config.i18n;
    this.validationRuleService = new ValidationRuleService();
    this.conditionalValidator = new ConditionalValidator();
  }

  async generate(inputFile: string): Promise<GenerationResult> {
    if (this.config.verbose) {
      console.log(this.i18n.t('cli.parsing', { file: inputFile }));
    }

    // Parse OpenAPI specification
    const spec = await this.parser.parseFile(inputFile);
    
    if (this.config.verbose) {
      console.log(this.i18n.t('cli.parsed', { 
        title: spec.info.title, 
        version: spec.info.version 
      }));
    }

    // Ensure output directory exists
    await fs.ensureDir(this.config.outputDir);

    const generatedFiles: string[] = [];

    // Generate models
    if (this.config.generateModels) {
      if (this.config.verbose) {
        console.log(this.i18n.t('cli.generating.models'));
      }
      const modelFiles = await this.generateModels(spec);
      generatedFiles.push(...modelFiles);
    }

    // Generate controllers
    if (this.config.generateControllers) {
      if (this.config.verbose) {
        console.log(this.i18n.t('cli.generating.controllers'));
      }
      const controllerFiles = await this.generateControllers(spec);
      generatedFiles.push(...controllerFiles);
    }

    // Generate build.gradle.kts
    const buildFile = await this.generateBuildFile(spec);
    generatedFiles.push(buildFile);

    // Generate validation classes if any custom validations are used
    if (this.config.includeValidation) {
      const validationFiles = await this.generateValidationClasses();
      generatedFiles.push(...validationFiles);
    }

    const result = {
      outputDir: this.config.outputDir,
      fileCount: generatedFiles.length,
      generatedFiles
    };

    // Trigger webhook event for successful code generation
    if (this.webhookService) {
      await this.webhookService.triggerEvent({
        type: 'api.generation.completed',
        data: {
          specPath: inputFile,
          generatedFiles: generatedFiles
        }
      });
    }

    return result;
  }

  private async generateModels(spec: OpenAPISpec): Promise<string[]> {
    const schemas = await this.parser.getAllSchemas(spec);
    const schemaEntries = Object.entries(schemas);
    
    // Enable parallel processing for large numbers of schemas
    if (schemaEntries.length > 20) {
      return await this.generateModelsParallel(schemaEntries, spec);
    }
    
    const files: string[] = [];
    for (const [name, schema] of schemaEntries) {
      const kotlinClass = await this.convertSchemaToKotlinClass(name, schema, spec);
      const filePath = await this.writeKotlinClass(kotlinClass, 'model');
      files.push(filePath);
      
      if (this.config.verbose) {
        const relativePath = path.relative(this.config.outputDir, filePath);
        console.log(this.i18n.t('cli.generated.model', { name, path: relativePath }));
      }
    }

    return files;
  }

  private async generateModelsParallel(
    schemaEntries: Array<[string, OpenAPISchema]>, 
    spec: OpenAPISpec
  ): Promise<string[]> {
    const concurrency = Math.min(8, Math.max(2, Math.floor(schemaEntries.length / 10)));
    const chunks = this.chunkArray(schemaEntries, Math.ceil(schemaEntries.length / concurrency));
    
    if (this.config.verbose) {
      console.log(this.i18n.t('cli.generating.parallel', { 
        total: schemaEntries.length, 
        chunks: chunks.length,
        concurrency 
      }));
    }

    const results = await Promise.all(
      chunks.map(async (chunk, chunkIndex) => {
        const files: string[] = [];
        
        for (const [name, schema] of chunk) {
          try {
            const kotlinClass = await this.convertSchemaToKotlinClass(name, schema, spec);
            const filePath = await this.writeKotlinClass(kotlinClass, 'model');
            files.push(filePath);
            
            if (this.config.verbose) {
              const relativePath = path.relative(this.config.outputDir, filePath);
              console.log(this.i18n.t('cli.generated.model.parallel', { 
                name, 
                path: relativePath, 
                chunk: chunkIndex + 1 
              }));
            }
          } catch (error) {
            throw createGenerationError(
              `Failed to generate model ${name} in chunk ${chunkIndex + 1}`,
              ErrorCode.TEMPLATE_GENERATION_FAILED,
              ['models', name],
              { originalError: error as Error }
            );
          }
        }
        
        return files;
      })
    );

    return results.flat();
  }

  private async generateControllers(spec: OpenAPISpec): Promise<string[]> {
    const tags = this.parser.getAllTags(spec);
    const taggedOperations = this.groupOperationsByTags(spec);
    const tagsToProcess = tags.length > 0 ? tags : ['Default'];
    
    // Enable parallel processing for multiple controllers
    if (tagsToProcess.length > 3) {
      return await this.generateControllersParallel(tagsToProcess, taggedOperations, spec);
    }
    
    const files: string[] = [];
    for (const tag of tagsToProcess) {
      const operations = taggedOperations[tag] || [];
      if (operations.length === 0) continue;

      const kotlinController = await this.convertOperationsToKotlinController(tag, operations, spec);
      const filePath = await this.writeKotlinController(kotlinController);
      files.push(filePath);
      
      if (this.config.verbose) {
        const relativePath = path.relative(this.config.outputDir, filePath);
        console.log(this.i18n.t('cli.generated.controller', { name: kotlinController.name, path: relativePath }));
      }
    }

    return files;
  }

  private async generateControllersParallel(
    tags: string[],
    taggedOperations: Record<string, Array<{ path: string; method: string; operation: OpenAPIOperation }>>,
    spec: OpenAPISpec
  ): Promise<string[]> {
    const concurrency = Math.min(4, tags.length);
    
    if (this.config.verbose) {
      console.log(this.i18n.t('cli.generating.controllers.parallel', { 
        total: tags.length, 
        concurrency 
      }));
    }

    const results = await Promise.all(
      tags.map(async (tag) => {
        const operations = taggedOperations[tag] || [];
        if (operations.length === 0) return null;

        try {
          const kotlinController = await this.convertOperationsToKotlinController(tag, operations, spec);
          const filePath = await this.writeKotlinController(kotlinController);
          
          if (this.config.verbose) {
            const relativePath = path.relative(this.config.outputDir, filePath);
            console.log(this.i18n.t('cli.generated.controller.parallel', { 
              name: kotlinController.name, 
              path: relativePath, 
              tag 
            }));
          }
          
          return filePath;
        } catch (error) {
          throw createGenerationError(
            `Failed to generate controller for tag ${tag}`,
            ErrorCode.TEMPLATE_GENERATION_FAILED,
            ['controllers', tag],
            { originalError: error as Error }
          );
        }
      })
    );

    return results.filter((file): file is string => file !== null);
  }

  private groupOperationsByTags(spec: OpenAPISpec): Record<string, Array<{ path: string; method: string; operation: OpenAPIOperation }>> {
    const taggedOperations: Record<string, Array<{ path: string; method: string; operation: OpenAPIOperation }>> = {};

    for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']) {
        const operation = (pathItem as any)[method] as OpenAPIOperation | undefined;
        if (!operation) continue;

        const tags = operation.tags && operation.tags.length > 0 ? operation.tags : ['Default'];
        
        for (const tag of tags) {
          if (!taggedOperations[tag]) {
            taggedOperations[tag] = [];
          }
          taggedOperations[tag].push({ path: pathStr, method, operation });
        }
      }
    }

    return taggedOperations;
  }

  private async convertSchemaToKotlinClass(name: string, schema: OpenAPISchema, spec: OpenAPISpec): Promise<KotlinClass> {
    // Resolve allOf and other schema compositions first
    const resolvedSchema = await this.parser.resolveSchema(spec, schema);
    
    // Handle oneOf schemas as sealed classes
    if (resolvedSchema.oneOfVariants) {
      return await this.convertOneOfToSealedClass(name, resolvedSchema, spec);
    }
    
    // Handle anyOf schemas as union types
    if (resolvedSchema.anyOfVariants) {
      return await this.convertAnyOfToUnionType(name, resolvedSchema, spec);
    }
    
    const kotlinClass: KotlinClass = {
      name: this.pascalCase(name),
      packageName: `${this.config.basePackage}.model`,
      description: resolvedSchema.description,
      properties: [],
      imports: new Set([
        'javax.validation.constraints.*',
        'javax.validation.Valid',
        'io.swagger.v3.oas.annotations.media.Schema',
        'com.fasterxml.jackson.annotation.JsonProperty'
      ])
    };

    if (resolvedSchema.type === 'object' && resolvedSchema.properties) {
      for (const [propName, propSchema] of Object.entries(resolvedSchema.properties)) {
        const propResolvedSchema = this.parser.isReference(propSchema) 
          ? await this.parser.resolveReference(spec, propSchema)
          : propSchema;
        
        const property = await this.convertSchemaToKotlinProperty(propName, propResolvedSchema, resolvedSchema.required || [], spec, [name], resolvedSchema);
        kotlinClass.properties.push(property);
        
        // Add imports for property types
        this.addImportsForType(property.type, kotlinClass.imports);
        
        // Add imports for validation annotations
        this.addValidationImports(property.validation, kotlinClass.imports);
      }
    }

    return kotlinClass;
  }

  private async convertOneOfToSealedClass(name: string, schema: OpenAPISchema, spec: OpenAPISpec): Promise<KotlinClass> {
    const kotlinClass: KotlinClass = {
      name: this.pascalCase(name),
      packageName: `${this.config.basePackage}.model`,
      description: schema.description,
      properties: [],
      imports: new Set([
        'javax.validation.constraints.*',
        'javax.validation.Valid',
        'io.swagger.v3.oas.annotations.media.Schema',
        'com.fasterxml.jackson.annotation.JsonProperty',
        'com.fasterxml.jackson.annotation.JsonSubTypes',
        'com.fasterxml.jackson.annotation.JsonTypeInfo'
      ]),
      isSealed: true,
      sealedSubTypes: []
    };

    // Add base properties (common to all variants)
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propResolvedSchema = this.parser.isReference(propSchema) 
          ? await this.parser.resolveReference(spec, propSchema)
          : propSchema;
        
        const property = await this.convertSchemaToKotlinProperty(propName, propResolvedSchema, schema.required || [], spec, [name], schema);
        kotlinClass.properties.push(property);
        
        // Add imports for property types
        this.addImportsForType(property.type, kotlinClass.imports);
        
        // Add imports for validation annotations
        this.addValidationImports(property.validation, kotlinClass.imports);
      }
    }

    // Convert oneOf variants to sealed subclasses
    if (schema.oneOfVariants) {
      for (const variant of schema.oneOfVariants) {
        const subClassName = this.pascalCase(variant.name);
        const subClass: KotlinClass = {
          name: subClassName,
          packageName: kotlinClass.packageName,
          description: variant.schema.description,
          properties: [],
          imports: new Set(kotlinClass.imports),
          parentClass: kotlinClass.name
        };

        // Add variant-specific properties
        if (variant.schema.properties) {
          for (const [propName, propSchema] of Object.entries(variant.schema.properties)) {
            // Skip discriminator property if it's already in base class
            if (schema.discriminator && propName === schema.discriminator.propertyName) {
              continue;
            }
            
            const propResolvedSchema = this.parser.isReference(propSchema) 
              ? await this.parser.resolveReference(spec, propSchema)
              : propSchema;
            
            const property = await this.convertSchemaToKotlinProperty(propName, propResolvedSchema, variant.schema.required || [], spec, [name, 'sealedSubTypes', subClassName], variant.schema);
            subClass.properties.push(property);
            
            // Add imports for property types
            this.addImportsForType(property.type, subClass.imports);
            
            // Add imports for validation annotations
            this.addValidationImports(property.validation, subClass.imports);
          }
        }

        kotlinClass.sealedSubTypes?.push(subClass);
      }
    }

    return kotlinClass;
  }

  private async convertAnyOfToUnionType(name: string, schema: OpenAPISchema, spec: OpenAPISpec): Promise<KotlinClass> {
    const kotlinClass: KotlinClass = {
      name: this.pascalCase(name),
      packageName: `${this.config.basePackage}.model`,
      description: schema.description,
      properties: [],
      imports: new Set([
        'javax.validation.constraints.*',
        'javax.validation.Valid',
        'io.swagger.v3.oas.annotations.media.Schema',
        'com.fasterxml.jackson.annotation.JsonProperty',
        'com.fasterxml.jackson.annotation.JsonValue',
        'com.fasterxml.jackson.annotation.JsonCreator'
      ])
    };

    // For anyOf, we create a wrapper class that can hold any of the variant types
    // This is represented as a data class with a generic value property and type indicator
    
    // Add a value property that can hold the actual data
    const valueProperty: KotlinProperty = {
      name: 'value',
      type: 'Any',
      nullable: false,
      description: 'The actual value that matches one or more of the anyOf variants',
      validation: ['@JsonValue'],
      jsonProperty: undefined,
      defaultValue: undefined
    };
    kotlinClass.properties.push(valueProperty);

    // Add a type property to indicate which variant types are satisfied
    const typeProperty: KotlinProperty = {
      name: 'supportedTypes',
      type: 'Set<String>',
      nullable: false,
      description: 'Set of type names that this value satisfies',
      validation: [],
      jsonProperty: undefined,
      defaultValue: 'emptySet()'
    };
    kotlinClass.properties.push(typeProperty);

    // Add companion object with factory methods for each variant
    if (schema.anyOfVariants) {
      const companionMethods: string[] = [];
      for (const variant of schema.anyOfVariants) {
        const methodName = `from${this.pascalCase(variant.name)}`;
        const paramType = await this.mapSchemaToKotlinType(variant.schema, spec, [name, 'anyOfVariants', variant.name]);
        companionMethods.push(`    companion object {
        @JsonCreator
        @JvmStatic
        fun ${methodName}(value: ${paramType}): ${kotlinClass.name} {
            return ${kotlinClass.name}(value, setOf("${variant.name}"))
        }
    }`);
      }
      const companionMethodsString = companionMethods.join('\n\n');
      
      // Store companion methods for template generation
      (kotlinClass as any).companionMethods = companionMethodsString;
    }

    return kotlinClass;
  }

  private async convertSchemaToKotlinProperty(name: string, schema: OpenAPISchema, required: string[], spec: OpenAPISpec, schemaPath: string[] = [], parentSchema?: OpenAPISchema): Promise<KotlinProperty> {
    // Validate property name
    if (!name || name.trim() === '') {
      throw createGenerationError(
        'Property name cannot be empty',
        ErrorCode.INVALID_PROPERTY_NAME,
        [...schemaPath, 'properties', name]
      );
    }

    // Check for invalid Kotlin identifiers
    const invalidKotlinNames = ['class', 'object', 'interface', 'fun', 'var', 'val', 'if', 'else', 'when', 'for', 'while', 'do', 'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue'];
    const kotlinName = this.camelCase(name);
    
    if (invalidKotlinNames.includes(kotlinName)) {
      throw createGenerationError(
        `Property name '${name}' conflicts with Kotlin keyword`,
        ErrorCode.INVALID_PROPERTY_NAME,
        [...schemaPath, 'properties', name],
        {
          suggestion: `Rename the property '${name}' to avoid conflict with Kotlin keywords`
        }
      );
    }

    const isRequired = required.includes(name);
    const nullable = schema.nullable === true || !isRequired;
    
    let propertyType: string;
    try {
      propertyType = await this.mapSchemaToKotlinType(schema, spec, [...schemaPath, 'properties', name]);
    } catch (error) {
      throw createGenerationError(
        `Failed to determine type for property '${name}'`,
        ErrorCode.UNSUPPORTED_SCHEMA_TYPE,
        [...schemaPath, 'properties', name],
        { originalError: error as Error }
      );
    }
    
    const property: KotlinProperty = {
      name: kotlinName,
      type: propertyType,
      nullable,
      description: schema.description,
      validation: [],
      jsonProperty: kotlinName !== name ? name : undefined
    };

    // Add default value
    if (schema.default !== undefined) {
      try {
        property.defaultValue = this.formatDefaultValue(schema.default, property.type);
      } catch (error) {
        throw createGenerationError(
          `Failed to format default value for property '${name}'`,
          ErrorCode.TEMPLATE_GENERATION_FAILED,
          [...schemaPath, 'properties', name, 'default'],
          { originalError: error as Error }
        );
      }
    } else if (nullable) {
      property.defaultValue = 'null';
    }

    // Add validation annotations
    if (this.config.includeValidation) {
      try {
        property.validation = this.generateValidationAnnotations(schema, isRequired, parentSchema);
      } catch (error) {
        throw createGenerationError(
          `Failed to generate validation annotations for property '${name}'`,
          ErrorCode.TEMPLATE_GENERATION_FAILED,
          [...schemaPath, 'properties', name],
          { originalError: error as Error }
        );
      }
    }

    return property;
  }

  private async mapSchemaToKotlinType(schema: OpenAPISchema, spec: OpenAPISpec, schemaPath: string[] = []): Promise<string> {
    if (this.parser.isReference(schema)) {
      const refName = this.parser.extractSchemaName((schema as any).$ref);
      return this.pascalCase(refName);
    }

    // Handle schema composition patterns
    if (schema.allOf) {
      // For allOf, try to find the first schema with a type, or resolve references
      for (const subSchema of schema.allOf) {
        try {
          const resolved = await this.parser.resolveSchema(spec, subSchema);
          if (resolved.type || this.parser.isReference(subSchema)) {
            return await this.mapSchemaToKotlinType(resolved, spec, [...schemaPath, 'allOf']);
          }
        } catch (error) {
          // Continue to next schema if resolution fails
          continue;
        }
      }
      // For allOf, generate a class name based on the schema path
      if (schemaPath.length > 0) {
        const className = this.pascalCase(schemaPath[schemaPath.length - 1]);
        return className;
      }
      // Fallback to Any if no type can be determined
      return 'Any';
    }

    if (schema.oneOf) {
      // For oneOf, try to find a common base type or generate a sealed class name
      if (schema.oneOf.length > 0) {
        try {
          const firstSchema = await this.parser.resolveSchema(spec, schema.oneOf[0]);
          return await this.mapSchemaToKotlinType(firstSchema, spec, [...schemaPath, 'oneOf']);
        } catch (error) {
          // If first schema fails, try generating a sealed class name based on path
          if (schemaPath.length > 0) {
            const className = this.pascalCase(schemaPath[schemaPath.length - 1]);
            return className;
          }
        }
      }
      return 'Any';
    }

    if (schema.anyOf) {
      // For anyOf, try to find a common base type or generate a union wrapper class name
      if (schema.anyOf.length > 0) {
        try {
          const firstSchema = await this.parser.resolveSchema(spec, schema.anyOf[0]);
          return await this.mapSchemaToKotlinType(firstSchema, spec, [...schemaPath, 'anyOf']);
        } catch (error) {
          // If first schema fails, try generating a union wrapper class name based on path
          if (schemaPath.length > 0) {
            const className = this.pascalCase(schemaPath[schemaPath.length - 1]);
            return className;
          }
        }
      }
      return 'Any';
    }

    if (!schema.type) {
      // Handle schemas with properties but no explicit type (assume object)
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        schema.type = 'object';
      }
      // If no type is specified but there's a description or other properties, default to 'Any'
      // This handles cases where OpenAPI schemas are incomplete but still usable
      else if (schema.description || schema.example || schema.default !== undefined) {
        return 'Any';
      }
      // If it's an empty schema, default to Any
      else if (Object.keys(schema).length === 0) {
        return 'Any';
      }
      else {
        throw createGenerationError(
          `Schema missing type information at path: ${schemaPath.join('.')}. Available keys: ${Object.keys(schema).join(', ')}`,
          ErrorCode.UNSUPPORTED_SCHEMA_TYPE,
          schemaPath,
          {
            suggestion: 'Ensure all schemas have a valid type property (string, number, integer, boolean, array, object) or use schema composition (allOf, oneOf, anyOf)'
          }
        );
      }
    }

    switch (schema.type) {
      case 'string':
        switch (schema.format) {
          case 'date': return 'java.time.LocalDate';
          case 'date-time': return 'java.time.OffsetDateTime';
          case 'uuid': return 'java.util.UUID';
          case 'uri': return 'java.net.URI';
          case 'byte':
          case 'binary': return 'ByteArray';
          default: return 'String';
        }
      case 'integer':
        return schema.format === 'int64' ? 'Long' : 'Int';
      case 'number':
        switch (schema.format) {
          case 'float': return 'Float';
          case 'double': return 'Double';
          default: return 'java.math.BigDecimal';
        }
      case 'boolean':
        return 'Boolean';
      case 'array':
        if (schema.items) {
          try {
            const itemType = await this.mapSchemaToKotlinType(
              await this.parser.resolveSchema(spec, schema.items), 
              spec,
              [...schemaPath, 'items']
            );
            return `List<${itemType}>`;
          } catch (error) {
            throw createGenerationError(
              `Failed to resolve array item type`,
              ErrorCode.UNSUPPORTED_SCHEMA_TYPE,
              [...schemaPath, 'items'],
              { originalError: error as Error }
            );
          }
        }
        return 'List<Any>';
      case 'object':
        // If object has properties, it should be a proper class, not a Map
        if (schema.properties && Object.keys(schema.properties).length > 0) {
          // Generate a class name based on the schema path
          const className = schemaPath.length > 0 
            ? this.pascalCase(schemaPath[schemaPath.length - 1]) 
            : 'DynamicObject';
          return className;
        }
        return 'Map<String, Any>';
      default:
        throw createGenerationError(
          `Unsupported schema type: ${schema.type}`,
          ErrorCode.UNSUPPORTED_SCHEMA_TYPE,
          schemaPath,
          {
            suggestion: 'Use one of the supported OpenAPI schema types: string, number, integer, boolean, array, object'
          }
        );
    }
  }

  private generateValidationAnnotations(schema: OpenAPISchema, required: boolean, contextSchema?: OpenAPISchema): string[] {
    const schemaWithValidation = schema as OpenAPISchemaWithValidation;
    
    // Use the enhanced validation utilities to generate annotations
    const { annotations, imports } = ValidationUtils.generateAllValidationAnnotations(
      schemaWithValidation, 
      this.validationRuleService
    );
    // Traditional Bean Validation annotations (for backward compatibility)
    const traditionalAnnotations: string[] = [];

    if (required && schema.nullable !== true) {
      traditionalAnnotations.push('@NotNull');
    }

    if (schema.type === 'string') {
      // Check for custom email validation vs standard email
      if (schema.format === 'email') {
        // Check if unique email validation is requested
        if (schemaWithValidation['x-validation']?.customValidations?.includes('EmailUnique')) {
          traditionalAnnotations.push('@UniqueEmail');
        } else {
          traditionalAnnotations.push('@Email');
        }
      }
      
      // Check for custom password validation
      if (schema.format === 'password') {
        if (schemaWithValidation['x-validation']?.customValidations?.includes('StrongPassword')) {
          traditionalAnnotations.push('@StrongPassword');
        }
      }
      
      // Check for custom phone validation
      if (schema.format === 'phone') {
        if (schemaWithValidation['x-validation']?.customValidations?.includes('PhoneNumber')) {
          traditionalAnnotations.push('@PhoneNumber');
        }
      }
      
      if (schema.minLength !== undefined || schema.maxLength !== undefined) {
        const min = schema.minLength ?? 0;
        const max = schema.maxLength ?? 'Integer.MAX_VALUE';
        traditionalAnnotations.push(`@Size(min = ${min}, max = ${max})`);
      }
      if (schema.pattern) {
        traditionalAnnotations.push(`@Pattern(regexp = "${schema.pattern}")`);
      }
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined) {
        traditionalAnnotations.push(`@Min(${schema.minimum})`);
      }
      if (schema.maximum !== undefined) {
        traditionalAnnotations.push(`@Max(${schema.maximum})`);
      }
    }

    if (schema.type === 'array') {
      if (schema.minItems !== undefined || schema.maxItems !== undefined) {
        const min = schema.minItems ?? 0;
        const max = schema.maxItems ?? 'Integer.MAX_VALUE';
        traditionalAnnotations.push(`@Size(min = ${min}, max = ${max})`);
      }
    }

    if (schema.type === 'object' || (schema.type === undefined && schema.properties)) {
      traditionalAnnotations.push('@Valid');
    }

    // Process conditional validation if x-validation extensions are present
    const xValidation = schemaWithValidation['x-validation'];
    if (xValidation && contextSchema) {
      const conditionalAnnotations = this.generateConditionalValidationAnnotations(
        schema, 
        xValidation, 
        contextSchema
      );
      traditionalAnnotations.push(...conditionalAnnotations);
    }

    // Combine enhanced and traditional annotations, removing duplicates
    const allAnnotations = [...new Set([...annotations, ...traditionalAnnotations])];
    
    return allAnnotations;
  }

  private generateConditionalValidationAnnotations(
    schema: OpenAPISchema, 
    xValidation: any, 
    contextSchema: OpenAPISchema
  ): string[] {
    const annotations: string[] = [];

    // Process conditional validation rules
    if (xValidation.conditionalRules) {
      for (const rule of xValidation.conditionalRules) {
        const annotation = this.convertConditionalRuleToAnnotation(rule);
        if (annotation) {
          annotations.push(annotation);
        }
      }
    }

    // Process cross-field validations
    if (xValidation.crossFieldValidations) {
      for (const crossField of xValidation.crossFieldValidations) {
        const annotation = this.convertCrossFieldValidationToAnnotation(crossField);
        if (annotation) {
          annotations.push(annotation);
        }
      }
    }

    return annotations;
  }

  private convertConditionalRuleToAnnotation(rule: any): string | null {
    // Convert conditional rule to corresponding validation annotation
    switch (rule.type) {
      case 'conditional_required':
        return `@ConditionallyRequired(condition = "${rule.condition}")`;
      case 'conditional_pattern':
        return `@ConditionalPattern(condition = "${rule.condition}", pattern = "${rule.pattern}")`;
      case 'conditional_size':
        return `@ConditionalSize(condition = "${rule.condition}", min = ${rule.min || 0}, max = ${rule.max || 'Integer.MAX_VALUE'})`;
      default:
        return null;
    }
  }

  private convertCrossFieldValidationToAnnotation(crossField: any): string | null {
    // Convert cross-field validation to corresponding annotation
    switch (crossField.type) {
      case 'field_equality':
        return `@FieldsEqual(fields = {${crossField.fields.map((f: string) => `"${f}"`).join(', ')}})`;
      case 'field_dependency':
        return `@FieldDependency(dependentField = "${crossField.dependentField}", dependsOn = "${crossField.dependsOn}")`;
      default:
        return null;
    }
  }

  private async convertOperationsToKotlinController(
    tag: string, 
    operations: Array<{ path: string; method: string; operation: OpenAPIOperation }>,
    spec: OpenAPISpec
  ): Promise<KotlinController> {
    const controllerName = `${this.pascalCase(tag)}Controller`;
    
    const kotlinController: KotlinController = {
      name: controllerName,
      packageName: `${this.config.basePackage}.controller`,
      description: `${this.pascalCase(tag)} API controller interface`,
      methods: [],
      imports: new Set([
        'org.springframework.http.ResponseEntity',
        'org.springframework.web.bind.annotation.*',
        'javax.validation.Valid',
        'javax.validation.constraints.*'
      ])
    };

    if (this.config.includeSwagger) {
      kotlinController.imports.add('io.swagger.v3.oas.annotations.Operation');
      kotlinController.imports.add('io.swagger.v3.oas.annotations.responses.ApiResponse');
      kotlinController.imports.add('io.swagger.v3.oas.annotations.responses.ApiResponses');
    }

    for (const { path, method, operation } of operations) {
      const kotlinMethod = await this.convertOperationToKotlinMethod(path, method, operation, spec);
      kotlinController.methods.push(kotlinMethod);
      
      // Add imports for method types
      this.addImportsForType(kotlinMethod.returnType, kotlinController.imports);
      for (const param of kotlinMethod.parameters) {
        this.addImportsForType(param.type, kotlinController.imports);
      }
      if (kotlinMethod.requestBody) {
        this.addImportsForType(kotlinMethod.requestBody.type, kotlinController.imports);
      }
    }

    return kotlinController;
  }

  private async convertOperationToKotlinMethod(
    path: string, 
    httpMethod: string, 
    operation: OpenAPIOperation, 
    spec: OpenAPISpec
  ): Promise<KotlinMethod> {
    const methodName = operation.operationId || this.generateMethodName(httpMethod, path);
    
    const kotlinMethod: KotlinMethod = {
      name: this.camelCase(methodName),
      httpMethod: httpMethod.toLowerCase(),
      path,
      summary: operation.summary,
      description: operation.description,
      parameters: [],
      returnType: await this.determineReturnType(operation, spec),
      responseDescription: this.getResponseDescription(operation)
    };

    // Process parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (!this.parser.isReference(param)) {
          const kotlinParam = await this.convertParameterToKotlin(param as OpenAPIParameter, spec);
          kotlinMethod.parameters.push(kotlinParam);
        }
      }
    }

    // Process request body
    if (operation.requestBody && !this.parser.isReference(operation.requestBody)) {
      const requestBody = operation.requestBody;
      if (requestBody.content) {
        const mediaType = requestBody.content['application/json'];
        if (mediaType?.schema) {
          const schema = await this.parser.resolveSchema(spec, mediaType.schema);
          const bodyParam: KotlinParameter = {
            name: 'body',
            type: await this.mapSchemaToKotlinType(schema, spec, ['requestBody', 'content', 'application/json', 'schema']),
            paramType: 'body',
            required: requestBody.required !== false,
            description: requestBody.description,
            validation: this.config.includeValidation ? ['@Valid'] : []
          };
          kotlinMethod.requestBody = bodyParam;
        }
      }
    }

    return kotlinMethod;
  }

  private async convertParameterToKotlin(param: OpenAPIParameter, spec: OpenAPISpec): Promise<KotlinParameter> {
    const schema = param.schema ? await this.parser.resolveSchema(spec, param.schema) : { type: 'string' as const };
    
    return {
      name: this.camelCase(param.name),
      type: await this.mapSchemaToKotlinType(schema, spec, ['parameters', param.name, 'schema']),
      paramType: param.in as 'path' | 'query' | 'header',
      required: param.required === true,
      description: param.description,
      validation: this.config.includeValidation ? this.generateValidationAnnotations(schema, param.required === true, undefined) : []
    };
  }

  private generateMethodName(httpMethod: string, path: string): string {
    const segments = path.split('/').filter(s => s && !s.startsWith('{'));
    const resource = segments[segments.length - 1] || 'resource';
    
    const methodPrefix = {
      'get': 'get',
      'post': 'create',
      'put': 'update',
      'delete': 'delete',
      'patch': 'patch'
    }[httpMethod.toLowerCase()] || httpMethod.toLowerCase();
    
    return `${methodPrefix}${this.pascalCase(resource)}`;
  }

  private async determineReturnType(operation: OpenAPIOperation, spec: OpenAPISpec): Promise<string> {
    const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
    
    if (successResponse && !this.parser.isReference(successResponse)) {
      const response = successResponse;
      if (response.content) {
        const mediaType = response.content['application/json'];
        if (mediaType?.schema) {
          const schema = await this.parser.resolveSchema(spec, mediaType.schema);
          const innerType = await this.mapSchemaToKotlinType(schema, spec, ['responses', '200', 'content', 'application/json', 'schema']);
          return `ResponseEntity<${innerType}>`;
        }
      }
    }
    
    return 'ResponseEntity<Any>';
  }

  private getResponseDescription(operation: OpenAPIOperation): string {
    const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
    
    if (successResponse && !this.parser.isReference(successResponse)) {
      return successResponse.description || 'Success';
    }
    
    return 'Success';
  }

  private async writeKotlinClass(kotlinClass: KotlinClass, subDir: string): Promise<string> {
    try {
      const content = this.generateKotlinClassContent(kotlinClass);
      const fileName = `${kotlinClass.name}.kt`;
      const outputDir = path.join(this.config.outputDir, 'src/main/kotlin', ...kotlinClass.packageName.split('.'), subDir);
      const filePath = path.join(outputDir, fileName);
      
      await fs.ensureDir(outputDir);
      await fs.writeFile(filePath, content, 'utf-8');
      
      return filePath;
    } catch (error) {
      throw createGenerationError(
        `Failed to write Kotlin class file for '${kotlinClass.name}'`,
        ErrorCode.TEMPLATE_GENERATION_FAILED,
        ['writeFile', kotlinClass.name],
        { originalError: error as Error }
      );
    }
  }

  private async writeKotlinController(kotlinController: KotlinController): Promise<string> {
    try {
      const content = this.generateKotlinControllerContent(kotlinController);
      const fileName = `${kotlinController.name}.kt`;
      const outputDir = path.join(this.config.outputDir, 'src/main/kotlin', ...kotlinController.packageName.split('.'));
      const filePath = path.join(outputDir, fileName);
      
      await fs.ensureDir(outputDir);
      await fs.writeFile(filePath, content, 'utf-8');
      
      return filePath;
    } catch (error) {
      throw createGenerationError(
        `Failed to write Kotlin controller file for '${kotlinController.name}'`,
        ErrorCode.TEMPLATE_GENERATION_FAILED,
        ['writeFile', kotlinController.name],
        { originalError: error as Error }
      );
    }
  }

  private generateKotlinClassContent(kotlinClass: KotlinClass): string {
    const imports = Array.from(kotlinClass.imports).sort();
    
    let content = `package ${kotlinClass.packageName}\n\n`;
    
    if (imports.length > 0) {
      content += imports.map(imp => `import ${imp}`).join('\n');
      content += '\n\n';
    }
    
    if (kotlinClass.description) {
      content += `/**\n * ${kotlinClass.description}\n */\n`;
    }
    
    if (this.config.includeSwagger) {
      content += `@Schema(description = "${kotlinClass.description || kotlinClass.name}")\n`;
    }

    // Handle sealed classes
    if (kotlinClass.isSealed) {
      content += this.generateSealedClassContent(kotlinClass);
    } else {
      content += this.generateDataClassContent(kotlinClass);
    }
    
    return content;
  }

  private generateSealedClassContent(kotlinClass: KotlinClass): string {
    let content = '';
    
    // Add Jackson annotations for polymorphic deserialization
    if (kotlinClass.sealedSubTypes && kotlinClass.sealedSubTypes.length > 0) {
      content += '@JsonTypeInfo(\n';
      content += '    use = JsonTypeInfo.Id.NAME,\n';
      content += '    include = JsonTypeInfo.As.PROPERTY,\n';
      content += '    property = "type"\n';
      content += ')\n';
      content += '@JsonSubTypes(\n';
      
      const subTypes = kotlinClass.sealedSubTypes.map(subType => 
        `    JsonSubTypes.Type(value = ${subType.name}::class, name = "${subType.name.toLowerCase()}")`
      ).join(',\n');
      
      content += subTypes + '\n';
      content += ')\n';
    }
    
    content += `sealed class ${kotlinClass.name}`;
    
    // Add constructor parameters if any
    if (kotlinClass.properties.length > 0) {
      content += '(\n';
      for (let i = 0; i < kotlinClass.properties.length; i++) {
        const prop = kotlinClass.properties[i];
        content += this.generatePropertyContent(prop, i === kotlinClass.properties.length - 1);
      }
      content += ')';
    }
    
    content += ' {\n';
    
    // Generate sealed subclasses
    if (kotlinClass.sealedSubTypes) {
      for (const subType of kotlinClass.sealedSubTypes) {
        content += '\n';
        if (subType.description) {
          content += `    /**\n     * ${subType.description}\n     */\n`;
        }
        if (this.config.includeSwagger) {
          content += `    @Schema(description = "${subType.description || subType.name}")\n`;
        }
        content += `    data class ${subType.name}(\n`;
        
        // Include parent properties first
        for (let i = 0; i < kotlinClass.properties.length; i++) {
          const prop = kotlinClass.properties[i];
          content += `        override ${this.generatePropertySignature(prop)},\n`;
        }
        
        // Add subtype-specific properties
        for (let i = 0; i < subType.properties.length; i++) {
          const prop = subType.properties[i];
          const isLast = i === subType.properties.length - 1;
          content += this.generatePropertyContent(prop, isLast, '        ');
        }
        
        content += `    ) : ${kotlinClass.name}(`;
        const parentArgs = kotlinClass.properties.map(prop => prop.name).join(', ');
        content += parentArgs + ')\n';
      }
    }
    
    content += '}\n';
    
    return content;
  }

  private generateDataClassContent(kotlinClass: KotlinClass): string {
    let content = `data class ${kotlinClass.name}`;
    
    if (kotlinClass.parentClass) {
      content += ` : ${kotlinClass.parentClass}()`;
    }
    
    content += '(\n';
    
    for (let i = 0; i < kotlinClass.properties.length; i++) {
      const prop = kotlinClass.properties[i];
      content += this.generatePropertyContent(prop, i === kotlinClass.properties.length - 1);
    }
    
    content += ')';
    
    return content;
  }

  private generatePropertySignature(prop: KotlinProperty): string {
    const nullableSuffix = prop.nullable ? '?' : '';
    return `val ${prop.name}: ${prop.type}${nullableSuffix}`;
  }

  private generatePropertyContent(prop: KotlinProperty, isLast: boolean, indent: string = '    '): string {
    let content = '';
    
    if (prop.description) {
      content += `${indent}/**\n${indent} * ${prop.description}\n${indent} */\n`;
    }
    
    if (this.config.includeSwagger) {
      content += `${indent}@Schema(description = "${prop.description || prop.name}"`;
      if (prop.defaultValue && prop.defaultValue !== 'null') {
        content += `, example = "${prop.defaultValue}"`;
      }
      content += ')\n';
    }
    
    if (prop.jsonProperty) {
      content += `${indent}@JsonProperty("${prop.jsonProperty}")\n`;
    }
    
    for (const validation of prop.validation) {
      content += `${indent}${validation}\n`;
    }
    
    const nullableSuffix = prop.nullable ? '?' : '';
    const defaultSuffix = prop.defaultValue ? ` = ${prop.defaultValue}` : '';
    
    content += `${indent}val ${prop.name}: ${prop.type}${nullableSuffix}${defaultSuffix}`;
    
    if (!isLast) {
      content += ',';
    }
    
    content += '\n';
    
    return content;
  }

  private generateKotlinControllerContent(kotlinController: KotlinController): string {
    const imports = Array.from(kotlinController.imports).sort();
    
    let content = `package ${kotlinController.packageName}\n\n`;
    
    if (imports.length > 0) {
      content += imports.map(imp => `import ${imp}`).join('\n');
      content += '\n\n';
    }
    
    if (kotlinController.description) {
      content += `/**\n * ${kotlinController.description}\n */\n`;
    }
    
    content += `interface ${kotlinController.name} {\n\n`;
    
    for (const method of kotlinController.methods) {
      content += this.generateMethodContent(method);
      content += '\n';
    }
    
    content += '}\n';
    
    return content;
  }

  private generateMethodContent(method: KotlinMethod): string {
    let content = '';
    
    if (this.config.includeSwagger && (method.summary || method.description)) {
      content += `    @Operation(summary = "${method.summary || method.name}"`;
      if (method.description) {
        content += `, description = "${method.description}"`;
      }
      content += ')\n';
      
      content += `    @ApiResponses(value = [\n`;
      content += `        ApiResponse(responseCode = "200", description = "${method.responseDescription || 'Success'}"),\n`;
      content += `        ApiResponse(responseCode = "400", description = "Bad Request")\n`;
      content += `    ])\n`;
    }
    
    const httpAnnotation = this.getHttpAnnotation(method.httpMethod);
    content += `    @${httpAnnotation}("${method.path}")\n`;
    
    content += `    fun ${method.name}(\n`;
    
    // Add parameters
    const allParams = [...method.parameters];
    if (method.requestBody) {
      allParams.push(method.requestBody);
    }
    
    for (let i = 0; i < allParams.length; i++) {
      const param = allParams[i];
      content += this.generateParameterContent(param, i === allParams.length - 1);
    }
    
    content += `    ): ${method.returnType}\n`;
    
    return content;
  }

  private generateParameterContent(param: KotlinParameter, isLast: boolean): string {
    let content = '';
    
    for (const validation of param.validation) {
      content += `        ${validation} `;
    }
    
    const annotation = this.getParameterAnnotation(param);
    content += `${annotation} ${param.name}: ${param.type}`;
    
    if (!param.required && param.paramType !== 'body') {
      content += '?';
    }
    
    if (!isLast) {
      content += ',';
    }
    
    content += '\n';
    
    return content;
  }

  private getHttpAnnotation(method: string): string {
    const mapping = {
      'get': 'GetMapping',
      'post': 'PostMapping',
      'put': 'PutMapping',
      'delete': 'DeleteMapping',
      'patch': 'PatchMapping',
      'head': 'HeadMapping',
      'options': 'OptionsMapping'
    };
    
    return mapping[method as keyof typeof mapping] || 'RequestMapping';
  }

  private getParameterAnnotation(param: KotlinParameter): string {
    switch (param.paramType) {
      case 'path':
        return '@PathVariable';
      case 'query':
        return `@RequestParam(required = ${param.required})`;
      case 'header':
        return `@RequestHeader(required = ${param.required})`;
      case 'body':
        return '@RequestBody';
      default:
        return '@RequestParam';
    }
  }

  private async generateBuildFile(spec: OpenAPISpec): Promise<string> {
    const content = this.generateBuildFileContent(spec);
    const filePath = path.join(this.config.outputDir, 'build.gradle.kts');
    
    await fs.writeFile(filePath, content, 'utf-8');
    
    if (this.config.verbose) {
      const relativePath = path.relative(this.config.outputDir, filePath);
      console.log(this.i18n.t('cli.generated.buildFile', { path: relativePath }));
    }
    
    return filePath;
  }

  private generateBuildFileContent(spec: OpenAPISpec): string {
    const groupId = this.config.basePackage;
    
    return `plugins {
    kotlin("jvm") version "1.9.20"
    kotlin("plugin.spring") version "1.9.20"
    id("org.springframework.boot") version "3.1.0"
    id("io.spring.dependency-management") version "1.1.0"
}

group = "${groupId}"
version = "0.0.1-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.1.0")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "17"
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
`;
  }

  private addImportsForType(type: string, imports: Set<string>): void {
    if (type.includes('java.time.LocalDate')) {
      imports.add('java.time.LocalDate');
    }
    if (type.includes('java.time.OffsetDateTime')) {
      imports.add('java.time.OffsetDateTime');
    }
    if (type.includes('java.util.UUID')) {
      imports.add('java.util.UUID');
    }
    if (type.includes('java.net.URI')) {
      imports.add('java.net.URI');
    }
    if (type.includes('java.math.BigDecimal')) {
      imports.add('java.math.BigDecimal');
    }
  }

  private async generateValidationClasses(): Promise<string[]> {
    const validationFiles: string[] = [];
    
    // Generate the custom validation annotations and validators
    const validationClasses = this.validationRuleService.getAllRules();
    
    for (const rule of validationClasses) {
      // Generate annotation class
      const annotationClass = this.generateValidationAnnotationClass(rule.name, rule);
      const annotationFilePath = await this.writeValidationClass(annotationClass, 'annotation');
      validationFiles.push(annotationFilePath);
      
      // Generate validator class
      const validatorClass = this.generateValidationValidatorClass(rule.name, rule);
      const validatorFilePath = await this.writeValidationClass(validatorClass, 'validator');
      validationFiles.push(validatorFilePath);
    }
    
    // Generate additional conditional validation classes
    const conditionalValidationFiles = await this.generateConditionalValidationClasses();
    validationFiles.push(...conditionalValidationFiles);
    
    // Generate cross-field validation classes
    const crossFieldValidationFiles = await this.generateCrossFieldValidationClasses();
    validationFiles.push(...crossFieldValidationFiles);
    
    return validationFiles;
  }

  private async generateConditionalValidationClasses(): Promise<string[]> {
    const files: string[] = [];
    
    // ConditionallyRequired annotation and validator
    const conditionallyRequiredAnnotation = {
      name: 'ConditionallyRequired',
      type: 'annotation',
      content: `package com.validation

import javax.validation.Constraint
import javax.validation.Payload
import kotlin.annotation.AnnotationRetention
import kotlin.annotation.AnnotationTarget
import kotlin.reflect.KClass

@Target(AnnotationTarget.FIELD, AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [ConditionallyRequiredValidator::class])
annotation class ConditionallyRequired(
    val message: String = "Field is required based on condition",
    val groups: Array<KClass<*>> = [],
    val payload: Array<KClass<out Payload>> = [],
    val condition: String
)`
    };
    files.push(await this.writeValidationClass(conditionallyRequiredAnnotation, 'annotation'));
    
    const conditionallyRequiredValidator = {
      name: 'ConditionallyRequiredValidator',
      type: 'validator',
      content: `package com.validation

import javax.validation.ConstraintValidator
import javax.validation.ConstraintValidatorContext

class ConditionallyRequiredValidator : ConstraintValidator<ConditionallyRequired, Any> {
    
    private lateinit var condition: String
    
    override fun initialize(constraintAnnotation: ConditionallyRequired) {
        this.condition = constraintAnnotation.condition
    }
    
    override fun isValid(value: Any?, context: ConstraintValidatorContext?): Boolean {
        // For conditional validation, we need access to the entire object
        // This would typically be implemented with a custom validator that has access to the root object
        return true // Placeholder implementation
    }
}`
    };
    files.push(await this.writeValidationClass(conditionallyRequiredValidator, 'validator'));
    
    return files;
  }

  private async generateCrossFieldValidationClasses(): Promise<string[]> {
    const files: string[] = [];
    
    // FieldsEqual annotation and validator
    const fieldsEqualAnnotation = {
      name: 'FieldsEqual',
      type: 'annotation',
      content: `package com.validation

import javax.validation.Constraint
import javax.validation.Payload
import kotlin.annotation.AnnotationRetention
import kotlin.annotation.AnnotationTarget
import kotlin.reflect.KClass

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [FieldsEqualValidator::class])
annotation class FieldsEqual(
    val message: String = "Fields must be equal",
    val groups: Array<KClass<*>> = [],
    val payload: Array<KClass<out Payload>> = [],
    val fields: Array<String>
)`
    };
    files.push(await this.writeValidationClass(fieldsEqualAnnotation, 'annotation'));
    
    const fieldsEqualValidator = {
      name: 'FieldsEqualValidator',
      type: 'validator',
      content: `package com.validation

import javax.validation.ConstraintValidator
import javax.validation.ConstraintValidatorContext
import kotlin.reflect.full.memberProperties

class FieldsEqualValidator : ConstraintValidator<FieldsEqual, Any> {
    
    private lateinit var fields: Array<String>
    
    override fun initialize(constraintAnnotation: FieldsEqual) {
        this.fields = constraintAnnotation.fields
    }
    
    override fun isValid(value: Any?, context: ConstraintValidatorContext?): Boolean {
        if (value == null || fields.size < 2) return true
        
        val properties = value::class.memberProperties
        val values = fields.mapNotNull { fieldName ->
            properties.find { it.name == fieldName }?.getter?.call(value)
        }
        
        return values.all { it == values.first() }
    }
}`
    };
    files.push(await this.writeValidationClass(fieldsEqualValidator, 'validator'));
    
    // FieldDependency annotation and validator
    const fieldDependencyAnnotation = {
      name: 'FieldDependency',
      type: 'annotation',
      content: `package com.validation

import javax.validation.Constraint
import javax.validation.Payload
import kotlin.annotation.AnnotationRetention
import kotlin.annotation.AnnotationTarget
import kotlin.reflect.KClass

@Target(AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [FieldDependencyValidator::class])
annotation class FieldDependency(
    val message: String = "Field dependency validation failed",
    val groups: Array<KClass<*>> = [],
    val payload: Array<KClass<out Payload>> = [],
    val dependentField: String,
    val dependsOn: String
)`
    };
    files.push(await this.writeValidationClass(fieldDependencyAnnotation, 'annotation'));
    
    const fieldDependencyValidator = {
      name: 'FieldDependencyValidator',
      type: 'validator',
      content: `package com.validation

import javax.validation.ConstraintValidator
import javax.validation.ConstraintValidatorContext
import kotlin.reflect.full.memberProperties

class FieldDependencyValidator : ConstraintValidator<FieldDependency, Any> {
    
    private lateinit var dependentField: String
    private lateinit var dependsOn: String
    
    override fun initialize(constraintAnnotation: FieldDependency) {
        this.dependentField = constraintAnnotation.dependentField
        this.dependsOn = constraintAnnotation.dependsOn
    }
    
    override fun isValid(value: Any?, context: ConstraintValidatorContext?): Boolean {
        if (value == null) return true
        
        val properties = value::class.memberProperties
        val dependsOnProperty = properties.find { it.name == dependsOn }
        val dependentProperty = properties.find { it.name == dependentField }
        
        if (dependsOnProperty == null || dependentProperty == null) return true
        
        val dependsOnValue = dependsOnProperty.getter.call(value)
        val dependentValue = dependentProperty.getter.call(value)
        
        // If the field we depend on has a value, the dependent field must also have a value
        return if (dependsOnValue != null && dependsOnValue.toString().isNotBlank()) {
            dependentValue != null && dependentValue.toString().isNotBlank()
        } else {
            true
        }
    }
}`
    };
    files.push(await this.writeValidationClass(fieldDependencyValidator, 'validator'));
    
    return files;
  }

  private generateValidationAnnotationClass(ruleName: string, rule: any): any {
    const className = `${this.pascalCase(ruleName)}`;
    return {
      name: className,
      type: 'annotation',
      content: `package com.validation

import javax.validation.Constraint
import javax.validation.Payload
import kotlin.annotation.AnnotationRetention
import kotlin.annotation.AnnotationTarget
import kotlin.reflect.KClass

@Target(AnnotationTarget.FIELD, AnnotationTarget.PROPERTY)
@Retention(AnnotationRetention.RUNTIME)
@Constraint(validatedBy = [${className}Validator::class])
annotation class ${className}(
    val message: String = "${rule.defaultMessage || 'Invalid value'}",
    val groups: Array<KClass<*>> = [],
    val payload: Array<KClass<out Payload>> = []${rule.parameters ? ',' : ''}
    ${rule.parameters ? rule.parameters.map((p: any) => `val ${p.name}: ${p.type} = ${p.defaultValue}`).join(',\n    ') : ''}
)`
    };
  }

  private generateValidationValidatorClass(ruleName: string, rule: any): any {
    const className = `${this.pascalCase(ruleName)}`;
    return {
      name: `${className}Validator`,
      type: 'validator',
      content: `package com.validation

import javax.validation.ConstraintValidator
import javax.validation.ConstraintValidatorContext

class ${className}Validator : ConstraintValidator<${className}, String> {
    
    override fun initialize(constraintAnnotation: ${className}) {
        // Initialize validator if needed
    }
    
    override fun isValid(value: String?, context: ConstraintValidatorContext?): Boolean {
        if (value == null) return true
        
        ${rule.validationLogic || 'return true // TODO: Implement validation logic'}
    }
}`
    };
  }

  private async writeValidationClass(validationClass: any, type: 'annotation' | 'validator'): Promise<string> {
    const packageDir = path.join(this.config.outputDir, 'src', 'main', 'kotlin', 'com', 'validation');
    await fs.ensureDir(packageDir);
    
    const fileName = `${validationClass.name}.kt`;
    const filePath = path.join(packageDir, fileName);
    
    await fs.writeFile(filePath, validationClass.content);
    
    if (this.config.verbose) {
      console.log(this.i18n.t('cli.generated.file', { file: fileName }));
    }
    
    return filePath;
  }

  private addValidationImports(validationAnnotations: string[], imports: Set<string>): void {
    for (const annotation of validationAnnotations) {
      // Standard Bean Validation annotations
      if (annotation.includes('@NotNull') || annotation.includes('@NotBlank') || annotation.includes('@NotEmpty')) {
        imports.add('javax.validation.constraints.NotNull');
        imports.add('javax.validation.constraints.NotBlank');
        imports.add('javax.validation.constraints.NotEmpty');
      }
      if (annotation.includes('@Size')) {
        imports.add('javax.validation.constraints.Size');
      }
      if (annotation.includes('@Min') || annotation.includes('@Max')) {
        imports.add('javax.validation.constraints.Min');
        imports.add('javax.validation.constraints.Max');
      }
      if (annotation.includes('@Email')) {
        imports.add('javax.validation.constraints.Email');
      }
      if (annotation.includes('@Pattern')) {
        imports.add('javax.validation.constraints.Pattern');
      }
      if (annotation.includes('@Valid')) {
        imports.add('javax.validation.Valid');
      }
      
      // Custom validation annotations
      if (annotation.includes('@UniqueEmail')) {
        imports.add('com.validation.UniqueEmail');
      }
      if (annotation.includes('@StrongPassword')) {
        imports.add('com.validation.StrongPassword');
      }
      if (annotation.includes('@PhoneNumber')) {
        imports.add('com.validation.PhoneNumber');
      }
      
      // Conditional validation annotations
      if (annotation.includes('@ConditionallyRequired')) {
        imports.add('com.validation.ConditionallyRequired');
      }
      if (annotation.includes('@ConditionalPattern')) {
        imports.add('com.validation.ConditionalPattern');
      }
      if (annotation.includes('@ConditionalSize')) {
        imports.add('com.validation.ConditionalSize');
      }
      if (annotation.includes('@FieldsEqual')) {
        imports.add('com.validation.FieldsEqual');
      }
      if (annotation.includes('@FieldDependency')) {
        imports.add('com.validation.FieldDependency');
      }
    }
  }

  private formatDefaultValue(value: any, type: string): string {
    if (value === null) return 'null';
    
    if (type === 'String') {
      return `"${value}"`;
    }
    
    if (type === 'Boolean') {
      return String(value);
    }
    
    if (type === 'Int' || type === 'Long' || type === 'Float' || type === 'Double') {
      return String(value);
    }
    
    return String(value);
  }

  private pascalCase(str: string): string {
    return str.replace(/(?:^|[-_])([a-z])/g, (_, char) => char.toUpperCase());
  }

  private camelCase(str: string): string {
    const pascal = this.pascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  /**
   * Utility function to split array into chunks for parallel processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}