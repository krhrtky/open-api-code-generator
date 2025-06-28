# OpenAPI 外部参照（$ref）システム完全実装ガイド

## 概要

OpenAPIの外部参照（$ref）機能の完全実装ガイドです。大規模なAPI仕様を複数ファイルに分割し、再利用可能なコンポーネントとして管理する方法を詳細に説明します。

## 外部参照の基本概念

### 1. 参照の種類

```yaml
# 内部参照（同一ファイル内）
$ref: '#/components/schemas/User'

# 外部ファイル参照（相対パス）
$ref: './schemas/user.yaml#/User'
$ref: '../common/errors.yaml#/ErrorResponse'

# 外部ファイル参照（絶対パス）
$ref: '/api/schemas/user.yaml#/User'

# 外部URL参照（HTTP/HTTPS）
$ref: 'https://api.example.com/schemas/common.yaml#/User'

# ファイル全体参照
$ref: './schemas/user.yaml'
```

### 2. 参照可能な要素

| 要素 | 参照例 | 説明 |
|------|--------|------|
| スキーマ | `#/components/schemas/User` | データ型定義 |
| パラメータ | `#/components/parameters/UserId` | API パラメータ |
| レスポンス | `#/components/responses/ErrorResponse` | レスポンス定義 |
| リクエストボディ | `#/components/requestBodies/UserCreate` | リクエストボディ |
| ヘッダー | `#/components/headers/RateLimit` | HTTPヘッダー |
| セキュリティスキーマ | `#/components/securitySchemes/ApiKey` | 認証方式 |
| コールバック | `#/components/callbacks/OrderCallback` | コールバック定義 |

## ファイル構造設計

### 1. 推奨ディレクトリ構造

```
api-spec/
├── openapi.yaml              # メインファイル
├── info/
│   └── info.yaml            # API基本情報
├── paths/                   # APIパス定義
│   ├── users/
│   │   ├── index.yaml       # /users
│   │   ├── user-id.yaml     # /users/{userId}
│   │   └── user-orders.yaml # /users/{userId}/orders
│   ├── orders/
│   │   ├── index.yaml       # /orders
│   │   └── order-id.yaml    # /orders/{orderId}
│   └── payments/
│       ├── index.yaml       # /payments
│       └── payment-id.yaml  # /payments/{paymentId}
├── components/              # 再利用可能コンポーネント
│   ├── schemas/             # データスキーマ
│   │   ├── entities/        # エンティティスキーマ
│   │   │   ├── user.yaml
│   │   │   ├── order.yaml
│   │   │   └── payment.yaml
│   │   ├── requests/        # リクエストスキーマ
│   │   │   ├── create-user.yaml
│   │   │   ├── update-user.yaml
│   │   │   └── create-order.yaml
│   │   ├── responses/       # レスポンススキーマ
│   │   │   ├── user-list.yaml
│   │   │   ├── order-list.yaml
│   │   │   └── pagination.yaml
│   │   └── common/          # 共通スキーマ
│   │       ├── error.yaml
│   │       ├── success.yaml
│   │       └── metadata.yaml
│   ├── parameters/          # パラメータ定義
│   │   ├── path/
│   │   │   ├── user-id.yaml
│   │   │   └── order-id.yaml
│   │   ├── query/
│   │   │   ├── pagination.yaml
│   │   │   ├── filtering.yaml
│   │   │   └── sorting.yaml
│   │   └── header/
│   │       ├── authorization.yaml
│   │       └── content-type.yaml
│   ├── responses/           # レスポンス定義
│   │   ├── success/
│   │   │   ├── 200-ok.yaml
│   │   │   ├── 201-created.yaml
│   │   │   └── 204-no-content.yaml
│   │   └── errors/
│   │       ├── 400-bad-request.yaml
│   │       ├── 401-unauthorized.yaml
│   │       ├── 404-not-found.yaml
│   │       └── 500-internal-error.yaml
│   ├── request-bodies/      # リクエストボディ定義
│   │   ├── user-create.yaml
│   │   ├── user-update.yaml
│   │   └── order-create.yaml
│   └── security/            # セキュリティ定義
│       ├── bearer-auth.yaml
│       ├── api-key.yaml
│       └── oauth2.yaml
├── examples/                # サンプルデータ
│   ├── users/
│   ├── orders/
│   └── errors/
└── docs/                    # ドキュメント
    ├── README.md
    └── migration-guide.md
```

### 2. メインファイル（openapi.yaml）

```yaml
openapi: 3.1.0

# 基本情報を外部参照
info:
  $ref: './info/info.yaml'

# サーバー情報
servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server

# パス定義を外部参照
paths:
  # ユーザー関連エンドポイント
  /users:
    $ref: './paths/users/index.yaml'
  /users/{userId}:
    $ref: './paths/users/user-id.yaml'
  /users/{userId}/orders:
    $ref: './paths/users/user-orders.yaml'

  # 注文関連エンドポイント
  /orders:
    $ref: './paths/orders/index.yaml'
  /orders/{orderId}:
    $ref: './paths/orders/order-id.yaml'

  # 決済関連エンドポイント
  /payments:
    $ref: './paths/payments/index.yaml'
  /payments/{paymentId}:
    $ref: './paths/payments/payment-id.yaml'

# コンポーネントを外部参照
components:
  # スキーマ定義
  schemas:
    # エンティティスキーマ
    User:
      $ref: './components/schemas/entities/user.yaml'
    Order:
      $ref: './components/schemas/entities/order.yaml'
    Payment:
      $ref: './components/schemas/entities/payment.yaml'

    # リクエストスキーマ
    CreateUserRequest:
      $ref: './components/schemas/requests/create-user.yaml'
    UpdateUserRequest:
      $ref: './components/schemas/requests/update-user.yaml'
    CreateOrderRequest:
      $ref: './components/schemas/requests/create-order.yaml'

    # レスポンススキーマ
    UserListResponse:
      $ref: './components/schemas/responses/user-list.yaml'
    OrderListResponse:
      $ref: './components/schemas/responses/order-list.yaml'
    PaginationInfo:
      $ref: './components/schemas/responses/pagination.yaml'

    # 共通スキーマ
    ErrorResponse:
      $ref: './components/schemas/common/error.yaml'
    SuccessResponse:
      $ref: './components/schemas/common/success.yaml'

  # パラメータ定義
  parameters:
    UserIdPath:
      $ref: './components/parameters/path/user-id.yaml'
    OrderIdPath:
      $ref: './components/parameters/path/order-id.yaml'
    PaginationQuery:
      $ref: './components/parameters/query/pagination.yaml'
    FilteringQuery:
      $ref: './components/parameters/query/filtering.yaml'
    SortingQuery:
      $ref: './components/parameters/query/sorting.yaml'

  # レスポンス定義
  responses:
    # 成功レスポンス
    200OK:
      $ref: './components/responses/success/200-ok.yaml'
    201Created:
      $ref: './components/responses/success/201-created.yaml'
    204NoContent:
      $ref: './components/responses/success/204-no-content.yaml'

    # エラーレスポンス
    400BadRequest:
      $ref: './components/responses/errors/400-bad-request.yaml'
    401Unauthorized:
      $ref: './components/responses/errors/401-unauthorized.yaml'
    404NotFound:
      $ref: './components/responses/errors/404-not-found.yaml'
    500InternalError:
      $ref: './components/responses/errors/500-internal-error.yaml'

  # リクエストボディ定義
  requestBodies:
    UserCreate:
      $ref: './components/request-bodies/user-create.yaml'
    UserUpdate:
      $ref: './components/request-bodies/user-update.yaml'
    OrderCreate:
      $ref: './components/request-bodies/order-create.yaml'

  # セキュリティ定義
  securitySchemes:
    BearerAuth:
      $ref: './components/security/bearer-auth.yaml'
    ApiKeyAuth:
      $ref: './components/security/api-key.yaml'
    OAuth2Auth:
      $ref: './components/security/oauth2.yaml'

# グローバルセキュリティ設定
security:
  - BearerAuth: []
  - ApiKeyAuth: []

# タグ定義
tags:
  - name: Users
    description: ユーザー管理API
  - name: Orders  
    description: 注文管理API
  - name: Payments
    description: 決済管理API
```

### 3. 個別コンポーネントファイル例

#### エンティティスキーマ（components/schemas/entities/user.yaml）

```yaml
type: object
required:
  - id
  - username
  - email
  - createdAt
  - updatedAt
properties:
  id:
    type: integer
    format: int64
    description: ユーザーの一意識別子
    example: 12345
  username:
    type: string
    minLength: 3
    maxLength: 50
    pattern: '^[a-zA-Z0-9_]+$'
    description: ユーザー名（英数字とアンダースコアのみ）
    example: "john_doe"
  email:
    type: string
    format: email
    description: メールアドレス
    example: "john@example.com"
  firstName:
    type: string
    maxLength: 100
    description: 名前
    example: "John"
  lastName:
    type: string
    maxLength: 100
    description: 姓
    example: "Doe"
  age:
    type: integer
    minimum: 0
    maximum: 150
    description: 年齢
    example: 30
  status:
    $ref: '../common/user-status.yaml'
  profile:
    $ref: './user-profile.yaml'
  addresses:
    type: array
    items:
      $ref: '../common/address.yaml'
  createdAt:
    type: string
    format: date-time
    description: 作成日時
    example: "2024-01-15T10:30:00Z"
  updatedAt:
    type: string
    format: date-time
    description: 更新日時
    example: "2024-01-15T10:30:00Z"
```

#### パス定義（paths/users/index.yaml）

```yaml
get:
  summary: ユーザー一覧取得
  description: 条件に基づいてユーザー一覧を取得します
  operationId: getUsers
  tags:
    - Users
  parameters:
    - $ref: '../../components/parameters/query/pagination.yaml#/Page'
    - $ref: '../../components/parameters/query/pagination.yaml#/Size'
    - $ref: '../../components/parameters/query/filtering.yaml#/UserStatus'
    - $ref: '../../components/parameters/query/filtering.yaml#/SearchKeyword'
    - $ref: '../../components/parameters/query/sorting.yaml#/UserSort'
  responses:
    '200':
      description: ユーザー一覧取得成功
      content:
        application/json:
          schema:
            $ref: '../../components/schemas/responses/user-list.yaml'
          examples:
            default:
              $ref: '../../examples/users/user-list-response.yaml'
    '400':
      $ref: '../../components/responses/errors/400-bad-request.yaml'
    '401':
      $ref: '../../components/responses/errors/401-unauthorized.yaml'
    '500':
      $ref: '../../components/responses/errors/500-internal-error.yaml'

post:
  summary: ユーザー作成
  description: 新しいユーザーを作成します
  operationId: createUser
  tags:
    - Users
  requestBody:
    $ref: '../../components/request-bodies/user-create.yaml'
  responses:
    '201':
      description: ユーザー作成成功
      content:
        application/json:
          schema:
            $ref: '../../components/schemas/entities/user.yaml'
          examples:
            default:
              $ref: '../../examples/users/user-response.yaml'
    '400':
      $ref: '../../components/responses/errors/400-bad-request.yaml'
    '409':
      description: ユーザー名またはメールアドレスが既に存在
      content:
        application/json:
          schema:
            $ref: '../../components/schemas/common/error.yaml'
          examples:
            username_exists:
              $ref: '../../examples/errors/username-exists.yaml'
            email_exists:
              $ref: '../../examples/errors/email-exists.yaml'
    '500':
      $ref: '../../components/responses/errors/500-internal-error.yaml'
```

## 参照解決システム実装

### 1. 参照解決エンジン（TypeScript）

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { URL } from 'url';

export interface RefResolverOptions {
  baseDir: string;
  maxDepth: number;
  allowExternalUrls: boolean;
  cache: boolean;
}

export class OpenAPIRefResolver {
  private options: RefResolverOptions;
  private cache = new Map<string, any>();
  private resolving = new Set<string>();

  constructor(options: Partial<RefResolverOptions> = {}) {
    this.options = {
      baseDir: process.cwd(),
      maxDepth: 10,
      allowExternalUrls: false,
      cache: true,
      ...options
    };
  }

  /**
   * メインAPIスペックを解決
   */
  async resolveSpec(specPath: string): Promise<any> {
    const resolvedSpec = await this.resolveDocument(specPath);
    await this.resolveAllRefs(resolvedSpec, specPath, 0);
    return resolvedSpec;
  }

  /**
   * ドキュメントを読み込み
   */
  private async resolveDocument(filePath: string): Promise<any> {
    if (this.options.cache && this.cache.has(filePath)) {
      return JSON.parse(JSON.stringify(this.cache.get(filePath)));
    }

    let content: string;
    let document: any;

    try {
      if (this.isUrl(filePath)) {
        if (!this.options.allowExternalUrls) {
          throw new Error(`External URLs not allowed: ${filePath}`);
        }
        content = await this.fetchUrl(filePath);
      } else {
        const absolutePath = path.resolve(this.options.baseDir, filePath);
        content = fs.readFileSync(absolutePath, 'utf8');
      }

      // YAML or JSON解析
      if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
        document = yaml.load(content);
      } else {
        document = JSON.parse(content);
      }

      if (this.options.cache) {
        this.cache.set(filePath, document);
      }

      return document;
    } catch (error) {
      throw new Error(`Failed to resolve document: ${filePath} - ${error.message}`);
    }
  }

  /**
   * 全ての$ref参照を再帰的に解決
   */
  private async resolveAllRefs(obj: any, basePath: string, depth: number): Promise<void> {
    if (depth > this.options.maxDepth) {
      throw new Error(`Maximum reference depth exceeded: ${this.options.maxDepth}`);
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        await this.resolveAllRefs(item, basePath, depth);
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
          const resolved = await this.resolveRef(value, basePath, depth);
          Object.assign(obj, resolved);
          delete obj.$ref;
        } else {
          await this.resolveAllRefs(value, basePath, depth);
        }
      }
    }
  }

  /**
   * 単一の$ref参照を解決
   */
  private async resolveRef(ref: string, basePath: string, depth: number): Promise<any> {
    // 循環参照チェック
    const refKey = `${basePath}#${ref}`;
    if (this.resolving.has(refKey)) {
      throw new Error(`Circular reference detected: ${ref}`);
    }

    this.resolving.add(refKey);

    try {
      const { filePath, pointer } = this.parseRef(ref, basePath);
      const document = await this.resolveDocument(filePath);
      
      let resolved: any;
      if (pointer) {
        resolved = this.resolvePointer(document, pointer);
      } else {
        resolved = document;
      }

      // 解決されたオブジェクト内の参照も再帰的に解決
      const cloned = JSON.parse(JSON.stringify(resolved));
      await this.resolveAllRefs(cloned, filePath, depth + 1);

      return cloned;
    } finally {
      this.resolving.delete(refKey);
    }
  }

  /**
   * $ref文字列を解析してファイルパスとJSONポインターに分割
   */
  private parseRef(ref: string, basePath: string): { filePath: string; pointer?: string } {
    const [filePart, pointerPart] = ref.split('#');

    let filePath: string;
    if (filePart === '') {
      // 同一ファイル内参照
      filePath = basePath;
    } else if (this.isUrl(filePart)) {
      // 外部URL参照
      filePath = filePart;
    } else {
      // 相対パス参照
      const baseDir = path.dirname(basePath);
      filePath = path.resolve(baseDir, filePart);
    }

    return {
      filePath,
      pointer: pointerPart || undefined
    };
  }

  /**
   * JSONポインターを使ってオブジェクトの値を取得
   */
  private resolvePointer(obj: any, pointer: string): any {
    if (!pointer || pointer === '/') {
      return obj;
    }

    const parts = pointer.split('/').slice(1); // 最初の空文字を除去
    let current = obj;

    for (const part of parts) {
      const decodedPart = decodeURIComponent(part.replace(/~1/g, '/').replace(/~0/g, '~'));
      
      if (current === null || current === undefined) {
        throw new Error(`Cannot resolve pointer: ${pointer}`);
      }

      if (Array.isArray(current)) {
        const index = parseInt(decodedPart, 10);
        if (isNaN(index) || index >= current.length) {
          throw new Error(`Invalid array index in pointer: ${pointer}`);
        }
        current = current[index];
      } else if (typeof current === 'object') {
        current = current[decodedPart];
      } else {
        throw new Error(`Cannot resolve pointer: ${pointer}`);
      }
    }

    return current;
  }

  /**
   * URL判定
   */
  private isUrl(str: string): boolean {
    try {
      new URL(str);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 外部URL取得
   */
  private async fetchUrl(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  }

  /**
   * キャッシュクリア
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// 使用例
const resolver = new OpenAPIRefResolver({
  baseDir: './api-spec',
  maxDepth: 20,
  allowExternalUrls: true,
  cache: true
});

const resolvedSpec = await resolver.resolveSpec('./openapi.yaml');
console.log('Resolved OpenAPI spec:', JSON.stringify(resolvedSpec, null, 2));
```

### 2. バリデーション機能

```typescript
export class RefValidator {
  
  /**
   * 参照の整合性をチェック
   */
  static async validateRefs(specPath: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const resolver = new OpenAPIRefResolver();
    
    try {
      await resolver.resolveSpec(specPath);
      results.push({
        type: 'success',
        message: 'All references resolved successfully'
      });
    } catch (error) {
      results.push({
        type: 'error',
        message: error.message,
        ref: error.ref
      });
    }

    return results;
  }

  /**
   * デッドリンクチェック
   */
  static async checkDeadLinks(specDir: string): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const files = this.getAllSpecFiles(specDir);
    const refs = new Set<string>();

    // 全てのファイルから$ref参照を抽出
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const document = yaml.load(content);
      this.extractRefs(document, refs);
    }

    // 各参照が解決可能かチェック
    for (const ref of refs) {
      try {
        const resolver = new OpenAPIRefResolver({ baseDir: specDir });
        await resolver.resolveRef(ref, specDir, 0);
      } catch (error) {
        results.push({
          type: 'error',
          message: `Dead reference: ${ref}`,
          ref
        });
      }
    }

    return results;
  }

  /**
   * 循環参照チェック
   */
  static detectCircularRefs(document: any): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const circular: string[] = [];

    function visit(obj: any, path: string = ''): void {
      if (visited.has(path)) return;
      
      if (recursionStack.has(path)) {
        circular.push(path);
        return;
      }

      visited.add(path);
      recursionStack.add(path);

      if (obj && typeof obj === 'object') {
        if (obj.$ref) {
          visit(obj.$ref, `${path}.$ref`);
        } else {
          for (const [key, value] of Object.entries(obj)) {
            visit(value, path ? `${path}.${key}` : key);
          }
        }
      }

      recursionStack.delete(path);
    }

    visit(document);
    return circular;
  }

  private static extractRefs(obj: any, refs: Set<string>): void {
    if (Array.isArray(obj)) {
      for (const item of obj) {
        this.extractRefs(item, refs);
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        if (key === '$ref' && typeof value === 'string') {
          refs.add(value);
        } else {
          this.extractRefs(value, refs);
        }
      }
    }
  }

  private static getAllSpecFiles(dir: string): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...this.getAllSpecFiles(fullPath));
      } else if (item.name.endsWith('.yaml') || item.name.endsWith('.yml') || item.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }

    return files;
  }
}

interface ValidationResult {
  type: 'success' | 'warning' | 'error';
  message: string;
  ref?: string;
  line?: number;
  column?: number;
}
```

### 3. ビルド・バンドル機能

```typescript
export class OpenAPIBundler {

  /**
   * 全ての外部参照を解決して単一ファイルにバンドル
   */
  static async bundle(specPath: string, outputPath: string): Promise<void> {
    const resolver = new OpenAPIRefResolver({
      baseDir: path.dirname(specPath),
      cache: true
    });

    const resolvedSpec = await resolver.resolveSpec(specPath);
    
    // バンドル情報を追加
    resolvedSpec['x-bundle-info'] = {
      bundledAt: new Date().toISOString(),
      originalFiles: await this.getFileList(path.dirname(specPath))
    };

    // 出力
    const output = yaml.dump(resolvedSpec, {
      indent: 2,
      lineWidth: 120,
      noRefs: false
    });

    fs.writeFileSync(outputPath, output, 'utf8');
    console.log(`Bundled OpenAPI spec written to: ${outputPath}`);
  }

  /**
   * 分割されたファイルから単一の参照済みスペックを生成
   */
  static async createStandaloneSpec(specPath: string): Promise<any> {
    const resolver = new OpenAPIRefResolver({
      baseDir: path.dirname(specPath)
    });

    return await resolver.resolveSpec(specPath);
  }

  /**
   * ファイル一覧取得
   */
  private static async getFileList(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(currentDir: string): Promise<void> {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item.name);
        const relativePath = path.relative(dir, fullPath);
        
        if (item.isDirectory()) {
          await scan(fullPath);
        } else if (item.name.endsWith('.yaml') || item.name.endsWith('.yml')) {
          files.push(relativePath);
        }
      }
    }

    await scan(dir);
    return files.sort();
  }
}

// CLI使用例
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node bundler.js <input-spec> <output-file>');
    process.exit(1);
  }

  const [inputSpec, outputFile] = args;
  
  OpenAPIBundler.bundle(inputSpec, outputFile)
    .then(() => console.log('Bundle completed successfully'))
    .catch(error => {
      console.error('Bundle failed:', error.message);
      process.exit(1);
    });
}
```

## 開発ツール・ワークフロー

### 1. 参照チェックスクリプト

```bash
#!/bin/bash
# check-refs.sh - 参照整合性チェックスクリプト

set -e

SPEC_DIR="./api-spec"
MAIN_SPEC="$SPEC_DIR/openapi.yaml"

echo "🔍 Checking OpenAPI reference integrity..."

# 参照解決テスト
echo "📋 Testing reference resolution..."
node scripts/validate-refs.js "$MAIN_SPEC"

# デッドリンクチェック
echo "🔗 Checking for dead references..."
node scripts/check-dead-links.js "$SPEC_DIR"

# 循環参照チェック
echo "🔄 Checking for circular references..."
node scripts/check-circular-refs.js "$MAIN_SPEC"

# バンドルテスト
echo "📦 Testing bundle generation..."
node scripts/bundle.js "$MAIN_SPEC" "./dist/openapi-bundled.yaml"

# ドキュメント生成テスト
echo "📚 Testing documentation generation..."
npx @redocly/cli build-docs "$MAIN_SPEC" --output "./dist/docs/index.html"

echo "✅ All reference checks passed!"
```

### 2. Watch機能付き開発サーバー

```typescript
import { watch } from 'chokidar';
import { OpenAPIRefResolver } from './ref-resolver';

export class OpenAPIDevServer {
  private resolver: OpenAPIRefResolver;
  private specPath: string;
  private watchers = new Map<string, any>();

  constructor(specPath: string) {
    this.specPath = specPath;
    this.resolver = new OpenAPIRefResolver({
      baseDir: path.dirname(specPath)
    });
  }

  /**
   * 開発サーバー開始
   */
  async start(): Promise<void> {
    console.log('🚀 Starting OpenAPI development server...');

    // 初期バリデーション
    await this.validateAndBundle();

    // ファイル監視開始
    this.startWatching();

    console.log('👀 Watching for file changes...');
    console.log('📝 Edit your OpenAPI files and see real-time validation!');
  }

  /**
   * ファイル監視開始
   */
  private startWatching(): void {
    const specDir = path.dirname(this.specPath);
    
    const watcher = watch(`${specDir}/**/*.{yaml,yml,json}`, {
      ignoreInitial: true,
      persistent: true
    });

    watcher.on('change', async (filePath) => {
      console.log(`📝 File changed: ${path.relative(specDir, filePath)}`);
      await this.handleFileChange();
    });

    watcher.on('add', async (filePath) => {
      console.log(`➕ File added: ${path.relative(specDir, filePath)}`);
      await this.handleFileChange();
    });

    watcher.on('unlink', async (filePath) => {
      console.log(`❌ File removed: ${path.relative(specDir, filePath)}`);
      await this.handleFileChange();
    });

    this.watchers.set('main', watcher);
  }

  /**
   * ファイル変更処理
   */
  private async handleFileChange(): Promise<void> {
    try {
      // キャッシュクリア
      this.resolver.clearCache();

      // 再バリデーション
      await this.validateAndBundle();
      
      console.log('✅ Validation passed - Ready for development!');
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
    }
  }

  /**
   * バリデーションとバンドル
   */
  private async validateAndBundle(): Promise<void> {
    // 参照解決テスト
    const resolvedSpec = await this.resolver.resolveSpec(this.specPath);
    
    // バンドルファイル生成
    const bundlePath = './dist/openapi-dev.yaml';
    const bundleContent = yaml.dump(resolvedSpec, { indent: 2 });
    
    // ディレクトリ作成
    fs.mkdirSync(path.dirname(bundlePath), { recursive: true });
    fs.writeFileSync(bundlePath, bundleContent);

    console.log(`📦 Bundle updated: ${bundlePath}`);
  }

  /**
   * サーバー停止
   */
  stop(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    console.log('🛑 Development server stopped');
  }
}

// CLI起動
if (require.main === module) {
  const specPath = process.argv[2] || './api-spec/openapi.yaml';
  const server = new OpenAPIDevServer(specPath);

  server.start().catch(error => {
    console.error('Failed to start development server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down development server...');
    server.stop();
    process.exit(0);
  });
}
```

### 3. CI/CD統合

```yaml
# .github/workflows/openapi-validation.yml
name: OpenAPI Validation

on:
  push:
    paths:
      - 'api-spec/**'
  pull_request:
    paths:
      - 'api-spec/**'

jobs:
  validate-openapi:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Validate OpenAPI references
        run: |
          echo "🔍 Validating OpenAPI reference integrity..."
          npm run validate:refs

      - name: Check for dead references
        run: |
          echo "🔗 Checking for dead references..."
          npm run check:dead-links

      - name: Detect circular references
        run: |
          echo "🔄 Checking for circular references..."
          npm run check:circular-refs

      - name: Bundle OpenAPI spec
        run: |
          echo "📦 Creating bundled specification..."
          npm run bundle
          
      - name: Validate bundled spec
        run: |
          echo "✅ Validating bundled specification..."
          npx @apidevtools/swagger-parser validate ./dist/openapi-bundled.yaml

      - name: Generate documentation
        run: |
          echo "📚 Generating API documentation..."
          npm run docs:build

      - name: Upload bundle artifacts
        uses: actions/upload-artifact@v3
        with:
          name: openapi-bundle
          path: |
            dist/openapi-bundled.yaml
            dist/docs/

  lint-openapi:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v3

      - name: Lint OpenAPI spec
        uses: stoplightio/spectral-action@latest
        with:
          file_glob: 'api-spec/**/*.{yaml,yml}'
          spectral_ruleset: '.spectral.yml'
```

このOpenAPI外部参照システムにより、大規模API仕様を効率的に管理し、チーム開発での生産性を大幅に向上できます。