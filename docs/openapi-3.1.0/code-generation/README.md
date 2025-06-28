# Code Generation - OpenAPI 3.1.0 コード生成

## 📖 概要

OpenAPIスキーマからの実際のコード生成実装ガイドです。基本仕様と高度機能の実装完了後に取り組む**Phase 3**の内容です。

## 📁 ファイル構成

### 🎯 コード生成ターゲット

| ファイル | 生成対象 | 対応言語/フレームワーク | 実装難易度 |
|---------|----------|----------------------|-----------|
| `controller-openapi-mapping.md` | サーバーサイド | Spring Boot, Express.js, ASP.NET | ⭐⭐⭐ |
| `typescript-api-client-generation.md` | クライアントサイド | TypeScript, React, Vue.js | ⭐⭐⭐ |

### 📋 追加予定ファイル（実装推奨）

| ファイル | 生成対象 | 説明 |
|---------|----------|------|
| `model-generation-guide.md` | データモデル | DTO, Entity, Interface生成 |
| `validation-generation-guide.md` | バリデーション | 入力検証コード生成 |
| `documentation-generation-guide.md` | ドキュメント | API仕様書、SDK文書生成 |

## 🎯 実装戦略

### Phase 3A: サーバーサイド生成（推定: 2-3日）
```bash
# 1. Controller/Handler 生成
controller-openapi-mapping.md
  ├── Spring Boot Controller
  ├── Express.js Route Handler  
  ├── ASP.NET Core Controller
  └── 汎用HTTPハンドラー

# 重点実装項目
- HTTPメソッドマッピング
- パラメータバインディング
- レスポンス型定義
- エラーハンドリング
```

### Phase 3B: クライアントサイド生成（推定: 2-3日）
```bash
# 2. API Client生成
typescript-api-client-generation.md
  ├── TypeScript型定義
  ├── HTTP通信クライアント
  ├── React/Vue.js統合
  └── エラーハンドリング

# 重点実装項目  
- 型安全なAPI呼び出し
- 認証ヘッダー管理
- レスポンス型推論
- 非同期処理対応
```

### Phase 3C: 支援コード生成（推定: 1-2日）
```bash
# 3. 補助コード生成
- データモデル（DTO/Entity）
- バリデーション（Bean Validation等）
- ドキュメント（README, SDK文書）
- テストコード（Unit/Integration）
```

## 📊 生成コード品質基準

### 🔥 必須品質項目

| 項目 | 基準 | 検証方法 |
|------|------|----------|
| **型安全性** | 100% | TypeScript/言語固有の型チェック |
| **コンパイル** | エラーゼロ | 生成後即座にビルド成功 |
| **実行可能性** | 100% | 最小限の設定で動作 |
| **可読性** | 高 | 人間が理解・メンテナンス可能 |

### 🎯 推奨品質項目

| 項目 | 基準 | 検証方法 |
|------|------|----------|
| **パフォーマンス** | 最適化済み | ベンチマーク測定 |
| **セキュリティ** | 脆弱性なし | 静的解析ツール |
| **ドキュメント** | 自動生成 | JSDoc/Swagger等 |
| **テストカバレッジ** | 80%以上 | カバレッジ測定 |

## 🧩 生成コードアーキテクチャ

### サーバーサイド構成
```
generated/
├── controllers/          # HTTPエンドポイント
│   ├── UserController.ts
│   └── OrderController.ts
├── models/              # データモデル
│   ├── User.ts
│   └── CreateUserRequest.ts
├── services/            # ビジネスロジック（インターフェース）
│   ├── UserService.ts
│   └── OrderService.ts
└── validators/          # バリデーション
    ├── UserValidator.ts
    └── OrderValidator.ts
```

### クライアントサイド構成
```
generated/
├── apis/               # API操作クラス
│   ├── UsersApi.ts
│   └── OrdersApi.ts  
├── models/             # 型定義
│   ├── User.ts
│   └── ApiResponse.ts
├── runtime/            # 基盤クラス
│   ├── BaseAPI.ts
│   └── Configuration.ts
└── index.ts           # エクスポート
```

## 🎪 高度機能との統合

### 組み合わせスキーマ対応
```typescript
// allOf継承の生成例
interface AdminUser extends BaseUser {
  role: 'admin' | 'super_admin';
  permissions: string[];
}

// oneOf判別の生成例  
type PaymentMethod = 
  | CreditCardPayment 
  | BankTransferPayment 
  | DigitalWalletPayment;
```

### 条件付きスキーマ対応
```typescript
// if/then/else の生成例
interface UserRegistration {
  name: string;
  age: number;
  // age < 18 の場合のみ必須
  parentEmail?: string;
  parentConsent?: boolean;
}

// 動的バリデーション生成
function validateUserRegistration(data: UserRegistration): ValidationResult {
  if (data.age < 18) {
    if (!data.parentEmail || !data.parentConsent) {
      return { valid: false, errors: ['親の同意が必要です'] };
    }
  }
  return { valid: true, errors: [] };
}
```

### Webhooks対応
```typescript
// Webhook受信サーバー生成
@WebhookHandler('/webhooks/orders')
export class OrderWebhookController {
  
  @WebhookEvent('order.completed')
  async handleOrderCompleted(
    @WebhookPayload() event: OrderCompletedEvent
  ): Promise<WebhookResponse> {
    // 自動生成されたハンドラー
    return { received: true };
  }
}

// Webhook送信クライアント生成
export class WebhookClient {
  async deliverEvent(webhook: WebhookConfig, event: WebhookEvent): Promise<void> {
    // 自動生成された配信ロジック
  }
}
```

## 🧪 生成コード検証

### レベル1: 基本動作テスト
```typescript
// 生成されたAPIクライアントのテスト
describe('Generated API Client', () => {
  test('should create user', async () => {
    const api = new UsersApi();
    const user = await api.createUser({
      createUserRequest: {
        username: 'test',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User'
      }
    });
    expect(user.id).toBeDefined();
  });
});
```

### レベル2: 統合テスト
```typescript
// 生成されたController + Clientの統合テスト
describe('Generated Code Integration', () => {
  test('server-client communication', async () => {
    // サーバー起動（生成されたController）
    const server = startTestServer();
    
    // クライアント接続（生成されたClient）
    const client = new ApiClient({ 
      basePath: server.url 
    });
    
    // API呼び出しテスト
    const result = await client.users.getUsers();
    expect(result.users).toBeInstanceOf(Array);
  });
});
```

### レベル3: パフォーマンステスト
```typescript
// 大量データでのパフォーマンステスト
describe('Generated Code Performance', () => {
  test('should handle large datasets', async () => {
    const startTime = performance.now();
    
    const largeResponse = await api.getUsers({ 
      size: 10000 
    });
    
    const endTime = performance.now();
    expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    expect(largeResponse.users.length).toBe(10000);
  });
});
```

## 🔧 ジェネレーター実装支援ツール

### テンプレートエンジン
```typescript
// Mustache/Handlebars等のテンプレート活用
const controllerTemplate = `
{{#operations}}
export class {{classname}}Controller {
  {{#operation}}
  @{{httpMethod}}('{{path}}')
  async {{operationId}}(
    {{#allParams}}
    @{{paramName}} {{dataType}} {{paramName}}{{#hasMore}},{{/hasMore}}
    {{/allParams}}
  ): Promise<{{returnType}}> {
    // Generated method
  }
  {{/operation}}
}
{{/operations}}
`;
```

### コード整形
```typescript
// Prettier等での自動整形
import prettier from 'prettier';

function formatGeneratedCode(code: string, language: string): string {
  return prettier.format(code, {
    parser: language === 'typescript' ? 'typescript' : 'babel',
    semi: true,
    singleQuote: true,
    trailingComma: 'es5'
  });
}
```

### Import最適化
```typescript
// 不要なimportの削除、重複統合
function optimizeImports(generatedFile: string): string {
  // ESLint fix相当の処理
  return eslintFix(generatedFile, {
    rules: {
      'no-unused-vars': 'error',
      'sort-imports': 'error'
    }
  });
}
```

## 📈 実装完了の判定基準

### Phase 3A完了チェック（サーバーサイド）
- [ ] HTTPメソッド→言語メソッドマッピング
- [ ] パラメータ抽出・バインディング
- [ ] レスポンス型定義・シリアライズ
- [ ] エラーハンドリング・例外マッピング
- [ ] 生成コードがコンパイル成功

### Phase 3B完了チェック（クライアントサイド）
- [ ] 型安全なAPI呼び出しクラス生成
- [ ] 認証ヘッダー・設定管理
- [ ] エラーレスポンス処理
- [ ] TypeScript型定義完全性
- [ ] 非同期処理（Promise/async-await）対応

### Phase 3C完了チェック（品質保証）
- [ ] 生成コードの自動テスト通過
- [ ] ドキュメント自動生成
- [ ] パフォーマンス基準クリア
- [ ] セキュリティ静的解析通過

## 📚 次のステップ

### コード生成実装完了後
1. `../implementation-guides/` - 実装パターンとベストプラクティス
2. `../examples-templates/` - 実用例とテンプレート集
3. 実際のプロダクト適用・フィードバック収集

---

**🎯 目標**: 生成されたコードは「手書きコードと同等以上の品質」を目指してください。開発者が安心して使用でき、メンテナンスも容易な、プロダクション品質のコード生成を実現しましょう。