use indexmap::IndexMap;
use std::collections::HashSet;
use std::path::Path;
use tokio::fs;

use crate::errors::{self, Result};
use crate::types::*;

/// Type alias for operations grouped by tag.
/// Maps tag names to a vector of tuples containing (path, method, operation).
type TaggedOperations<'a> =
    std::collections::HashMap<String, Vec<(String, String, &'a OpenAPIOperation)>>;

/// OpenAPI specification parser that handles parsing, validation, and schema resolution.
///
/// The parser supports:
/// - JSON and YAML file formats
/// - OpenAPI 3.x specifications
/// - Schema reference resolution
/// - Schema composition (allOf, oneOf, anyOf)
/// - Tag and operation extraction
///
/// # Examples
///
/// ```rust
/// use openapi_codegen_rust::parser::OpenAPIParser;
///
/// let parser = OpenAPIParser::new();
/// // Use in async context:
/// // let spec = parser.parse_file("api.yaml").await.unwrap();
/// // println!("API Title: {}", spec.info.title);
/// ```
pub struct OpenAPIParser {
    /// The parsed OpenAPI specification. None until a file is successfully parsed.
    spec: Option<OpenAPISpec>,
}

impl Default for OpenAPIParser {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenAPIParser {
    /// Creates a new OpenAPI parser instance.
    ///
    /// # Returns
    ///
    /// A new parser with no parsed specification.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    ///
    /// let parser = OpenAPIParser::new();
    /// // Parser is ready to parse OpenAPI specifications
    /// ```
    pub fn new() -> Self {
        Self { spec: None }
    }

    /// Parses an OpenAPI specification file (JSON or YAML).
    ///
    /// Supports both `.json` and `.yaml`/`.yml` file extensions.
    /// The file content is validated against OpenAPI 3.x requirements.
    ///
    /// # Arguments
    ///
    /// * `file_path` - Path to the OpenAPI specification file
    ///
    /// # Returns
    ///
    /// A reference to the parsed OpenAPI specification on success.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - File doesn't exist or can't be read
    /// - File format is unsupported
    /// - JSON/YAML parsing fails
    /// - OpenAPI specification is invalid
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    ///
    /// let mut parser = OpenAPIParser::new();
    /// // Use in async context:
    /// // let spec = parser.parse_file("api.yaml").await.unwrap();
    /// // println!("Parsing successful: {}", spec.info.title);
    /// ```
    pub async fn parse_file<P: AsRef<Path>>(&mut self, file_path: P) -> Result<&OpenAPISpec> {
        let path = file_path.as_ref();

        let content = fs::read_to_string(path)
            .await
            .map_err(|_| errors::file_not_found(path.display().to_string()))?;

        let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");

        let spec = match extension {
            "json" => serde_json::from_str::<OpenAPISpec>(&content)
                .map_err(|e| errors::invalid_json(e.to_string()))?,
            "yaml" | "yml" => serde_yaml::from_str::<OpenAPISpec>(&content)
                .map_err(|e| errors::invalid_yaml(e.to_string()))?,
            _ => {
                return Err(errors::unsupported_format(extension));
            }
        };

        self.validate_spec(&spec)?;
        self.spec = Some(spec);
        Ok(self.spec.as_ref().unwrap())
    }

    /// Validates an OpenAPI specification for required fields and version compatibility.
    ///
    /// # Arguments
    ///
    /// * `spec` - The OpenAPI specification to validate
    ///
    /// # Returns
    ///
    /// `Ok(())` if validation passes.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - OpenAPI version is not 3.x
    /// - Required fields (title, version) are missing or empty
    fn validate_spec(&self, spec: &OpenAPISpec) -> Result<()> {
        if !spec.openapi.starts_with("3.") {
            return Err(errors::unsupported_openapi_version(
                &spec.openapi,
                "openapi",
            ));
        }

        if spec.info.title.is_empty() {
            return Err(errors::missing_field("title", "info.title"));
        }

        if spec.info.version.is_empty() {
            return Err(errors::missing_field("version", "info.version"));
        }

        // Note: Empty paths are allowed for specs that only define models

        Ok(())
    }

    /// Resolves a JSON Pointer reference to an OpenAPI schema.
    ///
    /// Only supports internal references (starting with "#/").
    /// External references are not supported.
    ///
    /// # Arguments
    ///
    /// * `reference` - JSON Pointer reference string (e.g., "#/components/schemas/User")
    ///
    /// # Returns
    ///
    /// A reference to the resolved schema.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Reference is external (not starting with "#/")
    /// - Referenced schema doesn't exist
    /// - Reference path is invalid
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    ///
    /// // Note: parser must have a parsed specification first
    /// let parser = OpenAPIParser::new();
    /// // Parse a spec first, then:
    /// // let schema = parser.resolve_reference("#/components/schemas/User").unwrap();
    /// // println!("Schema type: {:?}", schema.schema_type);
    /// ```
    pub fn resolve_reference(&self, reference: &str) -> Result<&OpenAPISchema> {
        self.resolve_reference_with_visited(reference, &mut std::collections::HashSet::new())
    }

    fn resolve_reference_with_visited(
        &self,
        reference: &str,
        visited: &mut std::collections::HashSet<String>,
    ) -> Result<&OpenAPISchema> {
        // Check for circular reference
        if visited.contains(reference) {
            return Err(errors::circular_reference(reference));
        }
        visited.insert(reference.to_string());

        let spec = self.spec.as_ref().unwrap();

        if !reference.starts_with("#/") {
            return Err(errors::external_reference_not_supported(reference, "$ref"));
        }

        let parts: Vec<&str> = reference[2..].split('/').collect();

        if parts.len() >= 3 && parts[0] == "components" && parts[1] == "schemas" {
            let schema_name = parts[2];
            if let Some(components) = &spec.components {
                if let Some(schema_or_ref) = components.schemas.get(schema_name) {
                    return match schema_or_ref {
                        OpenAPISchemaOrRef::Schema(schema) => Ok(schema),
                        OpenAPISchemaOrRef::Reference(ref_obj) => {
                            self.resolve_reference_with_visited(&ref_obj.reference, visited)
                        }
                    };
                }
            }
        }

        Err(errors::reference_not_found(reference, parts.join("/")))
    }

    /// Resolves a schema or schema reference, handling composition patterns.
    ///
    /// Supports allOf, oneOf, and anyOf schema composition patterns.
    /// For composition schemas, the result is a flattened schema with
    /// composition-specific variants stored in separate fields.
    ///
    /// # Arguments
    ///
    /// * `schema_or_ref` - Either a direct schema or a reference to resolve
    ///
    /// # Returns
    ///
    /// A boxed resolved schema with composition patterns processed.
    ///
    /// # Errors
    ///
    /// Returns an error if schema references cannot be resolved.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    /// use openapi_codegen_rust::types::{OpenAPISchemaOrRef, OpenAPIReference};
    ///
    /// // Note: parser must have a parsed specification first
    /// let parser = OpenAPIParser::new();
    /// // Parse a spec first, then:
    /// let ref_obj = OpenAPIReference { reference: "#/components/schemas/User".to_string() };
    /// let schema_ref = OpenAPISchemaOrRef::Reference(ref_obj);
    /// // let resolved = parser.resolve_schema(&schema_ref).unwrap();
    /// // println!("Resolved schema properties: {}", resolved.properties.len());
    /// ```
    pub fn resolve_schema(&self, schema_or_ref: &OpenAPISchemaOrRef) -> Result<Box<OpenAPISchema>> {
        match schema_or_ref {
            OpenAPISchemaOrRef::Schema(schema) => {
                // Handle allOf schema composition
                if !schema.all_of.is_empty() {
                    self.resolve_all_of_schema(schema, &schema.all_of)
                } else if !schema.one_of.is_empty() {
                    self.resolve_one_of_schema(schema, &schema.one_of)
                } else if !schema.any_of.is_empty() {
                    self.resolve_any_of_schema(schema, &schema.any_of)
                } else {
                    Ok(schema.clone())
                }
            }
            OpenAPISchemaOrRef::Reference(reference) => {
                let resolved = self.resolve_reference(&reference.reference)?;
                // Handle allOf schema composition for resolved reference
                if !resolved.all_of.is_empty() {
                    self.resolve_all_of_schema(resolved, &resolved.all_of)
                } else if !resolved.one_of.is_empty() {
                    self.resolve_one_of_schema(resolved, &resolved.one_of)
                } else if !resolved.any_of.is_empty() {
                    self.resolve_any_of_schema(resolved, &resolved.any_of)
                } else {
                    Ok(Box::new(resolved.clone()))
                }
            }
        }
    }

    fn resolve_all_of_schema(
        &self,
        base_schema: &OpenAPISchema,
        all_of: &[OpenAPISchemaOrRef],
    ) -> Result<Box<OpenAPISchema>> {
        let mut resolved_schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties: IndexMap::new(),
            required: Vec::new(),
            title: base_schema.title.clone(),
            description: base_schema.description.clone(),
            example: base_schema.example.clone(),
            ..base_schema.clone()
        };

        // Clear allOf from resolved schema
        resolved_schema.all_of = Vec::new();

        // Merge all schemas in allOf array
        for sub_schema_or_ref in all_of {
            let sub_schema = match sub_schema_or_ref {
                OpenAPISchemaOrRef::Schema(schema) => {
                    // Check if this schema has nested allOf that needs resolving
                    if !schema.all_of.is_empty() {
                        // Recursively resolve nested allOf (but not oneOf/anyOf to avoid complexity)
                        self.resolve_all_of_schema(schema, &schema.all_of)?
                    } else {
                        schema.clone()
                    }
                }
                OpenAPISchemaOrRef::Reference(reference) => {
                    // Resolve the reference to get the actual schema
                    let referenced_schema = self.resolve_reference(&reference.reference)?;
                    // If the referenced schema has allOf, resolve it
                    if !referenced_schema.all_of.is_empty() {
                        self.resolve_all_of_schema(referenced_schema, &referenced_schema.all_of)?
                    } else {
                        Box::new(referenced_schema.clone())
                    }
                }
            };

            // Merge properties
            for (prop_name, prop_schema) in &sub_schema.properties {
                resolved_schema
                    .properties
                    .insert(prop_name.clone(), prop_schema.clone());
            }

            // Merge required fields
            for required_field in &sub_schema.required {
                if !resolved_schema.required.contains(required_field) {
                    resolved_schema.required.push(required_field.clone());
                }
            }

            // Merge other schema properties (if not already set)
            if resolved_schema.title.is_none() && sub_schema.title.is_some() {
                resolved_schema.title = sub_schema.title.clone();
            }
            if resolved_schema.description.is_none() && sub_schema.description.is_some() {
                resolved_schema.description = sub_schema.description.clone();
            }
            if resolved_schema.example.is_none() && sub_schema.example.is_some() {
                resolved_schema.example = sub_schema.example.clone();
            }
        }

        Ok(Box::new(resolved_schema))
    }

    fn resolve_one_of_schema(
        &self,
        base_schema: &OpenAPISchema,
        one_of: &[OpenAPISchemaOrRef],
    ) -> Result<Box<OpenAPISchema>> {
        let mut resolved_schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties: IndexMap::new(),
            required: Vec::new(),
            title: base_schema.title.clone(),
            description: base_schema.description.clone(),
            example: base_schema.example.clone(),
            ..base_schema.clone()
        };

        // Clear oneOf from resolved schema
        resolved_schema.one_of = Vec::new();

        // Store oneOf variants for code generation (using description or generate names)
        let mut one_of_variants = Vec::new();
        for (index, variant_ref) in one_of.iter().enumerate() {
            let variant_schema = match variant_ref {
                OpenAPISchemaOrRef::Schema(schema) => (**schema).clone(),
                OpenAPISchemaOrRef::Reference(reference) => {
                    self.resolve_reference(&reference.reference)?.clone()
                }
            };

            let variant_name = variant_schema
                .title
                .clone()
                .unwrap_or_else(|| format!("Variant{}", index + 1));

            one_of_variants.push((variant_name, variant_schema));
        }

        // Store variants in a custom field for code generation
        resolved_schema.one_of_variants = Some(one_of_variants);

        // If discriminator is specified, add discriminator property
        if let Some(discriminator) = &base_schema.discriminator {
            let discriminator_property = &discriminator.property_name;
            if !resolved_schema
                .properties
                .contains_key(discriminator_property)
            {
                resolved_schema.properties.insert(
                    discriminator_property.clone(),
                    crate::types::OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("string".to_string()),
                        ..Default::default()
                    })),
                );
            }
            if !resolved_schema.required.contains(discriminator_property) {
                resolved_schema
                    .required
                    .push(discriminator_property.clone());
            }
        }

        Ok(Box::new(resolved_schema))
    }

    fn resolve_any_of_schema(
        &self,
        base_schema: &OpenAPISchema,
        any_of: &[OpenAPISchemaOrRef],
    ) -> Result<Box<OpenAPISchema>> {
        let mut resolved_schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties: IndexMap::new(),
            required: Vec::new(),
            title: base_schema.title.clone(),
            description: base_schema.description.clone(),
            example: base_schema.example.clone(),
            ..base_schema.clone()
        };

        // Clear anyOf from resolved schema
        resolved_schema.any_of = Vec::new();

        // Store anyOf variants for code generation
        let mut any_of_variants = Vec::new();
        for (index, variant_ref) in any_of.iter().enumerate() {
            let variant_schema = match variant_ref {
                OpenAPISchemaOrRef::Schema(schema) => (**schema).clone(),
                OpenAPISchemaOrRef::Reference(reference) => {
                    self.resolve_reference(&reference.reference)?.clone()
                }
            };

            let variant_name = variant_schema
                .title
                .clone()
                .unwrap_or_else(|| format!("Option{}", index + 1));

            any_of_variants.push((variant_name, variant_schema));
        }

        // Store variants in the schema for code generation
        resolved_schema.any_of_variants = Some(any_of_variants);

        // anyOf allows combining multiple schemas, so we merge all possible properties
        let mut all_properties = IndexMap::new();
        let mut all_required = std::collections::HashSet::new();

        // Collect all properties from all variants
        for variant_ref in any_of {
            let variant_schema = match variant_ref {
                OpenAPISchemaOrRef::Schema(schema) => schema,
                OpenAPISchemaOrRef::Reference(reference) => {
                    self.resolve_reference(&reference.reference)?
                }
            };

            // Merge properties (union of all properties)
            for (prop_name, prop_schema) in &variant_schema.properties {
                all_properties.insert(prop_name.clone(), prop_schema.clone());
            }

            // For anyOf, include all possible required fields (union of requirements)
            for required_field in &variant_schema.required {
                all_required.insert(required_field.clone());
            }
        }

        // Set all possible properties and required fields
        resolved_schema.properties = all_properties;
        resolved_schema.required = all_required.into_iter().collect();

        Ok(Box::new(resolved_schema))
    }

    #[allow(dead_code)]
    pub fn extract_schema_name(reference: &str) -> String {
        if reference.is_empty() {
            return "Unknown".to_string();
        }
        reference
            .split('/')
            .next_back()
            .filter(|s| !s.is_empty())
            .unwrap_or("Unknown")
            .to_string()
    }

    /// Extracts and resolves all schemas from the OpenAPI specification.
    ///
    /// Returns a vector of tuples containing schema names and their resolved definitions.
    /// All schema references and compositions are fully resolved.
    ///
    /// # Returns
    ///
    /// A vector of (schema_name, resolved_schema) tuples.
    ///
    /// # Errors
    ///
    /// Returns an error if any schema reference cannot be resolved.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    ///
    /// // Note: parser must have a parsed specification first
    /// let parser = OpenAPIParser::new();
    /// // Parse a spec first, then:
    /// // let schemas = parser.get_all_schemas().unwrap();
    /// // for (name, schema) in schemas {
    /// //     println!("Schema {}: {} properties", name, schema.properties.len());
    /// // }
    /// ```
    pub fn get_all_schemas(&self) -> Result<Vec<(String, Box<OpenAPISchema>)>> {
        let spec = self.spec.as_ref().unwrap();
        let mut schemas = Vec::new();

        if let Some(components) = &spec.components {
            for (name, schema_or_ref) in &components.schemas {
                let schema = self.resolve_schema(schema_or_ref)?;
                schemas.push((name.clone(), schema));
            }
        }

        Ok(schemas)
    }

    /// Extracts all unique tags from the OpenAPI specification.
    ///
    /// Collects tags from both the global tags section and from individual operations.
    /// Returns a sorted list of unique tag names.
    ///
    /// # Returns
    ///
    /// A sorted vector of unique tag names.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    ///
    /// // Note: parser must have a parsed specification first
    /// let parser = OpenAPIParser::new();
    /// // Parse a spec first, then:
    /// // let tags = parser.get_all_tags();
    /// // for tag in tags {
    /// //     println!("Found tag: {}", tag);
    /// // }
    /// ```
    #[allow(dead_code)]
    pub fn get_all_tags(&self) -> Vec<String> {
        let spec = self.spec.as_ref().unwrap();
        let mut tags = HashSet::new();

        // From global tags
        for tag in &spec.tags {
            tags.insert(tag.name.clone());
        }

        // From operations
        for path_item in spec.paths.values() {
            let operations = [
                &path_item.get,
                &path_item.post,
                &path_item.put,
                &path_item.delete,
                &path_item.patch,
                &path_item.head,
                &path_item.options,
                &path_item.trace,
            ];

            for operation in operations.iter().copied().flatten() {
                for tag in &operation.tags {
                    tags.insert(tag.clone());
                }
            }
        }

        let mut result: Vec<String> = tags.into_iter().collect();
        result.sort();
        result
    }

    /// Groups all API operations by their tags.
    ///
    /// Operations without tags are grouped under the "Default" tag.
    /// Returns a mapping from tag names to lists of operations.
    ///
    /// # Returns
    ///
    /// A HashMap mapping tag names to vectors of (path, method, operation) tuples.
    ///
    /// # Errors
    ///
    /// Currently doesn't return errors, but signature is Result for future extensibility.
    ///
    /// # Examples
    ///
    /// ```rust
    /// use openapi_codegen_rust::parser::OpenAPIParser;
    ///
    /// // Note: parser must have a parsed specification first
    /// let parser = OpenAPIParser::new();
    /// // Parse a spec first, then:
    /// // let operations = parser.get_operations_by_tag().unwrap();
    /// // for (tag, ops) in operations {
    /// //     println!("Tag {}: {} operations", tag, ops.len());
    /// // }
    /// ```
    pub fn get_operations_by_tag(&self) -> Result<TaggedOperations<'_>> {
        let spec = self.spec.as_ref().unwrap();
        let mut tagged_operations = std::collections::HashMap::new();

        for (path_str, path_item) in &spec.paths {
            let operations = [
                ("get", &path_item.get),
                ("post", &path_item.post),
                ("put", &path_item.put),
                ("delete", &path_item.delete),
                ("patch", &path_item.patch),
                ("head", &path_item.head),
                ("options", &path_item.options),
                ("trace", &path_item.trace),
            ];

            for (method, operation_opt) in operations {
                if let Some(operation) = operation_opt {
                    let tags = if operation.tags.is_empty() {
                        vec!["Default".to_string()]
                    } else {
                        operation.tags.clone()
                    };

                    for tag in tags {
                        tagged_operations.entry(tag).or_insert_with(Vec::new).push((
                            path_str.clone(),
                            method.to_string(),
                            operation,
                        ));
                    }
                }
            }
        }

        Ok(tagged_operations)
    }

    #[allow(dead_code)]
    pub fn get_spec(&self) -> &OpenAPISpec {
        self.spec.as_ref().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use indexmap::IndexMap;
    use serde_json::json;
    use std::fs;
    use tempfile::TempDir;

    /// Creates a minimal valid OpenAPI spec for testing
    fn create_minimal_spec() -> OpenAPISpec {
        OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "Test API".to_string(),
                version: "1.0.0".to_string(),
                description: Some("Test API description".to_string()),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: None,
            tags: Vec::new(),
            servers: Vec::new(),
            security: Vec::new(),
            ..Default::default()
        }
    }

    /// Creates an OpenAPI spec with schemas for testing schema resolution
    fn create_spec_with_schemas() -> OpenAPISpec {
        let mut schemas = IndexMap::new();

        // Simple schema
        schemas.insert(
            "User".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "id".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("integer".to_string()),
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
                ..Default::default()
            })),
        );

        // Schema with reference
        schemas.insert(
            "Profile".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "user".to_string(),
                        OpenAPISchemaOrRef::Reference(OpenAPIReference {
                            reference: "#/components/schemas/User".to_string(),
                        }),
                    );
                    props.insert(
                        "bio".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                ..Default::default()
            })),
        );

        OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "Schema Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    /// Creates an OpenAPI spec with allOf composition for testing
    fn create_spec_with_all_of() -> OpenAPISpec {
        let mut schemas = IndexMap::new();

        // Base schema
        schemas.insert(
            "BaseEntity".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "id".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            ..Default::default()
                        })),
                    );
                    props.insert(
                        "createdAt".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            format: Some("date-time".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                required: vec!["id".to_string()],
                ..Default::default()
            })),
        );

        // Schema with allOf
        schemas.insert(
            "ExtendedEntity".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                all_of: vec![
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/BaseEntity".to_string(),
                    }),
                    OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("object".to_string()),
                        properties: {
                            let mut props = IndexMap::new();
                            props.insert(
                                "name".to_string(),
                                OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                                    schema_type: Some("string".to_string()),
                                    ..Default::default()
                                })),
                            );
                            props
                        },
                        required: vec!["name".to_string()],
                        ..Default::default()
                    })),
                ],
                ..Default::default()
            })),
        );

        OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "AllOf Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    /// Creates an OpenAPI spec with oneOf composition for testing
    fn create_spec_with_one_of() -> OpenAPISpec {
        let mut schemas = IndexMap::new();

        // Variant schemas
        schemas.insert(
            "Dog".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "breed".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                title: Some("Dog".to_string()),
                ..Default::default()
            })),
        );

        schemas.insert(
            "Cat".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "indoor".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("boolean".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                title: Some("Cat".to_string()),
                ..Default::default()
            })),
        );

        // Schema with oneOf
        schemas.insert(
            "Pet".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                one_of: vec![
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/Dog".to_string(),
                    }),
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/Cat".to_string(),
                    }),
                ],
                discriminator: Some(OpenAPIDiscriminator {
                    property_name: "petType".to_string(),
                    mapping: IndexMap::new(),
                }),
                ..Default::default()
            })),
        );

        OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "OneOf Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    #[test]
    fn test_new_parser() {
        let parser = OpenAPIParser::new();
        assert!(parser.spec.is_none());
    }

    #[test]
    fn test_default_parser() {
        let parser = OpenAPIParser::default();
        assert!(parser.spec.is_none());
    }

    #[tokio::test]
    async fn test_parse_valid_json_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.json");

        let spec = create_minimal_spec();
        let json_content = serde_json::to_string_pretty(&spec).unwrap();
        fs::write(&file_path, json_content).unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok());
        let parsed_spec = result.unwrap();
        assert_eq!(parsed_spec.openapi, "3.0.3");
        assert_eq!(parsed_spec.info.title, "Test API");
        assert_eq!(parsed_spec.info.version, "1.0.0");
    }

    #[tokio::test]
    async fn test_parse_valid_yaml_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.yaml");

        let yaml_content = r#"
openapi: 3.0.3
info:
  title: YAML Test API
  version: 2.0.0
  description: Test YAML parsing
paths: {}
"#;
        fs::write(&file_path, yaml_content).unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok());
        let parsed_spec = result.unwrap();
        assert_eq!(parsed_spec.openapi, "3.0.3");
        assert_eq!(parsed_spec.info.title, "YAML Test API");
        assert_eq!(parsed_spec.info.version, "2.0.0");
    }

    #[tokio::test]
    async fn test_parse_yml_extension() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.yml");

        let yaml_content = r#"
openapi: 3.0.3
info:
  title: YML Test API
  version: 1.0.0
paths: {}
"#;
        fs::write(&file_path, yaml_content).unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok());
        let parsed_spec = result.unwrap();
        assert_eq!(parsed_spec.info.title, "YML Test API");
    }

    #[tokio::test]
    async fn test_parse_nonexistent_file() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("nonexistent.json");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::FileNotFound { .. } => {}
            _ => panic!("Expected FileNotFound error"),
        }
    }

    #[tokio::test]
    async fn test_parse_unsupported_format() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("test.txt");

        fs::write(&file_path, "some content").unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::UnsupportedFormat { format } => {
                assert_eq!(format, "txt");
            }
            _ => panic!("Expected UnsupportedFormat error"),
        }
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("invalid.json");

        fs::write(&file_path, "{ invalid json content }").unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::InvalidJson { .. } => {}
            _ => panic!("Expected InvalidJson error"),
        }
    }

    #[tokio::test]
    async fn test_parse_invalid_yaml() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("invalid.yaml");

        fs::write(&file_path, "invalid: yaml: content: [").unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::InvalidYaml { .. } => {}
            _ => panic!("Expected InvalidYaml error"),
        }
    }

    #[tokio::test]
    async fn test_validate_spec_unsupported_version() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("old_version.json");

        let spec = json!({
            "openapi": "2.0.0",
            "info": {
                "title": "Old API",
                "version": "1.0.0"
            },
            "paths": {}
        });

        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::UnsupportedOpenAPIVersion { version, .. } => {
                assert_eq!(version, "2.0.0");
            }
            _ => panic!("Expected UnsupportedOpenAPIVersion error"),
        }
    }

    #[tokio::test]
    async fn test_validate_spec_missing_title() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("no_title.json");

        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "",
                "version": "1.0.0"
            },
            "paths": {}
        });

        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::MissingField { field, .. } => {
                assert_eq!(field, "title");
            }
            _ => panic!("Expected MissingField error"),
        }
    }

    #[tokio::test]
    async fn test_validate_spec_missing_version() {
        let temp_dir = TempDir::new().unwrap();
        let file_path = temp_dir.path().join("no_version.json");

        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Test API",
                "version": ""
            },
            "paths": {}
        });

        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            crate::errors::OpenAPIError::MissingField { field, .. } => {
                assert_eq!(field, "version");
            }
            _ => panic!("Expected MissingField error"),
        }
    }

    #[test]
    fn test_resolve_reference_valid() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let result = parser.resolve_reference("#/components/schemas/User");
        assert!(result.is_ok());

        let schema = result.unwrap();
        assert_eq!(schema.schema_type, Some("object".to_string()));
        assert!(!schema.properties.is_empty());
        assert!(schema.properties.contains_key("id"));
        assert!(schema.properties.contains_key("name"));
    }

    #[test]
    fn test_resolve_reference_external_not_supported() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let result = parser.resolve_reference("external.yaml#/components/schemas/User");
        assert!(result.is_err());

        match result.unwrap_err() {
            crate::errors::OpenAPIError::ExternalReferenceNotSupported { .. } => {}
            _ => panic!("Expected ExternalReferenceNotSupported error"),
        }
    }

    #[test]
    fn test_resolve_reference_not_found() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let result = parser.resolve_reference("#/components/schemas/NonExistent");
        assert!(result.is_err());

        match result.unwrap_err() {
            crate::errors::OpenAPIError::ReferenceNotFound { .. } => {}
            _ => panic!("Expected ReferenceNotFound error"),
        }
    }

    #[test]
    fn test_resolve_reference_invalid_path() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let result = parser.resolve_reference("#/invalid/path/User");
        assert!(result.is_err());

        match result.unwrap_err() {
            crate::errors::OpenAPIError::ReferenceNotFound { .. } => {}
            _ => panic!("Expected ReferenceNotFound error"),
        }
    }

    #[test]
    fn test_resolve_schema_direct() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        };
        let schema_or_ref = OpenAPISchemaOrRef::Schema(Box::new(schema));

        let result = parser.resolve_schema(&schema_or_ref);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert_eq!(resolved.schema_type, Some("string".to_string()));
    }

    #[test]
    fn test_resolve_schema_reference() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/User".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert_eq!(resolved.schema_type, Some("object".to_string()));
        assert!(resolved.properties.contains_key("id"));
        assert!(resolved.properties.contains_key("name"));
    }

    #[test]
    fn test_resolve_all_of_schema() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_all_of());

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/ExtendedEntity".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert_eq!(resolved.schema_type, Some("object".to_string()));

        // Should have properties from both BaseEntity and the extension
        assert!(resolved.properties.contains_key("id"));
        assert!(resolved.properties.contains_key("createdAt"));
        assert!(resolved.properties.contains_key("name"));

        // Should have required fields from both
        assert!(resolved.required.contains(&"id".to_string()));
        assert!(resolved.required.contains(&"name".to_string()));

        // allOf should be cleared in resolved schema
        assert!(resolved.all_of.is_empty());
    }

    #[test]
    fn test_resolve_one_of_schema() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_one_of());

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/Pet".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert_eq!(resolved.schema_type, Some("object".to_string()));

        // Should have discriminator property
        assert!(resolved.properties.contains_key("petType"));
        assert!(resolved.required.contains(&"petType".to_string()));

        // Should have oneOf variants stored
        assert!(resolved.one_of_variants.is_some());
        let variants = resolved.one_of_variants.unwrap();
        assert_eq!(variants.len(), 2);

        // oneOf should be cleared in resolved schema
        assert!(resolved.one_of.is_empty());
    }

    #[test]
    fn test_extract_schema_name() {
        assert_eq!(
            OpenAPIParser::extract_schema_name("#/components/schemas/User"),
            "User"
        );
        assert_eq!(OpenAPIParser::extract_schema_name("User"), "User");
        assert_eq!(OpenAPIParser::extract_schema_name(""), "Unknown");
    }

    #[test]
    fn test_get_all_schemas() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let result = parser.get_all_schemas();
        assert!(result.is_ok());

        let schemas = result.unwrap();
        assert_eq!(schemas.len(), 2);

        // Check that we have User and Profile schemas
        let schema_names: Vec<&String> = schemas.iter().map(|(name, _)| name).collect();
        assert!(schema_names.contains(&&"User".to_string()));
        assert!(schema_names.contains(&&"Profile".to_string()));
    }

    #[test]
    fn test_get_all_schemas_empty() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_minimal_spec());

        let result = parser.get_all_schemas();
        assert!(result.is_ok());

        let schemas = result.unwrap();
        assert!(schemas.is_empty());
    }

    #[test]
    fn test_get_spec() {
        let mut parser = OpenAPIParser::new();
        let spec = create_minimal_spec();
        parser.spec = Some(spec.clone());

        let retrieved_spec = parser.get_spec();
        assert_eq!(retrieved_spec.info.title, spec.info.title);
        assert_eq!(retrieved_spec.info.version, spec.info.version);
    }

    /// Test for anyOf schema resolution
    #[test]
    fn test_resolve_any_of_schema() {
        let mut parser = OpenAPIParser::new();

        // Create a spec with anyOf schema
        let mut schemas = IndexMap::new();

        schemas.insert(
            "StringType".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("string".to_string()),
                title: Some("StringType".to_string()),
                ..Default::default()
            })),
        );

        schemas.insert(
            "NumberType".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("number".to_string()),
                title: Some("NumberType".to_string()),
                ..Default::default()
            })),
        );

        schemas.insert(
            "FlexibleField".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                any_of: vec![
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/StringType".to_string(),
                    }),
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/NumberType".to_string(),
                    }),
                ],
                ..Default::default()
            })),
        );

        let spec = OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "AnyOf Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        };

        parser.spec = Some(spec);

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/FlexibleField".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert_eq!(resolved.schema_type, Some("object".to_string()));

        // Should have anyOf variants stored
        assert!(resolved.any_of_variants.is_some());
        let variants = resolved.any_of_variants.unwrap();
        assert_eq!(variants.len(), 2);

        // anyOf should be cleared in resolved schema
        assert!(resolved.any_of.is_empty());
    }

    /// Test error handling in schema resolution
    #[test]
    fn test_resolve_schema_with_invalid_reference() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_schemas());

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/NonExistent".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_err());
    }

    /// Test edge case: schema with nested allOf
    #[test]
    fn test_resolve_nested_all_of_schema() {
        let mut parser = OpenAPIParser::new();

        let mut schemas = IndexMap::new();

        // Base schema
        schemas.insert(
            "Base".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "id".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                ..Default::default()
            })),
        );

        // Schema that extends Base and has its own allOf
        schemas.insert(
            "Extended".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                all_of: vec![
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/Base".to_string(),
                    }),
                    OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        all_of: vec![OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("object".to_string()),
                            properties: {
                                let mut props = IndexMap::new();
                                props.insert(
                                    "name".to_string(),
                                    OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                                        schema_type: Some("string".to_string()),
                                        ..Default::default()
                                    })),
                                );
                                props
                            },
                            ..Default::default()
                        }))],
                        ..Default::default()
                    })),
                ],
                ..Default::default()
            })),
        );

        let spec = OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "Nested AllOf Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        };

        parser.spec = Some(spec);

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/Extended".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert!(resolved.properties.contains_key("id"));
        assert!(resolved.properties.contains_key("name"));
    }

    /// Test circular reference detection in nested schemas
    #[test]
    fn test_get_all_schemas_with_complex_references() {
        let mut parser = OpenAPIParser::new();

        let mut schemas = IndexMap::new();

        // Schema A references B
        schemas.insert(
            "A".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "b_ref".to_string(),
                        OpenAPISchemaOrRef::Reference(OpenAPIReference {
                            reference: "#/components/schemas/B".to_string(),
                        }),
                    );
                    props
                },
                ..Default::default()
            })),
        );

        // Schema B references C
        schemas.insert(
            "B".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "c_ref".to_string(),
                        OpenAPISchemaOrRef::Reference(OpenAPIReference {
                            reference: "#/components/schemas/C".to_string(),
                        }),
                    );
                    props
                },
                ..Default::default()
            })),
        );

        // Schema C is a simple schema
        schemas.insert(
            "C".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "value".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                ..Default::default()
            })),
        );

        let spec = OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "Complex Reference Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        };

        parser.spec = Some(spec);

        let result = parser.get_all_schemas();
        assert!(result.is_ok());

        let schemas = result.unwrap();
        assert_eq!(schemas.len(), 3);
    }

    /// Creates an OpenAPI spec with paths and operations for testing
    fn create_spec_with_operations() -> OpenAPISpec {
        let mut paths = IndexMap::new();

        // Add /users path with GET and POST operations
        let mut users_operations = OpenAPIPathItem::default();
        users_operations.get = Some(OpenAPIOperation {
            operation_id: Some("getUsers".to_string()),
            summary: Some("Get all users".to_string()),
            tags: vec!["users".to_string(), "public".to_string()],
            responses: IndexMap::new(),
            ..Default::default()
        });
        users_operations.post = Some(OpenAPIOperation {
            operation_id: Some("createUser".to_string()),
            summary: Some("Create a user".to_string()),
            tags: vec!["users".to_string(), "admin".to_string()],
            responses: IndexMap::new(),
            ..Default::default()
        });
        paths.insert("/users".to_string(), users_operations);

        // Add /products path with GET operation
        let mut products_operations = OpenAPIPathItem::default();
        products_operations.get = Some(OpenAPIOperation {
            operation_id: Some("getProducts".to_string()),
            summary: Some("Get all products".to_string()),
            tags: vec!["products".to_string()],
            responses: IndexMap::new(),
            ..Default::default()
        });
        paths.insert("/products".to_string(), products_operations);

        // Add /internal path with no tags (should default to "Default")
        let mut internal_operations = OpenAPIPathItem::default();
        internal_operations.get = Some(OpenAPIOperation {
            operation_id: Some("getInternal".to_string()),
            summary: Some("Internal endpoint".to_string()),
            tags: vec![], // No tags
            responses: IndexMap::new(),
            ..Default::default()
        });
        paths.insert("/internal".to_string(), internal_operations);

        OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "Operations Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths,
            tags: vec![
                OpenAPITag {
                    name: "users".to_string(),
                    description: Some("User operations".to_string()),
                    ..Default::default()
                },
                OpenAPITag {
                    name: "products".to_string(),
                    description: Some("Product operations".to_string()),
                    ..Default::default()
                },
                OpenAPITag {
                    name: "global".to_string(),
                    description: Some("Global tag not used in operations".to_string()),
                    ..Default::default()
                },
            ],
            ..Default::default()
        }
    }

    #[test]
    fn test_get_all_tags() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_operations());

        let tags = parser.get_all_tags();

        // Should include both global tags and tags from operations
        assert!(tags.contains(&"users".to_string()));
        assert!(tags.contains(&"products".to_string()));
        assert!(tags.contains(&"public".to_string()));
        assert!(tags.contains(&"admin".to_string()));
        assert!(tags.contains(&"global".to_string()));

        // Should be sorted
        let mut expected_tags = tags.clone();
        expected_tags.sort();
        assert_eq!(tags, expected_tags);
    }

    #[test]
    fn test_get_all_tags_empty() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_minimal_spec());

        let tags = parser.get_all_tags();
        assert!(tags.is_empty());
    }

    #[test]
    fn test_get_operations_by_tag() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_operations());

        let result = parser.get_operations_by_tag();
        assert!(result.is_ok());

        let tagged_operations = result.unwrap();

        // Check users tag
        assert!(tagged_operations.contains_key("users"));
        let users_ops = &tagged_operations["users"];
        assert_eq!(users_ops.len(), 2); // GET and POST

        // Check that we have the right operations
        let operation_ids: Vec<&str> = users_ops
            .iter()
            .filter_map(|(_, _, op)| op.operation_id.as_deref())
            .collect();
        assert!(operation_ids.contains(&"getUsers"));
        assert!(operation_ids.contains(&"createUser"));

        // Check products tag
        assert!(tagged_operations.contains_key("products"));
        let products_ops = &tagged_operations["products"];
        assert_eq!(products_ops.len(), 1); // Only GET

        // Check Default tag (for operations without tags)
        assert!(tagged_operations.contains_key("Default"));
        let default_ops = &tagged_operations["Default"];
        assert_eq!(default_ops.len(), 1); // Internal endpoint

        // Check admin tag
        assert!(tagged_operations.contains_key("admin"));
        let admin_ops = &tagged_operations["admin"];
        assert_eq!(admin_ops.len(), 1); // Only POST /users
    }

    #[test]
    fn test_get_operations_by_tag_empty() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_minimal_spec());

        let result = parser.get_operations_by_tag();
        assert!(result.is_ok());

        let tagged_operations = result.unwrap();
        assert!(tagged_operations.is_empty());
    }

    /// Test edge cases and error conditions

    #[test]
    fn test_resolve_reference_nested_references() {
        let mut parser = OpenAPIParser::new();

        let mut schemas = IndexMap::new();

        // Create a reference that points to another reference
        schemas.insert(
            "DirectSchema".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("string".to_string()),
                ..Default::default()
            })),
        );

        schemas.insert(
            "IndirectReference".to_string(),
            OpenAPISchemaOrRef::Reference(OpenAPIReference {
                reference: "#/components/schemas/DirectSchema".to_string(),
            }),
        );

        let spec = OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "Nested References Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        };

        parser.spec = Some(spec);

        let result = parser.resolve_reference("#/components/schemas/IndirectReference");
        assert!(result.is_ok());

        let resolved = result.unwrap();
        assert_eq!(resolved.schema_type, Some("string".to_string()));
    }

    #[test]
    fn test_resolve_all_of_with_title_description_merging() {
        let mut parser = OpenAPIParser::new();

        let mut schemas = IndexMap::new();

        // Base schema with title and description
        schemas.insert(
            "BaseWithMeta".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                title: Some("Base Schema".to_string()),
                description: Some("Base description".to_string()),
                example: Some(serde_json::json!({"base": "example"})),
                properties: {
                    let mut props = IndexMap::new();
                    props.insert(
                        "id".to_string(),
                        OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                            schema_type: Some("string".to_string()),
                            ..Default::default()
                        })),
                    );
                    props
                },
                ..Default::default()
            })),
        );

        // Schema with allOf that has no title/description (should inherit)
        schemas.insert(
            "ExtendedWithMeta".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                all_of: vec![
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/BaseWithMeta".to_string(),
                    }),
                    OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("object".to_string()),
                        properties: {
                            let mut props = IndexMap::new();
                            props.insert(
                                "name".to_string(),
                                OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                                    schema_type: Some("string".to_string()),
                                    ..Default::default()
                                })),
                            );
                            props
                        },
                        ..Default::default()
                    })),
                ],
                ..Default::default()
            })),
        );

        let spec = OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "AllOf Metadata Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        };

        parser.spec = Some(spec);

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/ExtendedWithMeta".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();

        // Should inherit metadata from base schema
        assert_eq!(resolved.title, Some("Base Schema".to_string()));
        assert_eq!(resolved.description, Some("Base description".to_string()));
        assert!(resolved.example.is_some());

        // Should have properties from both schemas
        assert!(resolved.properties.contains_key("id"));
        assert!(resolved.properties.contains_key("name"));
    }

    #[test]
    fn test_resolve_one_of_variant_names() {
        let mut parser = OpenAPIParser::new();
        parser.spec = Some(create_spec_with_one_of());

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/Pet".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        let variants = resolved.one_of_variants.unwrap();

        // Check variant names
        let variant_names: Vec<&String> = variants.iter().map(|(name, _)| name).collect();
        assert!(variant_names.contains(&&"Dog".to_string()));
        assert!(variant_names.contains(&&"Cat".to_string()));
    }

    #[test]
    fn test_resolve_any_of_variant_names() {
        let mut parser = OpenAPIParser::new();

        // Create a spec with anyOf schema with no titles (should generate default names)
        let mut schemas = IndexMap::new();

        schemas.insert(
            "TypeA".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("string".to_string()),
                // No title - should generate "Option1"
                ..Default::default()
            })),
        );

        schemas.insert(
            "TypeB".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("number".to_string()),
                // No title - should generate "Option2"
                ..Default::default()
            })),
        );

        schemas.insert(
            "FlexibleType".to_string(),
            OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                any_of: vec![
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/TypeA".to_string(),
                    }),
                    OpenAPISchemaOrRef::Reference(OpenAPIReference {
                        reference: "#/components/schemas/TypeB".to_string(),
                    }),
                ],
                ..Default::default()
            })),
        );

        let spec = OpenAPISpec {
            openapi: "3.0.3".to_string(),
            info: OpenAPIInfo {
                title: "AnyOf Variant Names Test API".to_string(),
                version: "1.0.0".to_string(),
                ..Default::default()
            },
            paths: IndexMap::new(),
            components: Some(OpenAPIComponents {
                schemas,
                ..Default::default()
            }),
            ..Default::default()
        };

        parser.spec = Some(spec);

        let reference = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/FlexibleType".to_string(),
        });

        let result = parser.resolve_schema(&reference);
        assert!(result.is_ok());

        let resolved = result.unwrap();
        let variants = resolved.any_of_variants.unwrap();

        // Check generated variant names
        let variant_names: Vec<&String> = variants.iter().map(|(name, _)| name).collect();
        assert!(variant_names.contains(&&"Option1".to_string()));
        assert!(variant_names.contains(&&"Option2".to_string()));
    }

    /// Test panic conditions (these should not panic)
    #[test]
    #[should_panic(expected = "called `Option::unwrap()` on a `None` value")]
    fn test_get_spec_without_parsed_spec() {
        let parser = OpenAPIParser::new();
        let _ = parser.get_spec(); // Should panic
    }

    #[test]
    #[should_panic(expected = "called `Option::unwrap()` on a `None` value")]
    fn test_get_all_schemas_without_parsed_spec() {
        let parser = OpenAPIParser::new();
        let _ = parser.get_all_schemas(); // Should panic
    }

    #[test]
    #[should_panic(expected = "called `Option::unwrap()` on a `None` value")]
    fn test_resolve_reference_without_parsed_spec() {
        let parser = OpenAPIParser::new();
        let _ = parser.resolve_reference("#/components/schemas/User"); // Should panic
    }

    #[test]
    #[should_panic(expected = "called `Option::unwrap()` on a `None` value")]
    fn test_get_all_tags_without_parsed_spec() {
        let parser = OpenAPIParser::new();
        let _ = parser.get_all_tags(); // Should panic
    }

    #[test]
    #[should_panic(expected = "called `Option::unwrap()` on a `None` value")]
    fn test_get_operations_by_tag_without_parsed_spec() {
        let parser = OpenAPIParser::new();
        let _ = parser.get_operations_by_tag(); // Should panic
    }
}
