export declare class I18nService {
    private initialized;
    initialize(): Promise<void>;
    private detectLanguage;
    private isSupportedLanguage;
    setLanguage(language: string): Promise<void>;
    t(key: string, options?: any): string;
    getCurrentLanguage(): string;
    getSupportedLanguages(): string[];
}
