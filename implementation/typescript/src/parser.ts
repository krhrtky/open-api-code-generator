import * as fs from 'fs-extra';
import * as path from 'path';
import * as YAML from 'yaml';
import { EventEmitter } from 'events';
import { OpenAPISpec, OpenAPISchema, OpenAPIReference } from './types';
import { 
  createParsingError, 
  ErrorCode,
  OpenAPIParsingError 
} from './errors';
import { ExternalReferenceResolver, ExternalResolverConfig } from './external-resolver';
import { WebhookService } from './webhook';

export class OpenAPIParser extends EventEmitter {
  private externalResolver: ExternalReferenceResolver;
  private baseUrl?: string;
  private webhookService?: WebhookService;

  constructor(externalResolverConfig?: ExternalResolverConfig, webhookService?: WebhookService) {
    super();
    this.externalResolver = new ExternalReferenceResolver(externalResolverConfig);
    this.webhookService = webhookService;
  }

  async parseFile(filePath: string): Promise<OpenAPISpec> {
    const absolutePath = path.resolve(filePath);
    this.baseUrl = absolutePath; // Set base URL for external reference resolution
    
    if (!await fs.pathExists(absolutePath)) {
      throw createParsingError(
        `File not found: ${absolutePath}`,
        ErrorCode.FILE_NOT_FOUND,
        [],
        { originalError: new Error(`File not found: ${absolutePath}`) }
      );
    }

    const content = await fs.readFile(absolutePath, 'utf-8');
    const ext = path.extname(absolutePath).toLowerCase();

    if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') {
      throw createParsingError(
        `Unsupported file format: ${ext}`,
        ErrorCode.UNSUPPORTED_FORMAT,
        [],
        { originalError: new Error(`Unsupported format: ${ext}`) }
      );
    }

    try {
      let spec: OpenAPISpec;
      
      if (ext === '.json') {
        try {
          spec = JSON.parse(content);
        } catch (jsonError) {
          throw createParsingError(
            `Invalid JSON format`,
            ErrorCode.INVALID_JSON,
            [],
            { originalError: jsonError as Error }
          );
        }
      } else {
        try {
          spec = YAML.parse(content);
        } catch (yamlError) {
          throw createParsingError(
            `Invalid YAML format`,
            ErrorCode.INVALID_YAML,
            [],
            { originalError: yamlError as Error }
          );
        }
      }

      this.validateSpec(spec);
      
      // Trigger webhook event for successful spec validation
      if (this.webhookService) {
        await this.webhookService.triggerEvent({
          type: 'api.spec.validated',
          data: {
            specPath: absolutePath,
            specUrl: this.isUrl(absolutePath) ? absolutePath : undefined
          }
        });
      }
      
      return spec;
    } catch (error) {
      if (error instanceof OpenAPIParsingError) {
        throw error;
      }
      throw createParsingError(
        `Failed to parse ${ext.substring(1).toUpperCase()}: ${(error as Error).message}`,
        ext === '.json' ? ErrorCode.INVALID_JSON : ErrorCode.INVALID_YAML,
        [],
        { originalError: error as Error }
      );
    }
  }

  private validateSpec(spec: any): void {
    if (!spec || typeof spec !== 'object') {
      throw createParsingError(
        'Invalid OpenAPI specification: not an object',
        ErrorCode.INVALID_SPEC_TYPE,
        []
      );
    }

    if (!spec.openapi) {
      throw createParsingError(
        'Missing required field: openapi',
        ErrorCode.MISSING_OPENAPI_VERSION,
        ['openapi']
      );
    }

    if (!spec.openapi.startsWith('3.')) {
      throw createParsingError(
        `Unsupported OpenAPI version: ${spec.openapi}`,
        ErrorCode.UNSUPPORTED_OPENAPI_VERSION,
        ['openapi']
      );
    }

    if (!spec.info) {
      throw createParsingError(
        'Missing required field: info',
        ErrorCode.MISSING_INFO,
        ['info']
      );
    }

    if (!spec.info.title) {
      throw createParsingError(
        'Missing required field: info.title',
        ErrorCode.MISSING_INFO_TITLE,
        ['info', 'title']
      );
    }

    if (!spec.info.version) {
      throw createParsingError(
        'Missing required field: info.version',
        ErrorCode.MISSING_INFO_VERSION,
        ['info', 'version']
      );
    }

    if (!spec.paths) {
      throw createParsingError(
        'Missing required field: paths',
        ErrorCode.MISSING_PATHS,
        ['paths']
      );
    }
  }

  async resolveReference(spec: OpenAPISpec, ref: OpenAPIReference, visitedRefs?: Set<string>): Promise<OpenAPISchema> {
    const refPath = ref.$ref;
    
    // Initialize visitedRefs if not provided
    if (!visitedRefs) {
      visitedRefs = new Set<string>();
    }
    
    // Check for circular reference
    if (visitedRefs.has(refPath)) {
      throw createParsingError(
        `Circular reference detected: ${refPath}`,
        ErrorCode.REFERENCE_NOT_FOUND,
        ['$ref'],
        { originalError: new Error(`Circular reference detected: ${refPath}`) }
      );
    }
    
    // Add current reference to visited set
    visitedRefs.add(refPath);
    
    // Handle external references
    if (!refPath.startsWith('#/')) {
      try {
        const resolved = await this.externalResolver.resolveExternalSchema(refPath, this.baseUrl);
        visitedRefs.delete(refPath); // Remove from visited after successful resolution
        return resolved;
      } catch (error) {
        visitedRefs.delete(refPath); // Remove from visited on error
        // If external resolution fails, provide helpful error context
        if (error instanceof Error) {
          throw createParsingError(
            `Failed to resolve external reference: ${refPath}. ${error.message}`,
            ErrorCode.EXTERNAL_FETCH_FAILED,
            ['$ref'],
            { originalError: error }
          );
        }
        throw error;
      }
    }

    // Handle local references (existing logic)
    const parts = refPath.substring(2).split('/');
    let current: any = spec;
    const schemaPath: string[] = [];

    for (const part of parts) {
      schemaPath.push(part);
      if (!current || typeof current !== 'object' || !(part in current)) {
        visitedRefs.delete(refPath); // Remove from visited on error
        throw createParsingError(
          `Reference not found: ${refPath}`,
          ErrorCode.REFERENCE_NOT_FOUND,
          schemaPath,
          { originalError: new Error(`Reference not found: ${refPath}`) }
        );
      }
      current = current[part];
    }

    // Recursively resolve the found schema if it contains further references
    const resolvedSchema = await this.resolveSchema(spec, current, visitedRefs);
    visitedRefs.delete(refPath); // Remove from visited after successful resolution
    return resolvedSchema;
  }

  isReference(obj: any): obj is OpenAPIReference {
    return obj && typeof obj === 'object' && '$ref' in obj;
  }

  async resolveSchema(spec: OpenAPISpec, schema: OpenAPISchema | OpenAPIReference, visitedRefs?: Set<string>): Promise<OpenAPISchema> {
    if (this.isReference(schema)) {
      return await this.resolveReference(spec, schema, visitedRefs);
    }
    
    // Handle allOf schema composition
    if ('allOf' in schema) {
      return await this.resolveAllOfSchema(spec, schema, visitedRefs);
    }
    
    // Handle oneOf schema composition
    if ('oneOf' in schema) {
      return await this.resolveOneOfSchema(spec, schema, visitedRefs);
    }
    
    // Handle anyOf schema composition
    if ('anyOf' in schema) {
      return await this.resolveAnyOfSchema(spec, schema, visitedRefs);
    }
    
    return schema;
  }

  private async resolveAllOfSchema(spec: OpenAPISpec, schema: OpenAPISchema, visitedRefs?: Set<string>): Promise<OpenAPISchema> {
    // Validate allOf structure first
    if (schema.allOf !== undefined && schema.allOf !== null && !Array.isArray(schema.allOf)) {
      throw createParsingError(
        'allOf must be an array',
        ErrorCode.ALLOF_MERGE_CONFLICT,
        ['allOf']
      );
    }
    
    if (schema.allOf === null) {
      throw createParsingError(
        'allOf cannot be null',
        ErrorCode.ALLOF_MERGE_CONFLICT,
        ['allOf']
      );
    }
    
    if (!schema.allOf) {
      return schema;
    }

    if (schema.allOf.length === 0) {
      throw createParsingError(
        'allOf array cannot be empty',
        ErrorCode.ALLOF_MERGE_CONFLICT,
        ['allOf']
      );
    }

    try {
      // Start with base schema properties (excluding allOf)
      const resolvedSchema: OpenAPISchema = {
        type: 'object',
        properties: schema.properties || {},
        required: schema.required || [],
        ...schema
      };
      delete resolvedSchema.allOf;

      // Merge all schemas in allOf array
      for (let i = 0; i < schema.allOf.length; i++) {
        const subSchema = schema.allOf[i];
        try {
          const resolved = await this.resolveSchema(spec, subSchema, visitedRefs);
          
          // Check for property conflicts
          if (resolved.properties && resolvedSchema.properties) {
            for (const propName of Object.keys(resolved.properties)) {
              if (resolvedSchema.properties[propName]) {
                const existing = this.isReference(resolvedSchema.properties[propName]) 
                  ? await this.resolveReference(spec, resolvedSchema.properties[propName], visitedRefs)
                  : resolvedSchema.properties[propName];
                const incoming = this.isReference(resolved.properties[propName])
                  ? await this.resolveReference(spec, resolved.properties[propName], visitedRefs)
                  : resolved.properties[propName];
                
                // Check for type conflicts
                if (existing.type !== incoming.type) {
                  throw createParsingError(
                    `Property '${propName}' has conflicting types in allOf schemas`,
                    ErrorCode.ALLOF_MERGE_CONFLICT,
                    ['allOf', i.toString(), 'properties', propName],
                    {
                      suggestion: `Ensure property '${propName}' has the same type in all allOf schemas`
                    }
                  );
                }
              }
            }
          }
          
          // Merge properties
          if (resolved.properties) {
            if (!resolvedSchema.properties) {
              resolvedSchema.properties = {};
            }
            resolvedSchema.properties = {
              ...resolvedSchema.properties,
              ...resolved.properties
            };
          }

          // Merge required fields
          if (resolved.required) {
            const existingRequired = resolvedSchema.required || [];
            resolvedSchema.required = [
              ...existingRequired,
              ...resolved.required.filter(field => !existingRequired.includes(field))
            ];
          }

          // Merge other schema properties (title, description, etc.)
          if (resolved.title && !resolvedSchema.title) {
            resolvedSchema.title = resolved.title;
          }
          if (resolved.description && !resolvedSchema.description) {
            resolvedSchema.description = resolved.description;
          }
          if (resolved.example && !resolvedSchema.example) {
            resolvedSchema.example = resolved.example;
          }
        } catch (error) {
          if (error instanceof OpenAPIParsingError) {
            throw error;
          }
          throw createParsingError(
            `Error resolving allOf schema at index ${i}`,
            ErrorCode.ALLOF_MERGE_CONFLICT,
            ['allOf', i.toString()],
            { originalError: error as Error }
          );
        }
      }

      // Ensure properties field exists even if empty
      if (!resolvedSchema.properties) {
        resolvedSchema.properties = {};
      }

      return resolvedSchema;
    } catch (error) {
      if (error instanceof OpenAPIParsingError) {
        throw error;
      }
      throw createParsingError(
        'Failed to resolve allOf schema composition',
        ErrorCode.ALLOF_MERGE_CONFLICT,
        ['allOf'],
        { originalError: error as Error }
      );
    }
  }

  private async resolveOneOfSchema(spec: OpenAPISpec, schema: OpenAPISchema, visitedRefs?: Set<string>): Promise<OpenAPISchema> {
    // Validate oneOf structure first  
    if (typeof schema.oneOf === 'string' || (schema.oneOf !== undefined && schema.oneOf !== null && !Array.isArray(schema.oneOf))) {
      throw createParsingError(
        'oneOf must be an array',
        ErrorCode.ONEOF_DISCRIMINATOR_MISSING,
        ['oneOf']
      );
    }
    
    if (!schema.oneOf) {
      return schema;
    }

    if (schema.oneOf.length === 0) {
      throw createParsingError(
        'oneOf array cannot be empty',
        ErrorCode.ONEOF_DISCRIMINATOR_MISSING,
        ['oneOf']
      );
    }

    try {
      // For oneOf, we create a discriminated union schema
      // The base schema contains common properties and discriminator info
      const resolvedSchema: OpenAPISchema = {
        type: 'object',
        properties: {},
        required: [],
        ...schema
      };

      // Store oneOf variants for code generation
      const oneOfVariants = [];
      for (let index = 0; index < schema.oneOf.length; index++) {
        const variant = schema.oneOf[index];
        try {
          const resolved = await this.resolveSchema(spec, variant, visitedRefs);
          // Extract name from reference or use title
          let variantName = resolved.title || `Variant${index + 1}`;
          if (this.isReference(variant)) {
            variantName = this.extractSchemaName(variant.$ref);
          }
          oneOfVariants.push({
            name: variantName,
            schema: resolved
          });
        } catch (error) {
          if (error instanceof OpenAPIParsingError && error.context.errorCode === ErrorCode.REFERENCE_NOT_FOUND) {
            // Re-throw reference not found errors as-is to preserve error message
            throw error;
          }
          throw createParsingError(
            `Error resolving oneOf variant at index ${index}`,
            ErrorCode.ONEOF_DISCRIMINATOR_MISSING,
            ['oneOf', index.toString()],
            { originalError: error as Error }
          );
        }
      }
      resolvedSchema.oneOfVariants = oneOfVariants;

      // Remove oneOf from resolved schema
      delete resolvedSchema.oneOf;

      // If discriminator is specified, add discriminator property
      if (schema.discriminator) {
        const discriminatorProperty = schema.discriminator.propertyName;
        if (!resolvedSchema.properties) {
          resolvedSchema.properties = {};
        }
        if (!resolvedSchema.properties[discriminatorProperty]) {
          resolvedSchema.properties[discriminatorProperty] = {
            type: 'string'
          };
        }
        if (!resolvedSchema.required?.includes(discriminatorProperty)) {
          resolvedSchema.required = [...(resolvedSchema.required || []), discriminatorProperty];
        }
      } else {
        // Suggest adding discriminator for better oneOf handling
        throw createParsingError(
          'oneOf schema without discriminator property',
          ErrorCode.ONEOF_DISCRIMINATOR_MISSING,
          ['oneOf'],
          {
            suggestion: 'Add a discriminator property to distinguish between oneOf variants'
          }
        );
      }

      return resolvedSchema;
    } catch (error) {
      if (error instanceof OpenAPIParsingError) {
        throw error;
      }
      throw createParsingError(
        'Failed to resolve oneOf schema composition',
        ErrorCode.ONEOF_DISCRIMINATOR_MISSING,
        ['oneOf'],
        { originalError: error as Error }
      );
    }
  }

  private async resolveAnyOfSchema(spec: OpenAPISpec, schema: OpenAPISchema, visitedRefs?: Set<string>): Promise<OpenAPISchema> {
    // Validate anyOf structure first
    if (typeof schema.anyOf === 'object' && !Array.isArray(schema.anyOf) && schema.anyOf !== null) {
      throw createParsingError(
        'anyOf must be an array',
        ErrorCode.ANYOF_NO_VARIANTS,
        ['anyOf']
      );
    }
    
    if (!schema.anyOf) {
      return schema;
    }

    if (schema.anyOf.length === 0) {
      throw createParsingError(
        'anyOf schema must contain at least one variant',
        ErrorCode.ANYOF_NO_VARIANTS,
        ['anyOf']
      );
    }

    try {
      // For anyOf, we create a union type schema
      // The base schema contains common properties and anyOf variant info
      const resolvedSchema: OpenAPISchema = {
        type: 'object',
        properties: {},
        required: [],
        ...schema
      };

      // Store anyOf variants for code generation
      const anyOfVariants = [];
      for (let index = 0; index < schema.anyOf.length; index++) {
        const variant = schema.anyOf[index];
        try {
          const resolved = await this.resolveSchema(spec, variant, visitedRefs);
          anyOfVariants.push({
            name: resolved.title || `Option${index + 1}`,
            schema: resolved
          });
        } catch (error) {
          if (error instanceof OpenAPIParsingError && error.context.errorCode === ErrorCode.REFERENCE_NOT_FOUND) {
            // Re-throw reference not found errors as-is to preserve error message
            throw error;
          }
          throw createParsingError(
            `Error resolving anyOf variant at index ${index}`,
            ErrorCode.ANYOF_NO_VARIANTS,
            ['anyOf', index.toString()],
            { originalError: error as Error }
          );
        }
      }
      resolvedSchema.anyOfVariants = anyOfVariants;

      // Remove anyOf from resolved schema
      delete resolvedSchema.anyOf;

      // anyOf allows combining multiple schemas, so we merge all common properties
      const commonProperties: Record<string, any> = {};
      const allRequired = new Set<string>();

      // Find properties that exist in all variants  
      for (let i = 0; i < anyOfVariants.length; i++) {
        const variantData = anyOfVariants[i];
        const resolved = variantData.schema;
        
        if (resolved.properties) {
          for (const [propName, propSchema] of Object.entries(resolved.properties)) {
            if (!commonProperties[propName]) {
              commonProperties[propName] = propSchema;
            }
          }
        }
        
        // For anyOf, a field is required only if it's required in ALL variants
        if (resolved.required) {
          for (const required of resolved.required) {
            allRequired.add(required);
          }
        }
      }

      // Set common properties
      resolvedSchema.properties = commonProperties;
      
      // For anyOf, we include all possible required fields (union of requirements)
      resolvedSchema.required = Array.from(allRequired);

      return resolvedSchema;
    } catch (error) {
      if (error instanceof OpenAPIParsingError) {
        throw error;
      }
      throw createParsingError(
        'Failed to resolve anyOf schema composition',
        ErrorCode.ANYOF_NO_VARIANTS,
        ['anyOf'],
        { originalError: error as Error }
      );
    }
  }

  extractSchemaName(ref: string): string {
    const parts = ref.split('/');
    return parts[parts.length - 1];
  }

  async getAllSchemas(spec: OpenAPISpec): Promise<Record<string, OpenAPISchema>> {
    const schemas: Record<string, OpenAPISchema> = {};
    
    if (spec.components?.schemas) {
      for (const [name, schema] of Object.entries(spec.components.schemas)) {
        if (!this.isReference(schema)) {
          schemas[name] = schema;
        } else {
          schemas[name] = await this.resolveReference(spec, schema);
        }
      }
    }

    return schemas;
  }

  getAllTags(spec: OpenAPISpec): string[] {
    const tags = new Set<string>();
    
    // From global tags
    if (spec.tags) {
      for (const tag of spec.tags) {
        tags.add(tag.name);
      }
    }

    // From operations
    for (const pathItem of Object.values(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']) {
        const operation = (pathItem as any)[method];
        if (operation?.tags) {
          for (const tag of operation.tags) {
            tags.add(tag);
          }
        }
      }
    }

    return Array.from(tags);
  }

  /**
   * Check if a string is a URL
   */
  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set webhook service for event notifications
   */
  public setWebhookService(webhookService: WebhookService): void {
    this.webhookService = webhookService;
  }
}