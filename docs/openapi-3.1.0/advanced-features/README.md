# Advanced Features - OpenAPI 3.1.0 高度機能

## 📖 概要

OpenAPI 3.1.0の新機能と高度な機能実装ガイドです。基本実装（`core-specification`）完了後に取り組む**Phase 2**の実装内容です。

## 📁 ファイル構成

### 🚀 新機能（OpenAPI 3.1.0で追加）

| ファイル | 機能 | 実装難易度 | ビジネス価値 |
|---------|------|-----------|-------------|
| `openapi-webhooks-specification.md` | Webhooks | ⭐⭐⭐⭐ | 🔥🔥🔥 |
| `json-schema-2020-12-specification.md` | 最新スキーマ | ⭐⭐⭐⭐⭐ | 🔥🔥🔥 |

### 🎯 高度機能（従来機能の拡張）

| ファイル | 機能 | 実装難易度 | ビジネス価値 |
|---------|------|-----------|-------------|
| `openapi-external-references-guide.md` | 外部参照システム | ⭐⭐⭐⭐ | 🔥🔥 |
| `advanced-schema-composition-guide.md` | 組み合わせスキーマ | ⭐⭐⭐⭐ | 🔥🔥🔥 |
| `conditional-schema-implementation.md` | 条件付きスキーマ | ⭐⭐⭐⭐⭐ | 🔥🔥🔥 |

## 🎯 実装戦略

### Phase 2A: 高価値・中難易度（推定: 2-3日）
```bash
# 1. 組み合わせスキーマ（allOf/oneOf/anyOf）
advanced-schema-composition-guide.md
  ├── 継承パターン実装
  ├── ポリモーフィズム対応
  └── discriminator サポート

# 2. 外部参照システム
openapi-external-references-guide.md  
  ├── $ref 解決エンジン
  ├── 大規模仕様分割サポート
  └── 循環参照検出
```

### Phase 2B: 新機能実装（推定: 3-4日）
```bash
# 3. Webhooks（OpenAPI 3.1.0新機能）
openapi-webhooks-specification.md
  ├── Webhookエンドポイント生成
  ├── イベント型定義
  └── 配信・リトライ機能

# 4. JSON Schema 2020-12対応
json-schema-2020-12-specification.md
  ├── 新キーワード実装
  ├── prefixItems/unevaluatedProperties
  └── dependentRequired/dependentSchemas
```

### Phase 2C: 高度条件分岐（推定: 2-3日）  
```bash
# 5. 条件付きスキーマ（if/then/else）
conditional-schema-implementation.md
  ├── 動的バリデーション
  ├── ビジネスルール実装
  └── 条件分岐コード生成
```

## 📊 機能別実装ガイド

### 🎪 1. Webhooks実装

**必須レベル**: 企業向けプロダクト
**実装範囲**: イベント駆動アーキテクチャ

```typescript
// 実装目標
interface WebhookSupport {
  webhookDefinition: boolean;     // Webhook定義解析
  eventSchemaGeneration: boolean; // イベント型生成
  deliverySystem: boolean;        // 配信システム
  retryLogic: boolean;           // リトライ機能
}
```

### 🔗 2. 外部参照システム

**必須レベル**: 大規模チーム開発
**実装範囲**: スキーマ分割・管理

```typescript
// 実装目標
interface ExternalRefSupport {
  refResolution: boolean;      // 参照解決
  circularDetection: boolean;  // 循環参照検出
  bundling: boolean;          // バンドル機能
  validation: boolean;        // 整合性検証
}
```

### 🧬 3. 組み合わせスキーマ

**必須レベル**: 型安全なAPI
**実装範囲**: 高度な型システム

```typescript
// 実装目標
interface CompositionSupport {
  allOfMerging: boolean;      // allOf結合
  oneOfDiscriminator: boolean; // oneOf判別
  anyOfValidation: boolean;   // anyOf検証
  inheritanceChains: boolean; // 継承チェーン
}
```

### 🔄 4. 条件付きスキーマ

**必須レベル**: 動的バリデーション
**実装範囲**: ビジネスロジック表現

```typescript
// 実装目標  
interface ConditionalSupport {
  ifThenElse: boolean;        // 条件分岐
  dynamicValidation: boolean; // 動的検証
  businessRules: boolean;     // ルール実装
  codeGeneration: boolean;    // 条件コード生成
}
```

### 🆕 5. JSON Schema 2020-12

**必須レベル**: 最新仕様対応
**実装範囲**: 新機能フル活用

```typescript
// 実装目標
interface JsonSchema2020Support {
  newKeywords: boolean;           // 新キーワード
  prefixItems: boolean;          // 配列先頭定義
  unevaluatedProperties: boolean; // 未評価制御
  dependentSchemas: boolean;     // 依存スキーマ
}
```

## 🧪 実装検証テストケース

### レベル1: 基本動作確認
```yaml
# test-allof.yaml - allOf基本テスト
components:
  schemas:
    ExtendedUser:
      allOf:
        - $ref: '#/components/schemas/BaseUser'
        - type: object
          properties:
            role: { type: string }
```

### レベル2: 高度機能テスト
```yaml  
# test-conditional.yaml - 条件分岐テスト
components:
  schemas:
    ConditionalSchema:
      if:
        properties:
          type: { const: "premium" }
      then:
        required: ["subscription"]
```

### レベル3: 統合テスト
```yaml
# test-integration.yaml - 全機能統合テスト  
openapi: 3.1.0
webhooks:
  userCreated:
    post:
      requestBody:
        content:
          application/json:
            schema:
              allOf:
                - $ref: './external/base-event.yaml#/Event'
                - if:
                    properties:
                      eventType: { const: "user.created" }
                  then:
                    properties:
                      data:
                        $ref: '#/components/schemas/UserData'
```

## 🚨 実装時の注意点

### パフォーマンス考慮
- 組み合わせスキーマの評価回数最適化
- 外部参照のキャッシュ戦略  
- 条件分岐の計算量制限

### 互換性維持
- OpenAPI 3.0.x との下位互換性
- 既存ジェネレーターとの共存
- 段階的移行サポート

### エラーハンドリング
- 循環参照の適切な検出
- 条件分岐の無限ループ防止
- わかりやすいエラーメッセージ

## 📈 実装優先度マトリックス

| 機能 | ビジネス価値 | 実装コスト | 優先度 |
|------|-------------|-----------|--------|
| 組み合わせスキーマ | 高 | 中 | 🔥🔥🔥 |
| 外部参照 | 中 | 中 | 🔥🔥 |
| Webhooks | 高 | 高 | 🔥🔥🔥 |
| 条件分岐 | 高 | 高 | 🔥🔥 |
| JSON Schema 2020-12 | 中 | 高 | 🔥 |

## 🎯 実装完了の判定基準

### Phase 2A完了チェック
- [ ] allOf/oneOf/anyOf の基本処理
- [ ] discriminator サポート
- [ ] 外部$ref解決（相対パス）

### Phase 2B完了チェック  
- [ ] Webhook定義解析
- [ ] 新JSON Schemaキーワード対応
- [ ] prefixItems/unevaluatedProperties実装

### Phase 2C完了チェック
- [ ] if/then/else 条件分岐
- [ ] 動的バリデーション
- [ ] ビジネスルール表現

## 📚 次のステップ

### 高度機能実装完了後
1. `../code-generation/` - 高度機能を活用したコード生成
2. `../implementation-guides/` - 実装パターンとベストプラクティス
3. `../examples-templates/` - 高度機能活用例

---

**⚡ 重要**: 高度機能は段階的に実装してください。すべてを一度に実装するよりも、1つずつ確実に動作させることで、デバッグとメンテナンスが容易になります。