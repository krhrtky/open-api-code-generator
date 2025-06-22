#!/bin/bash

# Local CI verification script for Rust implementation
# This script replicates the GitHub Actions rust-tests workflow

set -e

echo "🔍 Running local CI verification for Rust implementation..."
echo "=================================================="

# Check if we're in the correct directory
if [ ! -f "Cargo.toml" ]; then
    echo "❌ Error: Please run this script from the rust implementation directory"
    exit 1
fi

echo "📦 Checking Rust toolchain..."
rustc --version
cargo --version

echo ""
echo "🔧 Installing required components..."
rustup component add rustfmt clippy 2>/dev/null || echo "Components already installed"

echo ""
echo "✨ Step 1: Checking code formatting..."
cargo fmt -- --check
if [ $? -eq 0 ]; then
    echo "✅ Code formatting is correct"
else
    echo "❌ Code formatting issues found. Run 'cargo fmt' to fix."
    exit 1
fi

echo ""
echo "🔍 Step 2: Running clippy lints..."
cargo clippy -- -D warnings
if [ $? -eq 0 ]; then
    echo "✅ Clippy checks passed"
else
    echo "❌ Clippy found issues"
    exit 1
fi

echo ""
echo "🧪 Step 3: Running tests (verbose)..."
cargo test --verbose --jobs=2
if [ $? -eq 0 ]; then
    echo "✅ All tests passed"
else
    echo "❌ Some tests failed"
    exit 1
fi

echo ""
echo "🏗️  Step 4: Building release..."
cargo build --release
if [ $? -eq 0 ]; then
    echo "✅ Release build successful"
else
    echo "❌ Release build failed"
    exit 1
fi

echo ""
echo "🎉 All CI checks passed! Your code is ready for push."
echo "=================================================="