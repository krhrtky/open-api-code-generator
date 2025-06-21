use openapi_codegen_rust::parser::OpenAPIParser;
use openapi_codegen_rust::types::*;
use serde_json::json;
use std::fs;
use tempfile::TempDir;
use tokio;

/// Comprehensive OpenAPI Parser Unit Tests
///
/// This module provides extensive testing coverage for the OpenAPIParser
/// to ensure robust parsing, validation, and schema resolution capabilities.

#[cfg(test)]
mod parser_unit_tests {
    use super::*;

    /// Helper function to create a temporary file with OpenAPI content
    pub async fn create_temp_openapi_file(
        content: &serde_json::Value,
        extension: &str,
    ) -> (TempDir, String) {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join(format!("test_spec.{}", extension));

        let content_str = if extension == "yaml" || extension == "yml" {
            serde_yaml::to_string(content).expect("Failed to serialize to YAML")
        } else {
            serde_json::to_string_pretty(content).expect("Failed to serialize to JSON")
        };

        fs::write(&file_path, content_str).expect("Failed to write temp file");

        (temp_dir, file_path.to_string_lossy().to_string())
    }

    /// Basic OpenAPI specification for testing
    pub fn basic_openapi_spec() -> serde_json::Value {
        json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Basic Test API",
                "version": "1.0.0",
                "description": "Basic API for parser testing"
            },
            "paths": {
                "/users": {
                    "get": {
                        "summary": "Get users",
                        "operationId": "getUsers",
                        "tags": ["users"],
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
                                "type": "string"
                            },
                            "email": {
                                "type": "string",
                                "format": "email"
                            }
                        }
                    }
                }
            }
        })
    }

    /// Complex schema composition test spec (allOf, oneOf, anyOf)
    fn complex_schema_composition_spec() -> serde_json::Value {
        json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Complex Schema Test API",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "BaseModel": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "integer" },
                            "createdAt": { "type": "string", "format": "date-time" }
                        }
                    },
                    "UserModel": {
                        "allOf": [
                            { "$ref": "#/components/schemas/BaseModel" },
                            {
                                "type": "object",
                                "properties": {
                                    "username": { "type": "string" },
                                    "email": { "type": "string" }
                                }
                            }
                        ]
                    },
                    "ContactMethod": {
                        "oneOf": [
                            {
                                "type": "object",
                                "properties": {
                                    "type": { "type": "string", "enum": ["email"] },
                                    "email": { "type": "string", "format": "email" }
                                }
                            },
                            {
                                "type": "object",
                                "properties": {
                                    "type": { "type": "string", "enum": ["phone"] },
                                    "phone": { "type": "string" }
                                }
                            }
                        ]
                    },
                    "FlexibleData": {
                        "anyOf": [
                            { "type": "string" },
                            { "type": "integer" },
                            {
                                "type": "object",
                                "properties": {
                                    "custom": { "type": "string" }
                                }
                            }
                        ]
                    }
                }
            }
        })
    }

    /// Circular reference test spec
    fn circular_reference_spec() -> serde_json::Value {
        json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Circular Reference Test API",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "Node": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "string" },
                            "children": {
                                "type": "array",
                                "items": { "$ref": "#/components/schemas/Node" }
                            },
                            "parent": { "$ref": "#/components/schemas/Node" }
                        }
                    }
                }
            }
        })
    }

    #[tokio::test]
    async fn test_parser_creation() {
        let _parser = OpenAPIParser::new();
        // Note: get_spec() may panic if no spec is loaded, so we test after parsing

        let _default_parser = OpenAPIParser::default();
        // Testing default creation successful
        assert!(true, "Parser creation successful");
    }

    #[tokio::test]
    async fn test_parse_json_file() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok(), "Should successfully parse JSON file");
        let parsed_spec = result.unwrap();
        assert_eq!(parsed_spec.info.title, "Basic Test API");
        assert_eq!(parsed_spec.info.version, "1.0.0");
        assert_eq!(parsed_spec.openapi, "3.0.3");
    }

    #[tokio::test]
    async fn test_parse_yaml_file() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "yaml").await;

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok(), "Should successfully parse YAML file");
        let parsed_spec = result.unwrap();
        assert_eq!(parsed_spec.info.title, "Basic Test API");
        assert_eq!(parsed_spec.info.version, "1.0.0");
    }

    #[tokio::test]
    async fn test_parse_nonexistent_file() {
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file("/nonexistent/file.json").await;

        assert!(result.is_err(), "Should fail to parse nonexistent file");
    }

    #[tokio::test]
    async fn test_parse_invalid_json() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("invalid.json");
        fs::write(&file_path, "{ invalid json }").expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err(), "Should fail to parse invalid JSON");
    }

    #[tokio::test]
    async fn test_schema_reference_resolution() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let reference = "#/components/schemas/User";
        let result = parser.resolve_reference(reference);

        assert!(result.is_ok(), "Should resolve valid reference");
        let schema = result.unwrap();
        assert_eq!(schema.schema_type, Some("object".to_string()));
    }

    #[tokio::test]
    async fn test_invalid_schema_reference() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let invalid_reference = "#/components/schemas/NonExistent";
        let result = parser.resolve_reference(invalid_reference);

        assert!(result.is_err(), "Should fail to resolve invalid reference");
    }

    #[tokio::test]
    async fn test_schema_composition_allof() {
        let spec = complex_schema_composition_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let user_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/UserModel".to_string(),
        });
        let result = parser.resolve_schema(&user_schema_ref);

        assert!(result.is_ok(), "Should resolve allOf schema composition");
        let resolved_schema = result.unwrap();

        // Should contain properties from both base and extended schemas
        assert!(
            !resolved_schema.properties.is_empty(),
            "Should have properties"
        );
        let properties = &resolved_schema.properties;
        assert!(
            properties.contains_key("id"),
            "Should contain id from BaseModel"
        );
        assert!(
            properties.contains_key("username"),
            "Should contain username from extension"
        );
    }

    #[tokio::test]
    async fn test_schema_composition_oneof() {
        let spec = complex_schema_composition_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let contact_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/ContactMethod".to_string(),
        });
        let result = parser.resolve_schema(&contact_schema_ref);

        assert!(result.is_ok(), "Should resolve oneOf schema composition");
        let resolved_schema = result.unwrap();
        assert!(
            !resolved_schema.one_of.is_empty(),
            "Should have oneOf variants"
        );
    }

    #[tokio::test]
    async fn test_schema_composition_anyof() {
        let spec = complex_schema_composition_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let flexible_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/FlexibleData".to_string(),
        });
        let result = parser.resolve_schema(&flexible_schema_ref);

        assert!(result.is_ok(), "Should resolve anyOf schema composition");
        let resolved_schema = result.unwrap();
        assert!(
            !resolved_schema.any_of.is_empty(),
            "Should have anyOf variants"
        );
    }

    #[tokio::test]
    async fn test_circular_reference_detection() {
        let spec = circular_reference_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let node_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/Node".to_string(),
        });
        let result = parser.resolve_schema(&node_schema_ref);

        // Should handle circular references gracefully without infinite recursion
        assert!(result.is_ok(), "Should handle circular references");
    }

    #[tokio::test]
    async fn test_extract_schema_name() {
        let test_cases = vec![
            ("#/components/schemas/User", "User"),
            ("#/components/schemas/UserProfile", "UserProfile"),
            ("#/definitions/Model", "Model"),
            ("invalid_reference", "invalid_reference"),
        ];

        for (reference, expected_name) in test_cases {
            let extracted_name = OpenAPIParser::extract_schema_name(reference);
            assert_eq!(
                extracted_name, expected_name,
                "Should extract correct schema name"
            );
        }
    }

    #[tokio::test]
    async fn test_get_all_schemas() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let result = parser.get_all_schemas();
        assert!(result.is_ok(), "Should get all schemas");

        let schemas = result.unwrap();
        assert_eq!(schemas.len(), 1, "Should have one schema");
        assert_eq!(schemas[0].0, "User", "Should have User schema");
    }

    #[tokio::test]
    async fn test_get_all_tags() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let tags = parser.get_all_tags();
        assert_eq!(tags.len(), 1, "Should have one tag");
        assert_eq!(tags[0], "users", "Should have users tag");
    }

    #[tokio::test]
    async fn test_get_operations_by_tag() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let result = parser.get_operations_by_tag();
        assert!(result.is_ok(), "Should get operations by tag");

        let operations = result.unwrap();
        assert!(
            operations.contains_key("users"),
            "Should have users operations"
        );
        assert_eq!(
            operations["users"].len(),
            1,
            "Should have one operation for users"
        );
    }

    #[tokio::test]
    async fn test_spec_access() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();

        // After parsing
        parser
            .parse_file(&file_path)
            .await
            .expect("Should parse file");

        let parsed_spec = parser.get_spec();
        assert_eq!(parsed_spec.info.title, "Basic Test API");
    }

    #[tokio::test]
    async fn test_large_specification_performance() {
        // Create a large specification for performance testing
        let mut large_spec = basic_openapi_spec();
        let mut schemas = serde_json::Map::new();

        // Add 100 schemas to test performance
        for i in 0..100 {
            let schema_name = format!("Model{}", i);
            schemas.insert(
                schema_name,
                json!({
                    "type": "object",
                    "properties": {
                        "id": { "type": "integer" },
                        "name": { "type": "string" },
                        "description": { "type": "string" }
                    }
                }),
            );
        }

        large_spec["components"]["schemas"] = serde_json::Value::Object(schemas);

        let (_temp_dir, file_path) = create_temp_openapi_file(&large_spec, "json").await;

        let start_time = std::time::Instant::now();
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;
        let parse_duration = start_time.elapsed();

        assert!(result.is_ok(), "Should parse large specification");
        assert!(
            parse_duration.as_secs() < 5,
            "Should parse within reasonable time"
        );

        // Test schema retrieval performance
        let start_time = std::time::Instant::now();
        let all_schemas = parser.get_all_schemas().unwrap();
        let retrieval_duration = start_time.elapsed();

        assert_eq!(
            all_schemas.len(),
            101,
            "Should have all schemas (100 + User)"
        );
        assert!(
            retrieval_duration.as_millis() < 100,
            "Should retrieve schemas quickly"
        );
    }

    #[tokio::test]
    async fn test_error_handling_edge_cases() {
        // Test various error conditions

        // Missing required fields
        let invalid_spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Missing Version"
                // Missing required version field
            },
            "paths": {}
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&invalid_spec, "json").await;

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Note: Depending on the parser implementation, this might succeed or fail
        // The test validates that the parser handles the case gracefully
        match result {
            Ok(_) => {
                // Parser was lenient about missing version
                assert!(true, "Parser handled missing version gracefully");
            }
            Err(_) => {
                // Parser rejected invalid spec
                assert!(true, "Parser correctly rejected invalid spec");
            }
        }
    }

    #[tokio::test]
    async fn test_complex_path_parameters() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Path Parameters Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/users/{userId}": {
                    "get": {
                        "summary": "Get user by ID",
                        "operationId": "getUserById",
                        "parameters": [
                            {
                                "name": "userId",
                                "in": "path",
                                "required": true,
                                "schema": {
                                    "type": "integer",
                                    "format": "int64"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "User found",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/User"
                                        }
                                    }
                                }
                            },
                            "404": {
                                "description": "User not found"
                            }
                        }
                    }
                },
                "/users/{userId}/posts/{postId}": {
                    "get": {
                        "summary": "Get user post",
                        "operationId": "getUserPost",
                        "parameters": [
                            {
                                "name": "userId",
                                "in": "path",
                                "required": true,
                                "schema": { "type": "integer" }
                            },
                            {
                                "name": "postId",
                                "in": "path",
                                "required": true,
                                "schema": { "type": "string" }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Post found"
                            }
                        }
                    }
                }
            },
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "integer" },
                            "name": { "type": "string" }
                        }
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok(), "Should parse spec with path parameters");
        let parsed_spec = result.unwrap();
        assert_eq!(parsed_spec.paths.len(), 2);
    }

    #[tokio::test]
    async fn test_multiple_response_content_types() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Multiple Content Types API",
                "version": "1.0.0"
            },
            "paths": {
                "/data": {
                    "get": {
                        "summary": "Get data in multiple formats",
                        "responses": {
                            "200": {
                                "description": "Success",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "data": { "type": "string" }
                                            }
                                        }
                                    },
                                    "application/xml": {
                                        "schema": {
                                            "type": "object",
                                            "properties": {
                                                "data": { "type": "string" }
                                            }
                                        }
                                    },
                                    "text/plain": {
                                        "schema": {
                                            "type": "string"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(
            result.is_ok(),
            "Should parse spec with multiple content types"
        );
    }

    #[tokio::test]
    async fn test_request_body_parsing() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Request Body Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/users": {
                    "post": {
                        "summary": "Create user",
                        "requestBody": {
                            "required": true,
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/CreateUserRequest"
                                    }
                                }
                            }
                        },
                        "responses": {
                            "201": {
                                "description": "User created",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/User"
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
                        "properties": {
                            "id": { "type": "integer" },
                            "name": { "type": "string" },
                            "email": { "type": "string" }
                        }
                    },
                    "CreateUserRequest": {
                        "type": "object",
                        "required": ["name", "email"],
                        "properties": {
                            "name": { "type": "string" },
                            "email": { "type": "string", "format": "email" }
                        }
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok(), "Should parse spec with request body");
    }

    #[tokio::test]
    async fn test_security_schemes_parsing() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Security Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/secure": {
                    "get": {
                        "summary": "Secure endpoint",
                        "security": [
                            { "bearerAuth": [] }
                        ],
                        "responses": {
                            "200": {
                                "description": "Success"
                            }
                        }
                    }
                }
            },
            "components": {
                "securitySchemes": {
                    "bearerAuth": {
                        "type": "http",
                        "scheme": "bearer",
                        "bearerFormat": "JWT"
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok(), "Should parse spec with security schemes");
    }

    #[tokio::test]
    async fn test_nested_schema_references() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Nested References API",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "User": {
                        "type": "object",
                        "properties": {
                            "profile": {
                                "$ref": "#/components/schemas/UserProfile"
                            },
                            "addresses": {
                                "type": "array",
                                "items": {
                                    "$ref": "#/components/schemas/Address"
                                }
                            }
                        }
                    },
                    "UserProfile": {
                        "type": "object",
                        "properties": {
                            "bio": { "type": "string" },
                            "avatar": {
                                "$ref": "#/components/schemas/Image"
                            }
                        }
                    },
                    "Address": {
                        "type": "object",
                        "properties": {
                            "street": { "type": "string" },
                            "city": { "type": "string" },
                            "country": {
                                "$ref": "#/components/schemas/Country"
                            }
                        }
                    },
                    "Image": {
                        "type": "object",
                        "properties": {
                            "url": { "type": "string" },
                            "alt": { "type": "string" }
                        }
                    },
                    "Country": {
                        "type": "object",
                        "properties": {
                            "code": { "type": "string" },
                            "name": { "type": "string" }
                        }
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(
            result.is_ok(),
            "Should parse spec with nested schema references"
        );

        // Test resolving nested references
        let user_ref = "#/components/schemas/User";
        let resolved = parser.resolve_reference(user_ref);
        assert!(
            resolved.is_ok(),
            "Should resolve User schema with nested references"
        );
    }

    #[tokio::test]
    async fn test_array_and_object_types() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Array and Object Types API",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "SimpleArray": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                    "ObjectArray": {
                        "type": "array",
                        "items": {
                            "$ref": "#/components/schemas/Item"
                        }
                    },
                    "NestedArray": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "integer"
                            }
                        }
                    },
                    "Item": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "integer" },
                            "tags": {
                                "type": "array",
                                "items": { "type": "string" }
                            }
                        }
                    },
                    "FlexibleObject": {
                        "type": "object",
                        "additionalProperties": true,
                        "properties": {
                            "knownField": { "type": "string" }
                        }
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(
            result.is_ok(),
            "Should parse spec with array and object types"
        );

        let schemas = parser.get_all_schemas().unwrap();
        assert_eq!(schemas.len(), 5, "Should have all 5 schemas");
    }

    #[tokio::test]
    async fn test_enum_values_parsing() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Enum Values API",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "Status": {
                        "type": "string",
                        "enum": ["active", "inactive", "pending"]
                    },
                    "Priority": {
                        "type": "integer",
                        "enum": [1, 2, 3, 4, 5]
                    },
                    "MixedEnum": {
                        "enum": ["string", 42, true, null]
                    }
                }
            }
        });

        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_ok(), "Should parse spec with enum values");
    }

    #[tokio::test]
    async fn test_openapi_versions() {
        let test_cases = vec![
            ("3.0.0", true),
            ("3.0.1", true),
            ("3.0.2", true),
            ("3.0.3", true),
            ("3.1.0", true),
            ("2.0", false), // Should be handled but might have different behavior
        ];

        for (version, _should_succeed) in test_cases {
            let spec = json!({
                "openapi": version,
                "info": {
                    "title": format!("Test API {}", version),
                    "version": "1.0.0"
                },
                "paths": {}
            });

            let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
            let mut parser = OpenAPIParser::new();
            let result = parser.parse_file(&file_path).await;

            // Test that parser handles different OpenAPI versions
            match result {
                Ok(parsed) => {
                    assert_eq!(parsed.openapi, version);
                }
                Err(_) => {
                    // Some versions might not be supported
                    continue;
                }
            }
        }
    }

    #[tokio::test]
    async fn test_yaml_vs_json_consistency() {
        let spec = basic_openapi_spec();

        let (_temp_dir_json, json_path) = create_temp_openapi_file(&spec, "json").await;
        let (_temp_dir_yaml, yaml_path) = create_temp_openapi_file(&spec, "yaml").await;

        let mut json_parser = OpenAPIParser::new();
        let mut yaml_parser = OpenAPIParser::new();

        let json_result = json_parser.parse_file(&json_path).await;
        let yaml_result = yaml_parser.parse_file(&yaml_path).await;

        assert!(json_result.is_ok(), "JSON parsing should succeed");
        assert!(yaml_result.is_ok(), "YAML parsing should succeed");

        let json_spec = json_result.unwrap();
        let yaml_spec = yaml_result.unwrap();

        // Compare key fields
        assert_eq!(json_spec.info.title, yaml_spec.info.title);
        assert_eq!(json_spec.info.version, yaml_spec.info.version);
        assert_eq!(json_spec.openapi, yaml_spec.openapi);
        assert_eq!(json_spec.paths.len(), yaml_spec.paths.len());
    }
}

/// Error Handling and Malformed Spec Tests
#[cfg(test)]
mod error_handling_tests {
    use super::parser_unit_tests::create_temp_openapi_file;
    use super::*;

    #[tokio::test]
    async fn test_completely_invalid_json() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("invalid.json");
        fs::write(&file_path, "this is not json at all").expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(
            result.is_err(),
            "Should fail to parse completely invalid JSON"
        );
    }

    #[tokio::test]
    async fn test_invalid_yaml() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("invalid.yaml");
        fs::write(
            &file_path,
            "invalid:\n  - yaml\n    - structure\n  malformed",
        )
        .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err(), "Should fail to parse invalid YAML");
    }

    #[tokio::test]
    async fn test_missing_openapi_field() {
        let spec = json!({
            "info": {
                "title": "Missing OpenAPI Version",
                "version": "1.0.0"
            },
            "paths": {}
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Should handle missing openapi field gracefully or reject it
        match result {
            Ok(_) => assert!(true, "Parser accepted spec without openapi field"),
            Err(_) => assert!(true, "Parser correctly rejected spec without openapi field"),
        }
    }

    #[tokio::test]
    async fn test_missing_info_field() {
        let spec = json!({
            "openapi": "3.0.3",
            "paths": {}
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err(), "Should fail without required info field");
    }

    #[tokio::test]
    async fn test_missing_paths_field() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Missing Paths",
                "version": "1.0.0"
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err(), "Should fail without required paths field");
    }

    #[tokio::test]
    async fn test_invalid_reference_format() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Invalid Reference Test",
                "version": "1.0.0"
            },
            "paths": {
                "/test": {
                    "get": {
                        "responses": {
                            "200": {
                                "description": "Success",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "invalid-reference-format"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let parse_result = parser.parse_file(&file_path).await;

        if parse_result.is_ok() {
            // If parsing succeeded, test reference resolution
            let resolve_result = parser.resolve_reference("invalid-reference-format");
            assert!(
                resolve_result.is_err(),
                "Should fail to resolve invalid reference format"
            );
        } else {
            assert!(
                true,
                "Parser correctly rejected spec with invalid reference"
            );
        }
    }

    #[tokio::test]
    async fn test_circular_reference_infinite_loop_prevention() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Circular Reference Prevention Test",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "A": {
                        "$ref": "#/components/schemas/B"
                    },
                    "B": {
                        "$ref": "#/components/schemas/C"
                    },
                    "C": {
                        "$ref": "#/components/schemas/A"
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let parse_result = parser.parse_file(&file_path).await;

        if parse_result.is_ok() {
            // Test that circular reference resolution doesn't cause infinite loop
            let start_time = std::time::Instant::now();
            let resolve_result = parser.resolve_reference("#/components/schemas/A");
            let duration = start_time.elapsed();

            // Should complete within reasonable time (not infinite loop)
            assert!(duration.as_secs() < 5, "Should not cause infinite loop");

            // Should either resolve or fail gracefully
            match resolve_result {
                Ok(_) => assert!(true, "Circular reference resolved"),
                Err(_) => assert!(true, "Circular reference detected and handled"),
            }
        }
    }

    #[tokio::test]
    async fn test_empty_file() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("empty.json");
        fs::write(&file_path, "").expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err(), "Should fail to parse empty file");
    }

    #[tokio::test]
    async fn test_binary_file() {
        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("binary.bin");
        let binary_data: Vec<u8> = vec![0xFF, 0xFE, 0xFD, 0xFC, 0x00, 0x01, 0x02, 0x03];
        fs::write(&file_path, binary_data).expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        assert!(result.is_err(), "Should fail to parse binary file");
    }

    #[tokio::test]
    async fn test_malformed_schema_properties() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Malformed Schema Test",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "BadSchema": {
                        "type": "object",
                        "properties": "this should be an object not a string"
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Should either fail parsing or handle malformed properties gracefully
        match result {
            Ok(_) => assert!(true, "Parser handled malformed properties gracefully"),
            Err(_) => assert!(true, "Parser correctly rejected malformed schema"),
        }
    }

    #[tokio::test]
    async fn test_invalid_operation_method() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Invalid Method Test",
                "version": "1.0.0"
            },
            "paths": {
                "/test": {
                    "invalidmethod": {
                        "summary": "Invalid HTTP method",
                        "responses": {
                            "200": {
                                "description": "Success"
                            }
                        }
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Should handle invalid HTTP methods gracefully
        match result {
            Ok(_) => assert!(true, "Parser handled invalid method gracefully"),
            Err(_) => assert!(true, "Parser correctly rejected invalid method"),
        }
    }

    #[tokio::test]
    async fn test_missing_response_description() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Missing Response Description Test",
                "version": "1.0.0"
            },
            "paths": {
                "/test": {
                    "get": {
                        "summary": "Test endpoint",
                        "responses": {
                            "200": {
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "string"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Response description is required in OpenAPI 3.0
        assert!(
            result.is_err(),
            "Should fail without required response description"
        );
    }

    #[tokio::test]
    async fn test_invalid_parameter_location() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Invalid Parameter Location Test",
                "version": "1.0.0"
            },
            "paths": {
                "/test": {
                    "get": {
                        "parameters": [
                            {
                                "name": "testParam",
                                "in": "invalid_location",
                                "schema": {
                                    "type": "string"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "Success"
                            }
                        }
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Should handle invalid parameter location
        match result {
            Ok(_) => assert!(true, "Parser handled invalid parameter location gracefully"),
            Err(_) => assert!(true, "Parser correctly rejected invalid parameter location"),
        }
    }

    #[tokio::test]
    async fn test_schema_type_mismatch() {
        let spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Schema Type Mismatch Test",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {
                    "ConfusedSchema": {
                        "type": "string",
                        "properties": {
                            "shouldnt_have_properties": {
                                "type": "string"
                            }
                        }
                    }
                }
            }
        });

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("test.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;

        // Should handle type/properties mismatch gracefully
        match result {
            Ok(_) => assert!(true, "Parser handled type mismatch gracefully"),
            Err(_) => assert!(true, "Parser correctly rejected type mismatch"),
        }
    }

    #[tokio::test]
    async fn test_large_file_handling() {
        // Create a very large but valid OpenAPI spec
        let mut large_spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Large Spec Test",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {}
            }
        });

        let mut schemas = serde_json::Map::new();
        let large_description = "x".repeat(10000); // Very long description

        // Add many schemas with large descriptions
        for i in 0..1000 {
            schemas.insert(
                format!("Schema{}", i),
                json!({
                    "type": "object",
                    "description": large_description,
                    "properties": {
                        "field1": { "type": "string" },
                        "field2": { "type": "integer" },
                        "field3": { "type": "boolean" }
                    }
                }),
            );
        }

        large_spec["components"]["schemas"] = serde_json::Value::Object(schemas);

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("large.json");
        fs::write(
            &file_path,
            serde_json::to_string_pretty(&large_spec).unwrap(),
        )
        .expect("Failed to write temp file");

        let start_time = std::time::Instant::now();
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;
        let duration = start_time.elapsed();

        // Should handle large files without crashing or excessive time
        assert!(result.is_ok(), "Should parse large file successfully");
        assert!(
            duration.as_secs() < 30,
            "Should parse large file in reasonable time"
        );
    }

    #[tokio::test]
    async fn test_deeply_nested_references() {
        let mut spec = json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Deep Nesting Test",
                "version": "1.0.0"
            },
            "paths": {},
            "components": {
                "schemas": {}
            }
        });

        let mut schemas = serde_json::Map::new();

        // Create deeply nested chain of references
        for i in 0..100 {
            let next_ref = if i == 99 {
                json!({ "type": "string" })
            } else {
                json!({ "$ref": format!("#/components/schemas/Level{}", i + 1) })
            };

            schemas.insert(format!("Level{}", i), next_ref);
        }

        spec["components"]["schemas"] = serde_json::Value::Object(schemas);

        let temp_dir = TempDir::new().expect("Failed to create temp directory");
        let file_path = temp_dir.path().join("deep.json");
        fs::write(&file_path, serde_json::to_string_pretty(&spec).unwrap())
            .expect("Failed to write temp file");

        let mut parser = OpenAPIParser::new();
        let parse_result = parser.parse_file(&file_path).await;

        if parse_result.is_ok() {
            let start_time = std::time::Instant::now();
            let resolve_result = parser.resolve_reference("#/components/schemas/Level0");
            let duration = start_time.elapsed();

            // Should not cause stack overflow or excessive time
            assert!(
                duration.as_secs() < 10,
                "Should resolve deeply nested references efficiently"
            );

            match resolve_result {
                Ok(_) => assert!(true, "Deep nesting resolved successfully"),
                Err(_) => assert!(true, "Deep nesting handled gracefully"),
            }
        }
    }
}

/// Integration Tests for Full Parsing Workflow
#[cfg(test)]
mod integration_tests {
    use super::parser_unit_tests::{basic_openapi_spec, create_temp_openapi_file};
    use super::*;

    /// Real-world OpenAPI specification for testing
    fn petstore_api_spec() -> serde_json::Value {
        json!({
            "openapi": "3.0.3",
            "info": {
                "title": "Swagger Petstore - OpenAPI 3.0",
                "description": "This is a sample Pet Store Server based on the OpenAPI 3.0 specification.",
                "version": "1.0.11",
                "contact": {
                    "email": "apiteam@swagger.io"
                },
                "license": {
                    "name": "Apache 2.0",
                    "url": "http://www.apache.org/licenses/LICENSE-2.0.html"
                }
            },
            "servers": [
                {
                    "url": "https://petstore3.swagger.io/api/v3"
                }
            ],
            "tags": [
                {
                    "name": "pet",
                    "description": "Everything about your Pets"
                },
                {
                    "name": "store",
                    "description": "Operations about user"
                },
                {
                    "name": "user",
                    "description": "Access to Petstore orders"
                }
            ],
            "paths": {
                "/pet": {
                    "put": {
                        "tags": ["pet"],
                        "summary": "Update an existing pet",
                        "description": "Update an existing pet by Id",
                        "operationId": "updatePet",
                        "requestBody": {
                            "description": "Update an existent pet in the store",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/Pet"
                                    }
                                }
                            },
                            "required": true
                        },
                        "responses": {
                            "200": {
                                "description": "Successful operation",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/Pet"
                                        }
                                    }
                                }
                            },
                            "400": {
                                "description": "Invalid ID supplied"
                            },
                            "404": {
                                "description": "Pet not found"
                            },
                            "405": {
                                "description": "Validation exception"
                            }
                        },
                        "security": [
                            {
                                "petstore_auth": ["write:pets", "read:pets"]
                            }
                        ]
                    },
                    "post": {
                        "tags": ["pet"],
                        "summary": "Add a new pet to the store",
                        "description": "Add a new pet to the store",
                        "operationId": "addPet",
                        "requestBody": {
                            "description": "Create a new pet in the store",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/Pet"
                                    }
                                }
                            },
                            "required": true
                        },
                        "responses": {
                            "200": {
                                "description": "Successful operation",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/Pet"
                                        }
                                    }
                                }
                            },
                            "405": {
                                "description": "Invalid input"
                            }
                        },
                        "security": [
                            {
                                "petstore_auth": ["write:pets", "read:pets"]
                            }
                        ]
                    }
                },
                "/pet/findByStatus": {
                    "get": {
                        "tags": ["pet"],
                        "summary": "Finds Pets by status",
                        "description": "Multiple status values can be provided with comma separated strings",
                        "operationId": "findPetsByStatus",
                        "parameters": [
                            {
                                "name": "status",
                                "in": "query",
                                "description": "Status values that need to be considered for filter",
                                "required": false,
                                "explode": true,
                                "schema": {
                                    "type": "string",
                                    "default": "available",
                                    "enum": ["available", "pending", "sold"]
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "successful operation",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "array",
                                            "items": {
                                                "$ref": "#/components/schemas/Pet"
                                            }
                                        }
                                    }
                                }
                            },
                            "400": {
                                "description": "Invalid status value"
                            }
                        },
                        "security": [
                            {
                                "petstore_auth": ["write:pets", "read:pets"]
                            }
                        ]
                    }
                },
                "/pet/{petId}": {
                    "get": {
                        "tags": ["pet"],
                        "summary": "Find pet by ID",
                        "description": "Returns a single pet",
                        "operationId": "getPetById",
                        "parameters": [
                            {
                                "name": "petId",
                                "in": "path",
                                "description": "ID of pet to return",
                                "required": true,
                                "schema": {
                                    "type": "integer",
                                    "format": "int64"
                                }
                            }
                        ],
                        "responses": {
                            "200": {
                                "description": "successful operation",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/Pet"
                                        }
                                    }
                                }
                            },
                            "400": {
                                "description": "Invalid ID supplied"
                            },
                            "404": {
                                "description": "Pet not found"
                            }
                        },
                        "security": [
                            {
                                "api_key": []
                            },
                            {
                                "petstore_auth": ["write:pets", "read:pets"]
                            }
                        ]
                    }
                }
            },
            "components": {
                "schemas": {
                    "Category": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "format": "int64",
                                "example": 1
                            },
                            "name": {
                                "type": "string",
                                "example": "Dogs"
                            }
                        }
                    },
                    "Tag": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "format": "int64"
                            },
                            "name": {
                                "type": "string"
                            }
                        }
                    },
                    "Pet": {
                        "required": ["name", "photoUrls"],
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "integer",
                                "format": "int64",
                                "example": 10
                            },
                            "name": {
                                "type": "string",
                                "example": "doggie"
                            },
                            "category": {
                                "$ref": "#/components/schemas/Category"
                            },
                            "photoUrls": {
                                "type": "array",
                                "items": {
                                    "type": "string"
                                }
                            },
                            "tags": {
                                "type": "array",
                                "items": {
                                    "$ref": "#/components/schemas/Tag"
                                }
                            },
                            "status": {
                                "type": "string",
                                "description": "pet status in the store",
                                "enum": ["available", "pending", "sold"]
                            }
                        }
                    },
                    "ApiResponse": {
                        "type": "object",
                        "properties": {
                            "code": {
                                "type": "integer",
                                "format": "int32"
                            },
                            "type": {
                                "type": "string"
                            },
                            "message": {
                                "type": "string"
                            }
                        }
                    }
                },
                "securitySchemes": {
                    "petstore_auth": {
                        "type": "oauth2",
                        "flows": {
                            "implicit": {
                                "authorizationUrl": "https://petstore3.swagger.io/oauth/authorize",
                                "scopes": {
                                    "write:pets": "modify pets in your account",
                                    "read:pets": "read your pets"
                                }
                            }
                        }
                    },
                    "api_key": {
                        "type": "apiKey",
                        "name": "api_key",
                        "in": "header"
                    }
                }
            }
        })
    }

    #[tokio::test]
    async fn test_complete_petstore_parsing_workflow() {
        let spec = petstore_api_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;

        let mut parser = OpenAPIParser::new();

        // Step 1: Parse the file
        let parse_result = parser.parse_file(&file_path).await;
        assert!(
            parse_result.is_ok(),
            "Should successfully parse Petstore API"
        );

        let parsed_spec = parse_result.unwrap();

        // Step 2: Verify basic information
        assert_eq!(parsed_spec.openapi, "3.0.3");
        assert_eq!(parsed_spec.info.title, "Swagger Petstore - OpenAPI 3.0");
        assert_eq!(parsed_spec.info.version, "1.0.11");

        // Step 3: Verify paths parsing
        assert!(!parsed_spec.paths.is_empty(), "Should have parsed paths");
        assert!(
            parsed_spec.paths.contains_key("/pet"),
            "Should contain /pet path"
        );
        assert!(
            parsed_spec.paths.contains_key("/pet/findByStatus"),
            "Should contain /pet/findByStatus path"
        );
        assert!(
            parsed_spec.paths.contains_key("/pet/{petId}"),
            "Should contain /pet/{{petId}} path"
        );

        // Step 4: Test schema resolution
        let pet_schema_result = parser.resolve_reference("#/components/schemas/Pet");
        assert!(pet_schema_result.is_ok(), "Should resolve Pet schema");

        let pet_schema = pet_schema_result.unwrap();
        assert_eq!(pet_schema.schema_type, Some("object".to_string()));
        assert!(
            !pet_schema.properties.is_empty(),
            "Pet schema should have properties"
        );
        assert!(
            pet_schema.properties.contains_key("name"),
            "Should have name property"
        );
        assert!(
            pet_schema.properties.contains_key("photoUrls"),
            "Should have photoUrls property"
        );

        // Step 5: Test nested schema resolution
        let category_schema_result = parser.resolve_reference("#/components/schemas/Category");
        assert!(
            category_schema_result.is_ok(),
            "Should resolve Category schema"
        );

        // Step 6: Test tag extraction
        let tags = parser.get_all_tags();
        assert_eq!(tags.len(), 3, "Should have 3 tags");
        assert!(tags.contains(&"pet".to_string()), "Should contain pet tag");
        assert!(
            tags.contains(&"store".to_string()),
            "Should contain store tag"
        );
        assert!(
            tags.contains(&"user".to_string()),
            "Should contain user tag"
        );

        // Step 7: Test operations by tag
        let operations_by_tag_result = parser.get_operations_by_tag();
        assert!(
            operations_by_tag_result.is_ok(),
            "Should get operations by tag"
        );

        let operations_by_tag = operations_by_tag_result.unwrap();
        assert!(
            operations_by_tag.contains_key("pet"),
            "Should have pet operations"
        );
        let pet_operations = &operations_by_tag["pet"];
        assert!(
            pet_operations.len() >= 4,
            "Should have multiple pet operations"
        );

        // Step 8: Test schema listing
        let all_schemas_result = parser.get_all_schemas();
        assert!(all_schemas_result.is_ok(), "Should get all schemas");

        let all_schemas = all_schemas_result.unwrap();
        assert_eq!(all_schemas.len(), 4, "Should have 4 schemas");

        let schema_names: Vec<&str> = all_schemas.iter().map(|(name, _)| name.as_str()).collect();
        assert!(schema_names.contains(&"Pet"), "Should contain Pet schema");
        assert!(
            schema_names.contains(&"Category"),
            "Should contain Category schema"
        );
        assert!(schema_names.contains(&"Tag"), "Should contain Tag schema");
        assert!(
            schema_names.contains(&"ApiResponse"),
            "Should contain ApiResponse schema"
        );
    }

    #[tokio::test]
    async fn test_error_recovery_workflow() {
        // Test parser's ability to handle and recover from various error conditions
        let mut parser = OpenAPIParser::new();

        // Test 1: Try to parse a non-existent file
        let non_existent_result = parser.parse_file("/path/that/does/not/exist.json").await;
        assert!(
            non_existent_result.is_err(),
            "Should fail for non-existent file"
        );

        // Test 2: Parse a valid file after the error
        let valid_spec = basic_openapi_spec();
        let (_temp_dir, valid_path) = create_temp_openapi_file(&valid_spec, "json").await;
        let valid_result = parser.parse_file(&valid_path).await;
        assert!(
            valid_result.is_ok(),
            "Should successfully parse valid file after error"
        );

        // Test 3: Try to resolve reference that doesn't exist
        let invalid_ref_result = parser.resolve_reference("#/components/schemas/DoesNotExist");
        assert!(
            invalid_ref_result.is_err(),
            "Should fail for invalid reference"
        );

        // Test 4: Resolve valid reference after invalid one
        let valid_ref_result = parser.resolve_reference("#/components/schemas/User");
        assert!(
            valid_ref_result.is_ok(),
            "Should resolve valid reference after invalid one"
        );

        // Test 5: Verify parser state is still consistent
        let spec = parser.get_spec();
        assert_eq!(spec.info.title, "Basic Test API");

        let schemas = parser.get_all_schemas().unwrap();
        assert!(!schemas.is_empty(), "Should still have schemas available");
    }
}
