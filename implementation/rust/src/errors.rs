use std::fmt;
use thiserror::Error;

#[derive(Error, Debug)]
#[allow(dead_code)]
pub enum OpenAPIError {
    #[error("File not found: {path}")]
    FileNotFound { path: String },

    #[error("Unsupported file format: {format}")]
    UnsupportedFormat { format: String },

    #[error("Invalid JSON format: {message}")]
    InvalidJson { message: String },

    #[error("Invalid YAML format: {message}")]
    InvalidYaml { message: String },

    #[error("Missing required field '{field}' at {path}")]
    MissingField { field: String, path: String },

    #[error("Unsupported OpenAPI version '{version}' at {path}")]
    UnsupportedOpenAPIVersion { version: String, path: String },

    #[error("Invalid OpenAPI specification: {message}")]
    InvalidSpec { message: String },

    #[error("External reference '{reference}' not supported at {path}")]
    ExternalReferenceNotSupported { reference: String, path: String },

    #[error("Reference '{reference}' not found at {path}")]
    ReferenceNotFound { reference: String, path: String },

    #[error("Circular reference detected: {reference}")]
    CircularReference { reference: String },

    #[error("Schema composition error in {composition_type} at {path}: {reason}")]
    SchemaCompositionError {
        composition_type: String,
        path: String,
        reason: String,
    },

    #[error("Unsupported schema type '{schema_type}' at {path}")]
    UnsupportedSchemaType { schema_type: String, path: String },

    #[error("Invalid property name '{property}' at {path}")]
    InvalidPropertyName { property: String, path: String },

    #[error("Template generation failed for {component}: {reason}")]
    TemplateGenerationFailed { component: String, reason: String },

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON parsing error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("YAML parsing error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

#[derive(Debug, Clone)]
pub struct ErrorContext {
    pub schema_path: Vec<String>,
    pub line: Option<u32>,
    pub column: Option<u32>,
    pub suggestion: Option<String>,
    pub error_code: Option<String>,
}

impl Default for ErrorContext {
    fn default() -> Self {
        Self::new()
    }
}

impl ErrorContext {
    #[allow(dead_code)]
    pub fn new() -> Self {
        Self {
            schema_path: Vec::new(),
            line: None,
            column: None,
            suggestion: None,
            error_code: None,
        }
    }

    #[allow(dead_code)]
    pub fn with_path(mut self, path: Vec<String>) -> Self {
        self.schema_path = path;
        self
    }

    #[allow(dead_code)]
    pub fn with_location(mut self, line: u32, column: u32) -> Self {
        self.line = Some(line);
        self.column = Some(column);
        self
    }

    #[allow(dead_code)]
    pub fn with_suggestion<S: Into<String>>(mut self, suggestion: S) -> Self {
        self.suggestion = Some(suggestion.into());
        self
    }

    #[allow(dead_code)]
    pub fn with_error_code<S: Into<String>>(mut self, code: S) -> Self {
        self.error_code = Some(code.into());
        self
    }
}

impl fmt::Display for ErrorContext {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if !self.schema_path.is_empty() {
            write!(f, " at path: {}", self.schema_path.join("."))?;
        }

        if let (Some(line), Some(column)) = (self.line, self.column) {
            write!(f, " (line {}, column {})", line, column)?;
        }

        if let Some(code) = &self.error_code {
            write!(f, " [{}]", code)?;
        }

        if let Some(suggestion) = &self.suggestion {
            write!(f, "\nSuggestion: {}", suggestion)?;
        }

        Ok(())
    }
}

pub type Result<T> = std::result::Result<T, OpenAPIError>;

// Error creation helper functions
pub fn file_not_found<P: AsRef<str>>(path: P) -> OpenAPIError {
    OpenAPIError::FileNotFound {
        path: path.as_ref().to_string(),
    }
}

pub fn unsupported_format<F: AsRef<str>>(format: F) -> OpenAPIError {
    OpenAPIError::UnsupportedFormat {
        format: format.as_ref().to_string(),
    }
}

pub fn invalid_json<M: AsRef<str>>(message: M) -> OpenAPIError {
    OpenAPIError::InvalidJson {
        message: message.as_ref().to_string(),
    }
}

pub fn invalid_yaml<M: AsRef<str>>(message: M) -> OpenAPIError {
    OpenAPIError::InvalidYaml {
        message: message.as_ref().to_string(),
    }
}

pub fn missing_field<F: AsRef<str>, P: AsRef<str>>(field: F, path: P) -> OpenAPIError {
    OpenAPIError::MissingField {
        field: field.as_ref().to_string(),
        path: path.as_ref().to_string(),
    }
}

pub fn unsupported_openapi_version<V: AsRef<str>, P: AsRef<str>>(
    version: V,
    path: P,
) -> OpenAPIError {
    OpenAPIError::UnsupportedOpenAPIVersion {
        version: version.as_ref().to_string(),
        path: path.as_ref().to_string(),
    }
}

#[allow(dead_code)]
pub fn invalid_spec<M: AsRef<str>>(message: M) -> OpenAPIError {
    OpenAPIError::InvalidSpec {
        message: message.as_ref().to_string(),
    }
}

pub fn external_reference_not_supported<R: AsRef<str>, P: AsRef<str>>(
    reference: R,
    path: P,
) -> OpenAPIError {
    OpenAPIError::ExternalReferenceNotSupported {
        reference: reference.as_ref().to_string(),
        path: path.as_ref().to_string(),
    }
}

pub fn reference_not_found<R: AsRef<str>, P: AsRef<str>>(reference: R, path: P) -> OpenAPIError {
    OpenAPIError::ReferenceNotFound {
        reference: reference.as_ref().to_string(),
        path: path.as_ref().to_string(),
    }
}

#[allow(dead_code)]
pub fn circular_reference<R: AsRef<str>>(reference: R) -> OpenAPIError {
    OpenAPIError::CircularReference {
        reference: reference.as_ref().to_string(),
    }
}

#[allow(dead_code)]
pub fn schema_composition_error<T: AsRef<str>, P: AsRef<str>, R: AsRef<str>>(
    composition_type: T,
    path: P,
    reason: R,
) -> OpenAPIError {
    OpenAPIError::SchemaCompositionError {
        composition_type: composition_type.as_ref().to_string(),
        path: path.as_ref().to_string(),
        reason: reason.as_ref().to_string(),
    }
}

#[allow(dead_code)]
pub fn unsupported_schema_type<T: AsRef<str>, P: AsRef<str>>(
    schema_type: T,
    path: P,
) -> OpenAPIError {
    OpenAPIError::UnsupportedSchemaType {
        schema_type: schema_type.as_ref().to_string(),
        path: path.as_ref().to_string(),
    }
}

#[allow(dead_code)]
pub fn invalid_property_name<N: AsRef<str>, P: AsRef<str>>(property: N, path: P) -> OpenAPIError {
    OpenAPIError::InvalidPropertyName {
        property: property.as_ref().to_string(),
        path: path.as_ref().to_string(),
    }
}

#[allow(dead_code)]
pub fn template_generation_failed<C: AsRef<str>, R: AsRef<str>>(
    component: C,
    reason: R,
) -> OpenAPIError {
    OpenAPIError::TemplateGenerationFailed {
        component: component.as_ref().to_string(),
        reason: reason.as_ref().to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;

    #[test]
    fn test_error_creation_file_not_found() {
        let error = file_not_found("missing.yaml");
        match error {
            OpenAPIError::FileNotFound { path } => {
                assert_eq!(path, "missing.yaml");
            }
            _ => panic!("Expected FileNotFound error"),
        }
    }

    #[test]
    fn test_error_display_file_not_found() {
        let error = file_not_found("test.yaml");
        assert_eq!(error.to_string(), "File not found: test.yaml");
    }

    #[test]
    fn test_error_creation_unsupported_format() {
        let error = unsupported_format("xml");
        match error {
            OpenAPIError::UnsupportedFormat { format } => {
                assert_eq!(format, "xml");
            }
            _ => panic!("Expected UnsupportedFormat error"),
        }
    }

    #[test]
    fn test_error_display_unsupported_format() {
        let error = unsupported_format("xml");
        assert_eq!(error.to_string(), "Unsupported file format: xml");
    }

    #[test]
    fn test_error_creation_invalid_json() {
        let error = invalid_json("unexpected token");
        match error {
            OpenAPIError::InvalidJson { message } => {
                assert_eq!(message, "unexpected token");
            }
            _ => panic!("Expected InvalidJson error"),
        }
    }

    #[test]
    fn test_error_display_invalid_json() {
        let error = invalid_json("syntax error");
        assert_eq!(error.to_string(), "Invalid JSON format: syntax error");
    }

    #[test]
    fn test_error_creation_invalid_yaml() {
        let error = invalid_yaml("invalid syntax");
        match error {
            OpenAPIError::InvalidYaml { message } => {
                assert_eq!(message, "invalid syntax");
            }
            _ => panic!("Expected InvalidYaml error"),
        }
    }

    #[test]
    fn test_error_display_invalid_yaml() {
        let error = invalid_yaml("parsing error");
        assert_eq!(error.to_string(), "Invalid YAML format: parsing error");
    }

    #[test]
    fn test_error_creation_missing_field() {
        let error = missing_field("version", "$.info");
        match error {
            OpenAPIError::MissingField { field, path } => {
                assert_eq!(field, "version");
                assert_eq!(path, "$.info");
            }
            _ => panic!("Expected MissingField error"),
        }
    }

    #[test]
    fn test_error_display_missing_field() {
        let error = missing_field("title", "$.info");
        assert_eq!(
            error.to_string(),
            "Missing required field 'title' at $.info"
        );
    }

    #[test]
    fn test_error_creation_unsupported_openapi_version() {
        let error = unsupported_openapi_version("2.0", "$.openapi");
        match error {
            OpenAPIError::UnsupportedOpenAPIVersion { version, path } => {
                assert_eq!(version, "2.0");
                assert_eq!(path, "$.openapi");
            }
            _ => panic!("Expected UnsupportedOpenAPIVersion error"),
        }
    }

    #[test]
    fn test_error_display_unsupported_openapi_version() {
        let error = unsupported_openapi_version("2.0", "$.openapi");
        assert_eq!(
            error.to_string(),
            "Unsupported OpenAPI version '2.0' at $.openapi"
        );
    }

    #[test]
    fn test_error_creation_invalid_spec() {
        let error = invalid_spec("malformed specification");
        match error {
            OpenAPIError::InvalidSpec { message } => {
                assert_eq!(message, "malformed specification");
            }
            _ => panic!("Expected InvalidSpec error"),
        }
    }

    #[test]
    fn test_error_display_invalid_spec() {
        let error = invalid_spec("schema validation failed");
        assert_eq!(
            error.to_string(),
            "Invalid OpenAPI specification: schema validation failed"
        );
    }

    #[test]
    fn test_error_creation_external_reference_not_supported() {
        let error = external_reference_not_supported(
            "external.yaml#/components/schemas/User",
            "$.paths./users.get",
        );
        match error {
            OpenAPIError::ExternalReferenceNotSupported { reference, path } => {
                assert_eq!(reference, "external.yaml#/components/schemas/User");
                assert_eq!(path, "$.paths./users.get");
            }
            _ => panic!("Expected ExternalReferenceNotSupported error"),
        }
    }

    #[test]
    fn test_error_display_external_reference_not_supported() {
        let error = external_reference_not_supported("external.yaml#/User", "$.paths");
        assert_eq!(
            error.to_string(),
            "External reference 'external.yaml#/User' not supported at $.paths"
        );
    }

    #[test]
    fn test_error_creation_reference_not_found() {
        let error = reference_not_found(
            "#/components/schemas/User",
            "$.paths./users.get.responses.200",
        );
        match error {
            OpenAPIError::ReferenceNotFound { reference, path } => {
                assert_eq!(reference, "#/components/schemas/User");
                assert_eq!(path, "$.paths./users.get.responses.200");
            }
            _ => panic!("Expected ReferenceNotFound error"),
        }
    }

    #[test]
    fn test_error_display_reference_not_found() {
        let error = reference_not_found("#/components/schemas/Missing", "$.components");
        assert_eq!(
            error.to_string(),
            "Reference '#/components/schemas/Missing' not found at $.components"
        );
    }

    #[test]
    fn test_error_creation_circular_reference() {
        let error = circular_reference("#/components/schemas/User");
        match error {
            OpenAPIError::CircularReference { reference } => {
                assert_eq!(reference, "#/components/schemas/User");
            }
            _ => panic!("Expected CircularReference error"),
        }
    }

    #[test]
    fn test_error_display_circular_reference() {
        let error = circular_reference("#/components/schemas/SelfRef");
        assert_eq!(
            error.to_string(),
            "Circular reference detected: #/components/schemas/SelfRef"
        );
    }

    #[test]
    fn test_error_creation_schema_composition_error() {
        let error = schema_composition_error(
            "allOf",
            "$.components.schemas.User",
            "conflicting properties",
        );
        match error {
            OpenAPIError::SchemaCompositionError {
                composition_type,
                path,
                reason,
            } => {
                assert_eq!(composition_type, "allOf");
                assert_eq!(path, "$.components.schemas.User");
                assert_eq!(reason, "conflicting properties");
            }
            _ => panic!("Expected SchemaCompositionError error"),
        }
    }

    #[test]
    fn test_error_display_schema_composition_error() {
        let error =
            schema_composition_error("oneOf", "$.components.schemas.Pet", "multiple matches");
        assert_eq!(
            error.to_string(),
            "Schema composition error in oneOf at $.components.schemas.Pet: multiple matches"
        );
    }

    #[test]
    fn test_error_creation_unsupported_schema_type() {
        let error = unsupported_schema_type("unknown", "$.components.schemas.Custom");
        match error {
            OpenAPIError::UnsupportedSchemaType { schema_type, path } => {
                assert_eq!(schema_type, "unknown");
                assert_eq!(path, "$.components.schemas.Custom");
            }
            _ => panic!("Expected UnsupportedSchemaType error"),
        }
    }

    #[test]
    fn test_error_display_unsupported_schema_type() {
        let error = unsupported_schema_type("matrix", "$.components.schemas.Math");
        assert_eq!(
            error.to_string(),
            "Unsupported schema type 'matrix' at $.components.schemas.Math"
        );
    }

    #[test]
    fn test_error_creation_invalid_property_name() {
        let error = invalid_property_name("class", "$.components.schemas.User.properties");
        match error {
            OpenAPIError::InvalidPropertyName { property, path } => {
                assert_eq!(property, "class");
                assert_eq!(path, "$.components.schemas.User.properties");
            }
            _ => panic!("Expected InvalidPropertyName error"),
        }
    }

    #[test]
    fn test_error_display_invalid_property_name() {
        let error = invalid_property_name("return", "$.components.schemas.Response.properties");
        assert_eq!(
            error.to_string(),
            "Invalid property name 'return' at $.components.schemas.Response.properties"
        );
    }

    #[test]
    fn test_error_creation_template_generation_failed() {
        let error = template_generation_failed("UserService", "missing template file");
        match error {
            OpenAPIError::TemplateGenerationFailed { component, reason } => {
                assert_eq!(component, "UserService");
                assert_eq!(reason, "missing template file");
            }
            _ => panic!("Expected TemplateGenerationFailed error"),
        }
    }

    #[test]
    fn test_error_display_template_generation_failed() {
        let error = template_generation_failed("ApiClient", "syntax error in template");
        assert_eq!(
            error.to_string(),
            "Template generation failed for ApiClient: syntax error in template"
        );
    }

    #[test]
    fn test_error_from_io_error() {
        let io_error = io::Error::new(io::ErrorKind::NotFound, "File not found");
        let error: OpenAPIError = io_error.into();
        match error {
            OpenAPIError::Io(_) => {}
            _ => panic!("Expected Io error conversion"),
        }
    }

    #[test]
    fn test_error_from_json_error() {
        let json_str = "{ invalid json }";
        let json_error = serde_json::from_str::<serde_json::Value>(json_str).unwrap_err();
        let error: OpenAPIError = json_error.into();
        match error {
            OpenAPIError::Json(_) => {}
            _ => panic!("Expected Json error conversion"),
        }
    }

    #[test]
    fn test_error_from_yaml_error() {
        let yaml_str = "invalid: yaml: content:";
        let yaml_error = serde_yaml::from_str::<serde_yaml::Value>(yaml_str).unwrap_err();
        let error: OpenAPIError = yaml_error.into();
        match error {
            OpenAPIError::Yaml(_) => {}
            _ => panic!("Expected Yaml error conversion"),
        }
    }

    #[test]
    fn test_error_context_creation() {
        let context = ErrorContext::new();
        assert!(context.schema_path.is_empty());
        assert!(context.line.is_none());
        assert!(context.column.is_none());
        assert!(context.suggestion.is_none());
        assert!(context.error_code.is_none());
    }

    #[test]
    fn test_error_context_default() {
        let context = ErrorContext::default();
        assert!(context.schema_path.is_empty());
        assert!(context.line.is_none());
        assert!(context.column.is_none());
        assert!(context.suggestion.is_none());
        assert!(context.error_code.is_none());
    }

    #[test]
    fn test_error_context_with_path() {
        let context =
            ErrorContext::new().with_path(vec!["components".to_string(), "schemas".to_string()]);
        assert_eq!(context.schema_path, vec!["components", "schemas"]);
    }

    #[test]
    fn test_error_context_with_location() {
        let context = ErrorContext::new().with_location(10, 5);
        assert_eq!(context.line, Some(10));
        assert_eq!(context.column, Some(5));
    }

    #[test]
    fn test_error_context_with_suggestion() {
        let context = ErrorContext::new().with_suggestion("Add missing field");
        assert_eq!(context.suggestion, Some("Add missing field".to_string()));
    }

    #[test]
    fn test_error_context_with_error_code() {
        let context = ErrorContext::new().with_error_code("E001");
        assert_eq!(context.error_code, Some("E001".to_string()));
    }

    #[test]
    fn test_error_context_display_empty() {
        let context = ErrorContext::new();
        assert_eq!(context.to_string(), "");
    }

    #[test]
    fn test_error_context_display_with_path() {
        let context =
            ErrorContext::new().with_path(vec!["components".to_string(), "schemas".to_string()]);
        assert_eq!(context.to_string(), " at path: components.schemas");
    }

    #[test]
    fn test_error_context_display_with_location() {
        let context = ErrorContext::new().with_location(10, 5);
        assert_eq!(context.to_string(), " (line 10, column 5)");
    }

    #[test]
    fn test_error_context_display_with_error_code() {
        let context = ErrorContext::new().with_error_code("E001");
        assert_eq!(context.to_string(), " [E001]");
    }

    #[test]
    fn test_error_context_display_with_suggestion() {
        let context = ErrorContext::new().with_suggestion("Try fixing this");
        assert_eq!(context.to_string(), "\nSuggestion: Try fixing this");
    }

    #[test]
    fn test_error_context_display_complete() {
        let context = ErrorContext::new()
            .with_path(vec!["components".to_string(), "schemas".to_string()])
            .with_location(15, 8)
            .with_error_code("E002")
            .with_suggestion("Add the missing version field");

        let expected = " at path: components.schemas (line 15, column 8) [E002]\nSuggestion: Add the missing version field";
        assert_eq!(context.to_string(), expected);
    }

    #[test]
    fn test_error_context_chaining() {
        let context = ErrorContext::new()
            .with_path(vec!["info".to_string()])
            .with_location(1, 1)
            .with_error_code("E003")
            .with_suggestion("Check the documentation");

        assert_eq!(context.schema_path, vec!["info"]);
        assert_eq!(context.line, Some(1));
        assert_eq!(context.column, Some(1));
        assert_eq!(context.error_code, Some("E003".to_string()));
        assert_eq!(
            context.suggestion,
            Some("Check the documentation".to_string())
        );
    }
}
