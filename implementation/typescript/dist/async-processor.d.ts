import { EventEmitter } from 'events';
import { WebhookEvent, WebhookRegistration } from './webhook';
export interface QueueItem {
    id: string;
    webhook: WebhookRegistration;
    event: WebhookEvent;
    attempts: number;
    maxAttempts: number;
    nextRetry: Date;
    created: Date;
}
export interface ProcessorConfig {
    maxConcurrency?: number;
    retryDelayMs?: number;
    maxRetryDelayMs?: number;
    exponentialBackoff?: boolean;
    queueLimit?: number;
    processingTimeoutMs?: number;
}
/**
 * Asynchronous processor for webhook delivery with retry logic and queue management
 */
export declare class AsyncWebhookProcessor extends EventEmitter {
    private queue;
    private processing;
    private config;
    private processingInterval?;
    private isRunning;
    constructor(config?: ProcessorConfig);
    /**
     * Start the async processor
     */
    start(): void;
    /**
     * Stop the async processor
     */
    stop(): Promise<void>;
    /**
     * Add webhook delivery to queue
     */
    enqueue(webhook: WebhookRegistration, event: WebhookEvent, maxAttempts?: number): boolean;
    /**
     * Process items in the queue
     */
    private processQueue;
    /**
     * Process a single queue item
     */
    private processItem;
    /**
     * Handle failed webhook delivery
     */
    private handleFailure;
    /**
     * Calculate retry delay with exponential backoff
     */
    private calculateRetryDelay;
    /**
     * Create a timeout promise
     */
    private createTimeout;
    /**
     * Deliver webhook (placeholder - implement actual HTTP delivery)
     */
    private deliverWebhook;
    /**
     * Generate webhook signature
     */
    private generateSignature;
    /**
     * Get queue statistics
     */
    getStats(): {
        queueSize: number;
        processing: number;
        isRunning: boolean;
        config: ProcessorConfig;
    };
    /**
     * Get items in queue (for monitoring)
     */
    getQueueItems(): QueueItem[];
    /**
     * Clear all items from queue
     */
    clearQueue(): void;
    /**
     * Remove specific item from queue
     */
    removeFromQueue(itemId: string): boolean;
    /**
     * Update processor configuration
     */
    updateConfig(newConfig: Partial<ProcessorConfig>): void;
    /**
     * Force process all ready items immediately
     */
    forceProcessQueue(): Promise<void>;
    /**
     * Get items by webhook ID
     */
    getItemsByWebhook(webhookId: string): QueueItem[];
    /**
     * Get items by event type
     */
    getItemsByEventType(eventType: string): QueueItem[];
    /**
     * Retry specific failed item immediately
     */
    retryItem(itemId: string): boolean;
}
