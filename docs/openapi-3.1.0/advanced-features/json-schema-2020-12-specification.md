# JSON Schema 2020-12 拡張機能完全対応仕様書

## 概要

OpenAPI 3.1.0はJSON Schema 2020-12をベースとしており、従来のDraft-07から大幅に機能が拡張されています。この文書では新機能の完全実装方法を詳細に説明します。

## JSON Schema 2020-12 主要新機能

### 1. 新しいキーワード一覧

| キーワード | 機能 | Draft-07からの変更 |
|-----------|------|-------------------|
| `$schema` | スキーマバージョン指定 | 2020-12対応 |
| `$vocabulary` | 語彙定義 | 新規追加 |
| `$dynamicRef` | 動的参照 | 新規追加 |
| `$dynamicAnchor` | 動的アンカー | 新規追加 |
| `$anchor` | 静的アンカー | `$id`の代替 |
| `unevaluatedProperties` | 未評価プロパティ制御 | 新規追加 |
| `unevaluatedItems` | 未評価アイテム制御 | 新規追加 |
| `prefixItems` | 配列先頭アイテム定義 | `items`の配列形式の代替 |
| `dependentRequired` | 依存必須プロパティ | `dependencies`の分割 |
| `dependentSchemas` | 依存スキーマ | `dependencies`の分割 |
| `maxContains` | 含有要素最大数 | `contains`の拡張 |
| `minContains` | 含有要素最小数 | `contains`の拡張 |

### 2. 基本実装例

```yaml
# JSON Schema 2020-12準拠のOpenAPIスキーマ
openapi: 3.1.0
info:
  title: JSON Schema 2020-12 Demo API
  version: 1.0.0

components:
  schemas:
    # 基本的な2020-12機能を使用
    AdvancedUser:
      $schema: "https://json-schema.org/draft/2020-12/schema"
      type: object
      required:
        - id
        - username
      properties:
        id:
          type: integer
          minimum: 1
        username:
          type: string
          minLength: 3
          maxLength: 50
        profile:
          $ref: "#/$defs/UserProfile"
        settings:
          $ref: "#/$defs/UserSettings"
        
      # 未評価プロパティを禁止
      unevaluatedProperties: false
      
      # 依存関係を定義
      dependentRequired:
        email: ["emailVerified"]
        phone: ["phoneVerified"]
      
      dependentSchemas:
        accountType:
          if:
            properties:
              accountType:
                const: "premium"
          then:
            required: ["billingAddress"]
            properties:
              billingAddress:
                $ref: "#/$defs/Address"

    # $defs を使用（$definitions の代替）
    $defs:
      UserProfile:
        type: object
        properties:
          firstName:
            type: string
          lastName:
            type: string
          avatar:
            type: string
            format: uri
        unevaluatedProperties: false

      UserSettings:
        type: object
        properties:
          theme:
            type: string
            enum: ["light", "dark", "auto"]
          notifications:
            $ref: "#/$defs/NotificationSettings"
        unevaluatedProperties: false

      NotificationSettings:
        type: object
        properties:
          email:
            type: boolean
            default: true
          push:
            type: boolean
            default: false
        unevaluatedProperties: false

      Address:
        type: object
        required:
          - country
          - postalCode
        properties:
          country:
            type: string
          postalCode:
            type: string
          city:
            type: string
          address1:
            type: string
          address2:
            type: string
        unevaluatedProperties: false
```

## 新機能詳細実装

### 1. prefixItems（配列先頭要素定義）

```yaml
components:
  schemas:
    # 座標系データ（先頭2要素は必須、3要素目以降は任意）
    Coordinate:
      type: array
      prefixItems:
        - type: number  # x座標（必須）
        - type: number  # y座標（必須）
      items:
        type: number    # z座標以降（任意）
      minItems: 2
      maxItems: 4
      examples:
        - [10.5, 20.3]           # 2D座標
        - [10.5, 20.3, 5.0]     # 3D座標
        - [10.5, 20.3, 5.0, 1.0] # 4D座標

    # レコード形式データ（種類、値、タイムスタンプ）
    DataRecord:
      type: array
      prefixItems:
        - type: string    # データ種類
          enum: ["temperature", "humidity", "pressure"]
        - type: number    # 測定値
          minimum: 0
        - type: string    # タイムスタンプ
          format: date-time
      items: false        # 追加要素を禁止
      examples:
        - ["temperature", 23.5, "2024-01-15T10:30:00Z"]
        - ["humidity", 65.2, "2024-01-15T10:30:00Z"]

    # 混合配列（ヘッダー + データ行）
    CsvData:
      type: array
      prefixItems:
        - type: array     # ヘッダー行
          items:
            type: string
      items:              # データ行
        type: array
        items:
          oneOf:
            - type: string
            - type: number
            - type: boolean
      examples:
        - [
            ["name", "age", "email"],           # ヘッダー
            ["John", 30, "john@example.com"],   # データ行1
            ["Alice", 25, "alice@example.com"]  # データ行2
          ]
```

### 2. unevaluatedProperties / unevaluatedItems

```yaml
components:
  schemas:
    # 基本ユーザー定義
    BaseUser:
      type: object
      properties:
        id:
          type: integer
        username:
          type: string
        email:
          type: string
          format: email

    # 拡張ユーザー（継承 + 追加制御）
    ExtendedUser:
      allOf:
        - $ref: "#/components/schemas/BaseUser"
        - type: object
          properties:
            profile:
              type: object
              properties:
                firstName:
                  type: string
                lastName:
                  type: string
              unevaluatedProperties: false  # profileには未定義プロパティ禁止
            
            preferences:
              type: object
              properties:
                theme:
                  type: string
                  enum: ["light", "dark"]
              additionalProperties:
                type: string  # preferencesには文字列の追加プロパティ許可
      
      # ExtendedUser全体では未評価プロパティを禁止
      unevaluatedProperties: false

    # 動的配列制御
    FlexibleArray:
      type: array
      prefixItems:
        - type: string    # 最初は必ず文字列
        - type: number    # 次は必ず数値
      items:
        type: object      # 3要素目以降はオブジェクト
        properties:
          type:
            type: string
          value:
            type: string
        required: ["type", "value"]
      
      # 未評価アイテムは禁止
      unevaluatedItems: false
      
      examples:
        - ["header", 123, {"type": "data", "value": "test"}]

    # 条件付き unevaluatedProperties
    ConditionalSchema:
      type: object
      properties:
        type:
          type: string
          enum: ["basic", "advanced"]
        name:
          type: string

      if:
        properties:
          type:
            const: "advanced"
      then:
        properties:
          advancedConfig:
            type: object
            properties:
              level:
                type: integer
              features:
                type: array
                items:
                  type: string
        required: ["advancedConfig"]
      
      # if-then で定義されていないプロパティは禁止
      unevaluatedProperties: false
```

### 3. dependentRequired / dependentSchemas

```yaml
components:
  schemas:
    # 支払い方法の依存関係
    PaymentMethod:
      type: object
      properties:
        type:
          type: string
          enum: ["credit_card", "bank_transfer", "digital_wallet"]
        
        # クレジットカード情報
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
        cvv:
          type: string
          pattern: '^[0-9]{3,4}$'
        
        # 銀行振込情報
        bankCode:
          type: string
          pattern: '^[0-9]{4}$'
        accountNumber:
          type: string
        accountHolder:
          type: string
        
        # デジタルウォレット情報
        walletProvider:
          type: string
          enum: ["paypal", "applepay", "googlepay"]
        walletId:
          type: string

      # 依存必須プロパティ
      dependentRequired:
        cardNumber: ["expiryMonth", "expiryYear", "cvv"]
        bankCode: ["accountNumber", "accountHolder"]
        walletProvider: ["walletId"]

      # 依存スキーマ
      dependentSchemas:
        type:
          if:
            properties:
              type:
                const: "credit_card"
          then:
            required: ["cardNumber", "expiryMonth", "expiryYear", "cvv"]
            not:
              anyOf:
                - required: ["bankCode"]
                - required: ["walletProvider"]
          else:
            if:
              properties:
                type:
                  const: "bank_transfer"
            then:
              required: ["bankCode", "accountNumber", "accountHolder"]
              not:
                anyOf:
                  - required: ["cardNumber"]
                  - required: ["walletProvider"]
            else:
              if:
                properties:
                  type:
                    const: "digital_wallet"
              then:
                required: ["walletProvider", "walletId"]
                not:
                  anyOf:
                    - required: ["cardNumber"]
                    - required: ["bankCode"]

    # ユーザー登録の依存関係
    UserRegistration:
      type: object
      required:
        - username
        - email
      properties:
        username:
          type: string
          minLength: 3
        email:
          type: string
          format: email
        
        # 企業ユーザー関連
        isCompanyUser:
          type: boolean
        companyName:
          type: string
        companyTaxId:
          type: string
        
        # 年齢確認関連
        age:
          type: integer
          minimum: 0
          maximum: 150
        ageVerificationMethod:
          type: string
          enum: ["id_document", "credit_card", "phone_verification"]
        
        # 二要素認証
        enableTwoFactor:
          type: boolean
        phoneNumber:
          type: string
          pattern: '^\+[1-9]\d{1,14}$'

      # 企業ユーザーの場合は企業情報が必要
      dependentRequired:
        isCompanyUser: ["companyName"]
        companyName: ["companyTaxId"]
        enableTwoFactor: ["phoneNumber"]

      # 年齢に基づく追加バリデーション
      dependentSchemas:
        age:
          if:
            properties:
              age:
                minimum: 18
          then:
            # 18歳以上は年齢確認方法が必要
            required: ["ageVerificationMethod"]
          else:
            # 18歳未満は特別な制限
            properties:
              parentalConsent:
                type: boolean
                const: true
            required: ["parentalConsent"]
```

### 4. maxContains / minContains

```yaml
components:
  schemas:
    # タグ付きコンテンツ
    TaggedContent:
      type: array
      items:
        oneOf:
          - type: object
            properties:
              type:
                const: "text"
              content:
                type: string
            required: ["type", "content"]
          
          - type: object
            properties:
              type:
                const: "image"
              src:
                type: string
                format: uri
              alt:
                type: string
            required: ["type", "src"]
          
          - type: object
            properties:
              type:
                const: "video"
              src:
                type: string
                format: uri
              duration:
                type: integer
            required: ["type", "src"]

      # 画像は最低1つ、最大5つまで
      contains:
        properties:
          type:
            const: "image"
      minContains: 1
      maxContains: 5

      # 全体の要素数制限
      minItems: 2
      maxItems: 20

      examples:
        - [
            {"type": "text", "content": "記事の説明"},
            {"type": "image", "src": "https://example.com/img1.jpg", "alt": "画像1"},
            {"type": "text", "content": "続きの説明"},
            {"type": "image", "src": "https://example.com/img2.jpg", "alt": "画像2"}
          ]

    # 権限システム
    PermissionSet:
      type: array
      items:
        type: object
        properties:
          resource:
            type: string
          actions:
            type: array
            items:
              type: string
              enum: ["read", "write", "delete", "admin"]
        required: ["resource", "actions"]

      # 管理者権限は最大1つまで
      contains:
        properties:
          actions:
            contains:
              const: "admin"
      maxContains: 1

      # 読み取り権限は最低1つ必要
      contains:
        properties:
          actions:
            contains:
              const: "read"
      minContains: 1

      examples:
        - [
            {"resource": "users", "actions": ["read", "write"]},
            {"resource": "orders", "actions": ["read"]},
            {"resource": "system", "actions": ["read", "admin"]}
          ]

    # 多言語コンテンツ
    MultiLanguageContent:
      type: array
      items:
        type: object
        properties:
          language:
            type: string
            pattern: '^[a-z]{2}(-[A-Z]{2})?$'  # ISO 639-1 + ISO 3166-1
          title:
            type: string
          content:
            type: string
        required: ["language", "title", "content"]

      # 英語版は必須
      contains:
        properties:
          language:
            const: "en"
      minContains: 1
      maxContains: 1

      # 日本語版は任意だが、あれば1つまで
      contains:
        properties:
          language:
            const: "ja"
      maxContains: 1

      # 最低2言語、最大10言語
      minItems: 2
      maxItems: 10
```

### 5. $anchor と $dynamicRef

```yaml
components:
  schemas:
    # 基本ノードスキーマ（動的参照用）
    BaseNode:
      $anchor: "node"
      type: object
      properties:
        id:
          type: string
        type:
          type: string
        children:
          type: array
          items:
            $dynamicRef: "#node"  # 動的に解決される参照

    # ツリー構造（フォルダー）
    FolderNode:
      $dynamicAnchor: "node"
      allOf:
        - $ref: "#/components/schemas/BaseNode"
        - type: object
          properties:
            type:
              const: "folder"
            name:
              type: string
            permissions:
              type: object
              properties:
                read:
                  type: boolean
                write:
                  type: boolean

    # ファイルノード
    FileNode:
      $dynamicAnchor: "node"
      allOf:
        - $ref: "#/components/schemas/BaseNode"
        - type: object
          properties:
            type:
              const: "file"
            name:
              type: string
            size:
              type: integer
              minimum: 0
            mimeType:
              type: string
            children:
              maxItems: 0  # ファイルは子要素を持たない

    # 動的多態性の例
    Document:
      type: object
      properties:
        root:
          oneOf:
            - $ref: "#/components/schemas/FolderNode"
            - $ref: "#/components/schemas/FileNode"

      examples:
        - root:
            id: "root"
            type: "folder"
            name: "Documents"
            children:
              - id: "subfolder"
                type: "folder"
                name: "Projects"
                children:
                  - id: "file1"
                    type: "file"
                    name: "readme.txt"
                    size: 1024
                    mimeType: "text/plain"

    # レシピシステム（動的参照の実践例）
    Recipe:
      $anchor: "recipe"
      type: object
      properties:
        name:
          type: string
        ingredients:
          type: array
          items:
            $dynamicRef: "#ingredient"
        steps:
          type: array
          items:
            $dynamicRef: "#step"

    BasicIngredient:
      $dynamicAnchor: "ingredient"
      type: object
      properties:
        name:
          type: string
        amount:
          type: number
        unit:
          type: string

    AdvancedIngredient:
      $dynamicAnchor: "ingredient"
      allOf:
        - $ref: "#/components/schemas/BasicIngredient"
        - type: object
          properties:
            brand:
              type: string
            alternatives:
              type: array
              items:
                $dynamicRef: "#ingredient"  # 再帰的参照

    CookingStep:
      $dynamicAnchor: "step"
      type: object
      properties:
        instruction:
          type: string
        duration:
          type: integer
        temperature:
          type: integer
        subRecipe:
          $dynamicRef: "#recipe"  # レシピ内レシピ
```

## 実装支援ツール

### 1. JSON Schema 2020-12 バリデーター

```typescript
import Ajv from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

export class JsonSchema2020Validator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({
      strict: false,
      allErrors: true,
      verbose: true,
      // 2020-12固有の設定
      discriminator: true,
      unicodeRegExp: false,
      // 新機能を有効化
      dynamicRef: true,
      next: true
    });

    // フォーマット追加
    addFormats(this.ajv);
    
    // カスタムフォーマット追加
    this.addCustomFormats();
  }

  /**
   * スキーマをコンパイル
   */
  compileSchema(schema: any): ValidateFunction {
    try {
      return this.ajv.compile(schema);
    } catch (error) {
      throw new Error(`Schema compilation failed: ${error.message}`);
    }
  }

  /**
   * データをバリデーション
   */
  validate(schema: any, data: any): ValidationResult {
    const validateFn = this.compileSchema(schema);
    const isValid = validateFn(data);

    return {
      valid: isValid,
      errors: isValid ? [] : validateFn.errors || [],
      data
    };
  }

  /**
   * バッチバリデーション
   */
  validateBatch(schema: any, dataArray: any[]): ValidationResult[] {
    const validateFn = this.compileSchema(schema);
    
    return dataArray.map((data, index) => {
      const isValid = validateFn(data);
      return {
        valid: isValid,
        errors: isValid ? [] : validateFn.errors || [],
        data,
        index
      };
    });
  }

  /**
   * スキーマ内の$dynamicRef を解決
   */
  resolveDynamicRefs(schema: any): any {
    // Ajvが自動的に処理するため、特別な処理は不要
    // ただし、カスタムリゾルバーが必要な場合はここで実装
    return schema;
  }

  /**
   * カスタムフォーマットを追加
   */
  private addCustomFormats(): void {
    // 日本の郵便番号
    this.ajv.addFormat('jp-postal-code', {
      type: 'string',
      validate: (data: string) => /^[0-9]{3}-[0-9]{4}$/.test(data)
    });

    // 日本の電話番号
    this.ajv.addFormat('jp-phone', {
      type: 'string',
      validate: (data: string) => /^0\d{1,4}-\d{1,4}-\d{4}$/.test(data)
    });

    // クレジットカード番号（Luhnアルゴリズム）
    this.ajv.addFormat('credit-card', {
      type: 'string',
      validate: (data: string) => {
        const digits = data.replace(/\D/g, '');
        return digits.length >= 13 && digits.length <= 19 && this.luhnCheck(digits);
      }
    });

    // IPv6アドレス（より厳密）
    this.ajv.addFormat('ipv6-strict', {
      type: 'string',
      validate: (data: string) => {
        // RFC 5952に準拠した厳密なIPv6バリデーション
        const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
        return ipv6Regex.test(data);
      }
    });
  }

  /**
   * Luhnアルゴリズムチェック
   */
  private luhnCheck(digits: string): boolean {
    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits[i], 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  /**
   * エラーメッセージを人間可読形式に変換
   */
  formatErrors(errors: any[]): string[] {
    return errors.map(error => {
      const path = error.instancePath || error.dataPath || '';
      const message = error.message || 'Unknown error';
      
      switch (error.keyword) {
        case 'unevaluatedProperties':
          return `Property '${error.params?.unevaluatedProperty}' is not allowed at ${path}`;
        case 'unevaluatedItems':
          return `Additional items are not allowed at ${path}`;
        case 'dependentRequired':
          return `Missing required property '${error.params?.missingProperty}' when '${error.params?.property}' is present at ${path}`;
        case 'prefixItems':
          return `Item at position ${error.params?.position} does not match required schema at ${path}`;
        case 'contains':
          return `Array must contain ${error.params?.minContains || 1} to ${error.params?.maxContains || 'unlimited'} items matching the schema at ${path}`;
        default:
          return `${path}: ${message}`;
      }
    });
  }
}

interface ValidationResult {
  valid: boolean;
  errors: any[];
  data: any;
  index?: number;
}

// 使用例
const validator = new JsonSchema2020Validator();

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  properties: {
    name: { type: "string" },
    email: { type: "string", format: "email" },
    profile: {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 0 }
      },
      unevaluatedProperties: false
    }
  },
  required: ["name", "email"],
  unevaluatedProperties: false
};

const testData = {
  name: "John Doe",
  email: "john@example.com",
  profile: {
    age: 30,
    invalidProp: "should cause error"  // unevaluatedProperties違反
  },
  extraProp: "also invalid"  // unevaluatedProperties違反
};

const result = validator.validate(schema, testData);
console.log('Valid:', result.valid);
console.log('Errors:', validator.formatErrors(result.errors));
```

### 2. スキーマ移行ツール

```typescript
export class JsonSchemaMigrator {
  
  /**
   * Draft-07からDraft 2020-12に移行
   */
  static migrateToDraft202012(draft07Schema: any): any {
    const migrated = JSON.parse(JSON.stringify(draft07Schema));

    // $schemaを更新
    migrated.$schema = "https://json-schema.org/draft/2020-12/schema";

    // $definitionsを$defsに変更
    if (migrated.definitions) {
      migrated.$defs = migrated.definitions;
      delete migrated.definitions;
    }

    // items配列をprefixItemsに変更
    this.migrateItemsArray(migrated);

    // dependenciesを分割
    this.migrateDependencies(migrated);

    // 未評価プロパティ制御を追加（オプション）
    this.addUnevaluatedControls(migrated);

    return migrated;
  }

  /**
   * items配列をprefixItemsに変更
   */
  private static migrateItemsArray(schema: any): void {
    if (schema && typeof schema === 'object') {
      if (Array.isArray(schema.items)) {
        // items配列をprefixItemsに変換
        schema.prefixItems = schema.items;
        
        if (schema.additionalItems !== undefined) {
          schema.items = schema.additionalItems;
          delete schema.additionalItems;
        } else {
          schema.items = true;  // デフォルトで追加アイテムを許可
        }
      }

      // 再帰的に処理
      for (const value of Object.values(schema)) {
        this.migrateItemsArray(value);
      }
    }
  }

  /**
   * dependenciesを分割
   */
  private static migrateDependencies(schema: any): void {
    if (schema && typeof schema === 'object') {
      if (schema.dependencies) {
        const dependentRequired: any = {};
        const dependentSchemas: any = {};

        for (const [key, value] of Object.entries(schema.dependencies)) {
          if (Array.isArray(value)) {
            // 配列の場合はdependentRequired
            dependentRequired[key] = value;
          } else {
            // オブジェクトの場合はdependentSchemas
            dependentSchemas[key] = value;
          }
        }

        if (Object.keys(dependentRequired).length > 0) {
          schema.dependentRequired = dependentRequired;
        }
        if (Object.keys(dependentSchemas).length > 0) {
          schema.dependentSchemas = dependentSchemas;
        }

        delete schema.dependencies;
      }

      // 再帰的に処理
      for (const value of Object.values(schema)) {
        this.migrateDependencies(value);
      }
    }
  }

  /**
   * 未評価プロパティ制御を追加
   */
  private static addUnevaluatedControls(schema: any): void {
    if (schema && typeof schema === 'object' && schema.type === 'object') {
      // additionalPropertiesがfalseの場合、unevaluatedPropertiesもfalseに
      if (schema.additionalProperties === false) {
        schema.unevaluatedProperties = false;
      }

      // 配列の場合も同様
      if (schema.type === 'array' && schema.additionalItems === false) {
        schema.unevaluatedItems = false;
      }

      // 再帰的に処理
      for (const value of Object.values(schema)) {
        this.addUnevaluatedControls(value);
      }
    }
  }

  /**
   * 移行レポート生成
   */
  static generateMigrationReport(original: any, migrated: any): MigrationReport {
    const changes: string[] = [];

    // $schema変更
    if (original.$schema !== migrated.$schema) {
      changes.push(`Updated $schema from ${original.$schema} to ${migrated.$schema}`);
    }

    // $definitions → $defs
    if (original.definitions && migrated.$defs) {
      changes.push('Migrated $definitions to $defs');
    }

    // items配列 → prefixItems
    const itemsChanges = this.countItemsMigrations(original);
    if (itemsChanges > 0) {
      changes.push(`Migrated ${itemsChanges} items arrays to prefixItems`);
    }

    // dependencies分割
    const depChanges = this.countDependenciesMigrations(original);
    if (depChanges > 0) {
      changes.push(`Split ${depChanges} dependencies into dependentRequired/dependentSchemas`);
    }

    return {
      changesCount: changes.length,
      changes,
      original,
      migrated,
      warnings: this.generateWarnings(original, migrated)
    };
  }

  private static countItemsMigrations(schema: any): number {
    let count = 0;
    
    function traverse(obj: any): void {
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj.items)) {
          count++;
        }
        for (const value of Object.values(obj)) {
          traverse(value);
        }
      }
    }

    traverse(schema);
    return count;
  }

  private static countDependenciesMigrations(schema: any): number {
    let count = 0;
    
    function traverse(obj: any): void {
      if (obj && typeof obj === 'object') {
        if (obj.dependencies) {
          count++;
        }
        for (const value of Object.values(obj)) {
          traverse(value);
        }
      }
    }

    traverse(schema);
    return count;
  }

  private static generateWarnings(original: any, migrated: any): string[] {
    const warnings: string[] = [];

    // 潜在的な破壊的変更を検出
    if (this.hasComplexDependencies(original)) {
      warnings.push('Complex dependencies detected - manual review recommended');
    }

    if (this.hasCustomKeywords(original)) {
      warnings.push('Custom keywords detected - compatibility check required');
    }

    return warnings;
  }

  private static hasComplexDependencies(schema: any): boolean {
    // 複雑な依存関係パターンを検出
    return false; // 実装は省略
  }

  private static hasCustomKeywords(schema: any): boolean {
    // カスタムキーワードを検出
    return false; // 実装は省略
  }
}

interface MigrationReport {
  changesCount: number;
  changes: string[];
  original: any;
  migrated: any;
  warnings: string[];
}

// 使用例
const draft07Schema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  definitions: {
    User: {
      type: "object",
      properties: {
        name: { type: "string" }
      }
    }
  },
  properties: {
    users: {
      type: "array",
      items: [
        { type: "string" },  // ヘッダー
        { $ref: "#/definitions/User" }  // データ
      ],
      additionalItems: { $ref: "#/definitions/User" }
    }
  },
  dependencies: {
    email: ["emailVerified"],
    creditCard: {
      properties: {
        billingAddress: { type: "string" }
      },
      required: ["billingAddress"]
    }
  }
};

const migratedSchema = JsonSchemaMigrator.migrateToDraft202012(draft07Schema);
const report = JsonSchemaMigrator.generateMigrationReport(draft07Schema, migratedSchema);

console.log('Migration report:', report);
```

この包括的なJSON Schema 2020-12実装により、OpenAPI 3.1.0の新機能を最大限活用し、より厳密で表現力豊かなAPI仕様を作成できます。