# OpenAPI Code Generator - 統一仕様書

TypeScript実装とRust実装で完全に同一の機能・出力を実現するための詳細仕様

## 🎯 核心機能仕様

### 入力仕様
- **サポート形式**: OpenAPI 3.0.x, 3.1.x (YAML/JSON)
- **入力ファイル**: 単一ファイルのみ（外部参照は未サポート）
- **最大ファイルサイズ**: 100MB
- **エンコーディング**: UTF-8

### 出力仕様
- **ターゲット**: Spring Boot 3.x + Kotlin
- **生成対象**: Controller interfaces, Data classes, build.gradle.kts
- **パッケージ構造**: `{base_package}.controller`, `{base_package}.model`

## 📋 CLI インターフェース仕様

### 必須オプション
```bash
-i, --input <file>     # OpenAPI仕様ファイルパス
```

### オプション引数
```bash
-o, --output <dir>     # 出力ディレクトリ (default: ./generated)
-p, --package <name>   # ベースパッケージ名 (default: com.example.api)
-l, --lang <code>      # 言語コード [TypeScript専用] (default: auto)
--controllers          # Controller生成 (default: true)
--no-controllers       # Controller生成無効
--models              # Model生成 (default: true)  
--no-models           # Model生成無効
--validation          # バリデーション注釈 (default: true)
--no-validation       # バリデーション注釈無効
--swagger             # Swagger注釈 (default: true)
--no-swagger          # Swagger注釈無効
-v, --verbose         # 詳細出力
-h, --help            # ヘルプ表示
--version             # バージョン表示
```

### 終了コード
- `0`: 正常終了
- `1`: 一般エラー (ファイル未発見、パースエラー等)
- `2`: CLI引数エラー

## 🏗️ 生成コード仕様

### Controller インターフェース
```kotlin
package {base_package}.controller

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import javax.validation.Valid
import javax.validation.constraints.*
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses

/**
 * {ClassName} API controller interface
 */
interface {TagName}Controller {

    @Operation(summary = "{summary}", description = "{description}")
    @ApiResponses(value = [
        ApiResponse(responseCode = "200", description = "{response_desc}"),
        ApiResponse(responseCode = "400", description = "Bad Request")
    ])
    @GetMapping("{path}")
    fun {operationId}(
        @PathVariable {param}: {Type},
        @RequestParam(required = false) {query}: {Type}?,
        @Valid @RequestBody {body}: {Type}
    ): ResponseEntity<{ReturnType}>
}
```

### Model データクラス
```kotlin
package {base_package}.model

import javax.validation.constraints.*
import javax.validation.Valid
import io.swagger.v3.oas.annotations.media.Schema
import com.fasterxml.jackson.annotation.JsonProperty

/**
 * {ClassName} data model
 */
@Schema(description = "{description}")
data class {ClassName}(
    /**
     * {property_description}
     */
    @Schema(description = "{description}", example = "{example}")
    @JsonProperty("{original_name}")
    @NotNull
    @Size(min = 1, max = 100)
    val {propertyName}: {Type}{?} = {default}
)
```

### build.gradle.kts
```kotlin
plugins {
    kotlin("jvm") version "1.9.20"
    kotlin("plugin.spring") version "1.9.20"
    id("org.springframework.boot") version "3.1.0"
    id("io.spring.dependency-management") version "1.1.0"
}

group = "{group_id}"
version = "0.0.1-SNAPSHOT"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.1.0")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
    kotlinOptions {
        freeCompilerArgs = listOf("-Xjsr305=strict")
        jvmTarget = "17"
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}
```

## 🔄 データ型マッピング仕様

### OpenAPI → Kotlin型変換
| OpenAPI Type | Format | Kotlin Type |
|--------------|--------|-------------|
| string | - | String |
| string | date | java.time.LocalDate |
| string | date-time | java.time.OffsetDateTime |
| string | uuid | java.util.UUID |
| string | email | String |
| string | uri | java.net.URI |
| string | byte | ByteArray |
| string | binary | ByteArray |
| integer | - | Int |
| integer | int32 | Int |
| integer | int64 | Long |
| number | - | java.math.BigDecimal |
| number | float | Float |
| number | double | Double |
| boolean | - | Boolean |
| array | - | List<{ItemType}> |
| object | - | Map<String, Any> |

### nullable処理
- `nullable: true` または `required`に含まれない → `{Type}?`
- `default`値があるプロパティ → `= {default_value}`
- nullable + defaultなし → `= null`

## 🏷️ 名前変換仕様

### クラス名生成
- OpenAPI tags → `{PascalCase}Controller`
- Components schemas → `{PascalCase}` (そのまま)
- タグなしパス → `DefaultController`

### メソッド名生成
- `operationId`が指定済み → そのまま使用
- 未指定の場合:
  - GET /users → `getUsers`
  - POST /users → `createUsers`
  - PUT /users/{id} → `updateUsers`
  - DELETE /users/{id} → `deleteUsers`
  - PATCH /users/{id} → `patchUsers`

### プロパティ名変換
- snake_case → camelCase
- kebab-case → camelCase
- 元の名前と異なる場合 → `@JsonProperty("{original}")`

## 🔍 バリデーション注釈仕様

### 文字列型
- `minLength` → `@Size(min = {value})`
- `maxLength` → `@Size(max = {value})`
- `pattern` → `@Pattern(regexp = "{pattern}")`
- `format: email` → `@Email`

### 数値型  
- `minimum` → `@Min({value})`
- `maximum` → `@Max({value})`

### 配列型
- `minItems` → `@Size(min = {value})`
- `maxItems` → `@Size(max = {value})`

### 必須フィールド
- `required`配列に含まれる OR `nullable: false` → `@NotNull`
- オブジェクト参照 → `@Valid`

## 📝 ログ出力仕様

### 通常実行時
```
✅ Code generation completed successfully!
📁 Output directory: {absolute_path}
📄 Generated {count} files
```

### Verbose実行時  
```
Parsing OpenAPI specification from: {file_path}
Successfully parsed OpenAPI spec: {title} v{version}
Generating model classes...
Generated model: {ClassName} -> {relative_path}
Generating controller interfaces...
Generated controller: {ClassName} -> {relative_path}
Generated build.gradle.kts -> {relative_path}
✅ Code generation completed successfully!
📁 Output directory: {absolute_path}
📄 Generated {count} files
```

### エラー時
```
❌ Error: {error_message}
```

## 🌍 国際化仕様 [TypeScript専用]

### サポート言語
- en (English)
- ja (日本語)  
- zh (中文)
- ko (한국어)
- es (Español)
- fr (Français)
- de (Deutsch)

### 自動言語検出
1. `--lang`オプション指定
2. `LANG`環境変数
3. システムロケール  
4. フォールバック: `en`

## ⚡ パフォーマンス要件

### TypeScript実装
- 起動時間: < 1秒
- 小ファイル(< 1MB): < 2秒
- 中ファイル(< 10MB): < 10秒
- メモリ使用量: < 100MB

### Rust実装
- 起動時間: < 0.1秒
- 小ファイル(< 1MB): < 0.1秒  
- 中ファイル(< 10MB): < 1秒
- メモリ使用量: < 20MB

## 🧪 テスト仕様

### 必須テストケース
1. **基本機能**: examples/sample-api.yaml での正常動作
2. **エラーハンドリング**: 存在しないファイル、不正フォーマット
3. **オプション処理**: 各CLIオプションの動作確認
4. **出力検証**: 生成されたKotlinコードのコンパイル可能性

この統一仕様に基づいて、TypeScript実装（多言語対応特化）とRust実装（超高速特化）を作成します。