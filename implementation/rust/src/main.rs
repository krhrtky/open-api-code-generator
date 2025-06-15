use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;
use std::time::Instant;

mod types;
mod parser;
mod generator;
mod templates;
mod errors;

use crate::generator::OpenAPICodeGenerator;
use crate::types::GeneratorConfig;

#[derive(Parser)]
#[command(name = "openapi-codegen")]
#[command(about = "OpenAPI Code Generator - Rust Implementation with ultra-fast performance")]
#[command(version = "1.0.0")]
struct Cli {
    /// OpenAPI specification file path
    #[arg(short = 'i', long = "input")]
    input: PathBuf,

    /// Output directory
    #[arg(short = 'o', long = "output", default_value = "./generated")]
    output: PathBuf,

    /// Base package name
    #[arg(short = 'p', long = "package", default_value = "com.example.api")]
    package: String,

    /// Generate controllers
    #[arg(long = "controllers", default_value = "true")]
    controllers: bool,

    /// Disable controller generation
    #[arg(long = "no-controllers", action = clap::ArgAction::SetTrue)]
    no_controllers: bool,

    /// Generate models
    #[arg(long = "models", default_value = "true")]
    models: bool,

    /// Disable model generation
    #[arg(long = "no-models", action = clap::ArgAction::SetTrue)]
    no_models: bool,

    /// Generate validation annotations
    #[arg(long = "validation", default_value = "true")]
    validation: bool,

    /// Disable validation annotations
    #[arg(long = "no-validation", action = clap::ArgAction::SetTrue)]
    no_validation: bool,

    /// Generate Swagger annotations
    #[arg(long = "swagger", default_value = "true")]
    swagger: bool,

    /// Disable Swagger annotations
    #[arg(long = "no-swagger", action = clap::ArgAction::SetTrue)]
    no_swagger: bool,

    /// Verbose output
    #[arg(short = 'v', long = "verbose")]
    verbose: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    let start_time = Instant::now();
    let cli = Cli::parse();

    // Validate input file
    if !cli.input.exists() {
        anyhow::bail!("❌ Error: File not found: {}", cli.input.display());
    }

    // Check file format
    let extension = cli.input.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("");
    
    if !["yaml", "yml", "json"].contains(&extension) {
        anyhow::bail!("❌ Error: Unsupported file format: .{} (use .yaml, .yml, or .json)", extension);
    }

    // Create generator configuration
    let config = GeneratorConfig {
        output_dir: cli.output.clone(),
        base_package: cli.package.clone(),
        generate_controllers: cli.controllers && !cli.no_controllers,
        generate_models: cli.models && !cli.no_models,
        include_validation: cli.validation && !cli.no_validation,
        include_swagger: cli.swagger && !cli.no_swagger,
        verbose: cli.verbose,
    };

    if cli.verbose {
        println!("Parsing OpenAPI specification from: {}", cli.input.display());
    }

    // Initialize generator
    let mut generator = OpenAPICodeGenerator::new(config);
    
    // Generate code
    let result = generator.generate(&cli.input).await?;

    let elapsed = start_time.elapsed();

    // Success message
    println!("✅ Code generation completed successfully!");
    println!("📁 Output directory: {}", result.output_dir.display());
    println!("📄 Generated {} files", result.file_count);
    
    if cli.verbose {
        println!("⚡ Generation time: {:.2}ms", elapsed.as_secs_f64() * 1000.0);
    } else {
        println!("💡 Use --verbose flag for detailed output");
    }

    Ok(())
}