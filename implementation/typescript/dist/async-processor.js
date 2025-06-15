"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncWebhookProcessor = void 0;
const events_1 = require("events");
/**
 * Asynchronous processor for webhook delivery with retry logic and queue management
 */
class AsyncWebhookProcessor extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.queue = new Map();
        this.processing = new Set();
        this.isRunning = false;
        this.config = {
            maxConcurrency: 5,
            retryDelayMs: 1000,
            maxRetryDelayMs: 60000,
            exponentialBackoff: true,
            queueLimit: 1000,
            processingTimeoutMs: 30000,
            ...config
        };
    }
    /**
     * Start the async processor
     */
    start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        this.processingInterval = setInterval(() => {
            this.processQueue();
        }, 1000); // Process every second
        this.emit('processor.started');
    }
    /**
     * Stop the async processor
     */
    async stop() {
        this.isRunning = false;
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = undefined;
        }
        // Wait for current processing to complete
        while (this.processing.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        this.emit('processor.stopped');
    }
    /**
     * Add webhook delivery to queue
     */
    enqueue(webhook, event, maxAttempts = 3) {
        if (this.queue.size >= this.config.queueLimit) {
            this.emit('queue.full', { webhook, event });
            return false;
        }
        const queueItem = {
            id: `${webhook.id}-${event.id}`,
            webhook,
            event,
            attempts: 0,
            maxAttempts,
            nextRetry: new Date(),
            created: new Date()
        };
        this.queue.set(queueItem.id, queueItem);
        this.emit('item.queued', queueItem);
        return true;
    }
    /**
     * Process items in the queue
     */
    async processQueue() {
        if (!this.isRunning) {
            return;
        }
        const availableSlots = this.config.maxConcurrency - this.processing.size;
        if (availableSlots <= 0) {
            return;
        }
        const now = new Date();
        const readyItems = Array.from(this.queue.values())
            .filter(item => !this.processing.has(item.id) && item.nextRetry <= now)
            .sort((a, b) => a.created.getTime() - b.created.getTime())
            .slice(0, availableSlots);
        for (const item of readyItems) {
            this.processItem(item);
        }
    }
    /**
     * Process a single queue item
     */
    async processItem(item) {
        this.processing.add(item.id);
        item.attempts++;
        try {
            this.emit('item.processing', item);
            const success = await Promise.race([
                this.deliverWebhook(item.webhook, item.event),
                this.createTimeout(this.config.processingTimeoutMs)
            ]);
            if (success) {
                // Success - remove from queue
                this.queue.delete(item.id);
                this.emit('item.success', item);
            }
            else {
                // Failed - retry if attempts remaining
                await this.handleFailure(item);
            }
        }
        catch (error) {
            // Error - retry if attempts remaining
            this.emit('item.error', { item, error });
            await this.handleFailure(item);
        }
        finally {
            this.processing.delete(item.id);
        }
    }
    /**
     * Handle failed webhook delivery
     */
    async handleFailure(item) {
        if (item.attempts >= item.maxAttempts) {
            // Max attempts reached - remove from queue
            this.queue.delete(item.id);
            this.emit('item.failed', item);
            return;
        }
        // Calculate next retry time
        const delay = this.calculateRetryDelay(item.attempts);
        item.nextRetry = new Date(Date.now() + delay);
        this.emit('item.retry', { item, delay });
    }
    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(attempt) {
        if (!this.config.exponentialBackoff) {
            return this.config.retryDelayMs;
        }
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        return Math.min(delay, this.config.maxRetryDelayMs);
    }
    /**
     * Create a timeout promise
     */
    createTimeout(ms) {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Processing timeout')), ms);
        });
    }
    /**
     * Deliver webhook (placeholder - implement actual HTTP delivery)
     */
    async deliverWebhook(webhook, event) {
        try {
            const payload = JSON.stringify(event);
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': this.generateSignature(payload, webhook.secret),
                    'User-Agent': 'OpenAPI-CodeGenerator-Webhook/1.0'
                },
                body: payload
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            // Update webhook last triggered timestamp
            webhook.lastTriggered = new Date();
            return true;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Generate webhook signature
     */
    generateSignature(payload, secret) {
        if (!secret) {
            return '';
        }
        const crypto = require('crypto');
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }
    /**
     * Get queue statistics
     */
    getStats() {
        return {
            queueSize: this.queue.size,
            processing: this.processing.size,
            isRunning: this.isRunning,
            config: this.config
        };
    }
    /**
     * Get items in queue (for monitoring)
     */
    getQueueItems() {
        return Array.from(this.queue.values()).sort((a, b) => a.created.getTime() - b.created.getTime());
    }
    /**
     * Clear all items from queue
     */
    clearQueue() {
        const clearedCount = this.queue.size;
        this.queue.clear();
        this.emit('queue.cleared', { clearedCount });
    }
    /**
     * Remove specific item from queue
     */
    removeFromQueue(itemId) {
        const removed = this.queue.delete(itemId);
        if (removed) {
            this.emit('item.removed', { itemId });
        }
        return removed;
    }
    /**
     * Update processor configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('config.updated', this.config);
    }
    /**
     * Force process all ready items immediately
     */
    async forceProcessQueue() {
        await this.processQueue();
    }
    /**
     * Get items by webhook ID
     */
    getItemsByWebhook(webhookId) {
        return Array.from(this.queue.values()).filter(item => item.webhook.id === webhookId);
    }
    /**
     * Get items by event type
     */
    getItemsByEventType(eventType) {
        return Array.from(this.queue.values()).filter(item => item.event.type === eventType);
    }
    /**
     * Retry specific failed item immediately
     */
    retryItem(itemId) {
        const item = this.queue.get(itemId);
        if (!item) {
            return false;
        }
        item.nextRetry = new Date();
        this.emit('item.retry.manual', item);
        return true;
    }
}
exports.AsyncWebhookProcessor = AsyncWebhookProcessor;
//# sourceMappingURL=async-processor.js.map