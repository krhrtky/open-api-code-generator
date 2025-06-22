#[cfg(test)]
mod generator_tests {
    use super::*;
    use crate::types::*;
    use anyhow::Result;
    use serde_json::json;
    use std::collections::HashMap;
    use std::path::PathBuf;
    use tempfile::TempDir;
    use tokio::fs;

    fn create_test_config() -> GeneratorConfig {
        GeneratorConfig {
            base_package: "com.example.api".to_string(),
            output_dir: PathBuf::from("/tmp/test_output"),
            generate_models: true,
            generate_controllers: true,
            include_validation: true,
            include_swagger: true,
            verbose: false,
        }
    }

    fn create_test_generator() -> OpenAPICodeGenerator {
        OpenAPICodeGenerator::new(create_test_config())
    }

    #[test]
    fn test_generator_creation() {
        let config = create_test_config();
        let generator = OpenAPICodeGenerator::new(config.clone());
        
        assert_eq!(generator.config.base_package, "com.example.api");
        assert_eq!(generator.config.output_dir, PathBuf::from("/tmp/test_output"));
        assert!(generator.config.generate_models);
        assert!(generator.config.generate_controllers);
        assert!(generator.config.include_validation);
        assert!(generator.config.include_swagger);
    }

    #[test]
    fn test_pascal_case_conversion() {
        let generator = create_test_generator();
        
        assert_eq!(generator.pascal_case("hello_world"), "HelloWorld");
        assert_eq!(generator.pascal_case("api-endpoint"), "ApiEndpoint");
        assert_eq!(generator.pascal_case("user name"), "UserName");
        assert_eq!(generator.pascal_case("snake_case_name"), "SnakeCaseName");
        assert_eq!(generator.pascal_case("kebab-case-name"), "KebabCaseName");
        assert_eq!(generator.pascal_case("already_Pascal"), "AlreadyPascal");
        assert_eq!(generator.pascal_case(""), "");
        assert_eq!(generator.pascal_case("a"), "A");
    }

    #[test]
    fn test_camel_case_conversion() {
        let generator = create_test_generator();
        
        assert_eq!(generator.camel_case("hello_world"), "helloWorld");
        assert_eq!(generator.camel_case("api-endpoint"), "apiEndpoint");
        assert_eq!(generator.camel_case("user name"), "userName");
        assert_eq!(generator.camel_case("snake_case_name"), "snakeCaseName");
        assert_eq!(generator.camel_case("kebab-case-name"), "kebabCaseName");
        assert_eq!(generator.camel_case("Already_Pascal"), "alreadyPascal");
        assert_eq!(generator.camel_case(""), "");
        assert_eq!(generator.camel_case("a"), "a");
    }

    #[test]
    fn test_map_schema_to_kotlin_type_primitives() {
        let generator = create_test_generator();
        
        // String types
        let string_schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: None,
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&string_schema).unwrap(), "String");

        // String with date format
        let date_schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: Some("date".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&date_schema).unwrap(), "java.time.LocalDate");

        // String with date-time format
        let datetime_schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: Some("date-time".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&datetime_schema).unwrap(), "java.time.OffsetDateTime");

        // String with UUID format
        let uuid_schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: Some("uuid".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&uuid_schema).unwrap(), "java.util.UUID");

        // String with URI format
        let uri_schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: Some("uri".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&uri_schema).unwrap(), "java.net.URI");

        // String with binary format
        let binary_schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: Some("binary".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&binary_schema).unwrap(), "ByteArray");
    }

    #[test]
    fn test_map_schema_to_kotlin_type_numbers() {
        let generator = create_test_generator();
        
        // Integer types
        let int_schema = OpenAPISchema {
            schema_type: Some("integer".to_string()),
            format: None,
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&int_schema).unwrap(), "Int");

        let long_schema = OpenAPISchema {
            schema_type: Some("integer".to_string()),
            format: Some("int64".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&long_schema).unwrap(), "Long");

        // Number types
        let number_schema = OpenAPISchema {
            schema_type: Some("number".to_string()),
            format: None,
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&number_schema).unwrap(), "java.math.BigDecimal");

        let float_schema = OpenAPISchema {
            schema_type: Some("number".to_string()),
            format: Some("float".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&float_schema).unwrap(), "Float");

        let double_schema = OpenAPISchema {
            schema_type: Some("number".to_string()),
            format: Some("double".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&double_schema).unwrap(), "Double");
    }

    #[test]
    fn test_map_schema_to_kotlin_type_boolean() {
        let generator = create_test_generator();
        
        let boolean_schema = OpenAPISchema {
            schema_type: Some("boolean".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&boolean_schema).unwrap(), "Boolean");
    }

    #[test]
    fn test_map_schema_to_kotlin_type_array() {
        let generator = create_test_generator();
        
        let array_schema = OpenAPISchema {
            schema_type: Some("array".to_string()),
            items: Some(Box::new(OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("string".to_string()),
                ..Default::default()
            })))),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&array_schema).unwrap(), "List<String>");

        // Array without items
        let array_no_items = OpenAPISchema {
            schema_type: Some("array".to_string()),
            items: None,
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&array_no_items).unwrap(), "List<Any>");
    }

    #[test]
    fn test_map_schema_to_kotlin_type_object() {
        let generator = create_test_generator();
        
        let object_schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            ..Default::default()
        };
        assert_eq!(generator.map_schema_to_kotlin_type(&object_schema).unwrap(), "Map<String, Any>");
    }

    #[test]
    fn test_generate_validation_annotations_required() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            nullable: Some(false),
            ..Default::default()
        };
        
        let annotations = generator.generate_validation_annotations(&schema, true);
        assert!(annotations.contains(&"@NotNull".to_string()));
    }

    #[test]
    fn test_generate_validation_annotations_string_constraints() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            format: Some("email".to_string()),
            min_length: Some(5),
            max_length: Some(100),
            pattern: Some("[a-z]+".to_string()),
            ..Default::default()
        };
        
        let annotations = generator.generate_validation_annotations(&schema, false);
        assert!(annotations.contains(&"@Email".to_string()));
        assert!(annotations.contains(&"@Size(min = 5, max = 100)".to_string()));
        assert!(annotations.contains(&"@Pattern(regexp = \"[a-z]+\")".to_string()));
    }

    #[test]
    fn test_generate_validation_annotations_numeric_constraints() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("integer".to_string()),
            minimum: Some(0.0),
            maximum: Some(100.0),
            ..Default::default()
        };
        
        let annotations = generator.generate_validation_annotations(&schema, false);
        assert!(annotations.contains(&"@Min(0)".to_string()));
        assert!(annotations.contains(&"@Max(100)".to_string()));
    }

    #[test]
    fn test_generate_validation_annotations_array_constraints() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("array".to_string()),
            min_items: Some(1),
            max_items: Some(10),
            ..Default::default()
        };
        
        let annotations = generator.generate_validation_annotations(&schema, false);
        assert!(annotations.contains(&"@Size(min = 1, max = 10)".to_string()));
    }

    #[test]
    fn test_generate_validation_annotations_object_constraints() {
        let generator = create_test_generator();
        
        let mut properties = HashMap::new();
        properties.insert("name".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        })));
        
        let schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties,
            ..Default::default()
        };
        
        let annotations = generator.generate_validation_annotations(&schema, false);
        assert!(annotations.contains(&"@Valid".to_string()));
    }

    #[test]
    fn test_convert_schema_to_kotlin_property() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            description: Some("User name".to_string()),
            default: Some(json!("default_name")),
            ..Default::default()
        };
        
        let required = vec!["user_name".to_string()];
        let property = generator.convert_schema_to_kotlin_property("user_name", &schema, &required).unwrap();
        
        assert_eq!(property.name, "userName");
        assert_eq!(property.kotlin_type, "String");
        assert!(!property.nullable);
        assert_eq!(property.description, Some("User name".to_string()));
        assert_eq!(property.default_value, Some("\"default_name\"".to_string()));
        assert!(property.validation.contains(&"@NotNull".to_string()));
    }

    #[test]
    fn test_convert_schema_to_kotlin_property_optional() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            nullable: Some(true),
            ..Default::default()
        };
        
        let required = vec![];
        let property = generator.convert_schema_to_kotlin_property("optional_field", &schema, &required).unwrap();
        
        assert_eq!(property.name, "optionalField");
        assert_eq!(property.kotlin_type, "String");
        assert!(property.nullable);
        assert_eq!(property.default_value, Some("null".to_string()));
        assert!(!property.validation.contains(&"@NotNull".to_string()));
    }

    #[test]
    fn test_convert_schema_to_kotlin_class_simple() {
        let generator = create_test_generator();
        
        let mut properties = HashMap::new();
        properties.insert("name".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        })));
        properties.insert("age".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("integer".to_string()),
            ..Default::default()
        })));
        
        let schema = Box::new(OpenAPISchema {
            schema_type: Some("object".to_string()),
            description: Some("User entity".to_string()),
            properties,
            required: vec!["name".to_string()],
            ..Default::default()
        });
        
        // Mock the parser for this test
        let kotlin_class = generator.convert_schema_to_kotlin_class("User", schema).unwrap();
        
        assert_eq!(kotlin_class.name, "User");
        assert_eq!(kotlin_class.package_name, "com.example.api");
        assert_eq!(kotlin_class.description, Some("User entity".to_string()));
        assert_eq!(kotlin_class.properties.len(), 2);
        assert!(kotlin_class.imports.contains(&"javax.validation.constraints.*".to_string()));
    }

    #[test]
    fn test_convert_one_of_to_sealed_class() {
        let generator = create_test_generator();
        
        let mut one_of_variants = HashMap::new();
        one_of_variants.insert("Dog".to_string(), OpenAPISchema {
            schema_type: Some("object".to_string()),
            description: Some("Dog variant".to_string()),
            ..Default::default()
        });
        one_of_variants.insert("Cat".to_string(), OpenAPISchema {
            schema_type: Some("object".to_string()),
            description: Some("Cat variant".to_string()),
            ..Default::default()
        });
        
        let schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            description: Some("Pet entity".to_string()),
            one_of_variants: Some(one_of_variants),
            discriminator: Some(OpenAPIDiscriminator {
                property_name: "type".to_string(),
                mapping: None,
            }),
            ..Default::default()
        };
        
        let kotlin_class = generator.convert_one_of_to_sealed_class("Pet", &schema).unwrap();
        
        assert_eq!(kotlin_class.name, "Pet");
        assert_eq!(kotlin_class.is_sealed, Some(true));
        assert!(kotlin_class.sealed_sub_types.is_some());
        assert_eq!(kotlin_class.sealed_sub_types.as_ref().unwrap().len(), 2);
        assert!(kotlin_class.imports.contains(&"com.fasterxml.jackson.annotation.JsonSubTypes".to_string()));
        assert!(kotlin_class.imports.contains(&"com.fasterxml.jackson.annotation.JsonTypeInfo".to_string()));
    }

    #[test]
    fn test_convert_any_of_to_union_type() {
        let generator = create_test_generator();
        
        let mut any_of_variants = HashMap::new();
        any_of_variants.insert("String".to_string(), OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        });
        any_of_variants.insert("Integer".to_string(), OpenAPISchema {
            schema_type: Some("integer".to_string()),
            ..Default::default()
        });
        
        let schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            description: Some("Union type".to_string()),
            any_of_variants: Some(any_of_variants),
            ..Default::default()
        };
        
        let kotlin_class = generator.convert_any_of_to_union_type("UnionType", &schema).unwrap();
        
        assert_eq!(kotlin_class.name, "UnionType");
        assert_eq!(kotlin_class.properties.len(), 2);
        assert!(kotlin_class.imports.contains(&"com.fasterxml.jackson.annotation.JsonValue".to_string()));
        assert!(kotlin_class.imports.contains(&"com.fasterxml.jackson.annotation.JsonCreator".to_string()));
        
        let value_prop = kotlin_class.properties.iter().find(|p| p.name == "value").unwrap();
        assert_eq!(value_prop.kotlin_type, "Any");
        assert!(value_prop.validation.contains(&"@JsonValue".to_string()));
    }

    #[test]
    fn test_generate_method_name() {
        let generator = create_test_generator();
        
        assert_eq!(generator.generate_method_name("get", "/users"), "getUsers");
        assert_eq!(generator.generate_method_name("post", "/users"), "createUsers");
        assert_eq!(generator.generate_method_name("put", "/users"), "updateUsers");
        assert_eq!(generator.generate_method_name("delete", "/users"), "deleteUsers");
        assert_eq!(generator.generate_method_name("patch", "/users"), "patchUsers");
        assert_eq!(generator.generate_method_name("get", "/users/{id}"), "getUsers");
        assert_eq!(generator.generate_method_name("get", "/api/v1/users"), "getUsers");
    }

    #[test]
    fn test_determine_return_type() {
        let generator = create_test_generator();
        
        let mut responses = HashMap::new();
        responses.insert("200".to_string(), OpenAPIResponseOrRef::Response(Box::new(OpenAPIResponse {
            description: "Success".to_string(),
            content: {
                let mut content = HashMap::new();
                content.insert("application/json".to_string(), OpenAPIMediaType {
                    schema: Some(OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                        schema_type: Some("string".to_string()),
                        ..Default::default()
                    }))),
                    example: None,
                    examples: HashMap::new(),
                    encoding: HashMap::new(),
                });
                content
            },
            headers: HashMap::new(),
            links: HashMap::new(),
        })));
        
        let operation = OpenAPIOperation {
            responses,
            ..Default::default()
        };
        
        let return_type = generator.determine_return_type(&operation).unwrap();
        assert_eq!(return_type, "ResponseEntity<String>");
    }

    #[test]
    fn test_determine_return_type_default() {
        let generator = create_test_generator();
        
        let operation = OpenAPIOperation {
            responses: HashMap::new(),
            ..Default::default()
        };
        
        let return_type = generator.determine_return_type(&operation).unwrap();
        assert_eq!(return_type, "ResponseEntity<Any>");
    }

    #[test]
    fn test_get_response_description() {
        let generator = create_test_generator();
        
        let mut responses = HashMap::new();
        responses.insert("200".to_string(), OpenAPIResponseOrRef::Response(Box::new(OpenAPIResponse {
            description: "User retrieved successfully".to_string(),
            content: HashMap::new(),
            headers: HashMap::new(),
            links: HashMap::new(),
        })));
        
        let operation = OpenAPIOperation {
            responses,
            ..Default::default()
        };
        
        let description = generator.get_response_description(&operation);
        assert_eq!(description, Some("User retrieved successfully".to_string()));
    }

    #[test]
    fn test_convert_parameter_to_kotlin() {
        let generator = create_test_generator();
        
        let parameter = OpenAPIParameter {
            name: "user_id".to_string(),
            location: "path".to_string(),
            description: Some("User identifier".to_string()),
            required: true,
            deprecated: false,
            allow_empty_value: false,
            style: None,
            explode: None,
            allow_reserved: false,
            schema: Some(OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("string".to_string()),
                ..Default::default()
            }))),
            example: None,
            examples: HashMap::new(),
        };
        
        let kotlin_param = generator.convert_parameter_to_kotlin(&parameter).unwrap();
        
        assert_eq!(kotlin_param.name, "userId");
        assert_eq!(kotlin_param.kotlin_type, "String");
        assert_eq!(kotlin_param.param_type, ParameterType::Path);
        assert!(kotlin_param.required);
        assert_eq!(kotlin_param.description, Some("User identifier".to_string()));
        assert!(kotlin_param.validation.contains(&"@NotNull".to_string()));
    }

    #[test]
    fn test_convert_operations_to_kotlin_controller() {
        let generator = create_test_generator();
        
        let operation = OpenAPIOperation {
            tags: vec!["Users".to_string()],
            summary: Some("Get user by ID".to_string()),
            description: Some("Retrieves a user by their unique identifier".to_string()),
            operation_id: Some("getUserById".to_string()),
            parameters: vec![],
            request_body: None,
            responses: HashMap::new(),
            callbacks: HashMap::new(),
            deprecated: false,
            security: vec![],
            servers: vec![],
        };
        
        let operations = vec![("/users/{id}".to_string(), "get".to_string(), &operation)];
        let kotlin_controller = generator.convert_operations_to_kotlin_controller("Users", &operations).unwrap();
        
        assert_eq!(kotlin_controller.name, "UsersController");
        assert_eq!(kotlin_controller.package_name, "com.example.api");
        assert_eq!(kotlin_controller.methods.len(), 1);
        assert!(kotlin_controller.imports.contains(&"org.springframework.http.ResponseEntity".to_string()));
        
        let method = &kotlin_controller.methods[0];
        assert_eq!(method.name, "getUserById");
        assert_eq!(method.http_method, "get");
        assert_eq!(method.path, "/users/{id}");
        assert_eq!(method.summary, Some("Get user by ID".to_string()));
    }

    #[test]
    fn test_convert_operation_to_kotlin_method_with_request_body() {
        let generator = create_test_generator();
        
        let mut content = HashMap::new();
        content.insert("application/json".to_string(), OpenAPIMediaType {
            schema: Some(OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
                schema_type: Some("object".to_string()),
                ..Default::default()
            }))),
            example: None,
            examples: HashMap::new(),
            encoding: HashMap::new(),
        });
        
        let request_body = OpenAPIRequestBody {
            description: Some("User data".to_string()),
            content,
            required: true,
        };
        
        let operation = OpenAPIOperation {
            operation_id: Some("createUser".to_string()),
            summary: Some("Create a new user".to_string()),
            request_body: Some(OpenAPIRequestBodyOrRef::RequestBody(Box::new(request_body))),
            ..Default::default()
        };
        
        let kotlin_method = generator.convert_operation_to_kotlin_method("/users", "post", &operation).unwrap();
        
        assert_eq!(kotlin_method.name, "createUser");
        assert_eq!(kotlin_method.http_method, "post");
        assert_eq!(kotlin_method.path, "/users");
        assert!(kotlin_method.request_body.is_some());
        
        let body_param = kotlin_method.request_body.as_ref().unwrap();
        assert_eq!(body_param.name, "body");
        assert_eq!(body_param.kotlin_type, "Map<String, Any>");
        assert_eq!(body_param.param_type, ParameterType::Body);
        assert!(body_param.required);
        assert!(body_param.validation.contains(&"@Valid".to_string()));
    }

    #[test]
    fn test_format_default_value() {
        let generator = create_test_generator();
        
        assert_eq!(generator.format_default_value(&json!("hello"), "String"), "\"hello\"");
        assert_eq!(generator.format_default_value(&json!(42), "Int"), "42");
        assert_eq!(generator.format_default_value(&json!(true), "Boolean"), "true");
        assert_eq!(generator.format_default_value(&json!(null), "String"), "null");
        assert_eq!(generator.format_default_value(&json!("test"), "UUID"), "test");
    }

    #[test]
    fn test_get_base_model_imports() {
        let generator = create_test_generator();
        let imports = generator.get_base_model_imports();
        
        assert!(imports.contains(&"javax.validation.constraints.*".to_string()));
        assert!(imports.contains(&"javax.validation.Valid".to_string()));
        assert!(imports.contains(&"com.fasterxml.jackson.annotation.JsonProperty".to_string()));
        assert!(imports.contains(&"io.swagger.v3.oas.annotations.media.Schema".to_string()));
    }

    #[test]
    fn test_get_base_controller_imports() {
        let generator = create_test_generator();
        let imports = generator.get_base_controller_imports();
        
        assert!(imports.contains(&"org.springframework.http.ResponseEntity".to_string()));
        assert!(imports.contains(&"org.springframework.web.bind.annotation.*".to_string()));
        assert!(imports.contains(&"javax.validation.Valid".to_string()));
        assert!(imports.contains(&"javax.validation.constraints.*".to_string()));
        assert!(imports.contains(&"io.swagger.v3.oas.annotations.Operation".to_string()));
        assert!(imports.contains(&"io.swagger.v3.oas.annotations.responses.ApiResponse".to_string()));
        assert!(imports.contains(&"io.swagger.v3.oas.annotations.responses.ApiResponses".to_string()));
    }

    #[test]
    fn test_add_imports_for_type() {
        let generator = create_test_generator();
        let mut imports = Vec::new();
        
        generator.add_imports_for_type("java.time.LocalDate", &mut imports);
        assert!(imports.contains(&"java.time.LocalDate".to_string()));
        
        generator.add_imports_for_type("java.time.OffsetDateTime", &mut imports);
        assert!(imports.contains(&"java.time.OffsetDateTime".to_string()));
        
        generator.add_imports_for_type("java.util.UUID", &mut imports);
        assert!(imports.contains(&"java.util.UUID".to_string()));
        
        generator.add_imports_for_type("java.net.URI", &mut imports);
        assert!(imports.contains(&"java.net.URI".to_string()));
        
        generator.add_imports_for_type("java.math.BigDecimal", &mut imports);
        assert!(imports.contains(&"java.math.BigDecimal".to_string()));
        
        generator.add_imports_for_type("String", &mut imports);
        // Should not add any import for basic types
        assert_eq!(imports.len(), 5);
    }

    #[tokio::test]
    async fn test_full_generation_workflow() {
        let temp_dir = TempDir::new().unwrap();
        let config = GeneratorConfig {
            base_package: "com.test.api".to_string(),
            output_dir: temp_dir.path().to_path_buf(),
            generate_models: true,
            generate_controllers: true,
            include_validation: true,
            include_swagger: true,
            verbose: false,
        };
        
        let mut generator = OpenAPICodeGenerator::new(config);
        
        // Create a simple OpenAPI spec file
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/users": {
                    "get": {
                        "tags": ["Users"],
                        "operationId": "getUsers",
                        "summary": "Get all users",
                        "responses": {
                            "200": {
                                "description": "Success",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/User"
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "required": ["id", "name"],
                        "properties": {
                            "id": {
                                "type": "integer",
                                "format": "int64"
                            },
                            "name": {
                                "type": "string",
                                "minLength": 1,
                                "maxLength": 100
                            },
                            "email": {
                                "type": "string",
                                "format": "email"
                            }
                        }
                    }
                }
            }
        });
        
        let spec_file = temp_dir.path().join("openapi.json");
        fs::write(&spec_file, serde_json::to_string_pretty(&spec).unwrap()).await.unwrap();
        
        let result = generator.generate(&spec_file).await.unwrap();
        
        assert_eq!(result.output_dir, temp_dir.path().to_path_buf());
        assert!(result.file_count > 0);
        assert!(!result.generated_files.is_empty());
        
        // Verify build file was created
        let build_file = temp_dir.path().join("build.gradle.kts");
        assert!(build_file.exists());
    }

    #[tokio::test]
    async fn test_error_handling_invalid_spec() {
        let temp_dir = TempDir::new().unwrap();
        let config = GeneratorConfig {
            base_package: "com.test.api".to_string(),
            output_dir: temp_dir.path().to_path_buf(),
            generate_models: true,
            generate_controllers: true,
            include_validation: true,
            include_swagger: true,
            verbose: false,
        };
        
        let mut generator = OpenAPICodeGenerator::new(config);
        
        // Create an invalid OpenAPI spec
        let invalid_spec = json!({
            "invalid": "spec"
        });
        
        let spec_file = temp_dir.path().join("invalid.json");
        fs::write(&spec_file, serde_json::to_string_pretty(&invalid_spec).unwrap()).await.unwrap();
        
        let result = generator.generate(&spec_file).await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_error_handling_nonexistent_file() {
        let temp_dir = TempDir::new().unwrap();
        let config = GeneratorConfig {
            base_package: "com.test.api".to_string(),
            output_dir: temp_dir.path().to_path_buf(),
            generate_models: true,
            generate_controllers: true,
            include_validation: true,
            include_swagger: true,
            verbose: false,
        };
        
        let mut generator = OpenAPICodeGenerator::new(config);
        
        let nonexistent_file = temp_dir.path().join("nonexistent.json");
        let result = generator.generate(&nonexistent_file).await;
        assert!(result.is_err());
    }

    #[test]
    fn test_complex_schema_patterns() {
        let generator = create_test_generator();
        
        // Test nested objects
        let mut nested_properties = HashMap::new();
        nested_properties.insert("street".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        })));
        nested_properties.insert("city".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        })));
        
        let mut properties = HashMap::new();
        properties.insert("name".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        })));
        properties.insert("address".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties: nested_properties,
            ..Default::default()
        })));
        
        let schema = Box::new(OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties,
            required: vec!["name".to_string()],
            ..Default::default()
        });
        
        let kotlin_class = generator.convert_schema_to_kotlin_class("Person", schema).unwrap();
        
        assert_eq!(kotlin_class.name, "Person");
        assert_eq!(kotlin_class.properties.len(), 2);
        
        let address_prop = kotlin_class.properties.iter().find(|p| p.name == "address").unwrap();
        assert_eq!(address_prop.kotlin_type, "Map<String, Any>");
    }

    #[test] 
    fn test_polymorphic_inheritance_patterns() {
        let generator = create_test_generator();
        
        // Test allOf composition (inheritance)
        let mut base_properties = HashMap::new();
        base_properties.insert("id".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("integer".to_string()),
            ..Default::default()
        })));
        
        let base_schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties: base_properties,
            ..Default::default()
        };
        
        let mut extended_properties = HashMap::new();
        extended_properties.insert("name".to_string(), OpenAPISchemaOrRef::Schema(Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            ..Default::default()
        })));
        
        let extended_schema = OpenAPISchema {
            schema_type: Some("object".to_string()),
            properties: extended_properties,
            all_of_schemas: Some(vec![base_schema]),
            ..Default::default()
        };
        
        let kotlin_class = generator.convert_schema_to_kotlin_class("ExtendedEntity", Box::new(extended_schema)).unwrap();
        
        assert_eq!(kotlin_class.name, "ExtendedEntity");
        // Should have properties from both base and extended schemas
        assert!(kotlin_class.properties.len() >= 1);
    }

    #[test]
    fn test_enum_generation_patterns() {
        let generator = create_test_generator();
        
        let enum_values = vec![
            serde_json::Value::String("ACTIVE".to_string()),
            serde_json::Value::String("INACTIVE".to_string()),
            serde_json::Value::String("PENDING".to_string()),
        ];
        
        let schema = Box::new(OpenAPISchema {
            schema_type: Some("string".to_string()),
            enum_values: Some(enum_values),
            description: Some("User status enumeration".to_string()),
            ..Default::default()
        });
        
        let kotlin_class = generator.convert_schema_to_kotlin_class("UserStatus", schema).unwrap();
        
        assert_eq!(kotlin_class.name, "UserStatus");
        assert_eq!(kotlin_class.description, Some("User status enumeration".to_string()));
    }

    #[test]
    fn test_nullable_and_optional_fields() {
        let generator = create_test_generator();
        
        let schema = OpenAPISchema {
            schema_type: Some("string".to_string()),
            nullable: Some(true),
            ..Default::default()
        };
        
        let required = vec![];
        let property = generator.convert_schema_to_kotlin_property("optional_field", &schema, &required).unwrap();
        
        assert_eq!(property.name, "optionalField");
        assert!(property.nullable);
        assert_eq!(property.default_value, Some("null".to_string()));
        assert!(!property.validation.contains(&"@NotNull".to_string()));
    }

    #[test]
    fn test_naming_conflict_resolution() {
        let generator = create_test_generator();
        
        // Test pascal case conversion for reserved Kotlin keywords
        assert_eq!(generator.pascal_case("class"), "Class");
        assert_eq!(generator.pascal_case("object"), "Object");
        assert_eq!(generator.pascal_case("interface"), "Interface");
        assert_eq!(generator.pascal_case("fun"), "Fun");
        
        // Test camel case conversion
        assert_eq!(generator.camel_case("class"), "class");
        assert_eq!(generator.camel_case("object"), "object");
        assert_eq!(generator.camel_case("interface"), "interface");
    }

    #[test]
    fn test_generate_package_structure() {
        let generator = create_test_generator();
        
        // Test that imports are correctly structured
        let imports = generator.get_base_model_imports();
        
        // Verify core validation imports
        assert!(imports.contains(&"javax.validation.constraints.*".to_string()));
        assert!(imports.contains(&"javax.validation.Valid".to_string()));
        
        // Verify JSON processing imports
        assert!(imports.contains(&"com.fasterxml.jackson.annotation.JsonProperty".to_string()));
        
        // Verify Swagger imports when enabled
        assert!(imports.contains(&"io.swagger.v3.oas.annotations.media.Schema".to_string()));
    }
}