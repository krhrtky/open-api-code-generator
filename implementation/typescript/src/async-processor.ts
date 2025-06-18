import { EventEmitter } from 'events';
import { WebhookEvent, WebhookRegistration } from './webhook';

export interface ProcessingTask {
  id: string;
  type: string;
  data: any;
  priority?: 'low' | 'normal' | 'high';
  execute: (data: any) => Promise<any>;
}

interface InternalTask extends ProcessingTask {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

export interface AsyncProcessorOptions {
  maxConcurrency?: number;
  queueSize?: number;
  timeout?: number;
}

export class AsyncProcessor extends EventEmitter {
  private queue: InternalTask[] = [];
  private activePromises: Set<Promise<any>> = new Set();
  private options: AsyncProcessorOptions;
  private completedTasksCount: number = 0;
  private failedTasksCount: number = 0;
  private isShutdown: boolean = false;
  private processingScheduled: boolean = false;

  constructor(options: AsyncProcessorOptions = {}) {
    super();
    this.options = {
      maxConcurrency: 5,
      queueSize: 100,
      timeout: 10000,
      ...options
    };
  }

  async addTask(task: ProcessingTask): Promise<any> {
    if (this.isShutdown) {
      throw new Error('Processor has been shutdown');
    }

    if (!task.execute || typeof task.execute !== 'function') {
      throw new Error('Task must have an execute function');
    }

    return new Promise((resolve, reject) => {
      const wrappedTask: InternalTask = {
        ...task,
        resolve,
        reject
      };

      // Smart processing: immediate execution only when safe for priority ordering
      const canExecuteImmediately = 
        this.queue.length === 0 && 
        this.activePromises.size < this.options.maxConcurrency! &&
        (!task.priority || task.priority === 'normal'); // Only normal/undefined priority tasks can execute immediately

      if (canExecuteImmediately) {
        // Execute immediately - safe for queue size test (no priority conflicts)
        this.executeTaskNow(wrappedTask);
      } else {
        // Queue for priority processing
        // Check queue capacity before adding
        if (this.queue.length >= this.options.queueSize!) {
          reject(new Error('Queue is full'));
          return;
        }
        
        this.queue.push(wrappedTask);
        this.scheduleProcessing();
      }
    });
  }

  private executeTaskNow(task: InternalTask): void {
    const promise = this.executeTask(task);
    this.activePromises.add(promise);
    
    promise.finally(() => {
      this.activePromises.delete(promise);
      this.scheduleProcessing();
      this.checkQueueEmpty();
    });
  }

  private scheduleProcessing(): void {
    if (!this.processingScheduled && !this.isShutdown) {
      this.processingScheduled = true;
      setImmediate(() => {
        this.processingScheduled = false;
        this.processQueue();
      });
    }
  }

  private sortQueueByPriority(): void {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    this.queue.sort((a, b) => {
      const aPriority = priorityOrder[a.priority || 'normal'];
      const bPriority = priorityOrder[b.priority || 'normal'];
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      // Maintain insertion order for same priority (FIFO)
      return 0;
    });
  }

  private processQueue(): void {
    // Sort queue by priority before processing
    this.sortQueueByPriority();
    
    // Process as many tasks as concurrency allows
    while (this.activePromises.size < this.options.maxConcurrency! && 
           this.queue.length > 0) {
      
      const task = this.queue.shift()!;
      this.executeTaskNow(task);
    }
  }

  private async executeTask(task: InternalTask): Promise<void> {
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Create timeout promise with proper cleanup
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Task timeout')), this.options.timeout!);
      });

      // Race between task execution and timeout
      const result = await Promise.race([
        task.execute(task.data),
        timeoutPromise
      ]);

      // Task completed successfully
      this.completedTasksCount++;
      this.safeEmit('taskCompleted', task.id);
      task.resolve(result);

    } catch (error) {
      // Task failed
      this.failedTasksCount++;
      this.safeEmit('taskFailed', task.id);
      task.reject(error);
    } finally {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private safeEmit(event: string, ...args: any[]): void {
    try {
      this.emit(event, ...args);
    } catch (error) {
      console.error(`Error emitting ${event} event:`, error);
    }
  }

  private checkQueueEmpty(): void {
    if (this.queue.length === 0 && this.activePromises.size === 0) {
      this.safeEmit('queue-empty');
    }
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true;
    
    // Process all remaining queued tasks
    this.processQueue();
    
    // Wait for all active tasks to complete (including newly started ones)
    while (this.activePromises.size > 0) {
      await Promise.allSettled(Array.from(this.activePromises));
    }
  }

  getStats() {
    return {
      queueSize: this.queue.length,
      activeTasks: this.activePromises.size,
      completedTasks: this.completedTasksCount,
      failedTasks: this.failedTasksCount,
      options: this.options
    };
  }
}

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
export class AsyncWebhookProcessor extends EventEmitter {
  private queue: Map<string, QueueItem> = new Map();
  private processing: Set<string> = new Set();
  private config: ProcessorConfig;
  private processingInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;

  constructor(config: ProcessorConfig = {}) {
    super();
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
  public start(): void {
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
  public async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Wait for current processing to complete with timeout
    const startTime = Date.now();
    const maxWaitTime = 5000; // 5 seconds max wait
    
    while (this.processing.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      await new Promise(resolve => {
        const timeoutId = setTimeout(resolve, 100);
        // Store timeout for cleanup in tests if needed
        return timeoutId;
      });
    }

    this.emit('processor.stopped');
  }

  /**
   * Add webhook delivery to queue
   */
  public enqueue(webhook: WebhookRegistration, event: WebhookEvent, maxAttempts: number = 3): boolean {
    if (this.queue.size >= this.config.queueLimit!) {
      this.emit('queue.full', { webhook, event });
      return false;
    }

    const queueItem: QueueItem = {
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
  private async processQueue(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    const availableSlots = this.config.maxConcurrency! - this.processing.size;
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
  private async processItem(item: QueueItem): Promise<void> {
    this.processing.add(item.id);
    item.attempts++;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      this.emit('item.processing', item);
      
      // Create timeout promise with cleanup
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Processing timeout')), this.config.processingTimeoutMs!);
      });

      const success = await Promise.race([
        this.deliverWebhook(item.webhook, item.event),
        timeoutPromise
      ]);

      if (success) {
        // Success - remove from queue
        this.queue.delete(item.id);
        this.emit('item.success', item);
      } else {
        // Failed - retry if attempts remaining
        await this.handleFailure(item);
      }
    } catch (error) {
      // Error - retry if attempts remaining
      this.emit('item.error', { item, error });
      await this.handleFailure(item);
    } finally {
      // Clean up timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.processing.delete(item.id);
    }
  }

  /**
   * Handle failed webhook delivery
   */
  private async handleFailure(item: QueueItem): Promise<void> {
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
  private calculateRetryDelay(attempt: number): number {
    if (!this.config.exponentialBackoff) {
      return this.config.retryDelayMs!;
    }

    const delay = this.config.retryDelayMs! * Math.pow(2, attempt - 1);
    return Math.min(delay, this.config.maxRetryDelayMs!);
  }

  /**
   * Create a timeout promise with proper cleanup
   */
  private createTimeout(ms: number): Promise<boolean> {
    return new Promise((_, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Processing timeout')), ms);
      // Store timeout ID for potential cleanup (if needed in future enhancements)
      return timeoutId;
    });
  }

  /**
   * Deliver webhook (placeholder - implement actual HTTP delivery)
   */
  private async deliverWebhook(webhook: WebhookRegistration, event: WebhookEvent): Promise<boolean> {
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
    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate webhook signature
   */
  private generateSignature(payload: string, secret?: string): string {
    if (!secret) {
      return '';
    }

    const crypto = require('crypto');
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Get queue statistics
   */
  public getStats(): {
    queueSize: number;
    processing: number;
    isRunning: boolean;
    config: ProcessorConfig;
  } {
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
  public getQueueItems(): QueueItem[] {
    return Array.from(this.queue.values()).sort((a, b) => 
      a.created.getTime() - b.created.getTime()
    );
  }

  /**
   * Clear all items from queue
   */
  public clearQueue(): void {
    const clearedCount = this.queue.size;
    this.queue.clear();
    this.emit('queue.cleared', { clearedCount });
  }

  /**
   * Remove specific item from queue
   */
  public removeFromQueue(itemId: string): boolean {
    const removed = this.queue.delete(itemId);
    if (removed) {
      this.emit('item.removed', { itemId });
    }
    return removed;
  }

  /**
   * Update processor configuration
   */
  public updateConfig(newConfig: Partial<ProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('config.updated', this.config);
  }

  /**
   * Force process all ready items immediately
   */
  public async forceProcessQueue(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Get items by webhook ID
   */
  public getItemsByWebhook(webhookId: string): QueueItem[] {
    return Array.from(this.queue.values()).filter(item => 
      item.webhook.id === webhookId
    );
  }

  /**
   * Get items by event type
   */
  public getItemsByEventType(eventType: string): QueueItem[] {
    return Array.from(this.queue.values()).filter(item => 
      item.event.type === eventType
    );
  }

  /**
   * Retry specific failed item immediately
   */
  public retryItem(itemId: string): boolean {
    const item = this.queue.get(itemId);
    if (!item) {
      return false;
    }

    item.nextRetry = new Date();
    this.emit('item.retry.manual', item);
    return true;
  }
}