Rust OpenAPI Code Generator development environment for implementing comprehensive generator tests for Issue #27. 

This environment contains:
- Full Rust development toolchain (rustc, cargo, clippy, fmt)
- Git for version control 
- All project dependencies from Cargo.toml
- Ready to run tests with `cargo test` and check formatting with `cargo fmt`
- Working directory is /workdir with the complete codebase
- Currently working on Issue #27 to implement generator module tests

The goal is to achieve 85%+ test coverage for src/generator.rs by implementing comprehensive tests for all public functions including:
- Kotlin class generation
- Controller generation  
- Validation annotations
- Package structure
- Type mapping and conversion
- Complex schema patterns (oneOf, anyOf, polymorphic types)
- Code formatting and syntax validation