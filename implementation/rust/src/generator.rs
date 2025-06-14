use anyhow::{Context, Result};
use rayon::prelude::*;
use regex::Regex;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use tokio::fs;

use crate::parser::OpenAPIParser;
use crate::templates::TemplateEngine;
use crate::types::*;

pub struct OpenAPICodeGenerator {
    config: GeneratorConfig,
    parser: OpenAPIParser,
    template_engine: TemplateEngine,
}

impl OpenAPICodeGenerator {
    pub fn new(config: GeneratorConfig) -> Self {
        let template_engine = TemplateEngine::new(
            config.include_validation,
            config.include_swagger,
        );
        
        Self {
            config,
            parser: OpenAPIParser::new(),
            template_engine,
        }
    }

    pub async fn generate<P: AsRef<Path>>(&mut self, input_file: P) -> Result<GenerationResult> {
        // Parse OpenAPI specification
        let spec = self.parser.parse_file(input_file).await?;
        
        if self.config.verbose {
            println!(
                "Successfully parsed OpenAPI spec: {} v{}",
                spec.info.title, spec.info.version
            );
        }

        // Ensure output directory exists
        fs::create_dir_all(&self.config.output_dir)
            .await
            .with_context(|| "Failed to create output directory")?;

        let mut generated_files = Vec::new();

        // Generate models in parallel
        if self.config.generate_models {
            if self.config.verbose {
                println!("Generating model classes...");
            }
            let model_files = self.generate_models().await?;
            generated_files.extend(model_files);
        }

        // Generate controllers
        if self.config.generate_controllers {
            if self.config.verbose {
                println!("Generating controller interfaces...");
            }
            let controller_files = self.generate_controllers().await?;
            generated_files.extend(controller_files);
        }

        // Generate build file
        let build_file = self.generate_build_file().await?;
        generated_files.push(build_file);

        Ok(GenerationResult {
            output_dir: self.config.output_dir.clone(),
            file_count: generated_files.len(),
            generated_files,
        })
    }

    async fn generate_models(&self) -> Result<Vec<PathBuf>> {
        let schemas = self.parser.get_all_schemas()?;
        let mut files = Vec::new();

        // Process schemas in parallel
        let kotlin_classes: Result<Vec<_>> = schemas
            .into_par_iter()
            .map(|(name, schema)| self.convert_schema_to_kotlin_class(&name, schema))
            .collect();

        let kotlin_classes = kotlin_classes?;

        // Write files sequentially (to avoid filesystem conflicts)
        for kotlin_class in kotlin_classes {
            let file_path = self.write_kotlin_class(&kotlin_class, "model").await?;
            files.push(file_path);
            
            if self.config.verbose {
                let relative_path = file_path.strip_prefix(&self.config.output_dir)
                    .unwrap_or(&file_path);
                println!("Generated model: {} -> {}", kotlin_class.name, relative_path.display());
            }
        }

        Ok(files)
    }

    async fn generate_controllers(&self) -> Result<Vec<PathBuf>> {
        let tagged_operations = self.parser.get_operations_by_tag()?;
        let mut files = Vec::new();

        // Process controllers in parallel
        let kotlin_controllers: Result<Vec<_>> = tagged_operations
            .into_par_iter()
            .filter(|(_, operations)| !operations.is_empty())
            .map(|(tag, operations)| self.convert_operations_to_kotlin_controller(&tag, &operations))
            .collect();

        let kotlin_controllers = kotlin_controllers?;

        // Write files sequentially
        for kotlin_controller in kotlin_controllers {
            let file_path = self.write_kotlin_controller(&kotlin_controller).await?;
            files.push(file_path);
            
            if self.config.verbose {
                let relative_path = file_path.strip_prefix(&self.config.output_dir)
                    .unwrap_or(&file_path);
                println!("Generated controller: {} -> {}", kotlin_controller.name, relative_path.display());
            }
        }

        Ok(files)
    }

    fn convert_schema_to_kotlin_class(
        &self,
        name: &str,
        schema: Box<OpenAPISchema>,
    ) -> Result<KotlinClass> {
        let mut kotlin_class = KotlinClass {
            name: self.pascal_case(name),
            package_name: format!("{}.model", self.config.base_package),
            description: schema.description.clone(),
            properties: Vec::new(),
            imports: self.get_base_model_imports(),
        };

        if let Some(properties) = &schema.properties {
            let required_fields = &schema.required;
            
            for (prop_name, prop_schema_or_ref) in properties {
                let prop_schema = self.parser.resolve_schema(prop_schema_or_ref)?;
                let property = self.convert_schema_to_kotlin_property(
                    prop_name,
                    &prop_schema,
                    required_fields,
                )?;
                kotlin_class.properties.push(property);
                
                // Add imports for property types
                self.add_imports_for_type(&property.kotlin_type, &mut kotlin_class.imports);
            }
        }

        Ok(kotlin_class)
    }

    fn convert_schema_to_kotlin_property(
        &self,
        name: &str,
        schema: &OpenAPISchema,
        required: &[String],
    ) -> Result<KotlinProperty> {
        let kotlin_name = self.camel_case(name);
        let is_required = required.contains(&name.to_string());
        let nullable = schema.nullable.unwrap_or(false) || !is_required;
        
        let mut property = KotlinProperty {
            name: kotlin_name.clone(),
            kotlin_type: self.map_schema_to_kotlin_type(schema)?,
            nullable,
            default_value: None,
            description: schema.description.clone(),
            validation: Vec::new(),
            json_property: if kotlin_name != name {
                Some(name.to_string())
            } else {
                None
            },
        };

        // Add default value
        if let Some(default_val) = &schema.default {
            property.default_value = Some(self.format_default_value(default_val, &property.kotlin_type));
        } else if nullable {
            property.default_value = Some("null".to_string());
        }

        // Add validation annotations
        if self.config.include_validation {
            property.validation = self.generate_validation_annotations(schema, is_required);
        }

        Ok(property)
    }

    fn map_schema_to_kotlin_type(&self, schema: &OpenAPISchema) -> Result<String> {
        match schema.schema_type.as_deref() {
            Some("string") => {
                match schema.format.as_deref() {
                    Some("date") => Ok("java.time.LocalDate".to_string()),
                    Some("date-time") => Ok("java.time.OffsetDateTime".to_string()),
                    Some("uuid") => Ok("java.util.UUID".to_string()),
                    Some("uri") => Ok("java.net.URI".to_string()),
                    Some("byte") | Some("binary") => Ok("ByteArray".to_string()),
                    _ => Ok("String".to_string()),
                }
            }
            Some("integer") => {
                match schema.format.as_deref() {
                    Some("int64") => Ok("Long".to_string()),
                    _ => Ok("Int".to_string()),
                }
            }
            Some("number") => {
                match schema.format.as_deref() {
                    Some("float") => Ok("Float".to_string()),
                    Some("double") => Ok("Double".to_string()),
                    _ => Ok("java.math.BigDecimal".to_string()),
                }
            }
            Some("boolean") => Ok("Boolean".to_string()),
            Some("array") => {
                if let Some(items) = &schema.items {
                    let item_schema = self.parser.resolve_schema(items)?;
                    let item_type = self.map_schema_to_kotlin_type(item_schema)?;
                    Ok(format!("List<{}>", item_type))
                } else {
                    Ok("List<Any>".to_string())
                }
            }
            Some("object") => Ok("Map<String, Any>".to_string()),
            _ => {
                // Check if it's a reference to another schema
                if !schema.properties.is_empty() {
                    Ok("Map<String, Any>".to_string())
                } else {
                    Ok("Any".to_string())
                }
            }
        }
    }

    fn generate_validation_annotations(&self, schema: &OpenAPISchema, required: bool) -> Vec<String> {
        let mut annotations = Vec::new();

        if required && !schema.nullable.unwrap_or(false) {
            annotations.push("@NotNull".to_string());
        }

        match schema.schema_type.as_deref() {
            Some("string") => {
                if schema.format.as_deref() == Some("email") {
                    annotations.push("@Email".to_string());
                }
                if schema.min_length.is_some() || schema.max_length.is_some() {
                    let min = schema.min_length.unwrap_or(0);
                    let max = schema.max_length.map_or("Integer.MAX_VALUE".to_string(), |v| v.to_string());
                    annotations.push(format!("@Size(min = {}, max = {})", min, max));
                }
                if let Some(pattern) = &schema.pattern {
                    annotations.push(format!("@Pattern(regexp = \"{}\")", pattern));
                }
            }
            Some("number") | Some("integer") => {
                if let Some(minimum) = schema.minimum {
                    annotations.push(format!("@Min({})", minimum as i64));
                }
                if let Some(maximum) = schema.maximum {
                    annotations.push(format!("@Max({})", maximum as i64));
                }
            }
            Some("array") => {
                if schema.min_items.is_some() || schema.max_items.is_some() {
                    let min = schema.min_items.unwrap_or(0);
                    let max = schema.max_items.map_or("Integer.MAX_VALUE".to_string(), |v| v.to_string());
                    annotations.push(format!("@Size(min = {}, max = {})", min, max));
                }
            }
            Some("object") => {
                if !schema.properties.is_empty() {
                    annotations.push("@Valid".to_string());
                }
            }
            _ => {}
        }

        annotations
    }

    fn convert_operations_to_kotlin_controller(
        &self,
        tag: &str,
        operations: &[(String, String, &OpenAPIOperation)],
    ) -> Result<KotlinController> {
        let controller_name = format!("{}Controller", self.pascal_case(tag));
        
        let mut kotlin_controller = KotlinController {
            name: controller_name,
            package_name: format!("{}.controller", self.config.base_package),
            description: Some(format!("{} API controller interface", self.pascal_case(tag))),
            methods: Vec::new(),
            imports: self.get_base_controller_imports(),
        };

        for (path, method, operation) in operations {
            let kotlin_method = self.convert_operation_to_kotlin_method(path, method, operation)?;
            kotlin_controller.methods.push(kotlin_method);
        }

        Ok(kotlin_controller)
    }

    fn convert_operation_to_kotlin_method(
        &self,
        path: &str,
        http_method: &str,
        operation: &OpenAPIOperation,
    ) -> Result<KotlinMethod> {
        let method_name = operation.operation_id.as_ref()
            .map(|id| self.camel_case(id))
            .unwrap_or_else(|| self.generate_method_name(http_method, path));
        
        let mut kotlin_method = KotlinMethod {
            name: method_name,
            http_method: http_method.to_string(),
            path: path.to_string(),
            summary: operation.summary.clone(),
            description: operation.description.clone(),
            parameters: Vec::new(),
            request_body: None,
            return_type: self.determine_return_type(operation)?,
            response_description: self.get_response_description(operation),
        };

        // Process parameters
        for param_or_ref in &operation.parameters {
            if let OpenAPIParameterOrRef::Parameter(param) = param_or_ref {
                let kotlin_param = self.convert_parameter_to_kotlin(param)?;
                kotlin_method.parameters.push(kotlin_param);
            }
        }

        // Process request body
        if let Some(request_body_or_ref) = &operation.request_body {
            if let OpenAPIRequestBodyOrRef::RequestBody(request_body) = request_body_or_ref {
                if let Some(media_type) = request_body.content.get("application/json") {
                    if let Some(schema_or_ref) = &media_type.schema {
                        let schema = self.parser.resolve_schema(schema_or_ref)?;
                        let body_param = KotlinParameter {
                            name: "body".to_string(),
                            kotlin_type: self.map_schema_to_kotlin_type(schema)?,
                            param_type: ParameterType::Body,
                            required: request_body.required,
                            description: request_body.description.clone(),
                            validation: if self.config.include_validation {
                                vec!["@Valid".to_string()]
                            } else {
                                Vec::new()
                            },
                        };
                        kotlin_method.request_body = Some(body_param);
                    }
                }
            }
        }

        Ok(kotlin_method)
    }

    fn convert_parameter_to_kotlin(&self, param: &OpenAPIParameter) -> Result<KotlinParameter> {
        let param_type = match param.location.as_str() {
            "path" => ParameterType::Path,
            "query" => ParameterType::Query,
            "header" => ParameterType::Header,
            _ => ParameterType::Query,
        };

        let kotlin_type = if let Some(schema_or_ref) = &param.schema {
            let schema = self.parser.resolve_schema(schema_or_ref)?;
            self.map_schema_to_kotlin_type(schema)?
        } else {
            "String".to_string()
        };

        let validation = if self.config.include_validation && param.required {
            vec!["@NotNull".to_string()]
        } else {
            Vec::new()
        };

        Ok(KotlinParameter {
            name: self.camel_case(&param.name),
            kotlin_type,
            param_type,
            required: param.required,
            description: param.description.clone(),
            validation,
        })
    }

    fn generate_method_name(&self, http_method: &str, path: &str) -> String {
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty() && !s.starts_with('{')).collect();
        let resource = segments.last().unwrap_or(&"resource");
        
        let method_prefix = match http_method {
            "get" => "get",
            "post" => "create",
            "put" => "update",
            "delete" => "delete",
            "patch" => "patch",
            _ => http_method,
        };
        
        format!("{}{}", method_prefix, self.pascal_case(resource))
    }

    fn determine_return_type(&self, operation: &OpenAPIOperation) -> Result<String> {
        // Look for success responses (200, 201, default)
        let success_response = operation.responses.get("200")
            .or_else(|| operation.responses.get("201"))
            .or_else(|| operation.responses.get("default"));
        
        if let Some(response_or_ref) = success_response {
            if let OpenAPIResponseOrRef::Response(response) = response_or_ref {
                if let Some(media_type) = response.content.get("application/json") {
                    if let Some(schema_or_ref) = &media_type.schema {
                        let schema = self.parser.resolve_schema(schema_or_ref)?;
                        let inner_type = self.map_schema_to_kotlin_type(schema)?;
                        return Ok(format!("ResponseEntity<{}>", inner_type));
                    }
                }
            }
        }
        
        Ok("ResponseEntity<Any>".to_string())
    }

    fn get_response_description(&self, operation: &OpenAPIOperation) -> Option<String> {
        let success_response = operation.responses.get("200")
            .or_else(|| operation.responses.get("201"))
            .or_else(|| operation.responses.get("default"));
        
        if let Some(OpenAPIResponseOrRef::Response(response)) = success_response {
            Some(response.description.clone())
        } else {
            Some("Success".to_string())
        }
    }

    async fn write_kotlin_class(
        &self,
        kotlin_class: &KotlinClass,
        sub_dir: &str,
    ) -> Result<PathBuf> {
        let content = self.template_engine.generate_kotlin_class(kotlin_class);
        let file_name = format!("{}.kt", kotlin_class.name);
        
        let package_path: PathBuf = kotlin_class.package_name.split('.').collect();
        let output_dir = self.config.output_dir
            .join("src/main/kotlin")
            .join(package_path)
            .join(sub_dir);
        
        let file_path = output_dir.join(&file_name);
        
        fs::create_dir_all(&output_dir).await
            .with_context(|| format!("Failed to create directory: {}", output_dir.display()))?;
        
        fs::write(&file_path, content).await
            .with_context(|| format!("Failed to write file: {}", file_path.display()))?;
        
        Ok(file_path)
    }

    async fn write_kotlin_controller(
        &self,
        kotlin_controller: &KotlinController,
    ) -> Result<PathBuf> {
        let content = self.template_engine.generate_kotlin_controller(kotlin_controller);
        let file_name = format!("{}.kt", kotlin_controller.name);
        
        let package_path: PathBuf = kotlin_controller.package_name.split('.').collect();
        let output_dir = self.config.output_dir
            .join("src/main/kotlin")
            .join(package_path);
        
        let file_path = output_dir.join(&file_name);
        
        fs::create_dir_all(&output_dir).await
            .with_context(|| format!("Failed to create directory: {}", output_dir.display()))?;
        
        fs::write(&file_path, content).await
            .with_context(|| format!("Failed to write file: {}", file_path.display()))?;
        
        Ok(file_path)
    }

    async fn generate_build_file(&self) -> Result<PathBuf> {
        let content = self.template_engine.generate_build_file(&self.config.base_package);
        let file_path = self.config.output_dir.join("build.gradle.kts");
        
        fs::write(&file_path, content).await
            .with_context(|| "Failed to write build.gradle.kts")?;
        
        if self.config.verbose {
            let relative_path = file_path.strip_prefix(&self.config.output_dir)
                .unwrap_or(&file_path);
            println!("Generated build.gradle.kts -> {}", relative_path.display());
        }
        
        Ok(file_path)
    }

    fn get_base_model_imports(&self) -> Vec<String> {
        let mut imports = vec![
            "javax.validation.constraints.*".to_string(),
            "javax.validation.Valid".to_string(),
            "com.fasterxml.jackson.annotation.JsonProperty".to_string(),
        ];
        
        if self.config.include_swagger {
            imports.push("io.swagger.v3.oas.annotations.media.Schema".to_string());
        }
        
        imports
    }

    fn get_base_controller_imports(&self) -> Vec<String> {
        let mut imports = vec![
            "org.springframework.http.ResponseEntity".to_string(),
            "org.springframework.web.bind.annotation.*".to_string(),
            "javax.validation.Valid".to_string(),
            "javax.validation.constraints.*".to_string(),
        ];
        
        if self.config.include_swagger {
            imports.extend([
                "io.swagger.v3.oas.annotations.Operation".to_string(),
                "io.swagger.v3.oas.annotations.responses.ApiResponse".to_string(),
                "io.swagger.v3.oas.annotations.responses.ApiResponses".to_string(),
            ]);
        }
        
        imports
    }

    fn add_imports_for_type(&self, kotlin_type: &str, imports: &mut Vec<String>) {
        if kotlin_type.contains("java.time.LocalDate") {
            imports.push("java.time.LocalDate".to_string());
        }
        if kotlin_type.contains("java.time.OffsetDateTime") {
            imports.push("java.time.OffsetDateTime".to_string());
        }
        if kotlin_type.contains("java.util.UUID") {
            imports.push("java.util.UUID".to_string());
        }
        if kotlin_type.contains("java.net.URI") {
            imports.push("java.net.URI".to_string());
        }
        if kotlin_type.contains("java.math.BigDecimal") {
            imports.push("java.math.BigDecimal".to_string());
        }
    }

    fn format_default_value(&self, value: &serde_json::Value, kotlin_type: &str) -> String {
        match value {
            serde_json::Value::Null => "null".to_string(),
            serde_json::Value::String(s) => {
                if kotlin_type == "String" {
                    format!("\"{}\"", s)
                } else {
                    s.clone()
                }
            }
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Number(n) => n.to_string(),
            _ => value.to_string(),
        }
    }

    fn pascal_case(&self, s: &str) -> String {
        let re = Regex::new(r"[-_\s]+(.?)").unwrap();
        let result = re.replace_all(s, |caps: &regex::Captures| {
            caps.get(1).map_or("".to_string(), |m| m.as_str().to_uppercase())
        });
        
        // Capitalize first character
        let mut chars = result.chars();
        match chars.next() {
            None => String::new(),
            Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        }
    }

    fn camel_case(&self, s: &str) -> String {
        let pascal = self.pascal_case(s);
        let mut chars = pascal.chars();
        match chars.next() {
            None => String::new(),
            Some(first) => first.to_lowercase().collect::<String>() + chars.as_str(),
        }
    }
}