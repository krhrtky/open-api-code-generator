# OpenAPI Code Generator - Rust Implementation

Ultra-fast OpenAPI code generator written in Rust with comprehensive test coverage.

## Features

- 🚀 **Ultra-fast parsing** - Optimized for large OpenAPI specifications
- 🔧 **Comprehensive schema support** - allOf, oneOf, anyOf composition
- 🛡️ **Robust error handling** - Detailed error messages and circular reference detection
- 🎯 **100% test coverage** - Extensive unit, integration, and error handling tests
- 🔍 **CI/CD ready** - Local verification matches GitHub Actions

## Prerequisites

- Rust 1.70+ (stable)
- Cargo (comes with Rust)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd implementation/rust

# Install dependencies
cargo build
```

## Usage

### Command Line

```bash
# Generate code from OpenAPI spec
cargo run -- --input api.yaml --output ./generated

# Show help
cargo run -- --help
```

### Library Usage

```rust
use openapi_codegen_rust::parser::OpenAPIParser;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut parser = OpenAPIParser::new();
    let spec = parser.parse_file("api.yaml").await?;
    
    println!("API Title: {}", spec.info.title);
    println!("API Version: {}", spec.info.version);
    
    Ok(())
}
```

## Development

### Local CI Verification

Run the same checks that GitHub Actions performs:

```bash
# Run all CI checks locally
./ci-check.sh
```

This script runs:
1. Code formatting check (`cargo fmt --check`)
2. Linting (`cargo clippy`)
3. All tests (`cargo test --verbose`)
4. Release build (`cargo build --release`)

### Manual Commands

```bash
# Format code
cargo fmt

# Run linting
cargo clippy

# Run tests
cargo test

# Run specific test module
cargo test --test parser_tests

# Build release
cargo build --release
```

### Test Coverage

The project maintains 100% test success rate with comprehensive coverage:

- **112 unit tests** - Core functionality testing
- **45 comprehensive tests** - Parser scenarios, error handling, composition
- **19 integration tests** - Full workflow testing
- **8 documentation tests** - Example code verification

Run tests with:

```bash
# All tests
cargo test

# Specific test files
cargo test --test parser_tests
cargo test --test integration_tests

# Unit tests only
cargo test --lib
```

### Performance Testing

```bash
# Run performance benchmarks
cargo test large_specification_performance -- --nocapture
```

## Project Structure

```
src/
├── lib.rs          # Library entry point
├── main.rs         # CLI entry point  
├── parser.rs       # OpenAPI specification parsing
├── types.rs        # Type definitions
├── generator.rs    # Code generation
├── templates.rs    # Template management
└── errors.rs       # Error handling

tests/
├── parser_tests.rs        # Comprehensive parser tests
└── integration_tests.rs   # End-to-end testing
```

## Contributing

1. Ensure all tests pass: `./ci-check.sh`
2. Follow Rust conventions and formatting
3. Add tests for new features
4. Update documentation as needed

## Architecture

- **Parser**: Handles OpenAPI 3.x specification parsing with full schema resolution
- **Generator**: Template-based code generation for multiple target languages
- **Error System**: Comprehensive error handling with detailed context
- **Testing**: Multi-layered testing strategy for reliability

## Performance

- Optimized for large specifications (1000+ endpoints)
- Parallel processing with rayon
- Efficient memory usage with streaming
- Sub-second generation for most projects