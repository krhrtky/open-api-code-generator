use indexmap::IndexMap;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

// OpenAPI specification types
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
    Parameter(Box<OpenAPIParameter>),
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
    Response(Box<OpenAPIResponse>),
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
    Header(Box<OpenAPIHeader>),
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
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
    SecurityScheme(Box<OpenAPISecurityScheme>),
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
    Link(Box<OpenAPILink>),
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
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openapi_spec_serialization() {
        let spec = OpenAPISpec {
            openapi: "3.0.0".to_string(),
            info: OpenAPIInfo {
                title: "Test API".to_string(),
                version: "1.0.0".to_string(),
                description: Some("A test API".to_string()),
                terms_of_service: None,
                contact: None,
                license: None,
            },
            servers: vec![],
            paths: IndexMap::new(),
            components: None,
            security: vec![],
            tags: vec![],
            external_docs: None,
        };

        let json_str = serde_json::to_string(&spec).unwrap();
        let deserialized: OpenAPISpec = serde_json::from_str(&json_str).unwrap();

        assert_eq!(deserialized.openapi, "3.0.0");
        assert_eq!(deserialized.info.title, "Test API");
        assert_eq!(deserialized.info.version, "1.0.0");
    }

    #[test]
    fn test_openapi_spec_default() {
        let spec = OpenAPISpec::default();
        assert_eq!(spec.openapi, "");
        assert_eq!(spec.info.title, "");
        assert_eq!(spec.info.version, "");
        assert!(spec.servers.is_empty());
        assert!(spec.paths.is_empty());
        assert!(spec.security.is_empty());
        assert!(spec.tags.is_empty());
        assert!(spec.components.is_none());
        assert!(spec.external_docs.is_none());
    }

    #[test]
    fn test_openapi_info_complete() {
        let info = OpenAPIInfo {
            title: "Complete API".to_string(),
            version: "2.0.0".to_string(),
            description: Some("A complete API description".to_string()),
            terms_of_service: Some("https://example.com/terms".to_string()),
            contact: Some(OpenAPIContact {
                name: Some("Support Team".to_string()),
                url: Some("https://example.com/support".to_string()),
                email: Some("support@example.com".to_string()),
            }),
            license: Some(OpenAPILicense {
                name: "MIT".to_string(),
                url: Some("https://opensource.org/licenses/MIT".to_string()),
            }),
        };

        assert_eq!(info.title, "Complete API");
        assert_eq!(info.version, "2.0.0");
        assert_eq!(info.description.unwrap(), "A complete API description");
        assert_eq!(
            info.contact.as_ref().unwrap().email.as_ref().unwrap(),
            "support@example.com"
        );
        assert_eq!(info.license.as_ref().unwrap().name, "MIT");
    }

    #[test]
    fn test_openapi_server_with_variables() {
        let server = OpenAPIServer {
            url: "https://{environment}.example.com:{port}".to_string(),
            description: Some("Development server".to_string()),
            variables: {
                let mut vars = HashMap::new();
                vars.insert(
                    "environment".to_string(),
                    OpenAPIServerVariable {
                        enum_values: vec!["dev".to_string(), "staging".to_string()],
                        default: "dev".to_string(),
                        description: Some("Environment name".to_string()),
                    },
                );
                vars.insert(
                    "port".to_string(),
                    OpenAPIServerVariable {
                        enum_values: vec![],
                        default: "8080".to_string(),
                        description: Some("Server port".to_string()),
                    },
                );
                vars
            },
        };

        assert!(server.url.contains("{environment}"));
        assert_eq!(server.variables.len(), 2);
        assert_eq!(server.variables.get("environment").unwrap().default, "dev");
        assert_eq!(server.variables.get("port").unwrap().default, "8080");
    }

    #[test]
    fn test_openapi_path_item_default() {
        let path_item = OpenAPIPathItem::default();
        assert!(path_item.reference.is_none());
        assert!(path_item.summary.is_none());
        assert!(path_item.description.is_none());
        assert!(path_item.get.is_none());
        assert!(path_item.post.is_none());
        assert!(path_item.put.is_none());
        assert!(path_item.delete.is_none());
        assert!(path_item.options.is_none());
        assert!(path_item.head.is_none());
        assert!(path_item.patch.is_none());
        assert!(path_item.trace.is_none());
        assert!(path_item.servers.is_empty());
        assert!(path_item.parameters.is_empty());
    }

    #[test]
    fn test_openapi_operation_default() {
        let operation = OpenAPIOperation::default();
        assert!(operation.tags.is_empty());
        assert!(operation.summary.is_none());
        assert!(operation.description.is_none());
        assert!(operation.external_docs.is_none());
        assert!(operation.operation_id.is_none());
        assert!(operation.parameters.is_empty());
        assert!(operation.request_body.is_none());
        assert!(operation.responses.is_empty());
        assert!(operation.callbacks.is_empty());
        assert!(!operation.deprecated);
        assert!(operation.security.is_empty());
        assert!(operation.servers.is_empty());
    }

    #[test]
    fn test_openapi_schema_type_variants() {
        let string_schema = "string";
        let number_schema = "number";
        let integer_schema = "integer";
        let boolean_schema = "boolean";
        let array_schema = "array";
        let object_schema = "object";

        assert_eq!(string_schema, "string");
        assert_eq!(number_schema, "number");
        assert_eq!(integer_schema, "integer");
        assert_eq!(boolean_schema, "boolean");
        assert_eq!(array_schema, "array");
        assert_eq!(object_schema, "object");
    }

    #[test]
    fn test_openapi_schema_format_variants() {
        let formats = vec![
            "int32",
            "int64",
            "float",
            "double",
            "byte",
            "binary",
            "date",
            "date-time",
            "password",
            "email",
            "uuid",
            "uri",
            "hostname",
            "ipv4",
            "ipv6",
        ];

        assert_eq!(formats.len(), 15);
        assert_eq!(formats[0], "int32");
        assert_eq!(formats[6], "date");
        assert_eq!(formats[10], "uuid");
    }

    #[test]
    fn test_openapi_schema_with_composition() {
        let mut schema = OpenAPISchema::default();
        schema.all_of = vec![
            OpenAPISchemaOrRef::Reference(OpenAPIReference {
                reference: "#/components/schemas/Base".to_string(),
            }),
            OpenAPISchemaOrRef::Reference(OpenAPIReference {
                reference: "#/components/schemas/Extension".to_string(),
            }),
        ];

        assert!(!schema.all_of.is_empty());
        assert_eq!(schema.all_of.len(), 2);
    }

    #[test]
    fn test_openapi_discriminator_default() {
        let discriminator = OpenAPIDiscriminator::default();
        assert_eq!(discriminator.property_name, "");
        assert!(discriminator.mapping.is_empty());
    }

    #[test]
    fn test_openapi_discriminator_with_mapping() {
        let mut mapping = IndexMap::new();
        mapping.insert("cat".to_string(), "#/components/schemas/Cat".to_string());
        mapping.insert("dog".to_string(), "#/components/schemas/Dog".to_string());

        let discriminator = OpenAPIDiscriminator {
            property_name: "petType".to_string(),
            mapping,
        };

        assert_eq!(discriminator.property_name, "petType");
        assert_eq!(discriminator.mapping.len(), 2);
        assert_eq!(
            discriminator.mapping.get("cat").unwrap(),
            "#/components/schemas/Cat"
        );
        assert_eq!(
            discriminator.mapping.get("dog").unwrap(),
            "#/components/schemas/Dog"
        );
    }

    #[test]
    fn test_openapi_response_with_content() {
        let mut content = IndexMap::new();
        content.insert(
            "application/json".to_string(),
            OpenAPIMediaType {
                schema: Some(OpenAPISchemaOrRef::Reference(OpenAPIReference {
                    reference: "#/components/schemas/User".to_string(),
                })),
                example: None,
                examples: IndexMap::new(),
                encoding: IndexMap::new(),
            },
        );

        let response = OpenAPIResponse {
            description: "Successful response".to_string(),
            headers: IndexMap::new(),
            content,
            links: IndexMap::new(),
        };

        assert_eq!(response.description, "Successful response");
        assert_eq!(response.content.len(), 1);
        assert!(response.content.contains_key("application/json"));
    }

    #[test]
    fn test_openapi_parameter_variants() {
        let query_param = OpenAPIParameter {
            name: "limit".to_string(),
            location: "query".to_string(),
            description: Some("Maximum number of results".to_string()),
            required: false,
            deprecated: false,
            allow_empty_value: false,
            style: Some("form".to_string()),
            explode: Some(false),
            allow_reserved: false,
            schema: Some(OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("integer".to_string()),
                format: Some("int32".to_string()),
                minimum: Some(1.0),
                maximum: Some(100.0),
                ..Default::default()
            }))),
            example: None,
            examples: IndexMap::new(),
            content: IndexMap::new(),
        };

        assert_eq!(query_param.name, "limit");
        assert_eq!(query_param.location, "query");
        assert!(!query_param.required);
        assert!(query_param.schema.is_some());
    }

    #[test]
    fn test_openapi_security_scheme_variants() {
        let api_key_scheme = OpenAPISecurityScheme {
            scheme_type: "apiKey".to_string(),
            description: Some("API key authentication".to_string()),
            name: Some("X-API-Key".to_string()),
            location: Some("header".to_string()),
            scheme: None,
            bearer_format: None,
            flows: None,
            open_id_connect_url: None,
        };

        let oauth_scheme = OpenAPISecurityScheme {
            scheme_type: "oauth2".to_string(),
            description: Some("OAuth2 authentication".to_string()),
            name: None,
            location: None,
            scheme: None,
            bearer_format: None,
            flows: Some(OpenAPIOAuthFlows {
                implicit: None,
                password: None,
                client_credentials: Some(OpenAPIOAuthFlow {
                    authorization_url: None,
                    token_url: Some("https://example.com/oauth/token".to_string()),
                    refresh_url: None,
                    scopes: {
                        let mut scopes = IndexMap::new();
                        scopes.insert("read".to_string(), "Read access".to_string());
                        scopes.insert("write".to_string(), "Write access".to_string());
                        scopes
                    },
                }),
                authorization_code: None,
            }),
            open_id_connect_url: None,
        };

        assert_eq!(api_key_scheme.scheme_type, "apiKey");
        assert_eq!(api_key_scheme.name.as_ref().unwrap(), "X-API-Key");
        assert_eq!(oauth_scheme.scheme_type, "oauth2");
        assert!(oauth_scheme.flows.is_some());
        assert!(oauth_scheme
            .flows
            .as_ref()
            .unwrap()
            .client_credentials
            .is_some());
    }

    #[test]
    fn test_openapi_tag_default() {
        let tag = OpenAPITag::default();
        assert_eq!(tag.name, "");
        assert!(tag.description.is_none());
        assert!(tag.external_docs.is_none());
    }

    #[test]
    fn test_openapi_tag_with_external_docs() {
        let tag = OpenAPITag {
            name: "users".to_string(),
            description: Some("User management operations".to_string()),
            external_docs: Some(OpenAPIExternalDocumentation {
                description: Some("Find more info here".to_string()),
                url: "https://example.com/docs/users".to_string(),
            }),
        };

        assert_eq!(tag.name, "users");
        assert_eq!(
            tag.description.as_ref().unwrap(),
            "User management operations"
        );
        assert!(tag.external_docs.is_some());
        assert_eq!(
            tag.external_docs.as_ref().unwrap().url,
            "https://example.com/docs/users"
        );
    }

    #[test]
    fn test_openapi_components_default() {
        let components = OpenAPIComponents::default();
        assert!(components.schemas.is_empty());
        assert!(components.responses.is_empty());
        assert!(components.parameters.is_empty());
        assert!(components.examples.is_empty());
        assert!(components.request_bodies.is_empty());
        assert!(components.headers.is_empty());
        assert!(components.security_schemes.is_empty());
        assert!(components.links.is_empty());
        assert!(components.callbacks.is_empty());
    }

    #[test]
    fn test_schema_or_ref_enum_variants() {
        let schema_variant = OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema::default()));
        let reference_variant = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/User".to_string(),
        });

        match schema_variant {
            OpenAPISchemaOrRef::Schema(_) => {}
            _ => panic!("Expected Schema variant"),
        }

        match reference_variant {
            OpenAPISchemaOrRef::Reference(ref_obj) => {
                assert_eq!(ref_obj.reference, "#/components/schemas/User");
            }
            _ => panic!("Expected Reference variant"),
        }
    }

    #[test]
    fn test_parameter_or_ref_enum_variants() {
        let parameter_variant = OpenAPIParameterOrRef::Parameter(Box::new(OpenAPIParameter {
            name: "id".to_string(),
            location: "path".to_string(),
            description: Some("User ID".to_string()),
            required: true,
            deprecated: false,
            allow_empty_value: false,
            style: None,
            explode: None,
            allow_reserved: false,
            schema: None,
            example: None,
            examples: IndexMap::new(),
            content: IndexMap::new(),
        }));

        let reference_variant = OpenAPIParameterOrRef::Reference(OpenAPIReference {
            reference: "#/components/parameters/UserIdParam".to_string(),
        });

        match parameter_variant {
            OpenAPIParameterOrRef::Parameter(param) => {
                assert_eq!(param.name, "id");
                assert_eq!(param.location, "path");
                assert!(param.required);
            }
            _ => panic!("Expected Parameter variant"),
        }

        match reference_variant {
            OpenAPIParameterOrRef::Reference(ref_obj) => {
                assert_eq!(ref_obj.reference, "#/components/parameters/UserIdParam");
            }
            _ => panic!("Expected Reference variant"),
        }
    }

    #[test]
    fn test_generator_config_creation() {
        let config = GeneratorConfig {
            output_dir: PathBuf::from("/tmp/output"),
            base_package: "com.example.api".to_string(),
            generate_controllers: true,
            generate_models: true,
            include_validation: true,
            include_swagger: false,
            verbose: false,
        };

        assert_eq!(config.output_dir, PathBuf::from("/tmp/output"));
        assert_eq!(config.base_package, "com.example.api");
        assert!(config.generate_controllers);
        assert!(config.generate_models);
        assert!(config.include_validation);
        assert!(!config.include_swagger);
        assert!(!config.verbose);
    }

    #[test]
    fn test_generation_result_creation() {
        let result = GenerationResult {
            output_dir: PathBuf::from("/tmp/generated"),
            file_count: 5,
            generated_files: vec![
                PathBuf::from("/tmp/generated/User.kt"),
                PathBuf::from("/tmp/generated/UserController.kt"),
                PathBuf::from("/tmp/generated/ApiClient.kt"),
            ],
        };

        assert_eq!(result.output_dir, PathBuf::from("/tmp/generated"));
        assert_eq!(result.file_count, 5);
        assert_eq!(result.generated_files.len(), 3);
        assert!(result
            .generated_files
            .contains(&PathBuf::from("/tmp/generated/User.kt")));
    }

    #[test]
    fn test_kotlin_property_creation() {
        let property = KotlinProperty {
            name: "email".to_string(),
            kotlin_type: "String".to_string(),
            nullable: false,
            default_value: None,
            description: Some("User email address".to_string()),
            validation: vec!["@Email".to_string(), "@NotBlank".to_string()],
            json_property: Some("email_address".to_string()),
        };

        assert_eq!(property.name, "email");
        assert_eq!(property.kotlin_type, "String");
        assert!(!property.nullable);
        assert!(property.default_value.is_none());
        assert_eq!(property.description.as_ref().unwrap(), "User email address");
        assert_eq!(property.validation.len(), 2);
        assert!(property.validation.contains(&"@Email".to_string()));
        assert_eq!(property.json_property.as_ref().unwrap(), "email_address");
    }

    #[test]
    fn test_kotlin_class_creation() {
        let kotlin_class = KotlinClass {
            name: "User".to_string(),
            package_name: "com.example.model".to_string(),
            description: Some("User entity class".to_string()),
            properties: vec![
                KotlinProperty {
                    name: "id".to_string(),
                    kotlin_type: "Long".to_string(),
                    nullable: false,
                    default_value: None,
                    description: Some("User ID".to_string()),
                    validation: vec!["@NotNull".to_string()],
                    json_property: None,
                },
                KotlinProperty {
                    name: "name".to_string(),
                    kotlin_type: "String".to_string(),
                    nullable: false,
                    default_value: None,
                    description: Some("User name".to_string()),
                    validation: vec!["@NotBlank".to_string()],
                    json_property: None,
                },
            ],
            imports: vec!["javax.validation.constraints.NotNull".to_string()],
            is_sealed: Some(false),
            sealed_sub_types: None,
            parent_class: None,
        };

        assert_eq!(kotlin_class.name, "User");
        assert_eq!(kotlin_class.package_name, "com.example.model");
        assert_eq!(kotlin_class.properties.len(), 2);
        assert_eq!(kotlin_class.properties[0].name, "id");
        assert_eq!(kotlin_class.properties[1].name, "name");
        assert_eq!(kotlin_class.imports.len(), 1);
        assert_eq!(kotlin_class.is_sealed, Some(false));
        assert!(kotlin_class.sealed_sub_types.is_none());
        assert!(kotlin_class.parent_class.is_none());
    }

    #[test]
    fn test_kotlin_method_creation() {
        let method = KotlinMethod {
            name: "getUser".to_string(),
            http_method: "GET".to_string(),
            path: "/users/{id}".to_string(),
            summary: Some("Get user by ID".to_string()),
            description: Some("Retrieves a user by their unique identifier".to_string()),
            parameters: vec![KotlinParameter {
                name: "id".to_string(),
                kotlin_type: "Long".to_string(),
                param_type: ParameterType::Path,
                required: true,
                description: Some("User ID".to_string()),
                validation: vec!["@Min(1)".to_string()],
            }],
            request_body: None,
            return_type: "User".to_string(),
            response_description: Some("User object".to_string()),
        };

        assert_eq!(method.name, "getUser");
        assert_eq!(method.http_method, "GET");
        assert_eq!(method.path, "/users/{id}");
        assert_eq!(method.parameters.len(), 1);
        assert_eq!(method.parameters[0].name, "id");
        assert!(matches!(
            method.parameters[0].param_type,
            ParameterType::Path
        ));
        assert!(method.request_body.is_none());
        assert_eq!(method.return_type, "User");
    }

    #[test]
    fn test_parameter_type_variants() {
        let path_param = ParameterType::Path;
        let query_param = ParameterType::Query;
        let body_param = ParameterType::Body;
        let header_param = ParameterType::Header;

        assert!(matches!(path_param, ParameterType::Path));
        assert!(matches!(query_param, ParameterType::Query));
        assert!(matches!(body_param, ParameterType::Body));
        assert!(matches!(header_param, ParameterType::Header));
    }

    #[test]
    fn test_kotlin_controller_creation() {
        let controller = KotlinController {
            name: "UserController".to_string(),
            package_name: "com.example.controller".to_string(),
            description: Some("User management controller".to_string()),
            methods: vec![
                KotlinMethod {
                    name: "getAllUsers".to_string(),
                    http_method: "GET".to_string(),
                    path: "/users".to_string(),
                    summary: Some("Get all users".to_string()),
                    description: None,
                    parameters: vec![],
                    request_body: None,
                    return_type: "List<User>".to_string(),
                    response_description: Some("List of users".to_string()),
                },
                KotlinMethod {
                    name: "createUser".to_string(),
                    http_method: "POST".to_string(),
                    path: "/users".to_string(),
                    summary: Some("Create new user".to_string()),
                    description: None,
                    parameters: vec![],
                    request_body: Some(KotlinParameter {
                        name: "user".to_string(),
                        kotlin_type: "User".to_string(),
                        param_type: ParameterType::Body,
                        required: true,
                        description: Some("User to create".to_string()),
                        validation: vec!["@Valid".to_string()],
                    }),
                    return_type: "User".to_string(),
                    response_description: Some("Created user".to_string()),
                },
            ],
            imports: vec![
                "org.springframework.web.bind.annotation.*".to_string(),
                "javax.validation.Valid".to_string(),
            ],
        };

        assert_eq!(controller.name, "UserController");
        assert_eq!(controller.package_name, "com.example.controller");
        assert_eq!(controller.methods.len(), 2);
        assert_eq!(controller.methods[0].name, "getAllUsers");
        assert_eq!(controller.methods[1].name, "createUser");
        assert!(controller.methods[1].request_body.is_some());
        assert_eq!(controller.imports.len(), 2);
    }

    #[test]
    fn test_complex_schema_json_serialization() {
        let schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            format: None,
            title: Some("User".to_string()),
            description: Some("User model".to_string()),
            properties: {
                let mut props = IndexMap::new();
                props.insert(
                    "id".to_string(),
                    OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("integer".to_string()),
                        format: Some("int64".to_string()),
                        ..Default::default()
                    })),
                );
                props.insert(
                    "name".to_string(),
                    OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("string".to_string()),
                        ..Default::default()
                    })),
                );
                props
            },
            required: vec!["id".to_string(), "name".to_string()],
            additional_properties: Some(serde_json::Value::Bool(false)),
            ..Default::default()
        };

        let json_value = serde_json::to_value(&schema).unwrap();
        let back_to_schema: OpenAPISchema = serde_json::from_value(json_value).unwrap();

        assert_eq!(back_to_schema.title, Some("User".to_string()));
        assert_eq!(back_to_schema.properties.len(), 2);
        assert!(back_to_schema.properties.contains_key("id"));
        assert!(back_to_schema.properties.contains_key("name"));
        assert_eq!(back_to_schema.required.len(), 2);
        assert_eq!(back_to_schema.additional_properties, Some(serde_json::Value::Bool(false)));
    }
}
