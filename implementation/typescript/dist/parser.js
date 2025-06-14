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
class OpenAPIParser {
    async parseFile(filePath) {
        const absolutePath = path.resolve(filePath);
        if (!await fs.pathExists(absolutePath)) {
            throw new Error(`File not found: ${absolutePath}`);
        }
        const content = await fs.readFile(absolutePath, 'utf-8');
        const ext = path.extname(absolutePath).toLowerCase();
        try {
            let spec;
            if (ext === '.json') {
                spec = JSON.parse(content);
            }
            else if (ext === '.yaml' || ext === '.yml') {
                spec = YAML.parse(content);
            }
            else {
                throw new Error(`Unsupported file format: ${ext}`);
            }
            this.validateSpec(spec);
            return spec;
        }
        catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to parse ${ext.substring(1).toUpperCase()}: ${error.message}`);
            }
            throw error;
        }
    }
    validateSpec(spec) {
        if (!spec || typeof spec !== 'object') {
            throw new Error('Invalid OpenAPI specification: not an object');
        }
        if (!spec.openapi) {
            throw new Error('Missing required field: openapi');
        }
        if (!spec.openapi.startsWith('3.')) {
            throw new Error(`Unsupported OpenAPI version: ${spec.openapi}. Only 3.x is supported.`);
        }
        if (!spec.info) {
            throw new Error('Missing required field: info');
        }
        if (!spec.info.title) {
            throw new Error('Missing required field: info.title');
        }
        if (!spec.info.version) {
            throw new Error('Missing required field: info.version');
        }
        if (!spec.paths) {
            throw new Error('Missing required field: paths');
        }
    }
    resolveReference(spec, ref) {
        const refPath = ref.$ref;
        if (!refPath.startsWith('#/')) {
            throw new Error(`External references not supported: ${refPath}`);
        }
        const parts = refPath.substring(2).split('/');
        let current = spec;
        for (const part of parts) {
            if (!current || typeof current !== 'object' || !(part in current)) {
                throw new Error(`Reference not found: ${refPath}`);
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
        return schema;
    }
    resolveAllOfSchema(spec, schema) {
        if (!schema.allOf) {
            return schema;
        }
        // Start with base schema properties (excluding allOf)
        const resolvedSchema = {
            type: 'object',
            properties: {},
            required: [],
            ...schema
        };
        delete resolvedSchema.allOf;
        // Merge all schemas in allOf array
        for (const subSchema of schema.allOf) {
            const resolved = this.resolveSchema(spec, subSchema);
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
        return resolvedSchema;
    }
    resolveOneOfSchema(spec, schema) {
        if (!schema.oneOf) {
            return schema;
        }
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
            const resolved = this.resolveSchema(spec, variant);
            return {
                name: resolved.title || `Variant${index + 1}`,
                schema: resolved
            };
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
        return resolvedSchema;
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