export interface OpenAPISpec {
    openapi: string;
    info: OpenAPIInfo;
    servers?: OpenAPIServer[];
    paths: Record<string, OpenAPIPathItem>;
    components?: OpenAPIComponents;
    security?: OpenAPISecurityRequirement[];
    tags?: OpenAPITag[];
    externalDocs?: OpenAPIExternalDocumentation;
}
export interface OpenAPIInfo {
    title: string;
    description?: string;
    version: string;
    termsOfService?: string;
    contact?: OpenAPIContact;
    license?: OpenAPILicense;
}
export interface OpenAPIContact {
    name?: string;
    url?: string;
    email?: string;
}
export interface OpenAPILicense {
    name: string;
    url?: string;
}
export interface OpenAPIServer {
    url: string;
    description?: string;
    variables?: Record<string, OpenAPIServerVariable>;
}
export interface OpenAPIServerVariable {
    enum?: string[];
    default: string;
    description?: string;
}
export interface OpenAPIPathItem {
    $ref?: string;
    summary?: string;
    description?: string;
    get?: OpenAPIOperation;
    put?: OpenAPIOperation;
    post?: OpenAPIOperation;
    delete?: OpenAPIOperation;
    options?: OpenAPIOperation;
    head?: OpenAPIOperation;
    patch?: OpenAPIOperation;
    trace?: OpenAPIOperation;
    servers?: OpenAPIServer[];
    parameters?: (OpenAPIParameter | OpenAPIReference)[];
}
export interface OpenAPIOperation {
    tags?: string[];
    summary?: string;
    description?: string;
    externalDocs?: OpenAPIExternalDocumentation;
    operationId?: string;
    parameters?: (OpenAPIParameter | OpenAPIReference)[];
    requestBody?: OpenAPIRequestBody | OpenAPIReference;
    responses: Record<string, OpenAPIResponse | OpenAPIReference>;
    callbacks?: Record<string, OpenAPICallback | OpenAPIReference>;
    deprecated?: boolean;
    security?: OpenAPISecurityRequirement[];
    servers?: OpenAPIServer[];
}
export interface OpenAPIParameter {
    name: string;
    in: 'query' | 'header' | 'path' | 'cookie';
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    schema?: OpenAPISchema | OpenAPIReference;
    example?: any;
    examples?: Record<string, OpenAPIExample | OpenAPIReference>;
    content?: Record<string, OpenAPIMediaType>;
}
export interface OpenAPIRequestBody {
    description?: string;
    content: Record<string, OpenAPIMediaType>;
    required?: boolean;
}
export interface OpenAPIResponse {
    description: string;
    headers?: Record<string, OpenAPIHeader | OpenAPIReference>;
    content?: Record<string, OpenAPIMediaType>;
    links?: Record<string, OpenAPILink | OpenAPIReference>;
}
export interface OpenAPIMediaType {
    schema?: OpenAPISchema | OpenAPIReference;
    example?: any;
    examples?: Record<string, OpenAPIExample | OpenAPIReference>;
    encoding?: Record<string, OpenAPIEncoding>;
}
export interface OpenAPIEncoding {
    contentType?: string;
    headers?: Record<string, OpenAPIHeader | OpenAPIReference>;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
}
export interface OpenAPISchema {
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    format?: string;
    title?: string;
    description?: string;
    default?: any;
    example?: any;
    examples?: any[];
    enum?: any[];
    const?: any;
    multipleOf?: number;
    maximum?: number;
    exclusiveMaximum?: boolean | number;
    minimum?: number;
    exclusiveMinimum?: boolean | number;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    maxItems?: number;
    minItems?: number;
    uniqueItems?: boolean;
    maxProperties?: number;
    minProperties?: number;
    required?: string[];
    properties?: Record<string, OpenAPISchema | OpenAPIReference>;
    additionalProperties?: boolean | OpenAPISchema | OpenAPIReference;
    items?: OpenAPISchema | OpenAPIReference;
    allOf?: (OpenAPISchema | OpenAPIReference)[];
    oneOf?: (OpenAPISchema | OpenAPIReference)[];
    anyOf?: (OpenAPISchema | OpenAPIReference)[];
    not?: OpenAPISchema | OpenAPIReference;
    oneOfVariants?: {
        name: string;
        schema: OpenAPISchema;
    }[];
    anyOfVariants?: {
        name: string;
        schema: OpenAPISchema;
    }[];
    nullable?: boolean;
    discriminator?: OpenAPIDiscriminator;
    readOnly?: boolean;
    writeOnly?: boolean;
    deprecated?: boolean;
    xml?: OpenAPIXML;
    externalDocs?: OpenAPIExternalDocumentation;
}
export interface OpenAPIDiscriminator {
    propertyName: string;
    mapping?: Record<string, string>;
}
export interface OpenAPIXML {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
}
export interface OpenAPIComponents {
    schemas?: Record<string, OpenAPISchema | OpenAPIReference>;
    responses?: Record<string, OpenAPIResponse | OpenAPIReference>;
    parameters?: Record<string, OpenAPIParameter | OpenAPIReference>;
    examples?: Record<string, OpenAPIExample | OpenAPIReference>;
    requestBodies?: Record<string, OpenAPIRequestBody | OpenAPIReference>;
    headers?: Record<string, OpenAPIHeader | OpenAPIReference>;
    securitySchemes?: Record<string, OpenAPISecurityScheme | OpenAPIReference>;
    links?: Record<string, OpenAPILink | OpenAPIReference>;
    callbacks?: Record<string, OpenAPICallback | OpenAPIReference>;
    pathItems?: Record<string, OpenAPIPathItem | OpenAPIReference>;
}
export interface OpenAPIReference {
    $ref: string;
}
export interface OpenAPIExample {
    summary?: string;
    description?: string;
    value?: any;
    externalValue?: string;
}
export interface OpenAPIHeader {
    description?: string;
    required?: boolean;
    deprecated?: boolean;
    allowEmptyValue?: boolean;
    style?: string;
    explode?: boolean;
    allowReserved?: boolean;
    schema?: OpenAPISchema | OpenAPIReference;
    example?: any;
    examples?: Record<string, OpenAPIExample | OpenAPIReference>;
    content?: Record<string, OpenAPIMediaType>;
}
export interface OpenAPITag {
    name: string;
    description?: string;
    externalDocs?: OpenAPIExternalDocumentation;
}
export interface OpenAPIExternalDocumentation {
    description?: string;
    url: string;
}
export interface OpenAPISecurityScheme {
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    description?: string;
    name?: string;
    in?: 'query' | 'header' | 'cookie';
    scheme?: string;
    bearerFormat?: string;
    flows?: OpenAPIOAuthFlows;
    openIdConnectUrl?: string;
}
export interface OpenAPIOAuthFlows {
    implicit?: OpenAPIOAuthFlow;
    password?: OpenAPIOAuthFlow;
    clientCredentials?: OpenAPIOAuthFlow;
    authorizationCode?: OpenAPIOAuthFlow;
}
export interface OpenAPIOAuthFlow {
    authorizationUrl?: string;
    tokenUrl?: string;
    refreshUrl?: string;
    scopes: Record<string, string>;
}
export interface OpenAPISecurityRequirement {
    [name: string]: string[];
}
export interface OpenAPILink {
    operationRef?: string;
    operationId?: string;
    parameters?: Record<string, any>;
    requestBody?: any;
    description?: string;
    server?: OpenAPIServer;
}
export interface OpenAPICallback {
    [expression: string]: OpenAPIPathItem | OpenAPIReference;
}
export interface GeneratorConfig {
    outputDir: string;
    basePackage: string;
    generateControllers: boolean;
    generateModels: boolean;
    includeValidation: boolean;
    includeSwagger: boolean;
    verbose: boolean;
    i18n: any;
}
export interface GenerationResult {
    outputDir: string;
    fileCount: number;
    generatedFiles: string[];
}
export interface KotlinProperty {
    name: string;
    type: string;
    nullable: boolean;
    defaultValue?: string;
    description?: string;
    validation: string[];
    jsonProperty?: string;
}
export interface KotlinClass {
    name: string;
    packageName: string;
    description?: string;
    properties: KotlinProperty[];
    imports: Set<string>;
    isSealed?: boolean;
    sealedSubTypes?: KotlinClass[];
    parentClass?: string;
}
export interface KotlinMethod {
    name: string;
    httpMethod: string;
    path: string;
    summary?: string;
    description?: string;
    parameters: KotlinParameter[];
    requestBody?: KotlinParameter;
    returnType: string;
    responseDescription?: string;
}
export interface KotlinParameter {
    name: string;
    type: string;
    paramType: 'path' | 'query' | 'body' | 'header';
    required: boolean;
    description?: string;
    validation: string[];
}
export interface KotlinController {
    name: string;
    packageName: string;
    description?: string;
    methods: KotlinMethod[];
    imports: Set<string>;
}
