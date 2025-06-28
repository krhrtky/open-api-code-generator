# Core Specification - OpenAPI 3.1.0 基本仕様

## 📖 概要

OpenAPI 3.1.0の基本仕様と必須実装要件をまとめたディレクトリです。ジェネレーター開発の**最初のステップ**として参照してください。

## 📁 ファイル構成

### 必須ドキュメント

| ファイル | 目的 | 実装フェーズ | 重要度 |
|---------|------|-------------|-------|
| `openapi-schema-specification.md` | 基本スキーマ定義方法 | Phase 1 | 🔥🔥🔥 |
| `openapi-specification-compliance.md` | 仕様適合性評価 | Phase 1 | 🔥🔥🔥 |

## 🎯 実装優先度

### Priority 1: 必須実装（推定時間: 30分）
```bash
# 1. 基本構造理解
openapi-schema-specification.md
  ├── OpenAPI基本構造
  ├── データ型定義
  ├── パラメータ定義  
  └── レスポンス定義
```

### Priority 2: 準拠性確認（推定時間: 15分）
```bash
# 2. 実装範囲確認
openapi-specification-compliance.md
  ├── 機能対応マトリックス（95%対応確認）
  ├── 実装vs仕様のギャップ分析
  └── 企業利用における充足度
```

## 🚀 ジェネレーター実装ガイド

### Step 1: パーサー実装
```typescript
// openapi-schema-specification.md の基本構造に基づく
interface OpenAPIDocument {
  openapi: "3.1.0";
  info: InfoObject;
  servers?: ServerObject[];
  paths: PathsObject;
  components?: ComponentsObject;
}
```

### Step 2: バリデーション実装
```typescript
// openapi-specification-compliance.md の対応マトリックスに基づく
const REQUIRED_FEATURES = [
  "info", "paths", "components.schemas", 
  "parameters", "responses", "requestBodies"
];
```

### Step 3: 基本コード生成
```typescript
// 最低限の生成対象
interface GenerationTargets {
  models: boolean;      // データモデル
  apis: boolean;        // API操作
  validators: boolean;  // バリデーション
}
```

## 📊 実装要件マトリックス

### 必須実装機能（MVP）

| 機能 | 説明 | 実装必須度 | 参照箇所 |
|------|------|----------|----------|
| OpenAPI Object | ルートオブジェクト | 🔥🔥🔥 | schema-spec#基本構造 |
| Info Object | API基本情報 | 🔥🔥🔥 | schema-spec#基本情報 |
| Paths Object | APIエンドポイント | 🔥🔥🔥 | schema-spec#APIパス |
| Components/Schemas | データ型定義 | 🔥🔥🔥 | schema-spec#コンポーネント |
| Parameters | パラメータ定義 | 🔥🔥 | schema-spec#パラメータ |
| Responses | レスポンス定義 | 🔥🔥 | schema-spec#レスポンス |

### 推奨実装機能

| 機能 | 説明 | 実装推奨度 | 参照箇所 |
|------|------|----------|----------|
| Security Schemes | 認証方式 | 🔥🔥 | schema-spec#セキュリティ |
| Examples | サンプルデータ | 🔥 | schema-spec#例示 |
| Tags | API分類 | 🔥 | schema-spec#タグ |

## 🧪 実装検証方法

### 基本機能テスト
```yaml
# test-basic.yaml - 最小限のOpenAPI仕様
openapi: 3.1.0
info:
  title: Test API
  version: 1.0.0
paths:
  /test:
    get:
      responses:
        '200':
          description: Success
```

### パーサーテスト
```bash
# ジェネレーターでの検証
your-generator parse test-basic.yaml
# → エラーなく解析できることを確認
```

## 🔍 デバッグ・トラブルシューティング

### よくある実装課題

1. **JSON Schema vs OpenAPI Schema**
   - 解決策: `openapi-specification-compliance.md` の差分分析参照

2. **$ref 参照解決**
   - 解決策: `openapi-schema-specification.md` の参照例参照

3. **バリデーション実装**
   - 解決策: `openapi-schema-specification.md` のバリデーション仕様参照

### 実装品質チェック
```typescript
// 基本品質確認項目
const qualityChecks = [
  "OpenAPI 3.1.0 形式解析",
  "必須フィールド検証", 
  "データ型マッピング",
  "エラーハンドリング"
];
```

## 📈 次のステップ

### 基本実装完了後
1. `../advanced-features/` - 高度機能実装
2. `../code-generation/` - コード生成機能
3. `../implementation-guides/` - 実装ガイド

### 実装完了の判定基準
- [ ] OpenAPI 3.1.0ドキュメントを正常解析
- [ ] 基本データ型（string, number, boolean, array, object）対応
- [ ] path/query/header パラメータ解析
- [ ] request/response ボディ解析
- [ ] 最低限のコード生成（model, api）

---

**🚨 重要**: この基本仕様の実装なしに高度機能には進まないでください。堅牢な基盤の上に高度機能を構築することで、保守性と拡張性が確保されます。