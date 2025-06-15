import express from 'express';
export interface AuthConfig {
    jwtSecret?: string;
    apiKeys?: string[];
    enableJWT?: boolean;
    enableApiKey?: boolean;
    enableBasicAuth?: boolean;
    basicAuthUsers?: {
        [username: string]: string;
    };
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
export declare class AuthService {
    private config;
    constructor(config?: AuthConfig);
    /**
     * Express middleware for authentication
     */
    authenticate(): (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<express.Response<any, Record<string, any>> | undefined>;
    /**
     * Express middleware for authorization
     */
    authorize(requiredPermissions: string[]): (req: express.Request, res: express.Response, next: express.NextFunction) => express.Response<any, Record<string, any>> | undefined;
    /**
     * Validate incoming request and extract user information
     */
    private validateRequest;
    /**
     * Validate JWT token
     */
    private validateJWT;
    /**
     * Validate API Key
     */
    private validateApiKey;
    /**
     * Validate Basic Authentication
     */
    private validateBasicAuth;
    /**
     * Simple JWT decoder (in production, use proper JWT library)
     */
    private decodeJWT;
    /**
     * Generate a JWT token (for testing purposes)
     */
    generateJWT(payload: any, expiresIn?: number): string;
    /**
     * Generate API key
     */
    generateApiKey(): string;
    /**
     * Hash password for basic auth
     */
    hashPassword(password: string): string;
    /**
     * Rate limiting middleware
     */
    rateLimit(maxRequests?: number, windowMs?: number): (req: express.Request, res: express.Response, next: express.NextFunction) => express.Response<any, Record<string, any>> | undefined;
    /**
     * Get client identifier for rate limiting
     */
    private getClientId;
    /**
     * Validate webhook signature
     */
    validateWebhookSignature(): (req: express.Request, res: express.Response, next: express.NextFunction) => express.Response<any, Record<string, any>> | undefined;
}
