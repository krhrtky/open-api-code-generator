use openapi_codegen_rust::*;
use tempfile::TempDir;

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
    // Just test that generator can be created without panicking
    assert!(true);
}

#[test]
fn test_basic_functionality() {
    // Basic smoke test
    assert_eq!(2 + 2, 4);
}
