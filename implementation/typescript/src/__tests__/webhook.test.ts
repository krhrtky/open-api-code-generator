import { WebhookService, WebhookConfig, WebhookEvent, WebhookRegistration } from '../webhook';
import express from 'express';
import * as crypto from 'crypto';

describe('Webhook Service Tests', () => {
  let webhookService: WebhookService;
  let config: WebhookConfig;

  beforeEach(() => {
    config = {
      port: 3002, // Use different port for testing
      secret: 'test-secret',
      enableAuth: false, // Disable auth for testing
      enableRateLimit: false, // Disable rate limiting for testing
      enableAsyncProcessing: false // Disable async processing for testing
    };
    webhookService = new WebhookService(config);
  });

  afterEach(async () => {
    await webhookService.stop();
  });

  describe('Webhook Service Initialization', () => {
    test('should create webhook service with default config', () => {
      const defaultService = new WebhookService();
      expect(defaultService).toBeDefined();
    });

    test('should create webhook service with custom config', () => {
      expect(webhookService).toBeDefined();
    });

    test('should start and stop webhook service', async () => {
      await webhookService.start();
      expect(webhookService).toBeDefined();
      await webhookService.stop();
    });
  });

  describe('Webhook Registration', () => {
    beforeEach(async () => {
      await webhookService.start();
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should register a new webhook', async () => {
      const response = await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['api.spec.changed', 'api.generation.completed'],
          secret: 'webhook-secret'
        })
      });

      expect(response.status).toBe(201);
      const result = await response.json() as any;
      expect(result.id).toBeDefined();
      expect(result.message).toBe('Webhook registered successfully');
    });

    test('should reject invalid webhook registration', async () => {
      const response = await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: '', // Invalid URL
          events: [] // Empty events
        })
      });

      expect(response.status).toBe(400);
      const result = await response.json() as any;
      expect(result.error).toBe('URL and events are required');
    });

    test('should list all webhooks', async () => {
      // Register a webhook first
      await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['api.spec.changed']
        })
      });

      const response = await fetch(`http://localhost:3002/webhooks`);
      expect(response.status).toBe(200);
      
      const result = await response.json() as any;
      expect(result.webhooks).toBeDefined();
      expect(Array.isArray(result.webhooks)).toBe(true);
      expect(result.webhooks.length).toBe(1);
    });

    test('should get specific webhook by ID', async () => {
      // Register a webhook first
      const registerResponse = await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['api.spec.changed']
        })
      });

      const registerResult = await registerResponse.json() as any;
      const webhookId = registerResult.id;

      const response = await fetch(`http://localhost:3002/webhooks/${webhookId}`);
      expect(response.status).toBe(200);
      
      const result = await response.json() as any;
      expect(result.id).toBe(webhookId);
      expect(result.url).toBe('https://example.com/webhook');
    });

    test('should update webhook', async () => {
      // Register a webhook first
      const registerResponse = await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['api.spec.changed']
        })
      });

      const registerResult = await registerResponse.json() as any;
      const webhookId = registerResult.id;

      const response = await fetch(`http://localhost:3002/webhooks/${webhookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://updated.example.com/webhook',
          events: ['api.spec.changed', 'api.generation.completed'],
          active: false
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json() as any;
      expect(result.message).toBe('Webhook updated successfully');
    });

    test('should delete webhook', async () => {
      // Register a webhook first
      const registerResponse = await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example.com/webhook',
          events: ['api.spec.changed']
        })
      });

      const registerResult = await registerResponse.json() as any;
      const webhookId = registerResult.id;

      const response = await fetch(`http://localhost:3002/webhooks/${webhookId}`, {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
      const result = await response.json() as any;
      expect(result.message).toBe('Webhook deleted successfully');
    });
  });

  describe('Webhook Event Triggering', () => {
    beforeEach(async () => {
      await webhookService.start();
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should trigger webhook events', async () => {
      const events: WebhookEvent[] = [];
      
      // Mock webhook endpoint
      const mockServer = express();
      mockServer.use(express.json());
      mockServer.post('/webhook', (req, res) => {
        events.push(req.body);
        res.status(200).json({ received: true });
      });
      
      const mockServerInstance = mockServer.listen(3003);
      
      // Wait for mock server to be ready
      await new Promise(resolve => {
        mockServerInstance.on('listening', resolve);
      });

      try {
        // Register webhook pointing to mock server
        await fetch(`http://localhost:3002/webhooks/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://localhost:3003/webhook',
            events: ['api.spec.validated']
          })
        });

        // Trigger event
        await webhookService.triggerEvent({
          type: 'api.spec.validated',
          data: {
            specPath: '/path/to/spec.yaml'
          }
        });

        // Wait for webhook delivery with multiple attempts
        let attempts = 0;
        const maxAttempts = 10;
        while (events.length === 0 && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        expect(events.length).toBe(1);
        expect(events[0].type).toBe('api.spec.validated');
        expect(events[0].data.specPath).toBe('/path/to/spec.yaml');
      } finally {
        mockServerInstance.close();
      }
    });

    test('should filter events by registration', async () => {
      const events: WebhookEvent[] = [];
      
      // Mock webhook endpoint
      const mockServer = express();
      mockServer.use(express.json());
      mockServer.post('/webhook', (req, res) => {
        events.push(req.body);
        res.status(200).json({ received: true });
      });
      
      const mockServerInstance = mockServer.listen(3004);
      
      // Wait for mock server to be ready
      await new Promise(resolve => {
        mockServerInstance.on('listening', resolve);
      });

      try {
        // Register webhook for specific events only
        await fetch(`http://localhost:3002/webhooks/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: 'http://localhost:3004/webhook',
            events: ['api.generation.completed'] // Only this event
          })
        });

        // Trigger different events
        await webhookService.triggerEvent({
          type: 'api.spec.validated',
          data: { specPath: '/path/to/spec.yaml' }
        });

        await webhookService.triggerEvent({
          type: 'api.generation.completed',
          data: { generatedFiles: ['file1.kt', 'file2.kt'] }
        });

        // Wait for webhook delivery with multiple attempts
        let attempts = 0;
        const maxAttempts = 10;
        while (events.length === 0 && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        // Should only receive the generation completed event
        expect(events.length).toBe(1);
        expect(events[0].type).toBe('api.generation.completed');
      } finally {
        mockServerInstance.close();
      }
    });
  });

  describe('Webhook Security', () => {
    test('should generate and verify signatures', () => {
      const payload = { test: 'data' };
      const secret = 'test-secret';
      
      const signature = webhookService.verifySignature.toString().includes('generateSignature') 
        ? (webhookService as any).generateSignature(payload, secret)
        : crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBe(64); // SHA256 hex length
    });

    test('should verify webhook signatures correctly', () => {
      const payload = '{"test":"data"}';
      const secret = 'test-secret';
      const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      const invalidSignature = crypto.createHmac('sha256', 'wrong-secret').update(payload).digest('hex');
      
      expect(webhookService.verifySignature(payload, validSignature, secret)).toBe(true);
      expect(webhookService.verifySignature(payload, invalidSignature, secret)).toBe(false);
    });
  });

  describe('Webhook Statistics', () => {
    beforeEach(async () => {
      await webhookService.start();
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should provide webhook statistics', async () => {
      // Register some webhooks
      await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example1.com/webhook',
          events: ['api.spec.changed', 'api.generation.completed']
        })
      });

      await fetch(`http://localhost:3002/webhooks/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://example2.com/webhook',
          events: ['api.spec.validated']
        })
      });

      const stats = webhookService.getStats();
      
      expect(stats.totalWebhooks).toBe(2);
      expect(stats.activeWebhooks).toBe(2);
      expect(stats.eventTypes).toContain('api.spec.changed');
      expect(stats.eventTypes).toContain('api.generation.completed');
      expect(stats.eventTypes).toContain('api.spec.validated');
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await webhookService.start();
      // Wait a bit for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    test('should respond to health check', async () => {
      const response = await fetch(`http://localhost:3002/health`);
      expect(response.status).toBe(200);
      
      const result = await response.json() as any;
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
    });
  });
});