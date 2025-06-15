import { EventEmitter } from 'events';
import { AuthService, AuthConfig } from './auth';
import { AsyncWebhookProcessor, ProcessorConfig } from './async-processor';
export interface WebhookConfig {
    port?: number;
    secret?: string;
    enableAuth?: boolean;
    authConfig?: AuthConfig;
    enableRateLimit?: boolean;
    maxRequests?: number;
    rateLimitWindowMs?: number;
    enableAsyncProcessing?: boolean;
    processorConfig?: ProcessorConfig;
}
export interface WebhookEvent {
    id: string;
    type: 'api.spec.changed' | 'api.spec.validated' | 'api.generation.completed';
    timestamp: Date;
    data: {
        specUrl?: string;
        specPath?: string;
        changes?: string[];
        errors?: string[];
        generatedFiles?: string[];
    };
    signature?: string;
}
export interface WebhookRegistration {
    id: string;
    url: string;
    events: string[];
    secret?: string;
    active: boolean;
    created: Date;
    lastTriggered?: Date;
}
/**
 * Webhook service for handling API change notifications
 * Implements webhook endpoints for external systems to register for notifications
 */
export declare class WebhookService extends EventEmitter {
    private registrations;
    private app;
    private server?;
    private config;
    private authService;
    private processor?;
    constructor(config?: WebhookConfig);
    /**
     * Setup async processor event handlers
     */
    private setupProcessorEvents;
    /**
     * Setup Express routes for webhook management
     */
    private setupRoutes;
    /**
     * Handle webhook registration
     */
    private handleRegister;
    /**
     * Handle listing all webhooks
     */
    private handleListWebhooks;
    /**
     * Handle getting a specific webhook
     */
    private handleGetWebhook;
    /**
     * Handle updating a webhook
     */
    private handleUpdateWebhook;
    /**
     * Handle deleting a webhook
     */
    private handleDeleteWebhook;
    /**
     * Start the webhook service
     */
    start(): Promise<void>;
    /**
     * Stop the webhook service
     */
    stop(): Promise<void>;
    /**
     * Trigger a webhook event
     */
    triggerEvent(event: Omit<WebhookEvent, 'id' | 'timestamp' | 'signature'>): Promise<void>;
    /**
     * Send webhook to a specific endpoint
     */
    private sendWebhook;
    /**
     * Generate HMAC signature for webhook security
     */
    private generateSignature;
    /**
     * Verify webhook signature
     */
    verifySignature(payload: string, signature: string, secret?: string): boolean;
    /**
     * Get webhook statistics
     */
    getStats(): {
        totalWebhooks: number;
        activeWebhooks: number;
        eventTypes: string[];
    };
    /**
     * Get auth service for external configuration
     */
    getAuthService(): AuthService;
    /**
     * Update authentication configuration
     */
    updateAuthConfig(authConfig: AuthConfig): void;
    /**
     * Get async processor for monitoring
     */
    getProcessor(): AsyncWebhookProcessor | undefined;
    /**
     * Update processor configuration
     */
    updateProcessorConfig(processorConfig: ProcessorConfig): void;
}
