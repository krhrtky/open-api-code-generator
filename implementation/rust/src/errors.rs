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
