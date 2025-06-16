import { I18nService } from '../i18n';

describe('I18nService', () => {
  let i18nService: I18nService;

  beforeEach(() => {
    i18nService = new I18nService();
  });

  describe('constructor', () => {
    test('should initialize with default locale', () => {
      expect(i18nService).toBeInstanceOf(I18nService);
    });

    test('should accept custom locale', () => {
      const customI18n = new I18nService('ja');
      expect(customI18n).toBeInstanceOf(I18nService);
    });
  });

  describe('t() method', () => {
    test('should return translation for existing key', () => {
      const result = i18nService.t('cli.parsing', { file: 'test.yaml' });
      expect(result).toContain('test.yaml');
      expect(typeof result).toBe('string');
    });

    test('should return key if translation not found', () => {
      const result = i18nService.t('nonexistent.key');
      expect(result).toBe('nonexistent.key');
    });

    test('should interpolate variables', () => {
      const result = i18nService.t('cli.parsed', { 
        title: 'Test API', 
        version: '1.0.0' 
      });
      expect(result).toContain('Test API');
      expect(result).toContain('1.0.0');
    });

    test('should handle missing variables gracefully', () => {
      const result = i18nService.t('cli.parsing'); // Missing file parameter
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle null/undefined variables', () => {
      const result = i18nService.t('cli.parsing', { file: null });
      expect(typeof result).toBe('string');
    });

    test('should return plain strings for keys without variables', () => {
      const result = i18nService.t('cli.generating.models');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('nested translation keys', () => {
    test('should handle deeply nested keys', () => {
      const result = i18nService.t('cli.generated.model', { name: 'User', path: 'User.kt' });
      expect(result).toContain('User');
      expect(result).toContain('User.kt');
    });

    test('should handle complex interpolation', () => {
      const result = i18nService.t('cli.generated.controller', { 
        name: 'UserController', 
        path: 'controllers/UserController.kt' 
      });
      expect(result).toContain('UserController');
      expect(result).toContain('controllers/UserController.kt');
    });
  });

  describe('error handling', () => {
    test('should handle empty key', () => {
      const result = i18nService.t('');
      expect(result).toBe('');
    });

    test('should handle undefined key', () => {
      const result = i18nService.t(undefined as any);
      expect(typeof result).toBe('string');
    });

    test('should handle null key', () => {
      const result = i18nService.t(null as any);
      expect(typeof result).toBe('string');
    });

    test('should handle invalid variable types', () => {
      const result = i18nService.t('cli.parsing', { file: 123 });
      expect(typeof result).toBe('string');
    });

    test('should handle circular references in variables', () => {
      const circular: any = { name: 'test' };
      circular.self = circular;
      
      const result = i18nService.t('cli.parsing', circular);
      expect(typeof result).toBe('string');
    });
  });

  describe('localization support', () => {
    test('should support English locale', () => {
      const enI18n = new I18nService('en');
      const result = enI18n.t('cli.parsing', { file: 'test.yaml' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should support Japanese locale', () => {
      const jaI18n = new I18nService('ja');
      const result = jaI18n.t('cli.parsing', { file: 'test.yaml' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should fallback gracefully for unsupported locale', () => {
      const unknownI18n = new I18nService('unknown');
      const result = unknownI18n.t('cli.parsing', { file: 'test.yaml' });
      expect(typeof result).toBe('string');
    });
  });

  describe('variable replacement edge cases', () => {
    test('should handle variables with special characters', () => {
      const result = i18nService.t('cli.parsing', { file: 'test-file@2024.yaml' });
      expect(result).toContain('test-file@2024.yaml');
    });

    test('should handle variables with unicode characters', () => {
      const result = i18nService.t('cli.parsing', { file: 'テスト.yaml' });
      expect(result).toContain('テスト.yaml');
    });

    test('should handle variables with spaces', () => {
      const result = i18nService.t('cli.generated.model', { 
        name: 'User Model', 
        path: 'path with spaces/User.kt' 
      });
      expect(result).toContain('User Model');
      expect(result).toContain('path with spaces/User.kt');
    });

    test('should handle empty string variables', () => {
      const result = i18nService.t('cli.parsing', { file: '' });
      expect(typeof result).toBe('string');
    });

    test('should handle boolean variables', () => {
      const result = i18nService.t('cli.parsing', { file: true });
      expect(typeof result).toBe('string');
    });

    test('should handle object variables', () => {
      const result = i18nService.t('cli.parsing', { file: { name: 'test.yaml' } });
      expect(typeof result).toBe('string');
    });

    test('should handle array variables', () => {
      const result = i18nService.t('cli.parsing', { file: ['test1.yaml', 'test2.yaml'] });
      expect(typeof result).toBe('string');
    });
  });

  describe('performance', () => {
    test('should handle multiple translations efficiently', () => {
      const startTime = performance.now();
      
      for (let i = 0; i < 1000; i++) {
        i18nService.t('cli.parsing', { file: `test${i}.yaml` });
        i18nService.t('cli.parsed', { title: `API${i}`, version: `1.0.${i}` });
        i18nService.t('cli.generating.models');
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // Should complete 3000 translations in reasonable time
      expect(totalTime).toBeLessThan(1000); // Less than 1 second
    });

    test('should cache translation lookups', () => {
      const key = 'cli.parsing';
      const vars = { file: 'test.yaml' };
      
      // First call
      const startTime1 = performance.now();
      const result1 = i18nService.t(key, vars);
      const endTime1 = performance.now();
      const firstCallTime = endTime1 - startTime1;
      
      // Subsequent calls should be faster (or at least not significantly slower)
      const startTime2 = performance.now();
      const result2 = i18nService.t(key, vars);
      const endTime2 = performance.now();
      const secondCallTime = endTime2 - startTime2;
      
      expect(result1).toBe(result2);
      expect(secondCallTime).toBeLessThanOrEqual(firstCallTime * 2); // Allow for some variance
    });
  });
});