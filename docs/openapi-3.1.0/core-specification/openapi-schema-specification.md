# OpenAPIスキーマ定義仕様書

## 概要

このドキュメントは、OpenAPIスキーマの定義方法と本プロジェクトでの活用方法を詳細に説明します。Controller interfaceの実装からTypeScript API Clientの生成まで、一貫した開発フローを提供します。

## OpenAPIスキーマ基本構造

### 1. 基本情報定義

```yaml
openapi: 3.1.0
info:
  title: User Management API
  version: 1.0.0
  description: ユーザー管理システムのAPI仕様
  contact:
    name: API Support
    email: api-support@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com/v1
    description: Production server
  - url: https://staging-api.example.com/v1
    description: Staging server
```

### 2. コンポーネント定義

#### ユーザーエンティティスキーマ
```yaml
components:
  schemas:
    User:
      type: object
      required:
        - id
        - username
        - email
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
          $ref: '#/components/schemas/UserStatus'
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

    UserStatus:
      type: string
      enum:
        - active
        - inactive
        - suspended
      description: ユーザーのステータス
      example: "active"

    CreateUserRequest:
      type: object
      required:
        - username
        - email
        - firstName
        - lastName
      properties:
        username:
          type: string
          minLength: 3
          maxLength: 50
          pattern: '^[a-zA-Z0-9_]+$'
        email:
          type: string
          format: email
        firstName:
          type: string
          maxLength: 100
        lastName:
          type: string
          maxLength: 100
        age:
          type: integer
          minimum: 0
          maximum: 150

    UpdateUserRequest:
      type: object
      properties:
        firstName:
          type: string
          maxLength: 100
        lastName:
          type: string
          maxLength: 100
        age:
          type: integer
          minimum: 0
          maximum: 150
        status:
          $ref: '#/components/schemas/UserStatus'

    UserListResponse:
      type: object
      required:
        - users
        - pagination
      properties:
        users:
          type: array
          items:
            $ref: '#/components/schemas/User'
        pagination:
          $ref: '#/components/schemas/PaginationInfo'

    PaginationInfo:
      type: object
      required:
        - page
        - size
        - totalElements
        - totalPages
      properties:
        page:
          type: integer
          minimum: 0
          description: 現在のページ番号（0から開始）
          example: 0
        size:
          type: integer
          minimum: 1
          maximum: 100
          description: ページサイズ
          example: 20
        totalElements:
          type: integer
          minimum: 0
          description: 総要素数
          example: 150
        totalPages:
          type: integer
          minimum: 0
          description: 総ページ数
          example: 8

    ErrorResponse:
      type: object
      required:
        - error
        - message
        - timestamp
      properties:
        error:
          type: string
          description: エラーコード
          example: "USER_NOT_FOUND"
        message:
          type: string
          description: エラーメッセージ
          example: "指定されたユーザーが見つかりません"
        details:
          type: array
          items:
            type: string
          description: 詳細なエラー情報
        timestamp:
          type: string
          format: date-time
          description: エラー発生日時
          example: "2024-01-15T10:30:00Z"
```

### 3. API パス定義

```yaml
paths:
  /users:
    get:
      summary: ユーザー一覧取得
      description: 条件に基づいてユーザー一覧を取得します
      operationId: getUsers
      tags:
        - Users
      parameters:
        - name: page
          in: query
          description: ページ番号（0から開始）
          required: false
          schema:
            type: integer
            minimum: 0
            default: 0
        - name: size
          in: query
          description: ページサイズ
          required: false
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: status
          in: query
          description: ステータスでフィルタ
          required: false
          schema:
            $ref: '#/components/schemas/UserStatus'
        - name: search
          in: query
          description: ユーザー名または名前で検索
          required: false
          schema:
            type: string
            maxLength: 100
      responses:
        '200':
          description: ユーザー一覧取得成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserListResponse'
        '400':
          description: 不正なリクエスト
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: サーバーエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    post:
      summary: ユーザー作成
      description: 新しいユーザーを作成します
      operationId: createUser
      tags:
        - Users
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          description: ユーザー作成成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: 不正なリクエスト
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: ユーザー名またはメールアドレスが既に存在
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: サーバーエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /users/{userId}:
    get:
      summary: ユーザー詳細取得
      description: 指定されたIDのユーザー詳細を取得します
      operationId: getUserById
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          description: ユーザーID
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '200':
          description: ユーザー詳細取得成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: ユーザーが見つかりません
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: サーバーエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    put:
      summary: ユーザー更新
      description: 指定されたIDのユーザー情報を更新します
      operationId: updateUser
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          description: ユーザーID
          required: true
          schema:
            type: integer
            format: int64
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateUserRequest'
      responses:
        '200':
          description: ユーザー更新成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '400':
          description: 不正なリクエスト
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: ユーザーが見つかりません
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: サーバーエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

    delete:
      summary: ユーザー削除
      description: 指定されたIDのユーザーを削除します
      operationId: deleteUser
      tags:
        - Users
      parameters:
        - name: userId
          in: path
          description: ユーザーID
          required: true
          schema:
            type: integer
            format: int64
      responses:
        '204':
          description: ユーザー削除成功
        '404':
          description: ユーザーが見つかりません
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: サーバーエラー
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

## 高度なスキーマ機能

### 1. 組み合わせスキーマ（allOf, oneOf, anyOf）

```yaml
components:
  schemas:
    # 継承を表現する allOf
    AdminUser:
      allOf:
        - $ref: '#/components/schemas/User'
        - type: object
          properties:
            role:
              type: string
              enum: [admin, super_admin]
            permissions:
              type: array
              items:
                type: string

    # いずれか一つのタイプを表現する oneOf
    NotificationChannel:
      oneOf:
        - $ref: '#/components/schemas/EmailChannel'
        - $ref: '#/components/schemas/SmsChannel'
        - $ref: '#/components/schemas/PushChannel'
      discriminator:
        propertyName: type
        mapping:
          email: '#/components/schemas/EmailChannel'
          sms: '#/components/schemas/SmsChannel'
          push: '#/components/schemas/PushChannel'

    EmailChannel:
      type: object
      required: [type, email]
      properties:
        type:
          type: string
          enum: [email]
        email:
          type: string
          format: email

    SmsChannel:
      type: object
      required: [type, phoneNumber]
      properties:
        type:
          type: string
          enum: [sms]
        phoneNumber:
          type: string
          pattern: '^\+[1-9]\d{1,14}$'

    PushChannel:
      type: object
      required: [type, deviceId]
      properties:
        type:
          type: string
          enum: [push]
        deviceId:
          type: string
```

### 2. 条件付きスキーマ

```yaml
components:
  schemas:
    PaymentMethod:
      type: object
      required: [type]
      properties:
        type:
          type: string
          enum: [credit_card, bank_transfer, digital_wallet]
        
        # クレジットカードの場合のみ必要
        cardNumber:
          type: string
          pattern: '^[0-9]{13,19}$'
        expiryDate:
          type: string
          pattern: '^(0[1-9]|1[0-2])\/([0-9]{2})$'
        cvv:
          type: string
          pattern: '^[0-9]{3,4}$'
        
        # 銀行振込の場合のみ必要
        bankAccount:
          type: string
        routingNumber:
          type: string
        
        # デジタルウォレットの場合のみ必要
        walletId:
          type: string
        walletProvider:
          type: string
          enum: [paypal, applepay, googlepay]
      
      # 条件付きバリデーション
      if:
        properties:
          type:
            const: credit_card
      then:
        required: [cardNumber, expiryDate, cvv]
      else:
        if:
          properties:
            type:
              const: bank_transfer
        then:
          required: [bankAccount, routingNumber]
        else:
          required: [walletId, walletProvider]
```

### 3. カスタムバリデーション

```yaml
components:
  schemas:
    UserProfile:
      type: object
      properties:
        username:
          type: string
          minLength: 3
          maxLength: 50
          pattern: '^[a-zA-Z0-9_]+$'
          # カスタムバリデーション用の拡張
          x-validation:
            unique: true
            reserved-words: [admin, root, system]
        
        dateOfBirth:
          type: string
          format: date
          # カスタム制約
          x-validation:
            min-age: 13
            max-age: 120
        
        profileImage:
          type: string
          format: uri
          # ファイル形式制約
          x-validation:
            allowed-formats: [jpg, png, gif]
            max-size: 5242880  # 5MB
```

## セキュリティスキーマ

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT Bearer認証
    
    apiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: APIキー認証
    
    oauth2Auth:
      type: oauth2
      flows:
        authorizationCode:
          authorizationUrl: https://example.com/oauth/authorize
          tokenUrl: https://example.com/oauth/token
          scopes:
            read: データの読み取り
            write: データの書き込み
            admin: 管理者権限

# グローバルセキュリティ設定
security:
  - bearerAuth: []
  - apiKeyAuth: []

# パス固有のセキュリティ設定例
paths:
  /admin/users:
    get:
      security:
        - oauth2Auth: [admin]
      # ... other path details
```

## バリデーション仕様

### 1. 基本バリデーション

| 型 | バリデーション | 説明 | 例 |
|---|---|---|---|
| string | minLength, maxLength | 文字列長制限 | `minLength: 3, maxLength: 50` |
| string | pattern | 正規表現パターン | `pattern: '^[a-zA-Z0-9_]+$'` |
| string | format | 標準フォーマット | `format: email, date-time, uri` |
| integer | minimum, maximum | 数値範囲 | `minimum: 0, maximum: 150` |
| number | multipleOf | 倍数制限 | `multipleOf: 0.01` |
| array | minItems, maxItems | 配列長制限 | `minItems: 1, maxItems: 10` |
| array | uniqueItems | 重複禁止 | `uniqueItems: true` |
| object | required | 必須プロパティ | `required: [id, name]` |

### 2. カスタムフォーマット

```yaml
components:
  schemas:
    CustomFormats:
      type: object
      properties:
        # 日本の郵便番号
        postalCode:
          type: string
          pattern: '^[0-9]{3}-[0-9]{4}$'
          example: "123-4567"
        
        # 日本の電話番号
        phoneNumber:
          type: string
          pattern: '^(0[1-9]-?[0-9]{4}-?[0-9]{4}|0[1-9][0-9]-?[0-9]{3}-?[0-9]{4})$'
          example: "03-1234-5678"
        
        # クレジットカード番号（Luhnアルゴリズム考慮）
        creditCardNumber:
          type: string
          pattern: '^[0-9]{13,19}$'
          x-validation:
            luhn-check: true
```

## エラーハンドリング仕様

### 1. 標準エラーレスポンス

```yaml
components:
  schemas:
    ErrorResponse:
      type: object
      required:
        - error
        - message
        - timestamp
      properties:
        error:
          type: string
          description: エラーコード（機械可読）
          enum:
            - VALIDATION_ERROR
            - NOT_FOUND
            - UNAUTHORIZED
            - FORBIDDEN
            - INTERNAL_ERROR
        message:
          type: string
          description: エラーメッセージ（人間可読）
        details:
          type: array
          items:
            $ref: '#/components/schemas/ErrorDetail'
          description: 詳細なエラー情報
        timestamp:
          type: string
          format: date-time
          description: エラー発生日時
        traceId:
          type: string
          description: トレースID（デバッグ用）

    ErrorDetail:
      type: object
      required:
        - field
        - code
        - message
      properties:
        field:
          type: string
          description: エラーが発生したフィールド
        code:
          type: string
          description: フィールド固有のエラーコード
        message:
          type: string
          description: フィールド固有のエラーメッセージ
        rejectedValue:
          description: 拒否された値
```

### 2. バリデーションエラーの詳細化

```yaml
# 400 Bad Request時のレスポンス例
responses:
  '400':
    description: バリデーションエラー
    content:
      application/json:
        schema:
          $ref: '#/components/schemas/ErrorResponse'
        examples:
          validation_error:
            summary: バリデーションエラーの例
            value:
              error: "VALIDATION_ERROR"
              message: "入力データに問題があります"
              details:
                - field: "username"
                  code: "PATTERN_MISMATCH"
                  message: "ユーザー名は英数字とアンダースコアのみ使用可能です"
                  rejectedValue: "user-name!"
                - field: "age"
                  code: "OUT_OF_RANGE"
                  message: "年齢は0以上150以下である必要があります"
                  rejectedValue: 200
              timestamp: "2024-01-15T10:30:00Z"
              traceId: "abc123def456"
```

## ドキュメント生成設定

```yaml
# OpenAPI拡張設定
x-documentation:
  title: "User Management API Documentation"
  description: |
    このAPIは、ユーザー管理システムのRESTful APIです。
    ユーザーの作成、更新、削除、検索機能を提供します。
  
  version: "1.0.0"
  contact:
    name: "Development Team"
    email: "dev-team@example.com"
    url: "https://example.com/support"
  
  # コード例の生成設定
  x-code-samples:
    - lang: "JavaScript"
      source: |
        // ユーザー一覧取得の例
        const response = await fetch('/api/v1/users?page=0&size=20');
        const users = await response.json();
    
    - lang: "Java"
      source: |
        // Spring Boot + RestTemplateの例
        ResponseEntity<UserListResponse> response = restTemplate.getForEntity(
            "/api/v1/users?page=0&size=20", 
            UserListResponse.class
        );
  
  # APIキーの取得方法
  x-api-key-instructions: |
    APIキーの取得方法：
    1. 開発者ポータルにログイン
    2. "API Keys" セクションに移動
    3. "新しいAPIキーを生成" をクリック
    4. 用途を説明して生成を完了
```

この仕様書は、OpenAPIスキーマの定義から実装まで、一貫した開発フローを提供する包括的なガイドです。次のセクションでは、これらのスキーマ定義がどのようにController interfaceとTypeScript API Clientに対応するかを説明します。