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
exports.OpenAPICodeGenerator = void 0;
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const parser_1 = require("./parser");
class OpenAPICodeGenerator {
    constructor(config) {
        this.config = config;
        this.parser = new parser_1.OpenAPIParser();
        this.i18n = config.i18n;
    }
    async generate(inputFile) {
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
        const generatedFiles = [];
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
    async generateModels(spec) {
        const schemas = this.parser.getAllSchemas(spec);
        const files = [];
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
    async generateControllers(spec) {
        const tags = this.parser.getAllTags(spec);
        const files = [];
        // Group operations by tags
        const taggedOperations = this.groupOperationsByTags(spec);
        for (const tag of tags.length > 0 ? tags : ['Default']) {
            const operations = taggedOperations[tag] || [];
            if (operations.length === 0)
                continue;
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
    groupOperationsByTags(spec) {
        const taggedOperations = {};
        for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
            for (const method of ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']) {
                const operation = pathItem[method];
                if (!operation)
                    continue;
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
    convertSchemaToKotlinClass(name, schema, spec) {
        const kotlinClass = {
            name: this.pascalCase(name),
            packageName: `${this.config.basePackage}.model`,
            description: schema.description,
            properties: [],
            imports: new Set([
                'javax.validation.constraints.*',
                'javax.validation.Valid',
                'io.swagger.v3.oas.annotations.media.Schema',
                'com.fasterxml.jackson.annotation.JsonProperty'
            ])
        };
        if (schema.type === 'object' && schema.properties) {
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                const resolvedSchema = this.parser.isReference(propSchema)
                    ? this.parser.resolveReference(spec, propSchema)
                    : propSchema;
                const property = this.convertSchemaToKotlinProperty(propName, resolvedSchema, schema.required || [], spec);
                kotlinClass.properties.push(property);
                // Add imports for property types
                this.addImportsForType(property.type, kotlinClass.imports);
            }
        }
        return kotlinClass;
    }
    convertSchemaToKotlinProperty(name, schema, required, spec) {
        const kotlinName = this.camelCase(name);
        const isRequired = required.includes(name);
        const nullable = schema.nullable === true || !isRequired;
        const property = {
            name: kotlinName,
            type: this.mapSchemaToKotlinType(schema, spec),
            nullable,
            description: schema.description,
            validation: [],
            jsonProperty: kotlinName !== name ? name : undefined
        };
        // Add default value
        if (schema.default !== undefined) {
            property.defaultValue = this.formatDefaultValue(schema.default, property.type);
        }
        else if (nullable) {
            property.defaultValue = 'null';
        }
        // Add validation annotations
        if (this.config.includeValidation) {
            property.validation = this.generateValidationAnnotations(schema, isRequired);
        }
        return property;
    }
    mapSchemaToKotlinType(schema, spec) {
        if (this.parser.isReference(schema)) {
            const refName = this.parser.extractSchemaName(schema.$ref);
            return this.pascalCase(refName);
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
                    const itemType = this.mapSchemaToKotlinType(this.parser.resolveSchema(spec, schema.items), spec);
                    return `List<${itemType}>`;
                }
                return 'List<Any>';
            case 'object':
                return 'Map<String, Any>';
            default:
                return 'Any';
        }
    }
    generateValidationAnnotations(schema, required) {
        const annotations = [];
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
    convertOperationsToKotlinController(tag, operations, spec) {
        const controllerName = `${this.pascalCase(tag)}Controller`;
        const kotlinController = {
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
    convertOperationToKotlinMethod(path, httpMethod, operation, spec) {
        const methodName = operation.operationId || this.generateMethodName(httpMethod, path);
        const kotlinMethod = {
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
                    const kotlinParam = this.convertParameterToKotlin(param, spec);
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
                    const bodyParam = {
                        name: 'body',
                        type: this.mapSchemaToKotlinType(schema, spec),
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
    convertParameterToKotlin(param, spec) {
        const schema = param.schema ? this.parser.resolveSchema(spec, param.schema) : { type: 'string' };
        return {
            name: this.camelCase(param.name),
            type: this.mapSchemaToKotlinType(schema, spec),
            paramType: param.in,
            required: param.required === true,
            description: param.description,
            validation: this.config.includeValidation ? this.generateValidationAnnotations(schema, param.required === true) : []
        };
    }
    generateMethodName(httpMethod, path) {
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
    determineReturnType(operation, spec) {
        const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
        if (successResponse && !this.parser.isReference(successResponse)) {
            const response = successResponse;
            if (response.content) {
                const mediaType = response.content['application/json'];
                if (mediaType?.schema) {
                    const schema = this.parser.resolveSchema(spec, mediaType.schema);
                    const innerType = this.mapSchemaToKotlinType(schema, spec);
                    return `ResponseEntity<${innerType}>`;
                }
            }
        }
        return 'ResponseEntity<Any>';
    }
    getResponseDescription(operation) {
        const successResponse = operation.responses['200'] || operation.responses['201'] || operation.responses['default'];
        if (successResponse && !this.parser.isReference(successResponse)) {
            return successResponse.description || 'Success';
        }
        return 'Success';
    }
    async writeKotlinClass(kotlinClass, subDir) {
        const content = this.generateKotlinClassContent(kotlinClass);
        const fileName = `${kotlinClass.name}.kt`;
        const outputDir = path.join(this.config.outputDir, 'src/main/kotlin', ...kotlinClass.packageName.split('.'), subDir);
        const filePath = path.join(outputDir, fileName);
        await fs.ensureDir(outputDir);
        await fs.writeFile(filePath, content, 'utf-8');
        return filePath;
    }
    async writeKotlinController(kotlinController) {
        const content = this.generateKotlinControllerContent(kotlinController);
        const fileName = `${kotlinController.name}.kt`;
        const outputDir = path.join(this.config.outputDir, 'src/main/kotlin', ...kotlinController.packageName.split('.'));
        const filePath = path.join(outputDir, fileName);
        await fs.ensureDir(outputDir);
        await fs.writeFile(filePath, content, 'utf-8');
        return filePath;
    }
    generateKotlinClassContent(kotlinClass) {
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
        content += `data class ${kotlinClass.name}(\n`;
        for (let i = 0; i < kotlinClass.properties.length; i++) {
            const prop = kotlinClass.properties[i];
            content += this.generatePropertyContent(prop, i === kotlinClass.properties.length - 1);
        }
        content += ')\n';
        return content;
    }
    generatePropertyContent(prop, isLast) {
        let content = '';
        if (prop.description) {
            content += `    /**\n     * ${prop.description}\n     */\n`;
        }
        if (this.config.includeSwagger) {
            content += `    @Schema(description = "${prop.description || prop.name}")`;
            if (prop.defaultValue && prop.defaultValue !== 'null') {
                content += `, example = "${prop.defaultValue}"`;
            }
            content += ')\n';
        }
        if (prop.jsonProperty) {
            content += `    @JsonProperty("${prop.jsonProperty}")\n`;
        }
        for (const validation of prop.validation) {
            content += `    ${validation}\n`;
        }
        const nullableSuffix = prop.nullable ? '?' : '';
        const defaultSuffix = prop.defaultValue ? ` = ${prop.defaultValue}` : '';
        content += `    val ${prop.name}: ${prop.type}${nullableSuffix}${defaultSuffix}`;
        if (!isLast) {
            content += ',';
        }
        content += '\n';
        return content;
    }
    generateKotlinControllerContent(kotlinController) {
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
    generateMethodContent(method) {
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
    generateParameterContent(param, isLast) {
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
    getHttpAnnotation(method) {
        const mapping = {
            'get': 'GetMapping',
            'post': 'PostMapping',
            'put': 'PutMapping',
            'delete': 'DeleteMapping',
            'patch': 'PatchMapping',
            'head': 'HeadMapping',
            'options': 'OptionsMapping'
        };
        return mapping[method] || 'RequestMapping';
    }
    getParameterAnnotation(param) {
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
    async generateBuildFile(spec) {
        const content = this.generateBuildFileContent(spec);
        const filePath = path.join(this.config.outputDir, 'build.gradle.kts');
        await fs.writeFile(filePath, content, 'utf-8');
        if (this.config.verbose) {
            const relativePath = path.relative(this.config.outputDir, filePath);
            console.log(this.i18n.t('cli.generated.buildFile', { path: relativePath }));
        }
        return filePath;
    }
    generateBuildFileContent(spec) {
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
    addImportsForType(type, imports) {
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
    formatDefaultValue(value, type) {
        if (value === null)
            return 'null';
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
    pascalCase(str) {
        return str.replace(/(?:^|[-_])([a-z])/g, (_, char) => char.toUpperCase());
    }
    camelCase(str) {
        const pascal = this.pascalCase(str);
        return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    }
}
exports.OpenAPICodeGenerator = OpenAPICodeGenerator;
//# sourceMappingURL=generator.js.map