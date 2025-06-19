import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import * as path from 'path';
import * as os from 'os';

export class I18nService {
  private initialized = false;
  private customLocale?: string;

  constructor(locale?: string) {
    this.customLocale = locale;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await i18next
      .use(Backend)
      .init({
        lng: this.detectLanguage(),
        fallbackLng: 'en',
        debug: false,
        backend: {
          loadPath: path.join(__dirname, '../locales/{{lng}}.json')
        },
        interpolation: {
          escapeValue: false
        }
      });

    this.initialized = true;
  }

  private detectLanguage(): string {
    // Use custom locale if provided
    if (this.customLocale && this.isSupportedLanguage(this.customLocale)) {
      return this.customLocale;
    }
    
    // Check command line argument (handled by CLI)
    // Check environment variables
    const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL;
    if (envLang) {
      const lang = envLang.split('_')[0].split('.')[0].toLowerCase();
      if (this.isSupportedLanguage(lang)) {
        return lang;
      }
    }

    // Check system locale
    try {
      const locale = Intl.DateTimeFormat().resolvedOptions().locale;
      const lang = locale.split('-')[0].toLowerCase();
      if (this.isSupportedLanguage(lang)) {
        return lang;
      }
    } catch {
      // Fallback to English if locale detection fails
    }

    return 'en';
  }

  private isSupportedLanguage(lang: string): boolean {
    const supportedLanguages = ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de'];
    return supportedLanguages.includes(lang);
  }

  async setLanguage(language: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.isSupportedLanguage(language)) {
      await i18next.changeLanguage(language);
    } else {
      console.warn(`Unsupported language: ${language}. Falling back to English.`);
      await i18next.changeLanguage('en');
    }
  }

  t(key: string, options?: any): string {
    if (!this.initialized) {
      throw new Error('I18nService not initialized. Call initialize() first.');
    }
    return i18next.t(key, options) as string;
  }

  getCurrentLanguage(): string {
    return i18next.language;
  }

  getSupportedLanguages(): string[] {
    return ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de'];
  }
}