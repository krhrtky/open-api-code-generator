import { AuthenticationService, AuthProvider, TokenManager, AuthService, AuthConfig } from '../auth';
import express from 'express';

// Mock token storage
const mockTokenStorage = {
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn()
};

// Mock auth providers
const mockOAuthProvider: AuthProvider = {
  name: 'oauth',
  authenticate: jest.fn(),
  refreshToken: jest.fn(),
  validateToken: jest.fn(),
  logout: jest.fn()
};

const mockApiKeyProvider: AuthProvider = {
  name: 'apikey',
  authenticate: jest.fn(),
  refreshToken: jest.fn(),
  validateToken: jest.fn(),
  logout: jest.fn()
};

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let tokenManager: TokenManager;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenManager = new TokenManager(mockTokenStorage);
    
    // Mock TokenManager methods to ensure they're spy functions
    jest.spyOn(tokenManager, 'setToken').mockImplementation(jest.fn());
    jest.spyOn(tokenManager, 'removeToken').mockImplementation(jest.fn());
    
    authService = new AuthenticationService(tokenManager);
  });

  afterEach(() => {
    // Clean up any timers set by TokenManager
    if (tokenManager) {
      tokenManager.cleanup();
    }
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with token manager', () => {
      expect(authService).toBeInstanceOf(AuthenticationService);
    });

    test('should initialize with default options', () => {
      const defaultService = new AuthenticationService();
      expect(defaultService).toBeInstanceOf(AuthenticationService);
    });
  });

  describe('provider management', () => {
    test('should register auth provider', () => {
      authService.registerProvider(mockOAuthProvider);

      const providers = authService.getProviders();
      expect(providers).toContain(mockOAuthProvider);
    });

    test('should not register duplicate providers', () => {
      authService.registerProvider(mockOAuthProvider);
      authService.registerProvider(mockOAuthProvider);

      const providers = authService.getProviders();
      expect(providers.filter((p: AuthProvider) => p.name === 'oauth')).toHaveLength(1);
    });

    test('should replace provider with same name', () => {
      const newOAuthProvider: AuthProvider = {
        ...mockOAuthProvider,
        authenticate: jest.fn().mockResolvedValue({ token: 'new-token' })
      };

      authService.registerProvider(mockOAuthProvider);
      authService.registerProvider(newOAuthProvider);

      const providers = authService.getProviders();
      const oauthProvider = providers.find((p: AuthProvider) => p.name === 'oauth');
      expect(oauthProvider).toBe(newOAuthProvider);
    });

    test('should get provider by name', () => {
      authService.registerProvider(mockOAuthProvider);
      authService.registerProvider(mockApiKeyProvider);

      const provider = authService.getProvider('oauth');
      expect(provider).toBe(mockOAuthProvider);
    });

    test('should return undefined for non-existent provider', () => {
      const provider = authService.getProvider('nonexistent');
      expect(provider).toBeUndefined();
    });
  });

  describe('authentication', () => {
    beforeEach(() => {
      authService.registerProvider(mockOAuthProvider);
      authService.registerProvider(mockApiKeyProvider);
    });

    test('should authenticate with OAuth provider', async () => {
      const mockToken = { access_token: 'test-token', expires_in: 3600 };
      mockOAuthProvider.authenticate = jest.fn().mockResolvedValue(mockToken);

      const result = await authService.authenticate('oauth', { username: 'test', password: 'pass' });

      expect(result).toBe(mockToken);
      expect(mockOAuthProvider.authenticate).toHaveBeenCalledWith({ username: 'test', password: 'pass' });
    });

    test('should authenticate with API key provider', async () => {
      const mockToken = { api_key: 'test-key' };
      mockApiKeyProvider.authenticate = jest.fn().mockResolvedValue(mockToken);

      const result = await authService.authenticate('apikey', { key: 'test-key' });

      expect(result).toBe(mockToken);
      expect(mockApiKeyProvider.authenticate).toHaveBeenCalledWith({ key: 'test-key' });
    });

    test('should throw error for unknown provider', async () => {
      await expect(
        authService.authenticate('unknown', {})
      ).rejects.toThrow('Authentication provider not found: unknown');
    });

    test('should handle authentication failure', async () => {
      mockOAuthProvider.authenticate = jest.fn().mockRejectedValue(new Error('Auth failed'));

      await expect(
        authService.authenticate('oauth', { username: 'test', password: 'wrong' })
      ).rejects.toThrow('Auth failed');
    });

    test('should store token after successful authentication', async () => {
      const mockToken = { access_token: 'test-token', expires_in: 3600 };
      mockOAuthProvider.authenticate = jest.fn().mockResolvedValue(mockToken);

      await authService.authenticate('oauth', { username: 'test', password: 'pass' });

      expect(tokenManager.setToken).toHaveBeenCalledWith('oauth', mockToken);
    });
  });

  describe('token validation', () => {
    beforeEach(() => {
      authService.registerProvider(mockOAuthProvider);
    });

    test('should validate token with provider', async () => {
      const mockToken = { access_token: 'test-token' };
      mockOAuthProvider.validateToken = jest.fn().mockResolvedValue(true);
      mockTokenStorage.get.mockReturnValue(mockToken);

      const isValid = await authService.validateToken('oauth');

      expect(isValid).toBe(true);
      expect(mockOAuthProvider.validateToken).toHaveBeenCalledWith(mockToken);
    });

    test('should return false for missing token', async () => {
      mockTokenStorage.get.mockReturnValue(null);

      const isValid = await authService.validateToken('oauth');

      expect(isValid).toBe(false);
      expect(mockOAuthProvider.validateToken).not.toHaveBeenCalled();
    });

    test('should return false for unknown provider', async () => {
      const isValid = await authService.validateToken('unknown');

      expect(isValid).toBe(false);
    });

    test('should handle validation errors', async () => {
      const mockToken = { access_token: 'test-token' };
      mockOAuthProvider.validateToken = jest.fn().mockRejectedValue(new Error('Validation failed'));
      mockTokenStorage.get.mockReturnValue(mockToken);

      const isValid = await authService.validateToken('oauth');

      expect(isValid).toBe(false);
    });
  });

  describe('token refresh', () => {
    beforeEach(() => {
      authService.registerProvider(mockOAuthProvider);
    });

    test('should refresh token', async () => {
      const oldToken = { access_token: 'old-token', refresh_token: 'refresh-token' };
      const newToken = { access_token: 'new-token', refresh_token: 'new-refresh-token' };
      
      mockTokenStorage.get.mockReturnValue(oldToken);
      mockOAuthProvider.refreshToken = jest.fn().mockResolvedValue(newToken);

      const result = await authService.refreshToken('oauth');

      expect(result).toBe(newToken);
      expect(mockOAuthProvider.refreshToken).toHaveBeenCalledWith(oldToken);
      expect(tokenManager.setToken).toHaveBeenCalledWith('oauth', newToken);
    });

    test('should return null for missing token', async () => {
      mockTokenStorage.get.mockReturnValue(null);

      const result = await authService.refreshToken('oauth');

      expect(result).toBeNull();
      expect(mockOAuthProvider.refreshToken).not.toHaveBeenCalled();
    });

    test('should handle refresh errors', async () => {
      const oldToken = { access_token: 'old-token', refresh_token: 'refresh-token' };
      
      mockTokenStorage.get.mockReturnValue(oldToken);
      mockOAuthProvider.refreshToken = jest.fn().mockRejectedValue(new Error('Refresh failed'));

      await expect(authService.refreshToken('oauth')).rejects.toThrow('Refresh failed');
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      authService.registerProvider(mockOAuthProvider);
    });

    test('should logout and clear token', async () => {
      const mockToken = { access_token: 'test-token' };
      mockTokenStorage.get.mockReturnValue(mockToken);
      mockOAuthProvider.logout = jest.fn().mockResolvedValue(undefined);

      await authService.logout('oauth');

      expect(mockOAuthProvider.logout).toHaveBeenCalledWith(mockToken);
      expect(tokenManager.removeToken).toHaveBeenCalledWith('oauth');
    });

    test('should logout without token', async () => {
      mockTokenStorage.get.mockReturnValue(null);
      mockOAuthProvider.logout = jest.fn().mockResolvedValue(undefined);

      await authService.logout('oauth');

      expect(mockOAuthProvider.logout).toHaveBeenCalledWith(null);
      expect(tokenManager.removeToken).toHaveBeenCalledWith('oauth');
    });

    test('should handle logout errors', async () => {
      const mockToken = { access_token: 'test-token' };
      mockTokenStorage.get.mockReturnValue(mockToken);
      mockOAuthProvider.logout = jest.fn().mockRejectedValue(new Error('Logout failed'));

      await expect(authService.logout('oauth')).rejects.toThrow('Logout failed');
    });
  });

  describe('session management', () => {
    test('should check if user is authenticated', async () => {
      authService.registerProvider(mockOAuthProvider);
      mockOAuthProvider.validateToken = jest.fn().mockResolvedValue(true);
      mockTokenStorage.get.mockReturnValue({ access_token: 'test-token' });

      const isAuthenticated = await authService.isAuthenticated('oauth');

      expect(isAuthenticated).toBe(true);
    });

    test('should return false for unauthenticated user', async () => {
      authService.registerProvider(mockOAuthProvider);
      mockTokenStorage.get.mockReturnValue(null);

      const isAuthenticated = await authService.isAuthenticated('oauth');

      expect(isAuthenticated).toBe(false);
    });

    test('should get current user info', async () => {
      authService.registerProvider(mockOAuthProvider);
      const mockUser = { id: '123', username: 'testuser', email: 'test@example.com' };
      mockOAuthProvider.getUserInfo = jest.fn().mockResolvedValue(mockUser);
      mockTokenStorage.get.mockReturnValue({ access_token: 'test-token' });

      const userInfo = await authService.getCurrentUser('oauth');

      expect(userInfo).toBe(mockUser);
    });

    test('should return null for missing user info', async () => {
      authService.registerProvider(mockOAuthProvider);
      mockTokenStorage.get.mockReturnValue(null);

      const userInfo = await authService.getCurrentUser('oauth');

      expect(userInfo).toBeNull();
    });
  });
});

describe('TokenManager', () => {
  let tokenManager: TokenManager;

  beforeEach(() => {
    jest.clearAllMocks();
    tokenManager = new TokenManager(mockTokenStorage);
  });

  describe('token operations', () => {
    test('should set token', () => {
      const token = { access_token: 'test-token' };
      
      tokenManager.setToken('oauth', token);

      expect(mockTokenStorage.set).toHaveBeenCalledWith('oauth', token);
    });

    test('should get token', () => {
      const token = { access_token: 'test-token' };
      mockTokenStorage.get.mockReturnValue(token);

      const result = tokenManager.getToken('oauth');

      expect(result).toBe(token);
      expect(mockTokenStorage.get).toHaveBeenCalledWith('oauth');
    });

    test('should remove token', () => {
      tokenManager.removeToken('oauth');

      expect(mockTokenStorage.remove).toHaveBeenCalledWith('oauth');
    });

    test('should clear all tokens', () => {
      tokenManager.clearAllTokens();

      expect(mockTokenStorage.clear).toHaveBeenCalled();
    });
  });

  describe('token expiration', () => {
    test('should check if token is expired', () => {
      const expiredToken = {
        access_token: 'test-token',
        expires_at: Date.now() - 1000 // Expired 1 second ago
      };

      const isExpired = tokenManager.isTokenExpired(expiredToken);

      expect(isExpired).toBe(true);
    });

    test('should check if token is not expired', () => {
      const validToken = {
        access_token: 'test-token',
        expires_at: Date.now() + 3600000 // Expires in 1 hour
      };

      const isExpired = tokenManager.isTokenExpired(validToken);

      expect(isExpired).toBe(false);
    });

    test('should handle token without expiration', () => {
      const tokenWithoutExpiration = {
        access_token: 'test-token'
      };

      const isExpired = tokenManager.isTokenExpired(tokenWithoutExpiration);

      expect(isExpired).toBe(false);
    });
  });

  describe('token refresh scheduling', () => {
    test('should schedule token refresh', () => {
      const token = {
        access_token: 'test-token',
        expires_at: Date.now() + 3600000 // Expires in 1 hour
      };

      const refreshCallback = jest.fn();
      tokenManager.scheduleRefresh('oauth', token, refreshCallback);

      // Test that a refresh is scheduled (implementation details may vary)
      expect(refreshCallback).not.toHaveBeenCalled(); // Should not be called immediately
      
      // Clean up immediately to prevent open handles
      tokenManager.cancelRefresh('oauth');
    });

    test('should cancel scheduled refresh', () => {
      const token = {
        access_token: 'test-token',
        expires_at: Date.now() + 3600000
      };

      const refreshCallback = jest.fn();
      tokenManager.scheduleRefresh('oauth', token, refreshCallback);
      tokenManager.cancelRefresh('oauth');

      // After cancellation, refresh should not execute
      expect(refreshCallback).not.toHaveBeenCalled();
    });
  });
});

describe('AuthService', () => {
  let authService: AuthService;
  let mockReq: Partial<express.Request>;
  let mockRes: Partial<express.Response>;
  let mockNext: jest.MockedFunction<express.NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.API_KEYS = 'key1,key2,key3';
    
    mockNext = jest.fn();
    
    // Mock Express Response with proper typing
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };
    
    // Mock Express Request
    mockReq = {
      headers: {},
      query: {},
      body: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any
    };
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.JWT_SECRET;
    delete process.env.API_KEYS;
  });

  describe('constructor and configuration', () => {
    test('should initialize with default config', () => {
      authService = new AuthService();
      expect(authService).toBeInstanceOf(AuthService);
    });

    test('should initialize with custom config', () => {
      const config: AuthConfig = {
        jwtSecret: 'custom-secret',
        apiKeys: ['custom-key1', 'custom-key2'],
        enableJWT: false,
        enableApiKey: true,
        enableBasicAuth: true,
        basicAuthUsers: {
          'testuser': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // sha256('')
        }
      };
      
      authService = new AuthService(config);
      expect(authService).toBeInstanceOf(AuthService);
    });

    test('should use environment variables for defaults', () => {
      authService = new AuthService();
      
      // Test with a valid API key from environment
      mockReq.headers = { 'x-api-key': 'key1' };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      // Should not reject the key from environment
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('JWT authentication', () => {
    beforeEach(() => {
      authService = new AuthService({
        jwtSecret: 'test-secret',
        enableJWT: true,
        enableApiKey: false,
        enableBasicAuth: false
      });
    });

    test('should authenticate with valid JWT token', async () => {
      const payload = {
        sub: 'user123',
        username: 'testuser',
        permissions: ['webhook.read', 'webhook.write']
      };
      
      const validToken = authService.generateJWT(payload);
      mockReq.headers = { authorization: `Bearer ${validToken}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual({
        id: 'user123',
        username: 'testuser',
        permissions: ['webhook.read', 'webhook.write'],
        source: 'jwt'
      });
    });

    test('should reject invalid JWT token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: expect.stringContaining('Invalid JWT format')
      });
    });

    test('should reject expired JWT token', async () => {
      const payload = { sub: 'user123' };
      const expiredToken = authService.generateJWT(payload, -3600); // Expired 1 hour ago
      
      mockReq.headers = { authorization: `Bearer ${expiredToken}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle malformed JWT tokens', async () => {
      mockReq.headers = { authorization: 'Bearer malformed.token' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle JWT without signature', async () => {
      const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
      const payload = Buffer.from('{"sub":"user123"}').toString('base64url');
      const invalidToken = `${header}.${payload}`;
      
      mockReq.headers = { authorization: `Bearer ${invalidToken}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle JWT with wrong signature', async () => {
      const wrongSecretService = new AuthService({ jwtSecret: 'wrong-secret' });
      const wrongToken = wrongSecretService.generateJWT({ sub: 'user123' });
      
      mockReq.headers = { authorization: `Bearer ${wrongToken}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('API Key authentication', () => {
    beforeEach(() => {
      authService = new AuthService({
        apiKeys: ['valid-key-1', 'valid-key-2'],
        enableJWT: false,
        enableApiKey: true,
        enableBasicAuth: false
      });
    });

    test('should authenticate with valid API key in header', async () => {
      mockReq.headers = { 'x-api-key': 'valid-key-1' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual({
        id: expect.stringMatching(/^api-key-[a-f0-9]{8}$/),
        permissions: ['webhook.read', 'webhook.write', 'webhook.admin'],
        source: 'api-key'
      });
    });

    test('should authenticate with valid API key in query', async () => {
      mockReq.query = { apiKey: 'valid-key-2' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user.source).toBe('api-key');
    });

    test('should reject invalid API key', async () => {
      mockReq.headers = { 'x-api-key': 'invalid-key' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid API key'
      });
    });

    test('should handle missing API key gracefully', async () => {
      mockReq.headers = {};
      mockReq.query = {};
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Valid authentication required'
      });
    });

    test('should prioritize header over query parameter', async () => {
      mockReq.headers = { 'x-api-key': 'valid-key-1' };
      mockReq.query = { apiKey: 'valid-key-2' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      // Should use the header key
      expect((mockReq as any).user.id).toMatch(/^api-key-/);
    });
  });

  describe('Basic authentication', () => {
    beforeEach(() => {
      authService = new AuthService({
        enableJWT: false,
        enableApiKey: false,
        enableBasicAuth: true,
        basicAuthUsers: {
          'testuser': authService.hashPassword('testpass'),
          'admin': authService.hashPassword('admin123')
        }
      });
    });

    test('should authenticate with valid basic auth', async () => {
      const credentials = Buffer.from('testuser:testpass').toString('base64');
      mockReq.headers = { authorization: `Basic ${credentials}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual({
        id: 'basic-testuser',
        username: 'testuser',
        permissions: ['webhook.read'],
        source: 'basic-auth'
      });
    });

    test('should reject invalid username', async () => {
      const credentials = Buffer.from('invaliduser:testpass').toString('base64');
      mockReq.headers = { authorization: `Basic ${credentials}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid username or password'
      });
    });

    test('should reject invalid password', async () => {
      const credentials = Buffer.from('testuser:wrongpass').toString('base64');
      mockReq.headers = { authorization: `Basic ${credentials}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle malformed basic auth', async () => {
      const credentials = Buffer.from('malformed-credentials').toString('base64');
      mockReq.headers = { authorization: `Basic ${credentials}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication failed',
        message: 'Invalid Basic Auth format'
      });
    });

    test('should handle missing username or password', async () => {
      const credentials = Buffer.from(':password').toString('base64');
      mockReq.headers = { authorization: `Basic ${credentials}` };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('authorization middleware', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    test('should authorize user with required permissions', () => {
      (mockReq as any).user = {
        id: 'user123',
        permissions: ['webhook.read', 'webhook.write']
      };
      
      const middleware = authService.authorize(['webhook.read']);
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should authorize user with wildcard permission', () => {
      (mockReq as any).user = {
        id: 'admin',
        permissions: ['*']
      };
      
      const middleware = authService.authorize(['webhook.admin', 'webhook.write']);
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    test('should reject user without required permissions', () => {
      (mockReq as any).user = {
        id: 'user123',
        permissions: ['webhook.read']
      };
      
      const middleware = authService.authorize(['webhook.write', 'webhook.admin']);
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions. Required: webhook.write, webhook.admin'
      });
    });

    test('should reject unauthenticated request', () => {
      // No user attached to request
      const middleware = authService.authorize(['webhook.read']);
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    });
  });

  describe('rate limiting', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    test('should allow requests within rate limit', () => {
      const middleware = authService.rateLimit(2, 60000); // 2 requests per minute
      
      // First request
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Second request
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(2);
    });

    test('should block requests exceeding rate limit', () => {
      const middleware = authService.rateLimit(1, 60000); // 1 request per minute
      
      // First request (allowed)
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Second request (blocked)
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1); // Should not be called again
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded',
        message: 'Maximum 1 requests per 60 seconds'
      });
    });

    test('should use user ID for authenticated requests', () => {
      (mockReq as any).user = { id: 'user123' };
      const middleware = authService.rateLimit(1, 60000);
      
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should use IP address for anonymous requests', () => {
      mockReq.ip = '192.168.1.100';
      const middleware = authService.rateLimit(1, 60000);
      
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle missing IP address', () => {
      delete mockReq.ip;
      delete (mockReq as any).connection;
      
      const middleware = authService.rateLimit(1, 60000);
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('webhook signature validation', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    test('should require webhook signature', () => {
      mockReq.body = { test: 'data' };
      
      const middleware = authService.validateWebhookSignature();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing webhook signature'
      });
    });

    test('should accept request with signature', () => {
      mockReq.headers = { 'x-webhook-signature': 'some-signature' };
      mockReq.body = { test: 'data' };
      
      const middleware = authService.validateWebhookSignature();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    test('should generate JWT tokens', () => {
      const payload = { sub: 'user123', username: 'testuser' };
      const token = authService.generateJWT(payload, 3600);
      
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    test('should generate API keys', () => {
      const apiKey = authService.generateApiKey();
      
      expect(typeof apiKey).toBe('string');
      expect(apiKey).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(/^[a-f0-9]+$/.test(apiKey)).toBe(true);
    });

    test('should hash passwords consistently', () => {
      const password = 'testpassword123';
      const hash1 = authService.hashPassword(password);
      const hash2 = authService.hashPassword(password);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1).toHaveLength(64); // SHA-256 hex output
    });

    test('should generate different hashes for different passwords', () => {
      const hash1 = authService.hashPassword('password1');
      const hash2 = authService.hashPassword('password2');
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('multiple authentication methods', () => {
    beforeEach(() => {
      authService = new AuthService({
        jwtSecret: 'test-secret',
        apiKeys: ['valid-key'],
        enableJWT: true,
        enableApiKey: true,
        enableBasicAuth: true,
        basicAuthUsers: {
          'testuser': authService.hashPassword('testpass')
        }
      });
    });

    test('should prioritize JWT over API key', async () => {
      const payload = { sub: 'jwt-user', permissions: ['jwt.permission'] };
      const validToken = authService.generateJWT(payload);
      
      mockReq.headers = {
        authorization: `Bearer ${validToken}`,
        'x-api-key': 'valid-key'
      };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user.source).toBe('jwt');
      expect((mockReq as any).user.id).toBe('jwt-user');
    });

    test('should fall back to API key when JWT fails', async () => {
      mockReq.headers = {
        authorization: 'Bearer invalid-jwt-token',
        'x-api-key': 'valid-key'
      };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user.source).toBe('api-key');
    });

    test('should fall back to Basic Auth when others fail', async () => {
      const credentials = Buffer.from('testuser:testpass').toString('base64');
      mockReq.headers = {
        authorization: `Basic ${credentials}`,
        'x-api-key': 'invalid-key'
      };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user.source).toBe('basic-auth');
      expect((mockReq as any).user.username).toBe('testuser');
    });
  });

  describe('error handling and edge cases', () => {
    beforeEach(() => {
      authService = new AuthService();
    });

    test('should handle empty authorization header', async () => {
      mockReq.headers = { authorization: '' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle authorization header without Bearer prefix', async () => {
      mockReq.headers = { authorization: 'token123' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle malformed base64 in Basic Auth', async () => {
      mockReq.headers = { authorization: 'Basic invalid-base64!' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle console error during authentication', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      // Force an error by providing malformed JWT
      mockReq.headers = { authorization: 'Bearer malformed.jwt.token' };
      
      const middleware = authService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(consoleSpy).toHaveBeenCalledWith('Authentication error:', expect.any(Error));
      expect(mockRes.status).toHaveBeenCalledWith(401);
      
      consoleSpy.mockRestore();
    });

    test('should handle disabled authentication methods', async () => {
      const noAuthService = new AuthService({
        enableJWT: false,
        enableApiKey: false,
        enableBasicAuth: false
      });
      
      mockReq.headers = { 'x-api-key': 'any-key' };
      
      const middleware = noAuthService.authenticate();
      await middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('edge cases and additional coverage', () => {
    beforeEach(() => {
      authService = new AuthService({
        jwtSecret: 'test-secret',
        apiKeys: ['valid-key'],
        enableJWT: true,
        enableApiKey: true,
        enableBasicAuth: true,
        basicAuthUsers: {
          'testuser': '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' // sha256('test')
        }
      });
    });

    test('should handle invalid Basic auth header encoding', () => {
      mockReq.headers = {
        authorization: 'Basic invalid-base64-encoding!'
      };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle empty authorization header', () => {
      mockReq.headers = {
        authorization: ''
      };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle authorization header with only scheme', () => {
      mockReq.headers = {
        authorization: 'Bearer'
      };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle unsupported auth scheme', () => {
      mockReq.headers = {
        authorization: 'Digest username="test"'
      };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle case-insensitive API key header', () => {
      mockReq.headers = {
        'X-API-KEY': 'valid-key' // uppercase variation
      };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).user).toBeDefined();
      expect((mockReq as any).user.source).toBe('api-key');
    });

    test('should handle authorization with multiple spaces', () => {
      mockReq.headers = {
        authorization: 'Bearer   valid-jwt-token'
      };
      
      const middleware = authService.authenticate();
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    test('should handle user missing permissions array', () => {
      (mockReq as any).user = { id: 'user123', permissions: undefined }; // No permissions array
      
      const middleware = authService.authorize(['test.read']);
      
      expect(() => {
        middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      }).not.toThrow();
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    test('should handle IP-based rate limiting edge cases', () => {
      const middleware = authService.rateLimit(1, 1000);
      
      // Test with different IP variations
      mockReq.ip = '192.168.1.1';
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      // Reset mock call count
      mockNext.mockClear();
      
      // Same IP should be blocked
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    test('should handle missing IP address in rate limiting', () => {
      const middleware = authService.rateLimit(1, 1000);
      
      // Request without IP
      delete mockReq.ip;
      (mockReq as any).connection = null;
      
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      
      // Should still work (using 'unknown' as identifier)
      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle rate limit cleanup timing', () => {
      jest.useFakeTimers();
      
      const middleware = authService.rateLimit(1, 1000);
      
      mockReq.ip = '192.168.1.100';
      
      // First request
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      mockNext.mockClear();
      
      // Second request (should be blocked)
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      
      // Fast-forward time past window
      jest.advanceTimersByTime(1100);
      
      // Third request (should be allowed again)
      middleware(mockReq as express.Request, mockRes as express.Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });
});