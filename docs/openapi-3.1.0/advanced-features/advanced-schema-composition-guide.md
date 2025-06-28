# 高度な組み合わせスキーマ（allOf/oneOf/anyOf）完全実装ガイド

## 概要

OpenAPIの組み合わせスキーマは、複雑なデータ構造とポリモーフィズムを表現する強力な機能です。この文書では、allOf、oneOf、anyOfの高度な実装パターンから、discriminator、継承、動的バリデーションまで包括的に説明します。

## 基本概念

### 1. 組み合わせキーワードの違い

| キーワード | 条件 | 用途 | 例 |
|-----------|------|------|-----|
| `allOf` | **全ての**サブスキーマを満たす | 継承、プロパティ拡張 | 基本ユーザー + 管理者権限 |
| `oneOf` | **いずれか1つの**サブスキーマを満たす | 排他的選択、ユニオン型 | 決済方法（カード OR 銀行振込） |
| `anyOf` | **1つ以上の**サブスキーマを満たす | 複数条件、部分一致 | 複数認証方式の組み合わせ |

### 2. 基本実装例

```yaml
components:
  schemas:
    # allOf - 継承とプロパティ拡張
    AdminUser:
      allOf:
        - $ref: '#/components/schemas/BaseUser'  # 基本プロパティを継承
        - type: object
          properties:
            role:
              type: string
              enum: ["admin", "super_admin"]
            permissions:
              type: array
              items:
                type: string
            lastAdminAction:
              type: string
              format: date-time
          required: ["role", "permissions"]

    # oneOf - 排他的な選択
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

    # anyOf - 複数条件の組み合わせ
    ContactInfo:
      anyOf:
        - required: ["email"]      # メールアドレスは必須
        - required: ["phone"]      # または電話番号は必須
        - required: ["address"]    # または住所は必須
      properties:
        email:
          type: string
          format: email
        phone:
          type: string
          pattern: '^[\+]?[0-9\-\s\(\)]+$'
        address:
          $ref: '#/components/schemas/Address'
        socialMedia:
          type: object
          properties:
            twitter:
              type: string
            linkedin:
              type: string
```

## 高度な継承パターン（allOf）

### 1. 多層継承

```yaml
components:
  schemas:
    # ベースエンティティ
    BaseEntity:
      type: object
      required:
        - id
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
          format: uuid
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
        version:
          type: integer
          minimum: 1
          description: 楽観的ロック用バージョン

    # 監査可能エンティティ
    AuditableEntity:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          properties:
            createdBy:
              type: string
              description: 作成者ID
            updatedBy:
              type: string
              description: 更新者ID
            deletedAt:
              type: string
              format: date-time
              description: 論理削除日時
            deletedBy:
              type: string
              description: 削除者ID

    # 所有可能エンティティ
    OwnableEntity:
      allOf:
        - $ref: '#/components/schemas/AuditableEntity'
        - type: object
          required:
            - ownerId
          properties:
            ownerId:
              type: string
              description: 所有者ID
            ownerType:
              type: string
              enum: ["user", "organization", "system"]
              description: 所有者タイプ
            visibility:
              type: string
              enum: ["private", "internal", "public"]
              default: "private"

    # 具体的なドキュメントエンティティ
    Document:
      allOf:
        - $ref: '#/components/schemas/OwnableEntity'
        - type: object
          required:
            - title
            - content
          properties:
            title:
              type: string
              maxLength: 255
            content:
              type: string
            contentType:
              type: string
              enum: ["text/plain", "text/markdown", "text/html"]
              default: "text/markdown"
            tags:
              type: array
              items:
                type: string
              maxItems: 10
            attachments:
              type: array
              items:
                $ref: '#/components/schemas/Attachment'
            collaborators:
              type: array
              items:
                $ref: '#/components/schemas/Collaborator'

    # 高度な条件付き継承
    EnhancedDocument:
      allOf:
        - $ref: '#/components/schemas/Document'
        - if:
            properties:
              contentType:
                const: "text/html"
          then:
            properties:
              htmlMetadata:
                type: object
                properties:
                  css:
                    type: array
                    items:
                      type: string
                      format: uri
                  javascript:
                    type: array
                    items:
                      type: string
                      format: uri
                  seoTags:
                    type: object
                    properties:
                      title:
                        type: string
                      description:
                        type: string
                      keywords:
                        type: array
                        items:
                          type: string
        - if:
            properties:
              visibility:
                const: "public"
          then:
            properties:
              publicMetadata:
                type: object
                required:
                  - publishedAt
                properties:
                  publishedAt:
                    type: string
                    format: date-time
                  featuredImage:
                    type: string
                    format: uri
                  summary:
                    type: string
                    maxLength: 500
```

### 2. ミックスイン・パターン

```yaml
components:
  schemas:
    # 機能ミックスイン
    Timestampable:
      type: object
      properties:
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    Taggable:
      type: object
      properties:
        tags:
          type: array
          items:
            type: string
          uniqueItems: true

    Searchable:
      type: object
      properties:
        searchKeywords:
          type: array
          items:
            type: string
        searchScore:
          type: number
          minimum: 0
          maximum: 1

    Cacheable:
      type: object
      properties:
        cacheKey:
          type: string
        cacheTTL:
          type: integer
          minimum: 0
        lastCachedAt:
          type: string
          format: date-time

    # 複数ミックスインの組み合わせ
    BlogPost:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - $ref: '#/components/schemas/Timestampable'
        - $ref: '#/components/schemas/Taggable'
        - $ref: '#/components/schemas/Searchable'
        - $ref: '#/components/schemas/Cacheable'
        - type: object
          required:
            - title
            - content
            - authorId
          properties:
            title:
              type: string
              maxLength: 255
            content:
              type: string
            authorId:
              type: string
            slug:
              type: string
              pattern: '^[a-z0-9\-]+$'
            status:
              type: string
              enum: ["draft", "published", "archived"]
            publishedAt:
              type: string
              format: date-time
            excerpt:
              type: string
              maxLength: 500
            readingTime:
              type: integer
              minimum: 1
              description: 読了時間（分）

    # 動的機能有効化
    ConfigurableEntity:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - if:
            properties:
              features:
                contains:
                  const: "timestampable"
          then:
            allOf:
              - $ref: '#/components/schemas/Timestampable'
        - if:
            properties:
              features:
                contains:
                  const: "taggable"
          then:
            allOf:
              - $ref: '#/components/schemas/Taggable'
        - if:
            properties:
              features:
                contains:
                  const: "searchable"
          then:
            allOf:
              - $ref: '#/components/schemas/Searchable'
        - type: object
          properties:
            features:
              type: array
              items:
                type: string
                enum: ["timestampable", "taggable", "searchable", "cacheable"]
              uniqueItems: true
```

## 高度なポリモーフィズム（oneOf）

### 1. 複雑な discriminator パターン

```yaml
components:
  schemas:
    # イベントベースシステム
    Event:
      oneOf:
        - $ref: '#/components/schemas/UserEvent'
        - $ref: '#/components/schemas/SystemEvent'
        - $ref: '#/components/schemas/BusinessEvent'
        - $ref: '#/components/schemas/IntegrationEvent'
      discriminator:
        propertyName: eventType
        mapping:
          "user.created": '#/components/schemas/UserCreatedEvent'
          "user.updated": '#/components/schemas/UserUpdatedEvent'
          "user.deleted": '#/components/schemas/UserDeletedEvent'
          "system.startup": '#/components/schemas/SystemStartupEvent'
          "system.shutdown": '#/components/schemas/SystemShutdownEvent'
          "system.error": '#/components/schemas/SystemErrorEvent'
          "business.order.created": '#/components/schemas/OrderCreatedEvent'
          "business.payment.completed": '#/components/schemas/PaymentCompletedEvent'
          "integration.webhook.received": '#/components/schemas/WebhookReceivedEvent'

    # ベースイベント
    BaseEvent:
      type: object
      required:
        - eventId
        - eventType
        - timestamp
        - source
      properties:
        eventId:
          type: string
          format: uuid
        eventType:
          type: string
        timestamp:
          type: string
          format: date-time
        source:
          type: string
        correlationId:
          type: string
          format: uuid
        causationId:
          type: string
          format: uuid
        metadata:
          type: object
          additionalProperties: true

    # ユーザーイベント系
    UserEvent:
      allOf:
        - $ref: '#/components/schemas/BaseEvent'
        - type: object
          required:
            - userId
          properties:
            userId:
              type: string
            userEmail:
              type: string
              format: email

    UserCreatedEvent:
      allOf:
        - $ref: '#/components/schemas/UserEvent'
        - type: object
          properties:
            eventType:
              const: "user.created"
            data:
              type: object
              required:
                - username
                - email
                - registrationMethod
              properties:
                username:
                  type: string
                email:
                  type: string
                  format: email
                registrationMethod:
                  type: string
                  enum: ["email", "social", "invite"]
                profile:
                  type: object
                  properties:
                    firstName:
                      type: string
                    lastName:
                      type: string

    # システムイベント系
    SystemEvent:
      allOf:
        - $ref: '#/components/schemas/BaseEvent'
        - type: object
          properties:
            serviceId:
              type: string
            serviceVersion:
              type: string

    SystemErrorEvent:
      allOf:
        - $ref: '#/components/schemas/SystemEvent'
        - type: object
          properties:
            eventType:
              const: "system.error"
            data:
              type: object
              required:
                - errorCode
                - errorMessage
                - severity
              properties:
                errorCode:
                  type: string
                errorMessage:
                  type: string
                severity:
                  type: string
                  enum: ["low", "medium", "high", "critical"]
                stackTrace:
                  type: string
                affectedUsers:
                  type: array
                  items:
                    type: string

    # 通知システムの polymorphic 設計
    Notification:
      oneOf:
        - $ref: '#/components/schemas/EmailNotification'
        - $ref: '#/components/schemas/PushNotification'
        - $ref: '#/components/schemas/SmsNotification'
        - $ref: '#/components/schemas/WebhookNotification'
      discriminator:
        propertyName: channel
        mapping:
          email: '#/components/schemas/EmailNotification'
          push: '#/components/schemas/PushNotification'
          sms: '#/components/schemas/SmsNotification'
          webhook: '#/components/schemas/WebhookNotification'

    BaseNotification:
      type: object
      required:
        - id
        - channel
        - recipientId
        - subject
        - createdAt
      properties:
        id:
          type: string
          format: uuid
        channel:
          type: string
        recipientId:
          type: string
        subject:
          type: string
        priority:
          type: string
          enum: ["low", "normal", "high", "urgent"]
          default: "normal"
        scheduledAt:
          type: string
          format: date-time
        createdAt:
          type: string
          format: date-time
        status:
          type: string
          enum: ["pending", "sent", "delivered", "failed", "cancelled"]

    EmailNotification:
      allOf:
        - $ref: '#/components/schemas/BaseNotification'
        - type: object
          properties:
            channel:
              const: "email"
            content:
              type: object
              required:
                - body
              properties:
                body:
                  type: string
                isHtml:
                  type: boolean
                  default: false
                attachments:
                  type: array
                  items:
                    type: object
                    properties:
                      filename:
                        type: string
                      contentType:
                        type: string
                      size:
                        type: integer
                cc:
                  type: array
                  items:
                    type: string
                    format: email
                bcc:
                  type: array
                  items:
                    type: string
                    format: email

    PushNotification:
      allOf:
        - $ref: '#/components/schemas/BaseNotification'
        - type: object
          properties:
            channel:
              const: "push"
            content:
              type: object
              required:
                - body
              properties:
                body:
                  type: string
                  maxLength: 200
                badge:
                  type: integer
                  minimum: 0
                sound:
                  type: string
                customData:
                  type: object
                  additionalProperties: true
                actionButtons:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: string
                      title:
                        type: string
                      action:
                        type: string
```

### 2. 動的スキーマ選択

```yaml
components:
  schemas:
    # APIレスポンスの動的スキーマ
    ApiResponse:
      oneOf:
        - $ref: '#/components/schemas/SuccessResponse'
        - $ref: '#/components/schemas/ErrorResponse'
        - $ref: '#/components/schemas/PaginatedResponse'
      discriminator:
        propertyName: status
        mapping:
          success: '#/components/schemas/SuccessResponse'
          error: '#/components/schemas/ErrorResponse'
          paginated: '#/components/schemas/PaginatedResponse'

    SuccessResponse:
      type: object
      required:
        - status
        - data
      properties:
        status:
          const: "success"
        data:
          oneOf:
            - $ref: '#/components/schemas/User'
            - $ref: '#/components/schemas/Order'
            - $ref: '#/components/schemas/Product'
            - type: array
              items:
                oneOf:
                  - $ref: '#/components/schemas/User'
                  - $ref: '#/components/schemas/Order'
                  - $ref: '#/components/schemas/Product'
        metadata:
          type: object
          properties:
            requestId:
              type: string
            timestamp:
              type: string
              format: date-time
            version:
              type: string

    # 設定システムの動的値
    ConfigurationValue:
      oneOf:
        - type: object
          properties:
            type:
              const: "string"
            value:
              type: string
            validation:
              type: object
              properties:
                minLength:
                  type: integer
                maxLength:
                  type: integer
                pattern:
                  type: string
        
        - type: object
          properties:
            type:
              const: "number"
            value:
              type: number
            validation:
              type: object
              properties:
                minimum:
                  type: number
                maximum:
                  type: number
                multipleOf:
                  type: number
        
        - type: object
          properties:
            type:
              const: "boolean"
            value:
              type: boolean
        
        - type: object
          properties:
            type:
              const: "array"
            value:
              type: array
              items:
                oneOf:
                  - type: string
                  - type: number
                  - type: boolean
            validation:
              type: object
              properties:
                minItems:
                  type: integer
                maxItems:
                  type: integer
                uniqueItems:
                  type: boolean
        
        - type: object
          properties:
            type:
              const: "object"
            value:
              type: object
              additionalProperties: true
      
      discriminator:
        propertyName: type
```

## 柔軟な組み合わせ（anyOf）

### 1. 複数認証方式

```yaml
components:
  schemas:
    # 認証要求（複数方式の組み合わせ可能）
    AuthenticationRequest:
      anyOf:
        # パスワード認証
        - type: object
          required: ["username", "password"]
          properties:
            username:
              type: string
            password:
              type: string
              format: password
        
        # トークン認証
        - type: object
          required: ["token"]
          properties:
            token:
              type: string
              pattern: '^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$'
        
        # APIキー認証
        - type: object
          required: ["apiKey"]
          properties:
            apiKey:
              type: string
              pattern: '^[a-z0-9]{32}$'
        
        # 二要素認証
        - type: object
          required: ["totpCode"]
          properties:
            totpCode:
              type: string
              pattern: '^[0-9]{6}$'
        
        # バイオメトリック認証
        - type: object
          required: ["biometricData"]
          properties:
            biometricData:
              type: object
              properties:
                type:
                  type: string
                  enum: ["fingerprint", "face", "voice"]
                data:
                  type: string
                  format: byte

      # 共通プロパティ
      properties:
        deviceId:
          type: string
        userAgent:
          type: string
        ipAddress:
          type: string
          format: ipv4
        timestamp:
          type: string
          format: date-time
        rememberDevice:
          type: boolean
          default: false

    # 検索条件（複数条件の組み合わせ）
    SearchCriteria:
      anyOf:
        # テキスト検索
        - type: object
          required: ["query"]
          properties:
            query:
              type: string
              minLength: 1
            searchFields:
              type: array
              items:
                type: string
              default: ["title", "content"]
            fuzzy:
              type: boolean
              default: false
        
        # カテゴリフィルタ
        - type: object
          required: ["categories"]
          properties:
            categories:
              type: array
              items:
                type: string
              minItems: 1
        
        # 日付範囲フィルタ
        - type: object
          anyOf:
            - required: ["createdAfter"]
            - required: ["createdBefore"]
            - required: ["createdAfter", "createdBefore"]
          properties:
            createdAfter:
              type: string
              format: date-time
            createdBefore:
              type: string
              format: date-time
        
        # タグフィルタ
        - type: object
          required: ["tags"]
          properties:
            tags:
              type: array
              items:
                type: string
              minItems: 1
            tagOperator:
              type: string
              enum: ["AND", "OR"]
              default: "OR"
        
        # 価格範囲フィルタ
        - type: object
          anyOf:
            - required: ["minPrice"]
            - required: ["maxPrice"]
            - required: ["minPrice", "maxPrice"]
          properties:
            minPrice:
              type: number
              minimum: 0
            maxPrice:
              type: number
              minimum: 0
            currency:
              type: string
              pattern: '^[A-Z]{3}$'

      # 共通プロパティ
      properties:
        sortBy:
          type: string
          enum: ["relevance", "date", "price", "popularity"]
          default: "relevance"
        sortOrder:
          type: string
          enum: ["asc", "desc"]
          default: "desc"
        limit:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
        offset:
          type: integer
          minimum: 0
          default: 0
```

### 2. 部分的データ更新

```yaml
components:
  schemas:
    # ユーザープロファイル更新（部分更新対応）
    UserProfileUpdate:
      anyOf:
        # 基本情報更新
        - type: object
          properties:
            firstName:
              type: string
              maxLength: 100
            lastName:
              type: string
              maxLength: 100
            displayName:
              type: string
              maxLength: 150
        
        # 連絡先情報更新
        - type: object
          properties:
            email:
              type: string
              format: email
            phone:
              type: string
              pattern: '^[\+]?[0-9\-\s\(\)]+$'
            address:
              $ref: '#/components/schemas/Address'
        
        # プライバシー設定更新
        - type: object
          properties:
            privacy:
              type: object
              properties:
                profileVisibility:
                  type: string
                  enum: ["public", "friends", "private"]
                showEmail:
                  type: boolean
                showPhone:
                  type: boolean
                allowSearchEngineIndexing:
                  type: boolean
        
        # 通知設定更新
        - type: object
          properties:
            notifications:
              type: object
              properties:
                email:
                  type: boolean
                push:
                  type: boolean
                sms:
                  type: boolean
                marketing:
                  type: boolean
                security:
                  type: boolean
        
        # プロフィール画像更新
        - type: object
          properties:
            avatar:
              type: object
              properties:
                imageUrl:
                  type: string
                  format: uri
                thumbnailUrl:
                  type: string
                  format: uri
                removeExisting:
                  type: boolean

      # 少なくとも1つのフィールドは必要
      minProperties: 1

    # 商品情報更新
    ProductUpdate:
      anyOf:
        # 基本情報
        - type: object
          properties:
            name:
              type: string
              maxLength: 255
            description:
              type: string
            shortDescription:
              type: string
              maxLength: 500
        
        # 価格情報
        - type: object
          properties:
            price:
              type: number
              minimum: 0
            salePrice:
              type: number
              minimum: 0
            currency:
              type: string
              pattern: '^[A-Z]{3}$'
        
        # 在庫情報
        - type: object
          properties:
            inventory:
              type: object
              properties:
                quantity:
                  type: integer
                  minimum: 0
                lowStockThreshold:
                  type: integer
                  minimum: 0
                trackInventory:
                  type: boolean
        
        # カテゴリ・タグ
        - type: object
          properties:
            categoryId:
              type: string
            tags:
              type: array
              items:
                type: string
              maxItems: 20
        
        # SEO情報
        - type: object
          properties:
            seo:
              type: object
              properties:
                metaTitle:
                  type: string
                  maxLength: 60
                metaDescription:
                  type: string
                  maxLength: 160
                slug:
                  type: string
                  pattern: '^[a-z0-9\-]+$'

      minProperties: 1
```

## 高度な実装パターン

### 1. 条件付き組み合わせ

```yaml
components:
  schemas:
    # 動的フォームスキーマ
    DynamicForm:
      type: object
      required:
        - formType
      properties:
        formType:
          type: string
          enum: ["contact", "registration", "survey", "order"]
      
      allOf:
        # 連絡フォーム
        - if:
            properties:
              formType:
                const: "contact"
          then:
            anyOf:
              - required: ["email"]
              - required: ["phone"]
            properties:
              name:
                type: string
              email:
                type: string
                format: email
              phone:
                type: string
              subject:
                type: string
              message:
                type: string
        
        # 登録フォーム
        - if:
            properties:
              formType:
                const: "registration"
          then:
            allOf:
              - required: ["username", "email", "password"]
              - anyOf:
                  - required: ["firstName", "lastName"]
                  - required: ["companyName"]
            properties:
              username:
                type: string
                minLength: 3
              email:
                type: string
                format: email
              password:
                type: string
                minLength: 8
              firstName:
                type: string
              lastName:
                type: string
              companyName:
                type: string
              terms:
                type: boolean
                const: true
        
        # アンケートフォーム
        - if:
            properties:
              formType:
                const: "survey"
          then:
            properties:
              questions:
                type: array
                items:
                  oneOf:
                    - $ref: '#/components/schemas/TextQuestion'
                    - $ref: '#/components/schemas/MultipleChoiceQuestion'
                    - $ref: '#/components/schemas/RatingQuestion'

    # 支払い処理の複合スキーマ
    PaymentProcessing:
      allOf:
        - type: object
          required:
            - amount
            - currency
            - paymentMethod
          properties:
            amount:
              type: number
              minimum: 0.01
            currency:
              type: string
              pattern: '^[A-Z]{3}$'
            paymentMethod:
              oneOf:
                - $ref: '#/components/schemas/CreditCardMethod'
                - $ref: '#/components/schemas/BankTransferMethod'
                - $ref: '#/components/schemas/DigitalWalletMethod'
        
        # 高額取引の追加要件
        - if:
            properties:
              amount:
                minimum: 10000
          then:
            anyOf:
              - required: ["identityVerification"]
              - required: ["managerApproval"]
            properties:
              identityVerification:
                type: object
                properties:
                  documentType:
                    type: string
                    enum: ["passport", "driver_license", "national_id"]
                  documentNumber:
                    type: string
                  verificationStatus:
                    type: string
                    enum: ["pending", "verified", "failed"]
              managerApproval:
                type: object
                properties:
                  managerId:
                    type: string
                  approvalTimestamp:
                    type: string
                    format: date-time
                  approvalCode:
                    type: string
        
        # 国際取引の追加要件
        - if:
            not:
              properties:
                currency:
                  const: "JPY"
          then:
            required: ["exchangeRate", "fees"]
            properties:
              exchangeRate:
                type: number
                minimum: 0
              fees:
                type: object
                properties:
                  conversionFee:
                    type: number
                  processingFee:
                    type: number
                  totalFee:
                    type: number
```

### 2. パフォーマンス最適化

```typescript
// TypeScript 実装例: 効率的な組み合わせスキーマ処理
export class CompositionSchemaProcessor {
  
  /**
   * allOf を効率的に処理
   */
  static processAllOf(schemas: any[]): any {
    return schemas.reduce((merged, schema) => {
      return this.deepMergeSchemas(merged, schema);
    }, {});
  }

  /**
   * oneOf の discriminator を使用した高速選択
   */
  static processOneOfWithDiscriminator(
    schemas: any[], 
    discriminator: any, 
    data: any
  ): any {
    const discriminatorProperty = discriminator.propertyName;
    const discriminatorValue = data[discriminatorProperty];
    
    if (discriminator.mapping && discriminator.mapping[discriminatorValue]) {
      // mapping を使用した直接選択
      const schemaRef = discriminator.mapping[discriminatorValue];
      return this.resolveSchemaRef(schemaRef);
    }
    
    // フォールバック: 全スキーマをチェック
    for (const schema of schemas) {
      if (this.matchesSchema(schema, data)) {
        return schema;
      }
    }
    
    throw new Error(`No matching schema found for discriminator: ${discriminatorValue}`);
  }

  /**
   * anyOf の効率的な評価
   */
  static processAnyOf(schemas: any[], data: any): any[] {
    const matchingSchemas: any[] = [];
    
    for (const schema of schemas) {
      if (this.matchesSchema(schema, data)) {
        matchingSchemas.push(schema);
      }
    }
    
    if (matchingSchemas.length === 0) {
      throw new Error('Data does not match any of the provided schemas');
    }
    
    return matchingSchemas;
  }

  /**
   * スキーマの深いマージ
   */
  private static deepMergeSchemas(target: any, source: any): any {
    const result = { ...target };
    
    for (const [key, value] of Object.entries(source)) {
      if (key === 'required' && Array.isArray(value) && Array.isArray(result[key])) {
        // required 配列をマージ
        result[key] = [...new Set([...result[key], ...value])];
      } else if (key === 'properties' && typeof value === 'object' && typeof result[key] === 'object') {
        // properties オブジェクトをマージ
        result[key] = { ...result[key], ...value };
      } else if (key === 'allOf' && Array.isArray(value) && Array.isArray(result[key])) {
        // allOf 配列をマージ
        result[key] = [...result[key], ...value];
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * データがスキーマにマッチするかチェック
   */
  private static matchesSchema(schema: any, data: any): boolean {
    // 簡略化された実装
    // 実際の実装では、完全なJSON Schemaバリデーションが必要
    if (schema.properties) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in data) {
          // プロパティの型チェックなど
          if (!this.validateProperty(data[prop], propSchema)) {
            return false;
          }
        }
      }
    }
    
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private static validateProperty(value: any, schema: any): boolean {
    // プロパティバリデーションの実装
    // 型チェック、フォーマットチェックなど
    return true; // 簡略化
  }

  private static resolveSchemaRef(ref: string): any {
    // スキーマ参照の解決
    // 実際の実装では、参照解決システムが必要
    return {}; // 簡略化
  }
}

// 使用例
const allOfResult = CompositionSchemaProcessor.processAllOf([
  { properties: { name: { type: 'string' } }, required: ['name'] },
  { properties: { age: { type: 'integer' } }, required: ['age'] }
]);

console.log('Merged schema:', allOfResult);
```

この高度な組み合わせスキーマ実装により、複雑なデータ構造とビジネスロジックを正確に表現し、型安全で保守性の高いAPIを構築できます。