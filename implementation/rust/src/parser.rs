use anyhow::{Context, Result};
use std::collections::HashSet;
use std::path::Path;
use tokio::fs;

use crate::types::*;

pub struct OpenAPIParser {
    spec: Option<OpenAPISpec>,
}

impl OpenAPIParser {
    pub fn new() -> Self {
        Self { spec: None }
    }

    pub async fn parse_file<P: AsRef<Path>>(&mut self, file_path: P) -> Result<&OpenAPISpec> {
        let path = file_path.as_ref();
        
        let content = fs::read_to_string(path)
            .await
            .with_context(|| format!("Failed to read file: {}", path.display()))?;

        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");

        let spec = match extension {
            "json" => {
                serde_json::from_str::<OpenAPISpec>(&content)
                    .with_context(|| "Failed to parse JSON")?
            }
            "yaml" | "yml" => {
                serde_yaml::from_str::<OpenAPISpec>(&content)
                    .with_context(|| "Failed to parse YAML")?
            }
            _ => {
                anyhow::bail!("Unsupported file format: .{}", extension);
            }
        };

        self.validate_spec(&spec)?;
        self.spec = Some(spec);
        Ok(self.spec.as_ref().unwrap())
    }

    fn validate_spec(&self, spec: &OpenAPISpec) -> Result<()> {
        if !spec.openapi.starts_with("3.") {
            anyhow::bail!(
                "Unsupported OpenAPI version: {}. Only 3.x is supported.",
                spec.openapi
            );
        }

        if spec.info.title.is_empty() {
            anyhow::bail!("Missing required field: info.title");
        }

        if spec.info.version.is_empty() {
            anyhow::bail!("Missing required field: info.version");
        }

        if spec.paths.is_empty() {
            anyhow::bail!("Missing required field: paths");
        }

        Ok(())
    }

    pub fn resolve_reference(&self, reference: &str) -> Result<&OpenAPISchema> {
        let spec = self.spec.as_ref().unwrap();
        
        if !reference.starts_with("#/") {
            anyhow::bail!("External references not supported: {}", reference);
        }

        let parts: Vec<&str> = reference[2..].split('/').collect();
        
        if parts.len() >= 3 && parts[0] == "components" && parts[1] == "schemas" {
            let schema_name = parts[2];
            if let Some(components) = &spec.components {
                if let Some(schema_or_ref) = components.schemas.get(schema_name) {
                    return match schema_or_ref {
                        OpenAPISchemaOrRef::Schema(schema) => Ok(schema),
                        OpenAPISchemaOrRef::Reference(ref_obj) => {
                            self.resolve_reference(&ref_obj.reference)
                        }
                    };
                }
            }
        }

        anyhow::bail!("Reference not found: {}", reference)
    }

    pub fn resolve_schema(&self, schema_or_ref: &OpenAPISchemaOrRef) -> Result<&OpenAPISchema> {
        match schema_or_ref {
            OpenAPISchemaOrRef::Schema(schema) => Ok(schema),
            OpenAPISchemaOrRef::Reference(reference) => {
                self.resolve_reference(&reference.reference)
            }
        }
    }

    pub fn extract_schema_name(reference: &str) -> String {
        reference.split('/').last().unwrap_or("Unknown").to_string()
    }

    pub fn get_all_schemas(&self) -> Result<Vec<(String, &OpenAPISchema)>> {
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

            for operation_opt in operations.iter() {
                if let Some(operation) = operation_opt {
                    for tag in &operation.tags {
                        tags.insert(tag.clone());
                    }
                }
            }
        }

        let mut result: Vec<String> = tags.into_iter().collect();
        result.sort();
        result
    }

    pub fn get_operations_by_tag(
        &self,
    ) -> Result<std::collections::HashMap<String, Vec<(String, String, &OpenAPIOperation)>>> {
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
                        tagged_operations
                            .entry(tag)
                            .or_insert_with(Vec::new)
                            .push((path_str.clone(), method.to_string(), operation));
                    }
                }
            }
        }

        Ok(tagged_operations)
    }

    pub fn get_spec(&self) -> &OpenAPISpec {
        self.spec.as_ref().unwrap()
    }
}