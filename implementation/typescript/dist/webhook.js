"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookService = void 0;
const crypto = __importStar(require("crypto"));
const express_1 = __importDefault(require("express"));
const events_1 = require("events");
const auth_1 = require("./auth");
const async_processor_1 = require("./async-processor");
/**
 * Webhook service for handling API change notifications
 * Implements webhook endpoints for external systems to register for notifications
 */
class WebhookService extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.registrations = new Map();
        this.config = {
            port: 3001,
            secret: process.env.WEBHOOK_SECRET || 'default-secret',
            enableAuth: true,
            enableRateLimit: true,
            maxRequests: 100,
            rateLimitWindowMs: 60000,
            enableAsyncProcessing: true,
            authConfig: {},
            processorConfig: {},
            ...config
        };
        this.authService = new auth_1.AuthService(this.config.authConfig);
        if (this.config.enableAsyncProcessing) {
            this.processor = new async_processor_1.AsyncWebhookProcessor(this.config.processorConfig);
            this.setupProcessorEvents();
        }
        this.app = (0, express_1.default)();
        this.setupRoutes();
    }
    /**
     * Setup async processor event handlers
     */
    setupProcessorEvents() {
        if (!this.processor)
            return;
        this.processor.on('item.success', (item) => {
            this.emit('webhook.success', { registration: item.webhook, event: item.event });
        });
        this.processor.on('item.failed', (item) => {
            this.emit('webhook.error', {
                registration: item.webhook,
                event: item.event,
                error: new Error(`Failed after ${item.maxAttempts} attempts`)
            });
        });
        this.processor.on('item.error', ({ item, error }) => {
            this.emit('webhook.error', {
                registration: item.webhook,
                event: item.event,
                error
            });
        });
    }
    /**
     * Setup Express routes for webhook management
     */
    setupRoutes() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Apply rate limiting if enabled
        if (this.config.enableRateLimit) {
            this.app.use(this.authService.rateLimit(this.config.maxRequests, this.config.rateLimitWindowMs));
        }
        // Health check endpoint (no auth required)
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });
        // Apply authentication middleware to all webhook routes if enabled
        if (this.config.enableAuth) {
            this.app.use('/webhooks', this.authService.authenticate());
        }
        // Webhook registration endpoint
        this.app.post('/webhooks/register', this.config.enableAuth ? this.authService.authorize(['webhook.write']) : (req, res, next) => next(), this.handleRegister.bind(this));
        // Webhook management endpoints
        this.app.get('/webhooks', this.config.enableAuth ? this.authService.authorize(['webhook.read']) : (req, res, next) => next(), this.handleListWebhooks.bind(this));
        this.app.get('/webhooks/:id', this.config.enableAuth ? this.authService.authorize(['webhook.read']) : (req, res, next) => next(), this.handleGetWebhook.bind(this));
        this.app.put('/webhooks/:id', this.config.enableAuth ? this.authService.authorize(['webhook.write']) : (req, res, next) => next(), this.handleUpdateWebhook.bind(this));
        this.app.delete('/webhooks/:id', this.config.enableAuth ? this.authService.authorize(['webhook.admin']) : (req, res, next) => next(), this.handleDeleteWebhook.bind(this));
        // Error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Webhook service error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });
    }
    /**
     * Handle webhook registration
     */
    async handleRegister(req, res) {
        try {
            const { url, events, secret } = req.body;
            if (!url || !Array.isArray(events) || events.length === 0) {
                res.status(400).json({ error: 'URL and events are required' });
                return;
            }
            const registration = {
                id: crypto.randomUUID(),
                url,
                events,
                secret,
                active: true,
                created: new Date()
            };
            this.registrations.set(registration.id, registration);
            res.status(201).json({
                id: registration.id,
                message: 'Webhook registered successfully'
            });
        }
        catch (error) {
            console.error('Error registering webhook:', error);
            res.status(500).json({ error: 'Failed to register webhook' });
        }
    }
    /**
     * Handle listing all webhooks
     */
    async handleListWebhooks(req, res) {
        try {
            const webhooks = Array.from(this.registrations.values()).map(reg => ({
                ...reg,
                secret: reg.secret ? '[HIDDEN]' : undefined
            }));
            res.json({ webhooks });
        }
        catch (error) {
            console.error('Error listing webhooks:', error);
            res.status(500).json({ error: 'Failed to list webhooks' });
        }
    }
    /**
     * Handle getting a specific webhook
     */
    async handleGetWebhook(req, res) {
        try {
            const { id } = req.params;
            const registration = this.registrations.get(id);
            if (!registration) {
                res.status(404).json({ error: 'Webhook not found' });
                return;
            }
            res.json({
                ...registration,
                secret: registration.secret ? '[HIDDEN]' : undefined
            });
        }
        catch (error) {
            console.error('Error getting webhook:', error);
            res.status(500).json({ error: 'Failed to get webhook' });
        }
    }
    /**
     * Handle updating a webhook
     */
    async handleUpdateWebhook(req, res) {
        try {
            const { id } = req.params;
            const registration = this.registrations.get(id);
            if (!registration) {
                res.status(404).json({ error: 'Webhook not found' });
                return;
            }
            const { url, events, secret, active } = req.body;
            if (url)
                registration.url = url;
            if (Array.isArray(events))
                registration.events = events;
            if (secret !== undefined)
                registration.secret = secret;
            if (active !== undefined)
                registration.active = active;
            this.registrations.set(id, registration);
            res.json({ message: 'Webhook updated successfully' });
        }
        catch (error) {
            console.error('Error updating webhook:', error);
            res.status(500).json({ error: 'Failed to update webhook' });
        }
    }
    /**
     * Handle deleting a webhook
     */
    async handleDeleteWebhook(req, res) {
        try {
            const { id } = req.params;
            if (!this.registrations.has(id)) {
                res.status(404).json({ error: 'Webhook not found' });
                return;
            }
            this.registrations.delete(id);
            res.json({ message: 'Webhook deleted successfully' });
        }
        catch (error) {
            console.error('Error deleting webhook:', error);
            res.status(500).json({ error: 'Failed to delete webhook' });
        }
    }
    /**
     * Start the webhook service
     */
    async start() {
        // Start async processor if enabled
        if (this.processor) {
            this.processor.start();
        }
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, () => {
                    console.log(`Webhook service started on port ${this.config.port}`);
                    resolve();
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    /**
     * Stop the webhook service
     */
    async stop() {
        // Stop async processor if enabled
        if (this.processor) {
            await this.processor.stop();
        }
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('Webhook service stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    /**
     * Trigger a webhook event
     */
    async triggerEvent(event) {
        const webhookEvent = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            signature: this.generateSignature(event.data),
            ...event
        };
        // Find relevant webhooks
        const relevantWebhooks = Array.from(this.registrations.values())
            .filter(reg => reg.active && reg.events.includes(event.type));
        if (this.processor && this.config.enableAsyncProcessing) {
            // Use async processor for webhook delivery
            let enqueuedCount = 0;
            for (const webhook of relevantWebhooks) {
                const enqueued = this.processor.enqueue(webhook, webhookEvent);
                if (enqueued) {
                    enqueuedCount++;
                }
            }
            this.emit('event.triggered', { event: webhookEvent, webhooks: enqueuedCount });
        }
        else {
            // Direct delivery (synchronous)
            const promises = relevantWebhooks.map(webhook => this.sendWebhook(webhook, webhookEvent));
            try {
                await Promise.allSettled(promises);
                this.emit('event.triggered', { event: webhookEvent, webhooks: relevantWebhooks.length });
            }
            catch (error) {
                console.error('Error triggering webhooks:', error);
                this.emit('event.error', { event: webhookEvent, error });
            }
        }
    }
    /**
     * Send webhook to a specific endpoint
     */
    async sendWebhook(registration, event) {
        try {
            const payload = JSON.stringify(event);
            const signature = this.generateSignature(payload, registration.secret || this.config.secret);
            const response = await fetch(registration.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Signature': signature,
                    'User-Agent': 'OpenAPI-CodeGenerator-Webhook/1.0'
                },
                body: payload
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            // Update last triggered timestamp
            registration.lastTriggered = new Date();
            this.registrations.set(registration.id, registration);
            this.emit('webhook.success', { registration, event });
        }
        catch (error) {
            console.error(`Failed to send webhook to ${registration.url}:`, error);
            this.emit('webhook.error', { registration, event, error });
        }
    }
    /**
     * Generate HMAC signature for webhook security
     */
    generateSignature(data, secret) {
        const secretKey = secret || this.config.secret;
        const payload = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
    }
    /**
     * Verify webhook signature
     */
    verifySignature(payload, signature, secret) {
        const expectedSignature = this.generateSignature(payload, secret);
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    }
    /**
     * Get webhook statistics
     */
    getStats() {
        const webhooks = Array.from(this.registrations.values());
        const eventTypes = [...new Set(webhooks.flatMap(w => w.events))];
        return {
            totalWebhooks: webhooks.length,
            activeWebhooks: webhooks.filter(w => w.active).length,
            eventTypes
        };
    }
    /**
     * Get auth service for external configuration
     */
    getAuthService() {
        return this.authService;
    }
    /**
     * Update authentication configuration
     */
    updateAuthConfig(authConfig) {
        this.authService = new auth_1.AuthService(authConfig);
        this.config.authConfig = authConfig;
    }
    /**
     * Get async processor for monitoring
     */
    getProcessor() {
        return this.processor;
    }
    /**
     * Update processor configuration
     */
    updateProcessorConfig(processorConfig) {
        if (this.processor) {
            this.processor.updateConfig(processorConfig);
        }
        this.config.processorConfig = processorConfig;
    }
}
exports.WebhookService = WebhookService;
//# sourceMappingURL=webhook.js.map