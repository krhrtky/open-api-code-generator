"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAPIParser = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const YAML = __importStar(require("yaml"));
const errors_1 = require("./errors");
class OpenAPIParser {
    async parseFile(filePath) {
        const absolutePath = path.resolve(filePath);
        if (!await fs.pathExists(absolutePath)) {
            throw (0, errors_1.createParsingError)(`File not found: ${absolutePath}`, errors_1.ErrorCode.FILE_NOT_FOUND, [], { originalError: new Error(`File not found: ${absolutePath}`) });
        }
        const content = await fs.readFile(absolutePath, 'utf-8');
        const ext = path.extname(absolutePath).toLowerCase();
        if (ext !== '.json' && ext !== '.yaml' && ext !== '.yml') {
            throw (0, errors_1.createParsingError)(`Unsupported file format: ${ext}`, errors_1.ErrorCode.UNSUPPORTED_FORMAT, [], { originalError: new Error(`Unsupported format: ${ext}`) });
        }
        try {
            let spec;
            if (ext === '.json') {
                try {
                    spec = JSON.parse(content);
                }
                catch (jsonError) {
                    throw (0, errors_1.createParsingError)(`Invalid JSON format`, errors_1.ErrorCode.INVALID_JSON, [], { originalError: jsonError });
                }
            }
            else {
                try {
                    spec = YAML.parse(content);
                }
                catch (yamlError) {
                    throw (0, errors_1.createParsingError)(`Invalid YAML format`, errors_1.ErrorCode.INVALID_YAML, [], { originalError: yamlError });
                }
            }
            this.validateSpec(spec);
            return spec;
        }
        catch (error) {
            if (error instanceof errors_1.OpenAPIParsingError) {
                throw error;
            }
            throw (0, errors_1.createParsingError)(`Failed to parse ${ext.substring(1).toUpperCase()}: ${error.message}`, ext === '.json' ? errors_1.ErrorCode.INVALID_JSON : errors_1.ErrorCode.INVALID_YAML, [], { originalError: error });
        }
    }
    validateSpec(spec) {
        if (!spec || typeof spec !== 'object') {
            throw (0, errors_1.createParsingError)('Invalid OpenAPI specification: not an object', errors_1.ErrorCode.INVALID_SPEC_TYPE, []);
        }
        if (!spec.openapi) {
            throw (0, errors_1.createParsingError)('Missing required field: openapi', errors_1.ErrorCode.MISSING_OPENAPI_VERSION, ['openapi']);
        }
        if (!spec.openapi.startsWith('3.')) {
            throw (0, errors_1.createParsingError)(`Unsupported OpenAPI version: ${spec.openapi}`, errors_1.ErrorCode.UNSUPPORTED_OPENAPI_VERSION, ['openapi']);
        }
        if (!spec.info) {
            throw (0, errors_1.createParsingError)('Missing required field: info', errors_1.ErrorCode.MISSING_INFO, ['info']);
        }
        if (!spec.info.title) {
            throw (0, errors_1.createParsingError)('Missing required field: info.title', errors_1.ErrorCode.MISSING_INFO_TITLE, ['info', 'title']);
        }
        if (!spec.info.version) {
            throw (0, errors_1.createParsingError)('Missing required field: info.version', errors_1.ErrorCode.MISSING_INFO_VERSION, ['info', 'version']);
        }
        if (!spec.paths) {
            throw (0, errors_1.createParsingError)('Missing required field: paths', errors_1.ErrorCode.MISSING_PATHS, ['paths']);
        }
    }
    resolveReference(spec, ref) {
        const refPath = ref.$ref;
        if (!refPath.startsWith('#/')) {
            throw (0, errors_1.createParsingError)(`External references not supported: ${refPath}`, errors_1.ErrorCode.EXTERNAL_REFERENCE_NOT_SUPPORTED, ['$ref'], { originalError: new Error(`External reference: ${refPath}`) });
        }
        const parts = refPath.substring(2).split('/');
        let current = spec;
        const schemaPath = [];
        for (const part of parts) {
            schemaPath.push(part);
            if (!current || typeof current !== 'object' || !(part in current)) {
                throw (0, errors_1.createParsingError)(`Reference not found: ${refPath}`, errors_1.ErrorCode.REFERENCE_NOT_FOUND, schemaPath, { originalError: new Error(`Reference not found: ${refPath}`) });
            }
            current = current[part];
        }
        return current;
    }
    isReference(obj) {
        return obj && typeof obj === 'object' && '$ref' in obj;
    }
    resolveSchema(spec, schema) {
        if (this.isReference(schema)) {
            return this.resolveReference(spec, schema);
        }
        // Handle allOf schema composition
        if (schema.allOf) {
            return this.resolveAllOfSchema(spec, schema);
        }
        // Handle oneOf schema composition
        if (schema.oneOf) {
            return this.resolveOneOfSchema(spec, schema);
        }
        // Handle anyOf schema composition
        if (schema.anyOf) {
            return this.resolveAnyOfSchema(spec, schema);
        }
        return schema;
    }
    resolveAllOfSchema(spec, schema) {
        if (!schema.allOf) {
            return schema;
        }
        try {
            // Start with base schema properties (excluding allOf)
            const resolvedSchema = {
                type: 'object',
                properties: {},
                required: [],
                ...schema
            };
            delete resolvedSchema.allOf;
            // Merge all schemas in allOf array
            for (let i = 0; i < schema.allOf.length; i++) {
                const subSchema = schema.allOf[i];
                try {
                    const resolved = this.resolveSchema(spec, subSchema);
                    // Check for property conflicts
                    if (resolved.properties && resolvedSchema.properties) {
                        for (const propName of Object.keys(resolved.properties)) {
                            if (resolvedSchema.properties[propName]) {
                                const existing = this.isReference(resolvedSchema.properties[propName])
                                    ? this.resolveReference(spec, resolvedSchema.properties[propName])
                                    : resolvedSchema.properties[propName];
                                const incoming = this.isReference(resolved.properties[propName])
                                    ? this.resolveReference(spec, resolved.properties[propName])
                                    : resolved.properties[propName];
                                // Check for type conflicts
                                if (existing.type !== incoming.type) {
                                    throw (0, errors_1.createParsingError)(`Property '${propName}' has conflicting types in allOf schemas`, errors_1.ErrorCode.ALLOF_MERGE_CONFLICT, ['allOf', i.toString(), 'properties', propName], {
                                        suggestion: `Ensure property '${propName}' has the same type in all allOf schemas`
                                    });
                                }
                            }
                        }
                    }
                    // Merge properties
                    if (resolved.properties) {
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
                }
                catch (error) {
                    if (error instanceof errors_1.OpenAPIParsingError) {
                        throw error;
                    }
                    throw (0, errors_1.createParsingError)(`Error resolving allOf schema at index ${i}`, errors_1.ErrorCode.ALLOF_MERGE_CONFLICT, ['allOf', i.toString()], { originalError: error });
                }
            }
            return resolvedSchema;
        }
        catch (error) {
            if (error instanceof errors_1.OpenAPIParsingError) {
                throw error;
            }
            throw (0, errors_1.createParsingError)('Failed to resolve allOf schema composition', errors_1.ErrorCode.ALLOF_MERGE_CONFLICT, ['allOf'], { originalError: error });
        }
    }
    resolveOneOfSchema(spec, schema) {
        if (!schema.oneOf) {
            return schema;
        }
        try {
            // For oneOf, we create a discriminated union schema
            // The base schema contains common properties and discriminator info
            const resolvedSchema = {
                type: 'object',
                properties: {},
                required: [],
                ...schema
            };
            // Store oneOf variants for code generation
            resolvedSchema.oneOfVariants = schema.oneOf.map((variant, index) => {
                try {
                    const resolved = this.resolveSchema(spec, variant);
                    return {
                        name: resolved.title || `Variant${index + 1}`,
                        schema: resolved
                    };
                }
                catch (error) {
                    throw (0, errors_1.createParsingError)(`Error resolving oneOf variant at index ${index}`, errors_1.ErrorCode.ONEOF_DISCRIMINATOR_MISSING, ['oneOf', index.toString()], { originalError: error });
                }
            });
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
            }
            else {
                // Suggest adding discriminator for better oneOf handling
                throw (0, errors_1.createParsingError)('oneOf schema without discriminator property', errors_1.ErrorCode.ONEOF_DISCRIMINATOR_MISSING, ['oneOf'], {
                    suggestion: 'Add a discriminator property to distinguish between oneOf variants'
                });
            }
            return resolvedSchema;
        }
        catch (error) {
            if (error instanceof errors_1.OpenAPIParsingError) {
                throw error;
            }
            throw (0, errors_1.createParsingError)('Failed to resolve oneOf schema composition', errors_1.ErrorCode.ONEOF_DISCRIMINATOR_MISSING, ['oneOf'], { originalError: error });
        }
    }
    resolveAnyOfSchema(spec, schema) {
        if (!schema.anyOf) {
            return schema;
        }
        if (schema.anyOf.length === 0) {
            throw (0, errors_1.createParsingError)('anyOf schema must contain at least one variant', errors_1.ErrorCode.ANYOF_NO_VARIANTS, ['anyOf']);
        }
        try {
            // For anyOf, we create a union type schema
            // The base schema contains common properties and anyOf variant info
            const resolvedSchema = {
                type: 'object',
                properties: {},
                required: [],
                ...schema
            };
            // Store anyOf variants for code generation
            resolvedSchema.anyOfVariants = schema.anyOf.map((variant, index) => {
                try {
                    const resolved = this.resolveSchema(spec, variant);
                    return {
                        name: resolved.title || `Option${index + 1}`,
                        schema: resolved
                    };
                }
                catch (error) {
                    throw (0, errors_1.createParsingError)(`Error resolving anyOf variant at index ${index}`, errors_1.ErrorCode.ANYOF_NO_VARIANTS, ['anyOf', index.toString()], { originalError: error });
                }
            });
            // Remove anyOf from resolved schema
            delete resolvedSchema.anyOf;
            // anyOf allows combining multiple schemas, so we merge all common properties
            const commonProperties = {};
            const allRequired = new Set();
            // Find properties that exist in all variants
            for (let i = 0; i < schema.anyOf.length; i++) {
                const variant = schema.anyOf[i];
                try {
                    const resolved = this.resolveSchema(spec, variant);
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
                catch (error) {
                    throw (0, errors_1.createParsingError)(`Error processing anyOf variant at index ${i}`, errors_1.ErrorCode.ANYOF_NO_VARIANTS, ['anyOf', i.toString()], { originalError: error });
                }
            }
            // Set common properties
            resolvedSchema.properties = commonProperties;
            // For anyOf, we include all possible required fields (union of requirements)
            resolvedSchema.required = Array.from(allRequired);
            return resolvedSchema;
        }
        catch (error) {
            if (error instanceof errors_1.OpenAPIParsingError) {
                throw error;
            }
            throw (0, errors_1.createParsingError)('Failed to resolve anyOf schema composition', errors_1.ErrorCode.ANYOF_NO_VARIANTS, ['anyOf'], { originalError: error });
        }
    }
    extractSchemaName(ref) {
        const parts = ref.split('/');
        return parts[parts.length - 1];
    }
    getAllSchemas(spec) {
        const schemas = {};
        if (spec.components?.schemas) {
            for (const [name, schema] of Object.entries(spec.components.schemas)) {
                if (!this.isReference(schema)) {
                    schemas[name] = schema;
                }
                else {
                    schemas[name] = this.resolveReference(spec, schema);
                }
            }
        }
        return schemas;
    }
    getAllTags(spec) {
        const tags = new Set();
        // From global tags
        if (spec.tags) {
            for (const tag of spec.tags) {
                tags.add(tag.name);
            }
        }
        // From operations
        for (const pathItem of Object.values(spec.paths)) {
            for (const method of ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']) {
                const operation = pathItem[method];
                if (operation?.tags) {
                    for (const tag of operation.tags) {
                        tags.add(tag);
                    }
                }
            }
        }
        return Array.from(tags);
    }
}
exports.OpenAPIParser = OpenAPIParser;
//# sourceMappingURL=parser.js.map