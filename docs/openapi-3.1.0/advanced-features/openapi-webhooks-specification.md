# OpenAPI 3.1.0 Webhooks 完全実装仕様書

## 概要

OpenAPI 3.1.0で新しく導入されたWebhooks機能の完全実装ガイドです。イベント駆動アーキテクチャでのリバースAPI（コールバック）の定義から実装まで、包括的に説明します。

## Webhooks とは

Webhooksは、サーバーからクライアントに対してHTTPリクエストを送信する仕組みです。従来のクライアント→サーバーの通信に対して、サーバー→クライアント（リバースAPI）の通信を可能にします。

### 用途例
- 決済完了通知
- データ更新イベント
- ワークフロー完了通知
- リアルタイム連携
- 外部システム連携

## OpenAPI 3.1.0 Webhooks 仕様

### 1. 基本構造

```yaml
openapi: 3.1.0
info:
  title: E-commerce API with Webhooks
  version: 1.0.0

# 通常のAPIパス
paths:
  /orders:
    post:
      summary: 注文作成
      # ... 省略

# Webhooks定義 (OpenAPI 3.1.0新機能)
webhooks:
  orderCompleted:
    post:
      summary: 注文完了通知
      description: 注文が完了した際にクライアントのエンドポイントに送信されるWebhook
      operationId: notifyOrderCompleted
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/OrderCompletedEvent'
      responses:
        '200':
          description: Webhook受信成功
        '404':
          description: エンドポイントが見つからない
        '500':
          description: クライアント側処理エラー

  paymentFailed:
    post:
      summary: 決済失敗通知
      description: 決済が失敗した際の通知Webhook
      operationId: notifyPaymentFailed
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentFailedEvent'
      responses:
        '200':
          description: Webhook受信成功
        '410':
          description: エンドポイントが無効
```

### 2. イベントスキーマ定義

```yaml
components:
  schemas:
    # 基本イベント構造
    WebhookEvent:
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
          description: イベントの一意識別子
          example: "123e4567-e89b-12d3-a456-426614174000"
        eventType:
          type: string
          description: イベントタイプ
          example: "order.completed"
        timestamp:
          type: string
          format: date-time
          description: イベント発生日時
          example: "2024-01-15T10:30:00Z"
        source:
          type: string
          description: イベント発生元
          example: "order-service"
        apiVersion:
          type: string
          description: API バージョン
          example: "v1"
        retry:
          type: integer
          description: リトライ回数
          minimum: 0
          example: 0

    # 注文完了イベント
    OrderCompletedEvent:
      allOf:
        - $ref: '#/components/schemas/WebhookEvent'
        - type: object
          required:
            - data
          properties:
            eventType:
              type: string
              enum: ["order.completed"]
            data:
              $ref: '#/components/schemas/OrderCompletedData'

    OrderCompletedData:
      type: object
      required:
        - orderId
        - customerId
        - orderStatus
        - totalAmount
        - items
      properties:
        orderId:
          type: string
          description: 注文ID
          example: "ORD-2024-001"
        customerId:
          type: string
          description: 顧客ID
          example: "CUST-12345"
        orderStatus:
          type: string
          enum: ["completed", "shipped", "delivered"]
          description: 注文ステータス
          example: "completed"
        totalAmount:
          type: number
          format: decimal
          description: 注文総額
          example: 15980.50
        currency:
          type: string
          pattern: '^[A-Z]{3}$'
          description: 通貨コード
          example: "JPY"
        items:
          type: array
          items:
            $ref: '#/components/schemas/OrderItem'
        shippingAddress:
          $ref: '#/components/schemas/Address'
        estimatedDelivery:
          type: string
          format: date
          description: 配送予定日
          example: "2024-01-20"

    # 決済失敗イベント
    PaymentFailedEvent:
      allOf:
        - $ref: '#/components/schemas/WebhookEvent'
        - type: object
          required:
            - data
          properties:
            eventType:
              type: string
              enum: ["payment.failed"]
            data:
              $ref: '#/components/schemas/PaymentFailedData'

    PaymentFailedData:
      type: object
      required:
        - paymentId
        - orderId
        - customerId
        - failureReason
        - amount
      properties:
        paymentId:
          type: string
          description: 決済ID
          example: "PAY-2024-001"
        orderId:
          type: string
          description: 注文ID
          example: "ORD-2024-001"
        customerId:
          type: string
          description: 顧客ID
          example: "CUST-12345"
        failureReason:
          type: string
          enum: 
            - "insufficient_funds"
            - "invalid_card"
            - "expired_card"
            - "fraud_detected"
            - "processing_error"
          description: 失敗理由
          example: "insufficient_funds"
        amount:
          type: number
          format: decimal
          description: 決済金額
          example: 15980.50
        currency:
          type: string
          pattern: '^[A-Z]{3}$'
          description: 通貨コード
          example: "JPY"
        errorCode:
          type: string
          description: エラーコード
          example: "E001"
        errorMessage:
          type: string
          description: エラーメッセージ
          example: "カードの残高が不足しています"
        nextAction:
          type: string
          enum: ["retry", "update_payment_method", "contact_customer"]
          description: 推奨される次のアクション
          example: "update_payment_method"

    # 共通データ構造
    OrderItem:
      type: object
      required:
        - itemId
        - name
        - quantity
        - unitPrice
      properties:
        itemId:
          type: string
          description: 商品ID
          example: "ITEM-001"
        name:
          type: string
          description: 商品名
          example: "MacBook Pro 14inch"
        quantity:
          type: integer
          minimum: 1
          description: 数量
          example: 1
        unitPrice:
          type: number
          format: decimal
          description: 単価
          example: 159800.00
        category:
          type: string
          description: カテゴリ
          example: "Electronics"

    Address:
      type: object
      required:
        - country
        - postalCode
        - prefecture
        - city
      properties:
        country:
          type: string
          description: 国
          example: "Japan"
        postalCode:
          type: string
          pattern: '^[0-9]{3}-[0-9]{4}$'
          description: 郵便番号
          example: "100-0001"
        prefecture:
          type: string
          description: 都道府県
          example: "東京都"
        city:
          type: string
          description: 市区町村
          example: "千代田区"
        address1:
          type: string
          description: 住所1
          example: "丸の内1-1-1"
        address2:
          type: string
          description: 住所2（建物名・部屋番号等）
          example: "サンプルビル101号室"
```

### 3. Webhook設定スキーマ

```yaml
components:
  schemas:
    # Webhook設定
    WebhookConfiguration:
      type: object
      required:
        - webhookId
        - url
        - events
        - active
      properties:
        webhookId:
          type: string
          description: Webhook設定ID
          example: "webhook-001"
        url:
          type: string
          format: uri
          description: WebhookエンドポイントURL
          example: "https://client.example.com/webhooks/orders"
        events:
          type: array
          items:
            type: string
            enum: 
              - "order.completed"
              - "order.cancelled"
              - "payment.completed"
              - "payment.failed"
              - "shipping.updated"
          description: 受信するイベントタイプ
          example: ["order.completed", "payment.failed"]
        active:
          type: boolean
          description: Webhookの有効/無効
          example: true
        secret:
          type: string
          description: 署名検証用シークレット
          example: "whsec_1234567890abcdef"
        retryPolicy:
          $ref: '#/components/schemas/RetryPolicy'
        headers:
          type: object
          additionalProperties:
            type: string
          description: カスタムヘッダー
          example:
            "X-Client-ID": "client-123"
            "Authorization": "Bearer token"

    # リトライポリシー
    RetryPolicy:
      type: object
      required:
        - maxRetries
        - retryDelay
      properties:
        maxRetries:
          type: integer
          minimum: 0
          maximum: 10
          description: 最大リトライ回数
          example: 3
        retryDelay:
          type: integer
          minimum: 1
          maximum: 3600
          description: リトライ間隔（秒）
          example: 60
        backoffMultiplier:
          type: number
          minimum: 1.0
          maximum: 10.0
          description: 指数バックオフの倍率
          example: 2.0
        maxDelay:
          type: integer
          minimum: 1
          maximum: 86400
          description: 最大遅延時間（秒）
          example: 1800

    # Webhook配信ログ
    WebhookDelivery:
      type: object
      required:
        - deliveryId
        - webhookId
        - eventId
        - url
        - httpStatus
        - timestamp
      properties:
        deliveryId:
          type: string
          description: 配信ID
          example: "delivery-001"
        webhookId:
          type: string
          description: Webhook設定ID
          example: "webhook-001"
        eventId:
          type: string
          description: イベントID
          example: "event-001"
        url:
          type: string
          format: uri
          description: 送信先URL
          example: "https://client.example.com/webhooks/orders"
        httpStatus:
          type: integer
          description: HTTPステータスコード
          example: 200
        responseTime:
          type: integer
          description: レスポンス時間（ミリ秒）
          example: 150
        retryCount:
          type: integer
          description: リトライ回数
          example: 0
        errorMessage:
          type: string
          description: エラーメッセージ
          example: null
        timestamp:
          type: string
          format: date-time
          description: 配信日時
          example: "2024-01-15T10:30:00Z"
        nextRetry:
          type: string
          format: date-time
          description: 次回リトライ予定時刻
          example: null
```

## Controller 実装例

### Spring Boot実装

```java
@RestController
@RequestMapping("/api/v1/webhooks")
@Tag(name = "Webhooks", description = "Webhook設定管理API")
public class WebhookController {

    private final WebhookService webhookService;
    private final WebhookDeliveryService deliveryService;

    @PostMapping("/configurations")
    @Operation(
        summary = "Webhook設定作成",
        description = "新しいWebhook設定を作成します"
    )
    public ResponseEntity<WebhookConfiguration> createWebhook(
        @Valid @RequestBody CreateWebhookRequest request
    ) {
        WebhookConfiguration webhook = webhookService.createWebhook(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(webhook);
    }

    @GetMapping("/configurations")
    @Operation(
        summary = "Webhook設定一覧取得",
        description = "登録されているWebhook設定の一覧を取得します"
    )
    public ResponseEntity<List<WebhookConfiguration>> getWebhooks() {
        List<WebhookConfiguration> webhooks = webhookService.getAllWebhooks();
        return ResponseEntity.ok(webhooks);
    }

    @PutMapping("/configurations/{webhookId}")
    @Operation(
        summary = "Webhook設定更新",
        description = "既存のWebhook設定を更新します"
    )
    public ResponseEntity<WebhookConfiguration> updateWebhook(
        @PathVariable String webhookId,
        @Valid @RequestBody UpdateWebhookRequest request
    ) {
        WebhookConfiguration webhook = webhookService.updateWebhook(webhookId, request);
        return ResponseEntity.ok(webhook);
    }

    @DeleteMapping("/configurations/{webhookId}")
    @Operation(
        summary = "Webhook設定削除",
        description = "指定されたWebhook設定を削除します"
    )
    public ResponseEntity<Void> deleteWebhook(@PathVariable String webhookId) {
        webhookService.deleteWebhook(webhookId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/configurations/{webhookId}/test")
    @Operation(
        summary = "Webhookテスト送信",
        description = "指定されたWebhookにテストイベントを送信します"
    )
    public ResponseEntity<WebhookDelivery> testWebhook(
        @PathVariable String webhookId,
        @RequestBody TestWebhookRequest request
    ) {
        WebhookDelivery delivery = webhookService.testWebhook(webhookId, request);
        return ResponseEntity.ok(delivery);
    }

    @GetMapping("/deliveries")
    @Operation(
        summary = "Webhook配信履歴取得",
        description = "Webhookの配信履歴を取得します"
    )
    public ResponseEntity<PagedResponse<WebhookDelivery>> getDeliveries(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size,
        @RequestParam(required = false) String webhookId,
        @RequestParam(required = false) String eventType
    ) {
        PagedResponse<WebhookDelivery> deliveries = deliveryService.getDeliveries(
            page, size, webhookId, eventType
        );
        return ResponseEntity.ok(deliveries);
    }

    @PostMapping("/deliveries/{deliveryId}/retry")
    @Operation(
        summary = "Webhook再送信",
        description = "失敗したWebhookを手動で再送信します"
    )
    public ResponseEntity<WebhookDelivery> retryDelivery(
        @PathVariable String deliveryId
    ) {
        WebhookDelivery delivery = deliveryService.retryDelivery(deliveryId);
        return ResponseEntity.ok(delivery);
    }
}
```

### Webhook送信サービス実装

```java
@Service
@Slf4j
public class WebhookDeliveryService {

    private final WebhookConfigurationRepository webhookRepository;
    private final WebhookDeliveryRepository deliveryRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /**
     * イベントを全ての該当Webhookに送信
     */
    @Async
    public void deliverEvent(WebhookEvent event) {
        List<WebhookConfiguration> webhooks = webhookRepository
            .findByEventsContainingAndActiveTrue(event.getEventType());

        for (WebhookConfiguration webhook : webhooks) {
            deliverToWebhook(webhook, event);
        }
    }

    /**
     * 特定のWebhookにイベントを送信
     */
    @Retryable(value = {HttpServerErrorException.class}, maxAttempts = 3)
    public WebhookDelivery deliverToWebhook(WebhookConfiguration webhook, WebhookEvent event) {
        WebhookDelivery delivery = createDeliveryRecord(webhook, event);

        try {
            // HTTPヘッダーを設定
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            // カスタムヘッダーを追加
            if (webhook.getHeaders() != null) {
                webhook.getHeaders().forEach(headers::set);
            }

            // 署名を生成
            String payload = objectMapper.writeValueAsString(event);
            String signature = generateSignature(payload, webhook.getSecret());
            headers.set("X-Webhook-Signature", signature);

            // リクエストを作成
            HttpEntity<String> request = new HttpEntity<>(payload, headers);

            // Webhookを送信
            long startTime = System.currentTimeMillis();
            ResponseEntity<String> response = restTemplate.exchange(
                webhook.getUrl(),
                HttpMethod.POST,
                request,
                String.class
            );
            long responseTime = System.currentTimeMillis() - startTime;

            // 成功を記録
            delivery.setHttpStatus(response.getStatusCodeValue());
            delivery.setResponseTime((int) responseTime);
            delivery.setTimestamp(LocalDateTime.now());

            log.info("Webhook delivered successfully: {} to {}", 
                     event.getEventId(), webhook.getUrl());

        } catch (HttpClientErrorException | HttpServerErrorException e) {
            // HTTPエラーを記録
            delivery.setHttpStatus(e.getRawStatusCode());
            delivery.setErrorMessage(e.getMessage());
            
            log.warn("Webhook delivery failed: {} to {} - Status: {}", 
                     event.getEventId(), webhook.getUrl(), e.getRawStatusCode());

            // リトライ対象のエラーの場合はスケジュール
            if (shouldRetry(e.getRawStatusCode()) && delivery.getRetryCount() < webhook.getRetryPolicy().getMaxRetries()) {
                scheduleRetry(delivery, webhook.getRetryPolicy());
            }

        } catch (Exception e) {
            // その他のエラーを記録
            delivery.setHttpStatus(0);
            delivery.setErrorMessage(e.getMessage());
            
            log.error("Webhook delivery error: {} to {}", 
                      event.getEventId(), webhook.getUrl(), e);
        }

        return deliveryRepository.save(delivery);
    }

    /**
     * HMAC-SHA256署名を生成
     */
    private String generateSignature(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKey = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
            mac.init(secretKey);
            byte[] signature = mac.doFinal(payload.getBytes());
            return "sha256=" + Hex.encodeHexString(signature);
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate webhook signature", e);
        }
    }

    /**
     * リトライスケジューリング
     */
    @Async
    public void scheduleRetry(WebhookDelivery delivery, RetryPolicy retryPolicy) {
        int delay = calculateRetryDelay(delivery.getRetryCount(), retryPolicy);
        
        try {
            Thread.sleep(delay * 1000L);
            
            delivery.setRetryCount(delivery.getRetryCount() + 1);
            delivery.setNextRetry(LocalDateTime.now().plusSeconds(delay));
            
            // リトライ実行
            WebhookConfiguration webhook = webhookRepository.findById(delivery.getWebhookId())
                .orElseThrow(() -> new RuntimeException("Webhook configuration not found"));
                
            WebhookEvent event = reconstructEvent(delivery.getEventId());
            deliverToWebhook(webhook, event);
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("Webhook retry interrupted", e);
        }
    }

    /**
     * リトライ遅延時間計算（指数バックオフ）
     */
    private int calculateRetryDelay(int retryCount, RetryPolicy retryPolicy) {
        int baseDelay = retryPolicy.getRetryDelay();
        double multiplier = retryPolicy.getBackoffMultiplier();
        int maxDelay = retryPolicy.getMaxDelay();

        int delay = (int) (baseDelay * Math.pow(multiplier, retryCount));
        return Math.min(delay, maxDelay);
    }

    /**
     * リトライ対象判定
     */
    private boolean shouldRetry(int statusCode) {
        return statusCode >= 500 || statusCode == 408 || statusCode == 429;
    }
}
```

## TypeScript クライアント実装

### Webhook受信サーバー

```typescript
import express from 'express';
import crypto from 'crypto';
import { WebhookEvent, OrderCompletedEvent, PaymentFailedEvent } from './types';

const app = express();

// 生のボディを取得するためのミドルウェア
app.use('/webhooks', express.raw({ type: 'application/json' }));

// Webhook署名検証ミドルウェア
function verifyWebhookSignature(secret: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const signature = req.headers['x-webhook-signature'] as string;
        if (!signature) {
            return res.status(401).json({ error: 'Missing signature' });
        }

        const expectedSignature = 'sha256=' + crypto
            .createHmac('sha256', secret)
            .update(req.body)
            .digest('hex');

        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
            return res.status(401).json({ error: 'Invalid signature' });
        }

        // JSONとしてパース
        try {
            req.body = JSON.parse(req.body.toString());
            next();
        } catch (error) {
            return res.status(400).json({ error: 'Invalid JSON' });
        }
    };
}

/**
 * Webhook受信エンドポイント
 */
app.post('/webhooks/orders', 
    verifyWebhookSignature(process.env.WEBHOOK_SECRET!),
    async (req: express.Request, res: express.Response) => {
        try {
            const event: WebhookEvent = req.body;

            // イベントタイプに基づく処理
            switch (event.eventType) {
                case 'order.completed':
                    await handleOrderCompleted(event as OrderCompletedEvent);
                    break;
                case 'payment.failed':
                    await handlePaymentFailed(event as PaymentFailedEvent);
                    break;
                default:
                    console.log(`Unhandled event type: ${event.eventType}`);
            }

            // 成功レスポンス
            res.status(200).json({ 
                received: true, 
                eventId: event.eventId 
            });

        } catch (error) {
            console.error('Webhook processing error:', error);
            res.status(500).json({ 
                error: 'Processing failed',
                eventId: req.body?.eventId 
            });
        }
    }
);

/**
 * 注文完了イベント処理
 */
async function handleOrderCompleted(event: OrderCompletedEvent): Promise<void> {
    const { orderId, customerId, totalAmount, items } = event.data;

    console.log(`Order completed: ${orderId} for customer ${customerId}`);

    // 在庫更新
    await updateInventory(items);

    // 顧客通知
    await sendCustomerNotification(customerId, orderId);

    // 分析データ更新
    await updateAnalytics({
        orderId,
        customerId,
        totalAmount,
        itemCount: items.length,
        timestamp: event.timestamp
    });

    // 外部システム連携
    await syncWithExternalSystems(event.data);
}

/**
 * 決済失敗イベント処理
 */
async function handlePaymentFailed(event: PaymentFailedEvent): Promise<void> {
    const { paymentId, orderId, customerId, failureReason, nextAction } = event.data;

    console.log(`Payment failed: ${paymentId} for order ${orderId} - Reason: ${failureReason}`);

    // 注文ステータス更新
    await updateOrderStatus(orderId, 'payment_failed');

    // 顧客通知
    await sendPaymentFailureNotification(customerId, orderId, failureReason);

    // 次のアクションに基づく処理
    switch (nextAction) {
        case 'retry':
            await schedulePaymentRetry(paymentId);
            break;
        case 'update_payment_method':
            await requestPaymentMethodUpdate(customerId, orderId);
            break;
        case 'contact_customer':
            await createCustomerSupportTicket(customerId, orderId, failureReason);
            break;
    }

    // 失敗分析
    await recordPaymentFailure({
        paymentId,
        orderId,
        customerId,
        failureReason,
        timestamp: event.timestamp
    });
}

// ヘルパー関数（実装は省略）
async function updateInventory(items: any[]): Promise<void> {
    // 在庫数を減算
}

async function sendCustomerNotification(customerId: string, orderId: string): Promise<void> {
    // メール・SMS通知送信
}

async function updateAnalytics(data: any): Promise<void> {
    // 分析データベース更新
}

async function syncWithExternalSystems(orderData: any): Promise<void> {
    // ERP、CRM等の外部システム連携
}

async function updateOrderStatus(orderId: string, status: string): Promise<void> {
    // 注文ステータス更新
}

async function sendPaymentFailureNotification(customerId: string, orderId: string, reason: string): Promise<void> {
    // 決済失敗通知
}

async function schedulePaymentRetry(paymentId: string): Promise<void> {
    // 決済リトライスケジューリング
}

async function requestPaymentMethodUpdate(customerId: string, orderId: string): Promise<void> {
    // 決済方法更新依頼
}

async function createCustomerSupportTicket(customerId: string, orderId: string, reason: string): Promise<void> {
    // カスタマーサポートチケット作成
}

async function recordPaymentFailure(data: any): Promise<void> {
    // 決済失敗データ記録
}

// エラーハンドリング
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Webhook error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        eventId: req.body?.eventId 
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Webhook server listening on port ${PORT}`);
});
```

### Webhook管理クライアント

```typescript
import { WebhookConfiguration, CreateWebhookRequest, WebhookDelivery } from './types';

export class WebhookClient {
    private baseUrl: string;
    private apiKey: string;

    constructor(baseUrl: string, apiKey: string) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }

    /**
     * Webhook設定作成
     */
    async createWebhook(request: CreateWebhookRequest): Promise<WebhookConfiguration> {
        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/configurations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`Failed to create webhook: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Webhook設定一覧取得
     */
    async getWebhooks(): Promise<WebhookConfiguration[]> {
        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/configurations`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get webhooks: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Webhook設定更新
     */
    async updateWebhook(webhookId: string, request: Partial<CreateWebhookRequest>): Promise<WebhookConfiguration> {
        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/configurations/${webhookId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify(request)
        });

        if (!response.ok) {
            throw new Error(`Failed to update webhook: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Webhook設定削除
     */
    async deleteWebhook(webhookId: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/configurations/${webhookId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to delete webhook: ${response.statusText}`);
        }
    }

    /**
     * Webhookテスト送信
     */
    async testWebhook(webhookId: string, eventType: string): Promise<WebhookDelivery> {
        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/configurations/${webhookId}/test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({ eventType })
        });

        if (!response.ok) {
            throw new Error(`Failed to test webhook: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Webhook配信履歴取得
     */
    async getDeliveries(options: {
        page?: number;
        size?: number;
        webhookId?: string;
        eventType?: string;
    } = {}): Promise<{ deliveries: WebhookDelivery[]; totalPages: number }> {
        const params = new URLSearchParams();
        if (options.page) params.append('page', options.page.toString());
        if (options.size) params.append('size', options.size.toString());
        if (options.webhookId) params.append('webhookId', options.webhookId);
        if (options.eventType) params.append('eventType', options.eventType);

        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/deliveries?${params}`, {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get deliveries: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Webhook再送信
     */
    async retryDelivery(deliveryId: string): Promise<WebhookDelivery> {
        const response = await fetch(`${this.baseUrl}/api/v1/webhooks/deliveries/${deliveryId}/retry`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to retry delivery: ${response.statusText}`);
        }

        return await response.json();
    }
}

// 使用例
const webhookClient = new WebhookClient(
    'https://api.example.com',
    'your-api-key'
);

// Webhook設定を作成
const webhook = await webhookClient.createWebhook({
    url: 'https://your-app.com/webhooks/orders',
    events: ['order.completed', 'payment.failed'],
    active: true,
    secret: 'your-webhook-secret',
    retryPolicy: {
        maxRetries: 3,
        retryDelay: 60,
        backoffMultiplier: 2.0,
        maxDelay: 1800
    }
});

console.log('Webhook created:', webhook.webhookId);
```

## セキュリティ実装

### 署名検証（詳細）

```typescript
import crypto from 'crypto';

export class WebhookSecurity {
    /**
     * HMAC-SHA256署名生成
     */
    static generateSignature(payload: string, secret: string): string {
        const signature = crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('hex');
        return `sha256=${signature}`;
    }

    /**
     * 署名検証
     */
    static verifySignature(payload: string, signature: string, secret: string): boolean {
        const expectedSignature = this.generateSignature(payload, secret);
        
        // タイミング攻撃を防ぐために crypto.timingSafeEqual を使用
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * タイムスタンプ検証（リプレイ攻撃防止）
     */
    static verifyTimestamp(timestamp: string, tolerance: number = 300): boolean {
        const eventTime = new Date(timestamp).getTime();
        const currentTime = Date.now();
        const timeDiff = Math.abs(currentTime - eventTime) / 1000;
        
        return timeDiff <= tolerance;
    }

    /**
     * IPアドレス検証
     */
    static verifySourceIP(clientIP: string, allowedIPs: string[]): boolean {
        return allowedIPs.includes(clientIP);
    }
}
```

## 監視・ログ実装

### Webhook配信監視

```typescript
export class WebhookMonitoring {
    private metricsCollector: MetricsCollector;
    private alertManager: AlertManager;

    /**
     * 配信成功率監視
     */
    monitorDeliverySuccess(delivery: WebhookDelivery): void {
        const isSuccess = delivery.httpStatus >= 200 && delivery.httpStatus < 300;
        
        this.metricsCollector.recordDelivery({
            webhookId: delivery.webhookId,
            eventType: delivery.eventType,
            success: isSuccess,
            responseTime: delivery.responseTime,
            retryCount: delivery.retryCount
        });

        // 失敗率が閾値を超えた場合のアラート
        const failureRate = this.calculateFailureRate(delivery.webhookId);
        if (failureRate > 0.1) { // 10%以上の失敗率
            this.alertManager.sendAlert({
                type: 'webhook_high_failure_rate',
                webhookId: delivery.webhookId,
                failureRate: failureRate,
                message: `Webhook ${delivery.webhookId} has high failure rate: ${failureRate * 100}%`
            });
        }
    }

    /**
     * レスポンス時間監視
     */
    monitorResponseTime(delivery: WebhookDelivery): void {
        if (delivery.responseTime > 5000) { // 5秒以上
            this.alertManager.sendAlert({
                type: 'webhook_slow_response',
                webhookId: delivery.webhookId,
                responseTime: delivery.responseTime,
                message: `Webhook ${delivery.webhookId} has slow response: ${delivery.responseTime}ms`
            });
        }
    }

    private calculateFailureRate(webhookId: string): number {
        // 過去24時間の失敗率を計算
        const deliveries = this.getRecentDeliveries(webhookId, 24);
        const failures = deliveries.filter(d => d.httpStatus >= 400).length;
        return failures / deliveries.length;
    }
}
```

この包括的なWebhooks実装により、イベント駆動アーキテクチャでの確実なリアルタイム通信を実現できます。