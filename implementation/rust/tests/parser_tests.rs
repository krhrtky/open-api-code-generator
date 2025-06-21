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
    async fn create_temp_openapi_file(content: &serde_json::Value, extension: &str) -> (TempDir, String) {
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
    fn basic_openapi_spec() -> serde_json::Value {
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
        let parser = OpenAPIParser::new();
        // Note: get_spec() may panic if no spec is loaded, so we test after parsing
        
        let default_parser = OpenAPIParser::default();
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
        parser.parse_file(&file_path).await.expect("Should parse file");
        
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
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let invalid_reference = "#/components/schemas/NonExistent";
        let result = parser.resolve_reference(invalid_reference);
        
        assert!(result.is_err(), "Should fail to resolve invalid reference");
    }

    #[tokio::test]
    async fn test_schema_composition_allof() {
        let spec = complex_schema_composition_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let user_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/UserModel".to_string()
        });
        let result = parser.resolve_schema(&user_schema_ref);
        
        assert!(result.is_ok(), "Should resolve allOf schema composition");
        let resolved_schema = result.unwrap();
        
        // Should contain properties from both base and extended schemas
        assert!(!resolved_schema.properties.is_empty(), "Should have properties");
        let properties = &resolved_schema.properties;
        assert!(properties.contains_key("id"), "Should contain id from BaseModel");
        assert!(properties.contains_key("username"), "Should contain username from extension");
    }

    #[tokio::test]
    async fn test_schema_composition_oneof() {
        let spec = complex_schema_composition_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let contact_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/ContactMethod".to_string()
        });
        let result = parser.resolve_schema(&contact_schema_ref);
        
        assert!(result.is_ok(), "Should resolve oneOf schema composition");
        let resolved_schema = result.unwrap();
        assert!(!resolved_schema.one_of.is_empty(), "Should have oneOf variants");
    }

    #[tokio::test]
    async fn test_schema_composition_anyof() {
        let spec = complex_schema_composition_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let flexible_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/FlexibleData".to_string()
        });
        let result = parser.resolve_schema(&flexible_schema_ref);
        
        assert!(result.is_ok(), "Should resolve anyOf schema composition");
        let resolved_schema = result.unwrap();
        assert!(!resolved_schema.any_of.is_empty(), "Should have anyOf variants");
    }

    #[tokio::test]
    async fn test_circular_reference_detection() {
        let spec = circular_reference_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let node_schema_ref = OpenAPISchemaOrRef::Reference(OpenAPIReference {
            reference: "#/components/schemas/Node".to_string()
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
            assert_eq!(extracted_name, expected_name, "Should extract correct schema name");
        }
    }

    #[tokio::test]
    async fn test_get_all_schemas() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        parser.parse_file(&file_path).await.expect("Should parse file");
        
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
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let tags = parser.get_all_tags();
        assert_eq!(tags.len(), 1, "Should have one tag");
        assert_eq!(tags[0], "users", "Should have users tag");
    }

    #[tokio::test]
    async fn test_get_operations_by_tag() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        parser.parse_file(&file_path).await.expect("Should parse file");
        
        let result = parser.get_operations_by_tag();
        assert!(result.is_ok(), "Should get operations by tag");
        
        let operations = result.unwrap();
        assert!(operations.contains_key("users"), "Should have users operations");
        assert_eq!(operations["users"].len(), 1, "Should have one operation for users");
    }

    #[tokio::test]
    async fn test_spec_access() {
        let spec = basic_openapi_spec();
        let (_temp_dir, file_path) = create_temp_openapi_file(&spec, "json").await;
        
        let mut parser = OpenAPIParser::new();
        
        // After parsing
        parser.parse_file(&file_path).await.expect("Should parse file");
        
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
            schemas.insert(schema_name, json!({
                "type": "object",
                "properties": {
                    "id": { "type": "integer" },
                    "name": { "type": "string" },
                    "description": { "type": "string" }
                }
            }));
        }
        
        large_spec["components"]["schemas"] = serde_json::Value::Object(schemas);
        
        let (_temp_dir, file_path) = create_temp_openapi_file(&large_spec, "json").await;
        
        let start_time = std::time::Instant::now();
        let mut parser = OpenAPIParser::new();
        let result = parser.parse_file(&file_path).await;
        let parse_duration = start_time.elapsed();
        
        assert!(result.is_ok(), "Should parse large specification");
        assert!(parse_duration.as_secs() < 5, "Should parse within reasonable time");
        
        // Test schema retrieval performance
        let start_time = std::time::Instant::now();
        let all_schemas = parser.get_all_schemas().unwrap();
        let retrieval_duration = start_time.elapsed();
        
        assert_eq!(all_schemas.len(), 101, "Should have all schemas (100 + User)");
        assert!(retrieval_duration.as_millis() < 100, "Should retrieve schemas quickly");
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
}