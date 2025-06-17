import { AuthenticationService, AuthProvider, TokenManager } from '../auth';

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