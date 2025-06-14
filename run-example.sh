#!/bin/bash

# OpenAPI Code Generator - 実行例スクリプト

set -e

echo "🚀 OpenAPI Code Generator - 実行例"
echo "=================================="

# プロジェクトディレクトリの確認
if [ ! -f "build.gradle.kts" ]; then
    echo "❌ build.gradle.kts が見つかりません。プロジェクトルートで実行してください。"
    exit 1
fi

# サンプルファイルの確認
if [ ! -f "examples/sample-api.yaml" ]; then
    echo "❌ examples/sample-api.yaml が見つかりません。"
    exit 1
fi

echo "📁 入力ファイル: examples/sample-api.yaml"
echo "📁 出力ディレクトリ: ./generated"
echo ""

# 出力ディレクトリのクリーンアップ
if [ -d "generated" ]; then
    echo "🧹 既存の出力ディレクトリをクリーンアップ..."
    rm -rf generated
fi

echo "🔧 複数言語実装から最適なものを選択してコード生成..."
echo ""

# 利用可能な実装を確認
echo "🔍 利用可能な実装を確認中..."

CHOSEN_IMPL=""
IMPL_NAME=""

# Rustを最優先（最高性能）
if command -v cargo &> /dev/null; then
    CHOSEN_IMPL="rust"
    IMPL_NAME="Rust（最高性能）"
# 次にGo（高速CLI）
elif command -v go &> /dev/null; then
    CHOSEN_IMPL="go"
    IMPL_NAME="Go（高速CLI）"
# 次にNode.js/TypeScript
elif command -v node &> /dev/null && command -v npm &> /dev/null; then
    CHOSEN_IMPL="typescript"
    IMPL_NAME="TypeScript（エコシステム活用）"
# 最後にKotlin
elif [ -f "implementations/kotlin/gradlew" ]; then
    CHOSEN_IMPL="kotlin"
    IMPL_NAME="Kotlin（Spring Boot統合）"
fi

if [ -n "$CHOSEN_IMPL" ]; then
    echo "✅ $IMPL_NAME 実装を使用します"
    echo ""
    
    case $CHOSEN_IMPL in
        "rust")
            echo "📦 Rustプロジェクトをビルド..."
            cd implementations/rust
            cargo build --release --quiet
            echo "🎯 コード生成を実行..."
            ./target/release/openapi-codegen \
                --input ../../examples/sample-api.yaml \
                --output ../../generated_rust \
                --package com.example.userapi \
                --verbose
            cd ../..
            ;;
        "go")
            echo "📦 Goプロジェクトをビルド..."
            cd implementations/go
            go build -o openapi-codegen main.go
            echo "🎯 コード生成を実行..."
            ./openapi-codegen \
                -input ../../examples/sample-api.yaml \
                -output ../../generated_go \
                -package com.example.userapi \
                -verbose
            cd ../..
            ;;
        "typescript")
            echo "📦 TypeScriptプロジェクトをビルド..."
            cd implementations/typescript
            npm install --silent
            npm run build --silent
            echo "🎯 コード生成を実行..."
            node dist/index.js \
                --input ../../examples/sample-api.yaml \
                --output ../../generated_typescript \
                --package com.example.userapi \
                --verbose
            cd ../..
            ;;
        "kotlin")
            echo "📦 Kotlinプロジェクトをビルド..."
            cd implementations/kotlin
            ./gradlew build --quiet
            echo "🎯 コード生成を実行..."
            ./gradlew run --args="--input ../../examples/sample-api.yaml --output ../../generated_kotlin --package com.example.userapi --verbose"
            cd ../..
            ;;
    esac
else
    echo "⚠️  利用可能な実装が見つかりません。"
    echo "    手動でコード生成の流れを説明します："
    echo ""
    echo "1. OpenAPI仕様を解析:"
    head -20 examples/sample-api.yaml
    echo ""
    echo "2. 生成される内容："
    echo "   - Controller インターフェース (UserController.kt, ProfileController.kt)"
    echo "   - データモデル (User.kt, CreateUserRequest.kt, UserProfile.kt, etc.)"
    echo "   - build.gradle.kts (Spring Boot設定付き)"
    echo ""
    echo "3. 生成されるControllerの例:"
    cat << 'EOF'

interface UserController {
    @Operation(summary = "Get all users")
    @GetMapping("/users")
    fun getUsers(
        @RequestParam(required = false) page: Int?,
        @RequestParam(required = false) size: Int?,
        @RequestParam(required = false) filter: String?
    ): ResponseEntity<Any>

    @PostMapping("/users")
    fun createUser(@Valid @RequestBody body: CreateUserRequest): ResponseEntity<User>
}

EOF
    echo "4. 生成されるModelの例:"
    cat << 'EOF'

@Schema(description = "User entity representing a registered user")
data class User(
    @Schema(description = "Unique identifier for the user")
    @NotNull
    val id: Long,
    
    @Schema(description = "User's email address")
    @NotNull
    @Email
    val email: String,
    
    @NotNull
    @Size(min = 1, max = 50)
    val firstName: String,
    
    @NotNull
    @Size(min = 1, max = 50)
    val lastName: String
)

EOF
fi

echo ""
echo "✅ 実行完了!"

if [ -d "generated" ]; then
    echo ""
    echo "📄 生成されたファイル:"
    find generated -name "*.kt" -type f | sort | while read file; do
        echo "   - $file"
    done
    
    if [ -f "generated/build.gradle.kts" ]; then
        echo "   - generated/build.gradle.kts"
    fi
    
    echo ""
    echo "🚀 次のステップ:"
    echo "   1. cd generated"
    echo "   2. ./gradlew build  # 生成されたコードをビルド"
    echo "   3. 実装クラスを作成して Spring Boot アプリケーションを完成させる"
else
    echo ""
    echo "💡 このライブラリは以下の機能を提供します:"
    echo "   - OpenAPI 3.x 仕様の完全サポート"
    echo "   - Spring Boot Controller インターフェース自動生成"
    echo "   - Kotlin データクラス生成"
    echo "   - Validation アノテーション対応"
    echo "   - Swagger/OpenAPI アノテーション対応"
fi

echo ""
echo "📚 詳細は README.md をご覧ください"