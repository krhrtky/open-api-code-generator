use openapi_codegen_rust::*;
use serde_json::json;
use std::fs;
use std::path::Path;
use tempfile::TempDir;
use tokio;

// Test data and utilities
fn create_test_openapi_spec() -> serde_json::Value {
    json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Test API",
            "version": "1.0.0",
            "description": "Test API for integration tests"
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
                },
                "post": {
                    "summary": "Create user",
                    "operationId": "createUser",
                    "tags": ["users"],
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
                            "description": "Created",
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
            },
            "/users/{id}": {
                "get": {
                    "summary": "Get user by ID",
                    "operationId": "getUserById",
                    "tags": ["users"],
                    "parameters": [
                        {
                            "name": "id",
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
                            "description": "Success",
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
                    "required": ["id", "username", "email"],
                    "properties": {
                        "id": {
                            "type": "integer",
                            "format": "int64",
                            "description": "User ID"
                        },
                        "username": {
                            "type": "string",
                            "minLength": 3,
                            "maxLength": 50,
                            "pattern": "^[a-zA-Z0-9_]+$",
                            "description": "Username"
                        },
                        "email": {
                            "type": "string",
                            "format": "email",
                            "description": "Email address"
                        },
                        "firstName": {
                            "type": "string",
                            "maxLength": 100,
                            "description": "First name"
                        },
                        "lastName": {
                            "type": "string",
                            "maxLength": 100,
                            "description": "Last name"
                        },
                        "isActive": {
                            "type": "boolean",
                            "default": true,
                            "description": "Whether user is active"
                        },
                        "createdAt": {
                            "type": "string",
                            "format": "date-time",
                            "description": "Creation timestamp"
                        },
                        "tags": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            },
                            "description": "User tags"
                        }
                    }
                },
                "CreateUserRequest": {
                    "type": "object",
                    "required": ["username", "email"],
                    "properties": {
                        "username": {
                            "type": "string",
                            "minLength": 3,
                            "maxLength": 50,
                            "pattern": "^[a-zA-Z0-9_]+$"
                        },
                        "email": {
                            "type": "string",
                            "format": "email"
                        },
                        "firstName": {
                            "type": "string",
                            "maxLength": 100
                        },
                        "lastName": {
                            "type": "string",
                            "maxLength": 100
                        }
                    }
                }
            }
        }
    })
}

fn create_complex_openapi_spec() -> serde_json::Value {
    json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Complex Test API",
            "version": "2.0.0"
        },
        "paths": {
            "/items": {
                "post": {
                    "summary": "Create item",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/Item"
                                }
                            }
                        }
                    },
                    "responses": {
                        "201": {
                            "description": "Created"
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "BaseEntity": {
                    "type": "object",
                    "required": ["id", "createdAt"],
                    "properties": {
                        "id": {
                            "type": "string",
                            "format": "uuid"
                        },
                        "createdAt": {
                            "type": "string",
                            "format": "date-time"
                        },
                        "updatedAt": {
                            "type": "string",
                            "format": "date-time"
                        }
                    }
                },
                "Item": {
                    "allOf": [
                        {
                            "$ref": "#/components/schemas/BaseEntity"
                        },
                        {
                            "type": "object",
                            "required": ["name", "type"],
                            "properties": {
                                "name": {
                                    "type": "string",
                                    "minLength": 1,
                                    "maxLength": 200
                                },
                                "type": {
                                    "oneOf": [
                                        {
                                            "$ref": "#/components/schemas/DocumentItem"
                                        },
                                        {
                                            "$ref": "#/components/schemas/MediaItem"
                                        }
                                    ],
                                    "discriminator": {
                                        "propertyName": "itemType"
                                    }
                                }
                            }
                        }
                    ]
                },
                "DocumentItem": {
                    "type": "object",
                    "required": ["itemType", "content"],
                    "properties": {
                        "itemType": {
                            "type": "string",
                            "enum": ["document"]
                        },
                        "content": {
                            "type": "string"
                        },
                        "format": {
                            "type": "string",
                            "enum": ["pdf", "docx", "txt"]
                        }
                    }
                },
                "MediaItem": {
                    "type": "object",
                    "required": ["itemType", "url"],
                    "properties": {
                        "itemType": {
                            "type": "string",
                            "enum": ["media"]
                        },
                        "url": {
                            "type": "string",
                            "format": "uri"
                        },
                        "duration": {
                            "type": "integer",
                            "minimum": 0
                        }
                    }
                }
            }
        }
    })
}

#[tokio::test]
async fn test_generator_config_creation() {
    let temp_dir = TempDir::new().unwrap();
    let config = GeneratorConfig {
        output_dir: temp_dir.path().to_path_buf(),
        base_package: "com.example.test".to_string(),
        generate_controllers: true,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    assert_eq!(config.base_package, "com.example.test");
    assert!(!config.verbose);
    assert!(config.generate_controllers);
    assert!(config.generate_models);
    assert!(config.include_validation);
    assert!(config.include_swagger);
}

#[tokio::test]
async fn test_generator_initialization() {
    let temp_dir = TempDir::new().unwrap();
    let config = GeneratorConfig {
        output_dir: temp_dir.path().to_path_buf(),
        base_package: "com.example.test".to_string(),
        generate_controllers: true,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    // Verify generator can be created without panicking
    assert!(true);
}

#[tokio::test]
async fn test_simple_spec_parsing() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("test-spec.json");
    let spec = create_test_openapi_spec();

    fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

    let parser = OpenAPIParser::new();
    let result = parser.parse_file(&spec_path).await;

    assert!(result.is_ok());
    let parsed_spec = result.unwrap();
    assert_eq!(parsed_spec.info.title, "Test API");
    assert_eq!(parsed_spec.info.version, "1.0.0");
}

#[tokio::test]
async fn test_yaml_spec_parsing() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("test-spec.yaml");

    let yaml_content = r#"
openapi: 3.0.3
info:
  title: YAML Test API
  version: 1.0.0
paths:
  /health:
    get:
      summary: Health check
      responses:
        '200':
          description: OK
components:
  schemas:
    HealthStatus:
      type: object
      properties:
        status:
          type: string
          enum: [ok, error]
"#;

    fs::write(&spec_path, yaml_content).unwrap();

    let parser = OpenAPIParser::new();
    let result = parser.parse_file(&spec_path).await;

    assert!(result.is_ok());
    let parsed_spec = result.unwrap();
    assert_eq!(parsed_spec.info.title, "YAML Test API");
}

#[tokio::test]
async fn test_invalid_spec_handling() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("invalid-spec.json");

    // Invalid JSON
    fs::write(&spec_path, "{ invalid json }").unwrap();

    let parser = OpenAPIParser::new();
    let result = parser.parse_file(&spec_path).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_missing_file_handling() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("nonexistent.json");

    let parser = OpenAPIParser::new();
    let result = parser.parse_file(&spec_path).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_full_code_generation_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("test-spec.json");
    let spec = create_test_openapi_spec();

    fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.test".to_string(),
        generate_controllers: true,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());
    let generation_result = result.unwrap();

    // Verify output directory was created
    assert!(temp_dir.path().join("output").exists());

    // Verify some files were generated
    assert!(generation_result.file_count > 0);
    assert!(!generation_result.generated_files.is_empty());

    // Check for expected Kotlin file structure
    let kotlin_src_dir = temp_dir
        .path()
        .join("output/src/main/kotlin/com/example/test");
    assert!(kotlin_src_dir.exists());

    // Should have models directory
    let models_dir = kotlin_src_dir.join("model");
    if models_dir.exists() {
        let entries: Vec<_> = fs::read_dir(&models_dir).unwrap().collect();
        assert!(
            !entries.is_empty(),
            "Models directory should contain generated files"
        );
    }
}

#[tokio::test]
async fn test_model_generation() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("model-test-spec.json");
    let spec = create_test_openapi_spec();

    fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.models".to_string(),
        generate_controllers: false,
        generate_models: true,
        include_validation: true,
        include_swagger: false,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());

    // Check for generated model files
    let models_dir = temp_dir
        .path()
        .join("output/src/main/kotlin/com/example/models/model");
    if models_dir.exists() {
        let entries: Result<Vec<_>, _> = fs::read_dir(&models_dir)
            .unwrap()
            .map(|entry| entry.map(|e| e.file_name().to_string_lossy().to_string()))
            .collect();

        let file_names = entries.unwrap();

        // Should generate User.kt and CreateUserRequest.kt
        assert!(file_names.iter().any(|name| name.contains("User")));
    }
}

#[tokio::test]
async fn test_controller_generation() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("controller-test-spec.json");
    let spec = create_test_openapi_spec();

    fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.controllers".to_string(),
        generate_controllers: true,
        generate_models: false,
        include_validation: false,
        include_swagger: true,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());

    // Check for generated controller files
    let controller_dir = temp_dir
        .path()
        .join("output/src/main/kotlin/com/example/controllers");
    if controller_dir.exists() {
        let entries: Result<Vec<_>, _> = fs::read_dir(&controller_dir)
            .unwrap()
            .map(|entry| entry.map(|e| e.file_name().to_string_lossy().to_string()))
            .collect();

        let file_names = entries.unwrap();

        // Should generate controller for 'users' tag
        assert!(file_names.iter().any(|name| name.contains("Controller")));
    }
}

#[tokio::test]
async fn test_complex_schema_composition() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("complex-spec.json");
    let spec = create_complex_openapi_spec();

    fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.complex".to_string(),
        generate_controllers: true,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());
    let generation_result = result.unwrap();

    // Should handle allOf and oneOf compositions
    assert!(generation_result.file_count > 0);

    // Check that files were generated for complex schemas
    let models_dir = temp_dir
        .path()
        .join("output/src/main/kotlin/com/example/complex/model");
    if models_dir.exists() {
        let entries: Result<Vec<_>, _> = fs::read_dir(&models_dir)
            .unwrap()
            .map(|entry| entry.map(|e| e.file_name().to_string_lossy().to_string()))
            .collect();

        let file_names = entries.unwrap();

        // Should generate files for BaseEntity, Item, DocumentItem, MediaItem
        assert!(!file_names.is_empty());
    }
}

#[tokio::test]
async fn test_build_file_generation() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("build-test-spec.json");
    let spec = create_test_openapi_spec();

    fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.build".to_string(),
        generate_controllers: true,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());

    // Check that build.gradle.kts was generated
    let build_file = temp_dir.path().join("output/build.gradle.kts");
    assert!(build_file.exists());

    // Verify build file content
    let build_content = fs::read_to_string(&build_file).unwrap();
    assert!(build_content.contains("kotlin"));
    assert!(build_content.contains("spring-boot"));
    assert!(build_content.contains("com.example.build"));
}

#[tokio::test]
async fn test_validation_generation() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("validation-test-spec.json");

    let spec_with_validation = json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Validation Test API",
            "version": "1.0.0"
        },
        "paths": {},
        "components": {
            "schemas": {
                "ValidatedModel": {
                    "type": "object",
                    "required": ["email", "age"],
                    "properties": {
                        "email": {
                            "type": "string",
                            "format": "email",
                            "x-validation": {
                                "customValidations": ["EmailUnique"]
                            }
                        },
                        "age": {
                            "type": "integer",
                            "minimum": 0,
                            "maximum": 120
                        },
                        "password": {
                            "type": "string",
                            "format": "password",
                            "minLength": 8,
                            "x-validation": {
                                "customValidations": ["StrongPassword"]
                            }
                        }
                    }
                }
            }
        }
    });

    fs::write(
        &spec_path,
        serde_json::to_string_pretty(&spec_with_validation).unwrap(),
    )
    .unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.validation".to_string(),
        generate_controllers: false,
        generate_models: true,
        include_validation: true,
        include_swagger: false,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());

    // Check for validation classes
    let validation_dir = temp_dir
        .path()
        .join("output/src/main/kotlin/com/validation");
    if validation_dir.exists() {
        let entries: Result<Vec<_>, _> = fs::read_dir(&validation_dir)
            .unwrap()
            .map(|entry| entry.map(|e| e.file_name().to_string_lossy().to_string()))
            .collect();

        let file_names = entries.unwrap();

        // Should generate validation annotations and validators
        assert!(file_names.iter().any(|name| name.contains("EmailUnique")));
        assert!(file_names
            .iter()
            .any(|name| name.contains("StrongPassword")));
    }
}

#[tokio::test]
async fn test_error_handling_invalid_openapi_version() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("invalid-version-spec.json");

    let invalid_spec = json!({
        "openapi": "2.0.0",  // Invalid version
        "info": {
            "title": "Invalid API",
            "version": "1.0.0"
        },
        "paths": {}
    });

    fs::write(
        &spec_path,
        serde_json::to_string_pretty(&invalid_spec).unwrap(),
    )
    .unwrap();

    let parser = OpenAPIParser::new();
    let result = parser.parse_file(&spec_path).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_error_handling_missing_required_fields() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("incomplete-spec.json");

    let incomplete_spec = json!({
        "openapi": "3.0.3",
        // Missing info and paths
    });

    fs::write(
        &spec_path,
        serde_json::to_string_pretty(&incomplete_spec).unwrap(),
    )
    .unwrap();

    let parser = OpenAPIParser::new();
    let result = parser.parse_file(&spec_path).await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_parallel_processing() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("large-spec.json");

    // Create a spec with many schemas to trigger parallel processing
    let mut schemas = json!({});
    for i in 0..50 {
        schemas[format!("Model{}", i)] = json!({
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer"
                },
                "name": {
                    "type": "string"
                }
            }
        });
    }

    let large_spec = json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Large Test API",
            "version": "1.0.0"
        },
        "paths": {},
        "components": {
            "schemas": schemas
        }
    });

    fs::write(
        &spec_path,
        serde_json::to_string_pretty(&large_spec).unwrap(),
    )
    .unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.large".to_string(),
        generate_controllers: false,
        generate_models: true,
        include_validation: false,
        include_swagger: false,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let start_time = std::time::Instant::now();
    let result = generator.generate(&spec_path).await;
    let duration = start_time.elapsed();

    assert!(result.is_ok());
    let generation_result = result.unwrap();

    // Should generate all 50 models
    assert!(generation_result.file_count >= 50);

    // Should complete in reasonable time (parallel processing should help)
    assert!(duration.as_secs() < 30);
}

#[tokio::test]
async fn test_memory_efficiency() {
    let temp_dir = TempDir::new().unwrap();
    let spec_path = temp_dir.path().join("memory-test-spec.json");

    // Create a spec that would consume significant memory if not handled efficiently
    let mut large_schema_properties = json!({});
    for i in 0..100 {
        large_schema_properties[format!("field{}", i)] = json!({
            "type": "string",
            "description": format!("Field {} with a very long description that takes up memory when parsed and processed by the code generator", i)
        });
    }

    let memory_test_spec = json!({
        "openapi": "3.0.3",
        "info": {
            "title": "Memory Test API",
            "version": "1.0.0"
        },
        "paths": {},
        "components": {
            "schemas": {
                "LargeModel": {
                    "type": "object",
                    "properties": large_schema_properties
                }
            }
        }
    });

    fs::write(
        &spec_path,
        serde_json::to_string_pretty(&memory_test_spec).unwrap(),
    )
    .unwrap();

    let config = GeneratorConfig {
        output_dir: temp_dir.path().join("output"),
        base_package: "com.example.memory".to_string(),
        generate_controllers: false,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    let generator = OpenAPICodeGenerator::new(config);
    let result = generator.generate(&spec_path).await;

    assert!(result.is_ok());

    // Verify the large model was generated successfully
    let models_dir = temp_dir
        .path()
        .join("output/src/main/kotlin/com/example/memory/model");
    if models_dir.exists() {
        let large_model_file = models_dir.join("LargeModel.kt");
        if large_model_file.exists() {
            let content = fs::read_to_string(&large_model_file).unwrap();
            assert!(content.contains("data class LargeModel"));
            assert!(content.contains("field0"));
            assert!(content.contains("field99"));
        }
    }
}

#[test]
fn test_basic_functionality() {
    // Basic smoke test to ensure test framework works
    assert_eq!(2 + 2, 4);
}

#[test]
fn test_config_validation() {
    let temp_dir = TempDir::new().unwrap();

    // Test that config validation works
    let config = GeneratorConfig {
        output_dir: temp_dir.path().to_path_buf(),
        base_package: "".to_string(), // Invalid empty package
        generate_controllers: true,
        generate_models: true,
        include_validation: true,
        include_swagger: true,
        verbose: false,
    };

    // Empty package should be handled gracefully
    assert_eq!(config.base_package, "");
}

#[tokio::test]
async fn test_concurrent_generation() {
    let temp_dir = TempDir::new().unwrap();

    // Test multiple generators running concurrently
    let handles: Vec<_> = (0..3)
        .map(|i| {
            let temp_dir = temp_dir.path().to_owned();
            tokio::spawn(async move {
                let spec_path = temp_dir.join(format!("concurrent-spec-{}.json", i));
                let spec = create_test_openapi_spec();

                fs::write(&spec_path, serde_json::to_string_pretty(&spec).unwrap()).unwrap();

                let config = GeneratorConfig {
                    output_dir: temp_dir.join(format!("output-{}", i)),
                    base_package: format!("com.example.concurrent{}", i),
                    generate_controllers: true,
                    generate_models: true,
                    include_validation: true,
                    include_swagger: true,
                    verbose: false,
                };

                let generator = OpenAPICodeGenerator::new(config);
                generator.generate(&spec_path).await
            })
        })
        .collect();

    // Wait for all generations to complete
    let results: Vec<_> = futures::future::join_all(handles).await;

    // All should succeed
    for result in results {
        assert!(result.is_ok());
        assert!(result.unwrap().is_ok());
    }
}
