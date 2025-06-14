import * as crypto from 'crypto';
import express from 'express';

export interface AuthConfig {
  jwtSecret?: string;
  apiKeys?: string[];
  enableJWT?: boolean;
  enableApiKey?: boolean;
  enableBasicAuth?: boolean;
  basicAuthUsers?: { [username: string]: string }; // username: password hash
}

export interface AuthUser {
  id: string;
  username?: string;
  permissions: string[];
  source: 'jwt' | 'api-key' | 'basic-auth';
}

/**
 * Authentication and authorization service for webhook endpoints
 */
export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig = {}) {
    this.config = {
      jwtSecret: process.env.JWT_SECRET || 'default-jwt-secret',
      apiKeys: process.env.API_KEYS?.split(',') || [],
      enableJWT: true,
      enableApiKey: true,
      enableBasicAuth: false,
      basicAuthUsers: {},
      ...config
    };
  }

  /**
   * Express middleware for authentication
   */
  public authenticate() {
    return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const user = await this.validateRequest(req);
        if (!user) {
          return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Valid authentication required'
          });
        }

        // Attach user to request
        (req as any).user = user;
        next();
      } catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ 
          error: 'Authentication failed',
          message: (error as Error).message
        });
      }
    };
  }

  /**
   * Express middleware for authorization
   */
  public authorize(requiredPermissions: string[]) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const user = (req as any).user as AuthUser;
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const hasPermission = requiredPermissions.every(permission => 
        user.permissions.includes(permission) || user.permissions.includes('*')
      );

      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Forbidden',
          message: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
        });
      }

      next();
    };
  }

  /**
   * Validate incoming request and extract user information
   */
  private async validateRequest(req: express.Request): Promise<AuthUser | null> {
    // Try JWT authentication
    if (this.config.enableJWT) {
      const jwtUser = await this.validateJWT(req);
      if (jwtUser) return jwtUser;
    }

    // Try API Key authentication
    if (this.config.enableApiKey) {
      const apiKeyUser = await this.validateApiKey(req);
      if (apiKeyUser) return apiKeyUser;
    }

    // Try Basic Auth
    if (this.config.enableBasicAuth) {
      const basicUser = await this.validateBasicAuth(req);
      if (basicUser) return basicUser;
    }

    return null;
  }

  /**
   * Validate JWT token
   */
  private async validateJWT(req: express.Request): Promise<AuthUser | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    try {
      // Simple JWT validation (in production, use proper JWT library)
      const decoded = this.decodeJWT(token);
      
      return {
        id: decoded.sub || decoded.userId || 'unknown',
        username: decoded.username,
        permissions: decoded.permissions || ['webhook.read'],
        source: 'jwt'
      };
    } catch (error) {
      throw new Error('Invalid JWT token');
    }
  }

  /**
   * Validate API Key
   */
  private async validateApiKey(req: express.Request): Promise<AuthUser | null> {
    const apiKey = req.headers['x-api-key'] as string || req.query.apiKey as string;
    
    if (!apiKey) {
      return null;
    }

    if (!this.config.apiKeys?.includes(apiKey)) {
      throw new Error('Invalid API key');
    }

    return {
      id: `api-key-${crypto.createHash('md5').update(apiKey).digest('hex').substring(0, 8)}`,
      permissions: ['webhook.read', 'webhook.write', 'webhook.admin'],
      source: 'api-key'
    };
  }

  /**
   * Validate Basic Authentication
   */
  private async validateBasicAuth(req: express.Request): Promise<AuthUser | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return null;
    }

    const credentials = Buffer.from(authHeader.substring(6), 'base64').toString();
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      throw new Error('Invalid Basic Auth format');
    }

    const storedPasswordHash = this.config.basicAuthUsers?.[username];
    if (!storedPasswordHash) {
      throw new Error('Invalid username or password');
    }

    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    if (passwordHash !== storedPasswordHash) {
      throw new Error('Invalid username or password');
    }

    return {
      id: `basic-${username}`,
      username,
      permissions: ['webhook.read'],
      source: 'basic-auth'
    };
  }

  /**
   * Simple JWT decoder (in production, use proper JWT library)
   */
  private decodeJWT(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      
      // Verify signature (simplified - use proper JWT library in production)
      const signature = crypto
        .createHmac('sha256', this.config.jwtSecret!)
        .update(`${parts[0]}.${parts[1]}`)
        .digest('base64url');
      
      if (signature !== parts[2]) {
        throw new Error('Invalid JWT signature');
      }

      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        throw new Error('JWT token expired');
      }

      return payload;
    } catch (error) {
      throw new Error(`JWT decode error: ${(error as Error).message}`);
    }
  }

  /**
   * Generate a JWT token (for testing purposes)
   */
  public generateJWT(payload: any, expiresIn: number = 3600): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };

    const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadEncoded = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret!)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64url');

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  /**
   * Generate API key
   */
  public generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash password for basic auth
   */
  public hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  /**
   * Rate limiting middleware
   */
  public rateLimit(maxRequests: number = 100, windowMs: number = 60000) {
    const requests = new Map<string, number[]>();

    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const clientId = this.getClientId(req);
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get or create request log for this client
      let clientRequests = requests.get(clientId) || [];
      
      // Remove old requests outside the window
      clientRequests = clientRequests.filter(time => time > windowStart);
      
      // Check if limit exceeded
      if (clientRequests.length >= maxRequests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${maxRequests} requests per ${windowMs / 1000} seconds`
        });
      }

      // Add current request
      clientRequests.push(now);
      requests.set(clientId, clientRequests);

      next();
    };
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientId(req: express.Request): string {
    const user = (req as any).user as AuthUser;
    if (user) {
      return user.id;
    }

    // Fallback to IP address
    return req.ip || req.connection.remoteAddress || 'unknown';
  }

  /**
   * Validate webhook signature
   */
  public validateWebhookSignature() {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const signature = req.headers['x-webhook-signature'] as string;
      const payload = JSON.stringify(req.body);

      if (!signature) {
        return res.status(401).json({
          error: 'Missing webhook signature'
        });
      }

      // Webhook signature validation would go here
      // This is a placeholder for webhook-specific signature validation
      next();
    };
  }
}