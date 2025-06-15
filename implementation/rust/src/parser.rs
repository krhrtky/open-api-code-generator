use std::collections::HashSet;
use indexmap::IndexMap;
use std::path::Path;
use tokio::fs;

use crate::types::*;
use crate::errors::{self, Result};

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
            .map_err(|_| errors::file_not_found(path.display().to_string()))?;

        let extension = path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");

        let spec = match extension {
            "json" => {
                serde_json::from_str::<OpenAPISpec>(&content)
                    .map_err(|e| errors::invalid_json(e.to_string()))?
            }
            "yaml" | "yml" => {
                serde_yaml::from_str::<OpenAPISpec>(&content)
                    .map_err(|e| errors::invalid_yaml(e.to_string()))?
            }
            _ => {
                return Err(errors::unsupported_format(extension));
            }
        };

        self.validate_spec(&spec)?;
        self.spec = Some(spec);
        Ok(self.spec.as_ref().unwrap())
    }

    fn validate_spec(&self, spec: &OpenAPISpec) -> Result<()> {
        if !spec.openapi.starts_with("3.") {
            return Err(errors::unsupported_openapi_version(&spec.openapi, "openapi"));
        }

        if spec.info.title.is_empty() {
            return Err(errors::missing_field("title", "info.title"));
        }

        if spec.info.version.is_empty() {
            return Err(errors::missing_field("version", "info.version"));
        }

        if spec.paths.is_empty() {
            return Err(errors::missing_field("paths", "paths"));
        }

        Ok(())
    }

    pub fn resolve_reference(&self, reference: &str) -> Result<&OpenAPISchema> {
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
                            self.resolve_reference(&ref_obj.reference)
                        }
                    };
                }
            }
        }

        Err(errors::reference_not_found(reference, &parts.join("/")))
    }

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
            },
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

    fn resolve_all_of_schema(&self, base_schema: &OpenAPISchema, all_of: &[OpenAPISchemaOrRef]) -> Result<Box<OpenAPISchema>> {
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
                OpenAPISchemaOrRef::Schema(schema) => schema,
                OpenAPISchemaOrRef::Reference(reference) => {
                    self.resolve_reference(&reference.reference)?
                }
            };
            
            // Merge properties
            for (prop_name, prop_schema) in &sub_schema.properties {
                resolved_schema.properties.insert(prop_name.clone(), prop_schema.clone());
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

    fn resolve_one_of_schema(&self, base_schema: &OpenAPISchema, one_of: &[OpenAPISchemaOrRef]) -> Result<Box<OpenAPISchema>> {
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
            
            let variant_name = variant_schema.title
                .clone()
                .unwrap_or_else(|| format!("Variant{}", index + 1));
                
            one_of_variants.push((variant_name, variant_schema));
        }

        // Store variants in a custom field for code generation
        resolved_schema.one_of_variants = Some(one_of_variants);
        
        // If discriminator is specified, add discriminator property
        if let Some(discriminator) = &base_schema.discriminator {
            let discriminator_property = &discriminator.property_name;
            if !resolved_schema.properties.contains_key(discriminator_property) {
                resolved_schema.properties.insert(
                    discriminator_property.clone(),
                    crate::types::OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("string".to_string()),
                        ..Default::default()
                    }))
                );
            }
            if !resolved_schema.required.contains(discriminator_property) {
                resolved_schema.required.push(discriminator_property.clone());
            }
        }

        Ok(Box::new(resolved_schema))
    }

    fn resolve_any_of_schema(&self, base_schema: &OpenAPISchema, any_of: &[OpenAPISchemaOrRef]) -> Result<Box<OpenAPISchema>> {
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
            
            let variant_name = variant_schema.title
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

    pub fn extract_schema_name(reference: &str) -> String {
        reference.split('/').last().unwrap_or("Unknown").to_string()
    }

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