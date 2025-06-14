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

export class OpenAPICodeGenerator {
  private config: GeneratorConfig;
  private parser: OpenAPIParser;
  private i18n: I18nService;

  constructor(config: GeneratorConfig) {
    this.config = config;
    this.parser = new OpenAPIParser();
    this.i18n = config.i18n;
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

    return {
      outputDir: this.config.outputDir,
      fileCount: generatedFiles.length,
      generatedFiles
    };
  }

  private async generateModels(spec: OpenAPISpec): Promise<string[]> {
    const schemas = this.parser.getAllSchemas(spec);
    const files: string[] = [];

    for (const [name, schema] of Object.entries(schemas)) {
      const kotlinClass = this.convertSchemaToKotlinClass(name, schema, spec);
      const filePath = await this.writeKotlinClass(kotlinClass, 'model');
      files.push(filePath);
      
      if (this.config.verbose) {
        const relativePath = path.relative(this.config.outputDir, filePath);
        console.log(this.i18n.t('cli.generated.model', { name, path: relativePath }));
      }
    }

    return files;
  }

  private async generateControllers(spec: OpenAPISpec): Promise<string[]> {
    const tags = this.parser.getAllTags(spec);
    const files: string[] = [];

    // Group operations by tags
    const taggedOperations = this.groupOperationsByTags(spec);

    for (const tag of tags.length > 0 ? tags : ['Default']) {
      const operations = taggedOperations[tag] || [];
      if (operations.length === 0) continue;

      const kotlinController = this.convertOperationsToKotlinController(tag, operations, spec);
      const filePath = await this.writeKotlinController(kotlinController);
      files.push(filePath);
      
      if (this.config.verbose) {
        const relativePath = path.relative(this.config.outputDir, filePath);
        console.log(this.i18n.t('cli.generated.controller', { name: kotlinController.name, path: relativePath }));
      }
    }

    return files;
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

  private convertSchemaToKotlinClass(name: string, schema: OpenAPISchema, spec: OpenAPISpec): KotlinClass {
    // Resolve allOf and other schema compositions first
    const resolvedSchema = this.parser.resolveSchema(spec, schema);
    
    // Handle oneOf schemas as sealed classes
    if (resolvedSchema.oneOfVariants) {
      return this.convertOneOfToSealedClass(name, resolvedSchema, spec);
    }
    
    // Handle anyOf schemas as union types
    if (resolvedSchema.anyOfVariants) {
      return this.convertAnyOfToUnionType(name, resolvedSchema, spec);
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
          ? this.parser.resolveReference(spec, propSchema)
          : propSchema;
        
        const property = this.convertSchemaToKotlinProperty(propName, propResolvedSchema, resolvedSchema.required || [], spec, [name]);
        kotlinClass.properties.push(property);
        
        // Add imports for property types
        this.addImportsForType(property.type, kotlinClass.imports);
      }
    }

    return kotlinClass;
  }

  private convertOneOfToSealedClass(name: string, schema: OpenAPISchema, spec: OpenAPISpec): KotlinClass {
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
          ? this.parser.resolveReference(spec, propSchema)
          : propSchema;
        
        const property = this.convertSchemaToKotlinProperty(propName, propResolvedSchema, schema.required || [], spec, [name]);
        kotlinClass.properties.push(property);
        
        // Add imports for property types
        this.addImportsForType(property.type, kotlinClass.imports);
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
              ? this.parser.resolveReference(spec, propSchema)
              : propSchema;
            
            const property = this.convertSchemaToKotlinProperty(propName, propResolvedSchema, variant.schema.required || [], spec, [name, 'sealedSubTypes', subClassName]);
            subClass.properties.push(property);
            
            // Add imports for property types
            this.addImportsForType(property.type, subClass.imports);
          }
        }

        kotlinClass.sealedSubTypes?.push(subClass);
      }
    }

    return kotlinClass;
  }

  private convertAnyOfToUnionType(name: string, schema: OpenAPISchema, spec: OpenAPISpec): KotlinClass {
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
      const companionMethods = schema.anyOfVariants.map(variant => {
        const methodName = `from${this.pascalCase(variant.name)}`;
        const paramType = this.mapSchemaToKotlinType(variant.schema, spec, [name, 'anyOfVariants', variant.name]);
        return `    companion object {
        @JsonCreator
        @JvmStatic
        fun ${methodName}(value: ${paramType}): ${kotlinClass.name} {
            return ${kotlinClass.name}(value, setOf("${variant.name}"))
        }
    }`;
      }).join('\n\n');
      
      // Store companion methods for template generation
      (kotlinClass as any).companionMethods = companionMethods;
    }

    return kotlinClass;
  }

  private convertSchemaToKotlinProperty(name: string, schema: OpenAPISchema, required: string[], spec: OpenAPISpec, schemaPath: string[] = []): KotlinProperty {
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
      propertyType = this.mapSchemaToKotlinType(schema, spec, [...schemaPath, 'properties', name]);
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
        property.validation = this.generateValidationAnnotations(schema, isRequired);
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

  private mapSchemaToKotlinType(schema: OpenAPISchema, spec: OpenAPISpec, schemaPath: string[] = []): string {
    if (this.parser.isReference(schema)) {
      const refName = this.parser.extractSchemaName((schema as any).$ref);
      return this.pascalCase(refName);
    }

    if (!schema.type) {
      throw createGenerationError(
        'Schema missing type information',
        ErrorCode.UNSUPPORTED_SCHEMA_TYPE,
        schemaPath,
        {
          suggestion: 'Ensure all schemas have a valid type property (string, number, integer, boolean, array, object)'
        }
      );
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
            const itemType = this.mapSchemaToKotlinType(
              this.parser.resolveSchema(spec, schema.items), 
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

  private generateValidationAnnotations(schema: OpenAPISchema, required: boolean): string[] {
    const annotations: string[] = [];

    if (required && schema.nullable !== true) {
      annotations.push('@NotNull');
    }

    if (schema.type === 'string') {
      if (schema.format === 'email') {
        annotations.push('@Email');
      }
      if (schema.minLength !== undefined || schema.maxLength !== undefined) {
        const min = schema.minLength ?? 0;
        const max = schema.maxLength ?? 'Integer.MAX_VALUE';
        annotations.push(`@Size(min = ${min}, max = ${max})`);
      }
      if (schema.pattern) {
        annotations.push(`@Pattern(regexp = "${schema.pattern}")`);
      }
    }

    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined) {
        annotations.push(`@Min(${schema.minimum})`);
      }
      if (schema.maximum !== undefined) {
        annotations.push(`@Max(${schema.maximum})`);
      }
    }

    if (schema.type === 'array') {
      if (schema.minItems !== undefined || schema.maxItems !== undefined) {
        const min = schema.minItems ?? 0;
        const max = schema.maxItems ?? 'Integer.MAX_VALUE';
        annotations.push(`@Size(min = ${min}, max = ${max})`);
      }
    }

    if (schema.type === 'object' || (schema.type === undefined && schema.properties)) {
      annotations.push('@Valid');
    }

    return annotations;
  }

  private convertOperationsToKotlinController(
    tag: string, 
    operations: Array<{ path: string; method: string; operation: OpenAPIOperation }>,
    spec: OpenAPISpec
  ): KotlinController {
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
      const kotlinMethod = this.convertOperationToKotlinMethod(path, method, operation, spec);
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

  private convertOperationToKotlinMethod(
    path: string, 
    httpMethod: string, 
    operation: OpenAPIOperation, 
    spec: OpenAPISpec
  ): KotlinMethod {
    const methodName = operation.operationId || this.generateMethodName(httpMethod, path);
    
    const kotlinMethod: KotlinMethod = {
      name: this.camelCase(methodName),
      httpMethod: httpMethod.toLowerCase(),
      path,
      summary: operation.summary,
      description: operation.description,
      parameters: [],
      returnType: this.determineReturnType(operation, spec),
      responseDescription: this.getResponseDescription(operation)
    };

    // Process parameters
    if (operation.parameters) {
      for (const param of operation.parameters) {
        if (!this.parser.isReference(param)) {
          const kotlinParam = this.convertParameterToKotlin(param as OpenAPIParameter, spec);
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
          const schema = this.parser.resolveSchema(spec, mediaType.schema);
          const bodyParam: KotlinParameter = {
            name: 'body',
            type: this.mapSchemaToKotlinType(schema, spec, ['requestBody', 'content', 'application/json', 'schema']),
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

  private convertParameterToKotlin(param: OpenAPIParameter, spec: OpenAPISpec): KotlinParameter {
    const schema = param.schema ? this.parser.resolveSchema(spec, param.schema) : { type: 'string' as const };
    
    return {
      name: this.camelCase(param.name),
      type: this.mapSchemaToKotlinType(schema, spec, ['parameters', param.name, 'schema']),
      paramType: param.in as 'path' | 'query' | 'header',
      required: param.required === true,
      description: param.description,
      validation: this.config.includeValidation ? this.generateValidationAnnotations(schema, param.required === true) : []
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

  private determineReturnType(operation: OpenAPIOperation, spec: OpenAPISpec): string {
    const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
    
    if (successResponse && !this.parser.isReference(successResponse)) {
      const response = successResponse;
      if (response.content) {
        const mediaType = response.content['application/json'];
        if (mediaType?.schema) {
          const schema = this.parser.resolveSchema(spec, mediaType.schema);
          const innerType = this.mapSchemaToKotlinType(schema, spec, ['responses', '200', 'content', 'application/json', 'schema']);
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
    
    content += ')\n';
    
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
      content += `${indent}@Schema(description = "${prop.description || prop.name}")`;
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
}