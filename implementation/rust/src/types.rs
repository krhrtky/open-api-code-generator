use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

// OpenAPI specification types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPISpec {
    pub openapi: String,
    pub info: OpenAPIInfo,
    #[serde(default)]
    pub servers: Vec<OpenAPIServer>,
    pub paths: IndexMap<String, OpenAPIPathItem>,
    #[serde(default)]
    pub components: Option<OpenAPIComponents>,
    #[serde(default)]
    pub security: Vec<OpenAPISecurityRequirement>,
    #[serde(default)]
    pub tags: Vec<OpenAPITag>,
    #[serde(default, rename = "externalDocs")]
    pub external_docs: Option<OpenAPIExternalDocumentation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIInfo {
    pub title: String,
    pub version: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "termsOfService")]
    pub terms_of_service: Option<String>,
    #[serde(default)]
    pub contact: Option<OpenAPIContact>,
    #[serde(default)]
    pub license: Option<OpenAPILicense>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIContact {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPILicense {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIServer {
    pub url: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub variables: HashMap<String, OpenAPIServerVariable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIServerVariable {
    #[serde(default, rename = "enum")]
    pub enum_values: Vec<String>,
    pub default: String,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIPathItem {
    #[serde(default, rename = "$ref")]
    pub reference: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub get: Option<OpenAPIOperation>,
    #[serde(default)]
    pub put: Option<OpenAPIOperation>,
    #[serde(default)]
    pub post: Option<OpenAPIOperation>,
    #[serde(default)]
    pub delete: Option<OpenAPIOperation>,
    #[serde(default)]
    pub options: Option<OpenAPIOperation>,
    #[serde(default)]
    pub head: Option<OpenAPIOperation>,
    #[serde(default)]
    pub patch: Option<OpenAPIOperation>,
    #[serde(default)]
    pub trace: Option<OpenAPIOperation>,
    #[serde(default)]
    pub servers: Vec<OpenAPIServer>,
    #[serde(default)]
    pub parameters: Vec<OpenAPIParameterOrRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIOperation {
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "externalDocs")]
    pub external_docs: Option<OpenAPIExternalDocumentation>,
    #[serde(default, rename = "operationId")]
    pub operation_id: Option<String>,
    #[serde(default)]
    pub parameters: Vec<OpenAPIParameterOrRef>,
    #[serde(default, rename = "requestBody")]
    pub request_body: Option<OpenAPIRequestBodyOrRef>,
    pub responses: IndexMap<String, OpenAPIResponseOrRef>,
    #[serde(default)]
    pub callbacks: IndexMap<String, OpenAPICallbackOrRef>,
    #[serde(default)]
    pub deprecated: bool,
    #[serde(default)]
    pub security: Vec<OpenAPISecurityRequirement>,
    #[serde(default)]
    pub servers: Vec<OpenAPIServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPIParameterOrRef {
    Parameter(OpenAPIParameter),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIParameter {
    pub name: String,
    #[serde(rename = "in")]
    pub location: String, // 'query', 'header', 'path', 'cookie'
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub deprecated: bool,
    #[serde(default, rename = "allowEmptyValue")]
    pub allow_empty_value: bool,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub explode: Option<bool>,
    #[serde(default, rename = "allowReserved")]
    pub allow_reserved: bool,
    #[serde(default)]
    pub schema: Option<OpenAPISchemaOrRef>,
    #[serde(default)]
    pub example: Option<serde_json::Value>,
    #[serde(default)]
    pub examples: IndexMap<String, OpenAPIExampleOrRef>,
    #[serde(default)]
    pub content: IndexMap<String, OpenAPIMediaType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPIRequestBodyOrRef {
    RequestBody(OpenAPIRequestBody),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIRequestBody {
    #[serde(default)]
    pub description: Option<String>,
    pub content: IndexMap<String, OpenAPIMediaType>,
    #[serde(default)]
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPIResponseOrRef {
    Response(OpenAPIResponse),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIResponse {
    pub description: String,
    #[serde(default)]
    pub headers: IndexMap<String, OpenAPIHeaderOrRef>,
    #[serde(default)]
    pub content: IndexMap<String, OpenAPIMediaType>,
    #[serde(default)]
    pub links: IndexMap<String, OpenAPILinkOrRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIMediaType {
    #[serde(default)]
    pub schema: Option<OpenAPISchemaOrRef>,
    #[serde(default)]
    pub example: Option<serde_json::Value>,
    #[serde(default)]
    pub examples: IndexMap<String, OpenAPIExampleOrRef>,
    #[serde(default)]
    pub encoding: IndexMap<String, OpenAPIEncoding>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIEncoding {
    #[serde(default, rename = "contentType")]
    pub content_type: Option<String>,
    #[serde(default)]
    pub headers: IndexMap<String, OpenAPIHeaderOrRef>,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub explode: Option<bool>,
    #[serde(default, rename = "allowReserved")]
    pub allow_reserved: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPISchemaOrRef {
    Schema(Box<OpenAPISchema>),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenAPISchema {
    // Core schema properties
    #[serde(default, rename = "type")]
    pub schema_type: Option<String>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub default: Option<serde_json::Value>,
    #[serde(default)]
    pub example: Option<serde_json::Value>,
    #[serde(default)]
    pub examples: Vec<serde_json::Value>,
    #[serde(default, rename = "enum")]
    pub enum_values: Vec<serde_json::Value>,
    #[serde(default, rename = "const")]
    pub const_value: Option<serde_json::Value>,

    // Numeric properties
    #[serde(default, rename = "multipleOf")]
    pub multiple_of: Option<f64>,
    #[serde(default)]
    pub maximum: Option<f64>,
    #[serde(default, rename = "exclusiveMaximum")]
    pub exclusive_maximum: Option<serde_json::Value>,
    #[serde(default)]
    pub minimum: Option<f64>,
    #[serde(default, rename = "exclusiveMinimum")]
    pub exclusive_minimum: Option<serde_json::Value>,

    // String properties
    #[serde(default, rename = "maxLength")]
    pub max_length: Option<u32>,
    #[serde(default, rename = "minLength")]
    pub min_length: Option<u32>,
    #[serde(default)]
    pub pattern: Option<String>,

    // Array properties
    #[serde(default, rename = "maxItems")]
    pub max_items: Option<u32>,
    #[serde(default, rename = "minItems")]
    pub min_items: Option<u32>,
    #[serde(default, rename = "uniqueItems")]
    pub unique_items: Option<bool>,
    #[serde(default)]
    pub items: Option<Box<OpenAPISchemaOrRef>>,

    // Object properties
    #[serde(default, rename = "maxProperties")]
    pub max_properties: Option<u32>,
    #[serde(default, rename = "minProperties")]
    pub min_properties: Option<u32>,
    #[serde(default)]
    pub required: Vec<String>,
    #[serde(default)]
    pub properties: IndexMap<String, OpenAPISchemaOrRef>,
    #[serde(default, rename = "additionalProperties")]
    pub additional_properties: Option<serde_json::Value>,

    // Composition
    #[serde(default, rename = "allOf")]
    pub all_of: Vec<OpenAPISchemaOrRef>,
    #[serde(default, rename = "oneOf")]
    pub one_of: Vec<OpenAPISchemaOrRef>,
    #[serde(default, rename = "anyOf")]
    pub any_of: Vec<OpenAPISchemaOrRef>,
    #[serde(default)]
    pub not: Option<Box<OpenAPISchemaOrRef>>,

    // Code generation helpers for composite schemas
    #[serde(skip)]
    pub one_of_variants: Option<Vec<(String, OpenAPISchema)>>,
    #[serde(skip)]
    pub any_of_variants: Option<Vec<(String, OpenAPISchema)>>,
    
    // Other
    #[serde(default)]
    pub nullable: Option<bool>,
    #[serde(default)]
    pub discriminator: Option<OpenAPIDiscriminator>,
    #[serde(default, rename = "readOnly")]
    pub read_only: Option<bool>,
    #[serde(default, rename = "writeOnly")]
    pub write_only: Option<bool>,
    #[serde(default)]
    pub deprecated: Option<bool>,
    #[serde(default)]
    pub xml: Option<OpenAPIXML>,
    #[serde(default, rename = "externalDocs")]
    pub external_docs: Option<OpenAPIExternalDocumentation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIDiscriminator {
    #[serde(rename = "propertyName")]
    pub property_name: String,
    #[serde(default)]
    pub mapping: IndexMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIXML {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub namespace: Option<String>,
    #[serde(default)]
    pub prefix: Option<String>,
    #[serde(default)]
    pub attribute: Option<bool>,
    #[serde(default)]
    pub wrapped: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIComponents {
    #[serde(default)]
    pub schemas: IndexMap<String, OpenAPISchemaOrRef>,
    #[serde(default)]
    pub responses: IndexMap<String, OpenAPIResponseOrRef>,
    #[serde(default)]
    pub parameters: IndexMap<String, OpenAPIParameterOrRef>,
    #[serde(default)]
    pub examples: IndexMap<String, OpenAPIExampleOrRef>,
    #[serde(default, rename = "requestBodies")]
    pub request_bodies: IndexMap<String, OpenAPIRequestBodyOrRef>,
    #[serde(default)]
    pub headers: IndexMap<String, OpenAPIHeaderOrRef>,
    #[serde(default, rename = "securitySchemes")]
    pub security_schemes: IndexMap<String, OpenAPISecuritySchemeOrRef>,
    #[serde(default)]
    pub links: IndexMap<String, OpenAPILinkOrRef>,
    #[serde(default)]
    pub callbacks: IndexMap<String, OpenAPICallbackOrRef>,
    #[serde(default, rename = "pathItems")]
    pub path_items: IndexMap<String, OpenAPIPathItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIReference {
    #[serde(rename = "$ref")]
    pub reference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPIExampleOrRef {
    Example(OpenAPIExample),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIExample {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub value: Option<serde_json::Value>,
    #[serde(default, rename = "externalValue")]
    pub external_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPIHeaderOrRef {
    Header(OpenAPIHeader),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIHeader {
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub deprecated: bool,
    #[serde(default, rename = "allowEmptyValue")]
    pub allow_empty_value: bool,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub explode: Option<bool>,
    #[serde(default, rename = "allowReserved")]
    pub allow_reserved: bool,
    #[serde(default)]
    pub schema: Option<OpenAPISchemaOrRef>,
    #[serde(default)]
    pub example: Option<serde_json::Value>,
    #[serde(default)]
    pub examples: IndexMap<String, OpenAPIExampleOrRef>,
    #[serde(default)]
    pub content: IndexMap<String, OpenAPIMediaType>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPITag {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default, rename = "externalDocs")]
    pub external_docs: Option<OpenAPIExternalDocumentation>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIExternalDocumentation {
    #[serde(default)]
    pub description: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPISecuritySchemeOrRef {
    SecurityScheme(OpenAPISecurityScheme),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPISecurityScheme {
    #[serde(rename = "type")]
    pub scheme_type: String, // 'apiKey', 'http', 'oauth2', 'openIdConnect'
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default, rename = "in")]
    pub location: Option<String>, // 'query', 'header', 'cookie'
    #[serde(default)]
    pub scheme: Option<String>,
    #[serde(default, rename = "bearerFormat")]
    pub bearer_format: Option<String>,
    #[serde(default)]
    pub flows: Option<OpenAPIOAuthFlows>,
    #[serde(default, rename = "openIdConnectUrl")]
    pub open_id_connect_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIOAuthFlows {
    #[serde(default)]
    pub implicit: Option<OpenAPIOAuthFlow>,
    #[serde(default)]
    pub password: Option<OpenAPIOAuthFlow>,
    #[serde(default, rename = "clientCredentials")]
    pub client_credentials: Option<OpenAPIOAuthFlow>,
    #[serde(default, rename = "authorizationCode")]
    pub authorization_code: Option<OpenAPIOAuthFlow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPIOAuthFlow {
    #[serde(default, rename = "authorizationUrl")]
    pub authorization_url: Option<String>,
    #[serde(default, rename = "tokenUrl")]
    pub token_url: Option<String>,
    #[serde(default, rename = "refreshUrl")]
    pub refresh_url: Option<String>,
    pub scopes: IndexMap<String, String>,
}

pub type OpenAPISecurityRequirement = IndexMap<String, Vec<String>>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPILinkOrRef {
    Link(OpenAPILink),
    Reference(OpenAPIReference),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenAPILink {
    #[serde(default, rename = "operationRef")]
    pub operation_ref: Option<String>,
    #[serde(default, rename = "operationId")]
    pub operation_id: Option<String>,
    #[serde(default)]
    pub parameters: IndexMap<String, serde_json::Value>,
    #[serde(default, rename = "requestBody")]
    pub request_body: Option<serde_json::Value>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub server: Option<OpenAPIServer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum OpenAPICallbackOrRef {
    Callback(OpenAPICallback),
    Reference(OpenAPIReference),
}

pub type OpenAPICallback = IndexMap<String, OpenAPIPathItem>;

// Code generation configuration and result types
#[derive(Debug, Clone)]
pub struct GeneratorConfig {
    pub output_dir: PathBuf,
    pub base_package: String,
    pub generate_controllers: bool,
    pub generate_models: bool,
    pub include_validation: bool,
    pub include_swagger: bool,
    pub verbose: bool,
}

#[derive(Debug, Clone)]
pub struct GenerationResult {
    pub output_dir: PathBuf,
    pub file_count: usize,
    pub generated_files: Vec<PathBuf>,
}

// Internal code generation types
#[derive(Debug, Clone)]
pub struct KotlinProperty {
    pub name: String,
    pub kotlin_type: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub description: Option<String>,
    pub validation: Vec<String>,
    pub json_property: Option<String>,
}

#[derive(Debug, Clone)]
pub struct KotlinClass {
    pub name: String,
    pub package_name: String,
    pub description: Option<String>,
    pub properties: Vec<KotlinProperty>,
    pub imports: Vec<String>,
    pub is_sealed: Option<bool>,
    pub sealed_sub_types: Option<Vec<KotlinClass>>,
    pub parent_class: Option<String>,
}

#[derive(Debug, Clone)]
pub struct KotlinMethod {
    pub name: String,
    pub http_method: String,
    pub path: String,
    pub summary: Option<String>,
    pub description: Option<String>,
    pub parameters: Vec<KotlinParameter>,
    pub request_body: Option<KotlinParameter>,
    pub return_type: String,
    pub response_description: Option<String>,
}

#[derive(Debug, Clone)]
pub struct KotlinParameter {
    pub name: String,
    pub kotlin_type: String,
    pub param_type: ParameterType,
    pub required: bool,
    pub description: Option<String>,
    pub validation: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum ParameterType {
    Path,
    Query,
    Body,
    Header,
}

#[derive(Debug, Clone)]
pub struct KotlinController {
    pub name: String,
    pub package_name: String,
    pub description: Option<String>,
    pub methods: Vec<KotlinMethod>,
    pub imports: Vec<String>,
}