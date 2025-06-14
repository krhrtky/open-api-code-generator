# Schema Composition Examples

このディレクトリには、OpenAPI 3.xの組み合わせスキーマ（allOf、oneOf、anyOf）のサンプルファイルが含まれています。これらのファイルは、コード生成ツールのテストケースとして使用され、実際の開発でのベストプラクティスを示します。

## ファイル構成

### 包括的テストAPI
- **`schema-composition-test-api.yaml`** - 全パターンを網羅した包括的なテストAPI
  - allOf、oneOf、anyOfのすべてのパターンを含む
  - 実際のAPIエンドポイントと完全なレスポンススキーマ
  - バリデーション、国際化、エラーハンドリングの例

### 個別パターンサンプル

#### allOf（継承パターン）
- **`allof-inheritance-example.yaml`** - allOfを使用した継承パターンの例
  - オブジェクト指向プログラミングの継承概念をOpenAPIで表現
  - `BaseEntity` + `Person` + `ContactInfo` = `Employee`
  - `BaseEntity` + `Vehicle` + `Registration` + `ElectricSpecs` = `ElectricCar`

#### oneOf（ポリモーフィズム）
- **`oneof-polymorphism-example.yaml`** - oneOfを使用したポリモーフィズムの例
  - 型安全な判別可能ユニオン（Discriminated Union）を実現
  - イベント系統：`UserRegistrationEvent` | `OrderPlacedEvent` | `PaymentProcessedEvent`
  - ドキュメント系統：`TextDocument` | `SpreadsheetDocument` | `PresentationDocument`
  - 通知系統：`EmailNotification` | `SMSNotification` | `PushNotification`

#### anyOf（柔軟な組み合わせ）
- **`anyof-flexible-unions-example.yaml`** - anyOfを使用した柔軟な組み合わせの例
  - 複数の条件を同時に満たす可能性があるユニオン型
  - 検索フィルター：`TextFilter` + `DateRangeFilter` + `CategoryFilter`
  - インテグレーション設定：`OAuth2Auth` + `WebhookConfig` + `ScheduleConfig`
  - パーミッション：`ResourcePermission` + `RolePermission` + `TimeBasedPermission`

#### 複雑な組み合わせ
- **`complex-composition-example.yaml`** - allOf、oneOf、anyOfを組み合わせた複雑なパターン
  - 実世界のアプリケーションでよく見られる複雑な組み合わせ
  - コンテンツ管理システム、ワークフロー、分析システムの例
  - ネストされた組み合わせパターンと多層継承

## 使用方法

### 基本的なコード生成

```bash
# 包括的テストAPIからコード生成
npx openapi-codegen -i examples/schema-composition-test-api.yaml -o output -p com.example.api

# allOf継承パターンのみ
npx openapi-codegen -i examples/allof-inheritance-example.yaml -o output -p com.example.inheritance

# oneOfポリモーフィズムのみ
npx openapi-codegen -i examples/oneof-polymorphism-example.yaml -o output -p com.example.polymorphism

# anyOf柔軟な組み合わせのみ
npx openapi-codegen -i examples/anyof-flexible-unions-example.yaml -o output -p com.example.unions

# 複雑な組み合わせパターン
npx openapi-codegen -i examples/complex-composition-example.yaml -o output -p com.example.complex
```

### 詳細オプション付き生成

```bash
# バリデーション、Swagger、詳細出力を有効にして生成
npx openapi-codegen \
  -i examples/schema-composition-test-api.yaml \
  -o output \
  -p com.example.api \
  --validation \
  --swagger \
  --verbose

# 日本語ロケールで生成
LANG=ja npx openapi-codegen \
  -i examples/schema-composition-test-api.yaml \
  -o output \
  -p com.example.api \
  --verbose
```

## 生成されるKotlinコードパターン

### allOf - データクラス継承
```kotlin
// BaseEntity + Person + Employee固有プロパティ
data class Employee(
    // BaseEntityから継承
    val id: Long,
    val createdAt: OffsetDateTime,
    val updatedAt: OffsetDateTime,
    
    // Personから継承
    val firstName: String,
    val lastName: String,
    val email: String,
    
    // Employee固有
    val employeeId: String,
    val department: String,
    val position: String,
    val salary: BigDecimal
)
```

### oneOf - Sealed Classes
```kotlin
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes(
    JsonSubTypes.Type(value = EmailNotification::class, name = "email"),
    JsonSubTypes.Type(value = SMSNotification::class, name = "sms"),
    JsonSubTypes.Type(value = PushNotification::class, name = "push")
)
sealed class Notification {
    data class EmailNotification(
        val type: String = "email",
        val recipient: String,
        val subject: String,
        val body: String
    ) : Notification()
    
    data class SMSNotification(
        val type: String = "sms",
        val phoneNumber: String,
        val message: String
    ) : Notification()
    
    data class PushNotification(
        val type: String = "push",
        val deviceToken: String,
        val title: String,
        val body: String
    ) : Notification()
}
```

### anyOf - Union Wrapper Classes
```kotlin
data class SearchFilter(
    @JsonValue val value: Any,
    val supportedTypes: Set<String>
) {
    companion object {
        @JsonCreator
        @JvmStatic
        fun fromTextFilter(value: TextFilter): SearchFilter {
            return SearchFilter(value, setOf("TextFilter"))
        }
        
        @JsonCreator
        @JvmStatic
        fun fromDateRangeFilter(value: DateRangeFilter): SearchFilter {
            return SearchFilter(value, setOf("DateRangeFilter"))
        }
        
        @JsonCreator
        @JvmStatic
        fun fromCategoryFilter(value: CategoryFilter): SearchFilter {
            return SearchFilter(value, setOf("CategoryFilter"))
        }
    }
}
```

## テストケース

### 自動テスト実行

```bash
# 全テストを実行
npm test

# 組み合わせスキーマのテストのみ実行
npm run test:composition

# 統合テストのみ実行
npm run test:integration

# カバレッジ付きテスト実行
npm run test:coverage

# ウォッチモードでテスト実行
npm run test:watch
```

### テストカテゴリ

1. **Schema Composition Tests** (`schema-composition.test.ts`)
   - allOf継承パターンのテスト
   - oneOfポリモーフィズムのテスト
   - anyOf柔軟な組み合わせのテスト
   - 複雑な組み合わせパターンのテスト
   - エラーハンドリングのテスト

2. **Integration Tests** (`integration.test.ts`)
   - エンドツーエンドコード生成のテスト
   - 生成されたKotlinコードの構文検証
   - ファイルシステム統合テスト
   - パフォーマンステスト
   - エラー回復とロバストネステスト

### テスト検証項目

#### 構文検証
- ✅ 有効なKotlin構文の生成
- ✅ 適切なパッケージ宣言
- ✅ 正しいインポート文
- ✅ PascalCase/camelCaseの命名規則

#### 機能検証
- ✅ Jackson注釈の正確な生成
- ✅ バリデーション注釈の適用
- ✅ Swagger/OpenAPI注釈の追加
- ✅ sealed classesとdiscriminatorの実装

#### 統合検証
- ✅ ディレクトリ構造の作成
- ✅ build.gradle.ktsの生成
- ✅ 依存関係の正確な設定
- ✅ 多言語対応（i18n）

## ベストプラクティス

### allOf使用時
- 基底クラスは再利用可能な共通プロパティを定義
- プロパティの競合を避けるため、明確な責任分離
- 循環参照を避ける

### oneOf使用時
- 必ずdiscriminatorプロパティを定義
- 各バリアントに明確な型識別子を設定
- サブタイプは明確に区別可能にする

### anyOf使用時
- 各バリアントは独立して意味を持つように設計
- 組み合わせる際の意味的整合性を確保
- 空のanyOf配列は避ける

### 複雑な組み合わせ時
- ネストの深さを制限する（推奨：3層まで）
- 循環参照の検出と回避
- パフォーマンスを考慮した設計

## トラブルシューティング

### よくある問題

1. **Circular Reference Error**
   ```
   Error: Circular reference detected: #/components/schemas/A
   ```
   - 原因：スキーマ間の循環参照
   - 解決：参照構造を見直し、循環を断つ

2. **Property Conflict in allOf**
   ```
   Error: Property 'name' has conflicting types in allOf schemas
   ```
   - 原因：allOfで同名プロパティの型が異なる
   - 解決：プロパティ名を変更するか、型を統一

3. **Missing Discriminator in oneOf**
   ```
   Error: oneOf schema without discriminator property
   ```
   - 原因：oneOfにdiscriminatorが未定義
   - 解決：discriminatorプロパティを追加

4. **Empty anyOf Schema**
   ```
   Error: anyOf schema must contain at least one variant
   ```
   - 原因：anyOf配列が空
   - 解決：少なくとも1つのバリアントを追加

### デバッグ方法

```bash
# 詳細ログ付きで生成
npx openapi-codegen -i example.yaml -o output -p com.example --verbose

# 特定のテストのみ実行
npm test -- --testNamePattern="allOf"

# カバレッジレポートでテストされていない部分を確認
npm run test:coverage
```

## 貢献方法

新しいサンプルパターンや改善提案は以下の手順で貢献できます：

1. 新しいサンプルファイルを作成
2. 対応するテストケースを追加
3. READMEにドキュメントを追加
4. Pull Requestを作成

### サンプル追加時のチェックリスト

- [ ] OpenAPI 3.x仕様に準拠
- [ ] 実用的なユースケースを反映
- [ ] 適切なdescriptionとexampleを含む
- [ ] バリデーション制約を定義
- [ ] テストケースを作成
- [ ] ドキュメントを更新