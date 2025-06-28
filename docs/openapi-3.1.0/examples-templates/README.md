# Examples & Templates - OpenAPI 3.1.0 サンプル・テンプレート

## 📖 概要

OpenAPI 3.1.0の実用的なサンプルとコード生成テンプレート集です。実際の開発で即座に活用できる具体例を提供します。

## 📁 推奨ファイル構成

### 🎯 OpenAPIサンプル仕様

| ファイル | 内容 | 複雑度 | 用途 |
|---------|------|--------|------|
| `basic-api-example.yaml` | 基本的なREST API | ⭐ | 学習・テスト |
| `ecommerce-api-example.yaml` | ECサイトAPI | ⭐⭐⭐ | 実践的サンプル |
| `microservices-api-example.yaml` | マイクロサービス | ⭐⭐⭐⭐ | 大規模システム |
| `advanced-features-showcase.yaml` | 全機能デモ | ⭐⭐⭐⭐⭐ | 機能確認 |

### 🛠️ コード生成テンプレート

| ディレクトリ | 内容 | 対象言語 |
|-------------|------|----------|
| `templates/typescript/` | TypeScript用テンプレート | TypeScript |
| `templates/java-spring/` | Spring Boot用テンプレート | Java |
| `templates/csharp-dotnet/` | .NET Core用テンプレート | C# |
| `templates/python-fastapi/` | FastAPI用テンプレート | Python |

### 📚 実装例

| ディレクトリ | 内容 | 説明 |
|-------------|------|------|
| `generated-examples/` | 生成コード例 | 実際の生成結果 |
| `integration-examples/` | 統合例 | フレームワーク統合 |
| `testing-examples/` | テスト例 | テスト戦略実装 |

## 🎪 サンプルAPI仕様

### 📱 基本API例（basic-api-example.yaml）

```yaml
openapi: 3.1.0
info:
  title: Basic Todo API
  version: 1.0.0
  description: シンプルなTodo管理API

servers:
  - url: https://api.example.com/v1

paths:
  /todos:
    get:
      summary: Todo一覧取得
      operationId: getTodos
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        '200':
          description: Todo一覧
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Todo'
    
    post:
      summary: Todo作成
      operationId: createTodo
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTodoRequest'
      responses:
        '201':
          description: 作成されたTodo
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'

  /todos/{id}:
    get:
      summary: Todo詳細取得
      operationId: getTodoById
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Todo詳細
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Todo'
        '404':
          description: Todoが見つからない

components:
  schemas:
    Todo:
      type: object
      required:
        - id
        - title
        - completed
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
          maxLength: 255
        description:
          type: string
        completed:
          type: boolean
          default: false
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    CreateTodoRequest:
      type: object
      required:
        - title
      properties:
        title:
          type: string
          maxLength: 255
        description:
          type: string
```

### 🛒 ECサイトAPI例（ecommerce-api-example.yaml）

```yaml
openapi: 3.1.0
info:
  title: E-commerce API
  version: 2.0.0
  description: 本格的なECサイトAPI

servers:
  - url: https://api.shop.example.com/v2

# 高度機能を活用した実装例
components:
  schemas:
    # 組み合わせスキーマの実用例
    Product:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required:
            - name
            - price
            - category
          properties:
            name:
              type: string
              maxLength: 255
            price:
              type: number
              minimum: 0
            category:
              $ref: '#/components/schemas/ProductCategory'
            variants:
              type: array
              items:
                $ref: '#/components/schemas/ProductVariant'

    # 条件付きスキーマの実用例
    Order:
      type: object
      required:
        - id
        - customerId
        - items
        - status
      properties:
        id:
          type: string
          format: uuid
        customerId:
          type: string
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        status:
          type: string
          enum: [pending, confirmed, shipped, delivered, cancelled]
        shippingAddress:
          $ref: '#/components/schemas/Address'
        billingAddress:
          $ref: '#/components/schemas/Address'
        paymentMethod:
          oneOf:
            - $ref: '#/components/schemas/CreditCardPayment'
            - $ref: '#/components/schemas/BankTransferPayment'
          discriminator:
            propertyName: type

      # 条件付きバリデーション
      if:
        properties:
          status:
            enum: [shipped, delivered]
      then:
        required: [trackingNumber]
        properties:
          trackingNumber:
            type: string

    # ポリモーフィズムの実用例
    PaymentMethod:
      oneOf:
        - $ref: '#/components/schemas/CreditCardPayment'
        - $ref: '#/components/schemas/BankTransferPayment'
        - $ref: '#/components/schemas/DigitalWalletPayment'
      discriminator:
        propertyName: type
        mapping:
          credit_card: '#/components/schemas/CreditCardPayment'
          bank_transfer: '#/components/schemas/BankTransferPayment'
          digital_wallet: '#/components/schemas/DigitalWalletPayment'

    CreditCardPayment:
      allOf:
        - $ref: '#/components/schemas/BasePayment'
        - type: object
          properties:
            type:
              const: credit_card
            cardNumber:
              type: string
              pattern: '^[0-9]{13,19}$'
            expiryMonth:
              type: integer
              minimum: 1
              maximum: 12
            expiryYear:
              type: integer
              minimum: 2024

# Webhooks実装例（OpenAPI 3.1.0新機能）
webhooks:
  orderStatusChanged:
    post:
      summary: 注文ステータス変更通知
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderStatusChangedEvent'
      responses:
        '200':
          description: Webhook受信成功

  paymentCompleted:
    post:
      summary: 決済完了通知
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentCompletedEvent'
      responses:
        '200':
          description: Webhook受信成功
```

## 🛠️ コード生成テンプレート例

### TypeScript APIクライアントテンプレート

```typescript
// templates/typescript/api-client.mustache
{{>licenseInfo}}
{{#models}}
{{#model}}
/**
 * {{description}}
 */
export interface {{classname}} {
{{#vars}}
    /**
     * {{description}}
     */
    {{#isReadonly}}readonly {{/isReadonly}}{{name}}{{^required}}?{{/required}}: {{datatype}};
{{/vars}}
}
{{/model}}
{{/models}}

{{#operations}}
/**
 * {{description}}
 */
export class {{classname}}Api {
    private basePath: string;
    private configuration: Configuration;

    constructor(configuration: Configuration, basePath: string = '{{{basePath}}}') {
        this.configuration = configuration;
        this.basePath = basePath;
    }

{{#operation}}
    /**
     * {{summary}}
     * {{notes}}
     */
    public async {{operationId}}(
        {{#allParams}}
        {{paramName}}: {{dataType}}{{#hasMore}},{{/hasMore}}
        {{/allParams}}
    ): Promise<{{returnType}}> {
        const localVarPath = `{{path}}`{{#pathParams}}.replace('{{{baseName}}}', encodeURIComponent(String({{paramName}}))){{/pathParams}};
        
        const localVarRequestOptions: RequestInit = {
            method: '{{httpMethod}}',
            headers: {
                'Content-Type': 'application/json',
                ...this.configuration.defaultHeaders,
            },
        };

        {{#hasBodyParam}}
        localVarRequestOptions.body = JSON.stringify({{bodyParam.paramName}});
        {{/hasBodyParam}}

        const response = await fetch(this.basePath + localVarPath, localVarRequestOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        {{#returnType}}
        return await response.json() as {{returnType}};
        {{/returnType}}
        {{^returnType}}
        return;
        {{/returnType}}
    }
{{/operation}}
}
{{/operations}}
```

### Spring Boot Controllerテンプレート

```java
// templates/java-spring/controller.mustache
{{>licenseInfo}}
package {{package}};

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import javax.validation.Valid;
{{#imports}}
import {{import}};
{{/imports}}

{{#operations}}
/**
 * {{description}}
 */
@RestController
@RequestMapping("{{basePath}}")
@CrossOrigin(origins = "*")
public class {{classname}} {

{{#operation}}
    /**
     * {{summary}}
     * {{notes}}
     */
    @{{httpMethod}}("{{path}}")
    public ResponseEntity<{{returnType}}> {{operationId}}(
        {{#allParams}}
        {{#isPathParam}}@PathVariable{{/isPathParam}}{{#isQueryParam}}@RequestParam{{#hasDefaultValue}}(defaultValue = "{{defaultValue}}"){{/hasDefaultValue}}{{/isQueryParam}}{{#isHeaderParam}}@RequestHeader{{/isHeaderParam}}{{#isBodyParam}}@Valid @RequestBody{{/isBodyParam}} {{dataType}} {{paramName}}{{#hasMore}},{{/hasMore}}
        {{/allParams}}
    ) {
        // TODO: implement
        {{#returnType}}
        {{returnType}} response = null;
        return ResponseEntity.ok(response);
        {{/returnType}}
        {{^returnType}}
        return ResponseEntity.{{#is201}}status(HttpStatus.CREATED){{/is201}}{{#is204}}noContent(){{/is204}}{{^is201}}{{^is204}}ok(){{/is204}}{{/is201}}.build();
        {{/returnType}}
    }
{{/operation}}
}
{{/operations}}
```

## 📚 実装パターン例

### 高度機能活用パターン

#### 1. 継承ベースの設計
```yaml
# 継承パターンの実装例
components:
  schemas:
    # 基底クラス
    BaseEntity:
      type: object
      required: [id, createdAt, updatedAt]
      properties:
        id: { type: string, format: uuid }
        createdAt: { type: string, format: date-time }
        updatedAt: { type: string, format: date-time }

    # 継承クラス
    User:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          required: [username, email]
          properties:
            username: { type: string }
            email: { type: string, format: email }

    AdminUser:
      allOf:
        - $ref: '#/components/schemas/User'
        - type: object
          required: [role]
          properties:
            role: { type: string, enum: [admin, super_admin] }
            permissions: { type: array, items: { type: string } }
```

#### 2. 条件付きバリデーションパターン
```yaml
# ビジネスルール実装例
components:
  schemas:
    ShippingOrder:
      type: object
      required: [destination, items]
      properties:
        destination: { type: string, enum: [domestic, international] }
        items: { type: array, items: { $ref: '#/components/schemas/Item' } }
        customsDeclaration: { $ref: '#/components/schemas/CustomsDeclaration' }
        expressDelivery: { type: boolean }

      # 国際配送の場合は税関申告が必須
      if:
        properties:
          destination: { const: international }
      then:
        required: [customsDeclaration]

      # 高速配送の場合は追加料金が発生
      if:
        properties:
          expressDelivery: { const: true }
      then:
        properties:
          additionalFee: { type: number, minimum: 0 }
        required: [additionalFee]
```

#### 3. Webhooksパターン
```yaml
# イベント駆動アーキテクチャ
webhooks:
  # ユーザー関連イベント
  userLifecycle:
    post:
      summary: ユーザーライフサイクルイベント
      requestBody:
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/UserCreatedEvent'
                - $ref: '#/components/schemas/UserUpdatedEvent'
                - $ref: '#/components/schemas/UserDeletedEvent'
              discriminator:
                propertyName: eventType

  # 注文関連イベント
  orderLifecycle:
    post:
      summary: 注文ライフサイクルイベント
      requestBody:
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/OrderCreatedEvent'
                - $ref: '#/components/schemas/OrderShippedEvent'
                - $ref: '#/components/schemas/OrderCompletedEvent'
              discriminator:
                propertyName: eventType
```

## 🧪 テスト戦略例

### 生成コードテスト
```typescript
// generated-examples/tests/api-client.test.ts
import { UsersApi, User, CreateUserRequest } from '../generated/api';

describe('Generated API Client', () => {
  let api: UsersApi;

  beforeEach(() => {
    api = new UsersApi({
      basePath: 'http://localhost:3000',
      apiKey: 'test-key'
    });
  });

  test('should create user with valid data', async () => {
    const request: CreateUserRequest = {
      username: 'testuser',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User'
    };

    const mockUser: User = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      ...request,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    };

    // Mock HTTP response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser
    });

    const result = await api.createUser(request);
    
    expect(result.id).toBe(mockUser.id);
    expect(result.username).toBe(request.username);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/users',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(request)
      })
    );
  });

  test('should handle API errors gracefully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request'
    });

    await expect(api.createUser({} as CreateUserRequest))
      .rejects
      .toThrow('HTTP 400: Bad Request');
  });
});
```

## 📈 活用ガイドライン

### 🎯 サンプル活用方法

#### 学習段階
1. `basic-api-example.yaml` で基本構造理解
2. 生成されたコードで動作確認
3. 小さな修正で機能追加体験

#### 開発段階
1. `ecommerce-api-example.yaml` を参考にAPI設計
2. 高度機能の活用パターン学習
3. 自プロジェクト向けカスタマイズ

#### 本格運用段階
1. `microservices-api-example.yaml` で大規模設計学習
2. 実際のビジネスロジック実装
3. パフォーマンス・スケーラビリティ考慮

### 🔧 テンプレートカスタマイズ

```typescript
// カスタムテンプレート作成例
const customTemplate = {
  // プロジェクト固有の命名規則
  classNameCase: 'PascalCase',
  methodNameCase: 'camelCase',
  
  // プロジェクト固有のインポート
  additionalImports: [
    'import { Logger } from "@/utils/logger";',
    'import { MetricsCollector } from "@/utils/metrics";'
  ],
  
  // プロジェクト固有のメソッド追加
  additionalMethods: [
    'private log = new Logger(this.constructor.name);',
    'private metrics = new MetricsCollector();'
  ]
};
```

## 📚 学習ロードマップ

### Step 1: 基本理解（1週間）
- [ ] `basic-api-example.yaml` 理解
- [ ] 基本テンプレート動作確認
- [ ] 簡単なAPI作成・テスト

### Step 2: 実践応用（2週間）
- [ ] `ecommerce-api-example.yaml` 解析
- [ ] 高度機能（allOf/oneOf/if-then-else）活用
- [ ] 実際のプロジェクトで小規模適用

### Step 3: 本格運用（1ヶ月）
- [ ] `microservices-api-example.yaml` 学習
- [ ] Webhooks/外部参照システム活用
- [ ] 大規模プロジェクトでの本格運用

---

**🎯 目標**: これらのサンプルとテンプレートを活用して、OpenAPI 3.1.0の強力な機能を最大限に活用し、開発効率とコード品質を大幅に向上させましょう。