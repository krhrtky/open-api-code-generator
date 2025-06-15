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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto = __importStar(require("crypto"));
/**
 * Authentication and authorization service for webhook endpoints
 */
class AuthService {
    constructor(config = {}) {
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
    authenticate() {
        return async (req, res, next) => {
            try {
                const user = await this.validateRequest(req);
                if (!user) {
                    return res.status(401).json({
                        error: 'Unauthorized',
                        message: 'Valid authentication required'
                    });
                }
                // Attach user to request
                req.user = user;
                next();
            }
            catch (error) {
                console.error('Authentication error:', error);
                res.status(401).json({
                    error: 'Authentication failed',
                    message: error.message
                });
            }
        };
    }
    /**
     * Express middleware for authorization
     */
    authorize(requiredPermissions) {
        return (req, res, next) => {
            const user = req.user;
            if (!user) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Authentication required'
                });
            }
            const hasPermission = requiredPermissions.every(permission => user.permissions.includes(permission) || user.permissions.includes('*'));
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
    async validateRequest(req) {
        // Try JWT authentication
        if (this.config.enableJWT) {
            const jwtUser = await this.validateJWT(req);
            if (jwtUser)
                return jwtUser;
        }
        // Try API Key authentication
        if (this.config.enableApiKey) {
            const apiKeyUser = await this.validateApiKey(req);
            if (apiKeyUser)
                return apiKeyUser;
        }
        // Try Basic Auth
        if (this.config.enableBasicAuth) {
            const basicUser = await this.validateBasicAuth(req);
            if (basicUser)
                return basicUser;
        }
        return null;
    }
    /**
     * Validate JWT token
     */
    async validateJWT(req) {
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
        }
        catch (error) {
            throw new Error('Invalid JWT token');
        }
    }
    /**
     * Validate API Key
     */
    async validateApiKey(req) {
        const apiKey = req.headers['x-api-key'] || req.query.apiKey;
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
    async validateBasicAuth(req) {
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
    decodeJWT(token) {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }
        try {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
            // Verify signature (simplified - use proper JWT library in production)
            const signature = crypto
                .createHmac('sha256', this.config.jwtSecret)
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
        }
        catch (error) {
            throw new Error(`JWT decode error: ${error.message}`);
        }
    }
    /**
     * Generate a JWT token (for testing purposes)
     */
    generateJWT(payload, expiresIn = 3600) {
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
            .createHmac('sha256', this.config.jwtSecret)
            .update(`${headerEncoded}.${payloadEncoded}`)
            .digest('base64url');
        return `${headerEncoded}.${payloadEncoded}.${signature}`;
    }
    /**
     * Generate API key
     */
    generateApiKey() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Hash password for basic auth
     */
    hashPassword(password) {
        return crypto.createHash('sha256').update(password).digest('hex');
    }
    /**
     * Rate limiting middleware
     */
    rateLimit(maxRequests = 100, windowMs = 60000) {
        const requests = new Map();
        return (req, res, next) => {
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
    getClientId(req) {
        const user = req.user;
        if (user) {
            return user.id;
        }
        // Fallback to IP address
        return req.ip || req.connection.remoteAddress || 'unknown';
    }
    /**
     * Validate webhook signature
     */
    validateWebhookSignature() {
        return (req, res, next) => {
            const signature = req.headers['x-webhook-signature'];
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
exports.AuthService = AuthService;
//# sourceMappingURL=auth.js.map