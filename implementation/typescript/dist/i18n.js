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
exports.I18nService = void 0;
const i18next_1 = __importDefault(require("i18next"));
const i18next_fs_backend_1 = __importDefault(require("i18next-fs-backend"));
const path = __importStar(require("path"));
class I18nService {
    constructor() {
        this.initialized = false;
    }
    async initialize() {
        if (this.initialized)
            return;
        await i18next_1.default
            .use(i18next_fs_backend_1.default)
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
    detectLanguage() {
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
        }
        catch {
            // Fallback to English if locale detection fails
        }
        return 'en';
    }
    isSupportedLanguage(lang) {
        const supportedLanguages = ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de'];
        return supportedLanguages.includes(lang);
    }
    async setLanguage(language) {
        if (!this.initialized) {
            await this.initialize();
        }
        if (this.isSupportedLanguage(language)) {
            await i18next_1.default.changeLanguage(language);
        }
        else {
            console.warn(`Unsupported language: ${language}. Falling back to English.`);
            await i18next_1.default.changeLanguage('en');
        }
    }
    t(key, options) {
        if (!this.initialized) {
            throw new Error('I18nService not initialized. Call initialize() first.');
        }
        return i18next_1.default.t(key, options);
    }
    getCurrentLanguage() {
        return i18next_1.default.language;
    }
    getSupportedLanguages() {
        return ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de'];
    }
}
exports.I18nService = I18nService;
//# sourceMappingURL=i18n.js.map