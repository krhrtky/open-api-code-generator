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
        return schema;
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