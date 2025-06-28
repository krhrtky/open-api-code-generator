# 条件付きスキーマ（if/then/else）完全実装仕様書

## 概要

JSON Schema 2020-12とOpenAPI 3.1.0で提供される条件付きスキーマ（if/then/else）は、動的なバリデーションルールを実現する強力な機能です。この文書では、複雑な条件分岐から実践的な活用まで包括的に説明します。

## 基本概念

### 1. 条件付きスキーマの構造

```yaml
# 基本構文
if:
  # 条件を定義
then:
  # 条件が真の場合のスキーマ
else:
  # 条件が偽の場合のスキーマ（オプション）
```

### 2. 動作原理

| ステップ | 処理内容 | 結果 |
|---------|----------|------|
| 1 | `if`スキーマでデータを評価 | true/false |
| 2 | 真の場合：`then`スキーマを適用 | バリデーション実行 |
| 3 | 偽の場合：`else`スキーマを適用 | バリデーション実行 |
| 4 | 条件評価は無視、条件分岐の結果のみ使用 | 最終バリデーション結果 |

### 3. 基本実装例

```yaml
components:
  schemas:
    # 年齢に基づく条件分岐
    UserRegistration:
      type: object
      required:
        - name
        - age
      properties:
        name:
          type: string
        age:
          type: integer
          minimum: 0
          maximum: 150
        email:
          type: string
          format: email
        parentEmail:
          type: string
          format: email
        parentConsent:
          type: boolean

      # 18歳未満の場合は親の同意が必要
      if:
        properties:
          age:
            maximum: 17
      then:
        required: ["parentEmail", "parentConsent"]
        properties:
          parentConsent:
            const: true
      else:
        # 18歳以上は親の情報は不要
        not:
          anyOf:
            - required: ["parentEmail"]
            - required: ["parentConsent"]

    # 支払い方法に基づく条件分岐
    PaymentForm:
      type: object
      required:
        - paymentType
        - amount
      properties:
        paymentType:
          type: string
          enum: ["credit_card", "bank_transfer", "digital_wallet"]
        amount:
          type: number
          minimum: 0.01

      allOf:
        # クレジットカードの場合
        - if:
            properties:
              paymentType:
                const: "credit_card"
          then:
            required: ["cardNumber", "expiryMonth", "expiryYear", "cvv"]
            properties:
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
              cardHolderName:
                type: string

        # 銀行振込の場合
        - if:
            properties:
              paymentType:
                const: "bank_transfer"
          then:
            required: ["bankCode", "accountNumber", "accountHolder"]
            properties:
              bankCode:
                type: string
                pattern: '^[0-9]{4}$'
              accountNumber:
                type: string
                pattern: '^[0-9]{7,12}$'
              accountHolder:
                type: string
              transferNote:
                type: string
                maxLength: 100

        # デジタルウォレットの場合
        - if:
            properties:
              paymentType:
                const: "digital_wallet"
          then:
            required: ["walletProvider", "walletId"]
            properties:
              walletProvider:
                type: string
                enum: ["paypal", "applepay", "googlepay", "stripe"]
              walletId:
                type: string
              walletToken:
                type: string
```

## 高度な条件パターン

### 1. 複雑な条件組み合わせ

```yaml
components:
  schemas:
    # 企業・個人の複合条件
    CustomerProfile:
      type: object
      required:
        - customerType
      properties:
        customerType:
          type: string
          enum: ["individual", "business"]
        
        # 個人情報
        firstName:
          type: string
        lastName:
          type: string
        dateOfBirth:
          type: string
          format: date
        
        # 企業情報
        companyName:
          type: string
        taxId:
          type: string
        businessType:
          type: string
          enum: ["corporation", "llc", "partnership", "sole_proprietorship"]
        
        # 共通情報
        address:
          $ref: '#/components/schemas/Address'
        phone:
          type: string
        email:
          type: string
          format: email
        
        # 金融情報
        annualRevenue:
          type: number
          minimum: 0
        employeeCount:
          type: integer
          minimum: 1

      allOf:
        # 個人顧客の場合
        - if:
            properties:
              customerType:
                const: "individual"
          then:
            required: ["firstName", "lastName", "dateOfBirth"]
            properties:
              # 年齢制限チェック
              dateOfBirth:
                # 18歳以上であることを確認（概算）
                pattern: '^(19[0-9]{2}|200[0-6])-'
            # 企業固有フィールドは禁止
            not:
              anyOf:
                - required: ["companyName"]
                - required: ["taxId"]
                - required: ["businessType"]
                - required: ["employeeCount"]

        # 企業顧客の場合
        - if:
            properties:
              customerType:
                const: "business"
          then:
            required: ["companyName", "taxId", "businessType"]
            # 個人固有フィールドは禁止
            not:
              anyOf:
                - required: ["firstName"]
                - required: ["lastName"]
                - required: ["dateOfBirth"]

        # 大口顧客の場合の追加要件
        - if:
            properties:
              annualRevenue:
                minimum: 10000000  # 1,000万円以上
          then:
            required: ["dedicatedManager"]
            properties:
              dedicatedManager:
                type: object
                required: ["managerId", "managerName", "contactInfo"]
                properties:
                  managerId:
                    type: string
                  managerName:
                    type: string
                  contactInfo:
                    type: object
                    properties:
                      email:
                        type: string
                        format: email
                      phone:
                        type: string

        # 大企業の場合の追加チェック
        - if:
            allOf:
              - properties:
                  customerType:
                    const: "business"
              - properties:
                  employeeCount:
                    minimum: 100
          then:
            required: ["complianceInfo"]
            properties:
              complianceInfo:
                type: object
                required: ["lastAuditDate", "complianceOfficer"]
                properties:
                  lastAuditDate:
                    type: string
                    format: date
                  complianceOfficer:
                    type: string
                  certifications:
                    type: array
                    items:
                      type: string

    # サブスクリプションプランの条件分岐
    SubscriptionPlan:
      type: object
      required:
        - planType
        - billingCycle
      properties:
        planType:
          type: string
          enum: ["basic", "premium", "enterprise"]
        billingCycle:
          type: string
          enum: ["monthly", "yearly"]
        
        # 基本機能
        userLimit:
          type: integer
          minimum: 1
        storageLimit:
          type: number  # GB
        apiCallLimit:
          type: integer
        
        # プレミアム機能
        customDomain:
          type: boolean
        prioritySupport:
          type: boolean
        advancedAnalytics:
          type: boolean
        
        # エンタープライズ機能
        sso:
          type: boolean
        auditLogs:
          type: boolean
        customIntegrations:
          type: boolean
        dedicatedInstance:
          type: boolean

      allOf:
        # Basicプランの制限
        - if:
            properties:
              planType:
                const: "basic"
          then:
            properties:
              userLimit:
                maximum: 10
              storageLimit:
                maximum: 10
              apiCallLimit:
                maximum: 10000
              # プレミアム機能は無効
              customDomain:
                const: false
              prioritySupport:
                const: false
              advancedAnalytics:
                const: false
              # エンタープライズ機能は無効
              sso:
                const: false
              auditLogs:
                const: false
              customIntegrations:
                const: false
              dedicatedInstance:
                const: false

        # Premiumプランの制限
        - if:
            properties:
              planType:
                const: "premium"
          then:
            properties:
              userLimit:
                maximum: 100
              storageLimit:
                maximum: 100
              apiCallLimit:
                maximum: 100000
              # プレミアム機能は利用可能
              customDomain:
                type: boolean
              prioritySupport:
                type: boolean
              advancedAnalytics:
                type: boolean
              # エンタープライズ機能は無効
              sso:
                const: false
              auditLogs:
                const: false
              customIntegrations:
                const: false
              dedicatedInstance:
                const: false

        # Enterpriseプランは制限なし
        - if:
            properties:
              planType:
                const: "enterprise"
          then:
            properties:
              userLimit:
                minimum: 1
              storageLimit:
                minimum: 1
              apiCallLimit:
                minimum: 1
              # 全機能利用可能
              customDomain:
                type: boolean
              prioritySupport:
                type: boolean
              advancedAnalytics:
                type: boolean
              sso:
                type: boolean
              auditLogs:
                type: boolean
              customIntegrations:
                type: boolean
              dedicatedInstance:
                type: boolean

        # 年額払いの割引
        - if:
            properties:
              billingCycle:
                const: "yearly"
          then:
            properties:
              discountRate:
                type: number
                minimum: 0.1
                maximum: 0.3
                description: "年額払い割引率（10-30%）"
```

### 2. ネストした条件分岐

```yaml
components:
  schemas:
    # 配送オプションの複雑な条件
    ShippingConfiguration:
      type: object
      required:
        - destination
        - items
      properties:
        destination:
          type: object
          required: ["country", "region"]
          properties:
            country:
              type: string
              pattern: '^[A-Z]{2}$'  # ISO 3166-1 alpha-2
            region:
              type: string
        
        items:
          type: array
          items:
            type: object
            required: ["weight", "dimensions", "category"]
            properties:
              weight:
                type: number
                minimum: 0
              dimensions:
                type: object
                properties:
                  length: { type: number }
                  width: { type: number }
                  height: { type: number }
              category:
                type: string
                enum: ["standard", "fragile", "hazardous", "oversized"]
        
        shippingMethod:
          type: string
          enum: ["standard", "express", "overnight", "international"]
        
        insurance:
          type: boolean
        
        signatureRequired:
          type: boolean

      allOf:
        # 国内配送の場合
        - if:
            properties:
              destination:
                properties:
                  country:
                    const: "JP"
          then:
            properties:
              shippingMethod:
                enum: ["standard", "express", "overnight"]
              domesticOptions:
                type: object
                properties:
                  timeSlot:
                    type: string
                    enum: ["morning", "afternoon", "evening"]
                  cashOnDelivery:
                    type: boolean
          else:
            # 国際配送の場合
            required: ["customsDeclaration"]
            properties:
              shippingMethod:
                enum: ["international"]
              customsDeclaration:
                type: object
                required: ["value", "description"]
                properties:
                  value:
                    type: number
                    minimum: 0
                  description:
                    type: string
                  category:
                    type: string
                    enum: ["gift", "commercial", "sample", "return"]

        # 重量による制限
        - if:
            properties:
              items:
                contains:
                  properties:
                    weight:
                      minimum: 30  # 30kg以上のアイテムがある場合
          then:
            properties:
              shippingMethod:
                not:
                  const: "overnight"  # 翌日配送不可
              specialHandling:
                const: true
            required: ["specialHandling"]

        # 危険物の場合
        - if:
            properties:
              items:
                contains:
                  properties:
                    category:
                      const: "hazardous"
          then:
            properties:
              shippingMethod:
                enum: ["standard"]  # 標準配送のみ
              hazardousDeclaration:
                type: object
                required: ["classification", "unNumber", "packingGroup"]
                properties:
                  classification:
                    type: string
                  unNumber:
                    type: string
                    pattern: '^UN[0-9]{4}$'
                  packingGroup:
                    type: string
                    enum: ["I", "II", "III"]
              insurance:
                const: true  # 保険必須
            required: ["hazardousDeclaration"]

        # 高額商品の場合
        - if:
            properties:
              customsDeclaration:
                properties:
                  value:
                    minimum: 100000  # 10万円以上
          then:
            properties:
              insurance:
                const: true
              signatureRequired:
                const: true
              trackingLevel:
                const: "premium"
            required: ["trackingLevel"]

    # 動的フォームバリデーション
    DynamicFormField:
      type: object
      required:
        - fieldType
        - fieldName
      properties:
        fieldType:
          type: string
          enum: ["text", "number", "email", "date", "select", "checkbox", "file"]
        fieldName:
          type: string
        label:
          type: string
        required:
          type: boolean
          default: false
        placeholder:
          type: string

      allOf:
        # テキストフィールドの場合
        - if:
            properties:
              fieldType:
                const: "text"
          then:
            properties:
              textOptions:
                type: object
                properties:
                  minLength:
                    type: integer
                    minimum: 0
                  maxLength:
                    type: integer
                    minimum: 1
                  pattern:
                    type: string
                  multiline:
                    type: boolean

        # 数値フィールドの場合
        - if:
            properties:
              fieldType:
                const: "number"
          then:
            properties:
              numberOptions:
                type: object
                properties:
                  minimum:
                    type: number
                  maximum:
                    type: number
                  step:
                    type: number
                  integer:
                    type: boolean

        # 選択フィールドの場合
        - if:
            properties:
              fieldType:
                const: "select"
          then:
            required: ["selectOptions"]
            properties:
              selectOptions:
                type: object
                required: ["options"]
                properties:
                  options:
                    type: array
                    items:
                      type: object
                      required: ["value", "label"]
                      properties:
                        value:
                          type: string
                        label:
                          type: string
                        disabled:
                          type: boolean
                    minItems: 1
                  multiple:
                    type: boolean
                    default: false

        # ファイルフィールドの場合
        - if:
            properties:
              fieldType:
                const: "file"
          then:
            properties:
              fileOptions:
                type: object
                properties:
                  acceptedTypes:
                    type: array
                    items:
                      type: string
                    examples:
                      - ["image/*"]
                      - ["application/pdf"]
                      - [".jpg", ".png", ".gif"]
                  maxSize:
                    type: integer
                    minimum: 1
                    description: "最大ファイルサイズ（バイト）"
                  multiple:
                    type: boolean
                    default: false

        # 必須フィールドの場合の追加バリデーション
        - if:
            properties:
              required:
                const: true
          then:
            required: ["validationMessage"]
            properties:
              validationMessage:
                type: string
                description: "バリデーション失敗時のメッセージ"
```

### 3. 動的配列バリデーション

```yaml
components:
  schemas:
    # 動的配列の条件付きバリデーション
    ProjectTeam:
      type: object
      required:
        - projectType
        - teamMembers
      properties:
        projectType:
          type: string
          enum: ["small", "medium", "large", "enterprise"]
        teamMembers:
          type: array
          items:
            $ref: '#/components/schemas/TeamMember'
        budget:
          type: number
          minimum: 0
        duration:
          type: integer
          minimum: 1
          description: "プロジェクト期間（週）"

      allOf:
        # 小規模プロジェクト（1-3名）
        - if:
            properties:
              projectType:
                const: "small"
          then:
            properties:
              teamMembers:
                minItems: 1
                maxItems: 3
                # 少なくとも1人のリーダーが必要
                contains:
                  properties:
                    role:
                      const: "leader"
                minContains: 1
                maxContains: 1
              budget:
                maximum: 1000000
              duration:
                maximum: 12

        # 中規模プロジェクト（4-10名）
        - if:
            properties:
              projectType:
                const: "medium"
          then:
            properties:
              teamMembers:
                minItems: 4
                maxItems: 10
                # リーダー1名、シニア1名以上が必要
                allOf:
                  - contains:
                      properties:
                        role:
                          const: "leader"
                    minContains: 1
                    maxContains: 1
                  - contains:
                      properties:
                        seniority:
                          const: "senior"
                    minContains: 1
              budget:
                minimum: 500000
                maximum: 5000000
              duration:
                minimum: 4
                maximum: 26

        # 大規模プロジェクト（11-30名）
        - if:
            properties:
              projectType:
                const: "large"
          then:
            properties:
              teamMembers:
                minItems: 11
                maxItems: 30
                # 複数リーダー、シニア、アーキテクトが必要
                allOf:
                  - contains:
                      properties:
                        role:
                          const: "leader"
                    minContains: 2
                    maxContains: 3
                  - contains:
                      properties:
                        seniority:
                          const: "senior"
                    minContains: 3
                  - contains:
                      properties:
                        role:
                          const: "architect"
                    minContains: 1
              budget:
                minimum: 2000000
                maximum: 20000000
              duration:
                minimum: 12
                maximum: 52

        # エンタープライズプロジェクト（30名以上）
        - if:
            properties:
              projectType:
                const: "enterprise"
          then:
            properties:
              teamMembers:
                minItems: 30
                # 組織的な役割分担が必要
                allOf:
                  - contains:
                      properties:
                        role:
                          const: "project_manager"
                    minContains: 1
                  - contains:
                      properties:
                        role:
                          const: "tech_lead"
                    minContains: 2
                  - contains:
                      properties:
                        role:
                          const: "architect"
                    minContains: 2
                  - contains:
                      properties:
                        role:
                          const: "qa_lead"
                    minContains: 1
              budget:
                minimum: 10000000
              duration:
                minimum: 26
            required: ["governance"]
            properties:
              governance:
                type: object
                required: ["methodology", "reportingStructure"]
                properties:
                  methodology:
                    type: string
                    enum: ["agile", "waterfall", "hybrid"]
                  reportingStructure:
                    type: array
                    items:
                      type: object
                      properties:
                        level:
                          type: string
                        frequency:
                          type: string
                          enum: ["daily", "weekly", "monthly"]

    TeamMember:
      type: object
      required:
        - name
        - role
        - seniority
      properties:
        name:
          type: string
        role:
          type: string
          enum: [
            "leader", "developer", "designer", "qa", "devops",
            "project_manager", "tech_lead", "architect", "qa_lead"
          ]
        seniority:
          type: string
          enum: ["junior", "mid", "senior", "principal"]
        skills:
          type: array
          items:
            type: string
        availability:
          type: number
          minimum: 0.1
          maximum: 1.0
          description: "稼働率（0.1 = 10%, 1.0 = 100%）"
```

## 実装支援ツール

### 1. 条件付きスキーマエンジン

```typescript
export class ConditionalSchemaEngine {
  
  /**
   * 条件付きスキーマを評価
   */
  static evaluateConditional(
    schema: ConditionalSchema, 
    data: any
  ): ValidationResult {
    const results: ValidationResult[] = [];
    
    // if条件を評価
    const conditionResult = this.validateSchema(schema.if, data);
    
    let branchSchema: any;
    if (conditionResult.valid) {
      // 条件が真の場合、thenスキーマを適用
      branchSchema = schema.then;
    } else if (schema.else) {
      // 条件が偽でelseが存在する場合、elseスキーマを適用
      branchSchema = schema.else;
    } else {
      // elseが存在しない場合は成功
      return { valid: true, errors: [] };
    }
    
    // 選択されたブランチスキーマを評価
    return this.validateSchema(branchSchema, data);
  }

  /**
   * 複数の条件付きスキーマを処理（allOf内の複数if/then/else）
   */
  static evaluateMultipleConditionals(
    conditionals: ConditionalSchema[], 
    data: any
  ): ValidationResult {
    const allErrors: any[] = [];
    let isValid = true;

    for (const conditional of conditionals) {
      const result = this.evaluateConditional(conditional, data);
      if (!result.valid) {
        isValid = false;
        allErrors.push(...result.errors);
      }
    }

    return {
      valid: isValid,
      errors: allErrors
    };
  }

  /**
   * 動的条件生成
   */
  static generateDynamicConditions(
    rules: BusinessRule[], 
    context: any
  ): ConditionalSchema[] {
    const conditions: ConditionalSchema[] = [];

    for (const rule of rules) {
      const condition = this.ruleToConditional(rule, context);
      if (condition) {
        conditions.push(condition);
      }
    }

    return conditions;
  }

  /**
   * ビジネスルールを条件付きスキーマに変換
   */
  private static ruleToConditional(
    rule: BusinessRule, 
    context: any
  ): ConditionalSchema | null {
    switch (rule.type) {
      case 'age_validation':
        return {
          if: {
            properties: {
              age: { maximum: rule.ageThreshold }
            }
          },
          then: {
            required: rule.requiredFields,
            properties: rule.additionalProperties
          }
        };

      case 'payment_validation':
        return {
          if: {
            properties: {
              paymentType: { const: rule.paymentType }
            }
          },
          then: {
            required: rule.requiredFields,
            properties: rule.fieldDefinitions
          }
        };

      case 'subscription_validation':
        return {
          if: {
            properties: {
              planType: { const: rule.planType }
            }
          },
          then: {
            properties: rule.limitations
          }
        };

      default:
        return null;
    }
  }

  /**
   * 条件の最適化
   */
  static optimizeConditions(
    conditions: ConditionalSchema[]
  ): ConditionalSchema[] {
    // 重複する条件をマージ
    const optimized: ConditionalSchema[] = [];
    const conditionMap = new Map<string, ConditionalSchema[]>();

    for (const condition of conditions) {
      const key = this.getConditionKey(condition.if);
      if (!conditionMap.has(key)) {
        conditionMap.set(key, []);
      }
      conditionMap.get(key)!.push(condition);
    }

    for (const [key, conditionGroup] of conditionMap) {
      if (conditionGroup.length === 1) {
        optimized.push(conditionGroup[0]);
      } else {
        // 複数の条件をマージ
        const merged = this.mergeConditions(conditionGroup);
        optimized.push(merged);
      }
    }

    return optimized;
  }

  private static getConditionKey(ifSchema: any): string {
    return JSON.stringify(ifSchema);
  }

  private static mergeConditions(
    conditions: ConditionalSchema[]
  ): ConditionalSchema {
    const baseCondition = conditions[0];
    const mergedThen = { allOf: conditions.map(c => c.then) };

    return {
      if: baseCondition.if,
      then: mergedThen,
      else: baseCondition.else
    };
  }

  private static validateSchema(schema: any, data: any): ValidationResult {
    // 実際の実装ではAjvなどのJSON Schemaバリデーターを使用
    return { valid: true, errors: [] };
  }
}

interface ConditionalSchema {
  if: any;
  then: any;
  else?: any;
}

interface BusinessRule {
  type: string;
  [key: string]: any;
}

interface ValidationResult {
  valid: boolean;
  errors: any[];
}

// 使用例
const userValidation: ConditionalSchema = {
  if: {
    properties: {
      age: { maximum: 17 }
    }
  },
  then: {
    required: ["parentEmail", "parentConsent"],
    properties: {
      parentConsent: { const: true }
    }
  },
  else: {
    not: {
      anyOf: [
        { required: ["parentEmail"] },
        { required: ["parentConsent"] }
      ]
    }
  }
};

const testData = {
  name: "John",
  age: 16,
  parentEmail: "parent@example.com",
  parentConsent: true
};

const result = ConditionalSchemaEngine.evaluateConditional(
  userValidation, 
  testData
);

console.log('Validation result:', result);
```

### 2. 視覚的条件エディター

```typescript
export class ConditionalSchemaBuilder {
  
  /**
   * GUI用の条件構造を生成
   */
  static buildConditionTree(schema: any): ConditionNode {
    if (schema.if) {
      return {
        type: 'conditional',
        condition: this.parseCondition(schema.if),
        thenBranch: this.buildConditionTree(schema.then),
        elseBranch: schema.else ? this.buildConditionTree(schema.else) : null
      };
    }

    if (schema.allOf) {
      return {
        type: 'allOf',
        children: schema.allOf.map((s: any) => this.buildConditionTree(s))
      };
    }

    if (schema.oneOf) {
      return {
        type: 'oneOf',
        children: schema.oneOf.map((s: any) => this.buildConditionTree(s))
      };
    }

    return {
      type: 'schema',
      schema: schema
    };
  }

  /**
   * 条件文を人間可読形式に変換
   */
  static conditionToText(condition: any): string {
    if (condition.properties) {
      const conditions: string[] = [];
      
      for (const [field, constraint] of Object.entries(condition.properties)) {
        const text = this.constraintToText(field, constraint as any);
        if (text) {
          conditions.push(text);
        }
      }
      
      return conditions.join(' かつ ');
    }

    return 'カスタム条件';
  }

  private static constraintToText(field: string, constraint: any): string {
    if (constraint.const !== undefined) {
      return `${field} が "${constraint.const}"`;
    }
    
    if (constraint.minimum !== undefined && constraint.maximum !== undefined) {
      return `${field} が ${constraint.minimum} 以上 ${constraint.maximum} 以下`;
    }
    
    if (constraint.minimum !== undefined) {
      return `${field} が ${constraint.minimum} 以上`;
    }
    
    if (constraint.maximum !== undefined) {
      return `${field} が ${constraint.maximum} 以下`;
    }

    if (constraint.enum) {
      return `${field} が [${constraint.enum.join(', ')}] のいずれか`;
    }

    return `${field} の条件`;
  }

  /**
   * 条件ツリーからスキーマを生成
   */
  static treeToSchema(node: ConditionNode): any {
    switch (node.type) {
      case 'conditional':
        const result: any = {
          if: node.condition
        };
        
        if (node.thenBranch) {
          result.then = this.treeToSchema(node.thenBranch);
        }
        
        if (node.elseBranch) {
          result.else = this.treeToSchema(node.elseBranch);
        }
        
        return result;

      case 'allOf':
        return {
          allOf: node.children!.map(child => this.treeToSchema(child))
        };

      case 'oneOf':
        return {
          oneOf: node.children!.map(child => this.treeToSchema(child))
        };

      case 'schema':
        return node.schema;

      default:
        return {};
    }
  }

  private static parseCondition(ifSchema: any): any {
    // if条件を解析して内部表現に変換
    return ifSchema;
  }
}

interface ConditionNode {
  type: 'conditional' | 'allOf' | 'oneOf' | 'schema';
  condition?: any;
  thenBranch?: ConditionNode;
  elseBranch?: ConditionNode;
  children?: ConditionNode[];
  schema?: any;
}

// React コンポーネントでの使用例
const ConditionalSchemaEditor: React.FC = () => {
  const [conditionTree, setConditionTree] = useState<ConditionNode>();

  const handleSchemaLoad = (schema: any) => {
    const tree = ConditionalSchemaBuilder.buildConditionTree(schema);
    setConditionTree(tree);
  };

  const renderConditionNode = (node: ConditionNode): JSX.Element => {
    switch (node.type) {
      case 'conditional':
        return (
          <div className="condition-node">
            <div className="condition">
              もし {ConditionalSchemaBuilder.conditionToText(node.condition)} なら
            </div>
            <div className="then-branch">
              {node.thenBranch && renderConditionNode(node.thenBranch)}
            </div>
            {node.elseBranch && (
              <div className="else-branch">
                そうでなければ
                {renderConditionNode(node.elseBranch)}
              </div>
            )}
          </div>
        );
      default:
        return <div>スキーマ</div>;
    }
  };

  return (
    <div>
      {conditionTree && renderConditionNode(conditionTree)}
    </div>
  );
};
```

この包括的な条件付きスキーマ実装により、複雑なビジネスルールと動的バリデーションを効率的に管理し、保守性の高いAPI仕様を構築できます。